/**
 * Deep links that arrive from outside the app.
 *
 * Stripe sends the customer back to `oasis://stripe-redirect` after a
 * redirect-based payment method — Revolut Pay, and 3-D Secure on a card. That
 * path is not a screen, so expo-router matched nothing and rendered its
 * "unmatched route" page: the black screen people saw after paying.
 *
 * Returning null tells expo-router not to navigate at all, which is what we
 * want here. The payment sheet is still open underneath and the Stripe SDK
 * resumes it, so the customer lands back exactly where they left off.
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
  // The URL can arrive as "oasis://stripe-redirect", with a path form
  // ("/stripe-redirect"), and with query parameters appended by Stripe.
  return /(^|\/\/|\/)stripe-redirect(\/|\?|#|$)/i.test(String(path ?? ""));
}
