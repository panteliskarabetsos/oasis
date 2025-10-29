// src/app/admin/layout.js
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import AdminHeader from "@/app/admin/components/header";
import SwRegister from "@/app/admin/components/SwRegister";
import InstallPrompt from "@/app/admin/components/InstallPrompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ✅ Change #1: point metadata.manifest to the ADMIN-SCOPED manifest
// (make sure this file exists at public/admin/manifest.webmanifest)
export const metadata = {
  title: "Admin • Oasis",
  robots: { index: false, follow: false },
  applicationName: "Oasis Admin",
  manifest: "/admin/manifest.webmanifest",
  themeColor: "#8b6f47",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Oasis Admin",
  },
  // You can keep these where your icon files live; if you moved icons under /admin, update paths accordingly.
  icons: {
    apple: "/icons/admin-128.png",
    icon: [
      { url: "/icons/admin-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/admin-512.png", type: "image/png", sizes: "512x512" },
    ],
  },
};

export default async function AdminLayout({ children }) {
  const supa = await createSupabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) redirect("/");
  const isTest = (
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
  ).startsWith("pk_test_");

  const { data: row } = await supa
    .from("User")
    .select("role,name,surname,email")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const role = row?.role ?? "user";
  if (role !== "admin") redirect("/");

  const displayName =
    row?.name || row?.surname
      ? [row?.name, row?.surname].filter(Boolean).join(" ")
      : row?.email || user.email;

  return (
    <div
      className="
        admin-root relative w-full min-h-[100dvh] bg-[#f4f1ec]
        overflow-x-hidden supports-[overflow:clip]:overflow-x-clip
      "
    >
      {/* ✅ Change #2: mount SW register as early as possible in the tree */}
      <SwRegister />

      {/* No-JS fallback (useful if user disables JS in Safari) */}
      <noscript>
        <div className="p-3 text-sm text-[#5a4a3f]">
          JavaScript is disabled. Oasis Admin requires JavaScript to run.
        </div>
      </noscript>

      {/* Decorative blobs — desktop only */}
      <div className="pointer-events-none absolute -top-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-[#e9e4dc] blur-3xl opacity-70 hidden sm:block" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[32rem] w-[32rem] rounded-full bg-[#fff4e1] blur-3xl opacity-80 hidden sm:block" />

      {/* Skip link */}
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-[max(env(safe-area-inset-top),1rem)] rounded bg-white px-3 py-2 text-sm text-[#5a4a3f] shadow"
      >
        Skip to content
      </a>

      {/* Sticky header — full width, safe-area horizontal padding */}
      <div className="sticky top-0 z-40 w-full bg-[#f4f1ec]/70 backdrop-blur supports-[backdrop-filter]:backdrop-blur border-b border-[#e8e5df]/60">
        <div className="pt-[max(env(safe-area-inset-top),0px)]" />
        <div
          className="w-full sm:px-5"
          style={{
            paddingLeft: "max(env(safe-area-inset-left),0px)",
            paddingRight: "max(env(safe-area-inset-right),0px)",
          }}
        >
          <AdminHeader displayName={displayName} />
        </div>
        {isTest && (
          <div
            className="w-full sm:px-5"
            style={{
              paddingLeft: "max(env(safe-area-inset-left),0px)",
              paddingRight: "max(env(safe-area-inset-right),0px)",
            }}
          >
            <div className="mt-2 mb-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2 text-xs">
              Stripe is in <strong>TEST MODE</strong>. Use test cards only;
              charges are not real.
            </div>
          </div>
        )}
      </div>

      {/* Main content — edge-to-edge with safe-area padding on mobile */}
      <main
        id="admin-content"
        className="
          relative w-full
          py-3 sm:py-5
          md:pb-10
        "
        style={{
          paddingLeft: "max(env(safe-area-inset-left),0px)",
          paddingRight: "max(env(safe-area-inset-right),0px)",
          paddingBottom: "calc(max(env(safe-area-inset-bottom),0px) + 4.25rem)",
        }}
      >
        {children}
      </main>

      {/* Bottom tab bar (mobile only) — full width, safe-area all around */}
      <InstallPrompt />
      <MobileBottomNav />
    </div>
  );
}

function MobileBottomNav() {
  const itemCls =
    "flex flex-col items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-[#3f382f]";
  const iconCls = "h-5 w-5";

  return (
    <nav
      aria-label="Admin navigation"
      className="
        md:hidden fixed bottom-0 inset-x-0 z-40
        border-t border-[#e8e5df]
        bg-white/90 backdrop-blur supports-[backdrop-filter]:backdrop-blur
        w-full
      "
      style={{
        paddingLeft: "max(env(safe-area-inset-left),0px)",
        paddingRight: "max(env(safe-area-inset-right),0px)",
        paddingBottom: "max(env(safe-area-inset-bottom),0px)",
      }}
    >
      <ul className="grid grid-cols-4">
        <li>
          <a href="/admin" className={itemCls}>
            <svg
              className={iconCls}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path d="M3 12l9-9 9 9" strokeWidth="2" />
              <path d="M9 21V9h6v12" strokeWidth="2" />
            </svg>
            Home
          </a>
        </li>
        <li>
          <a href="/admin/bookings" className={itemCls}>
            <svg
              className={iconCls}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2" />
              <path d="M16 2v4M8 2v4M3 10h18" strokeWidth="2" />
            </svg>
            Bookings
          </a>
        </li>
        <li>
          <a href="/admin/experiences" className={itemCls}>
            <svg
              className={iconCls}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                d="M12 21c-3.5-3.5-6-7-6-10a6 6 0 1 1 12 0c0 3-2.5 6.5-6 10z"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="11" r="2" strokeWidth="2" />
            </svg>
            Experiences
          </a>
        </li>
        <li>
          <a href="/admin/settings" className={itemCls}>
            <svg
              className={iconCls}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.07a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.07a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H8c.55 0 1-.45 1-1V3a2 2 0 0 1 4 0v.07c0 .55.45 1 1 1h.1c.53.3 1.2-.07 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V8c0 .55.45 1 1 1H21a2 2 0 0 1 0 4h-.07a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Settings
          </a>
        </li>
      </ul>
    </nav>
  );
}
