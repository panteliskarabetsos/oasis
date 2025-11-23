// Folder: src/app/api/admin/shop/products/[id]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok3 = (d, s = 200) => NextResponse.json(d, { status: s });
const bad3 = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function PATCH(req, { params }) {
  const supabase = createSupabaseAdmin();
  const id = Number(params?.id);
  if (!Number.isFinite(id) || id <= 0) return bad3("Invalid id");
  try {
    const body = await req.json();
    const patch = {};
    if (body.title !== undefined) patch.title = String(body.title);
    if (body.slug !== undefined) patch.slug = String(body.slug);
    if (body.description !== undefined)
      patch.description = String(body.description || "");
    if (body.currency !== undefined)
      patch.currency = String(body.currency || "EUR");
    if (body.active !== undefined) patch.active = !!body.active;
    if (body.price_cents !== undefined) {
      const price = Number(body.price_cents);
      if (!Number.isFinite(price) || price < 0)
        return bad3("Invalid price_cents");
      patch.price_cents = Math.round(price);
    }
    patch.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("shop_product")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return ok3(data);
  } catch (e) {
    return bad3(String(e.message || e), 500);
  }
}

export async function DELETE(_req, { params }) {
  const supabase = createSupabaseAdmin();
  const id = Number(params?.id);
  if (!Number.isFinite(id) || id <= 0) return bad3("Invalid id");
  try {
    // Remove dependent images first (FK likely restricts delete)
    const { error: imgErr } = await supabase
      .from("shop_image")
      .delete()
      .eq("product_id", id);
    if (imgErr) throw imgErr;
    const { error } = await supabase.from("shop_product").delete().eq("id", id);
    if (error) throw error;
    return ok3({ ok: true });
  } catch (e) {
    return bad3(String(e.message || e), 500);
  }
}
