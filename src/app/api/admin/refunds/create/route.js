// app/api/admin/refunds/create/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import "server-only";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/* ---------- helpers ---------- */
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

const ZERO_DEC = new Set([
  "BIF","CLP","DJF","GNF","JPY","KMF","KRW","MGA","PYG","RWF",
  "UGX","VND","VUV","XAF","XOF","XPF",
]);
function toMinor(currency, amountMajor) {
  const cur = String(currency || "EUR").toUpperCase();
  const mul = ZERO_DEC.has(cur) ? 1 : 100;
  return Math.round(Number(amountMajor || 0) * mul);
}
function ok(n) { return Number.isFinite(n) && n > 0; }

/* ---------- route ---------- */
export async function POST(req) {
  try {
    // Accept JSON or form
    const ctype = req.headers.get("content-type") || "";
    let bookingId, paymentIntentId, chargeId, amount, currency, reason, note;
    if (ctype.includes("application/json")) {
      const b = await req.json();
      bookingId       = b.bookingId ? Number(b.bookingId) : undefined;
      paymentIntentId = b.paymentIntentId || b.piId;
      chargeId        = b.chargeId || b.chId;
      amount          = b.amount != null ? Number(b.amount) : undefined; // major units (e.g. 10.00)
      currency        = b.currency || "EUR";
      reason          = b.reason; // duplicate | fraudulent | requested_by_customer
      note            = b.note;
    } else {
      const fd = await req.formData();
      bookingId       = fd.get("bookingId") ? Number(fd.get("bookingId")) : undefined;
      paymentIntentId = fd.get("paymentIntentId") || fd.get("piId") || undefined;
      chargeId        = fd.get("chargeId") || fd.get("chId") || undefined;
      amount          = fd.get("amount") != null ? Number(fd.get("amount")) : undefined;
      currency        = fd.get("currency") || "EUR";
      reason          = fd.get("reason") || undefined;
      note            = fd.get("note") || undefined;
    }

    const stripe = getStripe();

    // If bookingId given, look up Stripe ids from your DB
    if (!paymentIntentId && !chargeId && bookingId) {
      const admin = createSupabaseAdmin();
      if (!admin) return NextResponse.json({ error: "no_admin" }, { status: 500 });

      const { data: b, error } = await admin
        .from("Booking")
        .select("id, stripePaymentIntentId, stripeSessionId, currency, totalPaidAmount")
        .eq("id", bookingId)
        .single();

      if (error || !b) return NextResponse.json({ error: "booking_not_found" }, { status: 404 });

      currency = currency || b.currency || "EUR";

      if (b.stripePaymentIntentId) {
        paymentIntentId = b.stripePaymentIntentId;
      } else if (b.stripeSessionId) {
        // Get PI from the session
        const sess = await stripe.checkout.sessions.retrieve(b.stripeSessionId, {
          expand: ["payment_intent.latest_charge"],
        });
        if (typeof sess.payment_intent === "string") {
          paymentIntentId = sess.payment_intent;
        } else if (sess.payment_intent?.id) {
          paymentIntentId = sess.payment_intent.id;
        }
        if (!paymentIntentId && sess.payment_intent?.latest_charge) {
          chargeId = typeof sess.payment_intent.latest_charge === "string"
            ? sess.payment_intent.latest_charge
            : sess.payment_intent.latest_charge?.id;
        }
      } else {
        // Likely a manual invoice marked paid out-of-band → cannot refund via Stripe
        return NextResponse.json({ error: "not_refundable_out_of_band" }, { status: 400 });
      }
    }

    if (!paymentIntentId && !chargeId) {
      return NextResponse.json({ error: "missing_target" }, { status: 400 });
    }

    // Compute minor amount (if provided); omit 'amount' for full refund
    let refundParams = {};
    if (ok(amount)) {
      refundParams.amount = toMinor(currency, amount);
    }

    // Prefer payment_intent refunds (handles multi-charge cases)
    if (paymentIntentId) refundParams.payment_intent = paymentIntentId;
    if (!paymentIntentId && chargeId) refundParams.charge = chargeId;

    if (reason) refundParams.reason = reason;
    refundParams.metadata = {
      source: "admin_portal",
      bookingId: bookingId != null ? String(bookingId) : "",
      note: note || "",
    };

    // Idempotency is important — allow caller-provided key or synthesize one
    const idempotencyKey =
      req.headers.get("x-idempotency-key") ||
      `refund:${paymentIntentId || chargeId}:${refundParams.amount || "full"}`;

    const refund = await stripe.refunds.create(refundParams, { idempotencyKey });

    // Optional: update your DB
    try {
      if (bookingId) {
        const admin = createSupabaseAdmin();
        if (admin) {
          await admin
            .from("Booking")
            .update({
              lastRefundId: refund.id,
              lastRefundAmount: (refund.amount ?? 0) / (ZERO_DEC.has((refund.currency||"").toUpperCase()) ? 1 : 100),
              updatedAt: new Date().toISOString(),
            })
            .eq("id", bookingId);
        }
      }
    } catch (e) {
      console.warn("[refund] db update warn:", e?.message || e);
    }

    revalidatePath("/admin/invoices");
    return NextResponse.json({ ok: true, refund });
  } catch (e) {
    console.error("[refund] error:", e);
    return NextResponse.json({ error: e?.message || "refund_failed" }, { status: 500 });
  }
}
