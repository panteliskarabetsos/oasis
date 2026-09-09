/**
 * Phone helpers shared by the booking flow and the API.
 *
 * Numbers are stored as E.164-style "+<dial><national>" so a guide can tap to
 * call from the manifest regardless of where the guest is from.
 */

/** Countries we actually see, most likely first, then the rest alphabetically. */
export const COUNTRY_CODES = [
  { iso: "GR", name: "Greece", dial: "30", flag: "🇬🇷" },
  { iso: "GB", name: "United Kingdom", dial: "44", flag: "🇬🇧" },
  { iso: "DE", name: "Germany", dial: "49", flag: "🇩🇪" },
  { iso: "FR", name: "France", dial: "33", flag: "🇫🇷" },
  { iso: "IT", name: "Italy", dial: "39", flag: "🇮🇹" },
  { iso: "NL", name: "Netherlands", dial: "31", flag: "🇳🇱" },
  { iso: "US", name: "United States", dial: "1", flag: "🇺🇸" },
  { iso: "AT", name: "Austria", dial: "43", flag: "🇦🇹" },
  { iso: "AU", name: "Australia", dial: "61", flag: "🇦🇺" },
  { iso: "BE", name: "Belgium", dial: "32", flag: "🇧🇪" },
  { iso: "BG", name: "Bulgaria", dial: "359", flag: "🇧🇬" },
  { iso: "CA", name: "Canada", dial: "1", flag: "🇨🇦" },
  { iso: "CH", name: "Switzerland", dial: "41", flag: "🇨🇭" },
  { iso: "CY", name: "Cyprus", dial: "357", flag: "🇨🇾" },
  { iso: "CZ", name: "Czechia", dial: "420", flag: "🇨🇿" },
  { iso: "DK", name: "Denmark", dial: "45", flag: "🇩🇰" },
  { iso: "EE", name: "Estonia", dial: "372", flag: "🇪🇪" },
  { iso: "ES", name: "Spain", dial: "34", flag: "🇪🇸" },
  { iso: "FI", name: "Finland", dial: "358", flag: "🇫🇮" },
  { iso: "HR", name: "Croatia", dial: "385", flag: "🇭🇷" },
  { iso: "HU", name: "Hungary", dial: "36", flag: "🇭🇺" },
  { iso: "IE", name: "Ireland", dial: "353", flag: "🇮🇪" },
  { iso: "IL", name: "Israel", dial: "972", flag: "🇮🇱" },
  { iso: "IS", name: "Iceland", dial: "354", flag: "🇮🇸" },
  { iso: "JP", name: "Japan", dial: "81", flag: "🇯🇵" },
  { iso: "LT", name: "Lithuania", dial: "370", flag: "🇱🇹" },
  { iso: "LU", name: "Luxembourg", dial: "352", flag: "🇱🇺" },
  { iso: "LV", name: "Latvia", dial: "371", flag: "🇱🇻" },
  { iso: "MT", name: "Malta", dial: "356", flag: "🇲🇹" },
  { iso: "NO", name: "Norway", dial: "47", flag: "🇳🇴" },
  { iso: "NZ", name: "New Zealand", dial: "64", flag: "🇳🇿" },
  { iso: "PL", name: "Poland", dial: "48", flag: "🇵🇱" },
  { iso: "PT", name: "Portugal", dial: "351", flag: "🇵🇹" },
  { iso: "RO", name: "Romania", dial: "40", flag: "🇷🇴" },
  { iso: "RS", name: "Serbia", dial: "381", flag: "🇷🇸" },
  { iso: "SE", name: "Sweden", dial: "46", flag: "🇸🇪" },
  { iso: "SI", name: "Slovenia", dial: "386", flag: "🇸🇮" },
  { iso: "SK", name: "Slovakia", dial: "421", flag: "🇸🇰" },
  { iso: "TR", name: "Türkiye", dial: "90", flag: "🇹🇷" },
  { iso: "ZA", name: "South Africa", dial: "27", flag: "🇿🇦" },
];

export const DEFAULT_COUNTRY = "GR";

export function countryByIso(iso) {
  return COUNTRY_CODES.find((c) => c.iso === iso) || COUNTRY_CODES[0];
}

/** Digits only, so spaces, dashes and brackets never reach the database. */
export function digitsOnly(v) {
  return String(v ?? "").replace(/\D+/g, "");
}

/**
 * A national number is 4–14 digits; with the dial code the total stays inside
 * E.164's 15-digit limit. Leading zeros are trunk prefixes and are dropped.
 */
export function normalizeNational(v) {
  return digitsOnly(v).replace(/^0+/, "");
}

export function isValidNational(v) {
  const n = normalizeNational(v);
  return n.length >= 4 && n.length <= 14;
}

/** "+30 6912345678" — the stored form. */
export function formatPhone(iso, national) {
  const c = countryByIso(iso);
  const n = normalizeNational(national);
  return n ? `+${c.dial} ${n}` : "";
}

/** Full E.164 with no spaces, for `tel:` links. */
export function toE164(iso, national) {
  const c = countryByIso(iso);
  const n = normalizeNational(national);
  return n ? `+${c.dial}${n}` : "";
}

/** Split a stored value back into a country + national number for editing. */
export function splitPhone(stored) {
  const raw = String(stored ?? "").trim();
  if (!raw) return { iso: DEFAULT_COUNTRY, national: "" };

  const digits = digitsOnly(raw);
  if (raw.startsWith("+") || raw.startsWith("00")) {
    // Longest dial code wins so +1 doesn't shadow +30, +351, etc.
    const byLength = [...COUNTRY_CODES].sort((a, b) => b.dial.length - a.dial.length);
    const body = raw.startsWith("00") ? digits.replace(/^00/, "") : digits;
    for (const c of byLength) {
      if (body.startsWith(c.dial)) {
        return { iso: c.iso, national: body.slice(c.dial.length) };
      }
    }
  }
  return { iso: DEFAULT_COUNTRY, national: normalizeNational(digits) };
}

/** Server-side check for a stored phone value. */
export function isValidStoredPhone(stored) {
  const { national } = splitPhone(stored);
  return isValidNational(national);
}
