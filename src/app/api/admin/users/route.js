// src/app/api/admin/users/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (data, status = 200) => NextResponse.json(data, { status });
const err = (msg, status = 500) =>
  NextResponse.json({ error: msg }, { status });

/** Resolve current user and verify admin */
async function requireAdmin() {
  const supa = await createSupabaseServer();
  const { data, error } = await supa.auth.getUser();
  if (error || !data?.user) return err("Unauthorized", 401);

  const admin = createSupabaseAdmin();
  if (!admin) return err("Server not configured", 500);

  // Quick metadata check
  const roleMeta =
    data.user?.app_metadata?.role || data.user?.user_metadata?.role;
  if (roleMeta === "admin") return { admin, authUser: data.user };

  // Fallback: check DB role (by auth_user_id; change to email if needed)
  const { data: dbUser, error: dbErr } = await admin
    .from("User")
    .select("role")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();

  if (dbErr) {
    console.error("[admin/users] role lookup error", dbErr);
    return err("Server error", 500);
  }
  if (dbUser?.role === "admin") return { admin, authUser: data.user };

  return err("Unauthorized", 401);
}

/* ========================== GET (Admin) ========================== */
export async function GET() {
  const gate = await requireAdmin();
  if ("body" in gate) return gate;

  const { admin } = gate;
  try {
    const { data, error } = await admin
      .from("User")
      .select(
        "id,auth_user_id,email,name,surname,phone,role,dateOfBirth,createdAt"
      )
      .order("createdAt", { ascending: false });

    if (error) throw error;
    return ok(Array.isArray(data) ? data : []);
  } catch (e) {
    console.error("Failed to fetch users:", e);
    return err("Failed to fetch users", 500);
  }
}

/* ========================== POST (Admin) ========================= *
 * Creates a Supabase Auth user + profile row in public."User".
 * Accepts: { email, password?, name, surname, phone, role, dateOfBirth }
 * If password is omitted, a strong temporary one is generated.
 */
