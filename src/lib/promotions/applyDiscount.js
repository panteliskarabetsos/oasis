/**
 * Turning a discount into money off.
 *
 * A code says "25%" or "20 EUR"; a booking has a subtotal. Every surface that
 * applies one has to reach the same figure, or the total shown to the admin,
 * the amount on the payment link and the balance on the booking will disagree
 * with each other.
 *
 * No "server-only": the admin form works the sum out as you type, and the API
 * works it out again before trusting it.
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const DISCOUNT_TYPES = Object.freeze(["percent", "amount"]);

/**
 * Money off a subtotal, never more than the subtotal and never negative.
 *
 * @param {{discountType?: string, discountValue?: number|string}} discount
 * @param {number} subtotal
 * @returns {number} an amount in the same currency units as `subtotal`
 */
export function discountAmountFor(discount, subtotal) {
  const base = Math.max(0, Number(subtotal) || 0);
  if (!discount || base <= 0) return 0;

  const type = String(discount.discountType || "percent").toLowerCase();
  const raw = Number(discount.discountValue);
  if (!Number.isFinite(raw) || raw <= 0) return 0;

  const off =
    type === "percent" ? (base * Math.min(raw, 100)) / 100 : raw;

  // Nothing is ever worth less than free: a 200 EUR voucher on a 95 EUR
  // booking takes 95 off, not 200, which would otherwise leave a negative
  // total and a payment link Stripe refuses to create.
  return round2(Math.min(Math.max(off, 0), base));
}

/** "25% off" / "20.00 EUR off" — for a chip next to the code. */
export function describeDiscount(discount, currency = "EUR") {
  if (!discount) return "";
  const type = String(discount.discountType || "percent").toLowerCase();
  const raw = Number(discount.discountValue) || 0;
  return type === "percent"
    ? `${round2(raw)}% off`
    : `${round2(raw).toFixed(2)} ${currency} off`;
}
