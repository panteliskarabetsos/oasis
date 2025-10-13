"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
  const firstFocusRef = useRef(null);

  // focus first action on open
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => firstFocusRef.current?.focus?.());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // ESC to close
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // lock body scroll
  useEffect(() => {
    const { body } = document;
    const prev = body.style.overflow;
    if (open) body.style.overflow = "hidden";
    return () => {
      body.style.overflow = prev || "";
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      {/* Toggle button (shows only on mobile) */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden inline-flex items-center justify-center rounded-full p-2 text-[#5a4a3f] hover:bg-[#efeae3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/50"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="admin-mobile-menu"
      >
        <Menu size={22} />
      </button>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[70] bg-black/30 transition-opacity md:hidden ${
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={close}
        aria-hidden={!open}
      />

      {/* Top sheet */}
      <div
        id="admin-mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Admin menu"
        className={`fixed inset-x-0 top-0 z-[80] md:hidden origin-top transform-gpu bg-[#fdfaf7] border-b border-[#e0dcd4] shadow-2xl transition-transform duration-200 ease-out ${
          open ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#7a6a5f]">
              Signed in as{" "}
              <span className="font-medium text-[#5a4a3f]">{displayName}</span>
            </p>
            <button
              onClick={close}
              className="rounded-full p-2 text-[#5a4a3f] hover:bg-[#efeae3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/50"
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
              className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#8b6f47] px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#7a5f3a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/60 transition"
              onClick={close}
              ref={firstFocusRef}
            >
              <Plus size={16} aria-hidden />
              Create
            </Link>

            {[
              {
                href: "/admin/experiences",
                label: "Experiences",
                Icon: Compass,
              },
              {
                href: "/admin/reservations",
                label: "Reservations",
                Icon: CalendarDays,
              },
              { href: "/admin/users", label: "Users", Icon: Users },
              { href: "/admin/schedule", label: "Schedule", Icon: Clock },
            ].map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                prefetch
                className="flex items-center justify-between rounded-xl border border-[#e0dcd4] bg-white px-3 py-3 text-sm text-[#5a4a3f] shadow-sm hover:bg-[#f7f4ef] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/50"
                onClick={close}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon size={16} className="opacity-70" aria-hidden />
                  {label}
                </span>
                <ChevronRight size={16} aria-hidden />
              </Link>
            ))}
          </div>

          <div className="my-4 h-px bg-gradient-to-r from-transparent via-[#e9e4dc] to-transparent" />

          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/"
              prefetch
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e0dcd4] bg-white px-3 py-2 text-sm text-[#5a4a3f] shadow-sm hover:bg-[#f7f4ef] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/50"
              onClick={close}
            >
              Back to site
            </Link>

            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#f1d6d6] bg-white px-3 py-2 text-sm text-[#8b3f3f] shadow-sm hover:bg-[#fff4ef] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/50"
                onClick={close}
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
