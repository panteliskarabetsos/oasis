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
    document.addEventListener("pointerdown", handler, { passive: true });
    return () => document.removeEventListener("pointerdown", handler);
  }, [ref, onClose]);
}
function useBodyScrollLock(locked) {
  useEffect(() => {
    const { body, documentElement } = document;
    const prev = body.style.overflow;
    const prevTouch = documentElement.style.touchAction;
    if (locked) {
      body.style.overflow = "hidden"; // prevent background scroll
      documentElement.style.touchAction = "none"; // iOS overscroll guard
    } else {
      body.style.overflow = prev || "";
      documentElement.style.touchAction = prevTouch || "";
    }
    return () => {
      body.style.overflow = prev || "";
      documentElement.style.touchAction = prevTouch || "";
    };
  }, [locked]);
}

/* ------------------------------------------------------------------ */
/* Wrapper: decides whether to render the public header                */
/* ------------------------------------------------------------------ */
export default function Header() {
  const pathname = usePathname();
  const isAdminRoute =
    pathname === "/admin" || (pathname?.startsWith("/admin/") ?? false);

  // Toggle body padding based on whether the public header is visible
  useEffect(() => {
    const b = document?.body;
    if (!b) return;
    if (isAdminRoute) b.classList.remove("pt-[72px]");
    else b.classList.add("pt-[72px]");
  }, [isAdminRoute]);

  if (isAdminRoute) return null; // safe: conditional COMPONENT, not hooks
  return <PublicHeader />;
}

