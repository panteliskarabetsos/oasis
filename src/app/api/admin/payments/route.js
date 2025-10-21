// app/api/admin/payments/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

/* ----------------------------- helpers ----------------------------- */
const asId = (x) =>
  typeof x === "string" ? x : x && typeof x === "object" && x.id ? x.id : null;

const asObj = (x) => (x && typeof x === "object" ? x : null);

const getChargeObj = (pi) => asObj(pi?.latest_charge) || null;

const getCardFromPI = (pi, ch) =>
  ch?.payment_method_details?.card ||
  pi?.charges?.data?.[0]?.payment_method_details?.card ||
  null;

const getCustomerEmailFromPI = (pi, ch) => {
  const cust = asObj(pi?.customer);
  if (cust?.email) return cust.email;
  // receipt_email at PI level (rare on Checkout, but just in case)
  if (pi?.receipt_email) return pi.receipt_email;
  return ch?.billing_details?.email || null;
};

const getCustomerNameFromPI = (pi, ch) => {
  const cust = asObj(pi?.customer);
  if (cust?.name) return cust.name;
  return ch?.billing_details?.name || null;
};

const cents = (v) => (typeof v === "number" ? v : null);

/* ------------------------------ mappers ----------------------------- */
function mapPI(pi) {
  const ch = getChargeObj(pi);
  const card = getCardFromPI(pi, ch);

  return {
    id: pi.id,
    created: pi.created, // unix seconds
    status: pi.status, // 'succeeded' | 'requires_payment_method' | ...
    amount: cents(pi.amount), // intended amount in cents
    amount_received: cents(pi.amount_received), // captured amount in cents
    currency: pi.currency, // e.g. 'eur'

    customer: {
      id: asId(pi.customer), // string | null
      email: getCustomerEmailFromPI(pi, ch), // string | null
      name: getCustomerNameFromPI(pi, ch), // string | null
    },

    method: ch?.payment_method_details?.type || "card",
    card_brand: card?.brand || null,
    card_last4: card?.last4 || null,

    latest_charge: asId(pi.latest_charge), // string | null
    receipt_url: ch?.receipt_url || null,

    metadata: pi.metadata || {},

    refunds:
      ch?.refunds?.data?.map((r) => ({
        id: r.id,
        amount: cents(r.amount),
        status: r.status,
        created: r.created,
      })) || [],
  };
}

function mapCharge(c) {
  const cust = asObj(c.customer);
  const card = c.payment_method_details?.card || null;

  return {
    id: c.payment_intent || c.id, // prefer PI id; fall back to charge id
    created: c.created, // unix seconds
    status: c.status, // charge status
    amount: cents(c.amount),
    amount_received: cents(c.amount_captured ?? c.amount),
    currency: c.currency,

    customer: {
      id: asId(c.customer),
      email: c.billing_details?.email || cust?.email || null,
      name: c.billing_details?.name || cust?.name || null,
    },

    method: c.payment_method_details?.type || "card",
    card_brand: card?.brand || null,
    card_last4: card?.last4 || null,

    latest_charge: c.id,
    receipt_url: c.receipt_url || null,

    metadata: c.metadata || {},

    refunds:
      c.refunds?.data?.map((r) => ({
        id: r.id,
        amount: cents(r.amount),
        status: r.status,
        created: r.created,
      })) || [],
  };
}

/* -------------------------------- route ----------------------------- */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim(); // free-text for Search API
    const status = searchParams.get("status") || "any"; // e.g. 'succeeded', 'processing', 'requires_payment_method', 'any'
    const date_from = searchParams.get("date_from"); // YYYY-MM-DD
    const date_to = searchParams.get("date_to"); // YYYY-MM-DD
    const starting_after = searchParams.get("starting_after") || undefined;
    const stripe_account = searchParams.get("stripe_account") || undefined; // Connect acct_*

    const key = process.env.STRIPE_SECRET_KEY || "";
    if (!key)
      return bad("Stripe not configured: missing STRIPE_SECRET_KEY", 500);

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

    // Build created range (only if provided)
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

    // Connect request options (platform vs connected account)
    const opt = stripe_account ? { stripeAccount: stripe_account } : undefined;

    // ---- Primary: PaymentIntents (search or list) ----
    let out;
    if (q) {
      // Search API — note slight read-after-write delay
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
        ...(created ? { created } : {}),
        ...(starting_after ? { starting_after } : {}),
        expand: [
          "data.customer",
          "data.latest_charge",
          "data.latest_charge.refunds",
        ],
      };

      out = await stripe.paymentIntents.list(listParams, opt);

      // Optional client-side filter by status (Stripe list doesn't filter by status directly)
      if (status !== "any") {
        out.data = out.data.filter((pi) => pi.status === status);
      }
    }

    // Map results (resilient to unexpected shapes)
    let items = out.data
      .map((pi) => {
        try {
          return mapPI(pi);
        } catch (e) {
          console.error("[payments:list] mapPI error for", pi?.id, e);
          return null;
        }
      })
      .filter(Boolean);

    // ---- Fallback: Charges (older flows / non-PI payments) ----
    if (!q && items.length === 0) {
      const chargesParams = {
        limit: 50,
        ...(created ? { created } : {}),
        ...(starting_after ? { starting_after } : {}),
        expand: ["data.refunds", "data.balance_transaction", "data.customer"],
      };
      const charges = await stripe.charges.list(chargesParams, opt);
      const chargeItems = charges.data
        .map((c) => {
          try {
            return mapCharge(c);
          } catch (e) {
            console.error("[payments:list] mapCharge error for", c?.id, e);
            return null;
          }
        })
        .filter(Boolean);

      return ok({
        items: chargeItems,
        has_more: charges.has_more,
        next_cursor:
          charges.has_more && charges.data.length
            ? charges.data[charges.data.length - 1].id
            : null,
        source: "charges",
      });
    }

    // ---- Normal PaymentIntent response ----
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
    const msg = e?.raw?.message || e?.message || "Failed to list payments";
    console.error("[payments:list] error:", e);
    return bad(msg, 500);
  }
}