export async function POST(req) {
  const gate = await requireAdmin();
  if ("body" in gate) return gate;

  const { admin } = gate;
  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON", 400);

  let {
    email,
    password,
    name,
    surname,
    phone,
    role = "user",
    dateOfBirth,
  } = body;

  if (!email || !name || !surname) {
    return err("Missing required fields: email, name, surname", 400);
  }

  email = String(email).trim().toLowerCase();
  if (!password) {
    // generate a temp password (you can switch to invite flow if you prefer)
    password = `Tmp-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  }

  try {
    // 1) Create auth user
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, surname, phone, dateOfBirth },
        app_metadata: { role },
      });
    if (createErr) {
      const msg = createErr.message || "Failed to create auth user";
      const isDup =
        msg.toLowerCase().includes("already") ||
        msg.toLowerCase().includes("duplicate");
      return err(msg, isDup ? 409 : 500);
    }
    const authUserId = created.user.id;

    // 2) Upsert profile row
    const dobTs = dateOfBirth ? `${dateOfBirth}T00:00:00` : null;
    const payload = {
      auth_user_id: authUserId,
      email,
      password: "<managed-by-auth>",
      name: name?.trim() || null,
      surname: surname?.trim() || null,
      phone: phone?.trim() || null,
      role: role || "user",
      dateOfBirth: dobTs,
      updatedAt: new Date().toISOString(),
    };

    // Prefer onConflict 'auth_user_id'; if not present, retry with 'email'
    let upsertErr = null;
    let upsertRes = await admin
      .from("User")
      .upsert(payload, { onConflict: "auth_user_id" })
      .select("id")
      .single();
    if (upsertRes.error && upsertRes.error.code === "42P10") {
      // no matching unique index -> retry with email
      upsertRes = await admin
        .from("User")
        .upsert(payload, { onConflict: "email" })
        .select("id")
        .single();
    }
    upsertErr = upsertRes.error;
    if (upsertErr) {
      console.error("[admin/users] profile upsert error", upsertErr);
      return err("Failed to save profile", 500);
    }

    return ok({ id: upsertRes.data?.id, authUserId }, 201);
  } catch (e) {
    console.error("Failed to create user:", e);
    return err("Failed to create user", 500);
  }
}

/* ========================== PUT (Admin) ========================== *
 * Updates profile fields; syncs role to Auth app_metadata if changed.
 * Accepts: { id, email?, name?, surname?, phone?, role?, dateOfBirth? }
 */
export async function PUT(req) {
  const gate = await requireAdmin();
  if ("body" in gate) return gate;

  const { admin } = gate;
  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON", 400);

  const { id, email, name, surname, phone, role, dateOfBirth } = body;
  if (!id) return err("Missing user id", 400);

  try {
    // Load current to get auth_user_id
    const { data: current, error: curErr } = await admin
      .from("User")
      .select("id,auth_user_id,role")
      .eq("id", Number(id))
      .single();
    if (curErr) throw curErr;
    if (!current) return err("User not found", 404);

    const updates = {
      updatedAt: new Date().toISOString(),
    };
    if (email != null) updates.email = String(email).trim().toLowerCase();
    if (name != null) updates.name = name?.trim() || null;
    if (surname != null) updates.surname = surname?.trim() || null;
    if (phone != null) updates.phone = phone?.trim() || null;
    if (typeof role === "string") updates.role = role || "user";
    if (dateOfBirth !== undefined)
      updates.dateOfBirth = dateOfBirth ? `${dateOfBirth}T00:00:00` : null;

    const { data: updated, error: upErr } = await admin
      .from("User")
      .update(updates)
      .eq("id", Number(id))
      .select(
        "id,auth_user_id,role,email,name,surname,phone,dateOfBirth,createdAt"
      )
      .single();
    if (upErr) throw upErr;

    // If role changed, sync to Auth
    if (
      typeof role === "string" &&
      role !== current.role &&
      updated?.auth_user_id
    ) {
      try {
        await admin.auth.admin.updateUserById(updated.auth_user_id, {
          app_metadata: { role },
        });
      } catch (authSyncErr) {
        console.warn(
          "[admin/users] failed to sync role to auth app_metadata",
          authSyncErr
        );
      }
    }

    return ok(updated);
  } catch (e) {
    console.error("Failed to update user:", e);
    return err("Failed to update user", 500);
  }
}

/* ========================= DELETE (Admin) ======================== *
 * Deletes the profile row; attempts to delete Auth user as well.
 * Accepts: { id }
 */
export async function DELETE(req) {
  const gate = await requireAdmin();
  if ("body" in gate) return gate;

  const { admin } = gate;
  const { id } = await req.json().catch(() => ({}));
  if (!id) return err("Missing user id", 400);

  try {
    // Load to get auth_user_id
    const { data: existing, error: exErr } = await admin
      .from("User")
      .select("id,auth_user_id")
      .eq("id", Number(id))
      .single();
    if (exErr) throw exErr;
    if (!existing) return err("User not found", 404);

    // Delete profile row
    const { error: delErr } = await admin
      .from("User")
      .delete()
      .eq("id", Number(id));
    if (delErr) {
      // 23503 => foreign key violation (bookings, etc.)
      if (delErr.code === "23503") {
        return err(
          "Cannot delete user. User has related records (bookings/favourites). Delete them first.",
          400
        );
      }
      throw delErr;
    }

    // Try deleting the auth user (best-effort)
    if (existing.auth_user_id) {
      try {
        await admin.auth.admin.deleteUser(existing.auth_user_id);
      } catch (authDelErr) {
        console.warn("[admin/users] failed to delete auth user", authDelErr);
      }
    }

    return ok({ success: true });
  } catch (e) {
    console.error("Error deleting user:", e);
    return err("Failed to delete user.", 500);
  }
}
