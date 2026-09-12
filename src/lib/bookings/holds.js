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

    const { data, error } = await admin
      .from("booking")
      .update({ status: "cancelled", holdExpiresAt: null })
      .eq("status", "pending")
      .not("holdExpiresAt", "is", null)
      .lt("holdExpiresAt", nowIso)
      .select("id, code");

    if (error) {
      if (isMissingColumn(error)) return { expired: 0, reason: "no-column" };
      throw error;
    }

    if (data?.length) {
      console.info(
        `[holds] released ${data.length} unpaid booking(s):`,
        data.map((b) => b.code || b.id).join(", "),
      );
    }
    return { expired: data?.length || 0, reason: "swept" };
  } catch (e) {
    console.error("[holds] sweep failed", e?.message || e);
    return { expired: 0, reason: "error" };
  }
}
