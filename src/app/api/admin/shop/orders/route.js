// Folder: src/app/api/admin/shop/orders/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { selectWithFallback } from "@/lib/shop/schema";

const ok6 = (d, s = 200) => NextResponse.json(d, { status: s });
const bad6 = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function GET(req) {
  const auth = await requireAdmin("eshop");
  if (!auth.ok) return auth.response;
  const supabase = createSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") || "").trim();
  const q = (searchParams.get("q") || "").trim();
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

  try {
    const BASE =
      "id, status, total_cents, currency, placed_at, created_at, stripe_payment_intent_id";

    const build = (cols) => {
      let query = supabase
        .from("shop_order")
        .select(cols)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status && status !== "all") query = query.eq("status", status);

      if (q) {
        const idNum = Number(q);
        if (Number.isFinite(idNum)) {
          query = query.eq("id", idNum);
        } else {
          const like = `%${q}%`;
          query = query.or(
            [
              `stripe_payment_intent_id.ilike.${like}`,
              `billing_address->>email.ilike.${like}`,
              `shipping_address->>email.ilike.${like}`,
            ].join(",")
          );
        }
      }

      return query;
    };

    const { data, error } = await selectWithFallback(build, [
      `${BASE}, shipping_cents, shipping_method, refunded_cents`,
      BASE,
    ]);
    if (error) throw error;
    return ok6(data || []);
  } catch (e) {
    return bad6(String(e.message || e), 500);
  }
}
