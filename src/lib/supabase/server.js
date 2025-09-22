// src/lib/supabase/server.js
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) return null;

  // ⬇️ Next.js 14.2+/15: cookies() is async
  const cookieStore = await cookies();

  return createServerClient(url, anon, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {}
      },
      remove(name) {
        try {
          cookieStore.delete(name);
        } catch {}
      },
    },
  });
}
