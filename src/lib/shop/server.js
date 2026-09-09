// src/lib/shop/server.js
// Shared server helpers for the public storefront. Kept in one place because
// both the client-side confirm route and the Stripe webhook can be the first
// to learn that a shop order was paid — and only one of them may decrement
// stock.
import "server-only";

import { notifyOrderPaid } from "@/lib/shop/notify";

export const ORDER_PENDING = "pending";
export const ORDER_PAID = "paid";

/** Normalise a jsonb address/contact blob into a plain, trimmed object. */
export function cleanBlob(input, allowed) {
  const out = {};
  if (!input || typeof input !== "object") return out;
  for (const key of allowed) {
    const v = input[key];
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s) out[key] = s.slice(0, 300);
  }
  return out;
}

export const CONTACT_FIELDS = ["name", "email", "phone"];
export const ADDRESS_FIELDS = [
  "name",
  "email",
  "phone",
  "line1",
  "line2",
  "city",
  "region",
  "postalCode",
  "country",
  "notes",
];

/**
 * Move an order from pending → paid exactly once, then draw down stock.
 *
 * The status filter on the UPDATE is the concurrency guard: whichever of the
 * webhook and the confirm route gets there first flips the row and receives it
 * back; the loser sees zero rows and skips the stock write. Returns the order
 * either way so callers can respond with its current state.
 */
export async function markOrderPaid(admin, orderId, refs = {}, opts = {}) {
  const id = Number(orderId);
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: "Invalid order id" };

  const patch = { status: ORDER_PAID, placed_at: new Date().toISOString() };
  if (refs.paymentIntentId) patch.stripe_payment_intent_id = refs.paymentIntentId;
  if (refs.sessionId) patch.stripe_session_id = refs.sessionId;

  const { data: claimed, error: claimErr } = await admin
    .from("shop_order")
    .update(patch)
    .eq("id", id)
    .eq("status", ORDER_PENDING)
    .select("id, status, total_cents, currency, placed_at, created_at, stripe_payment_intent_id")
    .maybeSingle();

  if (claimErr) return { ok: false, error: claimErr.message };

  if (!claimed) {
    // Someone else already settled it (or it never existed) — report current state.
    const { data: existing } = await admin
      .from("shop_order")
      .select("id, status, total_cents, currency, placed_at, created_at, stripe_payment_intent_id")
      .eq("id", id)
      .maybeSingle();
    return { ok: Boolean(existing), already: true, order: existing || null };
  }

  await drawDownStock(admin, id);

  // Only the caller that actually flipped the row sends the confirmation, so
  // the webhook and the client-side confirm cannot both email the customer.
  if (opts.notify !== false) {
    await notifyOrderPaid(admin, id);
  }

  return { ok: true, already: false, order: claimed };
}

/** Best-effort stock decrement. A shortfall must never fail a paid order. */
export async function drawDownStock(admin, orderId) {
  const { data: items, error } = await admin
    .from("shop_order_item")
    .select("product_id, quantity")
    .eq("order_id", orderId);
  if (error || !items?.length) return;

  const wanted = new Map();
  for (const it of items) {
    const pid = Number(it.product_id);
    if (!Number.isFinite(pid) || pid <= 0) continue;
    wanted.set(pid, (wanted.get(pid) || 0) + Math.max(0, Number(it.quantity) || 0));
  }
  if (!wanted.size) return;

  const { data: rows } = await admin
    .from("shop_product")
    .select("id, stock_qty")
    .in("id", [...wanted.keys()]);

  for (const row of rows || []) {
    const next = Math.max(0, Number(row.stock_qty || 0) - (wanted.get(Number(row.id)) || 0));
    if (next === Number(row.stock_qty || 0)) continue;
    try {
      await admin
        .from("shop_product")
        .update({ stock_qty: next, updated_at: new Date().toISOString() })
        .eq("id", row.id);
    } catch {
      // stock is advisory here; the payment already succeeded
    }
  }
}

/** Public shape of a product row (+ its images). */
export function publicProduct(row, images = []) {
  const gallery = images
    .slice()
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((i) => ({ url: i.url, alt: i.alt || "" }))
    .filter((i) => i.url);
  const stock = Number(row.stock_qty ?? 0);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description || "",
    priceCents: Number(row.price_cents ?? 0),
    currency: (row.currency || "EUR").toUpperCase(),
    category: row.category || "other",
    skuCode: row.sku_code || null,
    stockQty: stock,
    inStock: stock > 0,
    lowStock: stock > 0 && stock <= 5,
    options: Array.isArray(row.options) ? row.options : [],
    images: gallery,
    image: gallery[0]?.url ?? null,
    createdAt: row.created_at ?? null,
  };
}

/** Group image rows by product id. */
export function groupImages(rows = []) {
  const map = new Map();
  for (const r of rows) {
    const key = Number(r.product_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return map;
}
