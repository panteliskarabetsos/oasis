export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

const COUNT_STATUSES = new Set(["confirmed", "completed", "checked_in"]);

const isInt = (n) =>
  Number.isFinite(Number(n)) && Number(n) === Math.trunc(Number(n));

async function countConfirmedBookings(admin, slotId) {
  const { count, error } = await admin
    .from("Booking")
    .select("id", { head: true, count: "exact" })
    .eq("scheduleSlotId", slotId)
    .in("status", Array.from(COUNT_STATUSES));
  if (error) throw error;
  return count ?? 0;
}

async function recomputeBookedSlots(admin, slotId, nowISO) {
  const count = await countConfirmedBookings(admin, slotId);
  await admin
    .from("ScheduleSlot")
    .update({ bookedSlots: count, updatedAt: nowISO })
    .eq("id", slotId);
  return count;
}

export async function PATCH(req, ctx) {
  return POST(req, ctx);
}

export async function POST(req, ctx) {
  const { id } = await ctx.params; // App Router: params is async
  const rawId = Array.isArray(id) ? id[0] : id;
  if (!isInt(rawId)) return bad("Invalid id");
  const entityId = Number(rawId);

  // Optional body: { reason?: string, refund?: boolean, amountCents?: number }
  const body = await req.json().catch(() => ({}));
  const reason = (body?.reason || "").toString().slice(0, 500) || null;
  const requestRefund = Boolean(body?.refund);
  const amountCentsOverride = Number(body?.amountCents);

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  // ---- Try BOOKING first
  const { data: booking, error: bErr } = await admin
    .from("Booking")
    .select("*")
    .eq("id", entityId)
    .maybeSingle();

  const nowIso = new Date().toISOString();

  if (bErr) return bad("Server error loading booking", 500);
  if (booking) {
    const currentStatus = String(booking.status || "").toLowerCase();
    if (currentStatus === "cancelled" || currentStatus === "canceled") {
      return ok({ id: entityId, status: "cancelled", already: true });
    }

    // Optional refund
    let refunded = false;
    let refundId = null;
    let refundAmountCents = null;

    if (requestRefund) {
      const pi =
        booking.stripePaymentIntentId || booking.stripe_payment_intent_id;
      const key = process.env.STRIPE_SECRET_KEY || "";
      if (!pi) {
        console.warn("[admin/cancel] refund requested but no payment intent", {
          entityId,
        });
      } else if (!key) {
        console.warn(
          "[admin/cancel] refund requested but Stripe not configured"
        );
      } else {
        try {
          const Stripe = (await import("stripe")).default;
          const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

          if (Number.isFinite(amountCentsOverride) && amountCentsOverride > 0) {
            refundAmountCents = Math.floor(amountCentsOverride);
          } else {
            const paid = Number(
              booking.totalPaidAmount ?? booking.total_paid_amount
            );
            if (Number.isFinite(paid) && paid > 0)
              refundAmountCents = Math.round(paid * 100);
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
        }
      }
    }

    // Update booking -> cancelled
    const patch = { status: "cancelled", updatedAt: nowIso };
    if (reason) patch.cancelReason = reason;
    if (refundId) patch.stripeRefundId = refundId;
    if (requestRefund && (refundId || reason)) patch.refundedAt = nowIso;

    let upd = await admin.from("Booking").update(patch).eq("id", entityId);
    if (upd.error && String(upd.error.code) === "42703") {
      const fb = await admin
        .from("Booking")
        .update({ status: "cancelled", updatedAt: nowIso })
        .eq("id", entityId);
      if (fb.error) return bad("Failed to cancel booking", 500);
    } else if (upd.error) {
      return bad("Failed to cancel booking", 500);
    }

    // Keep ScheduleSlot counters in sync
    if (isInt(booking.scheduleSlotId)) {
      try {
        await recomputeBookedSlots(admin, booking.scheduleSlotId, nowIso);
      } catch {}
    }

    return ok({
      id: entityId,
      source: "booking",
      status: "cancelled",
      refunded: !!requestRefund && !!refundId,
      refundId,
      refundAmountCents: refundAmountCents ?? null,
      reason: reason ?? null,
    });
  }

  // ---- Otherwise try BOOKING DRAFT (no refund, no counters)
  const { data: draft, error: dErr } = await admin
    .from("BookingDraft")
    .select("*")
    .eq("id", entityId)
    .maybeSingle();

  if (dErr) return bad("Server error loading draft", 500);
  if (!draft) return bad("Reservation not found", 404);

  // Idempotent fast-path for drafts
  if (String(draft.status || "").toLowerCase() === "cancelled") {
    return ok({
      id: entityId,
      source: "draft",
      status: "cancelled",
      already: true,
    });
  }

  const draftPatch = { status: "cancelled", updatedAt: nowIso };
  let updDraft = await admin
    .from("BookingDraft")
    .update(draftPatch)
    .eq("id", entityId);
  if (updDraft.error && String(updDraft.error.code) === "42703") {
    await admin
      .from("BookingDraft")
      .update({ status: "cancelled" })
      .eq("id", entityId);
  } else if (updDraft.error) {
    return bad("Failed to cancel draft", 500);
  }

  return ok({ id: entityId, source: "draft", status: "cancelled" });
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
