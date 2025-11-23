// app/api/admin/invoices/send/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { format } from "date-fns";

/* ------------------------ helpers (Stripe + mail) ------------------------ */
async function getStripe() {
  const Stripe = (await import("stripe")).default;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

async function sendMail({ to, subject, html, attachments }) {
  const apiKey = process.env.RESEND_API_KEY;

  let from = process.env.EMAIL_FROM;
  if (!from) {
    if (process.env.NODE_ENV !== "production") {
      from = "Oasis Bookings <onboarding@resend.dev>";
    } else {
      throw new Error("EMAIL_FROM is not set. Use a verified domain address.");
    }
  }
  if (
    /@(gmail|googlemail|outlook|hotmail|live|yahoo|icloud)\.com\s*>?$/.test(
      from
    )
  ) {
    throw new Error(
      `EMAIL_FROM cannot be a mailbox-provider domain (${from}). ` +
        `Use onboarding@resend.dev in dev or a verified domain in production.`
    );
  }

  if (!apiKey) {
    console.log("[DEV] sendMail dry-run (missing RESEND_API_KEY):", {
      to,
      subject,
    });
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const res = await resend.emails.send({
    from,
    to,
    subject,
    html,
    attachments: attachments && attachments.length ? attachments : undefined,
  });
  if (res && res.error)
    throw new Error(res.error.message || "Mail provider error");
}

function brandName() {
  return process.env.NEXT_PUBLIC_SITE_NAME || "Oasis";
}

function formatInv(id) {
  return `INV-${String(id).padStart(6, "0")}`;
}

function emailFromPrimary(pc) {
  if (!pc || typeof pc !== "object") return "";
  return pc.email || pc.contactEmail || pc.customer_email || "";
}
function nameFromPrimary(pc) {
  if (!pc || typeof pc !== "object") return "—";
  const full =
    pc.fullName ||
    pc.full_name ||
    [pc.firstName, pc.lastName].filter(Boolean).join(" ") ||
    [pc.first_name, pc.last_name].filter(Boolean).join(" ") ||
    pc.name ||
    null;
  return full || emailFromPrimary(pc) || "—";
}

function fmtDatePlain(iso) {
  try {
    return format(new Date(iso), "PPP");
  } catch {
    return "—";
  }
}
function fmtDateTimePlain(iso) {
  try {
    const d = new Date(iso);
    return format(d, "PPP p");
  } catch {
    return "—";
  }
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function fmtMoney(amount, currency) {
  try {
    const nf = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: (currency || "EUR").toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return nf.format(Number(amount || 0));
  } catch {
    return `€${Number(amount || 0).toFixed(2)}`;
  }
}

function invoiceLineDescription(b) {
  const when = fmtDateTimePlain(b.startTime);
  const guests = b.numberOfPeople || 1;
  return `${brandName()} booking ${formatInv(
    b.id
  )} — ${guests} guest(s) — ${when}`;
}

function toMinor(currency, amount) {
  const zero = [
    "BIF",
    "CLP",
    "DJF",
    "GNF",
    "JPY",
    "KMF",
    "KRW",
    "MGA",
    "PYG",
    "RWF",
    "UGX",
    "VND",
    "VUV",
    "XAF",
    "XOF",
    "XPF",
  ];
  const isZero = zero.includes(String(currency || "EUR").toUpperCase());
  return Math.round(Number(amount || 0) * (isZero ? 1 : 100));
}

async function ensureStripeCustomer(stripe, { email, name }) {
  if (!email) throw new Error("Customer email required");
  const list = await stripe.customers.list({ email, limit: 1 });
  if (list?.data?.length) return list.data[0].id;
  const c = await stripe.customers.create({ email, name });
  return c.id;
}

// Force a brand-new invoice if we need the updated fields to show on the PDF

/** Finalize and mark an invoice paid (for record keeping) then return it */
// pass in preferNew to force a new, up-to-date invoice
async function ensureStripeInvoice(b, { preferNew = false } = {}) {
  const stripe = await getStripe();
  const pc = b.primary_contact || {};
  const email = emailFromPrimary(pc);
  const name = nameFromPrimary(pc);

  // 1) Upsert + update customer so invoice pulls correct display details
  const customerId = await ensureStripeCustomer(stripe, { email, name });
  const address = mapStripeAddress(pc.address);
  await stripe.customers.update(customerId, {
    name: pc.businessName || name, // business name shows as "Billed to"
    email,
    phone: pc.phone || undefined,
    address: address || undefined,
    metadata: {
      bookingId: String(b.id),
      contactPerson: name || "",
      taxNumber: pc.taxNumber || "",
    },
    // (Optional) You could also set invoice_settings.custom_fields here for future invoices
  });

  // 2) Try to attach a real EU VAT tax ID (format like EL123456789)
  const taxIdType = await syncCustomerTaxId(stripe, customerId, pc.taxNumber);

  // 3) If allowed to reuse session invoice and not forcing new, try that
  if (!preferNew && b.stripeSessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(
        b.stripeSessionId,
        {
          expand: ["invoice"],
        }
      );
      if (session?.invoice) {
        const inv =
          typeof session.invoice === "string"
            ? await stripe.invoices.retrieve(session.invoice)
            : session.invoice;
        if (inv?.invoice_pdf) return inv; // may be stale if details changed
      }
    } catch (e) {
      console.warn(
        "[ensureStripeInvoice] no invoice on session:",
        e?.message || e
      );
    }
  }

  const currency = (b.currency || "EUR").toLowerCase();

  // 4) Use invoice custom_fields for display-only values (e.g., non-EU tax number)
  const customFields = [];
  if (!taxIdType && pc.taxNumber) {
    customFields.push({ name: "Tax Number", value: String(pc.taxNumber) });
  }
  if (pc.businessName && pc.businessName !== name) {
    customFields.push({ name: "Business", value: String(pc.businessName) });
  }

  // 5) Create invoice (NOTE: no customer_* overrides here — not supported by Stripe)
  const invoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: "send_invoice",
    days_until_due: 7,
    currency,
    custom_fields: customFields.length ? customFields : undefined,
    metadata: {
      bookingId: String(b.id),
      statusAtIssue: b.status || "paid",
    },
  });

  // 6) Add line item, finalize, mark paid out-of-band, return finalized invoice
  await stripe.invoiceItems.create({
    customer: customerId,
    invoice: invoice.id,
    amount: toMinor(currency, b.totalPaidAmount),
    currency,
    description: invoiceLineDescription(b),
    metadata: { bookingId: String(b.id) },
  });

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
  await stripe.invoices.pay(finalized.id, { paid_out_of_band: true });
  return await stripe.invoices.retrieve(finalized.id);
}

