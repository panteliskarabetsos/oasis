// src/app/api/shop/orders/route.js
// The signed-in customer's own order history.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function GET() {
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

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
  if (!authUserId) return ok({ items: [] });

  const { data: orders, error } = await admin
    .from("shop_order")
    .select("id, status, total_cents, currency, placed_at, created_at")
    .eq("user_id", authUserId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return bad(error.message, 500);

  const ids = (orders || []).map((o) => o.id);
  let byOrder = new Map();
  if (ids.length) {
    const { data: items } = await admin
      .from("shop_order_item")
      .select("order_id, quantity, title_snapshot, unit_price_cents")
      .in("order_id", ids)
      .order("id");
    for (const it of items || []) {
      const key = Number(it.order_id);
      if (!byOrder.has(key)) byOrder.set(key, []);
      byOrder.get(key).push(it);
    }
  }

  return ok({
    items: (orders || []).map((o) => ({ ...o, items: byOrder.get(Number(o.id)) || [] })),
  });
}
