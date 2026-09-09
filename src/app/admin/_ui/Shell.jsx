"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";
import { visibleGroups } from "./nav";

/* ------------------------------ sidebar item ----------------------------- */

function NavLink({ item, active, pendingCount, onNavigate }) {
  const badge = item.badge === "requests" && pendingCount > 0 ? pendingCount : null;

  if (item.soon) {
    return (
      <span
        className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2 text-[13px] text-white/25"
        title="Not built yet"
      >
        <Icon name={item.icon} size={17} />
        <span className="truncate">{item.label}</span>
        <span className="ml-auto rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] uppercase tracking-wider">
          soon
        </span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition-colors ${
        active
          ? "bg-[#8b6f47] font-semibold text-white shadow-sm"
          : "text-white/65 hover:bg-white/[0.07] hover:text-white"
      }`}
    >
      <Icon name={item.icon} size={17} className={active ? "" : "text-white/45 group-hover:text-white/80"} />
      <span className="truncate">{item.label}</span>
      {badge ? (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c0563a] px-1.5 text-[10px] font-bold text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

/* -------------------------------- sidebar -------------------------------- */

function SidebarContent({ permissions, pathname, pendingCount, onNavigate }) {
  const groups = visibleGroups(permissions);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#b89a6b]/40 bg-[#b89a6b]/10">
          <Icon name="leaf" size={18} className="text-[#c8aa86]" />
        </div>
        <div className="min-w-0">
          <p className="font-serif text-[15px] leading-none text-white">Oasis</p>
          <p className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.2em] text-[#b89a6b]">
            Console
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="px-3 pb-1.5 text-[9.5px] font-bold uppercase tracking-[0.18em] text-white/30">
              {g.label}
            </p>
            <div className="space-y-0.5">
              {g.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  pendingCount={pendingCount}
                  onNavigate={onNavigate}
                  active={
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname === item.href || pathname.startsWith(item.href + "/")
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 px-3 py-3">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-[12px] text-white/50 transition-colors hover:bg-white/[0.07] hover:text-white"
        >
          <Icon name="external" size={16} />
          Back to site
        </Link>
      </div>
    </div>
  );
}

/* --------------------------------- shell --------------------------------- */

export default function AdminShell({
  role,
  permissions,
  displayName,
  email,
  isTest,
  signOutAction,
  children,
}) {
  const pathname = usePathname() || "/admin";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // live pending-requests badge
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/requests", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.items || [];
        if (!cancelled) setPendingCount(list.length);
      } catch {
        /* badge is non-critical */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // close the drawer on route change + lock scroll while open
  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const initials =
    (displayName || email || "?")
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?";

  return (
    <div className="min-h-[100dvh] bg-[#f7f4ef]">
      {/* ---------------- desktop sidebar ---------------- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] bg-[#1e1a15] lg:block">
        <SidebarContent
          permissions={permissions}
          pathname={pathname}
          pendingCount={pendingCount}
        />
      </aside>

      {/* ---------------- mobile drawer ---------------- */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[272px] bg-[#1e1a15] shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-4 rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
            >
              <Icon name="x" size={18} />
            </button>
            <SidebarContent
              permissions={permissions}
              pathname={pathname}
              pendingCount={pendingCount}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      {/* ---------------- main column ---------------- */}
      <div className="lg:pl-[248px]">
        <header
          className="sticky top-0 z-30 border-b border-[#e6e0d6] bg-[#f7f4ef]/85 backdrop-blur"
          style={{ paddingTop: "max(env(safe-area-inset-top),0px)" }}
        >
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="rounded-lg p-2 text-[#5a4a3f] hover:bg-[#ece6dc] lg:hidden"
            >
              <Icon name="menu" size={20} />
            </button>

            <Link href="/admin" className="font-serif text-[15px] text-[#2a211a] lg:hidden">
              Oasis
            </Link>

            <div className="ml-auto flex items-center gap-2">
              {pendingCount > 0 ? (
                <Link
                  href="/admin/requests"
                  className="relative rounded-lg p-2 text-[#5a4a3f] transition-colors hover:bg-[#ece6dc]"
                  title={`${pendingCount} pending guest request${pendingCount === 1 ? "" : "s"}`}
                >
                  <Icon name="bell" size={18} />
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#c0563a] ring-2 ring-[#f7f4ef]" />
                </Link>
              ) : null}

              <div className="flex items-center gap-2.5 rounded-full border border-[#e6e0d6] bg-white py-1 pl-1 pr-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#8b6f47] text-[11px] font-bold text-white">
                  {initials}
                </span>
                <span className="hidden text-[12px] leading-tight sm:block">
                  <span className="block font-semibold text-[#3f3127]">{displayName}</span>
                  <span className="block text-[10px] uppercase tracking-wider text-[#9a8c7e]">
                    {role}
                  </span>
                </span>
              </div>

              <form action={signOutAction}>
                <button
                  type="submit"
                  title="Sign out"
                  className="rounded-lg p-2 text-[#5a4a3f] transition-colors hover:bg-[#ece6dc]"
                >
                  <Icon name="logout" size={18} />
                </button>
              </form>
            </div>
          </div>

          {isTest ? (
            <div className="border-t border-[#f0e0bb] bg-[#fbf1dc] px-4 py-1.5 text-center text-[11px] font-medium text-[#8a6412] sm:px-6 lg:px-8">
              Stripe is in <strong>test mode</strong> — charges are not real.
            </div>
          ) : null}
        </header>

        <main
          id="admin-content"
          className="py-6 lg:py-8"
          style={{ paddingBottom: "calc(max(env(safe-area-inset-bottom),0px) + 2rem)" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
