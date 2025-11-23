// src/lib/supabase/client.js
"use client";
import { createBrowserClient } from "@supabase/ssr";

let supabase;
export function createSupabaseBrowser() {
  if (!supabase) {
    supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return supabase;
}
