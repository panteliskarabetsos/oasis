// src/app/api/admin/payments/[id]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

const asId = (x) =>
  typeof x === "string" ? x : x && typeof x === "object" && x.id ? x.id : null;

const asObj = (x) => (x && typeof x === "object" ? x : null);

const sum = (xs, f) =>
  Array.isArray(xs)
    ? xs.reduce((a, x) => a + (f ? f(x) : Number(x || 0)), 0)
    : 0;

/**
 * GET /api/admin/payments/[id]
 * Normalizes a Stripe PaymentIntent into a stable shape for the admin UI:
 * - item.refunds: flat list of refunds for this PI
 * - item.charges.data: simplified charges snapshot (with per-charge refunds)
 * - item.aggregates: amounts in smallest currency unit ("cents")
 * - item.links: dashboard URLs
 * - item.refunds[*].performed_by_*: admin who did the refund (from payment_refund)
 */
export async function GET(_req, context) {
  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return bad("Missing STRIPE_SECRET_KEY", 500);

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

    // Next 15: params can be async – always await
    const { id } = (await context.params) || {};
    if (!id || !String(id).startsWith("pi_")) {
      return bad("Invalid payment id", 400);
    }

    const isTest = key.includes("_test_");
    const dashBase = isTest
      ? "https://dashboard.stripe.com/test"
      : "https://dashboard.stripe.com";

    let pi;
    try {
      pi = await stripe.paymentIntents.retrieve(id, {
        expand: [
          "customer",
          "payment_method",
          "latest_charge",
          "latest_charge.balance_transaction",
          "charges.data",
          "charges.data.balance_transaction",
        ],
      });
    } catch (e) {
      if (e?.code === "resource_missing" || e?.statusCode === 404) {
        return bad("Payment not found", 404);
      }
      throw e;
    }

    const charges = Array.isArray(pi?.charges?.data) ? pi.charges.data : [];
    const firstCharge = charges[0] || asObj(pi.latest_charge) || null;

    // --- Fetch refunds directly from Stripe for this PaymentIntent ---
    const refundsList = await stripe.refunds.list({
      payment_intent: pi.id,
      limit: 100,
    });
    const allRefundsRaw = refundsList?.data || [];

    const refundsTotalCents = sum(allRefundsRaw, (r) => Number(r.amount || 0));

    // Compute robust received / captured
    const amountCapturedTotalCents = sum(charges, (c) =>
      Number(c?.amount_captured ?? c?.amount ?? 0)
    );

    const amountReceivedCents =
      pi?.amount_received != null
        ? Number(pi.amount_received)
        : amountCapturedTotalCents;

    const netCents = Math.max(0, amountReceivedCents - refundsTotalCents);

    // Derive method + card
    const pm = asObj(pi.payment_method);
    const customerObj = asObj(pi.customer);
    const ch = asObj(pi.latest_charge);

    const email =
      customerObj?.email ||
      ch?.billing_details?.email ||
      firstCharge?.billing_details?.email ||
      pm?.billing_details?.email ||
      pi?.receipt_email ||
      null;

    const name =
      customerObj?.name ||
      ch?.billing_details?.name ||
      firstCharge?.billing_details?.name ||
      pm?.billing_details?.name ||
      null;

    const method =
      ch?.payment_method_details?.type ||
      firstCharge?.payment_method_details?.type ||
      pm?.type ||
      (Array.isArray(pi.payment_method_types)
        ? pi.payment_method_types[0]
        : null) ||
      "card";

    const cardObj =
      ch?.payment_method_details?.card ||
      firstCharge?.payment_method_details?.card ||
      pm?.card ||
      null;

    // --- Supabase lookups (booking_id + refund audit info) ---
    let booking_id = null;
    let refundAuditRows = [];

    try {
      const mod = await import("@/lib/supabase/admin").catch(() => null);
      const createSupabaseAdmin = mod?.createSupabaseAdmin;
      if (createSupabaseAdmin) {
        const admin = createSupabaseAdmin();

        // Try to find related booking id (best-effort; non-fatal)
        const { data: b } = await admin
          .from("Booking")
          .select("id, stripePaymentIntentId")
          .eq("stripePaymentIntentId", pi.id)
          .limit(1)
          .maybeSingle();
        if (b?.id) booking_id = b.id;

        if (!booking_id) {
          const { data: d } = await admin
            .from("BookingDraft")
            .select("convertedBookingId, stripePaymentIntentId")
            .eq("stripePaymentIntentId", pi.id)
            .not("convertedBookingId", "is", null)
            .limit(1)
            .maybeSingle();
          if (d?.convertedBookingId) booking_id = d.convertedBookingId;
        }

        // Load refund audit rows from payment_refund
        const { data: auditData, error: auditError } = await admin
          .from("payment_refund")
          .select(
            "stripe_refund_id, performed_by_email, performed_by_name, performed_by_auth_user_id, performed_by_user_id, created_at"
          )
          .eq("stripe_payment_intent_id", pi.id);

        if (auditError) {
          console.error(
            "[payment:detail] failed to load payment_refund audit rows",
            auditError
          );
        } else if (auditData) {
          refundAuditRows = auditData;
        }
      }
    } catch (e) {
      // non-fatal
      console.error("[payment:detail] Supabase lookup error", e);
    }

    if (!booking_id) {
      const metaBid = pi?.metadata?.booking_id ?? pi?.metadata?.bookingId;
      if (metaBid != null && !Number.isNaN(Number(metaBid))) {
        booking_id = Number(metaBid);
      }
    }

    // Build index of audit rows by Stripe refund id
    const auditIndex = Object.fromEntries(
      (refundAuditRows || []).map((r) => [r.stripe_refund_id, r])
    );

    // Map refunds into a clean, flat structure for the UI
    const allRefunds = allRefundsRaw.map((r) => {
      const audit = auditIndex[r.id] || {};
      const meta = r.metadata || {};

      return {
        id: r.id,
        amount: Number(r.amount ?? 0),
        status: r.status,
        created: r.created,
        currency: r.currency,
        reason: r.reason || meta.reason || null,
        charge: r.charge || null,

        // NEW: admin info (DB first, then Stripe metadata as fallback)
        performed_by_email:
          audit.performed_by_email || meta.performed_by_email || null,
        performed_by_name:
          audit.performed_by_name || meta.performed_by_name || null,
        performed_by_auth_user_id:
          audit.performed_by_auth_user_id ||
          meta.performed_by_auth_user_id ||
          null,
        performed_by_user_id:
          audit.performed_by_user_id || meta.performed_by_user_id || null,
      };
    });

    // Simplified charges snapshot with per-charge refunds
    const chargesSimple = charges.map((c) => {
      const chargeRefunds = allRefunds.filter((r) => r.charge === c.id);
      return {
        id: c.id,
        amount: Number(c.amount ?? 0),
        amount_captured: Number(c.amount_captured ?? c.amount ?? 0),
        currency: c.currency,
        paid: !!c.paid,
        status: c.status,
        created: c.created,
        refunds: chargeRefunds.map((r) => ({
          id: r.id,
          amount: r.amount,
          status: r.status,
          created: r.created,
          currency: r.currency,
          reason: r.reason,
          performed_by_email: r.performed_by_email,
          performed_by_name: r.performed_by_name,
          performed_by_auth_user_id: r.performed_by_auth_user_id,
          performed_by_user_id: r.performed_by_user_id,
        })),
        receipt_url: c?.receipt_url || null,
      };
    });

    // Item shape (backwards compatible fields + normalized aggregates)
    const item = {
      id: pi.id,
      created: pi.created,
      status: pi.status,
      amount: pi.amount ?? null, // intended amount (minor units)
      amount_received: amountReceivedCents, // minor units
      currency: pi.currency,
      livemode: !!pi.livemode,
      customer: {
        id: asId(pi.customer),
        email,
        name,
      },
      method,
      card_brand: cardObj?.brand || null,
      card_last4: cardObj?.last4 || null,
      latest_charge: asId(pi.latest_charge),
      receipt_url: ch?.receipt_url || firstCharge?.receipt_url || null,
      metadata: pi.metadata || {},

      // FLAT list of refunds used by BookingPricingEditor
      refunds: allRefunds,

      // Include charges (so existing UI fallbacks still work)
      charges: { data: chargesSimple },

      // Aggregates your UI can rely on (all in minor units – "cents")
      aggregates: {
        amount_intended_cents: Number(pi.amount ?? 0),
        amount_received_cents: amountReceivedCents,
        amount_captured_total_cents: amountCapturedTotalCents,
        refunds_total_cents: refundsTotalCents,
        net_cents: netCents,
        available_to_refund_cents: netCents,
        currency: (pi.currency || "").toUpperCase(),
        succeeded: String(pi.status || "").toLowerCase() === "succeeded",
      },

      booking_id,
      links: {
        dashboard_payment: `${dashBase}/payments/${
          asId(pi.latest_charge) || pi.id
        }`,
        dashboard_pi: `${dashBase}/payment_intents/${pi.id}`,
        dashboard_charge: ch?.id ? `${dashBase}/payments/${ch.id}` : null,
      },
    };

    return ok({ item });
  } catch (e) {
    console.error("[payment:detail] error", e);
    return bad(e?.raw?.message || e?.message || "Failed to fetch payment", 500);
  }
}
