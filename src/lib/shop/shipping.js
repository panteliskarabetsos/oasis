// src/lib/shop/shipping.js
// Courier pricing. Pure and client-safe: the storefront quotes with it before
// checkout and the server re-computes with it at checkout, so both agree.
//
// The model matches how Greek couriers actually bill: a base price covering a
// base weight, then a rate per extra kilo, per destination zone — with the
// chargeable weight being the greater of real and volumetric weight.

/** Shape used when the shop has no rates configured yet. */
export const DEFAULT_SHIPPING = {
  enabled: false,
  freeOverCents: 0,
  handlingCents: 0,
  volumetricDivisor: 5000,
  pickup: { enabled: true, label: "Collect from us in Chania", cents: 0 },
  zones: [
    {
      id: "gr",
      label: "Greece",
      countries: ["GR"],
      baseCents: 350,
      baseGrams: 2000,
      extraCentsPerKg: 100,
      maxGrams: 20000,
    },
  ],
};

const norm = (v) => String(v ?? "").trim().toLowerCase();

/** Greece written a dozen ways by customers typing into a phone. */
const GREECE = new Set(["gr", "grc", "greece", "ελλάδα", "ελλαδα", "hellas", "gr-gr"]);

/** ISO-ish code for a free-text country field. */
export function countryCode(input) {
  const s = norm(input);
  if (!s) return "";
  if (GREECE.has(s)) return "GR";
  if (s.length === 2) return s.toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

/** Pick the zone serving a country; "*" is the catch-all. */
export function zoneFor(settings, country) {
  const zones = Array.isArray(settings?.zones) ? settings.zones : [];
  const code = countryCode(country);
  return (
    zones.find((z) => (z.countries || []).some((c) => String(c).toUpperCase() === code)) ||
    zones.find((z) => (z.countries || []).includes("*")) ||
    null
  );
}

/**
 * Chargeable weight in grams for a basket.
 * Couriers bill the greater of real weight and volume-derived weight.
 */
export function chargeableGrams(lines = [], divisor = 5000) {
  let real = 0;
  let volumetric = 0;
  for (const l of lines) {
    const qty = Math.max(0, Number(l.quantity) || 0);
    real += (Number(l.shipping_weight_grams) || 0) * qty;
    const L = Number(l.shipping_length_cm) || 0;
    const W = Number(l.shipping_width_cm) || 0;
    const H = Number(l.shipping_height_cm) || 0;
    if (L > 0 && W > 0 && H > 0 && divisor > 0) {
      // (cm³ / divisor) is kilos by courier convention; ×1000 for grams.
      volumetric += ((L * W * H) / divisor) * 1000 * qty;
    }
  }
  return Math.round(Math.max(real, volumetric));
}

/**
 * Price a delivery.
 *
 * @returns {{
 *   cents:number, method:"courier"|"pickup"|"free", label:string,
 *   grams:number, zone:string|null, free:boolean, available:boolean,
 *   reason?:string
 * }}
 */
export function quoteShipping({ lines = [], settings, country, method = "courier", subtotalCents = 0 }) {
  const cfg = { ...DEFAULT_SHIPPING, ...(settings || {}) };

  if (method === "pickup") {
    if (!cfg.pickup?.enabled) {
      return { cents: 0, method: "courier", label: "", grams: 0, zone: null, free: false, available: false, reason: "Collection is not offered." };
    }
    return {
      cents: Math.max(0, Number(cfg.pickup.cents) || 0),
      method: "pickup",
      label: cfg.pickup.label || "Collect from us",
      grams: 0,
      zone: null,
      free: (Number(cfg.pickup.cents) || 0) === 0,
      available: true,
    };
  }

  // Shipping switched off entirely means everything travels free — the shop
  // was built that way before rates existed and must keep working.
  if (!cfg.enabled) {
    return { cents: 0, method: "free", label: "Shipping included", grams: 0, zone: null, free: true, available: true };
  }

  const grams = chargeableGrams(lines, Number(cfg.volumetricDivisor) || 5000);
  const zone = zoneFor(cfg, country);
  if (!zone) {
    return {
      cents: 0, method: "courier", label: "", grams, zone: null, free: false,
      available: false,
      reason: "We do not ship to that country yet.",
    };
  }

  const maxGrams = Number(zone.maxGrams) || 0;
  if (maxGrams > 0 && grams > maxGrams) {
    return {
      cents: 0, method: "courier", label: zone.label || "", grams, zone: zone.id ?? null, free: false,
      available: false,
      reason: `That basket weighs more than the ${(maxGrams / 1000).toFixed(1)} kg this destination accepts. Please contact us.`,
    };
  }

  const freeOver = Number(cfg.freeOverCents) || 0;
  if (freeOver > 0 && subtotalCents >= freeOver) {
    return {
      cents: 0, method: "courier", label: `${zone.label || "Delivery"} — free`, grams,
      zone: zone.id ?? null, free: true, available: true,
    };
  }

  const baseCents = Math.max(0, Number(zone.baseCents) || 0);
  const baseGrams = Math.max(0, Number(zone.baseGrams) || 0);
  const perKg = Math.max(0, Number(zone.extraCentsPerKg) || 0);
  const over = Math.max(0, grams - baseGrams);
  // Couriers round part-kilos up, never down.
  const extraKg = perKg > 0 ? Math.ceil(over / 1000) : 0;
  const cents = baseCents + extraKg * perKg + (Math.max(0, Number(cfg.handlingCents) || 0));

  return {
    cents,
    method: "courier",
    label: zone.label || "Courier",
    grams,
    zone: zone.id ?? null,
    free: false,
    available: true,
  };
}
