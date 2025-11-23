// app/(admin)/components/admin/header.js

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  Compass,
  CalendarDays,
  Users,
  Clock,
  Plus,
  ChevronDown,
} from "lucide-react";
import AdminMobileMenu from "./mobile-menu";

/** Server action lives here so the header can stay a Server Component */
async function signOut() {
  "use server";
  const supa = await createSupabaseServer();
  await supa.auth.signOut();
  redirect("/");
}

/**
 * AdminHeader
 * - Pass optional `activePath` to highlight the current section.
 *   (e.g., from a tiny client wrapper that reads `usePathname()`)
 */
export default function AdminHeader({
  displayName = "Admin",
  activePath = "", // e.g. "/admin/bookings"
}) {
  const trimmed = typeof displayName === "string" ? displayName.trim() : "";
  const initial = (trimmed && [...trimmed][0]?.toUpperCase()) || "•"; // unicode-safe initial

  return (
    <>
      {/* Skip link for keyboard users */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only fixed left-3 top-3 z-[100] rounded-full bg-[#8b6f47] px-4 py-2 text-sm font-medium text-white shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        Skip to content
      </a>

      <header
        role="banner"
        className="sticky top-0 z-50 border-b border-[#e0dcd4] bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-neutral-900/70 dark:border-white/10"
      >
        {/* Ambient underline */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-[#e9e4dc] via-[#8b6f47]/40 to-[#e9e4dc] dark:from-white/10 dark:via-white/20 dark:to-white/10"
        />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Brand */}
            <Link
              href="/admin"
              className="group flex items-center gap-3"
              aria-label="Go to Admin home"
            >
              <span className="relative inline-grid h-10 w-10 place-items-center rounded-2xl border border-[#e0dcd4] bg-[#fdfaf7] font-serif text-[13px] text-[#8b6f47] shadow-sm ring-1 ring-black/[0.02] dark:bg-neutral-800 dark:border-white/10 dark:text-amber-300">
                OA
                <span
                  aria-hidden
                  className="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white/80 dark:ring-neutral-900"
                />
              </span>
              <div className="leading-tight">
                <p className="font-serif text-lg text-[#5a4a3f] dark:text-neutral-100">
                  Oasis Admin
                </p>
                <p className="text-[11px] text-[#7a6a5f] opacity-80 dark:text-neutral-300">
                  Manage experiences & reservations
                </p>
              </div>
            </Link>

            {/* Desktop nav */}
            <nav
              className="hidden md:flex items-center gap-1"
              aria-label="Primary"
            >
              <NavLink
                href="/admin/experiences"
                label="Experiences"
                icon={Compass}
                activePath={activePath}
              />
              <NavLink
                href="/admin/bookings"
                label="Bookings"
                icon={CalendarDays}
                activePath={activePath}
              />
              <NavLink
                href="/admin/users"
                label="Users"
                icon={Users}
                activePath={activePath}
              />
              <NavLink
                href="/admin/schedule"
                label="Schedule"
                icon={Clock}
                activePath={activePath}
              />
            </nav>

            {/* Right cluster */}
            <div className="flex items-center gap-2">
              {/* Create CTA (desktop / sm+) */}
              <Link
                href="/admin/experiences/new"
                className="hidden sm:inline-flex items-center gap-2 rounded-full bg-[#8b6f47] px-3 py-2 text-sm text-white shadow-sm hover:bg-[#7a5f3a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/60 transition motion-reduce:transition-none dark:bg-amber-600 dark:hover:bg-amber-700"
                aria-label="Create new experience"
              >
                <Plus size={16} aria-hidden />
                Create
              </Link>

              {/* User menu (desktop only) */}
              <div className="hidden md:block">
                <details className="relative group">
                  <summary
                    className="list-none inline-flex cursor-pointer select-none items-center gap-2 rounded-full border border-[#e8e2d9] bg-[#f6f4f0] px-2.5 py-1.5 text-xs text-[#5a4a3f] shadow-sm hover:bg-[#efeae3] transition motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/50 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-750"
                    aria-label="Open user menu"
                    aria-haspopup="menu"
                  >
                    <span
                      className="inline-grid h-6 w-6 place-items-center rounded-full bg-[#e8dfcf] text-[11px] font-semibold dark:bg-neutral-700"
                      aria-hidden
                    >
                      {initial}
                    </span>
                    <span className="hidden sm:inline truncate max-w-[12ch]">
                      {trimmed || "Admin"}
                    </span>
                    <ChevronDown
                      size={14}
                      className="opacity-60 transition group-open:rotate-180 motion-reduce:transition-none"
                      aria-hidden
                    />
                  </summary>

                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-[240px] overflow-hidden rounded-2xl border border-[#e8e2d9] bg-white shadow-xl ring-1 ring-black/5 dark:bg-neutral-900 dark:border-white/10 dark:ring-white/5"
                  >
                    <div className="px-3 py-2">
                      <p className="truncate text-sm font-medium text-[#5a4a3f] dark:text-neutral-100">
                        {trimmed || "Admin"}
                      </p>
                      <p className="text-[11px] text-[#7a6a5f] dark:text-neutral-300">
                        Administrator
                      </p>
                    </div>
                    <div className="h-px bg-gradient-to-r from-transparent via-[#e9e4dc] to-transparent dark:via-white/10" />

                    <ul className="p-2">
                      <li role="none">
                        <Link
                          href="/"
                          role="menuitem"
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-[#5a4a3f] hover:bg-[#f7f4ef] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40 dark:text-neutral-100 dark:hover:bg-neutral-800"
                        >
                          Back to site <span aria-hidden>↗</span>
                        </Link>
                      </li>
                      <li role="none">
                        <form action={signOut}>
                          <button
                            type="submit"
                            role="menuitem"
                            className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-[#8b3f3f] hover:bg-[#fff4e8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40 dark:text-red-300 dark:hover:bg-red-950/20"
                          >
                            Sign out
                          </button>
                        </form>
                      </li>
                    </ul>
                  </div>
                </details>
              </div>

              {/* Hamburger (mobile only) */}
              <AdminMobileMenu
                displayName={trimmed || "Admin"}
                signOutAction={signOut}
              />
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

/** Reusable NavLink with optional active state */
function NavLink({ href, label, icon: Icon, small, activePath = "" }) {
  // Treat route as active if it matches exactly or the current path starts with it.
  const isActive =
    typeof activePath === "string" &&
    (activePath === href || activePath.startsWith(href));

  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
      data-active={isActive ? "" : undefined}
      className={[
        "inline-flex items-center gap-2 rounded-full border text-[#5a4a3f] shadow-sm transition motion-reduce:transition-none",
        "border-[#e0dcd4] bg-[#fdfaf7] hover:bg-[#f1ede7] hover:border-[#d6cbbf]",
        "dark:border-white/10 dark:bg-neutral-850 dark:text-neutral-100 dark:hover:bg-neutral-800",
        small ? "px-3 py-1 text-[12px]" : "px-3.5 py-2 text-sm",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/50",
        // Active styles (no color hard-coding to extremes; subtle but clear)
        "data-[active]:border-[#cdbfae] data-[active]:bg-[#efeae3] data-[active]:shadow",
        "dark:data-[active]:bg-neutral-800 dark:data-[active]:border-white/20",
      ].join(" ")}
      title={label}
    >
      {Icon ? (
        <Icon size={16} className="opacity-70" aria-hidden focusable="false" />
      ) : null}
      <span>{label}</span>
    </Link>
  );
}

/* -----------------------------------------------------------------------
   OPTIONAL: tiny client wrapper to auto-set activePath
   Save as: app/(admin)/components/admin/header.client.jsx

   'use client'
   import { usePathname } from 'next/navigation'
   import AdminHeader from './header'

   export default function AdminHeaderClient(props){
     const pathname = usePathname()
     return <AdminHeader {...props} activePath={pathname || ''} />
   }
----------------------------------------------------------------------- */
