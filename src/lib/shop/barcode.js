// src/lib/shop/barcode.js
// EAN-13 helpers. Client-safe: the admin renders barcodes in the browser and
// the API validates them on the way in, so this must not import server code.
//
// The same "2"-prefixed scheme the shop_barcode_for() SQL function produces —
// GS1 reserves 20–29 for in-store use, so our codes cannot collide with a real
// manufacturer's.

const PREFIX = "2";

/** Check digit for the first 12 digits of an EAN-13. */
export function ean13CheckDigit(base12) {
  const s = String(base12 || "");
  if (!/^\d{12}$/.test(s)) return null;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    // 1-indexed even positions carry weight 3
    sum += Number(s[i]) * ((i + 1) % 2 === 0 ? 3 : 1);
  }
  return String((10 - (sum % 10)) % 10);
}

/** Full 13-digit barcode for a product sequence number. */
export function barcodeForSeq(seq) {
  const n = Number(seq);
  if (!Number.isFinite(n) || n < 0) return null;
  const base = PREFIX + String(Math.trunc(n)).padStart(11, "0");
  if (base.length !== 12) return null;
  const check = ean13CheckDigit(base);
  return check === null ? null : base + check;
}

/** Human SKU for a product sequence number. */
export function skuCodeForSeq(seq) {
  const n = Number(seq);
  if (!Number.isFinite(n) || n < 0) return null;
  return `OAS-${String(Math.trunc(n)).padStart(6, "0")}`;
}

export function isValidEan13(code) {
  const s = String(code || "").trim();
  if (!/^\d{13}$/.test(s)) return false;
  return ean13CheckDigit(s.slice(0, 12)) === s[12];
}

/**
 * Clean what a scanner typed. Hardware wedges append Enter and sometimes
 * leading/trailing whitespace; some prepend an AIM identifier like "]E0".
 */
export function normalizeScan(raw) {
  let s = String(raw ?? "").trim();
  s = s.replace(/^\]\w\d/, ""); // AIM symbology identifier
  s = s.replace(/[\r\n\t]/g, "");
  return s.trim();
}

/* ------------------------------ SVG rendering ----------------------------- */

const L = [
  "0001101", "0011001", "0010011", "0111101", "0100011",
  "0110001", "0101111", "0111011", "0110111", "0001011",
];
const G = [
  "0100111", "0110011", "0011011", "0100001", "0011101",
  "0111001", "0000101", "0010001", "0001001", "0010111",
];
const R = [
  "1110010", "1100110", "1101100", "1000010", "1011100",
  "1001110", "1010000", "1000100", "1001000", "1110100",
];
// Which of the first group's six digits use G instead of L, by leading digit.
const PARITY = [
  "LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
  "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL",
];

/** The 95 modules of an EAN-13, as a string of "0"/"1". Null if invalid. */
export function ean13Modules(code) {
  if (!isValidEan13(code)) return null;
  const d = String(code).split("").map(Number);
  const parity = PARITY[d[0]];
  let out = "101"; // start guard
  for (let i = 1; i <= 6; i++) {
    out += parity[i - 1] === "L" ? L[d[i]] : G[d[i]];
  }
  out += "01010"; // centre guard
  for (let i = 7; i <= 12; i++) out += R[d[i]];
  out += "101"; // end guard
  return out;
}

/**
 * Render an EAN-13 as an SVG string. Guard bars run longer than the data bars,
 * and the digits sit in the conventional 1 / 6 / 6 grouping.
 */
export function ean13Svg(code, opts = {}) {
  const modules = ean13Modules(code);
  if (!modules) return null;

  const m = Number(opts.moduleWidth) || 2; // px per module
  const barHeight = Number(opts.height) || 60;
  const showText = opts.showText !== false;
  const quiet = 11 * m; // GS1 asks for 11 modules of quiet zone
  const textH = showText ? 14 : 0;
  const guardExtra = showText ? 8 : 0;
  const width = quiet * 2 + modules.length * m;
  const height = barHeight + textH + 4;
  const color = opts.color || "#2a211a";

  // Guards run past the data bars; these are their module offsets.
  const isGuard = (i) =>
    i < 3 || (i >= 45 && i < 50) || i >= 92;

  let bars = "";
  for (let i = 0; i < modules.length; i++) {
    if (modules[i] !== "1") continue;
    const h = barHeight + (isGuard(i) ? guardExtra : 0);
    bars += `<rect x="${quiet + i * m}" y="0" width="${m}" height="${h}" />`;
  }

  let text = "";
  if (showText) {
    const y = barHeight + guardExtra + 11;
    const fs = Math.max(9, m * 5);
    const digits = String(code);
    const label = (value, x, anchor = "middle") =>
      `<text x="${x}" y="${y}" font-family="monospace" font-size="${fs}" text-anchor="${anchor}" fill="${color}">${value}</text>`;
    text += label(digits[0], quiet - 2 * m, "end");
    text += label(digits.slice(1, 7), quiet + (3 + 21) * m);
    text += label(digits.slice(7), quiet + (50 + 21) * m);
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" role="img" aria-label="Barcode ${code}">` +
    `<rect width="${width}" height="${height}" fill="#ffffff"/>` +
    `<g fill="${color}">${bars}</g>${text}</svg>`
  );
}
