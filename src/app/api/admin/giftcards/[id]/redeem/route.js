// src/app/api/admin/giftcards/[id]/redeem/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function POST(req, ctx) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  // ❌ don't await params
  const { id } = ctx.params || {};
  if (!id) return bad("Missing gift card id", 422);

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  // body
  let payload;
  try {
    payload = await req.json();
  } catch {
    return bad("Invalid JSON body", 422);
  }

  // coerce inputs
  const amountCentsRaw =
    typeof payload?.amountCents === "string"
      ? Number(payload.amountCents)
      : payload?.amountCents;
  const amountCents = Number.isInteger(amountCentsRaw) ? amountCentsRaw : NaN;

  const notes = (payload?.notes || "").trim() || null;

  let bookingId = null;
  if (payload?.bookingId !== undefined && payload?.bookingId !== null) {
    const b = Number(payload.bookingId);
    bookingId = Number.isInteger(b) ? b : null;
  }

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return bad("'amountCents' must be a positive integer (in cents).", 422);
  }

  /* -------- PATH A: atomic RPC if present -------- */
  try {
    const { data, error } = await admin.rpc("redeem_giftcard", {
      p_card_id: id,
      p_amount_cents: amountCents,
      p_booking_id: bookingId,
      p_notes: notes,
    });

    // If the function exists and ran, PostgREST returns either an object or an array
    if (!error && data) {
      const redemption = Array.isArray(data) ? data[0] : data;

      // Re-fetch minimal card state for UI
      const { data: cardRow, error: cardErr } = await admin
        .from("GiftCard")
        .select("id, code, currency, remaining_amount_cents, status")
        .eq("id", id)
        .single();

      if (cardErr) {
        // RPC succeeded but re-fetch failed — still return redemption
        return ok({ redemption }, 201);
      }
      return ok({ card: cardRow, redemption }, 201);
    }

    // Function missing → PostgREST error 42883; fall back
    if (error?.code !== "42883") {
      return bad(error?.message || "Redemption failed", 500);
    }
  } catch (e) {
    // Non-PostgREST throw
    if (e?.code && e.code !== "42883") {
      return bad(e?.message || "Redemption failed", 500);
    }
  }

  /* -------- PATH B: fallback (non-atomic) -------- */
  // 1) fetch card
  const { data: card, error: getErr } = await admin
    .from("GiftCard")
    .select(
      "id, code, currency, status, remaining_amount_cents, initial_amount_cents"
    )
    .eq("id", id)
    .single();

  if (getErr) return bad(getErr.message || "Card not found", 404);
  if (card.status !== "active") return bad("Card is not active", 409);
  if (amountCents > card.remaining_amount_cents)
    return bad("Amount exceeds remaining balance", 409);

  const newRemaining = card.remaining_amount_cents - amountCents;
  const newStatus = newRemaining === 0 ? "redeemed" : "active";

  // 2) update card (guard by status to reduce race risk)
  const { data: updated, error: upErr } = await admin
    .from("GiftCard")
    .update({
      remaining_amount_cents: newRemaining,
      last_redeemed_at: new Date().toISOString(),
      status: newStatus,
    })
    .eq("id", id)
    .eq("status", "active")
    .select("id, code, currency, remaining_amount_cents, status")
    .single();

  if (upErr) return bad(upErr.message || "Balance update failed", 500);

  // 3) insert redemption (best-effort)
  const { error: insErr } = await admin.from("GiftCardRedemption").insert({
    gift_card_id: id,
    amount_cents: amountCents,
    currency: updated.currency,
    booking_id: bookingId,
    notes,
  });

  if (insErr) {
    console.warn("GiftCardRedemption insert failed:", insErr);
    // you could also return 207, but 201 is ok for admin UI
  }

  return ok({ card: updated }, 201);
}
