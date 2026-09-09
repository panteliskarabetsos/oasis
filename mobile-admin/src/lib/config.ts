// Runtime configuration. Values come from EXPO_PUBLIC_* env vars
// (put them in mobile/.env — see .env.example).

export const config = {
  /** Base URL of the Oasis website whose API routes this app consumes. */
  apiUrl: (process.env.EXPO_PUBLIC_API_URL || "https://www.youroasis.gr").replace(/\/+$/, ""),
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "",
  supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL || "info@youroasis.gr",
  supportPhone: process.env.EXPO_PUBLIC_SUPPORT_PHONE || "",
  stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
};

export const hasSupabase = Boolean(config.supabaseUrl && config.supabaseAnonKey);

/** Project ref, e.g. "abcd1234" from https://abcd1234.supabase.co */
export const supabaseProjectRef = (() => {
  try {
    return new URL(config.supabaseUrl).hostname.split(".")[0] ?? "";
  } catch {
    return "";
  }
})();
