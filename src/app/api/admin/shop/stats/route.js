// Folder: src/app/api/admin/shop/stats/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function GET() {
  const supabase = createSupabaseAdmin();
  try {
    const [{ count: productCount }, { count: activeProductCount }] =
      await Promise.all([
        supabase
          .from("shop_product")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("shop_product")
          .select("id", { count: "exact", head: true })
          .eq("active", true),
      ]);

    const { count: ordersPendingCount } = await supabase
      .from("shop_order")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const iso = since.toISOString();

    // Revenue in the last 30 days from paid/fulfilled orders
    const { data: revRows, error: revErr } = await supabase
      .from("shop_order")
      .select("total_cents, status, created_at, placed_at")
      .in("status", ["paid", "fulfilled"])
      .or(`placed_at.gte.${iso},created_at.gte.${iso}`);

    if (revErr) throw revErr;
    const revenue30dCents = (revRows || []).reduce(
      (s, r) => s + Number(r.total_cents || 0),
      0
    );

    return ok({
      productCount: productCount || 0,
      activeProductCount: activeProductCount || 0,
      ordersPendingCount: ordersPendingCount || 0,
      revenue30dCents,
    });
  } catch (e) {
    return bad(String(e.message || e), 500);
  }
}
