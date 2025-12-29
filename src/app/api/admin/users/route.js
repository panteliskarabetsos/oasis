// src/app/api/admin/users/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const MAX_NOTES_LEN = 2000;
const ALLOWED_ROLES = new Set(["admin", "user"]);

const ok = (data, status = 200) => NextResponse.json(data, { status });
const err = (msg, status = 500) =>
  NextResponse.json({ error: msg }, { status });

function normalizeEmail(v) {
  return String(v || "")
    .trim()
    .toLowerCase();
}

function isEmail(v) {
  return /^\S+@\S+\.\S+$/.test(String(v || "").trim());
}

function parseId(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/** Resolve current auth user and verify admin */
async function requireAdmin() {
  const supa = await createSupabaseServer();
  const { data, error } = await supa.auth.getUser();

  if (error || !data?.user) {
    return { ok: false, res: err("Unauthorized", 401) };
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return { ok: false, res: err("Server not configured", 500) };
  }

  const authUser = data.user;

  // Fast path: metadata role
  const roleMeta =
    authUser?.app_metadata?.role || authUser?.user_metadata?.role || null;

  if (roleMeta === "admin") {
    return { ok: true, admin, authUser };
  }

  // Fallback: DB role check
  const { data: dbUser, error: dbErr } = await admin
    .from("User")
    .select("role")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (dbErr) {
    console.error("[admin/users] role lookup error", dbErr);
    return { ok: false, res: err("Server error", 500) };
  }

  if (dbUser?.role === "admin") {
    return { ok: true, admin, authUser };
  }

  return { ok: false, res: err("Forbidden", 403) };
}

/* ========================== GET (Admin) ========================== */
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const { admin } = gate;

  try {
    const { data, error } = await admin
      .from("User")
      .select(
        "id,auth_user_id,email,name,surname,phone,role,dateOfBirth,createdAt,notes"
      )
      .order("createdAt", { ascending: false });

    if (error) throw error;
    return ok(Array.isArray(data) ? data : []);
  } catch (e) {
    console.error("[admin/users] GET failed:", e);
    return err("Failed to fetch users", 500);
  }
}

