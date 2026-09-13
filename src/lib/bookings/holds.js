import "server-only";

/**
 * Payment holds on admin-created bookings.
 *
 * An admin books seats for a guest, the guest is emailed a payment link, and
 * the seats are held until `holdExpiresAt`. Paying confirms the booking (the
 * Stripe webhook does that); letting the window lapse cancels it so the seats
 * go back on sale.
 *
 * Expiry is swept lazily rather than by a scheduler: every read that depends
 * on seats being accurate calls expireStaleHolds() first. That keeps the
 * feature working on a deployment with no cron, and a cron can call
 * /api/admin/bookings/expire-holds to make it prompt rather than eventual.
 */

/** How long a guest has to pay before the seats are released. */
export const HOLD_HOURS = 24;

export function holdExpiryFrom(now = new Date()) {
  return new Date(now.getTime() + HOLD_HOURS * 60 * 60 * 1000);
}

/** 42703 undefined_column / PGRST204 unknown column in the schema cache. */
function isMissingColumn(error) {
  return error?.code === "42703" || error?.code === "PGRST204";
}

/**
 * Cancel pending bookings whose payment window has closed.
 *
 * Only touches rows that carry a `holdExpiresAt` in the past, so bookings made
 * before this feature — and any pending booking without a hold — are left
 * alone. Never throws: this runs inside other requests, and a sweep failing
 * must not take a page down with it.
 *
 * @returns {Promise<{expired:number, reason:string}>}
 */
export async function expireStaleHolds(admin) {
  if (!admin) return { expired: 0, reason: "no-client" };

  try {
    const nowIso = new Date().toISOString();

    // Read the candidates before touching them. A blind bulk update cannot ask
    // Stripe whether the money actually arrived, and cancelling a guest who
    // paid is far worse than holding a seat an hour longer.
    const { data: candidates, error } = await admin
      .from("booking")
      .select(
        'id, code, "stripeSessionId", "stripePaymentIntentId", "totalPaidAmount"',
      )
      .eq("status", "pending")
      .not("holdExpiresAt", "is", null)
      .lt("holdExpiresAt", nowIso)
      .limit(200);

    if (error) {
      if (isMissingColumn(error)) return { expired: 0, reason: "no-column" };
      throw error;
    }
    if (!candidates?.length) return { expired: 0, reason: "swept" };

    const expired = [];
    const rescued = [];
    const spared = [];

    for (const b of candidates) {
      // Anything already bearing a payment is not ours to cancel.
      if (b.stripePaymentIntentId || Number(b.totalPaidAmount) > 0) {
        spared.push(b.code || b.id);
        continue;
      }

      const paid = await settledWithStripe(admin, b);
      if (paid === true) {
        rescued.push(b.code || b.id);
        continue;
      }
      // `null` means we could not reach Stripe. Leave the hold for the next
      // sweep rather than guessing; an hour of held seats is recoverable, a
      // wrongly cancelled booking is not.
      if (paid === null) {
        spared.push(b.code || b.id);
        continue;
      }

      const { error: updErr } = await admin
        .from("booking")
        .update({ status: "cancelled", holdExpiresAt: null })
        .eq("id", b.id)
        .eq("status", "pending");
      if (!updErr) expired.push(b.code || b.id);
    }

    if (expired.length) {
      console.info(`[holds] released ${expired.length} unpaid:`, expired.join(", "));
    }
    if (rescued.length) {
      console.warn(`[holds] confirmed ${rescued.length} already paid:`, rescued.join(", "));
    }
    if (spared.length) {
      console.info(`[holds] left ${spared.length} alone:`, spared.join(", "));
    }

    return {
      expired: expired.length,
      rescued: rescued.length,
      spared: spared.length,
      reason: "swept",
    };
  } catch (e) {
    console.error("[holds] sweep failed", e?.message || e);
    return { expired: 0, reason: "error" };
  }
}

/**
 * Did this booking's Stripe session actually get paid?
 *
 * @returns {Promise<true|false|null>} true = paid (and now confirmed),
 *   false = definitely not paid, null = could not tell.
 */
async function settledWithStripe(admin, booking) {
  if (!booking.stripeSessionId) return false; // no link was ever opened
  if (!process.env.STRIPE_SECRET_KEY) return null;

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(
      booking.stripeSessionId,
    );

    if (session?.payment_status !== "paid") return false;

    // Paid but still pending: nothing ever confirmed it — no webhook, or the
    // guest closed the tab before the success page ran. Put that right here.
    const { confirmPaidBooking } = await import("@/lib/email/bookingConfirmation");
    await confirmPaidBooking(admin, booking.id, {
      stripe,
      sessionId: session.id,
      piId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null),
      amountPaid:
        typeof session.amount_total === "number"
          ? session.amount_total / 100
          : null,
    });
    return true;
  } catch (e) {
    console.error(
      `[holds] could not check Stripe for booking ${booking.id}:`,
      e?.message || e,
    );
    return null;
  }
}
