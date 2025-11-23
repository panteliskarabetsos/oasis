// /admin/components/mobile-menu.js
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Compass,
  CalendarDays,
  Users,
  Clock,
  Plus,
  ChevronRight,
} from "lucide-react";

export default function AdminMobileMenu({
  displayName = "Admin",
  signOutAction,
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);
  const firstFocusRef = useRef(null);
  const pathname = usePathname() || "";

  const navItems = useMemo(
    () => [
      { href: "/admin/experiences", label: "Experiences", Icon: Compass },
      { href: "/admin/bookings", label: "Bookings", Icon: CalendarDays }, // fixed path
      { href: "/admin/users", label: "Users", Icon: Users },
      { href: "/admin/schedule", label: "Schedule", Icon: Clock },
    ],
    []
  );

  const close = useCallback(() => setOpen(false), []);
  const openMenu = useCallback(() => setOpen(true), []);

  // Close menu when navigating
  useEffect(() => {
    if (!open) return;
    close();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus first actionable element on open
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => firstFocusRef.current?.focus?.());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // ESC to close (only while open)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Lock body scroll while open
  useEffect(() => {
    const { body } = document;
    const prev = body.style.overflow;
    if (open) body.style.overflow = "hidden";
    return () => {
      body.style.overflow = prev || "";
    };
  }, [open]);

  // Focus trap inside dialog
  useEffect(() => {
    if (!open) return;
    const root = dialogRef.current;
    if (!root) return;

    const selector =
      'a[href], area[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const keyHandler = (e) => {
      if (e.key !== "Tab") return;
      const focusables = Array.from(root.querySelectorAll(selector)).filter(
        (el) => el.offsetParent !== null || root.contains(el) // visible-ish
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    root.addEventListener("keydown", keyHandler);
    return () => root.removeEventListener("keydown", keyHandler);
  }, [open]);

  const dialogId = "admin-mobile-menu";
  const titleId = "admin-mobile-menu-title";

  return (
    <>
      {/* Toggle button (mobile only) */}
      <button
        onClick={openMenu}
        className="md:hidden inline-flex items-center justify-center rounded-full p-2 text-[#5a4a3f] hover:bg-[#efeae3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/50 dark:text-neutral-100 dark:hover:bg-neutral-800"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls={dialogId}
      >
        <Menu size={22} />
      </button>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[70] bg-black/30 transition-opacity md:hidden ${
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        } dark:bg-black/60`}
        onClick={close}
        aria-hidden={!open}
      />

      {/* Top sheet dialog */}
      <div
        id={dialogId}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`fixed inset-x-0 top-0 z-[80] md:hidden origin-top transform-gpu bg-[#fdfaf7] border-b border-[#e0dcd4] shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none ${
          open ? "translate-y-0" : "-translate-y-full"
        } dark:bg-neutral-900 dark:border-white/10`}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="px-4 sm:px-6 py-3 max-h-[90svh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 id={titleId} className="sr-only">
              Admin menu
            </h2>
            <p className="text-sm text-[#7a6a5f] dark:text-neutral-300">
              Signed in as{" "}
              <span className="font-medium text-[#5a4a3f] dark:text-neutral-100">
                {displayName}
              </span>
            </p>
            <button
              onClick={close}
              className="rounded-full p-2 text-[#5a4a3f] hover:bg-[#efeae3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/50 dark:text-neutral-100 dark:hover:bg-neutral-800"
              aria-label="Close menu"
            >
              <X size={22} />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {/* Create CTA */}
            <Link
              href="/admin/experiences/new"
              prefetch
              className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#8b6f47] px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#7a5f3a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/60 transition motion-reduce:transition-none dark:bg-amber-600 dark:hover:bg-amber-700"
              onClick={close}
              ref={firstFocusRef}
            >
              <Plus size={16} aria-hidden />
              Create
            </Link>

            {navItems.map(({ href, label, Icon }) => {
              const active =
                pathname === href || (pathname && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  prefetch
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  data-active={active ? "" : undefined}
                  className={[
                    "flex items-center justify-between rounded-xl border px-3 py-3 text-sm text-[#5a4a3f] shadow-sm transition motion-reduce:transition-none",
                    "bg-white border-[#e0dcd4] hover:bg-[#f7f4ef]",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/50",
                    "data-[active]:bg-[#efeae3] data-[active]:border-[#cdbfae] data-[active]:shadow",
                    "dark:bg-neutral-900 dark:border-white/10 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:data-[active]:bg-neutral-800 dark:data-[active]:border-white/20",
                  ].join(" ")}
                  onClick={close}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon size={16} className="opacity-70" aria-hidden />
                    {label}
                  </span>
                  <ChevronRight size={16} aria-hidden />
                </Link>
              );
            })}
          </div>

          <div className="my-4 h-px bg-gradient-to-r from-transparent via-[#e9e4dc] to-transparent dark:via-white/10" />

          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/"
              prefetch
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e0dcd4] bg-white px-3 py-2 text-sm text-[#5a4a3f] shadow-sm hover:bg-[#f7f4ef] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/50 transition motion-reduce:transition-none dark:bg-neutral-900 dark:text-neutral-100 dark:border-white/10 dark:hover:bg-neutral-800"
              onClick={close}
            >
              Back to site
            </Link>

            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#f1d6d6] bg-white px-3 py-2 text-sm text-[#8b3f3f] shadow-sm hover:bg-[#fff4ef] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/50 transition motion-reduce:transition-none dark:bg-neutral-900 dark:text-red-300 dark:border-red-900/30 dark:hover:bg-red-950/20"
              >
                Sign out
              </button>
            </form>
          </div>

          <div className="h-2" />
        </div>
      </div>
    </>
  );
}
