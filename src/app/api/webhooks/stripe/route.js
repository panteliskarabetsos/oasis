// src/app/api/webhooks/stripe/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

// --- email/stripe helpers ---------------------------------------------------
function brandName() {
  return process.env.NEXT_PUBLIC_SITE_NAME || "Oasis";
}

function formatInv(id) {
  return `INV-${String(id).padStart(6, "0")}`;
}

async function fetchPdfBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PDF fetch failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function sendMail({ to, subject, html, attachments }) {
  const apiKey = process.env.RESEND_API_KEY;
  let from = process.env.EMAIL_FROM;
  if (!from) from = "Oasis Bookings <onboarding@resend.dev>"; // dev fallback
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const res = await resend.emails.send({
    from,
    to,
    subject,
    html,
    attachments: attachments?.length ? attachments : undefined,
  });
  if (res?.error) throw new Error(res.error.message || "Mail provider error");
}

function renderConfirmationEmail(booking, { receiptUrl }) {
  const inv = formatInv(booking.id);
  const amt = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: (booking.currency || "EUR").toUpperCase(),
  }).format(Number(booking.totalPaidAmount || 0));
  const email = booking.primary_contact?.email || "";
  const name =
    booking.primary_contact?.fullName || booking.primary_contact?.name || email;
  return `
  <div style="font-family: ui-sans-serif, system-ui; color:#1f2937;">
    <h2 style="margin:0 0 6px;">${brandName()} — Booking confirmed</h2>
   <p style="margin: 8px 0 16px;">Thanks for your payment, ${name}.</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <tbody>
       <tr>
         <td style="padding:10px;border-bottom:1px solid #e5e7eb;background:#fafaf9;width:180px;">Invoice #</td>
         <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${inv}</td>
       </tr>
       <tr>
         <td style="padding:10px;border-bottom:1px solid #e5e7eb;background:#fafaf9;">Amount</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;"><strong>${amt}</strong></td>
        </tr>
      </tbody>
    </table>
    ${
      receiptUrl
        ? `<div style="margin-top:16px;">
             <a href="${receiptUrl}"
               style="display:inline-block;background:#1f2937;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">
               View Stripe Receipt
             </a>
            <div style="font-size:12px;color:#6b7280;margin-top:8px;">
               Opens Stripe’s official receipt page.
             </div>
           </div>`
        : ""
    }
    <p style="font-size:12px;color:#6b7280;margin-top:14px;">
      We’ve attached your invoice PDF.
   </p>
  </div>`;
}

async function receiptUrlFromPI(stripe, piOrId) {
  const pi =
    typeof piOrId === "string"
      ? await stripe.paymentIntents.retrieve(piOrId, {
          expand: ["latest_charge"],
        })
      : piOrId;
  if (!pi) return null;
  if (pi.latest_charge) {
    const ch =
      typeof pi.latest_charge === "string"
        ? await stripe.charges.retrieve(pi.latest_charge)
        : pi.latest_charge;
    if (ch?.receipt_url) return ch.receipt_url;
  }
  const first = pi?.charges?.data?.[0];
  return first?.receipt_url || null;
}

