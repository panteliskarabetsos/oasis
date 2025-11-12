// Folder: src/app/api/admin/shop/products/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok2 = (d, s = 200) => NextResponse.json(d, { status: s });
const bad2 = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function GET(req) {
  const supabase = createSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("search") || "").trim();
  try {
    let query = supabase
      .from("shop_product")
      .select(
        "id, slug, title, description, price_cents, currency, active, created_at, updated_at"
      )
      .order("updated_at", { ascending: false })
      .limit(200);
    if (q) {
      const like = `%${q}%`;
      query = query.or(`title.ilike.${like},slug.ilike.${like}`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return ok2(data || []);
  } catch (e) {
    return bad2(String(e.message || e), 500);
  }
}

export async function POST(req) {
  const supabase = createSupabaseAdmin();
  try {
    const body = await req.json();
    const {
      title,
      slug,
      description = "",
      price_cents,
      currency = "EUR",
      active = true,
    } = body || {};
    if (!title || !slug) return bad2("Missing title or slug");
    const price = Number(price_cents);
    if (!Number.isFinite(price) || price < 0)
      return bad2("Invalid price_cents");

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("shop_product")
      .insert([
        {
          title,
          slug,
          description,
          price_cents: Math.round(price),
          currency,
          active,
          created_at: now,
          updated_at: now,
        },
      ])
      .select()
      .single();
    if (error) throw error;
    return ok2(data, 201);
  } catch (e) {
    return bad2(String(e.message || e), 500);
  }
}
