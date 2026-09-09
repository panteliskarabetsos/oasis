/**
 * Component permissions, mirroring the console.
 *
 * Preferred source is the *effective* set on /api/me — a staff member's role
 * permissions merged with any components a Super Admin granted them
 * individually. "*" means unrestricted (superadmin / legacy admin).
 *
 * That field only exists on newer deployments, so when it is absent we fall
 * back to deriving access from the role alone. The app must never lock a real
 * staff member out just because the website is a version behind it.
 */

export type Access = "*" | string[];

/** Mirrors ROLE_PERMISSIONS in the website's @/lib/auth/permissions. */
const ROLE_PERMISSIONS: Record<string, Access> = {
  superadmin: "*",
  admin: "*",
  manager: [
    "experiences", "bookings", "requests", "guests", "planner", "schedule",
    "checkins", "pos", "waitlist", "addons", "waivers",
  ],
  finance: ["payments", "invoices", "corporate", "giftcards", "pos", "zreport"],
  marketing: [
    "guests", "promotions", "eshop", "bundles", "loyalty", "integrations",
    "settings",
  ],
  support: ["bookings", "requests", "guests", "checkins", "waitlist"],
  partner: ["planner", "schedule", "checkins"],
  // Hand-picked access: everything comes from the granted list, so without one
  // (an older website) this account has nothing.
  custom: [],
};

/** Access implied by a role name alone. */
export function roleAccess(role?: string | null): Access {
  const base = ROLE_PERMISSIONS[String(role ?? "").toLowerCase()];
  if (base === "*") return "*";
  return Array.isArray(base) ? [...base] : [];
}

/**
 * Work out what this staff member can reach.
 * `permissions` wins when the server sent it; otherwise the role decides.
 */
export function accessFrom(role?: string | null, permissions?: unknown): Access {
  if (permissions === "*") return "*";
  if (Array.isArray(permissions)) return permissions.map(String);
  return roleAccess(role);
}

/** Does this staff member hold the permission? Omit it to ask "are they staff at all?". */
export function can(access: Access, permission?: string): boolean {
  if (access === "*") return true;
  if (!Array.isArray(access)) return false;
  if (!permission) return access.length > 0;
  return access.includes(permission);
}

/** Human labels for the access list and the no-access screen. */
export const PERMISSION_LABELS: Record<string, string> = {
  experiences: "Experiences",
  bookings: "Bookings",
  requests: "Requests",
  planner: "Planner",
  schedule: "Daily manifest",
  checkins: "Check-ins",
  waitlist: "Waitlist",
  addons: "Add-ons",
  waivers: "Waivers",
  pos: "Point of sale",
  payments: "Payments",
  invoices: "Invoices",
  giftcards: "Gift cards",
  corporate: "Corporate",
  zreport: "Z-report",
  promotions: "Promotions",
  eshop: "e-Shop",
  bundles: "Bundles",
  loyalty: "Loyalty",
  guests: "Guests",
  settings: "Settings",
  integrations: "Integrations",
  admins: "Staff accounts",
};
