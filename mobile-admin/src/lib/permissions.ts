/**
 * Component permissions, mirroring the console.
 *
 * The server sends the *effective* set on /api/me — a staff member's role
 * permissions merged with any components a Super Admin granted them
 * individually — so the app never has to carry the role matrix itself.
 * "*" means unrestricted (superadmin / legacy admin).
 */

export type Access = "*" | string[];

/** Normalise whatever /api/me returned into something safe to test against. */
export function toAccess(value: unknown): Access {
  if (value === "*") return "*";
  if (Array.isArray(value)) return value.map(String);
  return [];
}

/** Does this staff member hold the permission? Omit `permission` to ask "are they staff at all?". */
export function can(access: Access, permission?: string): boolean {
  if (access === "*") return true;
  if (!Array.isArray(access)) return false;
  if (!permission) return access.length > 0;
  return access.includes(permission);
}

/** Human label for a permission, for the "no access" copy. */
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
