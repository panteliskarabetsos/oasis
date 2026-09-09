// src/app/api/shop/products/[slug]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { groupImages, publicProduct } from "@/lib/shop/server";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function GET(_req, { params }) {
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const { slug } = await params;
  const key = String(slug || "").trim();
  if (!key) return bad("Missing slug");

  try {
    const { data: product, error } = await admin
      .from("shop_product")
      .select(
        "id, slug, title, description, price_cents, currency, category, sku_code, stock_qty, options, created_at"
      )
      .eq("slug", key)
      .eq("active", true)
      .maybeSingle();
    if (error) throw error;
    if (!product) return bad("Product not found", 404);

    const { data: images } = await admin
      .from("shop_image")
      .select("product_id, url, alt, sort")
      .eq("product_id", product.id)
      .order("sort", { ascending: true });

    const { data: relatedRows } = await admin
      .from("shop_product")
      .select(
        "id, slug, title, description, price_cents, currency, category, sku_code, stock_qty, options, created_at"
      )
      .eq("active", true)
      .eq("category", product.category || "other")
      .neq("id", product.id)
      .limit(6);

    const relatedIds = (relatedRows || []).map((r) => r.id);
    let relatedImages = new Map();
    if (relatedIds.length) {
      const { data: ri } = await admin
        .from("shop_image")
        .select("product_id, url, alt, sort")
        .in("product_id", relatedIds)
        .order("sort", { ascending: true });
      relatedImages = groupImages(ri || []);
    }

    return ok({
      product: publicProduct(product, images || []),
      related: (relatedRows || []).map((r) =>
        publicProduct(r, relatedImages.get(Number(r.id)) || [])
      ),
    });
  } catch (e) {
    return bad(String(e?.message || e), 500);
  }
}
