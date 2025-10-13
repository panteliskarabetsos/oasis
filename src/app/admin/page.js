"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/SessionWrapper";
import {
  Compass,
  CalendarDays,
  Users,
  Clock,
  LifeBuoy,
  ShieldCheck,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [isAdmin, setIsAdmin] = useState(null); // null = unknown
  const [booted, setBooted] = useState(false);

  // Resolve role from DB; fallback to Supabase metadata
  useEffect(() => {
    let cancel = false;
    async function resolveRole() {
      if (!user) {
        setIsAdmin(false);
        setBooted(true);
        return;
      }
      try {
        const res = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        });
        const data = res.ok ? await res.json() : null;
        const role =
          data?.role ||
          user?.app_metadata?.role ||
          user?.user_metadata?.role ||
          "user";
        if (!cancel) {
          setIsAdmin(role === "admin");
          setBooted(true);
        }
      } catch {
        const fallback =
          user?.app_metadata?.role || user?.user_metadata?.role || "user";
        if (!cancel) {
          setIsAdmin(fallback === "admin");
          setBooted(true);
        }
      }
    }
    if (!loading) resolveRole();
    return () => {
      cancel = true;
    };
  }, [user, loading]);

  // Redirect non-admins
  useEffect(() => {
    if (!loading && booted && isAdmin === false) router.replace("/");
  }, [loading, booted, isAdmin, router]);

  if (loading || !booted || isAdmin === null) return <Skeleton />; // subtle loader
  if (!isAdmin) return null; // redirecting

  const go = (p) => router.push(p);

  return (
    <div className="relative min-h-screen bg-[#f4f1ec] overflow-hidden">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute -top-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-[#e9e4dc] blur-3xl opacity-70" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[32rem] w-[32rem] rounded-full bg-[#fff4e1] blur-3xl opacity-80" />

      <div className="relative mx-auto px-6 py-8 lg:py-12 max-w-6xl xl:max-w-7xl 2xl:max-w-[88rem]">
        {/* Top bar */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-[#8b6f47] text-sm border border-[#d8cfc3] px-4 py-2 rounded-full hover:bg-[#f4f1ec] hover:text-[#5a4a3f] transition-all shadow-sm"
          >
            <ArrowLeft size={16} /> Back
          </button>

          <span className="inline-flex items-center gap-2 text-xs rounded-full px-3 py-1 border border-[#e8e2d9] bg-[#f6f4f0] text-[#5a4a3f]">
            <ShieldCheck size={14} /> Admin access
          </span>
        </div>

        {/* Hero */}
        <header className="mb-10 lg:mb-14">
          <h1 className="text-4xl md:text-5xl font-serif tracking-tight leading-tight text-[#5a4a3f]">
            <span className="opacity-70">Welcome to</span>{" "}
            <span className="bg-gradient-to-r from-[#8b6f47] to-[#a78b62] bg-clip-text text-transparent">
              Admin Dashboard
            </span>
          </h1>
          <p className="mt-3 text-[#7a6a5f] max-w-2xl">
            Manage experiences, reservations, and users—everything you need to
            keep Oasis running smoothly.
          </p>
        </header>

        {/* Primary actions */}
        <section className="grid gap-8 lg:gap-12 lg:grid-cols-[1.25fr_1fr] items-stretch mb-12">
          {/* Left: Big action grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <ActionCard
              icon={<Compass size={22} />}
              title="Manage Experiences"
              desc="Create, edit and delete curated experiences."
              onClick={() => go("/admin/experiences")}
            />
            <ActionCard
              icon={<CalendarDays size={22} />}
              title="Manage Reservations"
              desc="Review and organize client bookings."
              onClick={() => go("/admin/reservations")}
            />
            <ActionCard
              icon={<Users size={22} />}
              title="Manage Clients"
              desc="View and manage registered users."
              onClick={() => go("/admin/users")}
            />
            <ActionCard
              icon={<Clock size={22} />}
              title="Manage Schedule"
              desc="Review and organize experiences schedule."
              onClick={() => go("/admin/schedule")}
            />
          </div>

          {/* Right: Quick tips / helper */}
          <aside className="bg-white/80 backdrop-blur-lg border border-[#e0dcd4] rounded-3xl shadow-xl p-6 lg:p-8 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-serif text-[#5a4a3f] mb-2">
                Quick Tips
              </h2>
              <ul className="space-y-3 text-sm text-[#5a4a3f]">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 inline-block h-2 w-2 rounded-full bg-[#8b6f47]" />
                  Use “Manage Experiences” to keep the catalog fresh.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 inline-block h-2 w-2 rounded-full bg-[#8b6f47]" />
                  Confirm or cancel pending reservations promptly.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 inline-block h-2 w-2 rounded-full bg-[#8b6f47]" />
                  Keep client profiles up to date for faster checkouts.
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-6 border-t border-[#eee8df]">
              <button
                onClick={() => router.push("/admin/help")}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 border border-[#d8cfc3] bg-[#fdfaf5] text-[#5a4a3f] hover:bg-[#f1ede7] transition"
              >
                <LifeBuoy size={18} /> Help & Support
              </button>
            </div>
          </aside>
        </section>

        {/* Secondary: Shortcuts row */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Shortcut
            label="Manage Administrators"
            onClick={() => go("/admin/accounts")}
          />
          <Shortcut
            label="Create New Experience"
            onClick={() => go("/admin/experiences/new")}
          />
          <Shortcut
            label="Pending Reservations"
            onClick={() => go("/admin/reservations?status=pending")}
          />
          <Shortcut label="All Users" onClick={() => go("/admin/users")} />
        </section>
      </div>
    </div>
  );
}

/* ---------------------------- Components ---------------------------- */

function ActionCard({ icon, title, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-2xl bg-[#fdfaf7] border border-[#d8cfc3] p-6 lg:p-7 shadow-lg transition-all hover:shadow-2xl hover:-translate-y-0.5 hover:bg-[#8b6f47] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#8b6f47]"
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0 h-10 w-10 rounded-xl border border-[#e0dcd4] bg-white/70 backdrop-blur flex items-center justify-center group-hover:bg-white/20 group-hover:text-white">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-[#5a4a3f] group-hover:text-white">
            {title}
          </h3>
          <p className="mt-1 text-sm text-[#7a6a5f] group-hover:text-white/90">
            {desc}
          </p>
        </div>
        <ChevronRight
          className="ml-auto opacity-50 group-hover:opacity-100"
          size={18}
        />
      </div>
    </button>
  );
}

function Shortcut({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl bg-white/80 backdrop-blur border border-[#e0dcd4] px-4 py-3 text-sm text-[#5a4a3f] hover:bg-[#f1ede7] transition flex items-center justify-between"
    >
      <span>{label}</span>
      <ChevronRight size={16} className="opacity-60" />
    </button>
  );
}

function Skeleton() {
  return (
    <div className="min-h-screen bg-[#f4f1ec]">
      <div className="mx-auto px-6 py-10 max-w-6xl xl:max-w-7xl">
        <div className="h-5 w-28 bg-[#e8e2d9] rounded mb-4" />
        <div className="h-10 w-72 bg-[#e8e2d9] rounded mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 bg-[#e8e2d9] rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
