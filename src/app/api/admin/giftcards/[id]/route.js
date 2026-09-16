// src/app/api/admin/giftcards/[id]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400, extra = {}) =>
  NextResponse.json({ error: m, ...extra }, { status: s });

const BASE_COLS = [
  "id",
  "code",
  "initial_amount_cents",
  "remaining_amount_cents",
  "currency",
  "purchaser_email",
  "recipient_email",
  "recipient_name",
  "message",
  "issued_at",
  "expires_at",
  "last_redeemed_at",
  "status",
  "source",
  "voided_at",
  "created_at",
].join(", ");

const STRIPE_COLS = ["stripe_session_id", "stripe_payment_intent_id"].join(
  ", "
);

export async function GET(_req, ctx) {
  const gate = await requireAdmin("giftcards");
  if (!gate.ok) return gate.response;

  // ✅ Must await params
  const { id } = await ctx.params;
  if (!id) return bad("Missing id", 422);

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const selectWithStripe = `${BASE_COLS}, ${STRIPE_COLS}`;

  // Try with Stripe columns
  let { data, error } = await admin
    .from("GiftCard")
    .select(selectWithStripe)
    .eq("id", id)
    .single();

  // If Stripe cols don't exist yet, retry without them
  if (
    error &&
    (error.code === "42703" || /does not exist/i.test(error.message || ""))
  ) {
    ({ data, error } = await admin
      .from("GiftCard")
      .select(BASE_COLS)
      .eq("id", id)
      .single());
  }

  if (error) {
    if (error.code === "PGRST116" || /0 rows/.test(error.message || ""))
      return bad("Not found", 404);
    if (error.code === "22P02") return bad("Invalid id", 422); // bad UUID format
    return bad(error.message || "Database error", 500);
  }

  const isStripe =
    !!data?.stripe_session_id ||
    !!data?.stripe_payment_intent_id ||
    (data?.source && String(data.source).toLowerCase().includes("stripe"));

  return ok({ ...data, payment_method: isStripe ? "stripe" : "offline" });
}

/**
 * Change when a card lapses.
 *
 * Gift cards that quietly expire are money the business keeps and a customer
 * who feels cheated, and until now an expiry set at issue could never be
 * moved. An admin can push one out — or lift it entirely — when someone asks.
 *
 * Only forwards: shortening the window on value someone has already paid for
 * is not a correction, it is taking it away, and nothing here should make
 * that a two-click operation.
 */
export async function PATCH(req, ctx) {
  const gate = await requireAdmin("giftcards");
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!id) return bad("Missing id", 422);

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const body = await req.json().catch(() => ({}));
  if (!("expiresAt" in body)) return bad("Nothing to change", 422);

  const raw = body.expiresAt;
  let next = null; // null clears the expiry
  if (raw !== null && raw !== "") {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return bad("That is not a valid date", 422);
    if (d.getTime() < Date.now()) return bad("Choose a date in the future", 422);
    next = d.toISOString();
  }

  const { data: card, error: readErr } = await admin
    .from("GiftCard")
    .select("id, status, expires_at")
    .eq("id", id)
    .maybeSingle();
  if (readErr || !card) return bad("Gift card not found", 404);
  if (card.status === "void") {
    return bad("This card was voided; its expiry no longer means anything.", 409);
  }

  const current = card.expires_at ? new Date(card.expires_at).getTime() : null;
  if (next && current && new Date(next).getTime() < current) {
    return bad(
      "An expiry can be extended or removed, not brought forward.",
      422,
      { reason: "would-shorten" },
    );
  }

  const { data: updated, error } = await admin
    .from("GiftCard")
    .update({ expires_at: next })
    .eq("id", id)
    .select("id, code, expires_at, status")
    .maybeSingle();

  if (error) return bad(error.message || "Could not update the expiry", 500);
  return ok({ card: updated });
}
