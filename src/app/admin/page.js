"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/SessionWrapper";
import {
  Compass,
  CalendarDays,
  Users,
  Clock,
  LifeBuoy,
  ShieldCheck,
  Settings,
  FileBarChart2,
  Tag,
  CreditCard,
  ReceiptText,
  ChevronRight,
  Search,
  Plus,
  ArrowUpRight,
  Gift,
  Zap,
  Star,
  MessageSquare,
  QrCode,
  Store,
  AlertTriangle,
  CloudSun,
  Link as LinkIcon,
  Building2,
  PackagePlus,
  Boxes,
  Puzzle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";

// Admin Dashboard – refreshed UI/UX + business features
export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Core state
  const [isAdmin, setIsAdmin] = useState(null); // null | boolean
  const [booted, setBooted] = useState(false);

  // Dashboard state
  const [metrics, setMetrics] = useState(null);
  const [activity, setActivity] = useState([]);

  // Helpers & UI state — declared BEFORE early returns
  const go = (p) => router.push(p);
  const [query, setQuery] = useState("");

  /* ---------------------- Actions (tiles + search) ---------------------- */
  const actions = useMemo(
    () => [
      // core
      {
        key: "experiences",
        icon: <Compass size={20} />,
        title: "Manage Experiences",
        desc: "Create, edit and publish experiences.",
        onClick: () => go("/admin/experiences"),
        keywords: ["experience", "catalog", "products"],
      },
      {
        key: "bookings",
        icon: <CalendarDays size={20} />,
        title: "Manage Bookings",
        desc: "Review, confirm or cancel reservations.",
        onClick: () => go("/admin/bookings"),
        keywords: ["booking", "reservation", "calendar"],
      },
      {
        key: "clients",
        icon: <Users size={20} />,
        title: "Guests & CRM",
        desc: "View, edit and segment users.",
        onClick: () => go("/admin/users"),
        keywords: ["client", "user", "customer"],
      },
      {
        key: "schedule",
        icon: <Clock size={20} />,
        title: "Manage Schedule",
        desc: "Availability and slots.",
        onClick: () => go("/admin/schedule"),
        keywords: ["schedule", "slots", "availability", "calendar"],
      },
      // money ops
      {
        key: "payments",
        icon: <CreditCard size={20} />,
        title: "Payments",
        desc: "Capture, refunds, reconciliation.",
        onClick: () => go("/admin/payments"),
        keywords: ["payment", "refund", "billing", "stripe"],
      },
      {
        key: "invoices",
        icon: <ReceiptText size={20} />,
        title: "Invoices",
        desc: "Download and send invoices.",
        onClick: () => go("/admin/invoices"),
        keywords: ["invoice", "billing", "pdf", "tax"],
      },
      {
        key: "promotions",
        icon: <Tag size={20} />,
        title: "Promotions",
        desc: "Discount codes and campaigns.",
        onClick: () => go("/admin/promotions"),
        keywords: ["promo", "discount", "coupon", "campaign"],
      },
      // NEW: revenue growth
      {
        key: "addons",
        icon: <PackagePlus size={20} />,
        title: "Add-ons",
        desc: "Sell extras & upgrades.",
        onClick: () => go("/admin/addons"),
        keywords: ["add-on", "extras", "upsell", "bundle"],
      },
      {
        key: "pos",
        icon: <Store size={20} />,
        title: "Point of Sale",
        desc: "Sell walk-ins & extras in person.",
        onClick: () => go("/admin/pos"),
        keywords: ["pos", "walk-in", "terminal", "in-person", "upsell"],
      },
      {
        key: "vouchers",
        icon: <Gift size={20} />,
        title: "Gift Cards",
        desc: "Issue & redeem gift cards.",
        onClick: () => go("/admin/giftcards"),
        keywords: ["voucher", "gift", "credit", "prepaid"],
      },
      {
        key: "bundles",
        icon: <Boxes size={20} />,
        title: "Bundles",
        desc: "Multi-visit & packages.",
        onClick: () => go("/admin/bundles"),
        keywords: ["bundle", "package", "multi", "value"],
      },
      // NEW: conversion & retention
      {
        key: "waitlist",
        icon: <Users size={20} />,
        title: "Waitlist",
        desc: "Capture demand & auto-fill cancellations.",
        onClick: () => go("/admin/waitlist"),
        keywords: ["waitlist", "demand", "notify", "fill"],
      },
      {
        key: "loyalty",
        icon: <Star size={20} />,
        title: "Loyalty",
        desc: "Credits & tiers for repeat guests.",
        onClick: () => go("/admin/loyalty"),
        keywords: ["loyalty", "credit", "tier", "points", "retention"],
      },
      {
        key: "checkins",
        icon: <QrCode size={20} />,
        title: "Check-ins",
        desc: "QR/Roster check-ins & no-shows.",
        onClick: () => go("/admin/checkins"),
        keywords: ["checkin", "qr", "roster", "attendance", "no-show"],
      },
      // NEW: operations & integrations
      {
        key: "waivers",
        icon: <ShieldCheck size={20} />,
        title: "Waivers",
        desc: "Collect and verify waivers.",
        onClick: () => go("/admin/waivers"),
        keywords: ["waiver", "consent", "safety"],
      },
      {
        key: "corporate",
        icon: <Building2 size={20} />,
        title: "Corporate",
        desc: "Invoices, POs & bulk bookings.",
        onClick: () => go("/admin/corporate"),
        keywords: ["company", "po", "vat", "b2b"],
      },
      {
        key: "integrations",
        icon: <LinkIcon size={20} />,
        title: "Integrations",
        desc: "Webhooks, exports & OTAs.",
        onClick: () => go("/admin/integrations"),
        keywords: ["webhook", "zapier", "ota", "export"],
      },
      {
        key: "partners",
        icon: <Building2 size={20} />,
        title: "Partners & Agencies",
        desc: "B2B bookings, POs & commissions.",
        onClick: () => go("/admin/partners"),
        keywords: ["partner", "agency", "b2b", "commission", "po"],
      },
      {
        key: "settings",
        icon: <Settings size={20} />,
        title: "Settings",
        desc: "Brand, email, access control.",
        onClick: () => go("/admin/settings"),
        keywords: ["setting", "brand", "email", "access"],
      },
    ],
    []
  );

  const filtered = actions.filter((a) => {
    const hay = (
      a.title +
      " " +
      a.desc +
      " " +
      a.keywords.join(" ")
    ).toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  /* -------------------------- Keyboard shortcuts ------------------------- */
  const seqRef = useRef("");
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "/") {
        const input = document.getElementById("dashboard-search");
        if (input) {
          e.preventDefault();
          input.focus();
        }
        return;
      }
      if (e.key && e.key.length === 1) {
        seqRef.current = (seqRef.current + e.key).slice(-2);
        const s = seqRef.current.toLowerCase();
        if (s === "gb") go("/admin/bookings");
        if (s === "gu") go("/admin/users");
        if (s === "ge") go("/admin/experiences");
        if (s === "gs") go("/admin/schedule");
        if (s === "gw") go("/admin/waitlist");
        if (s === "ga") go("/admin/pos"); // Point of Sale
        if (s === "gv") go("/admin/giftcards"); // fix path
        if (s === "gc") go("/admin/checkins"); // Check-ins
        if (s === "ga") go("/admin/addons");
        if (s === "gv") go("/admin/vouchers");
        if (s === "gl") go("/admin/loyalty");
        if (s === "gz") go("/admin/yield");
        if (s === "gr") go("/admin/reports");
        if (s === "gi") go("/admin/integrations");
        if (s === "gz") go("/admin/automations");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /* ---------------------------- Resolve role ---------------------------- */
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
          (data && data.role) ||
          (user && user.app_metadata && user.app_metadata.role) ||
          (user && user.user_metadata && user.user_metadata.role) ||
          "user";
        if (!cancel) {
          setIsAdmin(role === "admin");
          setBooted(true);
        }
      } catch (e) {
        const fallback =
          (user && user.app_metadata && user.app_metadata.role) ||
          (user && user.user_metadata && user.user_metadata.role) ||
          "user";
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

  // Which dashboard features are disabled right now
  const DISABLED_KEYS = new Set([
    "loyalty",
    "addons",
    "waitlist",
    "bundles",
    "integrations",
    "automations",
    "waivers",
    "resources",
    "reviews",
    "partners",
    "checkins",
    "pos",
  ]);
  const DISABLED_HINT = {
    loyalty: "Coming soon",
    // addons: "Rollout next week",
    // vouchers: "Waiting for finance setup",
  };
  const isDisabled = (k) => DISABLED_KEYS.has(k);
  const hintFor = (k) => DISABLED_HINT[k] || "";

  /* --------------------- Fetch metrics & recent activity --------------------- */
  useEffect(() => {
    if (!booted || isAdmin !== true) return;
    (async function () {
      try {
        const mRes = await fetch("/api/admin/metrics", { cache: "no-store" });
        const aRes = await fetch("/api/admin/activity?limit=6", {
          cache: "no-store",
        });

        if (mRes.ok) {
          const m = await mRes.json();
          setMetrics({
            todayBookings: m?.todayBookings ?? 0,
            pendingApprovals: m?.pendingApprovals ?? 0,
            revenueToday: m?.revenueToday ?? 0,
            openSlots: m?.openSlots ?? 0,
            // NEW secondary KPIs (optional from API)
            occupancyTodayPct: m?.occupancyTodayPct ?? 0,
            noShow7dPct: m?.noShow7dPct ?? 0,
            draftRecovery7dPct: m?.draftRecovery7dPct ?? 0,
            trend: m?.trend ?? [
              { name: "Mon", value: 8 },
              { name: "Tue", value: 10 },
              { name: "Wed", value: 6 },
              { name: "Thu", value: 12 },
              { name: "Fri", value: 9 },
              { name: "Sat", value: 14 },
              { name: "Sun", value: 7 },
            ],
          });
        } else {
          setMetrics({
            todayBookings: 0,
            pendingApprovals: 0,
            revenueToday: 0,
            openSlots: 0,
            occupancyTodayPct: 0,
            noShow7dPct: 0,
            draftRecovery7dPct: 0,
            trend: [
              { name: "Mon", value: 8 },
              { name: "Tue", value: 10 },
              { name: "Wed", value: 6 },
              { name: "Thu", value: 12 },
              { name: "Fri", value: 9 },
              { name: "Sat", value: 14 },
              { name: "Sun", value: 7 },
            ],
          });
        }

        if (aRes.ok) {
          const a = await aRes.json();
          setActivity(Array.isArray(a) ? a : placeholderActivity());
        }
      } catch (e) {
        // silence – UI shows placeholders
      }
    })();
  }, [booted, isAdmin]);

  // Redirect non-admins
  useEffect(() => {
    if (!loading && booted && isAdmin === false) router.replace("/");
  }, [loading, booted, isAdmin, router]);

  // Early returns AFTER all hooks declared
  if (loading || !booted || isAdmin === null) {
    return <Skeleton />;
  }
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="relative min-h-screen bg-[#f4f1ec] text-[#5a4a3f] overflow-hidden">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute -top-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-[#e9e4dc] blur-3xl opacity-70" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[32rem] w-[32rem] rounded-full bg-[#fff4e1] blur-3xl opacity-80" />

      <div className="relative mx-auto px-6 pt-2 lg:pt-2 pb-10 max-w-6xl xl:max-w-7xl 2xl:max-w-[88rem]">
        {/* Sticky Header */}
        <div className="sticky top-[env(safe-area-inset-top)] z-20 -mx-6 mb-4 bg-gradient-to-b from-[#f4f1ec]/90 to-[#f4f1ec]/40 backdrop-blur border-b border-[#e8e2d9] px-6 py-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-serif tracking-tight leading-tight text-[#5a4a3f]">
                Admin Dashboard
              </h1>
              <p className="mt-1 text-sm text-[#7a6a5f]">
                Manage experiences, bookings, clients & growth programs.
              </p>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/admin/help")}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border border-[#d8cfc3] bg-[#fdfaf5] text-[#5a4a3f] hover:bg-[#f1ede7] transition text-xs"
                title="Help & Support"
              >
                <LifeBuoy size={14} /> Help
              </button>
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
        </div>

        {/* Top toolbar: quick search + primary CTAs */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search
              className="absolute left-3 top-2.5 h-4 w-4 text-[#7a6a5f]"
              aria-hidden
            />
            <input
              id="dashboard-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Quick search… (press / )"
              className="w-full rounded-full border border-[#d8cfc3] bg-white/80 backdrop-blur px-9 py-2 text-sm placeholder:text-[#a09084] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
              aria-label="Quick search actions"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => go("/admin/experiences/new")}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 border border-[#d8cfc3] bg-[#8b6f47] text-white hover:brightness-110 transition text-sm shadow-sm"
            >
              <Plus size={16} /> New Experience
            </button>
            <button
              onClick={() => go("/admin/bookings/new")}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 border border-[#d8cfc3] bg-white/70 text-[#5a4a3f] hover:bg-[#f1ede7] transition text-sm"
            >
              <CalendarDays size={16} /> New Booking
            </button>
          </div>
        </div>

        {/* PRIMARY KPI row */}
        <section className="mb-6 hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Today's bookings"
            value={
              (metrics && metrics.todayBookings) != null
                ? metrics.todayBookings
                : 0
            }
            trend={metrics && metrics.trend}
          />
          <StatCard
            label="Occupancy today"
            value={formatPercent(metrics?.occupancyTodayPct ?? 0)}
          />

          <StatCard
            label="Revenue today"
            value={formatCurrency(
              (metrics && metrics.revenueToday) != null
                ? metrics.revenueToday
                : 0
            )}
            tone="green"
          />
          <StatCard
            label="Open slots"
            value={
              (metrics && metrics.openSlots) != null ? metrics.openSlots : 0
            }
            tone="blue"
          />
        </section>

        {/* SECONDARY KPI row (new business insights) */}

        {/* Quick Actions toolbar (compact chips) */}
        <section className="mb-6 flex flex-wrap items-center gap-2">
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
            label="Add-ons"
            icon={<PackagePlus size={16} />}
            onClick={() => go("/admin/addons")}
            disabled={isDisabled("loyalty")}
            title={hintFor("loyalty")}
            disabledHint="Coming soon"
          />
          <ToolbarButton
            label="Gift Cards"
            icon={<Gift size={16} />}
            onClick={() => go("/admin/giftcards")}
          />
        </section>

        {/* Action tiles grid */}
        <section className="mb-10">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence>
              {filtered.map((a, idx) => (
                <motion.div
                  key={a.key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, delay: idx * 0.03 }}
                >
                  <ActionTile
                    icon={a.icon}
                    title={a.title}
                    desc={a.desc}
                    onClick={a.onClick}
                    disabled={isDisabled(a.key)}
                    disabledHint={hintFor(a.key)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {filtered.length === 0 ? (
            <p className="mt-6 text-sm text-[#7a6a5f]">
              No actions match your search.
            </p>
          ) : null}
        </section>

        {/* Two-column: Activity + Tips */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl bg-white/80 backdrop-blur border border-[#e0dcd4] shadow-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text/base font-semibold">Recent activity</h2>
              <button
                onClick={() => go("/admin/reports")}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 border border-[#d8cfc3] bg-white/70 text-xs hover:bg-[#f1ede7]"
              >
                View reports <ArrowUpRight size={14} />
              </button>
            </div>
            <ul className="divide-y divide-[#eee5da]">
              {(activity && activity.length
                ? activity
                : placeholderActivity()
              ).map((item) => (
                <li
                  key={item.id}
                  className="py-2.5 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm truncate">{item.label}</p>
                    {item.meta ? (
                      <p className="text-xs text-[#7a6a5f] truncate">
                        {item.meta}
                      </p>
                    ) : null}
                  </div>
                  <time className="text-xs text-[#7a6a5f]">
                    {formatShortTime(item.at)}
                  </time>
                </li>
              ))}
            </ul>
          </div>

          <aside className="rounded-2xl bg-white/80 backdrop-blur border border-[#e0dcd4] shadow-xl p-5">
            <h2 className="text-base font-semibold mb-2">Quick Tips</h2>
            <ul className="space-y-2 text-sm">
              <Tip>Enable the Waitlist to auto-fill cancellations.</Tip>
              <Tip>Add Add-ons (extras) to lift ARPU immediately.</Tip>
              <Tip>Send abandoned draft reminders to recover bookings.</Tip>
              <Tip>Use Automations to discount low-occupancy slots.</Tip>
              <Tip>Collect reviews post-visit for social proof.</Tip>
              <Tip>Press / to search, g + letter shortcuts (e.g., g b).</Tip>
            </ul>
          </aside>
        </section>

        {/* Footer breathing space */}
        <div className="h-10" />
      </div>
    </div>
  );
}

/* ---------------------------- Components ---------------------------- */

function ActionTile({
  icon,
  title,
  desc,
  onClick,
  disabled = false,
  disabledHint,
}) {
  function handleClick(e) {
    if (disabled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick?.(e);
  }

  const tile = (
    <button
      onClick={handleClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={
        "group text-left rounded-2xl bg-gradient-to-b from-white/90 to-[#fdfaf7] border border-[#e6dfd6] p-5 shadow-sm transition-all focus:outline-none " +
        (disabled
          ? "opacity-60 cursor-not-allowed"
          : "hover:shadow-md hover:-translate-y-0.5 focus:ring-2 focus:ring-offset-2 focus:ring-[#8b6f47]/40")
      }
    >
      <div className="flex items-start gap-3">
        <div
          className={
            "shrink-0 h-10 w-10 rounded-xl border border-[#e0dcd4] bg-white/70 backdrop-blur flex items-center justify-center transition " +
            (disabled ? "" : "group-hover:bg-[#8b6f47] group-hover:text-white")
          }
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-[#5a4a3f]">{title}</h3>
          <p className="mt-1 text-xs text-[#7a6a5f]">{desc}</p>
        </div>
        <ChevronRight className="ml-auto opacity-60" size={16} />
      </div>
    </button>
  );

  return disabled && disabledHint ? (
    <span className="inline-block" title={disabledHint}>
      {tile}
    </span>
  ) : (
    tile
  );
}

function ToolbarButton({ label, icon, onClick, disabled = false, title }) {
  function handleClick(e) {
    if (disabled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick?.(e);
  }

  const btn = (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={
        "inline-flex items-center gap-1.5 rounded-full border border-[#d8cfc3] bg-white/70 px-3 py-1.5 text-xs text-[#5a4a3f] transition focus:outline-none " +
        (disabled
          ? "opacity-50 cursor-not-allowed pointer-events-none"
          : "hover:bg-[#f1ede7] focus:ring-2 focus:ring-[#8b6f47]/40")
      }
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );

  // Disabled <button> may not show tooltips; wrap to keep a title/hint.
  return disabled && title ? (
    <span className="inline-block" title={title}>
      {btn}
    </span>
  ) : (
    btn
  );
}

function StatCard({ label, value, tone, trend }) {
  const ring =
    tone === "amber"
      ? "focus:ring-amber-500/30"
      : tone === "green"
      ? "focus:ring-green-600/30"
      : tone === "blue"
      ? "focus:ring-sky-600/30"
      : "focus:ring-[#8b6f47]/30";
  return (
    <div
      className={
        "rounded-2xl border border-[#e6dfd6] bg-white/80 backdrop-blur p-4 shadow-sm focus-within:outline-none focus-within:ring-2 " +
        ring
      }
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-[#7a6a5f]">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
      </div>
      <div className="mt-3 h-16">
        <TinyTrend data={trend} />
      </div>
    </div>
  );
}

function TinyTrend({ data }) {
  const fallback = [
    { name: "Mon", value: 4 },
    { name: "Tue", value: 8 },
    { name: "Wed", value: 5 },
    { name: "Thu", value: 9 },
    { name: "Fri", value: 7 },
    { name: "Sat", value: 12 },
    { name: "Sun", value: 6 },
  ];
  const d = data && data.length ? data : fallback;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={d} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b6f47" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#8b6f47" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <XAxis dataKey="name" hide />
        <YAxis hide domain={[0, "dataMax + 4"]} />
        <ReTooltip
          contentStyle={{
            background: "rgba(255,255,255,0.9)",
            border: "1px solid #e6dfd6",
            borderRadius: 12,
            fontSize: 12,
          }}
          formatter={(v) => [v, "Value"]}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#8b6f47"
          fill="url(#trendFill)"
          strokeWidth={1.75}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function Tip({ children }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1 inline-block h-2 w-2 rounded-full bg-[#8b6f47]" />
      <span>{children}</span>
    </li>
  );
}

function Skeleton() {
  return (
    <div className="min-h-screen bg-[#f4f1ec] animate-pulse" aria-busy>
      <div className="mx-auto px-6 py-10 max-w-6xl xl:max-w-7xl">
        <div className="h-5 w-28 bg-[#e8e2d9] rounded mb-4" />
        <div className="h-10 w-72 bg-[#e8e2d9] rounded mb-6" />
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-[#e8e2d9] rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 bg-[#e8e2d9] rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Utils ---------------------------- */

function formatCurrency(n) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return "€" + Math.round(n).toLocaleString();
  }
}
function formatPercent(n) {
  const safe = isFinite(n) ? Number(n) : 0;
  return `${Math.round(safe)}%`;
}
function formatShortTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}
function placeholderActivity() {
  return [
    {
      id: "p1",
      label: "Welcome to your upgraded dashboard ✨",
      meta: "Tip: press / to search, g b for bookings, g w for waitlist",
      at: new Date().toISOString(),
    },
  ];
}
