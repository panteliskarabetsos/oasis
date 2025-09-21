// src/lib/supabase/server.js
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function createSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    // Return a stub so callers can give a clear 500 with guidance
    return null;
  }

  return createServerClient(url, anon, {
    cookies: {
      get(name) {
        return cookies().get(name)?.value;
      },
      set(name, value, options) {
        // Avoid throwing in edge-ish contexts where setting cookies
        try {
          cookies().set({ name, value, ...options });
        } catch {}
      },
      remove(name, options) {
        try {
          cookies().set({ name, value: "", ...options });
        } catch {}
      },
    },
  });
}
