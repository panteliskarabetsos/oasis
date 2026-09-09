// Sellable merch for POS "Items & Merch" mode.
// Returns a bare array: [{ id, name, sku, price, currency, stock, category }]
// (`price` is in major units — the POS multiplies it by quantity directly.)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export async function GET() {
  const auth = await requireAdmin("pos");
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.admin
    .from("shop_product")
    .select("id, title, sku_code, price_cents, currency, stock_qty, category, active")
    .eq("active", true)
    .order("title", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (data || []).map((p) => ({
    id: p.id,
    name: p.title,
    sku: p.sku_code || null,
    price: Number(p.price_cents || 0) / 100,
    currency: p.currency || "EUR",
    stock: p.stock_qty ?? null,
    category: p.category || "other",
  }));

  return NextResponse.json(items);
}
