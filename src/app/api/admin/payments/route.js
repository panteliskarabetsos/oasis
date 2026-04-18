// app/api/admin/payments/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

/* ------------------------------ RBAC Config ------------------------------ */
const ALLOWED_PAYMENT_ROLES = ["superadmin", "finance", "admin", "manager"];

async function verifyAccess() {
  const supa = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supa.auth.getUser();

  if (error || !user)
    return { authorized: false, res: bad("Unauthorized", 401) };

  const adminSupa = createSupabaseAdmin();
  const { data: dbUser } = await adminSupa
    .from("User")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const metaRole = user?.app_metadata?.role || user?.user_metadata?.role;
  const finalRole = dbUser?.role || metaRole || "user";

  if (!ALLOWED_PAYMENT_ROLES.includes(finalRole)) {
    return { authorized: false, res: bad("Forbidden", 403) };
  }

  return { authorized: true, adminSupa };
}

// ----------------- tiny helpers -----------------
const asObj = (x) => (x && typeof x === "object" ? x : null);
const ilike = (s, q) =>
  String(s || "")
    .toLowerCase()
    .includes(String(q || "").toLowerCase());

// build unix range from YYYY-MM-DD
function toUnixRange({ date_from, date_to }) {
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
  return created;
}

// --------------- main GET ----------------
export async function GET(req) {
  try {
    // 1. Check Permissions
    const access = await verifyAccess();
    if (!access.authorized) return access.res;
    const { adminSupa } = access;

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
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") || 50), 1),
      100,
    );
    const stripe_account = searchParams.get("stripe_account") || undefined;
    const opt = stripe_account ? { stripeAccount: stripe_account } : undefined;

    const created = toUnixRange({ date_from, date_to });

    // ---------- Enriched Booking Map ----------
    const dbDataMap = new Map();
    async function enrichBookingsByPi(piIds) {
      if (!piIds.length) return;
      try {
        // Fetch from confirmed 'booking' table
        // Join with 'User' table to get real registered names
        const { data: bookings, error: bErr } = await adminSupa
          .from("booking")
          .select(
            `
            id, 
            stripePaymentIntentId,
            User ( name, surname, email )
          `,
          )
          .in("stripePaymentIntentId", piIds);

        if (!bErr && Array.isArray(bookings)) {
          for (const b of bookings) {
            if (b.stripePaymentIntentId) {
              const fullName = b.User
                ? `${b.User.name || ""} ${b.User.surname || ""}`.trim()
                : null;
              dbDataMap.set(b.stripePaymentIntentId, {
                booking_id: b.id,
                dbName: fullName,
                dbEmail: b.User?.email,
              });
            }
          }
        }
      } catch (e) {
        console.warn(
          "[payments:list] booking enrichment failed:",
          e?.message || e,
        );
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
          ],
        },
        opt,
      );

      const piIds = res.data.map((pi) => pi.id).filter(Boolean);
      await enrichBookingsByPi(piIds);

      const items = res.data
        .filter((pi) => {
          // Derive status to match dropdown filters
          const chStatus = pi.latest_charge?.status || null;
          const statusOut =
            chStatus === "succeeded"
              ? "succeeded"
              : chStatus === "failed"
                ? "failed"
                : chStatus === "pending"
                  ? "processing"
                  : pi.status;

          return status === "any"
            ? true
            : String(statusOut).toLowerCase() === status;
        })
        .map((pi) => {
          const ch = asObj(pi.latest_charge);
          const pm = asObj(pi.payment_method);
          const customerObj = asObj(pi.customer);
          const enrichment = dbDataMap.get(pi.id);

          const stripeEmail =
            customerObj?.email ||
            ch?.billing_details?.email ||
            pm?.billing_details?.email;
          const stripeName =
            customerObj?.name ||
            ch?.billing_details?.name ||
            pm?.billing_details?.name;

          // Priority: 1. Real DB Name -> 2. Stripe Name -> 3. Email Prefix -> 4. "Guest"
          const finalName =
            enrichment?.dbName ||
            stripeName ||
            stripeEmail?.split("@")[0] ||
            "Guest";
          const finalEmail = enrichment?.dbEmail || stripeEmail;

          const method = ch?.payment_method_details?.type || pm?.type || "card";
          const cardObj = ch?.payment_method_details?.card || pm?.card || null;

          // derive a UI status from the charge when present
          const chStatus = ch?.status || null;
          const statusOut =
            chStatus === "succeeded"
              ? "succeeded"
              : chStatus === "failed"
                ? "failed"
                : chStatus === "pending"
                  ? "processing"
                  : pi.status;

          const amountReceivedOut =
            typeof pi.amount_received === "number" && pi.amount_received > 0
              ? pi.amount_received
              : typeof ch?.amount_captured === "number" &&
                  ch.amount_captured > 0
                ? ch.amount_captured
                : typeof ch?.amount === "number"
                  ? ch.amount
                  : null;

          return {
            kind: "payment_intent",
            id: pi.id,
            created: pi.created,
            status: statusOut,
            amount: pi.amount ?? null,
            amount_received: amountReceivedOut,
            currency: pi.currency,
            customer: {
              id:
                typeof pi.customer === "string"
                  ? pi.customer
                  : (customerObj?.id ?? null),
              email: finalEmail,
              name: finalName,
            },
            method,
            card_brand: cardObj?.brand || null,
            card_last4: cardObj?.last4 || null,
            latest_charge:
              typeof pi.latest_charge === "string"
                ? pi.latest_charge
                : (ch?.id ?? null),
            receipt_url: ch?.receipt_url || null,
            payment_intent_id: pi.id,
            refunds:
              ch?.refunds?.data?.map((r) => ({
                id: r.id,
                amount: r.amount,
                status: r.status,
                created: r.created,
              })) || [],
            booking_id: enrichment?.booking_id || null,
          };
        })
        .filter((it) =>
          q
            ? ilike(it.id, q) ||
              ilike(it.customer?.email, q) ||
              ilike(it.customer?.name, q)
            : true,
        );

      return ok({
        items,
        has_more: res.has_more,
        next_cursor:
          res.has_more && res.data.length ? res.data.at(-1).id : null,
        source: "payment_intents",
      });
    }

    if (kind === "charges") {
      const res = await stripe.charges.list(
        {
          limit,
          ...(created ? { created } : {}),
          ...(starting_after ? { starting_after } : {}),
          expand: [
            "data.customer",
            "data.refunds",
            "data.invoice",
            "data.payment_intent",
          ],
        },
        opt,
      );

      const piIds = res.data
        .map((c) =>
          typeof c.payment_intent === "string"
            ? c.payment_intent
            : c.payment_intent?.id,
        )
        .filter(Boolean);
      await enrichBookingsByPi(piIds);

      const items = res.data
        .filter((ch) => {
          const statusOut = ch.status === "pending" ? "processing" : ch.status;
          return status === "any"
            ? true
            : String(statusOut).toLowerCase() === status;
        })
        .map((ch) => {
          const customerObj = asObj(ch.customer);
          const pmDetails = asObj(ch.payment_method_details);
          const cardObj = pmDetails?.card || null;
          const pi = asObj(ch.payment_intent);
          const piId =
            typeof ch.payment_intent === "string" ? ch.payment_intent : pi?.id;
          const enrichment = dbDataMap.get(piId);

          const stripeEmail = customerObj?.email || ch.billing_details?.email;
          const stripeName = customerObj?.name || ch.billing_details?.name;

          const finalName =
            enrichment?.dbName ||
            stripeName ||
            stripeEmail?.split("@")[0] ||
            "Guest";
          const finalEmail = enrichment?.dbEmail || stripeEmail;

          return {
            kind: "charge",
            id: ch.id,
            created: ch.created,
            status: ch.status === "pending" ? "processing" : ch.status,
            amount: ch.amount ?? null,
            amount_received: ch.amount_captured ?? null,
            currency: ch.currency,
            customer: {
              id:
                typeof ch.customer === "string"
                  ? ch.customer
                  : (customerObj?.id ?? null),
              email: finalEmail,
              name: finalName,
            },
            method: pmDetails?.type || (cardObj ? "card" : null),
            card_brand: cardObj?.brand || null,
            card_last4: cardObj?.last4 || null,
            latest_charge: ch.id,
            receipt_url: ch.receipt_url || null,
            payment_intent_id: piId || null,
            refunds:
              ch?.refunds?.data?.map((r) => ({
                id: r.id,
                amount: r.amount,
                status: r.status,
                created: r.created,
              })) || [],
            booking_id: enrichment?.booking_id || null,
          };
        })
        .filter((it) =>
          q
            ? ilike(it.id, q) ||
              ilike(it.customer?.email, q) ||
              ilike(it.customer?.name, q)
            : true,
        );

      return ok({
        items,
        has_more: res.has_more,
        next_cursor:
          res.has_more && res.data.length ? res.data.at(-1).id : null,
        source: "charges",
      });
    }

    if (kind === "invoices") {
      const listParams = {
        limit,
        ...(status !== "any" ? { status } : {}), // Pass status directly to stripe for invoices
        ...(created ? { created } : {}),
        ...(starting_after ? { starting_after } : {}),
        expand: ["data.customer", "data.charge", "data.payment_intent"],
      };

      const res = await stripe.invoices.list(listParams, opt);

      const piIds = res.data
        .map((inv) =>
          typeof inv.payment_intent === "string"
            ? inv.payment_intent
            : inv.payment_intent?.id,
        )
        .filter(Boolean);

      await enrichBookingsByPi(piIds);

      const items = res.data
        .map((inv) => {
          const customerObj = asObj(inv.customer);
          const ch = asObj(inv.charge);
          const pi = asObj(inv.payment_intent);
          const piId =
            typeof inv.payment_intent === "string"
              ? inv.payment_intent
              : pi?.id;
          const enrichment = dbDataMap.get(piId);

          const stripeEmail =
            inv.customer_email ||
            customerObj?.email ||
            ch?.billing_details?.email;
          const stripeName = customerObj?.name || ch?.billing_details?.name;

          const finalName =
            enrichment?.dbName ||
            stripeName ||
            stripeEmail?.split("@")[0] ||
            "Guest";
          const finalEmail = enrichment?.dbEmail || stripeEmail;

          return {
            kind: "invoice",
            id: inv.id,
            created: inv.created,
            status:
              inv.status === "paid"
                ? "succeeded"
                : inv.status === "open"
                  ? "requires_action"
                  : inv.status === "void" || inv.status === "uncollectible"
                    ? "canceled"
                    : inv.status,
            amount: inv.total ?? inv.amount_due ?? null,
            amount_received: inv.amount_paid ?? null,
            currency: inv.currency,
            customer: {
              id:
                typeof inv.customer === "string"
                  ? inv.customer
                  : (customerObj?.id ?? null),
              email: finalEmail,
              name: finalName,
            },
            method: inv.collection_method || null,
            receipt_url: ch?.receipt_url || null,
            payment_intent_id: piId || null,
            refunds: [],
            booking_id: enrichment?.booking_id || null,
          };
        })
        .filter((it) =>
          q
            ? ilike(it.id, q) ||
              ilike(it.customer?.email, q) ||
              ilike(it.customer?.name, q)
            : true,
        );

      return ok({
        items,
        has_more: res.has_more,
        next_cursor:
          res.has_more && res.data.length ? res.data.at(-1).id : null,
        source: "invoices",
      });
    }
  } catch (e) {
    console.error("payments:list error", e);
    return bad(e?.raw?.message || e?.message || "Failed to list payments", 500);
  }
}
