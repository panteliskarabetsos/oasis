import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const json = (msg, status = 401) =>
  NextResponse.json({ error: msg }, { status });

// Build a route-aware Supabase client (cookie-bound)
async function getServerSupabase() {
  const cookieStore = await cookies(); // ← await it

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      // Make these async to satisfy Next’s dynamic API guard
      cookies: {
        get: async (name) => cookieStore.get(name)?.value,
        set: async (name, value, options) =>
          cookieStore.set({ name, value, ...options }),
        remove: async (name) => cookieStore.delete(name),
      },
    }
  );
}

/**
 * On success: { ok: true, user, admin, userClient }
 * On failure: { ok: false, response: NextResponse }
 */
export async function requireAdmin() {
  try {
    const userClient = await getServerSupabase(); // ← also await here
    const {
      data: { user },
      error,
    } = await userClient.auth.getUser();

    if (error || !user)
      return { ok: false, response: json("Unauthorized", 401) };

    // Fast metadata check
    const metaRole =
      user?.app_metadata?.role || user?.user_metadata?.role || null;
    const admin = createSupabaseAdmin();
    if (!admin)
      return { ok: false, response: json("Server not configured", 500) };

    if (metaRole === "admin") {
      return { ok: true, user, admin, userClient };
    }

    // Definitive DB role check
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
