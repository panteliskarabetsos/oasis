// Folder: src/app/api/admin/shop/orders/[id]/route.js
// Everything the order page shows: the order, its lines (with the product they
// point at), the timeline, and what Stripe knows about the payment.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin, accessCan } from "@/lib/auth/requireAdmin";
import { getStripe } from "@/lib/stripe/server";
import {
  MIGRATION_HINT,
  actorFor,
  isMissingSchema,
  logEvent,
} from "@/lib/shop/orders";

const ok7 = (d, s = 200) => NextResponse.json(d, { status: s });
const bad7 = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

const BASE_COLUMNS =
  "id, user_id, status, total_cents, currency, stripe_session_id, stripe_payment_intent_id, billing_address, shipping_address, placed_at, created_at";
const OPS_COLUMNS = ", refunded_cents, tracking_number, tracking_url, internal_note";

export async function GET(_req, { params }) {
  const auth = await requireAdmin("eshop");
  if (!auth.ok) return auth.response;
  const supabase = createSupabaseAdmin();
  const id = Number(params?.id);
  if (!Number.isFinite(id) || id <= 0) return bad7("Invalid id");

  try {
    // Fall back to the pre-migration column set rather than failing outright.
    let migrated = true;
    let { data: order, error: oErr } = await supabase
      .from("shop_order")
      .select(BASE_COLUMNS + OPS_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (oErr && isMissingSchema(oErr)) {
      migrated = false;
      ({ data: order, error: oErr } = await supabase
        .from("shop_order")
        .select(BASE_COLUMNS)
        .eq("id", id)
        .maybeSingle());
    }
    if (oErr) throw oErr;
    if (!order) return bad7("Order not found", 404);

    const { data: items, error: iErr } = await supabase
      .from("shop_order_item")
      .select("id, order_id, product_id, quantity, unit_price_cents, currency, title_snapshot")
      .eq("order_id", id)
      .order("id");
    if (iErr) throw iErr;

    // Attach the live product so staff can jump to it (it may have been
    // renamed or retired since the order was placed — the snapshot stands).
    const productIds = [...new Set((items || []).map((l) => l.product_id).filter(Boolean))];
    const products = {};
    if (productIds.length) {
      const { data: rows } = await supabase
        .from("shop_product")
        .select("id, slug, title, active")
        .in("id", productIds);
      for (const r of rows || []) products[r.id] = r;

      const { data: imgs } = await supabase
        .from("shop_image")
        .select("product_id, url, sort")
        .in("product_id", productIds)
        .order("sort", { ascending: true });
      for (const img of imgs || []) {
        const p = products[img.product_id];
        if (p && !p.image) p.image = img.url;
      }
    }

    let events = [];
    let eventsAvailable = migrated;
    if (migrated) {
      const { data: evs, error: eErr } = await supabase
        .from("shop_order_event")
        .select("id, type, message, meta, created_by_email, created_by_name, created_at")
        .eq("order_id", id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (eErr) {
        if (!isMissingSchema(eErr)) throw eErr;
        eventsAvailable = false;
      } else {
        events = evs || [];
      }
    }

    // Stripe is the source of truth for money; the DB mirror can lag.
    let payment = null;
    let refunds = [];
    const canSeeMoney = accessCan(auth.permissions, "payments");
    if (order.stripe_payment_intent_id) {
      try {
        const stripe = getStripe();
        const pi = await stripe.paymentIntents.retrieve(
          order.stripe_payment_intent_id,
          { expand: ["latest_charge"] }
        );
        const charge = pi?.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
        payment = {
          id: pi.id,
          status: pi.status,
          amountCents: Number(pi.amount || 0),
          amountReceivedCents: Number(pi.amount_received || 0),
          currency: (pi.currency || "eur").toUpperCase(),
          brand: charge?.payment_method_details?.card?.brand || null,
          last4: charge?.payment_method_details?.card?.last4 || null,
          receiptUrl: charge?.receipt_url || null,
          created: pi.created ? new Date(pi.created * 1000).toISOString() : null,
        };
        const list = await stripe.refunds.list({
          payment_intent: order.stripe_payment_intent_id,
          limit: 100,
        });
        refunds = (list.data || []).map((r) => ({
          id: r.id,
          amountCents: Number(r.amount || 0),
          currency: (r.currency || "eur").toUpperCase(),
          status: r.status,
          reason: r.reason || null,
          created: r.created ? new Date(r.created * 1000).toISOString() : null,
        }));
      } catch (e) {
        payment = { error: String(e?.message || e) };
      }
    }

    const refundedFromStripe = refunds.reduce((n, r) => n + (r.status === "failed" ? 0 : r.amountCents), 0);

    return ok7({
      order,
      items: items || [],
      products,
      events,
      eventsAvailable,
      migrationHint: eventsAvailable ? null : MIGRATION_HINT,
      payment,
      refunds,
      refundedCents: refundedFromStripe || Number(order.refunded_cents || 0),
      canRefund: canSeeMoney,
    });
  } catch (e) {
    return bad7(String(e?.message || e), 500);
  }
}

/** Fulfilment details and the internal note. */
export async function PATCH(req, { params }) {
  const auth = await requireAdmin("eshop");
  if (!auth.ok) return auth.response;
  const supabase = createSupabaseAdmin();
  const id = Number(params?.id);
  if (!Number.isFinite(id) || id <= 0) return bad7("Invalid id");

  try {
    const body = await req.json();
    const patch = {};
    if (body.tracking_number !== undefined)
      patch.tracking_number = String(body.tracking_number || "").trim() || null;
    if (body.tracking_url !== undefined)
      patch.tracking_url = String(body.tracking_url || "").trim() || null;
    if (body.internal_note !== undefined)
      patch.internal_note = String(body.internal_note || "");
    if (!Object.keys(patch).length) return bad7("Nothing to update");

    const { data, error } = await supabase
      .from("shop_order")
      .update(patch)
      .eq("id", id)
      .select("id, tracking_number, tracking_url, internal_note")
      .single();
    if (error) {
      if (isMissingSchema(error)) return bad7(MIGRATION_HINT, 409);
      throw error;
    }

    if (patch.tracking_number !== undefined) {
      const actor = await actorFor(supabase, auth.user);
      await logEvent(supabase, id, {
        type: "fulfilment",
        message: patch.tracking_number
          ? `Tracking set to ${patch.tracking_number}`
          : "Tracking removed",
        meta: { tracking_number: patch.tracking_number, tracking_url: patch.tracking_url },
        ...actor,
      });
    }

    return ok7({ order: data });
  } catch (e) {
    return bad7(String(e?.message || e), 500);
  }
}
