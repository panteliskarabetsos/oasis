// src/app/api/shop/orders/[id]/route.js
// One order with its lines. Readable by the account that placed it, or by a
// guest who can quote the email address on the order — the same bar the guest
// booking portal uses.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isMissingSchema, selectWithFallback } from "@/lib/shop/schema";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function GET(req, { params }) {
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId) || orderId <= 0) return bad("Invalid order id");

  const email = (new URL(req.url).searchParams.get("email") || "").trim().toLowerCase();

  // Delivery and tracking arrive with migrations; a customer on a database
  // without them still gets their order, just without those lines.
  const BASE =
    "id, user_id, status, total_cents, currency, billing_address, shipping_address, placed_at, created_at";
  const FULL = `${BASE}, shipping_cents, shipping_method, tracking_number, tracking_url, refunded_cents`;
  const { data: order, error } = await selectWithFallback(
    (columns) => admin.from("shop_order").select(columns).eq("id", orderId).maybeSingle(),
    [FULL, BASE]
  );
  if (error) return bad(error.message, 500);
  if (!order) return bad("Order not found", 404);

  let authUserId = null;
  try {
    const supa = await createSupabaseServer();
    if (supa) {
      const {
        data: { user },
      } = await supa.auth.getUser();
      authUserId = user?.id ?? null;
    }
  } catch {
    authUserId = null;
  }

  const ownerMatches = Boolean(order.user_id && authUserId && order.user_id === authUserId);
  const orderEmail = String(order.billing_address?.email || "").toLowerCase();
  const emailMatches = Boolean(email && orderEmail && email === orderEmail);
  if (!ownerMatches && !emailMatches) return bad("Not found", 404);

  const { data: items } = await admin
    .from("shop_order_item")
    .select("id, product_id, quantity, unit_price_cents, currency, title_snapshot")
    .eq("order_id", orderId)
    .order("id");

  const { user_id: _hidden, ...safe } = order;
  return ok({ order: safe, items: items || [] });
}
