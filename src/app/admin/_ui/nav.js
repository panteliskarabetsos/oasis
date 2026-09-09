/**
 * Single source of truth for admin navigation.
 * `perm` maps to the permission matrix in @/lib/auth/requireAdmin, so the
 * sidebar shows exactly what the API will actually allow.
 * `soon: true` marks a module that has no page yet.
 */
export const NAV_GROUPS = [
  {
    label: "Operations",
    items: [
      { href: "/admin", label: "Dashboard", icon: "grid" },
      { href: "/admin/bookings", label: "Bookings", icon: "calendar", perm: "bookings" },
      { href: "/admin/checkins", label: "Check-ins", icon: "check", perm: "checkins" },
      { href: "/admin/schedule", label: "Daily manifest", icon: "clock", perm: "schedule" },
      { href: "/admin/planner", label: "Planner", icon: "layers", perm: "planner" },
      { href: "/admin/requests", label: "Guest requests", icon: "inbox", perm: "requests", badge: "requests" },
      { href: "/admin/experiences", label: "Experiences", icon: "leaf", perm: "experiences" },
    ],
  },
  {
    label: "Revenue",
    items: [
      { href: "/admin/pos", label: "POS", icon: "register", perm: "pos" },
      { href: "/admin/payments", label: "Payments", icon: "card", perm: "payments" },
      { href: "/admin/receipts", label: "Receipts", icon: "file", perm: "payments" },
      { href: "/admin/invoices", label: "Invoices", icon: "file", perm: "invoices" },
      { href: "/admin/giftcards", label: "Gift cards", icon: "gift", perm: "giftcards" },
      { href: "/admin/corporate", label: "Corporate", icon: "briefcase", perm: "corporate" },
      { href: "/admin/reports/daily", label: "Z-report", icon: "lock", perm: "zreport" },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/admin/promotions", label: "Promotions", icon: "tag", perm: "promotions" },
      { href: "/admin/eshop", label: "e-Shop", icon: "bag", perm: "eshop" },
      { href: "/admin/reports", label: "Analytics", icon: "chart", perm: "payments" },
    ],
  },
  {
    label: "People & system",
    items: [
      { href: "/admin/users", label: "Guests", icon: "users", perm: "guests" },
      { href: "/admin/accounts", label: "Staff accounts", icon: "shield", perm: "admins" },
      { href: "/admin/settings", label: "Settings", icon: "cog", perm: "settings" },
      { href: "/admin/help", label: "Help", icon: "help" },
    ],
  },
];

// The role matrix lives in one place and is shared with the API guards.
export { ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import { ROLE_PERMISSIONS } from "@/lib/auth/permissions";

/**
 * Effective access for a staff member: their role's permissions plus any
 * per-user grants. Mirrors effectivePermissions() in @/lib/auth/requireAdmin.
 * @returns {"*"|string[]}
 */
export function effectiveAccess(role, granted = []) {
  const base = ROLE_PERMISSIONS[role];
  if (base === "*") return "*";
  if (!base) return [];
  const extra = Array.isArray(granted) ? granted : [];
  return [...new Set([...base, ...extra])];
}

/**
 * @param access "*" or an array of permissions (NOT a role name).
 */
export function can(access, perm) {
  if (!perm) return true;
  if (access === "*") return true;
  return Array.isArray(access) && access.includes(perm);
}

export function visibleGroups(access) {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => can(access, i.perm)),
  })).filter((g) => g.items.length);
}
