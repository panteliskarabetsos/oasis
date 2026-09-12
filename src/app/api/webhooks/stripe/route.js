// src/app/api/webhooks/stripe/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { markOrderPaid } from "@/lib/shop/server";
import {
  confirmPaidBooking,
  sendConfirmationEmail,
} from "@/lib/email/bookingConfirmation";
import { settleLinkPayment } from "@/lib/pos/settleLink";

// --- email/stripe helpers ---------------------------------------------------
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
        .from("booking")
        .select("id")
        .eq("stripePaymentIntentId", stripePaymentIntentId)
        .maybeSingle()
    : { data: null };

  const byCS = stripeSessionId
    ? await admin
        .from("booking")
        .select("id")
        .eq("stripeSessionId", stripeSessionId)
        .maybeSingle()
    : { data: null };

  let bookingId = byPI?.data?.id || byCS?.data?.id || null;

  // 5) Insert booking if not present
  if (!bookingId) {
    const ins = await admin
      .from("booking")
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
        .from("booking")
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

        // A till QR payment. The app polls for this too and usually wins the
        // race; this is the safety net for when it cannot — the app was killed,
        // the wifi dropped, the cashier walked away. Someone who has paid must
        // end up with a receipt either way.
        if (s.metadata?.rail === "qr_link") {
          const piId =
            typeof s.payment_intent === "string"
              ? s.payment_intent
              : s.payment_intent?.id;

          if (s.payment_status !== "paid" || !piId) {
            return ok({ received: true, action: "pos_qr_ignored" });
          }

          const settled = await settleLinkPayment(admin, s.id, piId);
          return ok({
            received: true,
            action: "pos_qr_link",
            settled: settled.settled,
            reason: settled.reason,
            receiptId: settled.receiptId ?? null,
          });
        }

        // E-shop order paid through Stripe Checkout.
        const shopOrderIdFromSession = Number(s.metadata?.shop_order_id);
        if (Number.isFinite(shopOrderIdFromSession) && shopOrderIdFromSession > 0) {
          const result = await markOrderPaid(admin, shopOrderIdFromSession, {
            sessionId: s.id,
            paymentIntentId:
              typeof s.payment_intent === "string"
                ? s.payment_intent
                : s.payment_intent?.id,
          });
          return ok({
            received: true,
            action: "shop_order_paid",
            orderId: shopOrderIdFromSession,
            already: Boolean(result.already),
          });
        }

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

          // Confirm and notify through the shared path. The guest's own
          // return to the success page does the same thing, and whichever
          // arrives first is the one that sends.
          const confirmed = await confirmPaidBooking(admin, existingBookingId, {
            stripe,
            sessionId: s.id,
            piId,
            amountPaid,
          });

          return ok({
            received: true,
            action: "updated_existing",
            emailed: confirmed.sent,
            reason: confirmed.reason,
          });
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

        // E-shop order paid through the in-app PaymentSheet.
        const shopOrderId = Number(pi.metadata?.shop_order_id);
        if (Number.isFinite(shopOrderId) && shopOrderId > 0) {
          const result = await markOrderPaid(admin, shopOrderId, {
            paymentIntentId: pi.id,
          });
          return ok({
            received: true,
            action: "shop_order_paid",
            orderId: shopOrderId,
            already: Boolean(result.already),
          });
        }

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
