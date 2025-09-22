// src/lib/auth/requireAdmin.js
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

function bad(msg, status = 401) {
  return NextResponse.json({ error: msg }, { status });
}

async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) =>
          cookieStore.set({ name, value, ...options }),
        remove: (name) => cookieStore.delete(name),
      },
    }
  );
}

export async function requireAdmin() {
  const supabase = await getServerSupabase();
  // ✅ Verified with Auth server
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return bad("Unauthorized", 401);

  const user = data.user;
  // quick metadata hint
  if (
    user?.app_metadata?.role === "admin" ||
    user?.user_metadata?.role === "admin"
  ) {
    return { user, admin: createSupabaseAdmin() };
  }

  // definitive DB role check
  const admin = createSupabaseAdmin();
  const { data: dbUser, error: roleErr } = await admin
    .from("User")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (roleErr) return bad("Server error", 500);
  if (dbUser?.role === "admin") return { user, admin };

  return bad("Forbidden", 403);
}
