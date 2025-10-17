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

async function signOut() {
  "use server";
  const supa = await createSupabaseServer();
  await supa.auth.signOut();
  redirect("/");
}

export default function AdminHeader({ displayName = "Admin" }) {
  const initial = (displayName?.trim?.()?.[0] || "•").toUpperCase();

  return (
    <>
      {/* Skip to content for keyboard users */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only fixed left-3 top-3 z-[100] rounded-full bg-[#8b6f47] px-4 py-2 text-sm font-medium text-white shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-50 border-b border-[#e0dcd4] bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        {/* Subtle ambient gradient underline */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-[#e9e4dc] via-[#8b6f47]/40 to-[#e9e4dc]"
        />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Brand */}
            <Link
              href="/admin"
              prefetch
              className="group flex items-center gap-3"
              aria-label="Go to Admin home"
            >
              <span className="relative inline-grid h-10 w-10 place-items-center rounded-2xl border border-[#e0dcd4] bg-[#fdfaf7] font-serif text-[13px] text-[#8b6f47] shadow-sm ring-1 ring-black/[0.02]">
                OA
                <span
                  aria-hidden
                  className="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white/80"
                />
              </span>
              <div className="leading-tight">
                <p className="font-serif text-lg text-[#5a4a3f]">Oasis Admin</p>
                <p className="text-[11px] text-[#7a6a5f] opacity-80">
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
              />
              <NavLink
                href="/admin/bookings"
                label="Bookings"
                icon={CalendarDays}
              />
              <NavLink href="/admin/users" label="Users" icon={Users} />
              <NavLink href="/admin/schedule" label="Schedule" icon={Clock} />
            </nav>

            {/* Right cluster */}
            <div className="flex items-center gap-2">
              {/* Create CTA (desktop / sm+) */}
              <Link
                href="/admin/experiences/new"
                prefetch
                className="hidden sm:inline-flex items-center gap-2 rounded-full bg-[#8b6f47] px-3 py-2 text-sm text-white shadow-sm hover:bg-[#7a5f3a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/60 transition"
                aria-label="Create new experience"
              >
                <Plus size={16} aria-hidden />
                Create
              </Link>

              {/* User menu (desktop only) */}
              <div className="hidden md:block">
                <details className="relative group">
                  <summary
                    className="list-none inline-flex cursor-pointer select-none items-center gap-2 rounded-full border border-[#e8e2d9] bg-[#f6f4f0] px-2.5 py-1.5 text-xs text-[#5a4a3f] shadow-sm hover:bg-[#efeae3] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/50"
                    aria-label="Open user menu"
                  >
                    <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-[#e8dfcf] text-[11px] font-semibold">
                      {initial}
                    </span>
                    <span className="hidden sm:inline">{displayName}</span>
                    <ChevronDown
                      size={14}
                      className="opacity-60 transition group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <div className="absolute right-0 mt-2 w-[220px] overflow-hidden rounded-2xl border border-[#e8e2d9] bg-white shadow-xl ring-1 ring-black/5">
                    <div className="px-3 py-2">
                      <p className="truncate text-sm font-medium text-[#5a4a3f]">
                        {displayName}
                      </p>
                      <p className="text-[11px] text-[#7a6a5f]">
                        Administrator
                      </p>
                    </div>
                    <div className="h-px bg-gradient-to-r from-transparent via-[#e9e4dc] to-transparent" />
                    <ul className="p-2">
                      <li>
                        <Link
                          href="/"
                          prefetch
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-[#5a4a3f] hover:bg-[#f7f4ef] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40"
                        >
                          Back to site
                          <span aria-hidden>↗</span>
                        </Link>
                      </li>
                      <li>
                        <form action={signOut}>
                          <button
                            type="submit"
                            className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-[#8b3f3f] hover:bg-[#fff4e8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40"
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
                displayName={displayName}
                signOutAction={signOut}
              />
            </div>
          </div>

          {/* ⬇️ Removed the old "Mobile quick actions" grid */}
        </div>
      </header>
    </>
  );
}

function NavLink({ href, label, icon: Icon, small }) {
  return (
    <Link
      href={href}
      prefetch
      className={[
        "inline-flex items-center gap-2 rounded-full border border-[#e0dcd4] bg-[#fdfaf7] text-[#5a4a3f] shadow-sm",
        "hover:bg-[#f1ede7] hover:border-[#d6cbbf] transition",
        small ? "px-3 py-1 text-[12px]" : "px-3.5 py-2 text-sm",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/50",
      ].join(" ")}
      aria-label={label}
    >
      {Icon ? <Icon size={16} className="opacity-70" aria-hidden /> : null}
      <span>{label}</span>
    </Link>
  );
}
