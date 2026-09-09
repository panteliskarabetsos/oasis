// Folder: src/app/api/admin/shop/products/[id]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

const ok3 = (d, s = 200) => NextResponse.json(d, { status: s });
const bad3 = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function PATCH(req, { params }) {
  const auth = await requireAdmin("eshop");
  if (!auth.ok) return auth.response;
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
    // Stock was write-once at creation: the list never returned it and this
    // route never accepted it, so it went stale the moment anything sold.
    if (body.stock_qty !== undefined) {
      const n = Number(body.stock_qty);
      if (!Number.isInteger(n) || n < 0) {
        return NextResponse.json(
          { error: "Stock must be a whole number of 0 or more" },
          { status: 400 },
        );
      }
      patch.stock_qty = n;
    }
    if (body.sku_code !== undefined) {
      patch.sku_code = String(body.sku_code || "").trim() || null;
    }
    if (body.category !== undefined) {
      const allowed = ["clothing", "food", "other"];
      const c = String(body.category || "other");
      if (!allowed.includes(c)) {
        return NextResponse.json({ error: "Unknown category" }, { status: 400 });
      }
      patch.category = c;
    }
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
  const auth = await requireAdmin("eshop");
  if (!auth.ok) return auth.response;
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
