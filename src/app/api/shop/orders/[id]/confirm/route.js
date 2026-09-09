// src/app/api/shop/orders/[id]/confirm/route.js
// Called by the app the moment PaymentSheet reports success, so the customer
// sees a settled order without waiting on the webhook. The client's word is
// never taken for it: the intent is re-read from Stripe and must both be
// succeeded and carry this order's id in its metadata.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { markOrderPaid, ORDER_PAID } from "@/lib/shop/server";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function POST(req, { params }) {
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId) || orderId <= 0) return bad("Invalid order id");

  let body = {};
  try {
    body = (await req.json()) || {};
  } catch {
    // an empty body is fine — we fall back to the stored intent
  }

  const { data: order, error } = await admin
    .from("shop_order")
    .select("id, status, total_cents, currency, stripe_payment_intent_id, placed_at, created_at")
    .eq("id", orderId)
    .maybeSingle();
  if (error) return bad(error.message, 500);
  if (!order) return bad("Order not found", 404);
  if (order.status === ORDER_PAID) return ok({ ok: true, already: true, order });

  const intentId = String(body.paymentIntentId || order.stripe_payment_intent_id || "").trim();
  if (!intentId) return bad("No payment to confirm", 409);

  let intent;
  try {
    intent = await getStripe().paymentIntents.retrieve(intentId);
  } catch (e) {
    return bad(String(e?.message || e) || "Could not verify the payment", 502);
  }

  if (String(intent?.metadata?.shop_order_id || "") !== String(orderId)) {
    return bad("That payment belongs to a different order", 409);
  }
  if (intent.status !== "succeeded") {
    return ok({ ok: false, status: intent.status, order }, 202);
  }

  const result = await markOrderPaid(admin, orderId, { paymentIntentId: intent.id });
  if (!result.ok) return bad(result.error || "Could not settle the order", 500);
  return ok({ ok: true, already: Boolean(result.already), order: result.order });
}
