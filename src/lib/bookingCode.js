// src/lib/bookingCode.js
// Booking references. Pure and client-safe.
//
// New bookings carry a random `code` (BK-XXXX-XXXX, Crockford base32). Older
// ones predate the column and are still referred to by "BK-" plus their row id
// in emails customers already have, so both forms have to keep working.

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Tidy whatever the customer typed into a comparable code.
 *
 * Crockford's substitutions matter here: someone reading a code aloud will say
 * "oh" for 0 and "eye" for 1, and the listener will type O and I.
 */
export function normalizeBookingCode(input) {
  let s = String(input ?? "").toUpperCase().replace(/[\s-]/g, "");
  if (s.startsWith("BK")) s = s.slice(2);
  s = s.replace(/[OQ]/g, "0").replace(/[IL]/g, "1").replace(/U/g, "V");
  if (!/^[0-9A-Z]{8}$/.test(s)) return null;
  if ([...s].some((c) => !ALPHABET.includes(c))) return null;
  return `BK-${s.slice(0, 4)}-${s.slice(4)}`;
}

/** The reference to show for a booking: its code, else the legacy id form. */
export function bookingRef(booking) {
  if (typeof booking === "string") return booking;
  if (booking && typeof booking === "object" && booking.code) return booking.code;
  const id = typeof booking === "number" ? booking : booking?.id;
  const n = Number(id ?? 0);
  return `BK-${String(n).padStart(6, "0")}`;
}

/** The legacy numeric id inside a reference, when there is one. */
export function legacyBookingId(input) {
  const s = String(input ?? "").toUpperCase().replace(/[\s-]/g, "");
  const digits = s.startsWith("BK") ? s.slice(2) : s;
  if (!/^\d+$/.test(digits)) return null;
  const n = parseInt(digits, 10);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