// Send confirmation email with invoice PDF (if any) + hosted receipt link
async function sendConfirmationEmail({
  stripe,
  admin,
  bookingId,
  sessionId,
  piId,
  invoiceId,
}) {
  // 1) Load booking (email + amounts)
  const { data: b } = await admin
    .from("Booking")
    .select("id, primary_contact, totalPaidAmount, currency")
    .eq("id", bookingId)
    .single();
  if (!b?.primary_contact?.email) return;
  const to = b.primary_contact.email;

  // 2) Resolve sources
  let session = null,
    invoice = null,
    pi = null;
  let receiptUrl = null,
    invoicePdfUrl = null;

  if (sessionId) {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["invoice", "payment_intent.latest_charge"],
    });
    if (session?.invoice) {
      invoice =
        typeof session.invoice === "string"
          ? await stripe.invoices.retrieve(session.invoice)
          : session.invoice;
      invoicePdfUrl = invoice?.invoice_pdf || null;
    }
    if (session?.payment_intent) {
      pi = session.payment_intent;
    }
  }

  if (!invoice && invoiceId) {
    invoice = await stripe.invoices.retrieve(invoiceId);
    invoicePdfUrl = invoice?.invoice_pdf || invoicePdfUrl;
  }

  if (!pi && piId) {
    pi = await stripe.paymentIntents.retrieve(piId, {
      expand: ["latest_charge"],
    });
  }

  // 3) Hosted receipt URL (from charge)
  receiptUrl = await receiptUrlFromPI(stripe, pi || piId);
  // 4) Attach invoice PDF if available
  const attachments = [];

  if (invoicePdfUrl) {
    const pdfBuffer = await fetchPdfBuffer(invoicePdfUrl);
    attachments.push({
      filename: invoice?.number
        ? `${invoice.number}.pdf`
        : `${formatInv(b.id)}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    });
  }

  const html = renderConfirmationEmail(b, { receiptUrl });
  await sendMail({
    to,
    subject: `Booking confirmed · ${brandName()}`,
    html,
    attachments,
  });

  // 5) Mark sent (best-effort)
  try {
    await admin
      .from("Booking")
      .update({ confirmationEmailSentAt: new Date().toISOString() })
      .eq("id", b.id);
  } catch {}
}
// --- helpers ---------------------------------------------------------------
const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

function toInt(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

async function ensureConvertedFromDraft({
  admin,
  draftId,
  stripeSessionId,
  stripePaymentIntentId,
  finalTotalCents,
  currency,
}) {
  // 1) Load draft
  const { data: draft, error: dErr } = await admin
    .from("BookingDraft")
    .select(
      `
      id, status, counts, attendees, primary_contact,
      "unitPriceAdult", "unitPriceKid",
      "scheduleSlotId", "experienceId",
      "stripeSessionId", "stripePaymentIntentId",
      "convertedBookingId",
      "appliedPromoCode", "discountAmount",
      currency
    `,
    )
    .eq("id", draftId)
    .maybeSingle();

  if (dErr || !draft) throw new Error("Draft not found");

  // Already converted? return it
  if (draft.convertedBookingId) return { bookingId: draft.convertedBookingId };

  // 2) Compute numbers
  const A = toInt(draft?.counts?.adults);
  const K = toInt(draft?.counts?.kids);
  const numPeople = A + K;

  // 3) Derive start time from slot (optional but nice)
  const { data: slot } = await admin
    .from("ScheduleSlot")
    .select("date")
    .eq("id", draft.scheduleSlotId)
    .maybeSingle();

  const unitKid = draft.unitPriceKid ?? draft.unitPriceAdult;
  const totalPaid = (finalTotalCents ?? 0) / 100;

  // 4) Idempotency: if a Booking already exists with these Stripe ids, use it
  const byPI = stripePaymentIntentId
    ? await admin
        .from("Booking")
        .select("id")
        .eq("stripePaymentIntentId", stripePaymentIntentId)
        .maybeSingle()
    : { data: null };

  const byCS = stripeSessionId
    ? await admin
        .from("Booking")
        .select("id")
        .eq("stripeSessionId", stripeSessionId)
        .maybeSingle()
    : { data: null };

  let bookingId = byPI?.data?.id || byCS?.data?.id || null;

  // 5) Insert booking if not present
  if (!bookingId) {
    const ins = await admin
      .from("Booking")
      .insert({
        scheduleSlotId: draft.scheduleSlotId,
        experienceId: draft.experienceId,
        status: "confirmed",
        numberOfPeople: numPeople,
        counts: draft.counts,
        adultsCount: A || null,
        kidsCount: K || null,
        unitPriceAdult: draft.unitPriceAdult,
        unitPriceKid: unitKid,
        totalPaidAmount: totalPaid,
        currency: (currency || draft.currency || "eur").toLowerCase(),
        primary_contact: draft.primary_contact,
        attendees: draft.attendees,
        stripeSessionId: stripeSessionId || draft.stripeSessionId || null,
        stripePaymentIntentId:
          stripePaymentIntentId || draft.stripePaymentIntentId || null,
        startTime: slot?.date || null,
      })
      .select("id")
      .single();

    if (ins.error) {
      // If unique constraints later added on stripe ids, a race can happen:
      // try to fetch again.
      const raceFetch = await admin
        .from("Booking")
        .select("id")
        .eq("stripePaymentIntentId", stripePaymentIntentId || "")
        .maybeSingle();
      bookingId = raceFetch?.data?.id;
      if (!bookingId) throw ins.error;
    } else {
      bookingId = ins.data.id;
    }
  }

  // 6) Flip draft → converted
  const upd = await admin
    .from("BookingDraft")
    .update({
      status: "converted",
      convertedBookingId: bookingId,
      stripeSessionId: stripeSessionId || draft.stripeSessionId || null,
      stripePaymentIntentId:
        stripePaymentIntentId || draft.stripePaymentIntentId || null,
      totalAmount:
        finalTotalCents != null ? finalTotalCents / 100 : draft.totalAmount,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", draftId);

  if (upd.error) throw upd.error;

  // 7) Optional: finalize promo redemption (best-effort)
  try {
    if (stripeSessionId) {
      await admin
        .from("PromotionRedemption")
        .update({
          status: "succeeded",
          updatedAt: new Date().toISOString(),
        })
        .eq("stripeSessionId", stripeSessionId);
    }
  } catch {}

  return { bookingId };
}

// --- webhook handler -------------------------------------------------------
// src/app/api/webhooks/stripe/route.js

export async function POST(req) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return bad("Missing Stripe signature header", 400);

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY || "";
  const stripe = new Stripe(key, { apiVersion: "2024-06-20" });
  const raw = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    return bad(`Invalid signature: ${e.message}`, 400);
  }

  const admin = createSupabaseAdmin();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;

        // 1. CHECK IF THIS IS AN ADMIN-GENERATED LINK (Existing Booking)
        const existingBookingId = s.metadata?.bookingId;
        const isAdminGenerated = s.metadata?.admin_generated === "true";

        if (existingBookingId && isAdminGenerated) {
          console.log(
            `🔔 Webhook: Updating Existing Booking ${existingBookingId}`,
          );

          const amountPaid = s.amount_total / 100;
          const piId =
            typeof s.payment_intent === "string"
              ? s.payment_intent
              : s.payment_intent?.id;

          const { error: updateErr } = await admin
            .from("booking") // FIXED: Use lowercase 'booking' per your schema
            .update({
              status: "confirmed",
              totalPaidAmount: amountPaid,
              stripePaymentIntentId: piId, // LINKING PI TO BOOKING
              stripeSessionUrl: null, // Clear the link from UI
              updatedAt: new Date().toISOString(),
            })
            .eq("id", existingBookingId);

          if (updateErr) throw updateErr;

          // Send confirmation email
          await sendConfirmationEmail({
            stripe,
            admin,
            bookingId: existingBookingId,
            sessionId: s.id,
            piId: piId,
          });

          return ok({ received: true, action: "updated_existing" });
        }

        // 2. FALLBACK TO STANDARD DRAFT CONVERSION (Web Checkout)
        const draftId = Number(s.client_reference_id || s.metadata?.draft_id);
        if (!Number.isFinite(draftId) || draftId <= 0)
          return ok({ skipped: true });

        const { bookingId } = await ensureConvertedFromDraft({
          admin,
          draftId,
          stripeSessionId: s.id,
          stripePaymentIntentId:
            typeof s.payment_intent === "string"
              ? s.payment_intent
              : s.payment_intent?.id,
          finalTotalCents: s.amount_total,
          currency: s.currency,
        });

        await sendConfirmationEmail({
          stripe,
          admin,
          bookingId,
          sessionId: s.id,
        });
        return ok({ received: true, bookingId, action: "converted_draft" });
      }

      case "payment_intent.succeeded": {
        const pi = event.data.object;

        // Logic for Payment Intent (Direct charges / Virtual Terminal)
        const existingBookingId = pi.metadata?.bookingId;
        if (existingBookingId) {
          const amountPaid = pi.amount_received / 100;

          const { error: updateErr } = await admin
            .from("booking") // FIXED: Lowercase 'booking'
            .update({
              status: "confirmed",
              totalPaidAmount: amountPaid,
              stripePaymentIntentId: pi.id,
              updatedAt: new Date().toISOString(),
            })
            .eq("id", existingBookingId);

          if (updateErr) throw updateErr;

          await sendConfirmationEmail({
            stripe,
            admin,
            bookingId: existingBookingId,
            piId: pi.id,
          });
          return ok({ received: true, action: "updated_existing_pi" });
        }

        // Standard draft flow for PIs
        const draftId = Number(pi.metadata?.draftId || pi.metadata?.draft_id);
        if (Number.isFinite(draftId) && draftId > 0) {
          const { bookingId } = await ensureConvertedFromDraft({
            admin,
            draftId,
            stripePaymentIntentId: pi.id,
            finalTotalCents: pi.amount_received,
            currency: pi.currency,
          });
          await sendConfirmationEmail({
            stripe,
            admin,
            bookingId,
            piId: pi.id,
          });
          return ok({ received: true, action: "converted_draft_pi" });
        }

        return ok({ received: true });
      }

      default:
        return ok({ received: true });
    }
  } catch (e) {
    console.error("[stripe webhook] error:", e.message);
    return bad("Webhook handler error", 500);
  }
}
