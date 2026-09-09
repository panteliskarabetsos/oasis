// Folder: src/app/api/admin/shop/orders/[id]/refund/route.js
// Returns money for an e-shop order. Refunds move real money, so this needs the
// "payments" permission rather than plain e-shop access — the same bar the
// booking refund route holds.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin, accessCan } from "@/lib/auth/requireAdmin";
import { getStripe } from "@/lib/stripe/server";
import { actorFor, isMissingSchema, logEvent, sumRefunds } from "@/lib/shop/orders";
import { notifyOrder } from "@/lib/shop/notify";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

const REASONS = new Set(["requested_by_customer", "duplicate", "fraudulent"]);

export async function POST(req, { params }) {
  const auth = await requireAdmin("eshop");
  if (!auth.ok) return auth.response;
  if (!accessCan(auth.permissions, "payments")) {
    return bad("You do not have permission to issue refunds", 403);
  }

  const admin = createSupabaseAdmin();
  const id = Number(params?.id);
  if (!Number.isFinite(id) || id <= 0) return bad("Invalid id");

  let body = {};
  try {
    body = (await req.json()) || {};
  } catch {
    // an empty body means "refund what is left"
  }

  try {
    const { data: order, error } = await admin
      .from("shop_order")
      .select("id, status, total_cents, currency, stripe_payment_intent_id")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!order) return bad("Order not found", 404);
    if (!order.stripe_payment_intent_id) {
      return bad("This order has no card payment to refund", 409);
    }

    const stripe = getStripe();
    const pi = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
    const received = Number(pi?.amount_received || 0);
    if (!received) return bad("Nothing was ever captured on this order", 409);

    const already = await sumRefunds(stripe, pi.id);
    const remaining = Math.max(0, received - already);
    if (remaining <= 0) return bad("This order is already fully refunded", 409);

    const requested =
      body.amount_cents === undefined || body.amount_cents === null
        ? remaining
        : Math.round(Number(body.amount_cents));
    if (!Number.isInteger(requested) || requested <= 0) {
      return bad("Enter a refund amount greater than zero");
    }
    if (requested > remaining) {
      return bad(
        `That is more than the ${(remaining / 100).toFixed(2)} ${(
          pi.currency || "eur"
        ).toUpperCase()} still refundable on this order`,
        422
      );
    }

    const reason = REASONS.has(body.reason) ? body.reason : "requested_by_customer";
    const note = String(body.note || "").trim();

    const refund = await stripe.refunds.create({
      payment_intent: pi.id,
      amount: requested,
      reason,
      metadata: {
        shop_order_id: String(id),
        performed_by: auth.user?.email || "",
      },
    });

    const refundedTotal = already + requested;
    const fullyRefunded = refundedTotal >= received;

    // Mirror the total so lists do not have to call Stripe. A missing column
    // (migration not run) must not fail a refund that already went through.
    const patch = { refunded_cents: refundedTotal };
    if (fullyRefunded) patch.status = "refunded";
    const { error: upErr } = await admin.from("shop_order").update(patch).eq("id", id);
    if (upErr && !isMissingSchema(upErr)) {
      console.error("[shop refund] could not mirror refund total", upErr);
    } else if (upErr && fullyRefunded) {
      // At least record the status, which predates this migration.
      await admin.from("shop_order").update({ status: "refunded" }).eq("id", id);
    }

    const actor = await actorFor(admin, auth.user);
    const amountLabel = `${(requested / 100).toFixed(2)} ${(
      refund.currency || "eur"
    ).toUpperCase()}`;
    await logEvent(admin, id, {
      type: "refund",
      message: `Refunded ${amountLabel}${fullyRefunded ? " (order fully refunded)" : ""}${
        note ? ` — ${note}` : ""
      }`,
      meta: {
        refund_id: refund.id,
        amount_cents: requested,
        reason,
        refunded_total_cents: refundedTotal,
      },
      ...actor,
    });

    // Each refund is its own message, so partial refunds each get one.
    await notifyOrder(admin, id, "refunded", {
      actorEmail: auth.user?.email,
      extra: { amountCents: requested, refundedCents: refundedTotal },
    });

    return ok({
      refund: {
        id: refund.id,
        amountCents: requested,
        currency: (refund.currency || "eur").toUpperCase(),
        status: refund.status,
        reason,
      },
      refundedTotalCents: refundedTotal,
      remainingCents: Math.max(0, received - refundedTotal),
      status: fullyRefunded ? "refunded" : order.status,
    });
  } catch (e) {
    const msg = e?.raw?.message || e?.message || "Refund failed";
    const code = Number.isInteger(e?.statusCode) ? e.statusCode : 500;
    console.error("[shop refund] error", e);
    return bad(msg, code);
  }
}
