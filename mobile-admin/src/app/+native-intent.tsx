/**
 * Deep links that arrive from outside the app.
 *
 * Stripe returns to `oasisadmin://stripe-redirect` when a card charge at the
 * till needs 3-D Secure. That path is not a screen, so expo-router matched
 * nothing and rendered its "unmatched route" page — a black screen mid-sale.
 *
 * Returning null tells expo-router not to navigate at all. The card sheet is
 * still open underneath and the Stripe SDK resumes it, so the cashier is left
 * exactly where they were.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  try {
    if (isStripeReturn(path)) return null;
    return path;
  } catch {
    // Never throw from here — a bad URL must not take the app down on launch.
    return path;
  }
}

function isStripeReturn(path: string): boolean {
  // The URL can arrive as "oasisadmin://stripe-redirect", with a path form
  // ("/stripe-redirect"), and with query parameters appended by Stripe.
  return /(^|\/\/|\/)stripe-redirect(\/|\?|#|$)/i.test(String(path ?? ""));
}
