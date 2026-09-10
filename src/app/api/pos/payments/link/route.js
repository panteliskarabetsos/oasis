export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import QRCode from "qrcode";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import {
  createPendingSale,
  finishPendingSale,
  getPendingSale,
} from "@/lib/pos/pendingSale";
import { quotePosSale } from "@/lib/pos/quote";
import { getStripe } from "@/lib/stripe/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

/** Stripe's floor for a Checkout Session's lifetime is 30 minutes. */
const LINK_TTL_SECONDS = 30 * 60;

/**
 * Open a Stripe Checkout Session for the basket on the till and hand back a
 * QR code for it.
 *
 * The customer scans, pays on their own phone, and the till polls
 * ./link/status until Stripe reports the money in. Nothing is written to our
 * database here — the sale is only recorded once /api/pos/checkout verifies
 * the PaymentIntent, which is the same gate the card sheet goes through.
 */
export async function POST(req) {
  const auth = await requireAdmin("pos");
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const supa = await createSupabaseAdmin();

    const priced = await quotePosSale(supa, body);
    if (!priced.ok) return bad(priced.error, priced.status);

    const { netCents, currency } = priced.quote;

    if (!Number.isFinite(netCents)) return bad("Computed amount is invalid.", 400);
    if (netCents === 0) {
      return bad("Nothing to pay — take this as a comp instead.", 400);
    }
    if (netCents < 50) return bad("Amount below minimum charge (EUR 0.50).", 400);

    const itemCount = priced.cleanItems.reduce((n, it) => n + it.quantity, 0);
    const attendees = priced.adults + priced.kids;
    const description =
      [
        itemCount ? `${itemCount} item${itemCount === 1 ? "" : "s"}` : null,
        attendees ? `${attendees} guest${attendees === 1 ? "" : "s"}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Till sale";

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      new URL(req.url).origin;

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      // One line for the amount actually due: the basket is already netted
      // down by promo, gift and manual discounts, and the itemised breakdown
      // reaches the customer on the emailed receipt.
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: netCents,
            product_data: { name: "Oasis", description },
          },
        },
      ],
      customer_email: body?.customer?.email || undefined,
      expires_at: Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS,
      success_url: `${baseUrl}/pos/paid`,
      cancel_url: `${baseUrl}/pos/paid?cancelled=1`,
      metadata: {
        pos: "true",
        rail: "qr_link",
        netCents: String(netCents),
        staff: auth.user?.email || "",
      },
    });

    if (!session.url) return bad("Stripe did not return a payment URL.", 502);

    // Park the basket so the webhook can settle this sale if the till never
    // gets back to it. Best-effort: the till's own polling does not need it.
    await createPendingSale(supa, {
      sessionId: session.id,
      payload: body,
      amountCents: netCents,
      currency,
      staffEmail: auth.user?.email,
    });

    // Rendered server-side so neither till needs a QR library of its own.
    //
    // Level "L": a Stripe Checkout URL is ~470 characters, and at "M" that is
    // an 85x85 grid — about 2.5pt per module on the till's screen, which is
    // marginal for a phone camera. "L" brings it to 77x77. The code lives on a
    // clean backlit screen for a minute, so there is no damage to correct for.
    const qrDataUrl = await QRCode.toDataURL(session.url, {
      errorCorrectionLevel: "L",
      margin: 1,
      width: 512,
      color: { dark: "#1d160f", light: "#ffffff" },
    });

    return ok({
      sessionId: session.id,
      url: session.url,
      qrDataUrl,
      amountCents: netCents,
      currency,
      expiresAt: session.expires_at,
      quote: priced.quote,
    });
  } catch (e) {
    console.error("[pos/payments/link]", e?.message || e);
    return bad(e?.message || "Could not create the payment link", 400);
  }
}

/**
 * Abandon a QR payment.
 *
 * Cancelling on the till expires the Checkout Session at Stripe, so a customer
 * who scans the code a minute later cannot pay for a sale nobody is recording.
 * Without this the money would be taken with no receipt behind it.
 */
export async function DELETE(req) {
  const auth = await requireAdmin("pos");
  if (!auth.ok) return auth.response;

  try {
    const sessionId = new URL(req.url).searchParams.get("sessionId");
    if (!sessionId) return bad("Missing sessionId", 400);

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Already paid: leave it alone and tell the till, which must still settle
    // the sale rather than silently dropping a payment.
    if (session.payment_status === "paid") {
      return ok({
        expired: false,
        alreadyPaid: true,
        paymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent?.id ?? null),
      });
    }

    if (session.status === "open") await stripe.checkout.sessions.expire(sessionId);

    // Take it off the webhook's books too, so a late event does not resurrect
    // a basket the cashier abandoned.
    const supa = await createSupabaseAdmin();
    if (await getPendingSale(supa, sessionId)) {
      await finishPendingSale(supa, sessionId, { status: "cancelled" });
    }

    return ok({ expired: true, alreadyPaid: false });
  } catch (e) {
    console.error("[pos/payments/link] cancel", e?.message || e);
    return bad(e?.message || "Could not cancel the payment link", 400);
  }
}