function mapStripeAddress(addr) {
  if (!addr) return null;
  return {
    line1: addr.line1 || undefined,
    line2: addr.line2 || undefined,
    city: addr.city || undefined,
    postal_code: addr.postalCode || undefined,
    country: (addr.country || "GR").toUpperCase(),
  };
}

// Try to add a real Tax ID when possible (e.g., EU VAT like "EL123456789")
async function syncCustomerTaxId(stripe, customerId, taxNumber) {
  if (!taxNumber) return null;
  const value = String(taxNumber).replace(/\s|-/g, "").toUpperCase();
  const isEUVAT = /^[A-Z]{2}\d{8,12}$/.test(value); // basic check
  if (!isEUVAT) return null;

  // Deduplicate
  const list = await stripe.customers.listTaxIds(customerId, { limit: 100 });
  const exists = list?.data?.some(
    (t) => t.type === "eu_vat" && t.value.toUpperCase() === value
  );
  if (!exists) {
    await stripe.customers.createTaxId(customerId, { type: "eu_vat", value });
  }
  return "eu_vat";
}

async function fetchPdfBuffer(url) {
  const res = await fetch(url, { cache: "no-store", redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Returns invoice PDF/receipt link if available to attach or include */
async function getStripeAssetForBooking(b, { preferNew = false } = {}) {
  const customerEmail = emailFromPrimary(b.primary_contact);
  if (!customerEmail) return null;

  const stripe = await getStripe();

  if (b.stripeSessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(
        b.stripeSessionId,
        {
          expand: ["invoice", "payment_intent.latest_charge"],
        }
      );

      if (session?.invoice) {
        const inv =
          typeof session.invoice === "string"
            ? await stripe.invoices.retrieve(session.invoice)
            : session.invoice;
        if (inv?.invoice_pdf) {
          return {
            type: "invoice",
            pdfUrl: inv.invoice_pdf,
            filename: inv.number ? `${inv.number}.pdf` : undefined,
            hostedUrl: inv.hosted_invoice_url,
          };
        }
      }

      if (session?.payment_intent) {
        const pi =
          typeof session.payment_intent === "string"
            ? await stripe.paymentIntents.retrieve(session.payment_intent, {
                expand: ["latest_charge"],
              })
            : session.payment_intent;

        let chargeObj = null;
        if (pi?.latest_charge) {
          chargeObj =
            typeof pi.latest_charge === "string"
              ? await stripe.charges.retrieve(pi.latest_charge)
              : pi.latest_charge;
        } else if (pi?.charges?.data?.length) {
          chargeObj = pi.charges.data[0];
        }
        if (chargeObj?.receipt_url)
          return { type: "receipt", url: chargeObj.receipt_url };
      }
    } catch (e) {
      console.warn(
        "[getStripeAssetForBooking] session lookup failed:",
        e?.message || e
      );
    }
  }

  if (b.stripePaymentIntentId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(b.stripePaymentIntentId, {
        expand: ["latest_charge"],
      });
      let chargeObj = null;
      if (pi?.latest_charge) {
        chargeObj =
          typeof pi.latest_charge === "string"
            ? await stripe.charges.retrieve(pi.latest_charge)
            : pi.latest_charge;
      } else if (pi?.charges?.data?.length) {
        chargeObj = pi.charges.data[0];
      }
      if (chargeObj?.receipt_url)
        return { type: "receipt", url: chargeObj.receipt_url };
    } catch (e) {
      console.warn(
        "[getStripeAssetForBooking] PI lookup failed:",
        e?.message || e
      );
    }
  }

  try {
    const okStatuses = new Set(["paid", "confirmed", "completed"]);
    if (!b.status || okStatuses.has(b.status)) {
      const inv = await ensureStripeInvoice(b, { preferNew });
      if (inv?.invoice_pdf) {
        return {
          type: "invoice",
          pdfUrl: inv.invoice_pdf,
          filename: inv.number ? `${inv.number}.pdf` : undefined,
          hostedUrl: inv.hosted_invoice_url,
        };
      }
    }
  } catch (e) {
    console.warn(
      "[getStripeAssetForBooking] ensureStripeInvoice failed:",
      e?.message || e
    );
  }
  return null;
}

function renderInvoiceEmail(b) {
  const inv = formatInv(b.id);
  const customer = nameFromPrimary(b.primary_contact);
  const email = emailFromPrimary(b.primary_contact);
  const amt = fmtMoney(b.totalPaidAmount, b.currency);
  const created = fmtDatePlain(b.createdAt);
  const start = fmtDateTimePlain(b.startTime);
  const guests = b.numberOfPeople || 1;

  return `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#1f2937;">
    <h2 style="margin:0 0 6px;">${brandName()} — Invoice ${inv}</h2>
    <div style="font-size:12px;color:#6b7280;margin-bottom:12px;">Created ${created}</div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <tbody>
        <tr>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;background:#fafaf9;width:180px;">Customer</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(
            customer
          )}<br/><span style="color:#6b7280;font-size:12px;">${escapeHtml(
    email
  )}</span></td>
        </tr>
        <tr>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;background:#fafaf9;">Start</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(
            start
          )}</td>
        </tr>
        <tr>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;background:#fafaf9;">Guests</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${guests}</td>
        </tr>
        <tr>
          <td style="padding:10px;background:#fafaf9;">Amount</td>
          <td style="padding:10px;"><strong>${escapeHtml(amt)}</strong></td>
        </tr>
      </tbody>
    </table>
    <p style="font-size:12px;color:#6b7280;margin-top:12px;">Status: ${escapeHtml(
      b.status || "paid"
    )} • Invoice #: ${inv}</p>
    <p style="font-size:12px;color:#6b7280;">Thank you for your business!</p>
  </div>`;
}

/* --------------------------------- route --------------------------------- */
// app/api/admin/invoices/send/route.js
export async function POST(req) {
  try {
    // Accept form-encoded or JSON
    const ctype = req.headers.get("content-type") || "";
    let id, mode, invoiceId, source;
    if (ctype.includes("application/json")) {
      const body = await req.json();
      id = body?.id != null ? Number(body.id) : undefined;
      mode = String(body?.mode || "custom").toLowerCase();
      invoiceId = body?.invoice_id ? String(body.invoice_id) : undefined;
      source = body?.source ? String(body.source) : undefined;
    } else {
      const fd = await req.formData();
      id = fd.has("id") ? Number(fd.get("id")) : undefined;
      mode = String(fd.get("mode") || "custom").toLowerCase();
      invoiceId = fd.get("invoice_id") ? String(fd.get("invoice_id")) : undefined;
      source = fd.get("source") ? String(fd.get("source")) : undefined;
    }

    // Helper that preserves ?source=... if provided
    const redirect = (qs) => {
      const url = new URL(`/admin/invoices${qs}`, req.url);
      if (source && !url.searchParams.has("source")) {
        url.searchParams.set("source", source);
      }
      return NextResponse.redirect(url);
    };

    // If neither a booking id nor a Stripe invoice id is provided -> error
    if (!Number.isFinite(id) && !invoiceId) return redirect("?err=bad_id");

    /* ------------------------------------------------------------------ */
    /*  A) Manual Stripe invoices: send via Stripe and return immediately */
    /* ------------------------------------------------------------------ */
    if (invoiceId) {
      try {
        const stripe = await getStripe();
        // Retrieve invoice and ensure we have an email to send to
        let inv = await stripe.invoices.retrieve(invoiceId, { expand: ["customer"] });
        const email = inv.customer_email || inv.customer?.email || "";
        if (!email) return redirect("?err=no_email");

        // Finalize drafts so they become sendable
        if (inv.status === "draft") {
          inv = await stripe.invoices.finalizeInvoice(inv.id);
        }
        // Only send invoices that are "send_invoice" and currently "open"
        if (inv.collection_method === "send_invoice" && inv.status === "open") {
          await stripe.invoices.sendInvoice(inv.id);
        }

        // Optional: if the Stripe invoice has a bookingId in metadata, update it
        const bookingId = Number(inv.metadata?.bookingId);
        if (Number.isFinite(bookingId)) {
          const adminOpt = createSupabaseAdmin();
          if (adminOpt) {
            await adminOpt
              .from("Booking")
              .update({ invoiceEmailSentAt: new Date().toISOString() })
              .eq("id", bookingId);
          }
        }

        revalidatePath("/admin/invoices");
        const sentToken = encodeURIComponent(inv.number || inv.id);
        return redirect(`?sent=${sentToken}`);
      } catch (e) {
        console.error("[invoices/send] stripe manual send error", e);
        return redirect("?err=send_fail");
      }
    }

    /* -------------------------------------------------------------- */
    /*  B) Booking-based flow (your existing logic, unchanged mostly) */
    /* -------------------------------------------------------------- */
    const admin = createSupabaseAdmin();
    if (!admin) return redirect("?err=no_admin");

    const { data: b, error } = await admin
      .from("Booking")
      .select(
        "id, createdAt, startTime, status, numberOfPeople, totalPaidAmount, currency, primary_contact, duration, stripePaymentIntentId, stripeSessionId, invoiceEmailSentAt"
      )
      .eq("id", id)
      .single();

    if (error || !b) return redirect(`?err=not_found&id=${id}`);

    // Detect if billing fields (business/tax/address/phone) exist → prefer a fresh invoice PDF
    const pc = b.primary_contact || {};
    const hasBillingEdits =
      Boolean(pc.businessName) ||
      Boolean(pc.taxNumber) ||
      Boolean(pc.phone) ||
      Boolean(
        pc.address?.line1 ||
          pc.address?.city ||
          pc.address?.postalCode ||
          pc.address?.country
      );

    // Mode: ask Stripe to send their invoice email (uses fresh invoice when needed)
    if (mode === "stripe") {
      const inv = await ensureStripeInvoice(b, { preferNew: hasBillingEdits });
      const stripe = await getStripe();
      await stripe.invoices.sendInvoice(inv.id);

      await admin
        .from("Booking")
        .update({ invoiceEmailSentAt: new Date().toISOString() })
        .eq("id", id);

      revalidatePath("/admin/invoices");
      return redirect(`?sent=${id}`);
    }

    // Default: send our custom email (attach invoice PDF or link a receipt)
    const to = emailFromPrimary(b.primary_contact);
    if (!to) return redirect(`?err=no_email&id=${id}`);

    let html = renderInvoiceEmail(b);
    const subject = `Invoice ${formatInv(b.id)} · ${brandName()}`;
    const attachments = [];

    try {
      // Try to fetch an existing asset first (may be an invoice PDF or a receipt URL)
      let asset = await getStripeAssetForBooking(b, { preferNew: hasBillingEdits });

      // If we need updated billing fields but only got a receipt (or nothing), mint a fresh invoice now
      if (!asset || (hasBillingEdits && asset.type !== "invoice")) {
        try {
          const inv = await ensureStripeInvoice(b, { preferNew: true });
          if (inv?.invoice_pdf) {
            asset = {
              type: "invoice",
              pdfUrl: inv.invoice_pdf,
              filename: inv.number ? `${inv.number}.pdf` : undefined,
              hostedUrl: inv.hosted_invoice_url,
            };
          }
        } catch (e) {
          console.warn("[invoices/send] fallback ensureStripeInvoice failed:", e?.message || e);
        }
      }

      if (asset?.type === "invoice" && asset.pdfUrl) {
        const pdfBuffer = await fetchPdfBuffer(asset.pdfUrl);
        const base64 = pdfBuffer.toString("base64");
        if (!base64.length) throw new Error("Empty PDF buffer");
        attachments.push({
          filename: asset.filename || `Invoice-${formatInv(b.id)}.pdf`,
          content: base64,
        });
        if (asset.hostedUrl) {
          html += `
            <p style="font-size:12px;color:#6b7280;margin-top:12px;">
              View on Stripe: <a href="${asset.hostedUrl}">${asset.hostedUrl}</a>
            </p>`;
        }
      } else if (asset?.type === "receipt" && asset.url) {
        html += `
          <p style="font-size:12px;color:#6b7280;margin-top:12px;">
            Stripe receipt: <a href="${asset.url}">${asset.url}</a>
          </p>`;
      }
    } catch (e) {
      console.warn("[invoices/send] asset fetch skipped:", e?.message || e);
    }

    try {
      if (process.env.NODE_ENV !== "production") {
        console.log("[sendMail] attachments:", attachments.map((a) => a.filename));
      }
      await sendMail({ to, subject, html, attachments });

      await admin
        .from("Booking")
        .update({ invoiceEmailSentAt: new Date().toISOString() })
        .eq("id", id);
    } catch (e) {
      console.error("sendMail failed", e);
      return redirect(`?err=send_fail&id=${id}`);
    }

    revalidatePath("/admin/invoices");
    return redirect(`?sent=${id}`);
  } catch (e) {
    console.error("[api/admin/invoices/send] POST error", e);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
