// Unified receipts ledger.
//
// A "receipt" in this business comes from three places and there was no single
// view of them:
//   • POS sales      -> public."Receipt"
//   • e-shop orders  -> public.shop_order
//   • booking payments taken by Stripe -> public.booking (stripePaymentIntentId)
//
// Rows are merged and de-duplicated on the Stripe payment intent, because a POS
// card sale writes both a Receipt row and carries the same intent as the payment.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { accessCan, requireAdmin } from "@/lib/auth/requireAdmin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** ISO bounds for an inclusive yyyy-mm-dd range. */
function bounds(from, to) {
  return {
    fromISO: from ? new Date(`${from}T00:00:00`).toISOString() : null,
    toISO: to ? new Date(`${to}T23:59:59.999`).toISOString() : null,
  };
}

export async function GET(req) {
  // Finance reviews the ledger; POS staff need to find and reprint their own
  // sales, so either permission opens this.
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  if (!accessCan(auth.permissions, "payments") && !accessCan(auth.permissions, "pos")) {
    return bad("Forbidden", 403);
  }

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") || "").trim().toLowerCase();
  const source = (sp.get("source") || "all").toLowerCase();
  const { fromISO, toISO } = bounds(sp.get("from"), sp.get("to"));
  const page = Math.max(1, Number(sp.get("page") || 1));
  const pageSize = Math.min(200, Math.max(5, Number(sp.get("pageSize") || 50)));

  const rows = [];

  /* ------------------------------ POS receipts ----------------------------- */
  if (source === "all" || source === "pos") {
    let qy = admin
      .from("Receipt")
      .select(
        'id, created_at, items, "totalPaidAmount", currency, "discountAmount", "paymentMethod", "paymentReference", "stripePaymentIntentId", "customerName", "customerEmail", "transactionType", "relatedBookingRef"',
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (fromISO) qy = qy.gte("created_at", fromISO);
    if (toISO) qy = qy.lte("created_at", toISO);

    const { data, error } = await qy;
    if (error) return bad(error.message || "Failed to load POS receipts", 500);

    for (const r of data || []) {
      rows.push({
        key: `pos-${r.id}`,
        id: r.id,
        source: "pos",
        reference: `R-${String(r.id).padStart(6, "0")}`,
        at: r.created_at,
        customerName: r.customerName || null,
        customerEmail: r.customerEmail || null,
        amount: num(r.totalPaidAmount),
        currency: (r.currency || "EUR").toUpperCase(),
        method: r.paymentMethod || null,
        stripePaymentIntentId: r.stripePaymentIntentId || null,
        status: "paid",
        lineCount: Array.isArray(r.items) ? r.items.length : 0,
        detailHref: `/admin/receipts/${r.id}`,
      });
    }
  }

  /* ------------------------------ e-shop orders ---------------------------- */
  if (source === "all" || source === "shop") {
    let qy = admin
      .from("shop_order")
      .select(
        "id, status, total_cents, currency, stripe_payment_intent_id, placed_at, created_at, billing_address",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (fromISO) qy = qy.gte("created_at", fromISO);
    if (toISO) qy = qy.lte("created_at", toISO);

    const { data, error } = await qy;
    if (error) return bad(error.message || "Failed to load shop orders", 500);

    for (const o of data || []) {
      const billing = o.billing_address && typeof o.billing_address === "object" ? o.billing_address : {};
      rows.push({
        key: `shop-${o.id}`,
        id: o.id,
        source: "shop",
        reference: `S-${String(o.id).padStart(6, "0")}`,
        at: o.placed_at || o.created_at,
        customerName: billing.name || null,
        customerEmail: billing.email || null,
        amount: num(o.total_cents) / 100,
        currency: (o.currency || "EUR").toUpperCase(),
        method: o.stripe_payment_intent_id ? "card" : null,
        stripePaymentIntentId: o.stripe_payment_intent_id || null,
        status: o.status || "pending",
        lineCount: null,
        detailHref: `/admin/eshop?order=${o.id}`,
      });
    }
  }

  /* -------------------- booking payments taken by Stripe ------------------- */
  if (source === "all" || source === "booking") {
    let qy = admin
      .from("booking")
      .select(
        'id, "createdAt", "totalPaidAmount", currency, "stripePaymentIntentId", primary_contact, status',
      )
      .not("stripePaymentIntentId", "is", null)
      .order("createdAt", { ascending: false })
      .limit(500);
    if (fromISO) qy = qy.gte("createdAt", fromISO);
    if (toISO) qy = qy.lte("createdAt", toISO);

    const { data, error } = await qy;
    if (error) return bad(error.message || "Failed to load booking payments", 500);

    for (const b of data || []) {
      const pc = b.primary_contact && typeof b.primary_contact === "object" ? b.primary_contact : {};
      rows.push({
        key: `booking-${b.id}`,
        id: b.id,
        source: "booking",
        reference: `BK-${String(b.id).padStart(6, "0")}`,
        at: b.createdAt,
        customerName: pc.name || [pc.firstName, pc.lastName].filter(Boolean).join(" ") || null,
        customerEmail: pc.email || null,
        amount: num(b.totalPaidAmount),
        currency: (b.currency || "EUR").toUpperCase(),
        method: "card",
        stripePaymentIntentId: b.stripePaymentIntentId || null,
        status: b.status || null,
        lineCount: null,
        detailHref: `/admin/bookings/${b.id}`,
      });
    }
  }

  /* --------------------------- merge and paginate -------------------------- */
  // A POS card sale carries the same intent as its payment, so keep the row
  // that has the richer detail page: POS receipt over booking over shop.
  const RANK = { pos: 0, shop: 1, booking: 2 };
  const byIntent = new Map();
  const merged = [];
  for (const r of rows.sort((a, b) => RANK[a.source] - RANK[b.source])) {
    const pi = r.stripePaymentIntentId;
    if (pi) {
      if (byIntent.has(pi)) continue;
      byIntent.set(pi, true);
    }
    merged.push(r);
  }

  const filtered = q
    ? merged.filter((r) =>
        [r.reference, r.customerName, r.customerEmail, r.stripePaymentIntentId, String(r.id)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
    : merged;

  filtered.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  const totals = filtered.reduce(
    (acc, r) => {
      acc.gross += r.amount || 0;
      acc.bySource[r.source] = (acc.bySource[r.source] || 0) + (r.amount || 0);
      return acc;
    },
    { gross: 0, bySource: {} },
  );

  return ok({ items, total, page, pageSize, totals });
}
