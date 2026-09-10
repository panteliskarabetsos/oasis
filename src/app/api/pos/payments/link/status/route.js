export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getStripe } from "@/lib/stripe/server";

/**
 * Where a QR payment has got to.
 *
 * The till polls this while the customer is paying. `paid` carries the
 * PaymentIntent id, which the till then hands to /api/pos/checkout — that
 * route re-verifies it with Stripe and dedupes on it, so a double poll cannot
 * produce two receipts.
 */
export async function GET(req) {
  const auth = await requireAdmin("pos");
  if (!auth.ok) return auth.response;

  try {
    const sessionId = new URL(req.url).searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const paid = session.payment_status === "paid";
    const status = paid
      ? "paid"
      : session.status === "expired"
        ? "expired"
        : "pending";

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);

    return NextResponse.json({
      status,
      paymentIntentId: paid ? paymentIntentId : null,
      amountTotal: session.amount_total ?? null,
      currency: session.currency ?? null,
    });
  } catch (e) {
    console.error("[pos/payments/link/status]", e?.message || e);
    return NextResponse.json(
      { error: e?.message || "Could not read the payment status" },
      { status: 400 },
    );
  }
}
