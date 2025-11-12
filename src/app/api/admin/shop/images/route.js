// Folder: src/app/api/admin/shop/images/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok4 = (d, s = 200) => NextResponse.json(d, { status: s });
const bad4 = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function GET(req) {
  const supabase = createSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const productId = Number(searchParams.get("product_id"));
  if (!Number.isFinite(productId) || productId <= 0)
    return bad4("Missing or invalid product_id");
  try {
    const { data, error } = await supabase
      .from("shop_image")
      .select("id, product_id, url, alt, sort")
      .eq("product_id", productId)
      .order("sort", { ascending: true });
    if (error) throw error;
    return ok4(data || []);
  } catch (e) {
    return bad4(String(e.message || e), 500);
  }
}

export async function POST(req) {
  const supabase = createSupabaseAdmin();
  try {
    const body = await req.json();
    const product_id = Number(body?.product_id);
    const url = String(body?.url || "").trim();
    const alt = String(body?.alt || "");
    const sort = Number(body?.sort || 0);
    if (!Number.isFinite(product_id) || product_id <= 0)
      return bad4("Invalid product_id");
    if (!url) return bad4("Missing url");

    const { data, error } = await supabase
      .from("shop_image")
      .insert([{ product_id, url, alt, sort }])
      .select()
      .single();
    if (error) throw error;
    return ok4(data, 201);
  } catch (e) {
    return bad4(String(e.message || e), 500);
  }
}
