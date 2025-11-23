// app/api/admin/payments/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const ok  = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

// ----------------- tiny helpers -----------------
const asObj = (x) => (x && typeof x === "object" ? x : null);
const ilike = (s, q) => String(s || "").toLowerCase().includes(String(q || "").toLowerCase());

// currency helpers (for minor/major conversion if you need later)
const ZERO_DEC = new Set(["BIF","CLP","DJF","GNF","JPY","KMF","KRW","MGA","PYG","RWF","UGX","VND","VUV","XAF","XOF","XPF"]);

// build unix range from YYYY-MM-DD
function toUnixRange({ date_from, date_to }) {
  let created;
  if (date_from || date_to) {
    const gte = date_from ? Math.floor(new Date(date_from + "T00:00:00Z").getTime() / 1000) : undefined;
    const lte = date_to   ? Math.floor(new Date(date_to   + "T23:59:59Z").getTime() / 1000) : undefined;
    created = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
  }
  return created;
}

// --------------- main GET ----------------
export async function GET(req) {
  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return bad("Missing STRIPE_SECRET_KEY", 500);

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

    const { searchParams } = new URL(req.url);
    const kind = (searchParams.get("kind") || "payment_intents").toLowerCase();
    const status = (searchParams.get("status") || "any").toLowerCase();
    const starting_after = searchParams.get("starting_after") || undefined;
    const date_from = searchParams.get("date_from") || undefined;
    const date_to = searchParams.get("date_to") || undefined;
    const q = searchParams.get("q") || "";
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 100);
    const stripe_account = searchParams.get("stripe_account") || undefined; // for Connect
    const opt = stripe_account ? { stripeAccount: stripe_account } : undefined;

    const created = toUnixRange({ date_from, date_to });

    // ---------- optional booking enrichment (PI->Booking.id)
    const bookingByPiId = new Map();
    async function enrichBookingsByPi(piIds) {
      if (!piIds.length) return;
      try {
        const mod = await import("@/lib/supabase/admin").catch(() => null);
        const createSupabaseAdmin = mod?.createSupabaseAdmin;
        if (!createSupabaseAdmin) return;
        const admin = createSupabaseAdmin();

        const { data: bookings, error: bErr } = await admin
          .from("Booking")
          .select("id, stripePaymentIntentId")
          .in("stripePaymentIntentId", piIds);

        if (!bErr && Array.isArray(bookings)) {
          for (const b of bookings) {
            if (b.stripePaymentIntentId) bookingByPiId.set(b.stripePaymentIntentId, b.id);
          }
        }

        // Fill gaps from drafts that kept the PI then converted
        const { data: drafts, error: dErr } = await admin
          .from("BookingDraft")
          .select("convertedBookingId, stripePaymentIntentId")
          .in("stripePaymentIntentId", piIds)
          .not("convertedBookingId", "is", null);

        if (!dErr && Array.isArray(drafts)) {
          for (const d of drafts) {
            if (d.stripePaymentIntentId && d.convertedBookingId && !bookingByPiId.has(d.stripePaymentIntentId)) {
              bookingByPiId.set(d.stripePaymentIntentId, d.convertedBookingId);
            }
          }
        }
      } catch (e) {
        console.warn("[payments:list] booking enrichment failed:", e?.message || e);
      }
    }

    // ---------- LISTERS PER KIND ----------
    if (kind === "payment_intents") {
      const res = await stripe.paymentIntents.list(
        {
          limit,
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

      const piIds = res.data.map((pi) => pi.id).filter(Boolean);
      await enrichBookingsByPi(piIds);

      const items = res.data
        .filter((pi) => (status === "any" ? true : String(pi.status).toLowerCase() === status))
        .map((pi) => {
          const ch = asObj(pi.latest_charge);
          const pm = asObj(pi.payment_method);
          const firstCharge = pi?.charges?.data?.[0] || null;
          const customerObj = asObj(pi.customer);

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

          const method =
            ch?.payment_method_details?.type ||
            pm?.type ||
            (Array.isArray(pi.payment_method_types) ? pi.payment_method_types[0] : null) ||
            "card";

          const cardObj =
            ch?.payment_method_details?.card ||
            firstCharge?.payment_method_details?.card ||
            pm?.card ||
            null;

          const card_brand = cardObj?.brand || null;
          const card_last4 = cardObj?.last4 || null;

          let booking_id =
            bookingByPiId.get(pi.id) ??
            pi?.metadata?.booking_id ??
            pi?.metadata?.bookingId ??
            null;
          if (booking_id != null && !Number.isNaN(Number(booking_id))) {
            booking_id = Number(booking_id);
          }

   // derive a UI status from the charge when present
          const chStatus = ch?.status || null; // "succeeded" | "pending" | "failed"
          const statusOut =
           chStatus === "succeeded"
              ? "succeeded"
              : chStatus === "failed"
              ? "failed"
              : chStatus === "pending"
              ? "processing"
              : pi.status; // fall back to PI status

          // best-effort amount received (minor units)
          const amountReceivedOut =
            (typeof pi.amount_received === "number" && pi.amount_received > 0)
              ? pi.amount_received
              : (typeof ch?.amount_captured === "number" && ch.amount_captured > 0)
              ? ch.amount_captured
              : (typeof ch?.amount === "number" ? ch.amount : null);

          return {
            kind: "payment_intent",
            id: pi.id,
            created: pi.created,
            status: statusOut,
            amount: pi.amount ?? null,
            amount_received: amountReceivedOut,
            currency: pi.currency,
            customer: {
              id: typeof pi.customer === "string" ? pi.customer : customerObj?.id ?? null,
              email,
              name,
            },
            method,
            card_brand,
            card_last4,
            latest_charge: typeof pi.latest_charge === "string" ? pi.latest_charge : ch?.id ?? null,
            receipt_url: ch?.receipt_url || null,
            invoice_number: null,
            hosted_invoice_url: null,
            invoice_pdf: null,
            payment_intent_id: pi.id,
            refunds:
              ch?.refunds?.data?.map((r) => ({
                id: r.id,
                amount: r.amount,
                status: r.status,
                created: r.created,
              })) || [],
            booking_id,
          };
        })
        .filter((it) =>
          q
            ? ilike(it.id, q) ||
              ilike(it.customer?.email, q) ||
              ilike(it.customer?.name, q)
            : true
        );

      return ok({
        items,
        has_more: res.has_more,
        next_cursor: res.has_more && res.data.length ? res.data.at(-1).id : null,
        source: "payment_intents",
      });
    }

    if (kind === "charges") {
      const res = await stripe.charges.list(
        {
          limit,
          ...(created ? { created } : {}),
          ...(starting_after ? { starting_after } : {}),
          expand: ["data.customer", "data.refunds", "data.invoice", "data.payment_intent"],
        },
        opt
      );

      // If you want booking enrichment here as well, enrich using PI from charge
      const piIds = res.data.map((c) => (typeof c.payment_intent === "string" ? c.payment_intent : c.payment_intent?.id)).filter(Boolean);
      await enrichBookingsByPi(piIds);

      const items = res.data
        .filter((ch) => (status === "any" ? true : String(ch.status).toLowerCase() === status))
        .map((ch) => {
          const customerObj = asObj(ch.customer);
          const pmDetails = asObj(ch.payment_method_details);
          const cardObj = pmDetails?.card || null;
          const pi = asObj(ch.payment_intent);
          const inv = asObj(ch.invoice);

          let booking_id =
            bookingByPiId.get(typeof ch.payment_intent === "string" ? ch.payment_intent : pi?.id) ??
            ch?.metadata?.booking_id ??
            ch?.metadata?.bookingId ??
            inv?.metadata?.bookingId ??
            pi?.metadata?.bookingId ??
            null;
          if (booking_id != null && !Number.isNaN(Number(booking_id))) booking_id = Number(booking_id);

          return {
            kind: "charge",
            id: ch.id,
            created: ch.created,
           status: ch.status === "pending" ? "processing" : ch.status, // succeeded|processing|failed
            amount: ch.amount ?? null,
            amount_received: ch.amount_captured ?? null,
            currency: ch.currency,
            customer: {
              id: typeof ch.customer === "string" ? ch.customer : customerObj?.id ?? null,
              email: customerObj?.email || ch.billing_details?.email || null,
              name: customerObj?.name || ch.billing_details?.name || null,
            },
            method: pmDetails?.type || (cardObj ? "card" : null),
            card_brand: cardObj?.brand || null,
            card_last4: cardObj?.last4 || null,
            latest_charge: ch.id,
            receipt_url: ch.receipt_url || null,
            invoice_number: inv?.number || null,
            hosted_invoice_url: inv?.hosted_invoice_url || null,
            invoice_pdf: inv?.invoice_pdf || null,
            payment_intent_id: typeof ch.payment_intent === "string" ? ch.payment_intent : pi?.id || null,
            refunds:
              ch?.refunds?.data?.map((r) => ({
                id: r.id,
                amount: r.amount,
                status: r.status,
                created: r.created,
              })) || [],
            booking_id,
          };
        })
        .filter((it) =>
          q
            ? ilike(it.id, q) ||
              ilike(it.customer?.email, q) ||
              ilike(it.customer?.name, q) ||
              ilike(it.invoice_number, q)
            : true
        );

      return ok({
        items,
        has_more: res.has_more,
        next_cursor: res.has_more && res.data.length ? res.data.at(-1).id : null,
        source: "charges",
      });
    }

    // kind === "invoices"
    {
      // Stripe supports status filter on invoices.list
      // status: draft|open|paid|uncollectible|void
      const listParams = {
        limit,
        ...(created ? { created } : {}),
        ...(starting_after ? { starting_after } : {}),
        ...(status !== "any" ? { status } : {}),
        expand: ["data.customer", "data.charge", "data.payment_intent"],
      };

      const res = await stripe.invoices.list(listParams, opt);

      // Enrich booking from invoice.metadata.bookingId (set by your code) or PI mapping
      const piIds = res.data
        .map((inv) => (typeof inv.payment_intent === "string" ? inv.payment_intent : inv.payment_intent?.id))
        .filter(Boolean);
      await enrichBookingsByPi(piIds);

      const items = res.data
        .map((inv) => {
          const customerObj = asObj(inv.customer);
          const ch = asObj(inv.charge);
          const pi = asObj(inv.payment_intent);

          const email = inv.customer_email || customerObj?.email || ch?.billing_details?.email || null;
          const name  = customerObj?.name || ch?.billing_details?.name || null;

          let booking_id =
            inv?.metadata?.bookingId ??
            inv?.metadata?.booking_id ??
            bookingByPiId.get(typeof inv.payment_intent === "string" ? inv.payment_intent : pi?.id) ??
            null;
          if (booking_id != null && !Number.isNaN(Number(booking_id))) booking_id = Number(booking_id);

          return {
            kind: "invoice",
            id: inv.id,
            created: inv.created, // unix seconds
             status:
              inv.status === "paid"
                ? "succeeded"
                : inv.status === "open"
                ? "requires_action"
               : (inv.status === "void" || inv.status === "uncollectible")
                ? "canceled"
                : inv.status,
            amount: inv.total ?? inv.amount_due ?? null, // amount in minor units
            amount_received: inv.amount_paid ?? null,
            currency: inv.currency,
            customer: {
              id: typeof inv.customer === "string" ? inv.customer : customerObj?.id ?? null,
              email,
              name,
            },
            method: inv.collection_method || null, // send_invoice | charge_automatically
            card_brand: null,
            card_last4: null,
            latest_charge: typeof inv.charge === "string" ? inv.charge : ch?.id || null,
            receipt_url: ch?.receipt_url || null,
            invoice_number: inv.number || null,
            hosted_invoice_url: inv.hosted_invoice_url || null,
            invoice_pdf: inv.invoice_pdf || null,
            payment_intent_id: typeof inv.payment_intent === "string" ? inv.payment_intent : pi?.id || null,
            refunds: [], // refunds live on charges; you can look those up separately if needed
            booking_id,
          };
        })
        .filter((it) =>
          q
            ? ilike(it.id, q) ||
              ilike(it.invoice_number, q) ||
              ilike(it.customer?.email, q) ||
              ilike(it.customer?.name, q)
            : true
        );

      return ok({
        items,
        has_more: res.has_more,
        next_cursor: res.has_more && res.data.length ? res.data.at(-1).id : null,
        source: "invoices",
      });
    }
  } catch (e) {
    console.error("payments:list error", e);
    return bad(e?.raw?.message || e?.message || "Failed to list payments", 500);
  }
}
