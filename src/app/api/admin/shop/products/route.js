// Folder: src/app/api/admin/shop/products/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { isValidEan13, normalizeScan } from "@/lib/shop/barcode";
import { BARCODE_MIGRATION_HINT, isMissingSchema } from "@/lib/shop/schema";

const ok2 = (d, s = 200, headers) =>
  NextResponse.json(d, { status: s, ...(headers ? { headers } : {}) });
const bad2 = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function GET(req) {
  const auth = await requireAdmin("eshop");
  if (!auth.ok) return auth.response;
  const supabase = createSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("search") || "").trim();
  // The barcode column arrives with a migration. A deploy that lands before the
  // SQL is run must still render the products list, so ask for it and retreat
  // to the older column set if the database has not caught up.
  const build = (withBarcode) => {
    let query = supabase
      .from("shop_product")
      .select(
        "id, slug, title, description, price_cents, currency, active, stock_qty, sku, sku_code, category, created_at, updated_at" +
          (withBarcode ? ", barcode" : "")
      )
      .order("updated_at", { ascending: false })
      .limit(200);
    if (q) {
      const like = `%${q}%`;
      const fields = [
        `title.ilike.${like}`,
        `slug.ilike.${like}`,
        `sku_code.ilike.${like}`,
      ];
      if (withBarcode) fields.push(`barcode.ilike.${like}`);
      query = query.or(fields.join(","));
    }
    return query;
  };

  try {
    let { data, error } = await build(true);
    if (error && isMissingSchema(error)) {
      ({ data, error } = await build(false));
      if (error) throw error;
      return ok2(data || [], 200, { "X-Shop-Migration": BARCODE_MIGRATION_HINT });
    }
    if (error) throw error;
    return ok2(data || []);
  } catch (e) {
    return bad2(String(e.message || e), 500);
  }
}

export async function POST(req) {
  const auth = await requireAdmin("eshop");
  if (!auth.ok) return auth.response;
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
      sku_code,
      stock_qty,
      category,
      options,
    } = body || {};
    if (!title || !slug) return bad2("Missing title or slug");
    const price = Number(price_cents);
    if (!Number.isFinite(price) || price < 0)
      return bad2("Invalid price_cents");

    // The new-product form has always sent these; they used to be dropped on
    // the floor, so every product was created at stock 0 in category "other".
    const row = {
      title,
      slug,
      description,
      price_cents: Math.round(price),
      currency,
      active,
    };

    if (stock_qty !== undefined) {
      const n = Number(stock_qty);
      if (!Number.isInteger(n) || n < 0)
        return bad2("Stock must be a whole number of 0 or more");
      row.stock_qty = n;
    }
    if (sku_code !== undefined) {
      row.sku_code = String(sku_code || "").trim() || null;
    }
    if (category !== undefined) {
      const allowed = ["clothing", "food", "other"];
      const c = String(category || "other");
      if (!allowed.includes(c)) return bad2("Unknown category");
      row.category = c;
    }
    if (options !== undefined) {
      if (!Array.isArray(options)) return bad2("Options must be a list");
      row.options = options;
    }
    // Left unset, a trigger assigns one from the product's sku sequence. Set,
    // it must be a real EAN-13 — a bought-in item keeps its own barcode.
    if (body?.barcode !== undefined) {
      const code = normalizeScan(body.barcode);
      if (code) {
        if (!isValidEan13(code))
          return bad2("That barcode is not a valid EAN-13 (13 digits, check digit included)");
        row.barcode = code;
      }
    }
    // `variants` is accepted by the form but has no table to land in, so it is
    // deliberately not persisted here.

    const now = new Date().toISOString();
    let { data, error } = await supabase
      .from("shop_product")
      .insert([{ ...row, created_at: now, updated_at: now }])
      .select()
      .single();
    if (error && isMissingSchema(error)) {
      // Pre-migration the barcode column is absent. Create the product anyway;
      // the trigger fills the code in once the SQL has been run.
      const { barcode: _dropped, ...withoutBarcode } = row;
      ({ data, error } = await supabase
        .from("shop_product")
        .insert([{ ...withoutBarcode, created_at: now, updated_at: now }])
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
        return bad2(`That ${what} is already used by another product`, 409);
      }
      throw error;
    }
    return ok2(data, 201);
  } catch (e) {
    return bad2(String(e.message || e), 500);
  }
}
