import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const json = (msg, status = 401) =>
  NextResponse.json({ error: msg }, { status });

// Build a route-aware Supabase client (cookie-bound) — dynamic-friendly
async function getServerSupabase() {
  const cookieStore = await cookies(); // ✅ await to opt into dynamic

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        // Async adapters (works across @supabase/ssr versions)
        get: async (name) => cookieStore.get(name)?.value,
        getAll: async () =>
          cookieStore.getAll().map(({ name, value }) => ({ name, value })),
        set: async (name, value, options) =>
          cookieStore.set({ name, value, ...options }),
        setAll: async (toSet) => {
          for (const { name, value, options } of toSet) {
            cookieStore.set({ name, value, ...options });
          }
        },
        remove: async (name, options) =>
          cookieStore.set({ name, value: "", ...options, maxAge: 0 }),
      },
    }
  );
}

/** On success: { ok:true, user, admin, userClient }  |  On failure: { ok:false, response } */
export async function requireAdmin() {
  try {
    const userClient = await getServerSupabase(); // ✅ await, returns client
    const {
      data: { user },
      error,
    } = await userClient.auth.getUser();

    if (error || !user)
      return { ok: false, response: json("Unauthorized", 401) };

    const admin = createSupabaseAdmin();
    if (!admin)
      return { ok: false, response: json("Server not configured", 500) };

    // quick metadata role
    const metaRole =
      user?.app_metadata?.role || user?.user_metadata?.role || null;
    if (metaRole === "admin") return { ok: true, user, admin, userClient };

    // definitive DB role
    const { data: dbUser, error: roleErr } = await admin
      .from("User")
      .select("role")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (roleErr) return { ok: false, response: json("Server error", 500) };
    if (dbUser?.role !== "admin")
      return { ok: false, response: json("Forbidden", 403) };

    return { ok: true, user, admin, userClient };
  } catch {
    return { ok: false, response: json("Server error", 500) };
  }
}
