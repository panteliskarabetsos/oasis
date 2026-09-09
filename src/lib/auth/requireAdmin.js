import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  ALL_PERMISSIONS,
  ASSIGNABLE_ROLES,
  PERMISSION_GROUPS,
  ROLE_PERMISSIONS,
  ADMIN_ROLES,
  isValidPermission,
} from "@/lib/auth/permissions";

export {
  ALL_PERMISSIONS,
  ASSIGNABLE_ROLES,
  PERMISSION_GROUPS,
  ROLE_PERMISSIONS,
  ADMIN_ROLES,
  isValidPermission,
};

/**
 * Single source of truth for admin authorisation.
 *
 * A staff member's access is the union of:
 *   1. the permissions their named role carries (ROLE_PERMISSIONS), and
 *   2. any per-user grants stored in public."User".permissions.
 *
 * That lets a Super Admin either pick a ready-made role or hand-pick the
 * components someone can reach (role "custom" starts from nothing).
 *
 * Guard a route with the *permission* it belongs to, never a hand-rolled
 * role array:
 *
 *   const auth = await requireAdmin("payments");
 *   if (!auth.ok) return auth.response;
 *   const { user, admin, role, permissions } = auth;
 */

const json = (msg, status) => NextResponse.json({ error: msg }, { status });

/* ----------------------------- permission maths --------------------------- */

/** Normalise whatever is stored in User.permissions into a string array. */
export function normalizePermissions(value) {
  if (!value) return [];
  let list = value;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      list = list.split(",");
    }
  }
  if (!Array.isArray(list)) return [];
  return [...new Set(list.map((p) => String(p).trim()).filter(isValidPermission))];
}

/**
 * Effective permissions for a role plus per-user grants.
 * @returns {"*"|string[]}
 */
export function effectivePermissions(role, extra) {
  const base = ROLE_PERMISSIONS[role];
  if (base === "*") return "*";
  // Grants only mean something on a recognised staff role. A plain "user" (or
  // an unknown role) with a stray permissions array stays locked out, matching
  // what the console itself allows through.
  if (!base) return [];
  return [...new Set([...base, ...normalizePermissions(extra)])];
}

/** Does this role (ignoring per-user grants) hold the permission? */
export function roleCan(role, permission) {
  return can(ROLE_PERMISSIONS[role], permission);
}

/** Does this effective permission set hold the permission? */
export function accessCan(permissions, permission) {
  return can(permissions, permission);
}

function can(perms, permission) {
  if (!perms) return false;               // unknown role / plain "user"
  if (perms === "*") return true;         // superadmin + legacy admin
  if (!Array.isArray(perms)) return false;
  if (!permission) return perms.length > 0; // any staff access is enough
  return perms.includes(permission);
}

/* ------------------------------ role resolution --------------------------- */

/**
 * Read role + per-user grants for an authenticated user.
 * Falls back gracefully when the User.permissions column has not been added yet.
 * @returns {Promise<{role:string, permissions:"*"|string[]}>}
 */
export async function resolveStaffAccess(user) {
  const claim = user?.app_metadata?.role || user?.user_metadata?.role || null;
  const admin = createSupabaseAdmin();

  if (!admin) {
    return { role: claim || "user", permissions: effectivePermissions(claim, []) };
  }

  let row = null;
  const { data, error } = await admin
    .from("User")
    .select("role, permissions")
    .eq("auth_user_id", user?.id)
    .maybeSingle();

  if (error) {
    // Most likely the permissions column does not exist yet — retry role-only
    // so an un-migrated database keeps working on role permissions alone.
    const { data: roleOnly } = await admin
      .from("User")
      .select("role")
      .eq("auth_user_id", user?.id)
      .maybeSingle();
    row = roleOnly || null;
  } else {
    row = data;
  }

  const role = row?.role || claim || "user";
  return { role, permissions: effectivePermissions(role, row?.permissions) };
}

/**
 * Resolve just the staff role. Kept for routes that build their own Supabase
 * client and only need the role name.
 */
export async function resolveStaffRole(user) {
  const { role } = await resolveStaffAccess(user);
  return role;
}

/* ------------------------------- the guard -------------------------------- */

// Cookie-bound Supabase client (dynamic-friendly)
async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: async (name) => cookieStore.get(name)?.value,
        getAll: async () =>
          cookieStore.getAll().map(({ name, value }) => ({ name, value })),
        set: async (name, value, options) => {
          try { cookieStore.set({ name, value, ...options }); } catch {}
        },
        setAll: async (toSet) => {
          for (const { name, value, options } of toSet) {
            try { cookieStore.set({ name, value, ...options }); } catch {}
          }
        },
        remove: async (name, options) => {
          try { cookieStore.set({ name, value: "", ...options, maxAge: 0 }); } catch {}
        },
      },
    }
  );
}

/**
 * @param {string} [permission] one of ALL_PERMISSIONS.
 *        Omit to require only that the caller is staff.
 * @returns {Promise<{ok:true,user,admin,userClient,role:string,permissions:"*"|string[]}
 *                  |{ok:false,response:Response}>}
 */
export async function requireAdmin(permission) {
  try {
    const userClient = await getServerSupabase();
    const {
      data: { user },
      error,
    } = await userClient.auth.getUser();

    if (error || !user) return { ok: false, response: json("Unauthorized", 401) };

    const admin = createSupabaseAdmin();
    if (!admin) return { ok: false, response: json("Server not configured", 500) };

    // The JWT claim alone can satisfy the check for a full-access role; anything
    // else has to be resolved against the User row so per-user grants apply.
    const claim = user?.app_metadata?.role || user?.user_metadata?.role || null;
    if (ROLE_PERMISSIONS[claim] === "*") {
      return { ok: true, user, admin, userClient, role: claim, permissions: "*" };
    }

    const { role, permissions } = await resolveStaffAccess(user);

    if (!accessCan(permissions, permission)) {
      return { ok: false, response: json("Forbidden", 403) };
    }

    return { ok: true, user, admin, userClient, role, permissions };
  } catch {
    return { ok: false, response: json("Server error", 500) };
  }
}
