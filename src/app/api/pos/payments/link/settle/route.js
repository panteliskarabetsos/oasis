export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { recordPosSale } from "@/lib/pos/recordSale";
import { settleLinkPayment } from "@/lib/pos/settleLink";
import { getStripe } from "@/lib/stripe/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Close out a QR sale from the till.
 *
 * The till could post to /api/pos/checkout directly, but going through here
 * means the till and the Stripe webhook settle by the same route and against
 * the same parked basket, so whichever gets there first wins cleanly.
 *
 * The session is re-read from Stripe rather than trusting the client: the
 * caller says which session, Stripe says whether it was paid.
 */
export async function POST(req) {
  const auth = await requireAdmin("pos");
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.sessionId || "");
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "That payment has not completed." },
        { status: 409 },
      );
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);
    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "Stripe reported no payment for that session." },
        { status: 502 },
      );
    }

    const admin = createSupabaseAdmin();
    const settled = await settleLinkPayment(admin, sessionId, paymentIntentId);
    if (settled.settled) {
      return NextResponse.json({
        receiptId: settled.receiptId ?? undefined,
        bookingId: settled.bookingId ?? undefined,
        settledVia: "pending",
      });
    }

    // No basket was claimable — the webhook got there first, or this
    // deployment has no pending-sale table. Record from the payload the till
    // still has; recordPosSale dedupes on the PaymentIntent, so an
    // already-recorded sale comes back with its existing receipt rather than a
    // second one.
    const payload = {
      ...(body?.payload || {}),
      stripePaymentIntentId: paymentIntentId,
      payment: {
        ...((body?.payload || {}).payment || {}),
        method: "link",
        reference: paymentIntentId,
      },
    };
    const result = await recordPosSale(payload, { permissions: auth.permissions });
    return NextResponse.json(
      { ...result.body, settledVia: settled.reason },
      { status: result.status },
    );
  } catch (e) {
    console.error("[pos/payments/link/settle]", e?.message || e);
    return NextResponse.json(
      { error: e?.message || "Could not complete the sale" },
      { status: 400 },
    );
  }
}
