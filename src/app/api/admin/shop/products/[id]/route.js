// Folder: src/app/api/admin/shop/products/[id]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { isValidEan13, normalizeScan } from "@/lib/shop/barcode";
import { SHIPPING_COLUMNS, isMissingSchema, selectWithFallback } from "@/lib/shop/schema";

const ok3 = (d, s = 200) => NextResponse.json(d, { status: s });
const bad3 = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function GET(_req, { params }) {
  const auth = await requireAdmin("eshop");
  if (!auth.ok) return auth.response;
  const supabase = createSupabaseAdmin();
  const id = Number(params?.id);
  if (!Number.isFinite(id) || id <= 0) return bad3("Invalid id");
  try {
    const BASE =
      "id, slug, title, description, price_cents, currency, active, stock_qty, sku, sku_code, category, options, created_at, updated_at";
    const WITH_BARCODE = `${BASE}, barcode`;
    const FULL = `${WITH_BARCODE}, ${SHIPPING_COLUMNS}`;
    const { data: product, error } = await selectWithFallback(
      (columns) => supabase.from("shop_product").select(columns).eq("id", id).maybeSingle(),
      [FULL, WITH_BARCODE, BASE]
    );
    if (error) throw error;
    if (!product) return bad3("Product not found", 404);

    const { data: images } = await supabase
      .from("shop_image")
      .select("id, product_id, url, alt, sort")
      .eq("product_id", id)
      .order("sort", { ascending: true });

    return ok3({ product, images: images || [] });
  } catch (e) {
    return bad3(String(e.message || e), 500);
  }
}

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
    if (body.options !== undefined) {
      if (!Array.isArray(body.options)) return bad3("Options must be a list");
      patch.options = body.options;
    }
    for (const key of [
      "shipping_weight_grams",
      "shipping_length_cm",
      "shipping_width_cm",
      "shipping_height_cm",
    ]) {
      if (body[key] === undefined) continue;
      const raw = body[key];
      if (raw === null || raw === "") {
        patch[key] = key === "shipping_weight_grams" ? 0 : null;
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) return bad3(`Invalid ${key.replace(/_/g, " ")}`);
      patch[key] = key === "shipping_weight_grams" ? Math.round(n) : n;
    }
    if (body.barcode !== undefined) {
      const code = normalizeScan(body.barcode);
      if (!code) {
        // Clearing it hands the product back to the auto-assigning trigger.
        patch.barcode = null;
      } else if (!isValidEan13(code)) {
        return bad3("That barcode is not a valid EAN-13 (13 digits, check digit included)");
      } else {
        patch.barcode = code;
      }
    }
    if (body.price_cents !== undefined) {
      const price = Number(body.price_cents);
      if (!Number.isFinite(price) || price < 0)
        return bad3("Invalid price_cents");
      patch.price_cents = Math.round(price);
    }
    patch.updated_at = new Date().toISOString();

    let { data, error } = await supabase
      .from("shop_product")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error && isMissingSchema(error)) {
      // Retry without whichever optional columns this database lacks.
      const {
        barcode: _b,
        shipping_weight_grams: _w,
        shipping_length_cm: _l,
        shipping_width_cm: _wd,
        shipping_height_cm: _h,
        ...rest
      } = patch;
      ({ data, error } = await supabase
        .from("shop_product")
        .update(rest)
        .eq("id", id)
        .select()
        .single());
    }
    if (error) {
      if (error.code === "23505") {
        const what = /barcode/i.test(error.message || "")
          ? "barcode"
          : /sku/i.test(error.message || "")
            ? "SKU"
            : "slug";
        return bad3(`That ${what} is already used by another product`, 409);
      }
      throw error;
    }
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
    // shop_order_item references shop_product, so a product that has ever been
    // bought can never be deleted. Check before touching anything, and say so.
    const { count: orderedCount, error: countErr } = await supabase
      .from("shop_order_item")
      .select("id", { count: "exact", head: true })
      .eq("product_id", id);
    if (countErr) throw countErr;
    if (orderedCount) {
      return bad3(
        `“Delete” is not possible: this product appears on ${orderedCount} order ` +
          `line${orderedCount === 1 ? "" : "s"} and the order history has to keep ` +
          `pointing at it. Switch it to Hidden instead — it disappears from the ` +
          `shop and the app immediately.`,
        409
      );
    }

    // Images have to go first (they reference the product), but a later failure
    // would then leave the product intact with its gallery destroyed. Keep the
    // rows so they can be put back.
    const { data: imageRows, error: readErr } = await supabase
      .from("shop_image")
      .select("id, product_id, url, alt, sort")
      .eq("product_id", id);
    if (readErr) throw readErr;

    const { error: imgErr } = await supabase
      .from("shop_image")
      .delete()
      .eq("product_id", id);
    if (imgErr) throw imgErr;

    const { error } = await supabase.from("shop_product").delete().eq("id", id);
    if (error) {
      if (imageRows?.length) {
        // Best effort: put the gallery back before reporting the failure.
        await supabase.from("shop_image").insert(imageRows);
      }
      // 23503 = foreign key violation; anything still pointing here blocks it.
      if (error.code === "23503") {
        return bad3(
          "Something else in the database still refers to this product, so it " +
            "cannot be deleted. Switch it to Hidden instead.",
          409
        );
      }
      throw error;
    }

    return ok3({ ok: true });
  } catch (e) {
    return bad3(String(e?.message || e), 500);
  }
}
