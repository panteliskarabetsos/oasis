// =====================================
// File: src/app/api/admin/payments/refund/route.js
// =====================================
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import Stripe from "stripe";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

async function requireAdmin() {
  const supa = await createSupabaseServer();
  if (!supa)
    return { error: true, response: bad("Server not configured", 500) };

  const { data, error } = await supa.auth.getUser();
  const user = data?.user;
  if (error || !user)
    return { error: true, response: bad("Unauthorized", 401) };

  const admin = createSupabaseAdmin();
  if (!admin)
    return { error: true, response: bad("Server not configured", 500) };

  const { data: profile } = await admin
    .from("User")
    .select("id, role, name, surname")
    .eq("auth_user_id", user.id)
    .single();

  const role =
    profile?.role ||
    user?.app_metadata?.role ||
    user?.user_metadata?.role ||
    "user";

  if (!["admin", "superadmin"].includes(role))
    return { error: true, response: bad("Forbidden", 403) };

  // Return more context for auditing
  return {
    error: false,
    admin,
    authUser: user,
    profile,
    role,
  };
}

function assertStripe() {
  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SK || "";
  if (!key) throw new Error("Stripe not configured");
  const stripe = new Stripe(key, {
    apiVersion: "2024-06-20",
  });
  return stripe;
}

