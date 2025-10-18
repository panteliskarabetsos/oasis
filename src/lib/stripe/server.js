// /lib/stripe/server.js
import Stripe from "stripe";

const API_VERSION = "2024-06-20";

/**
 * Extract a clean Stripe secret key from an env var that might include
 * stray quotes, comments, or trailing characters.
 */
function cleanSecretKey(raw = "") {
  // Keep only a valid-looking key substring (test or live)
  const m = String(raw).match(/sk_(test|live)_[A-Za-z0-9]+/);
  return (m?.[0] || "").trim();
}

/**
 * Read & validate the STRIPE_SECRET_KEY once.
 * Throws with a helpful message if it's missing or malformed.
 */
function readSecretKey() {
  const key = cleanSecretKey(process.env.STRIPE_SECRET_KEY);
  if (!key) {
    const raw = process.env.STRIPE_SECRET_KEY || "";
    throw new Error(
      `[stripe] Missing or invalid STRIPE_SECRET_KEY. Got: "${raw.slice(
        0,
        12
      )}${raw ? "…" : ""}". ` +
        `Ensure it's exactly sk_test_… (for test) or sk_live_… (for live) with no quotes or trailing text.`
    );
  }
  return key;
}

/**
 * Memoized Stripe client (singleton). Survives hot-reloads in dev.
 */
let _stripe = null;
export function getStripe() {
  if (_stripe) return _stripe;
  const key = readSecretKey();
  _stripe = new Stripe(key, { apiVersion: API_VERSION });
  if (process.env.NODE_ENV !== "production") {
    // Log once on first init so you can confirm mode in the server console.
    // (Avoid logging the full key.)
    const mode = key.includes("_test_") ? "TEST" : "LIVE";
    // eslint-disable-next-line no-console
    console.log(`[stripe] Initialized (${mode} mode)`);
  }
  return _stripe;
}

/**
 * Convenience: are we running with test keys?
 */
export function isTestMode() {
  try {
    return readSecretKey().includes("_test_");
  } catch {
    return false;
  }
}

/**
 * Convenience: build request options for Stripe Connect calls.
 * Usage:
 *   const stripe = getStripe();
 *   const { opts } = withAccount("acct_123");
 *   await stripe.paymentIntents.list({ limit: 10 }, opts);
 */
export function withAccount(stripeAccount) {
  const opts = stripeAccount ? { stripeAccount } : undefined;
  return { stripe: getStripe(), opts };
}

/**
 * Optional: verify webhook signatures.
 * - Pass the raw request body (Buffer or string) and the signature header.
 * - Requires STRIPE_WEBHOOK_SECRET (whsec_… from Stripe Dashboard or CLI).
 *
 * Example in a Next.js App Router route:
 *   export async function POST(req) {
 *     const raw = await req.text(); // IMPORTANT: use text/arrayBuffer, not req.json()
 *     const sig = req.headers.get('stripe-signature');
 *     const event = constructEvent(raw, sig);
 *     // handle event.type ...
 *   }
 */
export function constructEvent(rawBody, signature) {
  const whsecRaw = process.env.STRIPE_WEBHOOK_SECRET || "";
  const whsec = (whsecRaw.match(/whsec_[A-Za-z0-9]+/) || [])[0];
  if (!whsec) {
    throw new Error(
      "[stripe] Missing STRIPE_WEBHOOK_SECRET. Set a test (or live) whsec_… in your env."
    );
  }
  return getStripe().webhooks.constructEvent(rawBody, signature, whsec);
}
