/**
 * Telling a gift card apart from a discount, after the fact.
 *
 * A booking records one figure — discountAmount — for everything that came
 * off the price. Two very different things land in it:
 *
 *   a discount code or a manual adjustment, which is revenue given away;
 *   a gift card, which is revenue already taken, when the card was sold.
 *
 * Counting them together overstates discounting and understates what the
 * business actually earned, so reporting splits them here. The gift-card
 * portion is whatever was genuinely drawn off a card — recorded in cents on
 * promoJson at redemption — and the rest is the discount.
 *
 * Kept in one place because getting this wrong in one report and right in
 * another is worse than getting it wrong everywhere.
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * @param {{discountAmount?: number, appliedPromoCode?: string, promoJson?: object}} booking
 * @returns {{ total:number, giftCard:number, discount:number, giftCardCode:string|null }}
 */
export function splitBookingDiscount(booking) {
  const total = Math.max(0, round2(booking?.discountAmount));
  if (total <= 0) {
    return { total: 0, giftCard: 0, discount: 0, giftCardCode: null };
  }

  const promo = booking?.promoJson;
  const cents = Number(promo?.giftcard?.appliedCents);

  // The cents recorded at redemption are the reliable figure. Older rows may
  // carry only the "GIFT:" tag, and for those the whole reduction was the
  // card — there was never a way to put a code and a card on one booking.
  let giftCard = 0;
  if (Number.isFinite(cents) && cents > 0) {
    giftCard = round2(cents / 100);
  } else if (
    String(booking?.appliedPromoCode || "").toUpperCase().startsWith("GIFT:") ||
    String(promo?.source || "").toLowerCase() === "giftcard"
  ) {
    giftCard = total;
  }

  giftCard = Math.min(giftCard, total);
  return {
    total,
    giftCard,
    discount: round2(total - giftCard),
    giftCardCode:
      promo?.giftcard?.code ||
      (String(booking?.appliedPromoCode || "").toUpperCase().startsWith("GIFT:")
        ? String(booking.appliedPromoCode).slice(5)
        : null),
  };
}

/** Sum a list of bookings into the same three figures. */
export function sumBookingDiscounts(bookings) {
  return (bookings || []).reduce(
    (acc, b) => {
      const s = splitBookingDiscount(b);
      acc.total = round2(acc.total + s.total);
      acc.giftCard = round2(acc.giftCard + s.giftCard);
      acc.discount = round2(acc.discount + s.discount);
      return acc;
    },
    { total: 0, giftCard: 0, discount: 0 },
  );
}
