// src/lib/bookingCode.js
// Booking references. Pure and client-safe.
//
// A reference is short enough to read down the phone: five characters, no
// prefix and no dashes — "7Q2K9". Bookings made before that carry the older
// BK-XXXX-XXXX form, and ones older still are known only by "BK-" plus their
// row id in emails guests already hold, so all three have to keep resolving.

/**
 * Crockford base32: no I, L, O or U.
 *
 * Someone reading a code aloud says "oh" for 0 and "eye" for 1, and the
 * listener types O and I. Leaving those letters out of the alphabet means the
 * mistake can be corrected rather than looked up and not found. 32^5 is about
 * 33.5 million references.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Length of a current booking code. */
export const CODE_LENGTH = 5;

/** Length of the previous random format, after its "BK" and dashes come off. */
const LEGACY_CODE_LENGTH = 8;

/**
 * Map the characters people mistype onto the ones the alphabet uses.
 *
 * Only letters the alphabet leaves out may be folded. Q is *in* it, so folding
 * Q to 0 — as this did — turned every code containing a Q into one that
 * matched nothing, and those guests could not look their own booking up.
 */
function fold(s) {
  return s
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/U/g, "V");
}

function inAlphabet(s) {
  return [...s].every((c) => ALPHABET.includes(c));
}

/**
 * Tidy whatever the guest typed into a comparable code, or null.
 *
 * Returns the current short form as-is, and the older random form in its
 * BK-XXXX-XXXX shape, so each matches what is stored against those bookings.
 * "BK-000388" is not a code at all — see legacyBookingId.
 */
export function normalizeBookingCode(input) {
  const cleaned = String(input ?? "").toUpperCase().replace(/[\s-]/g, "");
  if (!cleaned) return null;

  // Current format. Checked before stripping any prefix, because a five
  // character code is allowed to begin with the letters B and K.
  if (cleaned.length === CODE_LENGTH) {
    const body = fold(cleaned);
    return inAlphabet(body) ? body : null;
  }

  const body = cleaned.startsWith("BK") ? cleaned.slice(2) : cleaned;

  // "BK-000388" is a row id wearing a prefix, not a random code.
  if (/^\d+$/.test(body) && body.length !== LEGACY_CODE_LENGTH) return null;

  if (body.length === LEGACY_CODE_LENGTH) {
    const folded = fold(body);
    if (!inAlphabet(folded)) return null;
    return `BK-${folded.slice(0, 4)}-${folded.slice(4)}`;
  }

  return null;
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

/**
 * Tidy a reference as it is typed, for an input the guest is looking at.
 *
 * Shows exactly what will be searched for, so a misread O or I is corrected in
 * front of them rather than turning into "booking not found".
 */
export function formatBookingCodeInput(raw) {
  const cleaned = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cleaned) return "";

  // Short enough to still be the current format — including a code that
  // happens to start with BK — so leave it whole.
  if (cleaned.length <= CODE_LENGTH) return fold(cleaned);

  // Longer means one of the older forms, which carried the BK prefix.
  const body = cleaned.startsWith("BK") ? cleaned.slice(2) : cleaned;
  if (/^\d+$/.test(body)) return `BK-${body.slice(0, 10)}`;

  const folded = fold(body).slice(0, LEGACY_CODE_LENGTH);
  return folded.length <= 4
    ? `BK-${folded}`
    : `BK-${folded.slice(0, 4)}-${folded.slice(4)}`;
}
