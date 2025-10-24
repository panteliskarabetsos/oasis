// src/app/admin/invoices/[id]/download/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import Stripe from "stripe";

/**
 * GET /admin/invoices/:id/download
 * Returns a PDF (invoice) if possible, otherwise redirects to a Stripe receipt.
 */
export async function GET(_req, { params }) {
  const p = await params; // in Next 15, params can be a Promise
  const id = Number(p?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return new NextResponse("Bad id", { status: 400 });
  }

  // --- load booking (minimal fields you used on the page) ---
  const { createSupabaseAdmin } = await import("@/lib/supabase/admin");
  const admin = createSupabaseAdmin();
  const { data: b, error } = await admin
    .from("Booking")
    .select(
      "id, status, numberOfPeople, totalPaidAmount, currency, primary_contact, startTime, stripeSessionId, stripePaymentIntentId"
    )
    .eq("id", id)
    .single();

  if (error || !b) return new NextResponse("Not found", { status: 404 });

  try {
    const asset = await getStripeAssetForBooking(b);
    // Prefer an actual invoice PDF
    if (asset?.type === "invoice" && asset.pdfUrl) {
      const res = await fetch(asset.pdfUrl);
      if (!res.ok)
        return new NextResponse("Failed to fetch PDF", { status: 502 });
      const buf = await res.arrayBuffer();
      const filename = asset.filename || `${formatInv(b.id)}.pdf`;
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="${filename}"`,
          "cache-control": "private, no-store",
        },
      });
    }
    // Otherwise, at least give them a receipt link
    if (asset?.type === "receipt" && asset.url) {
      return NextResponse.redirect(asset.url);
    }
    return new NextResponse("No downloadable asset (missing email/PI?)", {
      status: 404,
    });
  } catch (e) {
    console.error("[download] error:", e?.message || e);
    return new NextResponse("Server error", { status: 500 });
  }
}

/* ---------------- helpers ---------------- */

function formatInv(id) {
  return `INV-${String(id).padStart(6, "0")}`;
}

async function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2024-06-20" });
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

function nameFromPrimary(pc) {
  if (!pc || typeof pc !== "object") return null;
  return (
    pc.fullName ||
    pc.full_name ||
    [pc.firstName, pc.lastName].filter(Boolean).join(" ") ||
    [pc.first_name, pc.last_name].filter(Boolean).join(" ") ||
    pc.name ||
    null
  );
}
function emailFromPrimary(pc) {
  if (!pc || typeof pc !== "object") return null;
  return pc.email || pc.contactEmail || pc.customer_email || null;
}

function invoiceLineDescription(b) {
  const when = new Date(b.startTime);
  const whenLabel = when.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const guests = b.numberOfPeople || 1;
  return `Oasis booking ${formatInv(b.id)} — ${guests} guest(s) — ${whenLabel}`;
}

/**
 * Returns:
 *  - { type: 'invoice', pdfUrl, filename?, hostedUrl? }
 *  - { type: 'receipt', url }
 */
async function getStripeAssetForBooking(b) {
  const stripe = await getStripe();

  // 1) Existing invoice via Checkout session?
  if (b.stripeSessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(
        b.stripeSessionId,
        {
          expand: ["invoice", "payment_intent"],
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
      // Fallback to receipt from PI if present
      if (session?.payment_intent) {
        const pi =
          typeof session.payment_intent === "string"
            ? await stripe.paymentIntents.retrieve(session.payment_intent, {
                expand: ["latest_charge"],
              })
            : session.payment_intent;
        const chargeId = pi?.latest_charge || pi?.charges?.data?.[0]?.id;
        if (chargeId) {
          const ch = await stripe.charges.retrieve(chargeId);
          if (ch?.receipt_url) return { type: "receipt", url: ch.receipt_url };
        }
      }
    } catch {}
  }

  // 2) PI-only path → receipt
  if (b.stripePaymentIntentId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(b.stripePaymentIntentId, {
        expand: ["latest_charge"],
      });
      const chargeId = pi?.latest_charge || pi?.charges?.data?.[0]?.id;
      if (chargeId) {
        const ch = await stripe.charges.retrieve(chargeId);
        if (ch?.receipt_url) return { type: "receipt", url: ch.receipt_url };
      }
    } catch {}
  }

  // 3) Last resort: create/finalize a Stripe Invoice (no re-charge), then use its PDF
  const email = emailFromPrimary(b.primary_contact);
  if (!email) return null; // can’t create a Customer in Stripe without email
  const name = nameFromPrimary(b.primary_contact);
  const currency = (b.currency || "EUR").toLowerCase();

  const customer = await ensureCustomer(stripe, { email, name });
  const invoice = await stripe.invoices.create({
    customer,
    collection_method: "send_invoice",
    days_until_due: 7,
    currency,
    metadata: { bookingId: String(b.id), statusAtIssue: b.status || "paid" },
  });
  await stripe.invoiceItems.create({
    customer,
    invoice: invoice.id,
    amount: toMinor(currency, b.totalPaidAmount),
    currency,
    description: invoiceLineDescription(b),
    metadata: { bookingId: String(b.id) },
  });
  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
  await stripe.invoices.pay(finalized.id, { paid_out_of_band: true });
  const inv = await stripe.invoices.retrieve(finalized.id);
  if (inv?.invoice_pdf) {
    return {
      type: "invoice",
      pdfUrl: inv.invoice_pdf,
      filename: inv.number ? `${inv.number}.pdf` : undefined,
      hostedUrl: inv.hosted_invoice_url,
    };
  }
  return null;
}

async function ensureCustomer(stripe, { email, name }) {
  const list = await stripe.customers.list({ email, limit: 1 });
  if (list?.data?.length) return list.data[0].id;
  const c = await stripe.customers.create({ email, name });
  return c.id;
}