// POST /api/admin/payments/refund
export async function POST(req) {
  const auth = await requireAdmin();
  if (auth.error) return auth.response;

  const { admin, authUser, profile, role } = auth; // role just for response/debug, not stored in DB

  let body;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON", 400);
  }

  const payment_intent = String(body?.payment_intent || "").trim();
  const charge = String(body?.charge || "").trim(); // optional fallback

  // Normalise amount to a number (cents)
  const rawAmount = body?.amount_cents;
  const amount_cents_raw =
    rawAmount === undefined || rawAmount === null
      ? undefined
      : Number(rawAmount);

  const reason = body?.reason; // 'duplicate' | 'fraudulent' | 'requested_by_customer'
  const metadata =
    body?.metadata && typeof body.metadata === "object"
      ? body.metadata
      : undefined;

  if (!payment_intent && !charge) {
    return bad("Provide payment_intent (preferred) or charge", 422);
  }

  if (
    amount_cents_raw !== undefined &&
    (!Number.isFinite(amount_cents_raw) ||
      !Number.isInteger(amount_cents_raw) ||
      amount_cents_raw <= 0)
  ) {
    return bad(
      "amount_cents must be a positive integer (in the smallest currency unit)",
      422
    );
  }

  try {
    const stripe = assertStripe();

    // Retrieve the target – prefer payment_intent logic (it handles multiple charges)
    let currency,
      amount_received_cents = 0,
      refunded_so_far_cents = 0,
      piIdForRefund = null,
      chargeIdForRefund = null;

    if (payment_intent) {
      const pi = await stripe.paymentIntents.retrieve(payment_intent);
      if (!pi) return bad("Payment Intent not found", 404);

      currency = (pi.currency || "").toUpperCase();
      // amount_received is the amount actually collected
      amount_received_cents = Number(pi.amount_received || 0);
      piIdForRefund = pi.id;

      // Sum refunds across the PI (paginate just in case)
      refunded_so_far_cents = await sumRefundsForPaymentIntent(stripe, pi.id);

      if (!amount_received_cents) {
        return bad("Nothing received on this Payment Intent to refund", 409);
      }
    } else {
      // charge fallback
      const ch = await stripe.charges.retrieve(charge);
      if (!ch) return bad("Charge not found", 404);

      currency = (ch.currency || "").toUpperCase();
      amount_received_cents = Number(ch.amount_captured || ch.amount || 0);
      chargeIdForRefund = ch.id;

      // Stripe’s charge has amount_refunded on it
      refunded_so_far_cents = Number(ch.amount_refunded || 0);
      if (!amount_received_cents) {
        return bad("Nothing captured on this Charge to refund", 409);
      }
    }

    const refundable_cents = Math.max(
      0,
      amount_received_cents - refunded_so_far_cents
    );
    if (refundable_cents <= 0) {
      return bad("Already fully refunded", 409);
    }

    const amount_cents =
      amount_cents_raw === undefined ? refundable_cents : amount_cents_raw;

    if (amount_cents > refundable_cents) {
      return bad(
        `Amount exceeds refundable remainder (${refundable_cents} ${currency} cents)`,
        422
      );
    }

    // Admin metadata for Stripe + DB (only keys that exist in DB or Stripe metadata)
    const adminMetadata = {
      performed_by_auth_user_id: authUser.id,
      performed_by_user_id: profile?.id ?? null,
      performed_by_email: authUser.email ?? "",
    };

    const mergedMetadata = {
      ...(metadata || {}),
      ...adminMetadata,
    };

    // Create refund – prefer `payment_intent` param when available
    const createParams = {
      ...(piIdForRefund
        ? { payment_intent: piIdForRefund }
        : { charge: chargeIdForRefund }),
      amount: amount_cents,
      ...(reason ? { reason } : {}),
      ...(mergedMetadata ? { metadata: mergedMetadata } : {}),
    };

    const refund = await stripe.refunds.create(createParams);

    // --- Audit log in DB: payment_refund ---
    try {
      let bookingId = null;
      let invoiceId = null;

      // Link by payment_intent when possible
      const lookupPiId = piIdForRefund || null;

      if (lookupPiId) {
        const { data: bookingRow } = await admin
          .from("booking")
          .select("id")
          .eq("stripePaymentIntentId", lookupPiId)
          .maybeSingle();

        bookingId = bookingRow?.id ?? null;

        const { data: invoiceRow } = await admin
          .from("invoice")
          .select("id")
          .eq("stripe_payment_intent_id", lookupPiId)
          .maybeSingle();

        invoiceId = invoiceRow?.id ?? null;
      }

      const performedByName =
        profile?.name || profile?.surname
          ? [profile?.name, profile?.surname].filter(Boolean).join(" ")
          : authUser.user_metadata?.full_name ||
            authUser.user_metadata?.name ||
            null;

      const { error: auditError } = await admin.from("payment_refund").insert({
        booking_id: bookingId,
        invoice_id: invoiceId,
        // payment_id can be filled later if/when you wire it
        stripe_payment_intent_id: lookupPiId || payment_intent || null,
        stripe_refund_id: refund.id,
        amount_cents: refund.amount,
        currency: currency || (refund.currency || "").toUpperCase(),
        reason: refund.reason || reason || null,
        notes: null,
        performed_by_auth_user_id: authUser.id,
        performed_by_user_id: profile?.id ?? null,
        performed_by_email: authUser.email ?? null,
        performed_by_name: performedByName,
      });

      if (auditError) {
        console.error("Failed to record payment_refund audit row", auditError);
      }
    } catch (auditEx) {
      // Don't break the API if audit logging fails – refund already exists in Stripe
      console.error("payment_refund audit logging failed", auditEx);
    }

    return ok({
      refund,
      summary: {
        payment_intent: piIdForRefund,
        charge: chargeIdForRefund,
        currency,
        amount_cents,
        refundable_before_cents: refundable_cents,
        refundable_after_cents: refundable_cents - amount_cents,
        refunded_total_cents: refunded_so_far_cents + amount_cents,
        amount_received_cents,
        admin: {
          performed_by_auth_user_id: authUser.id,
          performed_by_user_id: profile?.id ?? null,
          performed_by_email: authUser.email ?? "",
          role, // only in response, not stored in DB
        },
      },
    });
  } catch (e) {
    const msg = e?.raw?.message || e?.message || "Refund failed";
    const code =
      e?.statusCode && Number.isInteger(e.statusCode) ? e.statusCode : 500;
    console.error("/api/admin/payments/refund POST error", e);
    return bad(msg, code);
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

/* ---------------------------- helpers ---------------------------- */
async function sumRefundsForPaymentIntent(stripe, paymentIntentId) {
  let total = 0;
  let starting_after;

  // walk through pages (unlikely to have many, but safe)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await stripe.refunds.list({
      payment_intent: paymentIntentId,
      limit: 100,
      ...(starting_after ? { starting_after } : {}),
    });

    for (const r of page.data || []) {
      total += Number(r.amount || 0);
    }

    if (page.has_more && page.data?.length) {
      starting_after = page.data[page.data.length - 1].id;
    } else {
      break;
    }
  }

  return total;
}
