// src/app/api/admin/giftcards/[id]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

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
  const gate = await requireAdmin();
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
