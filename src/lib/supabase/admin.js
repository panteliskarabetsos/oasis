// src/lib/supabase/admin.js
import { createClient } from "@supabase/supabase-js";

let adminClient = null;
let warnedOnce = false;

export function createSupabaseAdmin() {
  // Reuse a single instance
  if (adminClient) return adminClient;

  // Never create the admin client in the browser
  if (typeof window !== "undefined") {
    if (!warnedOnce) {
      console.error(
        "[supabase-admin] Attempted to create admin client in the browser. This must only run on the server."
      );
      warnedOnce = true;
    }
    return null;
  }

  // URL can safely come from NEXT_PUBLIC_ or server-only SUPABASE_URL
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    if (!warnedOnce) {
      console.error(
        "[supabase-admin] Missing env vars:",
        !url ? "NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL" : "",
        !serviceKey ? "SUPABASE_SERVICE_ROLE_KEY" : ""
      );
      warnedOnce = true;
    }
    return null;
  }

  adminClient = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    // Use the platform fetch (Next.js / Node 18+)
    global: { fetch },
  });

  return adminClient;
}
