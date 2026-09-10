import "server-only";

import {
  claimPendingSale,
  finishPendingSale,
  releasePendingSale,
} from "@/lib/pos/pendingSale";
import { recordPosSale } from "@/lib/pos/recordSale";

/**
 * Record a QR sale once Stripe says the money is in.
 *
 * Called from two places that race each other — the till's polling and the
 * Stripe webhook — so it claims the parked basket first and only the winner
 * does the work. Even if both somehow got through, recordPosSale dedupes on
 * the PaymentIntent, so the customer cannot end up with two receipts.
 *
 * @returns {Promise<{settled:boolean, reason:string, receiptId?:number, bookingId?:number}>}
 */
export async function settleLinkPayment(admin, sessionId, paymentIntentId) {
  if (!sessionId || !paymentIntentId) {
    return { settled: false, reason: "bad-request" };
  }

  const pending = await claimPendingSale(admin, sessionId);
  if (!pending) {
    // Either already handled by the other caller, cancelled, or this
    // deployment has no pending-sale table yet.
    return { settled: false, reason: "not-claimable" };
  }

  // Replay the till's own payload down the ordinary checkout path, with the
  // PaymentIntent filled in — exactly what the app would have sent.
  const payload = {
    ...(pending.payload || {}),
    stripePaymentIntentId: paymentIntentId,
    payment: {
      ...((pending.payload || {}).payment || {}),
      method: "link",
      reference: paymentIntentId,
    },
  };

  const result = await recordPosSale(payload, { permissions: "*" });

  if (result.status !== 200) {
    const error = result.body?.error || `status ${result.status}`;
    await releasePendingSale(admin, sessionId, error);
    console.error("[pos settle]", sessionId, error);
    return { settled: false, reason: "record-failed", error };
  }

  await finishPendingSale(admin, sessionId, {
    status: "settled",
    payment_intent_id: paymentIntentId,
    receipt_id: result.body?.receiptId ?? null,
    booking_id: result.body?.bookingId ?? null,
    last_error: null,
  });

  return {
    settled: true,
    reason: "settled",
    receiptId: result.body?.receiptId,
    bookingId: result.body?.bookingId,
  };
}
