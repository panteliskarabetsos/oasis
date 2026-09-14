import "server-only";
import { splitInclusive, defaultVatRate } from "./vat";

/**
 * Issue the fiscal receipt for a paid booking.
 *
 * One receipt per booking, enforced by looking for an existing one first —
 * the webhook and the guest's return to the success page both land here, and
 * a customer must never end up holding two documents with different numbers
 * for one payment.
 *
 * The series and number come from the database trigger, so numbering stays
 * gapless even when two payments settle at once.
 */
export async function issueReceiptForBooking(admin, booking, opts = {}) {
  if (!admin || !booking?.id) return { ok: false, reason: "bad-request" };

  const gross = Number(booking.totalPaidAmount) || 0;
  if (gross <= 0) return { ok: false, reason: "nothing-paid" };

  // Already issued? Hand back the same document.
  const { data: existing } = await admin
    .from("Receipt")
    .select("*")
    .eq("bookingId", booking.id)
    .limit(1);
  if (existing?.length) return { ok: true, receipt: existing[0], reused: true };

  const rate = Number(opts.vatRate ?? defaultVatRate());
  const { net, vat } = splitInclusive(gross, rate);

  const adults = Number(booking.adultsCount ?? booking.counts?.adults ?? 0);
  const kids = Number(booking.kidsCount ?? booking.counts?.kids ?? 0);
  const name =
    opts.experienceName ||
    booking.customExperienceName ||
    booking.Experience?.name ||
    "Experience booking";

  // One line per price band, so the document shows what was actually sold
  // rather than a single opaque total.
  const items = [];
  const unitAdult = Number(booking.unitPriceAdult) || 0;
  const unitKid = Number(booking.unitPriceKid) || 0;
  if (adults > 0 && unitAdult > 0)
    items.push({ name: `${name} — adult`, quantity: adults, unitPrice: unitAdult, vatRate: rate });
  if (kids > 0 && unitKid > 0)
    items.push({ name: `${name} — child`, quantity: kids, unitPrice: unitKid, vatRate: rate });
  if (!items.length)
    items.push({ name, quantity: 1, unitPrice: gross, vatRate: rate });

  const contact = booking.primary_contact || {};
  const payload = {
    items,
    totalPaidAmount: gross,
    currency: String(booking.currency || "EUR").toUpperCase(),
    netAmount: net,
    vatAmount: vat,
    vatRate: rate,
    docType: "retail",
    issuedAt: new Date().toISOString(),
    bookingId: booking.id,
    relatedBookingRef: booking.code || String(booking.id),
    customerName:
      contact.name ||
      [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() ||
      null,
    customerEmail: contact.email || null,
    paymentMethod: opts.paymentMethod || "card",
    paymentReference:
      opts.paymentReference || booking.stripePaymentIntentId || null,
    stripePaymentIntentId: booking.stripePaymentIntentId || null,
    transactionType: "booking",
    // Left pending on purpose: it goes to AADE when a transmitter exists.
    mydataStatus: "pending",
  };

  const { data, error } = await admin
    .from("Receipt")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    // The column set only exists once its migration has run; a booking must
    // still confirm on a deployment that predates it.
    if (error.code === "42703" || error.code === "PGRST204") {
      console.warn("[receipt] fiscal columns missing; skipping issue");
      return { ok: false, reason: "no-schema" };
    }
    console.error("[receipt] issue failed for booking", booking.id, error.message);
    return { ok: false, reason: error.message };
  }

  return { ok: true, receipt: data, reused: false };
}

/** "B-000014" — what the customer quotes back at you. */
export function receiptNumber(receipt) {
  if (!receipt) return null;
  const series = receipt.series || "B";
  const n = Number(receipt.number) || 0;
  return `${series}-${String(n).padStart(6, "0")}`;
}
