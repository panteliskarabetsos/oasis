// src/app/api/admin/reservations/[id]/cancel/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

// Which booking statuses count toward capacity elsewhere in your app
const COUNT_STATUSES = new Set(["confirmed", "completed", "checked_in"]);

export async function POST(req, ctx) {
  const { id } = await ctx.params;
  const bookingId = Number(id);
  if (!Number.isFinite(bookingId) || bookingId <= 0) return bad("Invalid id");

  // Optional body: { reason?: string, refund?: boolean, amountCents?: number }
  const body = await req.json().catch(() => ({}));
  const reason = (body?.reason || "").toString().slice(0, 500) || null;
  const requestRefund = Boolean(body?.refund); // default false
  const amountCentsOverride = Number(body?.amountCents);
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  // 1) Load booking (use * to avoid missing column errors across environments)
  const { data: booking, error: bErr } = await admin
    .from("Booking")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (bErr || !booking) return bad("Booking not found", 404);

  const currentStatus = String(booking.status || "").toLowerCase();

  // Idempotent fast-path
  if (currentStatus === "cancelled" || currentStatus === "canceled") {
    return ok({
      id: bookingId,
      status: "cancelled",
      already: true,
    });
  }

  // If your policy forbids cancelling checked-in/completed, enforce it here.
  // (Otherwise we allow cancel to free capacity since you derive availability.)
  // Example guard (comment out if not needed):
  // if (currentStatus === "checked_in") {
  //   return bad("Cannot cancel a checked-in booking.", 400);
  // }

  // 2) Optionally refund via Stripe (best effort)
  let refunded = false;
  let refundId = null;
  let refundAmountCents = null;
  if (requestRefund) {
    const pi =
      booking.stripePaymentIntentId || booking.stripe_payment_intent_id; // try camel/snake
    const key = process.env.STRIPE_SECRET_KEY || "";

    if (!pi) {
      // No payment intent, so we can't auto-refund
      // Still continue with cancellation (no refund)
      console.warn(
        "[admin/cancel] refund requested but no payment intent on booking",
        {
          bookingId,
        }
      );
    } else if (!key) {
      console.warn("[admin/cancel] refund requested but Stripe not configured");
    } else {
      try {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

        // Determine refund amount (default: full)
        if (Number.isFinite(amountCentsOverride) && amountCentsOverride > 0) {
          refundAmountCents = Math.floor(amountCentsOverride);
        } else {
          // Try to use totalPaidAmount if present; else full-refund without explicit amount
          const paid = Number(
            booking.totalPaidAmount ?? booking.total_paid_amount
          );
          if (Number.isFinite(paid) && paid > 0) {
            refundAmountCents = Math.round(paid * 100);
          }
        }

        const refundPayload = refundAmountCents
          ? { payment_intent: pi, amount: refundAmountCents }
          : { payment_intent: pi };

        const refund = await stripe.refunds.create(refundPayload);
        refunded =
          refund?.status === "succeeded" || refund?.status === "pending";
        refundId = refund?.id || null;
      } catch (e) {
        console.error("[admin/cancel] stripe refund error:", e?.message);
        // We still allow cancellation even if refund failed (admin may retry).
      }
    }
  }

  // 3) Update booking → status: cancelled (+ optional reason / refund fields)
  const nowIso = new Date().toISOString();
  const patch = {
    status: "cancelled",
    updatedAt: nowIso,
  };

  // Best-effort extended fields (tolerate missing cols)
  if (reason) patch.cancelReason = reason;
  if (refundId) patch.stripeRefundId = refundId;
  if (refunded) patch.refundedAt = nowIso;

  let upd = await admin.from("Booking").update(patch).eq("id", bookingId);
  if (upd.error && String(upd.error.code) === "42703") {
    // Fallback: minimal update for older schemas
    await admin
      .from("Booking")
      .update({ status: "cancelled", updatedAt: nowIso })
      .eq("id", bookingId);
  } else if (upd.error) {
    console.error("[admin/cancel] update error", upd.error);
    return bad("Failed to cancel booking", 500);
  }

  // 4) No slot decrement needed: availability is derived from Booking rows
  //     (Only statuses in COUNT_STATUSES are counted; 'cancelled' isn't.)

  return ok({
    id: bookingId,
    status: "cancelled",
    refunded,
    refundId,
    refundAmountCents: refundAmountCents ?? null,
    reason: reason ?? null,
  });
}
