// Folder: src/app/api/admin/shop/lookup/route.js
// Resolve a scanned or typed code to a product. Shared by the web scanner
// station and anything else that holds a scanner (the admin app, a POS).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { isValidEan13, normalizeScan } from "@/lib/shop/barcode";
import { BARCODE_MIGRATION_HINT, isMissingSchema } from "@/lib/shop/schema";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

const COLUMNS_BASE =
  "id, slug, title, price_cents, currency, active, stock_qty, sku, sku_code, category";
const COLUMNS = `${COLUMNS_BASE}, barcode`;

export async function GET(req) {
  const auth = await requireAdmin("eshop");
  if (!auth.ok) return auth.response;
  const supabase = createSupabaseAdmin();
  if (!supabase) return bad("Server not configured", 500);

  const code = normalizeScan(new URL(req.url).searchParams.get("code") || "");
  if (!code) return bad("Nothing was scanned");

  // Without the barcode migration there is no column to match on; fall back to
  // the SKU and id so the scanner still resolves something.
  let columns = COLUMNS;
  let barcodesReady = true;

  try {
    // Exact matches first, cheapest and least ambiguous: barcode, then SKU.
    let { data, error } = await supabase
      .from("shop_product")
      .select(columns)
      .eq("barcode", code)
      .maybeSingle();
    if (error && isMissingSchema(error)) {
      barcodesReady = false;
      columns = COLUMNS_BASE;
      data = null;
      error = null;
    }
    if (error) throw error;
    if (data) return ok({ product: data, matchedOn: "barcode", code });

    ({ data, error } = await supabase
      .from("shop_product")
      .select(columns)
      .ilike("sku_code", code)
      .maybeSingle());
    if (error) throw error;
    if (data) return ok({ product: data, matchedOn: "sku", code, barcodesReady });

    // A bare number could be the product id or the raw sku sequence.
    if (/^\d+$/.test(code)) {
      const n = Number(code);
      if (Number.isSafeInteger(n)) {
        ({ data, error } = await supabase
          .from("shop_product")
          .select(columns)
          .or(`id.eq.${n},sku.eq.${n}`)
          .limit(1)
          .maybeSingle());
        if (error) throw error;
        if (data) return ok({ product: data, matchedOn: "id", code, barcodesReady });
      }
    }

    // Last resort: a partial title/slug match, so typing still finds things.
    const like = `%${code.replace(/[%,]/g, "")}%`;
    const { data: fuzzy, error: fErr } = await supabase
      .from("shop_product")
      .select(columns)
      .or(`title.ilike.${like},slug.ilike.${like}`)
      .limit(5);
    if (fErr) throw fErr;

    return ok(
      {
        product: null,
        code,
        suggestions: fuzzy || [],
        validEan: isValidEan13(code),
        barcodesReady,
        hint: barcodesReady ? null : BARCODE_MIGRATION_HINT,
      },
      404
    );
  } catch (e) {
    return bad(String(e?.message || e), 500);
  }
}
