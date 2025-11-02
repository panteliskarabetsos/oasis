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

  // Next.js App Router: ctx.params is sync
  const { id } = ctx.params || {};
  if (!id) return bad("Missing id", 422);

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const selectWithStripe = `${BASE_COLS}, ${STRIPE_COLS}`;

  // 1) Try selecting with Stripe columns
  let { data, error } = await admin
    .from("GiftCard")
    .select(selectWithStripe)
    .eq("id", id)
    .single();

  // 2) If DB doesn't have Stripe columns yet, retry without them
  const missingStripeCols =
    error &&
    (error.code === "42703" || /does not exist/i.test(error.message || ""));

  if (missingStripeCols) {
    ({ data, error } = await admin
      .from("GiftCard")
      .select(BASE_COLS)
      .eq("id", id)
      .single());
  }

  if (error) {
    // Not found / no rows
    if (error.code === "PGRST116") return bad("Not found", 404);
    return bad(error.message || "Database error", 500);
  }

  // Derive a convenient payment_method for the UI
  const payment_method =
    data?.stripe_session_id ||
    data?.stripe_payment_intent_id ||
    String(data?.source || "")
      .toLowerCase()
      .includes("stripe")
      ? "stripe"
      : "offline";

  return ok({ ...data, payment_method });
}