/* ========================== POST (Admin) ========================= */
/* ========================== POST (Admin) ========================= */
export async function POST(req) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const { admin } = gate;

  const body = await readJson(req);
  if (!body) return err("Invalid JSON", 400);

  let {
    email,
    password,
    name,
    surname,
    phone,
    role = "user",
    dateOfBirth,
    notes,
  } = body;

  email = normalizeEmail(email);

  // ✅ only email is required
  if (!email || !isEmail(email)) return err("Invalid email", 400);

  if (typeof role !== "string" || !ALLOWED_ROLES.has(role)) {
    return err("Invalid role", 400);
  }

  if (
    password != null &&
    String(password).length > 0 &&
    String(password).length < 8
  ) {
    return err("Password must be at least 8 characters", 400);
  }

  if (!password) {
    password = `Tmp-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  }

  const cleanName = name != null ? String(name).trim() : "";
  const cleanSurname = surname != null ? String(surname).trim() : "";
  const cleanPhone = phone != null ? String(phone).trim() : "";

  // keep auth metadata clean (don’t store undefined)
  const user_metadata = {};
  if (cleanName) user_metadata.name = cleanName;
  if (cleanSurname) user_metadata.surname = cleanSurname;
  if (cleanPhone) user_metadata.phone = cleanPhone;
  if (dateOfBirth) user_metadata.dateOfBirth = dateOfBirth;

  const safeNotes =
    notes == null
      ? null
      : String(notes).trim()
      ? String(notes).trim().slice(0, MAX_NOTES_LEN)
      : null;

  let createdAuthUserId = null;

  try {
    // 1) Create Auth user
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata,
        app_metadata: { role },
      });

    if (createErr) {
      const msg = createErr.message || "Failed to create auth user";
      const m = msg.toLowerCase();
      const isDup =
        m.includes("already") ||
        m.includes("duplicate") ||
        m.includes("registered");
      return err(msg, isDup ? 409 : 500);
    }

    createdAuthUserId = created.user.id;

    // 2) Upsert profile row
    const dobTs = dateOfBirth ? `${dateOfBirth}T00:00:00` : null;

    const payload = {
      auth_user_id: createdAuthUserId,
      email,
      password: "<managed-by-auth>",
      name: cleanName || null,
      surname: cleanSurname || null,
      phone: cleanPhone || null,
      role,
      dateOfBirth: dobTs,
      updatedAt: new Date().toISOString(),
      notes: safeNotes,
    };

    let upsertRes = await admin
      .from("User")
      .upsert(payload, { onConflict: "auth_user_id" })
      .select("id")
      .single();

    if (upsertRes.error && upsertRes.error.code === "42P10") {
      upsertRes = await admin
        .from("User")
        .upsert(payload, { onConflict: "email" })
        .select("id")
        .single();
    }

    if (upsertRes.error) {
      console.error("[admin/users] profile upsert error", upsertRes.error);

      // rollback auth user (best-effort)
      try {
        await admin.auth.admin.deleteUser(createdAuthUserId);
      } catch (rbErr) {
        console.warn("[admin/users] rollback auth delete failed", rbErr);
      }

      return err("Failed to save profile", 500);
    }

    return ok({ id: upsertRes.data?.id, authUserId: createdAuthUserId }, 201);
  } catch (e) {
    console.error("[admin/users] POST failed:", e);

    if (createdAuthUserId) {
      try {
        await admin.auth.admin.deleteUser(createdAuthUserId);
      } catch (rbErr) {
        console.warn("[admin/users] rollback auth delete failed", rbErr);
      }
    }

    return err("Failed to create user", 500);
  }
}

export async function PUT(req) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const { admin, authUser } = gate;

  const body = await readJson(req);
  if (!body) return err("Invalid JSON", 400);

  const { id, email, name, surname, phone, role, dateOfBirth, notes } = body;

  const userId = parseId(id);
  if (!userId) return err("Invalid user id", 400);

  if (
    role !== undefined &&
    (typeof role !== "string" || !ALLOWED_ROLES.has(role))
  ) {
    return err("Invalid role", 400);
  }

  try {
    // Load current record
    const { data: current, error: curErr } = await admin
      .from("User")
      .select("id,auth_user_id,role,email")
      .eq("id", userId)
      .single();

    if (curErr) throw curErr;
    if (!current) return err("User not found", 404);

    // Prevent self-demotion
    const isSelf = String(current.auth_user_id) === String(authUser.id);
    if (isSelf && typeof role === "string" && role !== "admin") {
      return err("You cannot demote your own admin account.", 400);
    }

    const updates = { updatedAt: new Date().toISOString() };

    if (email != null) {
      const em = normalizeEmail(email);
      if (!isEmail(em)) return err("Invalid email", 400);
      updates.email = em;
    }

    if (name != null) updates.name = String(name).trim() || null;
    if (surname != null) updates.surname = String(surname).trim() || null;
    if (phone != null) updates.phone = String(phone).trim() || null;

    if (typeof role === "string") updates.role = role;

    if (dateOfBirth !== undefined) {
      updates.dateOfBirth = dateOfBirth ? `${dateOfBirth}T00:00:00` : null;
    }

    if (notes !== undefined) {
      const t = String(notes ?? "").trim();
      updates.notes = t ? t.slice(0, MAX_NOTES_LEN) : null;
    }

    const { data: updated, error: upErr } = await admin
      .from("User")
      .update(updates)
      .eq("id", userId)
      .select(
        "id,auth_user_id,role,email,name,surname,phone,dateOfBirth,createdAt,notes"
      )
      .single();

    if (upErr) throw upErr;

    // Best-effort sync to Auth (role/email/metadata)
    if (updated?.auth_user_id) {
      const authPatch = {};

      if (typeof role === "string" && role !== current.role) {
        authPatch.app_metadata = { role };
      }

      if (email != null) {
        const newEmail = normalizeEmail(email);
        if (newEmail && newEmail !== current.email) authPatch.email = newEmail;
      }

      // keep metadata in sync too
      authPatch.user_metadata = {
        name: updated.name ?? null,
        surname: updated.surname ?? null,
        phone: updated.phone ?? null,
        dateOfBirth: updated.dateOfBirth ?? null,
      };

      // only call if we actually have something
      if (Object.keys(authPatch).length > 0) {
        try {
          await admin.auth.admin.updateUserById(
            updated.auth_user_id,
            authPatch
          );
        } catch (syncErr) {
          console.warn("[admin/users] auth sync failed (non-fatal)", syncErr);
        }
      }
    }

    return ok(updated);
  } catch (e) {
    console.error("[admin/users] PUT failed:", e);
    return err("Failed to update user", 500);
  }
}

/* ========================= DELETE (Admin) ======================== */
export async function DELETE(req) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const { admin, authUser } = gate;

  const body = await readJson(req);
  const userId = parseId(body?.id);
  if (!userId) return err("Invalid user id", 400);

  try {
    // Load target
    const { data: existing, error: exErr } = await admin
      .from("User")
      .select("id,auth_user_id")
      .eq("id", userId)
      .single();

    if (exErr) throw exErr;
    if (!existing) return err("User not found", 404);

    // ✅ HARD BLOCK: cannot delete yourself
    if (String(existing.auth_user_id) === String(authUser.id)) {
      return err("You cannot delete your own admin account.", 400);
    }

    // Delete profile row
    const { error: delErr } = await admin
      .from("User")
      .delete()
      .eq("id", userId);

    if (delErr) {
      if (delErr.code === "23503") {
        return err(
          "Cannot delete user. There are related records referencing this user.",
          400
        );
      }
      throw delErr;
    }

    // Best-effort: delete auth user
    if (existing.auth_user_id) {
      try {
        await admin.auth.admin.deleteUser(existing.auth_user_id);
      } catch (authDelErr) {
        console.warn(
          "[admin/users] auth delete failed (non-fatal)",
          authDelErr
        );
      }
    }

    return ok({ success: true });
  } catch (e) {
    console.error("[admin/users] DELETE failed:", e);
    return err("Failed to delete user.", 500);
  }
}
