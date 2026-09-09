// src/app/api/shop/quote/route.js
// What a basket costs to deliver, before the customer commits to paying.
// The storefront calls this whenever the bag or the destination changes; the
// checkout re-computes with the same function so the two cannot disagree.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { SHIPPING_COLUMNS, getShippingSettings } from "@/lib/shop/server";
import { isMissingSchema } from "@/lib/shop/schema";
import { quoteShipping } from "@/lib/shop/shipping";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function POST(req) {
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  let body;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON");
  }

  const raw = Array.isArray(body?.items) ? body.items : [];
  const country = String(body?.country || "GR");
  const method = body?.method === "pickup" ? "pickup" : "courier";

  const wanted = new Map();
  for (const line of raw) {
    const id = Number(line?.productId ?? line?.id);
    const qty = Math.floor(Number(line?.quantity ?? 1));
    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(qty) || qty <= 0) continue;
    wanted.set(id, (wanted.get(id) || 0) + qty);
  }

  try {
    const settings = await getShippingSettings(admin);

    let rows = [];
    let subtotalCents = 0;
    let lines = [];
    if (wanted.size) {
      const base = "id, slug, title, price_cents, active, stock_qty";
      let { data, error } = await admin
        .from("shop_product")
        .select(`${base}, ${SHIPPING_COLUMNS}`)
        .in("id", [...wanted.keys()]);
      if (error && isMissingSchema(error)) {
        // Pre-migration: no dimensions to price on, so nothing weighs anything.
        ({ data, error } = await admin.from("shop_product").select(base).in("id", [...wanted.keys()]));
      }
      if (error) throw error;

      const byId = new Map((data || []).map((p) => [Number(p.id), p]));
      // Report each requested line back with what the shop currently thinks, so
      // a basket that has gone stale can correct itself before payment.
      for (const [id, quantity] of wanted) {
        const p = byId.get(id);
        if (!p || !p.active) {
          lines.push({ productId: id, available: false, reason: "no longer sold", quantity: 0 });
          continue;
        }
        const stock = Number(p.stock_qty ?? 0);
        lines.push({
          productId: id,
          available: stock > 0,
          reason: stock > 0 ? null : "sold out",
          title: p.title,
          slug: p.slug,
          priceCents: Number(p.price_cents || 0),
          stockQty: stock,
          quantity: Math.min(quantity, Math.max(0, stock)),
        });
      }

      rows = (data || [])
        .filter((p) => p.active && Number(p.stock_qty ?? 0) > 0)
        .map((p) => ({
          ...p,
          quantity: Math.min(wanted.get(Number(p.id)) || 0, Number(p.stock_qty ?? 0)),
        }));
      subtotalCents = rows.reduce(
        (n, p) => n + Number(p.price_cents || 0) * Number(p.quantity || 0),
        0
      );
    }

    const quote = quoteShipping({
      lines: rows,
      settings,
      country,
      method,
      subtotalCents,
    });

    return ok({
      ...quote,
      lines,
      subtotalCents,
      totalCents: subtotalCents + (quote.available ? quote.cents : 0),
      pickupOffered: Boolean(settings.pickup?.enabled),
      pickupLabel: settings.pickup?.label || "Collect from us",
      freeOverCents: Number(settings.freeOverCents) || 0,
    });
  } catch (e) {
    return bad(String(e?.message || e), 500);
  }
}
