// src/app/api/shop/products/route.js
// Public storefront listing. The admin routes under /api/admin/shop are staff
// only; this is the customer-facing view and never exposes cost or draft rows.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { groupImages, publicProduct } from "@/lib/shop/server";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

const SORTS = {
  new: { column: "created_at", ascending: false },
  price_asc: { column: "price_cents", ascending: true },
  price_desc: { column: "price_cents", ascending: false },
  title: { column: "title", ascending: true },
};

export async function GET(req) {
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const { searchParams } = new URL(req.url);
  const category = (searchParams.get("category") || "").trim().toLowerCase();
  const search = (searchParams.get("search") || "").trim();
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 60, 1), 100);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
  const sort = SORTS[searchParams.get("sort") || "new"] ?? SORTS.new;

  try {
    let query = admin
      .from("shop_product")
      .select(
        "id, slug, title, description, price_cents, currency, category, sku_code, stock_qty, options, created_at",
        { count: "exact" }
      )
      .eq("active", true)
      .order(sort.column, { ascending: sort.ascending })
      .range(offset, offset + limit - 1);

    if (category && category !== "all") query = query.eq("category", category);
    if (search) {
      const like = `%${search.replace(/[%,]/g, "")}%`;
      query = query.or(`title.ilike.${like},description.ilike.${like},sku_code.ilike.${like}`);
    }

    const { data: products, error, count } = await query;
    if (error) throw error;

    const ids = (products || []).map((p) => p.id);
    let byProduct = new Map();
    if (ids.length) {
      const { data: images } = await admin
        .from("shop_image")
        .select("product_id, url, alt, sort")
        .in("product_id", ids)
        .order("sort", { ascending: true });
      byProduct = groupImages(images || []);
    }

    // The whole active catalogue's categories, not just this page's — the
    // filter bar must not lose a tab when a search narrows the results.
    const { data: catRows } = await admin
      .from("shop_product")
      .select("category")
      .eq("active", true);
    const categories = [...new Set((catRows || []).map((r) => r.category || "other"))].sort();

    const settings = await readShopSettings(admin);

    return ok({
      items: (products || []).map((p) => publicProduct(p, byProduct.get(Number(p.id)) || [])),
      total: count ?? (products || []).length,
      offset,
      limit,
      categories,
      shop: settings,
    });
  } catch (e) {
    return bad(String(e?.message || e), 500);
  }
}

/** Shop pause flag — stored on AppSetting under key 'shop' (see admin route). */
async function readShopSettings(admin) {
  try {
    const { data } = await admin
      .from("AppSetting")
      .select("bookingspaused, bookingspausedmessage")
      .eq("key", "shop")
      .maybeSingle();
    return {
      paused: Boolean(data?.bookingspaused),
      message: data?.bookingspausedmessage || "",
    };
  } catch {
    return { paused: false, message: "" };
  }
}
