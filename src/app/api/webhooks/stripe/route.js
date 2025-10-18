// src/app/api/webhooks/stripe/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

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
    `
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
export async function POST(req) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return bad("Missing Stripe signature header", 400);

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return bad("Webhook secret not configured", 500);

  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key) return bad("Stripe not configured", 500);

  const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

  // IMPORTANT: use raw body for signature verification
  const raw = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    return bad(`Invalid signature: ${e.message}`, 400);
  }

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object; // Stripe.Checkout.Session
        const draftId = Number(s.client_reference_id || s.metadata?.draft_id);
        if (!Number.isFinite(draftId) || draftId <= 0)
          return ok({ skipped: true });

        const stripeSessionId = s.id;
        const piId =
          typeof s.payment_intent === "string"
            ? s.payment_intent
            : s.payment_intent?.id || null;

        const finalTotalCents =
          toInt(s.metadata?.final_total_cents) || toInt(s.amount_total);
        const currency = (
          s.currency ||
          s.metadata?.promo_currency ||
          "eur"
        ).toLowerCase();

        const { bookingId } = await ensureConvertedFromDraft({
          admin,
          draftId,
          stripeSessionId,
          stripePaymentIntentId: piId,
          finalTotalCents,
          currency,
        });

        return ok({ received: true, bookingId });
      }

      case "payment_intent.succeeded": {
        const pi = event.data.object; // Stripe.PaymentIntent
        const draftId = Number(pi.metadata?.draftId || pi.metadata?.draft_id);
        if (!Number.isFinite(draftId) || draftId <= 0)
          return ok({ skipped: true });

        const stripePaymentIntentId = pi.id;
        const finalTotalCents =
          toInt(pi.metadata?.final_total_cents) || toInt(pi.amount_received);
        const currency = (pi.currency || "eur").toLowerCase();

        const { bookingId } = await ensureConvertedFromDraft({
          admin,
          draftId,
          stripeSessionId: null,
          stripePaymentIntentId,
          finalTotalCents,
          currency,
        });

        return ok({ received: true, bookingId });
      }

      // Optional: mark failures / log
      case "payment_intent.payment_failed": {
        // could mark draft as "failed" or log error if you want
        return ok({ received: true });
      }

      default:
        // Unhandled event types are OK
        return ok({ received: true });
    }
  } catch (e) {
    console.error("[stripe webhook] handler error:", e?.message || e);
    return bad("Webhook handler error", 500);
  }
}
