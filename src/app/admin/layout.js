// app/admin/layout.js
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import AdminShell from "@/app/admin/_ui/Shell";
import { effectivePermissions } from "@/lib/auth/requireAdmin";
import SwRegister from "@/app/admin/components/SwRegister";
import InstallPrompt from "@/app/admin/components/InstallPrompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin • Oasis",
  robots: { index: false, follow: false },
  applicationName: "Oasis Admin",
  manifest: "/manifest.webmanifest",
  themeColor: "#1e1a15",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Oasis Admin",
  },
  icons: {
    apple: "/icons/admin-128.png",
    icon: [
      { url: "/icons/admin-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/admin-512.png", type: "image/png", sizes: "512x512" },
    ],
  },
};

// Every role permitted into the console (see @/lib/auth/requireAdmin)
const ADMIN_ROLES = [
  "superadmin",
  "manager",
  "finance",
  "marketing",
  "support",
  "partner",
  "custom",
  "admin", // legacy, behaves like superadmin
];

/** Server action, passed down to the client shell. */
async function signOut() {
  "use server";
  const supa = await createSupabaseServer();
  await supa.auth.signOut();
  redirect("/");
}

export default async function AdminLayout({ children }) {
  const supa = await createSupabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) redirect("/");

  const { data: row } = await supa
    .from("User")
    .select("role,name,surname,email,permissions")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const role =
    row?.role ??
    user?.app_metadata?.role ??
    user?.user_metadata?.role ??
    "user";

  if (!ADMIN_ROLES.includes(role)) redirect("/");

  // What this person can actually reach: their role's permissions plus any
  // components a Super Admin granted them individually.
  const permissions = effectivePermissions(role, row?.permissions);

  // A "custom" account with nothing granted yet has no console to show.
  if (Array.isArray(permissions) && permissions.length === 0) redirect("/");

  const displayName =
    row?.name || row?.surname
      ? [row?.name, row?.surname].filter(Boolean).join(" ")
      : row?.email || user.email;

  const isTest = (
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
  ).startsWith("pk_test_");

  return (
    <div className="admin-root">
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] rounded bg-white px-3 py-2 text-sm text-[#5a4a3f] shadow"
      >
        Skip to content
      </a>

      <AdminShell
        role={role}
        permissions={permissions}
        displayName={displayName}
        email={row?.email || user.email}
        isTest={isTest}
        signOutAction={signOut}
      >
        {children}
      </AdminShell>

      <InstallPrompt />
      <SwRegister />
    </div>
  );
}
