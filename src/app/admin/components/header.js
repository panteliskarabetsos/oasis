// app/(admin)/components/admin/header.js

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  Compass,
  CalendarDays,
  CalendarPlus,
  UserPlus,
  Users,
  Clock,
  Plus,
  ChevronDown,
  ExternalLink,
  LogOut,
  Sparkles,
  Bell,
} from "lucide-react";
import AdminMobileMenu from "./mobile-menu";

/** Server action lives here so the header can stay a Server Component */
async function signOut() {
  "use server";
  const supa = await createSupabaseServer();
  await supa.auth.signOut();
  redirect("/");
}

const SECTIONS = [
  { href: "/admin/experiences", label: "Experiences", icon: Compass },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/schedule", label: "Schedule", icon: Clock },
];

function getActiveSection(activePath) {
  if (typeof activePath !== "string" || !activePath) return null;

  // longest matching prefix wins
  let best = null;
  for (const s of SECTIONS) {
    if (
      activePath === s.href ||
      activePath.startsWith(s.href + "/") ||
      activePath.startsWith(s.href)
    ) {
      if (!best || s.href.length > best.href.length) best = s;
    }
  }
  return best;
}

function titleizeSegment(seg) {
  const s = decodeURIComponent(String(seg || "")).trim();
  if (!s) return "";
  if (s === "new") return "New";
  if (s === "edit") return "Edit";
  if (s === "images") return "Images";
  if (s === "settings") return "Settings";
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isLikelyId(seg) {
  // numeric id or uuid-ish
  return /^\d+$/.test(seg) || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg);
}

function buildPageIndicator(activePath, activeSection) {
  if (!activeSection) return "Dashboard";

  const base = activeSection.href;
  const raw = typeof activePath === "string" ? activePath : "";
  const rest = raw.replace(base, "").replace(/^\/+/, ""); // remove section prefix & leading '/'
  if (!rest) return activeSection.label;
  const isActive =
    typeof activePath === "string" &&
    (activePath === base || activePath.startsWith(base + "/"));

  const parts = rest
    .split("/")
    .filter(Boolean)
    .map((p) => (isLikelyId(p) ? "Details" : titleizeSegment(p)));

  return [activeSection.label, ...parts].join(" / ");
}

