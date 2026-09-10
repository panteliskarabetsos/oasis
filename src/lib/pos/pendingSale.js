import "server-only";

/**
 * The parking spot for a basket while the customer pays by QR.
 *
 * Two things race to settle a QR payment: the till's own polling and the
 * Stripe webhook. This row is what lets the webhook finish a sale the till
 * never got back to, and what stops the two of them recording it twice.
 *
 * Every function here tolerates the table not existing yet — the QR flow
 * works without it, just without the safety net — so nothing depends on
 * dump_sql/20260910_pos_pending_sale.sql having been run.
 */

/** 42P01 undefined_table / PGRST205 unknown table in the schema cache. */
function isMissingTable(error) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

export async function createPendingSale(admin, { sessionId, payload, amountCents, currency, staffEmail }) {
  try {
    const { error } = await admin.from("pos_pending_sale").insert({
      session_id: sessionId,
      payload,
      amount_cents: amountCents,
      currency,
      created_by_email: staffEmail || null,
    });
    if (error) {
      if (isMissingTable(error)) return { stored: false, reason: "no-table" };
      throw error;
    }
    return { stored: true };
  } catch (e) {
    // Never fail the sale over bookkeeping: the till can still settle it.
    console.error("[pos pending] could not park basket", sessionId, e?.message || e);
    return { stored: false, reason: "error" };
  }
}

/** The parked basket, or null if there isn't one (or the table is absent). */
export async function getPendingSale(admin, sessionId) {
  try {
    const { data, error } = await admin
      .from("pos_pending_sale")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (error) {
      if (isMissingTable(error)) return null;
      throw error;
    }
    return data ?? null;
  } catch (e) {
    console.error("[pos pending] lookup failed", sessionId, e?.message || e);
    return null;
  }
}

/**
 * Claim a pending sale for settlement.
 *
 * The update is conditional on the row still being `pending`, so if the till's
 * poll and the webhook arrive together exactly one of them gets the row back
 * and the other sees nothing to do. That, plus the PaymentIntent dedupe inside
 * recordPosSale, is why a customer cannot be given two receipts.
 */
export async function claimPendingSale(admin, sessionId) {
  try {
    const { data, error } = await admin
      .from("pos_pending_sale")
      .update({ status: "settling" })
      .eq("session_id", sessionId)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();
    if (error) {
      if (isMissingTable(error)) return null;
      throw error;
    }
    return data ?? null;
  } catch (e) {
    console.error("[pos pending] claim failed", sessionId, e?.message || e);
    return null;
  }
}

export async function finishPendingSale(admin, sessionId, patch) {
  try {
    const { error } = await admin
      .from("pos_pending_sale")
      .update({ settled_at: new Date().toISOString(), ...patch })
      .eq("session_id", sessionId);
    if (error && !isMissingTable(error)) throw error;
  } catch (e) {
    console.error("[pos pending] could not close out", sessionId, e?.message || e);
  }
}

/** Put a claimed row back when settlement failed, so it can be retried. */
export async function releasePendingSale(admin, sessionId, lastError) {
  try {
    await admin
      .from("pos_pending_sale")
      .update({ status: "pending", last_error: String(lastError || "").slice(0, 500) })
      .eq("session_id", sessionId);
  } catch {
    // Best effort; Stripe retries the webhook regardless.
  }
}
