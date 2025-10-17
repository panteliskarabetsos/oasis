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
  Settings,
  FileBarChart2,
  Tag,
  CreditCard,
  ReceiptText,
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

          <div className="flex items-center gap-2">
            {/* Smaller Help button + room for more buttons */}
            <button
              onClick={() => router.push("/admin/help")}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border border-[#d8cfc3] bg-[#fdfaf5] text-[#5a4a3f] hover:bg-[#f1ede7] transition text-xs"
              title="Help & Support"
            >
              <LifeBuoy size={14} /> Help
            </button>
            {/* Extra top-right buttons (add your routes as needed) */}
            <button
              onClick={() => go("/admin/settings")}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border border-[#d8cfc3] bg-white/70 text-[#5a4a3f] hover:bg-[#f1ede7] transition text-xs"
              title="Settings"
            >
              <Settings size={14} /> Settings
            </button>
            <button
              onClick={() => go("/admin/reports")}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border border-[#d8cfc3] bg-white/70 text-[#5a4a3f] hover:bg-[#f1ede7] transition text-xs"
              title="Reports & Analytics"
            >
              <FileBarChart2 size={14} /> Reports
            </button>
            <span className="inline-flex items-center gap-1.5 text-xs rounded-full px-3 py-1 border border-[#e8e2d9] bg-[#f6f4f0] text-[#5a4a3f]">
              <ShieldCheck size={14} /> Admin
            </span>
          </div>
        </div>

        {/* Header */}
        <header className="mb-6 lg:mb-8">
          <h1 className="text-3xl md:text-4xl font-serif tracking-tight leading-tight text-[#5a4a3f]">
            Admin Dashboard
          </h1>
          <p className="mt-2 text-[#7a6a5f] max-w-2xl text-sm md:text-base">
            Manage experiences, reservations, users and more.
          </p>
        </header>

        {/* Toolbar: compact quick actions row */}
        <section className="mb-8 flex flex-wrap items-center gap-2">
          <ToolbarButton
            label="Experiences"
            icon={<Compass size={16} />}
            onClick={() => go("/admin/experiences")}
          />
          <ToolbarButton
            label="Bookings"
            icon={<CalendarDays size={16} />}
            onClick={() => go("/admin/bookings")}
          />
          <ToolbarButton
            label="Clients"
            icon={<Users size={16} />}
            onClick={() => go("/admin/users")}
          />
          <ToolbarButton
            label="Schedule"
            icon={<Clock size={16} />}
            onClick={() => go("/admin/schedule")}
          />
          <ToolbarButton
            label="Payments"
            icon={<CreditCard size={16} />}
            onClick={() => go("/admin/payments")}
          />
          <ToolbarButton
            label="Invoices"
            icon={<ReceiptText size={16} />}
            onClick={() => go("/admin/invoices")}
          />
          <ToolbarButton
            label="Promos"
            icon={<Tag size={16} />}
            onClick={() => go("/admin/promotions")}
          />
        </section>

        {/* Action tiles grid – compact to fit more */}
        <section className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <ActionTile
            icon={<Compass size={20} />}
            title="Manage Experiences"
            desc="Create, edit and publish experiences."
            onClick={() => go("/admin/experiences")}
          />
          <ActionTile
            icon={<CalendarDays size={20} />}
            title="Manage Bookings"
            desc="Review, confirm or cancel reservations."
            onClick={() => go("/admin/bookings")}
          />
          <ActionTile
            icon={<Users size={20} />}
            title="Manage Clients"
            desc="View, edit and segment users."
            onClick={() => go("/admin/users")}
          />
          <ActionTile
            icon={<Clock size={20} />}
            title="Manage Schedule"
            desc="Availability and slots."
            onClick={() => go("/admin/schedule")}
          />
          <ActionTile
            icon={<CreditCard size={20} />}
            title="Payments"
            desc="Capture, refunds, reconciliation."
            onClick={() => go("/admin/payments")}
          />
          <ActionTile
            icon={<ReceiptText size={20} />}
            title="Invoices"
            desc="Download and send invoices."
            onClick={() => go("/admin/invoices")}
          />
          <ActionTile
            icon={<Tag size={20} />}
            title="Promotions"
            desc="Discount codes and campaigns."
            onClick={() => go("/admin/promotions")}
          />
          <ActionTile
            icon={<Settings size={20} />}
            title="Settings"
            desc="Brand, email, access control."
            onClick={() => go("/admin/settings")}
          />
        </section>

        {/* Secondary shortcuts */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Shortcut
            label="Manage Administrators"
            onClick={() => go("/admin/accounts")}
          />
          <Shortcut
            label="Create New Experience"
            onClick={() => go("/admin/experiences/new")}
          />
          <Shortcut
            label="Reports & Analytics"
            onClick={() => go("/admin/reports")}
          />
          <Shortcut label="All Users" onClick={() => go("/admin/users")} />
        </section>

        {/* Tips card moved under, stays compact; Help already on top-right */}
        <aside className="mt-8 bg-white/80 backdrop-blur-lg border border-[#e0dcd4] rounded-2xl shadow-xl p-5">
          <h2 className="text-base font-semibold text-[#5a4a3f] mb-2">
            Quick Tips
          </h2>
          <ul className="space-y-2 text-sm text-[#5a4a3f]">
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-block h-2 w-2 rounded-full bg-[#8b6f47]" />
              Keep the experiences catalog fresh.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-block h-2 w-2 rounded-full bg-[#8b6f47]" />
              Confirm or cancel pending reservations promptly.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-block h-2 w-2 rounded-full bg-[#8b6f47]" />
              Keep client profiles up to date for faster checkouts.
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}

/* ---------------------------- Components ---------------------------- */

function ActionTile({ icon, title, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-xl bg-[#fdfaf7] border border-[#d8cfc3] p-5 shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 hover:bg-[#8b6f47] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#8b6f47]"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 h-9 w-9 rounded-lg border border-[#e0dcd4] bg-white/70 backdrop-blur flex items-center justify-center group-hover:bg-white/20 group-hover:text-white">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-[#5a4a3f] group-hover:text-white">
            {title}
          </h3>
          <p className="mt-0.5 text-xs text-[#7a6a5f] group-hover:text-white/90">
            {desc}
          </p>
        </div>
        <ChevronRight
          className="ml-auto opacity-50 group-hover:opacity-100"
          size={16}
        />
      </div>
    </button>
  );
}

function ToolbarButton({ label, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-[#d8cfc3] bg-white/70 px-3 py-1.5 text-xs text-[#5a4a3f] hover:bg-[#f1ede7] transition"
    >
      {icon}
      <span className="font-medium">{label}</span>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 bg-[#e8e2d9] rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