export default async function AdminHeader({
  displayName = "Admin",
  activePath = "",
}) {
  const trimmed = typeof displayName === "string" ? displayName.trim() : "";
  const initial = (trimmed && [...trimmed][0]?.toUpperCase()) || "•";
  const active = getActiveSection(activePath);
  const indicator = buildPageIndicator(activePath, active);

  // 1. Check for pending guest requests directly on the server
  const supa = await createSupabaseServer();
  const { count, error } = await supa
    .from("booking_request")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const pendingRequestsCount = count || 0;
  const hasPendingRequests = pendingRequestsCount > 0;

  return (
    <>
      {/* Skip link */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only fixed left-3 top-3 z-[100] rounded-full bg-[#8b6f47] px-4 py-2 text-sm font-medium text-white shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        Skip to content
      </a>

      <header
        role="banner"
        className={[
          "sticky top-0 z-50",
          "border-b border-[#e0dcd4] dark:border-white/10",
          "bg-white/60 backdrop-blur-xl supports-[backdrop-filter]:bg-white/50 dark:bg-neutral-900/60",
          "shadow-[0_10px_35px_-25px_rgba(0,0,0,0.35)]",
        ].join(" ")}
      >
        {/* soft ambient gradients */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 left-10 h-40 w-40 rounded-full bg-[#efe8de] blur-3xl opacity-70 dark:opacity-20" />
          <div className="absolute -top-24 right-10 h-40 w-40 rounded-full bg-[#fff1da] blur-3xl opacity-60 dark:opacity-20" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#8b6f47]/35 to-transparent dark:via-white/15" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center justify-between gap-3 py-3.5">
            {/* Brand */}
            <Link
              href="/admin"
              className="group flex items-center gap-3"
              aria-label="Go to Admin home"
            >
              <span className="relative inline-grid h-10 w-10 place-items-center rounded-2xl border border-[#e0dcd4] bg-white/80 text-[12px] font-semibold text-[#8b6f47] shadow-sm ring-1 ring-black/[0.02] dark:bg-neutral-800/70 dark:border-white/10 dark:text-amber-300">
                OA
                <span
                  aria-hidden
                  className="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white/85 dark:ring-neutral-900"
                />
              </span>

              <div className="leading-tight">
                <div className="flex items-center gap-2">
                  <p className="font-serif text-lg text-[#5a4a3f] dark:text-neutral-100">
                    Oasis Admin
                  </p>

                  {/* Active section chip (mobile) */}
                  {active ? (
                    <span className="md:hidden inline-flex items-center gap-1 rounded-full border border-[#e7e0d6] bg-white/70 px-2.5 py-1 text-[11px] text-[#5a4a3f] shadow-sm dark:border-white/10 dark:bg-neutral-800/60 dark:text-neutral-100">
                      <active.icon
                        size={13}
                        className="opacity-70"
                        aria-hidden
                      />
                      {active.label}
                    </span>
                  ) : null}
                </div>

                <p className="text-[11px] text-[#7a6a5f] opacity-85 dark:text-neutral-300">
                  Manage experiences & reservations
                </p>
              </div>
            </Link>

            {/* Desktop nav (segmented pills) */}
            <nav className="hidden md:flex items-center" aria-label="Primary">
              <div className="flex items-center gap-1.5 rounded-full border border-[#e8e2d9] bg-white/55 px-1.5 py-1 shadow-sm dark:border-white/10 dark:bg-neutral-800/50">
                {SECTIONS.map((s) => (
                  <NavLink
                    key={s.href}
                    href={s.href}
                    label={s.label}
                    icon={s.icon}
                    activePath={activePath}
                  />
                ))}
              </div>
            </nav>

            {/* Right cluster */}
            <div className="flex items-center gap-2.5">
              {/* Notification Bell Popover */}
              <div className="relative">
                <details className="group relative">
                  <summary
                    className="list-none relative flex h-10 w-10 cursor-pointer select-none items-center justify-center rounded-full border border-[#e8e2d9] bg-white/60 text-[#5a4a3f] shadow-sm hover:bg-[#efeae3] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/50 dark:border-white/10 dark:bg-neutral-800/60 dark:text-neutral-100 dark:hover:bg-neutral-800"
                    aria-label={`View requests ${hasPendingRequests ? `(${pendingRequestsCount} pending)` : ""}`}
                  >
                    <Bell
                      size={18}
                      className={`transition-colors ${hasPendingRequests ? "text-red-500 fill-red-50" : "opacity-70"}`}
                    />
                    {hasPendingRequests && (
                      <span className="absolute right-[9px] top-[9px] flex h-2.5 w-2.5 -translate-y-1/2 translate-x-1/2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full border-[1.5px] border-white bg-red-500 dark:border-neutral-900"></span>
                      </span>
                    )}
                  </summary>

                  {/* Notification Dropdown Panel */}
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-[320px] overflow-hidden rounded-2xl border border-[#e8e2d9] bg-white shadow-xl ring-1 ring-black/5 dark:bg-neutral-900 dark:border-white/10 dark:ring-white/5 z-[60]"
                  >
                    <div className="px-4 py-3 border-b border-[#e9e4dc] dark:border-white/10 flex justify-between items-center bg-[#fdfcfb] dark:bg-neutral-800/50">
                      <p className="text-sm font-semibold text-[#5a4a3f] dark:text-neutral-100">
                        Notifications
                      </p>
                      {hasPendingRequests && (
                        <span className="bg-red-50 border border-red-200 text-red-600 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full">
                          {pendingRequestsCount} New
                        </span>
                      )}
                    </div>

                    <div className="p-2">
                      {hasPendingRequests ? (
                        <div className="px-4 py-4 rounded-xl bg-amber-50/50 border border-amber-100 dark:border-neutral-700 dark:bg-neutral-800/50 transition">
                          <div className="flex items-start gap-3">
                            <span className="relative flex h-3 w-3 mt-1 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                            </span>
                            <div>
                              <p className="text-sm font-medium text-[#5a4a3f] dark:text-neutral-200 mb-1 leading-snug">
                                You have <strong>{pendingRequestsCount}</strong>{" "}
                                pending guest request
                                {pendingRequestsCount > 1 ? "s" : ""} waiting
                                for your review.
                              </p>
                              <p className="text-xs text-[#8b6f47] dark:text-amber-400">
                                Cancellations & Reschedules
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="px-3 py-8 text-center text-sm text-[#a79a8f] flex flex-col items-center">
                          <div className="bg-[#f7f4ef] dark:bg-neutral-800 p-3 rounded-full mb-3">
                            <Bell size={24} className="opacity-40" />
                          </div>
                          <p className="font-medium text-[#5a4a3f] dark:text-neutral-300">
                            You're all caught up!
                          </p>
                          <p className="text-xs mt-1">
                            No pending requests at the moment.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="p-2 border-t border-[#e9e4dc] bg-[#fdfcfb] dark:border-white/10 dark:bg-neutral-900/50">
                      <Link
                        href="/admin/requests"
                        className="flex justify-center items-center gap-1.5 w-full rounded-xl py-2.5 text-xs font-bold uppercase tracking-widest text-white bg-[#1a1a1a] hover:bg-[#333] transition shadow-sm dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                      >
                        Open Requests Dashboard <ExternalLink size={14} />
                      </Link>
                    </div>
                  </div>
                </details>
              </div>

              {/* Create dropdown (Desktop Only) */}
              <div className="hidden sm:block">
                <details className="relative group">
                  <summary
                    className={[
                      "list-none inline-flex cursor-pointer select-none items-center gap-2",
                      "rounded-full bg-[#8b6f47] px-4 py-2 text-sm text-white shadow-sm font-medium",
                      "hover:bg-[#7a5f3a] transition motion-reduce:transition-none",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/60",
                      "dark:bg-amber-600 dark:hover:bg-amber-700",
                    ].join(" ")}
                    aria-label="Open create menu"
                    aria-haspopup="menu"
                  >
                    <Plus size={16} aria-hidden />
                    <span>Create</span>
                    <ChevronDown
                      size={14}
                      className="opacity-80 transition group-open:rotate-180 motion-reduce:transition-none"
                      aria-hidden
                    />
                  </summary>

                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-[260px] overflow-hidden rounded-2xl border border-[#e8e2d9] bg-white shadow-xl ring-1 ring-black/5 dark:bg-neutral-900 dark:border-white/10 dark:ring-white/5"
                  >
                    <div className="px-3 py-2">
                      <p className="text-xs uppercase tracking-widest text-[#a79a8f]">
                        Quick actions
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-[#5a4a3f] dark:text-neutral-100">
                        Create something new
                      </p>
                    </div>
                    <div className="h-px bg-gradient-to-r from-transparent via-[#e9e4dc] to-transparent dark:via-white/10" />

                    <ul className="p-2">
                      <li role="none">
                        <Link
                          href="/admin/experiences/new"
                          role="menuitem"
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#5a4a3f] hover:bg-[#f7f4ef] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40 dark:text-neutral-100 dark:hover:bg-neutral-800"
                        >
                          <Sparkles
                            size={16}
                            className="opacity-70"
                            aria-hidden
                          />
                          New experience
                        </Link>
                      </li>
                      <li role="none">
                        <Link
                          href="/admin/bookings/new"
                          role="menuitem"
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#5a4a3f] hover:bg-[#f7f4ef] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40 dark:text-neutral-100 dark:hover:bg-neutral-800"
                        >
                          <CalendarPlus
                            size={16}
                            className="opacity-70"
                            aria-hidden
                          />
                          New Booking
                        </Link>
                      </li>
                      <li role="none">
                        <Link
                          href="/admin/users"
                          role="menuitem"
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#5a4a3f] hover:bg-[#f7f4ef] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40 dark:text-neutral-100 dark:hover:bg-neutral-800"
                        >
                          <UserPlus
                            size={16}
                            className="opacity-70"
                            aria-hidden
                          />
                          New Client
                        </Link>
                      </li>
                    </ul>
                  </div>
                </details>
              </div>

              {/* User menu (Desktop only) */}
              <div className="hidden md:block">
                <details className="relative group">
                  <summary
                    className={[
                      "list-none inline-flex cursor-pointer select-none items-center gap-2",
                      "rounded-full border border-[#e8e2d9] bg-white/60 px-3 py-1.5 text-xs font-medium text-[#5a4a3f] shadow-sm",
                      "hover:bg-[#efeae3] transition motion-reduce:transition-none",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/50",
                      "dark:border-white/10 dark:bg-neutral-800/60 dark:text-neutral-100 dark:hover:bg-neutral-800",
                    ].join(" ")}
                    aria-label="Open user menu"
                    aria-haspopup="menu"
                  >
                    <span
                      className="inline-grid h-7 w-7 place-items-center rounded-full bg-[#e8dfcf] text-[11px] font-bold dark:bg-neutral-700"
                      aria-hidden
                    >
                      {initial}
                    </span>

                    <span className="hidden sm:inline truncate max-w-[16ch]">
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
                    className="absolute right-0 mt-2 w-[260px] overflow-hidden rounded-2xl border border-[#e8e2d9] bg-white shadow-xl ring-1 ring-black/5 dark:bg-neutral-900 dark:border-white/10 dark:ring-white/5"
                  >
                    <div className="px-4 py-3">
                      <p className="truncate text-sm font-semibold text-[#5a4a3f] dark:text-neutral-100">
                        {trimmed || "Admin"}
                      </p>
                      <p className="text-[11px] text-[#7a6a5f] mt-0.5 dark:text-neutral-300">
                        Administrator
                      </p>
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-[#e9e4dc] to-transparent dark:via-white/10" />

                    <ul className="p-2">
                      <li role="none">
                        <Link
                          href="/"
                          role="menuitem"
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-[#5a4a3f] hover:bg-[#f7f4ef] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40 dark:text-neutral-100 dark:hover:bg-neutral-800"
                        >
                          <span className="inline-flex items-center gap-2">
                            <ExternalLink
                              size={16}
                              className="opacity-70"
                              aria-hidden
                            />
                            Back to site
                          </span>
                          <span aria-hidden className="opacity-50">
                            ↗
                          </span>
                        </Link>
                      </li>

                      <li role="none">
                        <form action={signOut}>
                          <button
                            type="submit"
                            role="menuitem"
                            className="flex w-full mt-1 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-[#8b3f3f] hover:bg-[#fff4e8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40 dark:text-red-300 dark:hover:bg-red-950/20"
                          >
                            <LogOut
                              size={16}
                              className="opacity-80"
                              aria-hidden
                            />
                            Sign out
                          </button>
                        </form>
                      </li>
                    </ul>
                  </div>
                </details>
              </div>

              {/* Mobile menu */}
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

/** NavLink with crisp active styling */
function NavLink({ href, label, icon: Icon, activePath = "" }) {
  const isActive =
    typeof activePath === "string" &&
    (activePath === href ||
      activePath.startsWith(href + "/") ||
      activePath.startsWith(href));

  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
      data-active={isActive ? "" : undefined}
      className={[
        "relative inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm",
        "border border-transparent",
        "text-[#5a4a3f] hover:text-[#2f261f] dark:text-neutral-100",
        "hover:bg-[#f3efe8] dark:hover:bg-neutral-800",
        "transition motion-reduce:transition-none",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/45",
        // active: stronger background + border + tiny bottom indicator
        "data-[active]:bg-[#efeae3] data-[active]:border-[#d6cbbf] data-[active]:shadow-sm data-[active]:font-semibold",
        "dark:data-[active]:bg-neutral-800 dark:data-[active]:border-white/15",
      ].join(" ")}
      title={label}
    >
      {Icon ? (
        <Icon
          size={16}
          className={`opacity-80 ${isActive ? "text-[#8b6f47] dark:text-amber-300 opacity-100" : ""}`}
          aria-hidden
          focusable="false"
        />
      ) : null}

      <span>{label}</span>

      {/* subtle active indicator */}
      {isActive ? (
        <span
          aria-hidden
          className="absolute -bottom-[6px] left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-[#8b6f47]/55 dark:bg-white/20"
        />
      ) : null}
    </Link>
  );
}
