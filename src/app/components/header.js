"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  UserCircle,
  ChevronDown,
  LogIn,
  User,
  ShieldCheck,
} from "lucide-react";
import { useRouteLoader } from "./RouteLoader";
import { useAuth } from "./SessionWrapper";

/* ---------- helpers ---------- */
function safeTitle(str = "") {
  return String(str)
    .toLowerCase()
    .replace(/(^.|[\s-].)/g, (m) => m.toUpperCase())
    .trim();
}
function initialsFrom(first = "", last = "") {
  const a = (first || "").trim()[0];
  const b = (last || "").trim()[0];
  return [a, b].filter(Boolean).join("").toUpperCase() || "•";
}
function useClickOutside(ref, onClose) {
  useEffect(() => {
    function handler(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) onClose?.();
    }
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [ref, onClose]);
}

export default function Header() {
  const pathname = usePathname();
  const routeLoader = useRouteLoader();
  const { user, supabase } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [hasShadow, setHasShadow] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dbProfile, setDbProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const dropdownRef = useRef(null);
  useClickOutside(dropdownRef, () => setDropdownOpen(false));

  useEffect(() => {
    const onScroll = () => setHasShadow(window.scrollY > 4);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Esc closes menus
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setDropdownOpen(false);
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const navLinks = useMemo(
    () => [
      { name: "Experiences", href: "/experiences" },
      { name: "About", href: "/about" },
      { name: "Contact", href: "/contact" },
    ],
    []
  );

  // Fetch profile from your API (DB-first identity)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        setDbProfile(null);
        setProfileLoading(false);
        return;
      }
      setProfileLoading(true);
      try {
        const res = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setDbProfile(data || null);
      } catch {
        if (!cancelled) setDbProfile(null);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Merge DB + metadata
  const finalProfile = useMemo(() => {
    const md = user?.user_metadata || {};
    const rawFull = (
      md.firstName ??
      md.given_name ??
      md.name ??
      md.full_name ??
      ""
    ).trim();
    const rawLast = (md.lastName ?? md.family_name ?? md.surname ?? "").trim();

    const firstFromFull = rawFull.split(/\s+/)[0] || "";
    const metaFirst = safeTitle(md.firstName ?? firstFromFull);
    let metaLastSource = md.lastName;
    if (!metaLastSource) {
      metaLastSource =
        rawLast ||
        (rawFull.includes(" ") ? rawFull.split(/\s+/).slice(1).join(" ") : "");
    }
    const metaLast = safeTitle(metaLastSource);

    const first = dbProfile?.name?.trim?.() || metaFirst;
    const last = dbProfile?.surname?.trim?.() || metaLast;

    return {
      first: first ? safeTitle(first) : "",
      last: last ? safeTitle(last) : "",
      email: dbProfile?.email || user?.email || "",
      badge:
        dbProfile?.badge ||
        dbProfile?.role ||
        md.badge ||
        md.role ||
        "Explorer",
      isAdmin:
        (dbProfile?.badge || dbProfile?.role || md.badge || md.role) ===
        "admin",
    };
  }, [dbProfile, user]);

  const displayName =
    [finalProfile.first, finalProfile.last].filter(Boolean).join(" ") ||
    user?.email?.split("@")[0] ||
    "Account";

  const avatar = initialsFrom(finalProfile.first, finalProfile.last);
  const isAuthed = !!user;

  const go = useCallback(
    (href) => routeLoader?.triggerRouteChange(href),
    [routeLoader]
  );

  async function handleSignOut() {
    await supabase?.auth.signOut();
    setDropdownOpen(false);
    setIsOpen(false);
    go("/");
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 print:hidden transition-shadow ${
        hasShadow ? "shadow-lg" : "shadow-none"
      } bg-[#f4f1ec]/85 backdrop-blur-md border-b border-[#eae6e0]`}
      role="banner"
    >
      <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
        {/* Brand */}
        <button
          onClick={() => go("/")}
          className="group inline-flex items-center gap-2"
          aria-label="Go to homepage"
        >
          <span className="text-3xl font-serif tracking-tight text-[#5a4a3f] group-hover:text-[#8b6f47] transition-colors">
            Oasis
          </span>
        </button>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
          {navLinks.map((l) => {
            const active = pathname?.startsWith(l.href);
            return (
              <button
                key={l.href}
                onClick={() => go(l.href)}
                className={`rounded-full px-4 py-2 text-sm transition-all ${
                  active
                    ? "bg-white text-[#5a4a3f] border border-[#e0dcd4]"
                    : "text-[#5a4a3f] hover:bg-[#e8e2d9]"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {l.name}
              </button>
            );
          })}

          {/* CTA */}
          <button
            onClick={() => go("/experiences")}
            className="ml-2 rounded-full bg-[#8b6f47] px-4 py-2 text-sm text-white hover:bg-[#7a5f3a] transition-colors"
          >
            Book a Journey
          </button>

          {/* Account */}
          <div className="relative ml-2" ref={dropdownRef}>
            {isAuthed ? (
              <>
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full border border-[#e4ddd3] bg-[#fdfaf5] px-3 py-2 text-sm text-[#5a4a3f] hover:bg-[#f1ede7] transition"
                  aria-haspopup="menu"
                  aria-expanded={dropdownOpen}
                  aria-controls="account-menu"
                >
                  {/* Avatar */}
                  <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-[#e8dfcf] text-[10px] font-semibold text-[#5a4a3f]">
                    {avatar}
                  </span>
                  <span className="max-w-[10rem] truncate">
                    {finalProfile.first || displayName}
                  </span>
                  <ChevronDown size={16} />
                </button>

                {dropdownOpen && (
                  <div
                    id="account-menu"
                    role="menu"
                    className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-[#eae6e0] bg-white shadow-xl"
                  >
                    <div className="border-b border-[#eee] px-4 py-3">
                      <p className="truncate text-sm font-medium text-[#5a4a3f]">
                        {displayName}
                      </p>
                      <p className="truncate text-xs text-[#7a6a5f]">
                        {finalProfile.email}
                      </p>
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-[#efe7d9] bg-[#fbf7ef] px-2 py-0.5 text-[11px] text-[#5a4a3f]">
                        <ShieldCheck size={12} />{" "}
                        {safeTitle(finalProfile.badge)}
                      </span>
                    </div>

                    <button
                      role="menuitem"
                      onClick={() => {
                        setDropdownOpen(false);
                        go("/bookings");
                      }}
                      className="block w-full px-4 py-2 text-left text-sm text-[#5a4a3f] hover:bg-[#fdfaf5]"
                    >
                      My Bookings
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => {
                        setDropdownOpen(false);
                        go("/dashboard");
                      }}
                      className="block w-full px-4 py-2 text-left text-sm text-[#5a4a3f] hover:bg-[#fdfaf5]"
                    >
                      Dashboard
                    </button>

                    {(finalProfile.isAdmin ?? false) && (
                      <button
                        role="menuitem"
                        onClick={() => {
                          setDropdownOpen(false);
                          go("/admin");
                        }}
                        className="block w-full px-4 py-2 text-left text-sm text-[#5a4a3f] hover:bg-[#fdfaf5]"
                      >
                        Admin Dashboard
                      </button>
                    )}

                    <button
                      role="menuitem"
                      onClick={handleSignOut}
                      className="block w-full px-4 py-2 text-left text-sm text-[#b44d4d] hover:bg-[#fdfaf5]"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => go("/login")}
                  className="flex items-center gap-2 rounded-full border border-transparent px-3 py-2 text-sm text-[#8b6f47] hover:bg-[#e8e2d9] hover:text-[#5a4a3f]"
                >
                  <LogIn size={16} />
                  Log In
                </button>
                <button
                  onClick={() => go("/sign-up")}
                  className="flex items-center gap-2 rounded-full border border-[#e0dcd4] bg-white px-3 py-2 text-sm text-[#5a4a3f] hover:bg-[#faf7f1]"
                >
                  <User size={16} />
                  Register
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* Mobile controls */}
        <div className="md:hidden flex items-center gap-2">
          {isAuthed ? (
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-[#e4ddd3] bg-[#fdfaf5] px-3 py-2 text-sm text-[#5a4a3f] hover:bg-[#f1ede7] transition"
              aria-label="Account"
              aria-expanded={dropdownOpen}
            >
              <UserCircle size={20} />
              <ChevronDown size={16} />
            </button>
          ) : null}
          <button
            onClick={() => setIsOpen((v) => !v)}
            className="rounded-full p-2 text-[#5a4a3f] hover:bg-[#e8e2d9]"
            aria-label="Toggle menu"
            aria-expanded={isOpen}
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      {isOpen && (
        <div className="md:hidden border-t border-[#e2ded8] bg-[#f4f1ec] px-6 py-6 shadow-xl">
          <nav className="flex flex-col gap-2" aria-label="Mobile">
            <p className="px-2 pb-2 text-xs uppercase tracking-wide text-[#7a6a5f]">
              Navigate
            </p>
            {navLinks.map((l) => {
              const active = pathname?.startsWith(l.href);
              return (
                <button
                  key={l.href}
                  onClick={() => {
                    setIsOpen(false);
                    go(l.href);
                  }}
                  className={`rounded-xl px-4 py-3 text-left text-base ${
                    active
                      ? "bg-white text-[#5a4a3f] border border-[#e0dcd4]"
                      : "text-[#5a4a3f] hover:bg-[#e8e2d9]"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {l.name}
                </button>
              );
            })}

            <div className="mt-4 h-px bg-[#e7e2da]" />

            {isAuthed ? (
              <>
                <p className="px-2 pt-2 text-xs uppercase tracking-wide text-[#7a6a5f]">
                  Account
                </p>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    go("/bookings");
                  }}
                  className="rounded-xl px-4 py-3 text-left text-base text-[#5a4a3f] hover:bg-[#e8e2d9]"
                >
                  My Bookings
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    go("/dashboard");
                  }}
                  className="rounded-xl px-4 py-3 text-left text-base text-[#5a4a3f] hover:bg-[#e8e2d9]"
                >
                  Dashboard
                </button>
                {finalProfile.isAdmin && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      go("/admin");
                    }}
                    className="rounded-xl px-4 py-3 text-left text-base text-[#5a4a3f] hover:bg-[#e8e2d9]"
                  >
                    Admin Dashboard
                  </button>
                )}
                <button
                  onClick={handleSignOut}
                  className="mt-2 rounded-xl px-4 py-3 text-left text-base text-[#b44d4d] hover:bg-[#faecea]"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    go("/login");
                  }}
                  className="flex-1 rounded-xl border border-transparent bg-white px-4 py-3 text-center text-[#5a4a3f] hover:bg-[#faf7f1]"
                >
                  Log In
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    go("/sign-up");
                  }}
                  className="flex-1 rounded-xl border border-[#e0dcd4] bg-white px-4 py-3 text-center text-[#5a4a3f] hover:bg-[#faf7f1]"
                >
                  Register
                </button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
