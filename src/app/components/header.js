// src/app/components/Header.js
"use client";

import { useState, useEffect, useMemo } from "react";
import { Menu, X, UserCircle, ChevronDown, LogIn, User } from "lucide-react";
import { useRouteLoader } from "./RouteLoader";
import { useAuth } from "./SessionWrapper";

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasShadow, setHasShadow] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);

  const [dbProfile, setDbProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const routeLoader = useRouteLoader();
  const { user, loading, supabase } = useAuth();

  const navLinks = [
    { name: "Experiences", href: "/experiences" },
    { name: "About", href: "/about" },
    { name: "Contact", href: "/contact" },
  ];

  // fetch profile from your /api/me (same shape as dashboard expects)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
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
      } catch (e) {
        console.error("[Header] /api/me failed", e);
        if (!cancelled) setDbProfile(null);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // build a merged profile: DB first, then auth metadata
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
      role: dbProfile?.role || user?.app_metadata?.role || md.role || "user",
    };
  }, [dbProfile, user]);

  // final display name for the button
  const displayName =
    [finalProfile.first, finalProfile.last].filter(Boolean).join(" ") ||
    user?.email?.split("@")[0] ||
    "Account";

  const role = finalProfile.role || "user";

  useEffect(() => {
    const handleScroll = () => setHasShadow(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  async function handleSignOut() {
    await supabase?.auth.signOut();
    setDropdownOpen(false);
    setAccountDropdownOpen(false);
    routeLoader?.triggerRouteChange("/");
  }

  const isAuthed = !!user;

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-shadow duration-300 print:hidden ${
        hasShadow ? "shadow-xl" : "shadow-none"
      } bg-[#f4f1ec]/90 backdrop-blur-lg border-b border-[#eae6e0]`}
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
        {/* Logo */}
        <button
          onClick={() => routeLoader?.triggerRouteChange("/")}
          className="text-3xl font-serif text-[#5a4a3f] hover:text-[#8b6f47] transition-all"
        >
          Oasis
        </button>

        {/* Desktop Nav */}
        <nav className="hidden md:flex gap-6 items-center">
          {navLinks.map((link) => (
            <button
              key={link.name}
              onClick={() => routeLoader?.triggerRouteChange(link.href)}
              className="text-lg text-[#5a4a3f] hover:bg-[#e8e2d9] hover:text-[#8b6f47] px-4 py-2 rounded-full transition-all"
            >
              {link.name}
            </button>
          ))}

          {isAuthed ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-2 text-sm text-[#5a4a3f] px-4 py-2 rounded-full border border-[#e4ddd3] bg-[#fdfaf5] hover:bg-[#f1ede7] transition"
                aria-label="Account menu"
              >
                <UserCircle size={20} />
                {/* show first name if available; fall back to full displayName */}
                {(finalProfile.first || displayName).split(" ")[0]}
                <ChevronDown size={16} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-[#eae6e0] z-10">
                  <div className="px-4 py-2 border-b border-[#eee]">
                    <p className="text-sm font-medium text-[#5a4a3f] truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-[#7a6a5f] truncate">
                      {finalProfile.email}
                    </p>
                  </div>

                  <button
                    onClick={() => routeLoader?.triggerRouteChange("/bookings")}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-[#fdfaf5] text-[#5a4a3f]"
                  >
                    My Bookings
                  </button>
                  <button
                    onClick={() =>
                      routeLoader?.triggerRouteChange("/dashboard")
                    }
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-[#fdfaf5] text-[#5a4a3f]"
                  >
                    Dashboard
                  </button>

                  {role === "admin" && (
                    <nav>
                      <a
                        className="block w-full text-left px-4 py-2 text-sm hover:bg-[#fdfaf5] text-[#5a4a3f]"
                        href="/admin"
                      >
                        Admin Dashboard
                      </a>
                    </nav>
                  )}

                  <button
                    onClick={handleSignOut}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-[#fdfaf5] text-[#b44d4d]"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button
                onClick={() => routeLoader?.triggerRouteChange("/login")}
                className="flex items-center gap-2 text-sm text-[#8b6f47] hover:text-[#5a4a3f] py-1.5 px-3 transition-all font-medium hover:bg-[#e8e2d9] rounded-full"
              >
                <LogIn size={16} />
                Log In
              </button>

              <button
                onClick={() => routeLoader?.triggerRouteChange("/sign-up")}
                className="flex items-center gap-2 text-sm text-[#8b6f47] hover:text-[#5a4a3f] py-1.5 px-3 transition-all font-medium hover:bg-[#e8e2d9] rounded-full"
              >
                <User size={16} />
                Register
              </button>
            </>
          )}
        </nav>

        {/* Mobile: Account + Hamburger */}
        <div className="md:hidden flex items-center gap-4 print:hidden">
          {isAuthed && (
            <button
              onClick={() => setAccountDropdownOpen((v) => !v)}
              className="flex items-center gap-2 text-sm text-[#5a4a3f] hover:text-[#8b6f47] px-4 py-2 rounded-full border border-[#e4ddd3] bg-[#fdfaf5] hover:bg-[#f1ede7] transition"
              aria-label="Account"
            >
              <UserCircle size={20} />
            </button>
          )}

          <button
            className="text-[#5a4a3f]"
            onClick={() => setIsOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {isOpen && (
        <div className="md:hidden bg-[#f4f1ec] border-t border-[#e2ded8] px-6 py-6 animate-fade-in shadow-xl transition-all">
          <nav className="flex flex-col gap-6 items-center">
            {navLinks.map((link) => (
              <button
                key={link.name}
                onClick={() => {
                  routeLoader?.triggerRouteChange(link.href);
                  setIsOpen(false);
                }}
                className="text-[#5a4a3f] text-lg hover:bg-[#e8e2d9] px-4 py-2 rounded-full transition-all"
              >
                {link.name}
              </button>
            ))}

            {!isAuthed && (
              <>
                <button
                  onClick={() => {
                    routeLoader?.triggerRouteChange("/login");
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-2 text-sm text-[#8b6f47] hover:text-[#5a4a3f] py-1.5 px-3 transition-all font-medium hover:bg-[#e8e2d9] rounded-full"
                >
                  <LogIn size={16} /> Log In
                </button>

                <button
                  onClick={() => {
                    routeLoader?.triggerRouteChange("/sign-up");
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-2 text-sm text-[#8b6f47] hover:text-[#5a4a3f] py-1.5 px-3 transition-all font-medium hover:bg-[#e8e2d9] rounded-full"
                >
                  <User size={16} /> Register
                </button>
              </>
            )}
          </nav>
        </div>
      )}

      {/* Mobile Account Dropdown */}
      {accountDropdownOpen && isAuthed && (
        <div className="md:hidden absolute top-20 right-4 w-48 bg-white rounded-xl shadow-lg border border-[#eae6e0] z-10">
          <button
            onClick={() => routeLoader?.triggerRouteChange("/bookings")}
            className="block w-full text-left px-4 py-2 text-sm hover:bg-[#fdfaf5] text-[#5a4a3f]"
          >
            My Bookings
          </button>
          <button
            onClick={() => routeLoader?.triggerRouteChange("/dashboard")}
            className="block w-full text-left px-4 py-2 text-sm hover:bg-[#fdfaf5] text-[#5a4a3f]"
          >
            Dashboard
          </button>
          {role === "admin" && (
            <nav>
              <a
                className="block w-full text-left px-4 py-2 text-sm hover:bg-[#fdfaf5] text-[#5a4a3f]"
                href="/admin"
              >
                Admin Dashboard
              </a>
            </nav>
          )}
          <button
            onClick={handleSignOut}
            className="block w-full text-left px-4 py-2 text-sm hover:bg-[#fdfaf5] text-[#b44d4d]"
          >
            Sign Out
          </button>
        </div>
      )}
    </header>
  );
}

/* helpers */
function safeTitle(str = "") {
  return String(str)
    .toLowerCase()
    .replace(/(^.|[\s-].)/g, (m) => m.toUpperCase())
    .trim();
}
