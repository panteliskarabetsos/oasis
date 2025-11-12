// Folder: src/app/api/admin/shop/orders/[id]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok7 = (d, s = 200) => NextResponse.json(d, { status: s });
const bad7 = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function GET(_req, { params }) {
  const supabase = createSupabaseAdmin();
  const id = Number(params?.id);
  if (!Number.isFinite(id) || id <= 0) return bad7("Invalid id");
  try {
    const [{ data: order, error: oErr }, { data: items, error: iErr }] =
      await Promise.all([
        supabase.from("shop_order").select("*").eq("id", id).single(),
        supabase
          .from("shop_order_item")
          .select(
            "id, order_id, product_id, quantity, unit_price_cents, currency, title_snapshot"
          )
          .eq("order_id", id)
          .order("id"),
      ]);
    if (oErr) throw oErr;
    if (iErr) throw iErr;
    return ok7({ order, items });
  } catch (e) {
    return bad7(String(e.message || e), 500);
  }
}
