// src/lib/countries.ts
// Fallback destination list.
//
// The shop tells us which countries it delivers to, but an older deployment
// does not send that list. Rather than drop back to a free-text box — which
// let customers type somewhere we cannot ship and only fail at payment — offer
// this list and let the delivery quote say whether it is possible.
//
// Mirrors COUNTRY_CODES in the website's @/lib/phone.

export type Country = { code: string; label: string; flag: string };

export const COUNTRIES: Country[] = [
  { code: "GR", label: "Greece", flag: "🇬🇷" },
  { code: "GB", label: "United Kingdom", flag: "🇬🇧" },
  { code: "DE", label: "Germany", flag: "🇩🇪" },
  { code: "FR", label: "France", flag: "🇫🇷" },
  { code: "IT", label: "Italy", flag: "🇮🇹" },
  { code: "NL", label: "Netherlands", flag: "🇳🇱" },
  { code: "US", label: "United States", flag: "🇺🇸" },
  { code: "AT", label: "Austria", flag: "🇦🇹" },
  { code: "AU", label: "Australia", flag: "🇦🇺" },
  { code: "BE", label: "Belgium", flag: "🇧🇪" },
  { code: "BG", label: "Bulgaria", flag: "🇧🇬" },
  { code: "CA", label: "Canada", flag: "🇨🇦" },
  { code: "CH", label: "Switzerland", flag: "🇨🇭" },
  { code: "CY", label: "Cyprus", flag: "🇨🇾" },
  { code: "CZ", label: "Czechia", flag: "🇨🇿" },
  { code: "DK", label: "Denmark", flag: "🇩🇰" },
  { code: "EE", label: "Estonia", flag: "🇪🇪" },
  { code: "ES", label: "Spain", flag: "🇪🇸" },
  { code: "FI", label: "Finland", flag: "🇫🇮" },
  { code: "HR", label: "Croatia", flag: "🇭🇷" },
  { code: "HU", label: "Hungary", flag: "🇭🇺" },
  { code: "IE", label: "Ireland", flag: "🇮🇪" },
  { code: "IL", label: "Israel", flag: "🇮🇱" },
  { code: "IS", label: "Iceland", flag: "🇮🇸" },
  { code: "JP", label: "Japan", flag: "🇯🇵" },
  { code: "LT", label: "Lithuania", flag: "🇱🇹" },
  { code: "LU", label: "Luxembourg", flag: "🇱🇺" },
  { code: "LV", label: "Latvia", flag: "🇱🇻" },
  { code: "MT", label: "Malta", flag: "🇲🇹" },
  { code: "NO", label: "Norway", flag: "🇳🇴" },
  { code: "NZ", label: "New Zealand", flag: "🇳🇿" },
  { code: "PL", label: "Poland", flag: "🇵🇱" },
  { code: "PT", label: "Portugal", flag: "🇵🇹" },
  { code: "RO", label: "Romania", flag: "🇷🇴" },
  { code: "RS", label: "Serbia", flag: "🇷🇸" },
  { code: "SE", label: "Sweden", flag: "🇸🇪" },
  { code: "SI", label: "Slovenia", flag: "🇸🇮" },
  { code: "SK", label: "Slovakia", flag: "🇸🇰" },
  { code: "TR", label: "Türkiye", flag: "🇹🇷" },
  { code: "ZA", label: "South Africa", flag: "🇿🇦" },
];

export function countryByCode(code?: string | null): Country | undefined {
  const c = String(code ?? "").trim().toUpperCase();
  return COUNTRIES.find((x) => x.code === c);
}

/** Match a stored value that might be a code ("GR") or a name ("Greece"). */
export function findCountry(value?: string | null): Country | undefined {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return undefined;
  return COUNTRIES.find(
    (x) => x.code.toLowerCase() === v || x.label.toLowerCase() === v,
  );
}
