// src/lib/countries.ts
// Countries, dial codes and the phone helpers that go with them.
//
// Mirrors the website's @/lib/phone so a number typed in the app is stored in
// exactly the form the server validates and the manifest dials: "+30 6912345678".
// Without the dial code the server has to guess the country, and a foreign
// guest's number would be stored as Greek — misdialled from the manifest.

export type Country = { code: string; label: string; dial: string; flag: string };

export const DEFAULT_COUNTRY = "GR";

export const COUNTRIES: Country[] = [
  { code: "GR", label: "Greece", dial: "30", flag: "🇬🇷" },
  { code: "GB", label: "United Kingdom", dial: "44", flag: "🇬🇧" },
  { code: "DE", label: "Germany", dial: "49", flag: "🇩🇪" },
  { code: "FR", label: "France", dial: "33", flag: "🇫🇷" },
  { code: "IT", label: "Italy", dial: "39", flag: "🇮🇹" },
  { code: "NL", label: "Netherlands", dial: "31", flag: "🇳🇱" },
  { code: "US", label: "United States", dial: "1", flag: "🇺🇸" },
  { code: "AT", label: "Austria", dial: "43", flag: "🇦🇹" },
  { code: "AU", label: "Australia", dial: "61", flag: "🇦🇺" },
  { code: "BE", label: "Belgium", dial: "32", flag: "🇧🇪" },
  { code: "BG", label: "Bulgaria", dial: "359", flag: "🇧🇬" },
  { code: "CA", label: "Canada", dial: "1", flag: "🇨🇦" },
  { code: "CH", label: "Switzerland", dial: "41", flag: "🇨🇭" },
  { code: "CY", label: "Cyprus", dial: "357", flag: "🇨🇾" },
  { code: "CZ", label: "Czechia", dial: "420", flag: "🇨🇿" },
  { code: "DK", label: "Denmark", dial: "45", flag: "🇩🇰" },
  { code: "EE", label: "Estonia", dial: "372", flag: "🇪🇪" },
  { code: "ES", label: "Spain", dial: "34", flag: "🇪🇸" },
  { code: "FI", label: "Finland", dial: "358", flag: "🇫🇮" },
  { code: "HR", label: "Croatia", dial: "385", flag: "🇭🇷" },
  { code: "HU", label: "Hungary", dial: "36", flag: "🇭🇺" },
  { code: "IE", label: "Ireland", dial: "353", flag: "🇮🇪" },
  { code: "IL", label: "Israel", dial: "972", flag: "🇮🇱" },
  { code: "IS", label: "Iceland", dial: "354", flag: "🇮🇸" },
  { code: "JP", label: "Japan", dial: "81", flag: "🇯🇵" },
  { code: "LT", label: "Lithuania", dial: "370", flag: "🇱🇹" },
  { code: "LU", label: "Luxembourg", dial: "352", flag: "🇱🇺" },
  { code: "LV", label: "Latvia", dial: "371", flag: "🇱🇻" },
  { code: "MT", label: "Malta", dial: "356", flag: "🇲🇹" },
  { code: "NO", label: "Norway", dial: "47", flag: "🇳🇴" },
  { code: "NZ", label: "New Zealand", dial: "64", flag: "🇳🇿" },
  { code: "PL", label: "Poland", dial: "48", flag: "🇵🇱" },
  { code: "PT", label: "Portugal", dial: "351", flag: "🇵🇹" },
  { code: "RO", label: "Romania", dial: "40", flag: "🇷🇴" },
  { code: "RS", label: "Serbia", dial: "381", flag: "🇷🇸" },
  { code: "SE", label: "Sweden", dial: "46", flag: "🇸🇪" },
  { code: "SI", label: "Slovenia", dial: "386", flag: "🇸🇮" },
  { code: "SK", label: "Slovakia", dial: "421", flag: "🇸🇰" },
  { code: "TR", label: "Türkiye", dial: "90", flag: "🇹🇷" },
  { code: "ZA", label: "South Africa", dial: "27", flag: "🇿🇦" },
];

export function countryByCode(code?: string | null): Country {
  const c = String(code ?? "").trim().toUpperCase();
  return COUNTRIES.find((x) => x.code === c) ?? COUNTRIES[0];
}

/** Match a stored value that might be a code ("GR") or a name ("Greece"). */
export function findCountry(value?: string | null): Country | undefined {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return undefined;
  return COUNTRIES.find((x) => x.code.toLowerCase() === v || x.label.toLowerCase() === v);
}

const digitsOnly = (v?: string | null) => String(v ?? "").replace(/\D+/g, "");

/** Leading zeros are trunk prefixes and never belong in the stored number. */
export function normalizeNational(v?: string | null): string {
  return digitsOnly(v).replace(/^0+/, "");
}

export function isValidNational(v?: string | null): boolean {
  const n = normalizeNational(v);
  return n.length >= 4 && n.length <= 14;
}

/** "+30 6912345678" — the form the server stores and validates. */
export function formatPhone(code: string, national: string): string {
  const c = countryByCode(code);
  const n = normalizeNational(national);
  return n ? `+${c.dial} ${n}` : "";
}

/** Split a stored value back into a country and a national number. */
export function splitPhone(stored?: string | null): { code: string; national: string } {
  const raw = String(stored ?? "").trim();
  if (!raw) return { code: DEFAULT_COUNTRY, national: "" };
  const digits = digitsOnly(raw);
  if (raw.startsWith("+") || raw.startsWith("00")) {
    // Longest dial code first so +1 cannot shadow +30 or +351.
    const byLength = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
    const body = raw.startsWith("00") ? digits.replace(/^00/, "") : digits;
    for (const c of byLength) {
      if (body.startsWith(c.dial)) {
        return { code: c.code, national: body.slice(c.dial.length) };
      }
    }
  }
  return { code: DEFAULT_COUNTRY, national: normalizeNational(digits) };
}
