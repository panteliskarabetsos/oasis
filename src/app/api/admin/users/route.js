// src/app/api/admin/users/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  ALL_PERMISSIONS,
  accessCan,
  normalizePermissions,
  resolveStaffAccess,
} from "@/lib/auth/requireAdmin";

const MAX_NOTES_LEN = 2000;

// Expanded to support all granular admin roles + base user
const ALLOWED_ROLES = new Set([
  "superadmin",
  "manager",
  "finance",
  "marketing",
  "support",
  "partner",
  "custom", // hand-picked component access
  "admin", // Keep for legacy/fallback
  "user",
]);

// Staff accounts (any role other than "user") may only be created, modified or
// deleted by roles that hold the "admins" permission — i.e. superadmin. Without
// this, any staff member (support, partner, marketing…) could mint a superadmin.
const canManageStaff = (permissions) => accessCan(permissions, "admins");
const isStaffRole = (r) => typeof r === "string" && r !== "user";

/** Accept only known component keys; anything else is rejected outright so a
 *  typo can never silently grant nothing (or something unintended). */
function readPermissions(value) {
  if (value === undefined || value === null) return { list: null };
  if (!Array.isArray(value)) return { error: "permissions must be an array" };
  const unknown = value
    .map((p) => String(p).trim())
    .filter((p) => p && !ALL_PERMISSIONS.includes(p));
  if (unknown.length)
    return { error: `Unknown permission(s): ${unknown.join(", ")}` };
  return { list: normalizePermissions(value) };
}

/** Surface a missing-column error as actionable guidance rather than a 500. */
function permissionsColumnMissing(e) {
  const msg = String(e?.message || "");
  return e?.code === "42703" || /column .*permissions.* does not exist/i.test(msg);
}
const migrationNeeded = () =>
  err(
    "Custom permissions need the User.permissions column — run dump_sql/20260909_user_permissions.sql.",
    501,
  );
const staffDenied = () =>
  err("Only a Super Admin can manage staff accounts.", 403);

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

  const { role, permissions } = await resolveStaffAccess(authUser);
  if (!accessCan(permissions)) return { ok: false, res: err("Forbidden", 403) };

  return { ok: true, admin, authUser, role, permissions };
}

/* ========================== GET (Admin) ========================== */
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const { admin } = gate;

  try {
    const COLS =
      "id,auth_user_id,email,name,surname,phone,role,dateOfBirth,createdAt,notes";

    let { data, error } = await admin
      .from("User")
      .select(`${COLS},permissions`)
      .order("createdAt", { ascending: false });

    // The permissions column is optional until the migration is applied.
    if (error && permissionsColumnMissing(error)) {
      ({ data, error } = await admin
        .from("User")
        .select(COLS)
        .order("createdAt", { ascending: false }));
    }

    if (error) throw error;
    return ok(
      (Array.isArray(data) ? data : []).map((u) => ({
        ...u,
        permissions: normalizePermissions(u.permissions),
      })),
    );
  } catch (e) {
    console.error("[admin/users] GET failed:", e);
    return err("Failed to fetch users", 500);
  }
}

/* ========================== POST (Admin) ========================= */
export async function POST(req) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const { admin } = gate;

  const body = await readJson(req);
  if (!body) return err("Invalid JSON", 400);

  if (isStaffRole(body?.role) && !canManageStaff(gate.permissions)) return staffDenied();

  let {
    email,
    password,
    name,
    surname,
    phone,
    role = "user",
    permissions,
    dateOfBirth,
    notes,
  } = body;

  const perms = readPermissions(permissions);
  if (perms.error) return err(perms.error, 400);
  // A custom account with nothing ticked could not open a single screen.
  if (role === "custom" && !(perms.list && perms.list.length))
    return err("Pick at least one component for a custom access account", 400);

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
      ...(perms.list ? { permissions: perms.list } : {}),
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

    if (upsertRes.error && permissionsColumnMissing(upsertRes.error)) {
      if (createdAuthUserId) await admin.auth.admin.deleteUser(createdAuthUserId);
      return migrationNeeded();
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

/* ========================== PUT (Admin) ========================== */
export async function PUT(req) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const { admin, authUser } = gate;

  const body = await readJson(req);
  if (!body) return err("Invalid JSON", 400);

  const { id, email, name, surname, phone, role, permissions, dateOfBirth, notes } =
    body;

  const perms = readPermissions(permissions);
  if (perms.error) return err(perms.error, 400);
  if (role === "custom" && perms.list && !perms.list.length)
    return err("Pick at least one component for a custom access account", 400);

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

    // Guard both directions: promoting someone to staff, and editing someone
    // who already is staff.
    if (
      (isStaffRole(role) || isStaffRole(current.role)) &&
      !canManageStaff(gate.permissions)
    ) {
      return staffDenied();
    }

    // Prevent self-demotion from superadmin
    const isSelf = String(current.auth_user_id) === String(authUser.id);
    if (
      isSelf &&
      typeof role === "string" &&
      role !== "superadmin" &&
      current.role === "superadmin"
    ) {
      return err("You cannot demote your own Super Admin account.", 400);
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
    if (perms.list) updates.permissions = perms.list;

    if (dateOfBirth !== undefined) {
      updates.dateOfBirth = dateOfBirth ? `${dateOfBirth}T00:00:00` : null;
    }

    if (notes !== undefined) {
      const t = String(notes ?? "").trim();
      updates.notes = t ? t.slice(0, MAX_NOTES_LEN) : null;
    }

    let { data: updated, error: upErr } = await admin
      .from("User")
      .update(updates)
      .eq("id", userId)
      .select(
        "id,auth_user_id,role,email,name,surname,phone,dateOfBirth,createdAt,notes",
      )
      .single();

    // Writing permissions before the migration has run is a setup problem, not
    // a server fault — say so plainly instead of returning a 500.
    if (upErr && permissionsColumnMissing(upErr)) return migrationNeeded();
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
            authPatch,
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
      .select("id,auth_user_id,role")
      .eq("id", userId)
      .single();

    if (exErr) throw exErr;
    if (!existing) return err("User not found", 404);

    if (isStaffRole(existing.role) && !canManageStaff(gate.permissions)) {
      return staffDenied();
    }

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
          400,
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
          authDelErr,
        );
      }
    }

    return ok({ success: true });
  } catch (e) {
    console.error("[admin/users] DELETE failed:", e);
    return err("Failed to delete user.", 500);
  }
}
