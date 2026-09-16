import "server-only";

/**
 * Spending a gift card, once.
 *
 * Lifted verbatim out of the draft-confirm route so the admin booking form
 * draws a balance down the same way the website does. Two implementations of
 * this would eventually disagree about how much of a card had been spent, and
 * the disagreement would be somebody's money.
 *
 * What makes it safe to call more than once:
 *
 *  - a redemption is recorded per (card, booking), and a second call for the
 *    same pair returns what the first one took rather than taking it again;
 *  - the balance update is conditional on the card still being active, so two
 *    callers racing cannot both spend the last euro;
 *  - it never applies more than remains, and refuses a card in the wrong
 *    currency rather than corrupting the balance.
 *
 * Prefers the redeem_giftcard RPC where the database has one, which does all
 * of that in a single statement, and falls back to update-then-log where it
 * does not (error 42883 is "no such function").
 *
 * @returns {Promise<number>} cents actually taken off the card — 0 if nothing was
 */
export async function redeemGiftCardOnce({
  admin,
  bookingId,
  draftId = null,
  cardId = null,
  code = null,
  amountCents,
  currency = "EUR",
  notes = "",
  tryRpc = true,
}) {
  if (
    !bookingId ||
    !(cardId || code) ||
    !Number.isInteger(amountCents) ||
    amountCents <= 0
  ) {
    return 0;
  }

  // 0) Locate card by id or code
  let card = null;
  if (cardId) {
    const { data } = await admin
      .from("GiftCard")
      .select("id, code, currency, status, expires_at, remaining_amount_cents")
      .eq("id", cardId)
      .maybeSingle();
    card = data || null;
  } else if (code) {
    const { data } = await admin
      .from("GiftCard")
      .select("id, code, currency, status, expires_at, remaining_amount_cents")
      .ilike("code", code)
      .maybeSingle();
    card = data || null;
  }
  if (!card) return 0;

  // 1) If we already recorded a redemption for (this card, this booking), bail
  {
    const { data: existing } = await admin
      .from("GiftCardRedemption")
      .select("id, amount_cents")
      .eq("gift_card_id", card.id)
      .eq("booking_id", bookingId)
      .maybeSingle();

    if (existing?.id) {
      return Number(existing.amount_cents || 0) || 0;
    }
  }

  // 2) Cap by remaining balance
  const remain = Math.max(Number(card.remaining_amount_cents || 0), 0);
  if (remain <= 0) return 0;

  const toApply = Math.min(remain, amountCents);

  // 3) Optional basic checks
  const now = new Date();
  if (card.status !== "active") return 0;
  if (card.expires_at && new Date(card.expires_at) < now) return 0;
  if (
    String(card.currency || "EUR").toUpperCase() !==
    String(currency || "EUR").toUpperCase()
  ) {
    // currency mismatch — skip to avoid corrupting the balance
    return 0;
  }

  // 4) Try server-side atomic RPC first (if you created it)
  if (tryRpc) {
    try {
      const { data, error } = await admin.rpc("redeem_giftcard", {
        p_card_id: card.id,
        p_amount_cents: toApply,
        p_booking_id: bookingId,
        p_notes: notes || null,
      });

      if (!error && data && data.id) {
        return toApply;
      }
      if (error && String(error.code) !== "42883") {
        console.warn("[giftcard] RPC failed:", error.message || error);
      }
    } catch (e) {
      if (String(e?.code) !== "42883") {
        console.warn("[giftcard] RPC exception:", e?.message || e);
      }
    }
  }

  // 5) Fallback (best effort): update card, then insert redemption
  // Update remaining & status conditionally (only if still active)
  const newRemaining = remain - toApply;
  const newStatus = newRemaining === 0 ? "redeemed" : "active";

  const { data: updated, error: upErr } = await admin
    .from("GiftCard")
    .update({
      remaining_amount_cents: newRemaining,
      last_redeemed_at: new Date().toISOString(),
      status: newStatus,
    })
    .eq("id", card.id)
    .eq("status", "active")
    .select("id, remaining_amount_cents, status")
    .maybeSingle();

  if (upErr || !updated?.id) {
    console.warn("[giftcard] balance update failed:", upErr?.message || upErr);
    return 0;
  }

  // Insert redemption log (non-fatal if this fails after balance updated)
  const ins = await admin
    .from("GiftCardRedemption")
    .insert({
      gift_card_id: card.id,
      amount_cents: toApply,
      currency: currency,
      booking_id: bookingId,
      notes: notes || null,
    })
    .select("id")
    .maybeSingle();

  if (ins?.error) {
    console.warn(
      "[giftcard] redemption insert failed:",
      ins.error?.message || ins.error,
    );
  }

  return toApply;
}
