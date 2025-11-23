// src/app/api/account/update/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (data, status = 200) => NextResponse.json(data, { status });
const bad = (msg, status = 400) =>
  NextResponse.json({ message: msg }, { status });

export async function POST(req) {
  const supa = await createSupabaseServer();
  if (!supa) return bad("Server not configured", 500);

  const {
    data: { user },
    error: authErr,
  } = await supa.auth.getUser();
  if (authErr || !user) return bad("Unauthorized", 401);

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const { name, email, phone, password, dateOfBirth } = await req
    .json()
    .catch(() => ({}));

  // 1) Require current password to confirm any change
  if (!password || typeof password !== "string") {
    return bad("Current password is required to confirm changes.", 401);
  }

  // 2) Verify the provided password matches current account (stateless client: no cookies mutated)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return bad("Server not configured", 500);

  const stateless = createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { error: pwErr } = await stateless.auth.signInWithPassword({
    email: user.email,
    password, // verify only; we will not change it
  });

  if (pwErr) {
    // Wrong password -> block updates
    return bad("Incorrect password. Changes were not saved.", 401);
  }

  try {
    // 3) Load profile row
    const { data: profile, error: profErr } = await admin
      .from("User")
      .select("id, email, name, phone, dateOfBirth, auth_user_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profErr) {
      console.error("[account/update] profile fetch error", profErr);
      return bad("Failed to load profile", 500);
    }
    if (!profile) return bad("User not found", 404);

    // 4) Build updates for public."User"
    const updates = {};
    if (typeof name === "string") updates.name = name;
    if (typeof phone === "string") updates.phone = phone;
    if (typeof email === "string") updates.email = email; // keep profile email mirrored if you store it
    if (dateOfBirth) {
      // If column is DATE, consider slicing to YYYY-MM-DD; otherwise ISO is fine
      const d = new Date(dateOfBirth);
      updates.dateOfBirth = d.toISOString();
    }

    // 5) If email changed, update in Auth as well (this may trigger confirmation)
    if (email && email !== user.email) {
      const { error: emailErr } = await supa.auth.updateUser({ email });
      if (emailErr) {
        console.error("[account/update] email update error", emailErr);
        return bad(emailErr.message || "Failed to update email", 400);
      }
    }

    // 6) Persist DB changes (if any)
    if (Object.keys(updates).length > 0) {
      const { data: updatedUser, error: updErr } = await admin
        .from("User")
        .update(updates)
        .eq("auth_user_id", user.id)
        .select()
        .maybeSingle();

      if (updErr) {
        console.error("[account/update] profile update error", updErr);
        return bad("Failed to update account", 500);
      }

      return ok({ message: "Account updated successfully", user: updatedUser });
    }

    // Nothing changed (but password verified)
    return ok({ message: "No changes detected." });
  } catch (e) {
    console.error("[account/update] unexpected error", e);
    return bad("Failed to update account", 500);
  }
}
