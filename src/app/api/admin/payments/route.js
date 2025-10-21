// app/api/admin/payments/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

// small null-safe helpers
const asId = (x) =>
  typeof x === "string" ? x : x && typeof x === "object" && x.id ? x.id : null;
const asObj = (x) => (x && typeof x === "object" ? x : null);

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

    // Fetch PaymentIntents (expand to get charge + refunds + customer)
    const res = await stripe.paymentIntents.list(
      {
        limit: 50,
        ...(created ? { created } : {}),
        ...(starting_after ? { starting_after } : {}),
        expand: [
          "data.customer",
          "data.latest_charge",
          "data.latest_charge.refunds",
          "data.payment_method",
          "data.charges.data",
        ],
      },
      opt
    );

    // Build a lookup of PI id -> booking id from your DB (best-effort)
    const piIds = (res.data || []).map((pi) => pi.id).filter(Boolean);
    const bookingByPiId = new Map();

    try {
      // Lazy import your Supabase admin helper (adjust path if needed)
      const mod = await import("@/lib/supabase/admin").catch(() => null);
      const createSupabaseAdmin = mod?.createSupabaseAdmin;
      if (createSupabaseAdmin && piIds.length) {
        const admin = createSupabaseAdmin();

        // Look up bookings by stripePaymentIntentId
        const { data: bookings, error: bErr } = await admin
          .from("Booking")
          .select("id, stripePaymentIntentId")
          .in("stripePaymentIntentId", piIds);

        if (!bErr && Array.isArray(bookings)) {
          for (const b of bookings) {
            if (b.stripePaymentIntentId) {
              bookingByPiId.set(b.stripePaymentIntentId, b.id);
            }
          }
        }

        // Optional: if drafts retain the PI before conversion, fill gaps from there
        const { data: drafts, error: dErr } = await admin
          .from("BookingDraft")
          .select("convertedBookingId, stripePaymentIntentId")
          .in("stripePaymentIntentId", piIds)
          .not("convertedBookingId", "is", null);

        if (!dErr && Array.isArray(drafts)) {
          for (const d of drafts) {
            if (d.stripePaymentIntentId && d.convertedBookingId) {
              if (!bookingByPiId.has(d.stripePaymentIntentId)) {
                bookingByPiId.set(
                  d.stripePaymentIntentId,
                  d.convertedBookingId
                );
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn(
        "[payments:list] booking enrichment failed:",
        e?.message || e
      );
      // Non-fatal: we still return payments without booking_id if enrichment fails
    }

    // Map to the shape your frontend expects
    const items = res.data
      .filter((pi) => (status === "any" ? true : pi.status === status))
      .map((pi) => {
        const ch =
          typeof pi.latest_charge === "object" ? pi.latest_charge : null;
        const pm =
          typeof pi.payment_method === "object" ? pi.payment_method : null;
        const firstCharge = pi?.charges?.data?.[0] || null;

        // ---- CUSTOMER EMAIL / NAME fallbacks ----
        const customerObj =
          typeof pi.customer === "object" ? pi.customer : null;

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

        // ---- METHOD + CARD INFO fallbacks ----
        // method: prefer details on latest charge; fall back to attached PM type; then PI’s declared types
        const method =
          ch?.payment_method_details?.type ||
          pm?.type ||
          (Array.isArray(pi.payment_method_types)
            ? pi.payment_method_types[0]
            : null) ||
          "card";

        // card details: prefer the object that actually has card fields
        const cardObj =
          ch?.payment_method_details?.card ||
          firstCharge?.payment_method_details?.card ||
          pm?.card ||
          null;

        const card_brand = cardObj?.brand || null;
        const card_last4 = cardObj?.last4 || null;

        // ---- BOOKING ID (DB first, then metadata) ----
        let booking_id =
          bookingByPiId.get(pi.id) ??
          pi?.metadata?.booking_id ??
          pi?.metadata?.bookingId ??
          null;

        if (booking_id != null && !Number.isNaN(Number(booking_id))) {
          booking_id = Number(booking_id);
        }

        return {
          id: pi.id,
          created: pi.created, // unix seconds
          status: pi.status,
          amount: pi.amount ?? null,
          amount_received: pi.amount_received ?? null,
          currency: pi.currency,
          customer: {
            id:
              typeof pi.customer === "string"
                ? pi.customer
                : customerObj?.id ?? null,
            email,
            name,
          },
          method,
          card_brand,
          card_last4,
          latest_charge:
            typeof pi.latest_charge === "string"
              ? pi.latest_charge
              : ch?.id ?? null,
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
        };
      });

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
