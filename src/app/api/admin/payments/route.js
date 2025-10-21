// app/api/admin/payments/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function GET(req) {
  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return bad("Missing STRIPE_SECRET_KEY", 500);

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

    const { searchParams } = new URL(req.url);
    const starting_after = searchParams.get("starting_after") || undefined;
    const date_from = searchParams.get("date_from");
    const date_to = searchParams.get("date_to");
    const status = searchParams.get("status") || "any";
    const stripe_account = searchParams.get("stripe_account") || undefined; // for Connect

    // date filter → Stripe expects unix seconds
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

    const opt = stripe_account ? { stripeAccount: stripe_account } : undefined;

    const res = await stripe.paymentIntents.list(
      {
        limit: 50,
        ...(created ? { created } : {}),
        ...(starting_after ? { starting_after } : {}),
        expand: [
          "data.customer",
          "data.latest_charge",
          "data.latest_charge.refunds",
        ],
      },
      opt
    );

    // optional status filter
    const items = res.data
      .filter((pi) => (status === "any" ? true : pi.status === status))
      .map((pi) => ({
        id: pi.id,
        created: pi.created,
        status: pi.status,
        amount: pi.amount,
        amount_received: pi.amount_received,
        currency: pi.currency,
        customer: {
          id:
            typeof pi.customer === "string"
              ? pi.customer
              : pi.customer?.id ?? null,
          email:
            (typeof pi.customer === "object" ? pi.customer?.email : null) ||
            (typeof pi.latest_charge === "object"
              ? pi.latest_charge?.billing_details?.email
              : null) ||
            null,
          name:
            (typeof pi.customer === "object" ? pi.customer?.name : null) ||
            (typeof pi.latest_charge === "object"
              ? pi.latest_charge?.billing_details?.name
              : null) ||
            null,
        },
        latest_charge:
          typeof pi.latest_charge === "string"
            ? pi.latest_charge
            : pi.latest_charge?.id ?? null,
        receipt_url:
          typeof pi.latest_charge === "object"
            ? pi.latest_charge?.receipt_url ?? null
            : null,
      }));

    return ok({
      items,
      has_more: res.has_more,
      next_cursor: res.has_more && res.data.length ? res.data.at(-1).id : null,
      source: "payment_intents",
    });
  } catch (e) {
    console.error("payments:list error", e);
    return bad(e?.raw?.message || e?.message || "Failed to list payments", 500);
  }
}
