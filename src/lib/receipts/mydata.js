import "server-only";

/**
 * The seam where AADE / myDATA plugs in.
 *
 * Nothing here transmits anything yet, and that is deliberate: transmission
 * needs an accredited provider or ΑΑΔΕ credentials, and the document format
 * has to be agreed with an accountant. What matters now is that every receipt
 * is *issued* with the fields myDATA wants and parked in a queue, so switching
 * on later is one function — and the receipts issued in the meantime go up
 * with everything else instead of being lost.
 *
 * To connect:
 *   1. implement transmit() against your provider
 *   2. have it return { ok, mark, uid } or { ok:false, error }
 *   3. run drainPending() on a schedule, or call transmitReceipt() after issue
 *
 * The status column carries the state machine:
 *   pending  — issued, not yet sent (the default, and the backlog)
 *   sent     — accepted; mark and uid recorded
 *   failed   — rejected; error recorded, safe to retry
 *   skipped  — deliberately not transmitted (e.g. issued before this existed)
 */

/** Is a transmitter configured for this deployment? */
export function isConfigured() {
  return Boolean(
    process.env.MYDATA_PROVIDER &&
      (process.env.MYDATA_API_KEY || process.env.MYDATA_USER_ID),
  );
}

/**
 * Send one receipt to AADE.
 *
 * @param {object} receipt a row from public."Receipt"
 * @returns {Promise<{ok:true, mark:string, uid:string} | {ok:false, error:string, retryable?:boolean}>}
 */
export async function transmit(receipt) {
  if (!isConfigured()) {
    return { ok: false, error: "myDATA is not configured", retryable: true };
  }

  // ── Implement against your provider here. ────────────────────────────
  // The receipt row already carries everything a retail document needs:
  //   series, number, issuedAt, docType
  //   netAmount, vatAmount, vatRate, totalPaidAmount, currency
  //   items (jsonb), customerName, customerEmail
  //   paymentMethod, paymentReference, bookingId
  // Map those to your provider's payload, POST it, and return the MARK/UID.
  throw new Error(
    `[mydata] provider "${process.env.MYDATA_PROVIDER}" has no transmit implementation yet`,
  );
}

/**
 * Transmit one receipt and record the outcome. Never throws: a receipt that
 * cannot be transmitted is still a valid receipt the customer has.
 */
export async function transmitReceipt(admin, receipt) {
  if (!admin || !receipt?.id) return { ok: false, reason: "bad-request" };

  if (!isConfigured()) {
    return { ok: false, reason: "not-configured" };
  }

  try {
    const res = await transmit(receipt);

    if (res.ok) {
      await admin
        .from("Receipt")
        .update({
          mydataStatus: "sent",
          mydataMark: res.mark ?? null,
          mydataUid: res.uid ?? null,
          mydataSentAt: new Date().toISOString(),
          mydataError: null,
        })
        .eq("id", receipt.id);
      return { ok: true, mark: res.mark, uid: res.uid };
    }

    await admin
      .from("Receipt")
      .update({
        // A retryable failure stays pending so the next sweep picks it up.
        mydataStatus: res.retryable ? "pending" : "failed",
        mydataError: String(res.error || "rejected").slice(0, 500),
      })
      .eq("id", receipt.id);
    return { ok: false, reason: res.error };
  } catch (e) {
    const msg = e?.message || String(e);
    await admin
      .from("Receipt")
      .update({ mydataStatus: "pending", mydataError: msg.slice(0, 500) })
      .eq("id", receipt.id);
    return { ok: false, reason: msg };
  }
}

/**
 * Work through the backlog. Safe to call before a provider exists — it simply
 * reports how much is waiting.
 *
 * @returns {Promise<{configured:boolean, pending:number, sent:number, failed:number}>}
 */
export async function drainPending(admin, { limit = 50 } = {}) {
  const { data: pending, error } = await admin
    .from("Receipt")
    .select("*")
    .eq("mydataStatus", "pending")
    .order("issuedAt", { ascending: true })
    .limit(limit);

  if (error) return { configured: isConfigured(), pending: 0, sent: 0, failed: 0 };
  if (!isConfigured()) {
    return { configured: false, pending: pending?.length || 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  for (const r of pending || []) {
    const res = await transmitReceipt(admin, r);
    if (res.ok) sent += 1;
    else failed += 1;
  }
  return { configured: true, pending: pending?.length || 0, sent, failed };
}
