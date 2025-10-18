// app/api/admin/payments/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const status = searchParams.get("status") || "any";
    const date_from = searchParams.get("date_from"); // YYYY-MM-DD
    const date_to = searchParams.get("date_to"); // YYYY-MM-DD
    const starting_after = searchParams.get("starting_after") || undefined;
    const stripe_account = searchParams.get("stripe_account") || undefined; // optional Connect acct_

    const key = process.env.STRIPE_SECRET_KEY || "";
    if (!key)
      return bad("Stripe not configured: missing STRIPE_SECRET_KEY", 500);

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

    // Build created range only if user provided dates
    let created;
    if (date_from || date_to) {
      const gte = date_from
        ? Math.floor(new Date(date_from + "T00:00:00Z").getTime() / 1000)
        : undefined;
      const lte = date_to
        ? Math.floor(new Date(date_to + "T23:59:59Z").getTime() / 1000)
        : undefined;
      created = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
    }

    // Options for Connect (if used)
    const opt = stripe_account ? { stripeAccount: stripe_account } : undefined;

    // ---- Primary: PaymentIntents ----
    let out;
    if (q) {
      // Search API (note: has slight read-after-write delay)
      const clauses = [`"${q}"`];
      if (status !== "any") clauses.push(`status:"${status}"`);
      const query = clauses.join(" AND ");
      out = await stripe.paymentIntents.search(
        {
          query,
          limit: 50,
          expand: [
            "data.customer",
            "data.latest_charge",
            "data.latest_charge.refunds",
          ],
        },
        opt
      );
    } else {
      const listParams = {
        limit: 50,
        ...(created ? { created } : {}), // only apply date if provided
        ...(starting_after ? { starting_after } : {}),
        expand: [
          "data.customer",
          "data.latest_charge",
          "data.latest_charge.refunds",
        ],
      };
      out = await stripe.paymentIntents.list(listParams, opt);
      if (status !== "any")
        out.data = out.data.filter((pi) => pi.status === status);
    }

    let items = out.data.map(mapPI);

    // ---- Fallback: Charges (older flows / edge cases) ----
    if (!q && items.length === 0) {
      const listChargesParams = {
        limit: 50,
        ...(created ? { created } : {}),
        ...(starting_after ? { starting_after } : {}),
        expand: ["data.refunds", "data.balance_transaction", "data.customer"],
      };
      const charges = await stripe.charges.list(listChargesParams, opt);
      items = charges.data.map(mapCharge);
      return ok({
        items,
        has_more: charges.has_more,
        next_cursor:
          charges.has_more && charges.data.length
            ? charges.data[charges.data.length - 1].id
            : null,
        source: "charges",
      });
    }

    return ok({
      items,
      has_more: out.has_more,
      next_cursor:
        out.has_more && out.data.length
          ? out.data[out.data.length - 1].id
          : null,
      source: "payment_intents",
    });
  } catch (e) {
    // Bubble up a helpful error message for UI
    const msg = e?.raw?.message || e?.message || "Failed to list payments";
    console.error("[payments:list] error:", e);
    return bad(msg, 500);
  }
}

function mapPI(pi) {
  const ch = typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  const card =
    ch?.payment_method_details?.card ||
    pi.charges?.data?.[0]?.payment_method_details?.card;
  return {
    id: pi.id,
    created: pi.created,
    status: pi.status,
    amount: pi.amount ?? null,
    amount_received: pi.amount_received ?? null,
    currency: pi.currency,
    customer: {
      id: typeof pi.customer === "object" ? pi.customer.id : pi.customer,
      email:
        (typeof pi.customer === "object" ? pi.customer.email : null) ||
        ch?.billing_details?.email ||
        null,
      name:
        (typeof pi.customer === "object" ? pi.customer.name : null) ||
        ch?.billing_details?.name ||
        null,
    },
    method: ch?.payment_method_details?.type || "card",
    card_brand: card?.brand || null,
    card_last4: card?.last4 || null,
    latest_charge: ch?.id || null,
    metadata: pi.metadata || {},
    refunds:
      ch?.refunds?.data?.map((r) => ({
        id: r.id,
        amount: r.amount,
        status: r.status,
        created: r.created,
      })) || [],
  };
}

function mapCharge(c) {
  const card = c.payment_method_details?.card;
  return {
    id: c.payment_intent || c.id,
    created: c.created,
    status: c.status, // charge status
    amount: c.amount,
    amount_received: c.amount_captured || c.amount,
    currency: c.currency,
    customer: {
      id: typeof c.customer === "object" ? c.customer.id : c.customer,
      email:
        c.billing_details?.email ||
        (typeof c.customer === "object" ? c.customer.email : null),
      name:
        c.billing_details?.name ||
        (typeof c.customer === "object" ? c.customer.name : null),
    },
    method: c.payment_method_details?.type || "card",
    card_brand: card?.brand || null,
    card_last4: card?.last4 || null,
    latest_charge: c.id,
    metadata: c.metadata || {},
    refunds:
      c.refunds?.data?.map((r) => ({
        id: r.id,
        amount: r.amount,
        status: r.status,
        created: r.created,
      })) || [],
  };
}
