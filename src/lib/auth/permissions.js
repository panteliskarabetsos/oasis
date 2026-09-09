/**
 * The permission catalogue and role matrix.
 *
 * Kept free of server-only imports so the admin console (client components)
 * and the API guards can share exactly one definition. Server code should
 * import from "@/lib/auth/requireAdmin", which re-exports everything here.
 */

/* -------------------------- the permission catalogue ---------------------- */

/** Every component that can be granted, grouped for the staff-account UI. */
export const PERMISSION_GROUPS = [
  {
    label: "Operations",
    permissions: [
      ["experiences", "Experiences"],
      ["bookings", "Bookings"],
      ["requests", "Requests"],
      ["planner", "Planner"],
      ["schedule", "Daily manifest"],
      ["checkins", "Check-ins"],
      ["waitlist", "Waitlist"],
      ["addons", "Add-ons"],
      ["waivers", "Waivers"],
    ],
  },
  {
    label: "Revenue",
    permissions: [
      ["pos", "Point of sale"],
      ["payments", "Payments"],
      ["invoices", "Invoices"],
      ["giftcards", "Gift cards"],
      ["corporate", "Corporate"],
      ["zreport", "Z-report"],
    ],
  },
  {
    label: "Growth",
    permissions: [
      ["promotions", "Promotions"],
      ["eshop", "e-Shop"],
      ["bundles", "Bundles"],
      ["loyalty", "Loyalty"],
    ],
  },
  {
    label: "People & system",
    permissions: [
      ["guests", "Guests"],
      ["settings", "Settings"],
      ["integrations", "Integrations"],
      ["admins", "Staff accounts"],
    ],
  },
];

/** Flat list of every valid permission key. */
export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map(([key]) => key)
);

export function isValidPermission(p) {
  return ALL_PERMISSIONS.includes(p);
}

/* ------------------------------- role matrix ------------------------------ */

export const ROLE_PERMISSIONS = {
  superadmin: "*",
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
  // Hand-picked access: everything comes from User.permissions.
  custom: [],
  // "admin" is the legacy catch-all role and behaves like superadmin
  admin: "*",
};

export const ADMIN_ROLES = Object.keys(ROLE_PERMISSIONS);

/** Roles a Super Admin can assign, with copy for the staff-account UI. */
export const ASSIGNABLE_ROLES = [
  { id: "superadmin", label: "Super Admin", description: "Unrestricted access, including staff accounts." },
  { id: "manager", label: "Manager", description: "Day-to-day operations: experiences, bookings, schedule, POS." },
  { id: "finance", label: "Finance", description: "Payments, invoices, gift cards and the Z-report." },
  { id: "marketing", label: "Marketing", description: "Promotions, e-shop, loyalty and guest lists." },
  { id: "support", label: "Support", description: "Bookings, requests, guests and check-ins." },
  { id: "partner", label: "Partner", description: "Read-heavy access to the planner, manifest and check-ins." },
  { id: "custom", label: "Custom access", description: "Pick exactly which components this person can reach." },
];
