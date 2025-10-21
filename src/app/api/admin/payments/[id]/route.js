export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

const asId = (x) =>
  typeof x === "string" ? x : x && typeof x === "object" && x.id ? x.id : null;
const asObj = (x) => (x && typeof x === "object" ? x : null);

export async function GET(_req, context) {
  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return bad("Missing STRIPE_SECRET_KEY", 500);

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

    // IMPORTANT: await params
    const { id } = await context.params; // <- fix
    if (!id || !String(id).startsWith("pi_")) {
      return bad("Invalid payment id", 400);
    }

    const isTest = key.includes("_test_");
    const dashBase = isTest
      ? "https://dashboard.stripe.com/test"
      : "https://dashboard.stripe.com";

    const pi = await stripe.paymentIntents.retrieve(id, {
      expand: [
        "customer",
        "latest_charge",
        "latest_charge.refunds",
        "payment_method", // for pm.billing_details + pm.card
        "charges.data", // for first charge billing_details/card
      ],
    });

    // Enrich booking id (best-effort)
    let booking_id = null;
    try {
      const mod = await import("@/lib/supabase/admin").catch(() => null);
      const createSupabaseAdmin = mod?.createSupabaseAdmin;
      if (createSupabaseAdmin) {
        const admin = createSupabaseAdmin();

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
      }
    } catch {
      /* non-fatal */
    }

    if (!booking_id) {
      const metaBid = pi?.metadata?.booking_id ?? pi?.metadata?.bookingId;
      if (metaBid != null && !Number.isNaN(Number(metaBid))) {
        booking_id = Number(metaBid);
      }
    }

    const ch = asObj(pi.latest_charge);
    const pm = asObj(pi.payment_method);
    const firstCharge = pi?.charges?.data?.[0] || null;

    const customerObj = asObj(pi.customer);

    // Robust fallbacks for email/name
    const email =
      customerObj?.email ||
      ch?.billing_details?.email ||
      firstCharge?.billing_details?.email ||
      pm?.billing_details?.email ||
      null;

    const name =
      customerObj?.name ||
      ch?.billing_details?.name ||
      firstCharge?.billing_details?.name ||
      pm?.billing_details?.name ||
      null;

    // Method + card fallbacks
    const method =
      ch?.payment_method_details?.type ||
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

    const item = {
      id: pi.id,
      created: pi.created,
      status: pi.status,
      amount: pi.amount ?? null,
      amount_received: pi.amount_received ?? null,
      currency: pi.currency,
      customer: {
        id: asId(pi.customer),
        email,
        name,
      },
      method,
      card_brand: cardObj?.brand || null,
      card_last4: cardObj?.last4 || null,
      latest_charge: asId(pi.latest_charge),
      receipt_url: ch?.receipt_url || null,
      metadata: pi.metadata || {},
      refunds:
        ch?.refunds?.data?.map((r) => ({
          id: r.id,
          amount: r.amount,
          status: r.status,
          created: r.created,
        })) || [],
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
