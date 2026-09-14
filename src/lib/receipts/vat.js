/**
 * VAT arithmetic. Pure, so the receipt, the booking page and the PDF all
 * agree on the figures.
 *
 * Prices on the site are VAT-inclusive — the payment page shows "Included VAT
 * (24%)" under a total the guest has already been quoted — so the net is
 * derived from the gross rather than the other way round.
 */

/** Standard Greek rate; override per deployment. */
export function defaultVatRate() {
  const n = Number(process.env.STORE_VAT_RATE);
  return Number.isFinite(n) && n >= 0 ? n : 24;
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Split a VAT-inclusive gross amount.
 * @returns {{gross:number, net:number, vat:number, rate:number}}
 */
export function splitInclusive(gross, rate = defaultVatRate()) {
  const g = round2(gross);
  const r = Number(rate) || 0;
  if (r <= 0) return { gross: g, net: g, vat: 0, rate: 0 };
  const net = round2(g / (1 + r / 100));
  // Derive VAT by subtraction so net + vat always equals the gross exactly,
  // rather than two independent roundings that can disagree by a cent.
  return { gross: g, net, vat: round2(g - net), rate: r };
}