/* ------------------------------------------------------------------ */
/* Actual public header UI                                             */
/* ------------------------------------------------------------------ */
function PublicHeader() {
  const pathname = usePathname();
  const routeLoader = useRouteLoader();
  const { user, supabase } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [menuSection, setMenuSection] = useState(
    /** @type {"nav"|"account"} */ ("nav")
  );
  const [hasShadow, setHasShadow] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dbProfile, setDbProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const dropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const [headerH, setHeaderH] = useState(56);
  const mobileFirstFocusRef = useRef(null);
  const mobileToggleBtnRef = useRef(null);
  useClickOutside(dropdownRef, () => setDropdownOpen(false));

  // Header shadow on scroll (passive listener)
  useEffect(() => {
    const onScroll = () => setHasShadow(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ESC closes menus + focus return for mobile sheet
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setDropdownOpen(false);
        setIsOpen(false);
        mobileToggleBtnRef.current?.focus?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close any open menus on route change
  useEffect(() => {
    setIsOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  // Lock body scroll while mobile menu is open
  useBodyScrollLock(isOpen);

  // Close sheet if viewport grows to md+ (with Safari fallback)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e) => e.matches && setIsOpen(false);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange); // iOS Safari fallback
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else if (mq.removeListener) mq.removeListener(onChange);
    };
  }, []);

  // Measure header height for precise sheet positioning
  useEffect(() => {
    const el = document.getElementById("site-header");
    const setH = () => setHeaderH(el?.offsetHeight || 56);
    setH();
    window.addEventListener("resize", setH);
    return () => window.removeEventListener("resize", setH);
  }, []);

  // Focus management: when opening mobile menu, focus first action
  useEffect(() => {
    if (isOpen) {
      // give paint a tick
      const id = requestAnimationFrame(() => {
        mobileFirstFocusRef.current?.focus?.();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [isOpen, menuSection]);

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
      id="site-header"
      className={`fixed top-0 left-0 right-0 z-50 print:hidden transition-shadow ${
        hasShadow ? "shadow-lg" : "shadow-none"
      } bg-[#f4f1ec]/85 backdrop-blur-md border-b border-[#eae6e0] pt-[env(safe-area-inset-top)]`}
      role="banner"
    >
      {/* Skip link for a11y */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] rounded px-3 py-2 bg-white text-[#5a4a3f]"
      >
        Skip to content
      </a>

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
              ref={mobileToggleBtnRef}
              onClick={() => {
                setMenuSection("account");
                setIsOpen(true);
              }}
              className="flex items-center gap-2 rounded-full border border-[#e4ddd3] bg-[#fdfaf5] px-3 py-2 text-sm text-[#5a4a3f] hover:bg-[#f1ede7] transition"
              aria-label="Open account menu"
              aria-expanded={isOpen && menuSection === "account"}
              aria-controls="mobile-menu"
            >
              <UserCircle size={20} />
              <ChevronDown size={16} />
            </button>
          ) : null}
          <button
            onClick={() => {
              setMenuSection("nav");
              setIsOpen((v) => !v);
            }}
            className="rounded-full p-2 text-[#5a4a3f] hover:bg-[#e8e2d9]"
            aria-label="Toggle menu"
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* mobile */}
      <div
        className={`md:hidden ${
          isOpen
            ? "pointer-events-auto visible"
            : "pointer-events-none invisible"
        }`}
        aria-hidden={!isOpen}
      >
        {/* Backdrop */}
        <div
          className={`fixed inset-0 z-40 transition-opacity ${
            isOpen ? "opacity-100" : "opacity-0"
          } bg-black/30`}
          onPointerDown={() => setIsOpen(false)}
        />

        {/* Sheet */}
        <div
          id="mobile-menu"
          ref={mobileMenuRef}
          className={`fixed left-0 right-0 z-50 origin-top transform-gpu transition-transform duration-200 ease-out ${
            isOpen ? "translate-y-0" : "-translate-y-full"
          } border-t border-[#e2ded8] bg-[#fdfaf5] shadow-xl`}
          style={{ top: headerH }}
          role="dialog"
          aria-modal="true"
          aria-label={menuSection === "account" ? "Account" : "Navigation"}
        >
          <div className="px-6 py-4">
            {/* Sheet header (mobile close button) */}
            <div className="mb-2 flex items-center justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 text-[#5a4a3f] hover:bg-[#e8e2d9]"
                aria-label="Close menu"
              >
                <X size={22} />
              </button>
            </div>

            <div
              className={`max-h-[calc(100dvh-${headerH}px)] overflow-y-auto px-0 py-2`}
            >
              {/* Section toggle (only visible when authed) */}
              {isAuthed && (
                <div className="mb-4 flex items-center gap-2 text-sm">
                  <button
                    onClick={() => setMenuSection("nav")}
                    className={`rounded-full px-3 py-1.5 ${
                      menuSection === "nav"
                        ? "bg-[#e8e2d9] text-[#5a4a3f]"
                        : "text-[#7a6a5f] hover:bg-[#f3efe8]"
                    }`}
                  >
                    Browse
                  </button>
                  <button
                    onClick={() => setMenuSection("account")}
                    className={`rounded-full px-3 py-1.5 ${
                      menuSection === "account"
                        ? "bg-[#e8e2d9] text-[#5a4a3f]"
                        : "text-[#7a6a5f] hover:bg-[#f3efe8]"
                    }`}
                  >
                    Account
                  </button>
                </div>
              )}

              {menuSection === "nav" && (
                <nav className="flex flex-col gap-2" aria-label="Mobile">
                  <p className="px-2 pb-2 text-xs uppercase tracking-wide text-[#7a6a5f]">
                    Navigate
                  </p>
                  {navLinks.map((l, idx) => {
                    const active = pathname?.startsWith(l.href);
                    const isFirst = idx === 0;
                    return (
                      <button
                        key={l.href}
                        ref={isFirst ? mobileFirstFocusRef : undefined}
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

                  {/* Mobile CTA */}
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      go("/experiences");
                    }}
                    className="mt-4 rounded-xl bg-[#8b6f47] px-4 py-3 text-base text-white hover:bg-[#7a5f3a]"
                  >
                    Book a Journey
                  </button>

                  <div className="mt-4 h-px bg-[#e7e2da]" />

                  {!isAuthed && (
                    <div className="mt-4 flex gap-2">
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
              )}

              {menuSection === "account" && isAuthed && (
                <div aria-label="Account" className="flex flex-col">
                  {/* Compact account header */}
                  <div className="mb-3 flex items-center gap-3 rounded-xl border border-[#efe7d9] bg-[#fbf7ef] p-3">
                    <div className="inline-grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e8dfcf] text-sm font-semibold text-[#5a4a3f]">
                      {avatar}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#5a4a3f]">
                        {displayName}
                      </p>
                      <p className="truncate text-xs text-[#7a6a5f]">
                        {finalProfile.email}
                      </p>
                    </div>
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-[#efe7d9] bg-white px-2 py-0.5 text-[11px] text-[#5a4a3f]">
                      <ShieldCheck size={12} /> {safeTitle(finalProfile.badge)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      ref={mobileFirstFocusRef}
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
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
