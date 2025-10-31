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

// Admin Dashboard – refreshed UI/UX (JavaScript version, hook-order safe)
export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Core state
  const [isAdmin, setIsAdmin] = useState(null); // null | boolean
  const [booted, setBooted] = useState(false);

  // Dashboard state
  const [metrics, setMetrics] = useState(null);
  const [activity, setActivity] = useState([]);

  // Helpers & UI state — declared BEFORE any early returns to keep hook order stable
  const go = (p) => router.push(p);
  const [query, setQuery] = useState("");

  const actions = useMemo(
    () => [
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
        title: "Manage Clients",
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
        keywords: ["schedule", "slots", "availability"],
      },
      {
        key: "payments",
        icon: <CreditCard size={20} />,
        title: "Payments",
        desc: "Capture, refunds, reconciliation.",
        onClick: () => go("/admin/payments"),
        keywords: ["payment", "refund", "billing"],
      },
      {
        key: "invoices",
        icon: <ReceiptText size={20} />,
        title: "Invoices",
        desc: "Download and send invoices.",
        onClick: () => go("/admin/invoices"),
        keywords: ["invoice", "billing", "pdf"],
      },
      {
        key: "promotions",
        icon: <Tag size={20} />,
        title: "Promotions",
        desc: "Discount codes and campaigns.",
        onClick: () => go("/admin/promotions"),
        keywords: ["promo", "discount", "coupon", "campaign"],
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

  const filtered = actions.filter(function (a) {
    const hay = (
      a.title +
      " " +
      a.desc +
      " " +
      a.keywords.join(" ")
    ).toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  // Keyboard shortcuts (e.g., g b -> bookings, / -> search)
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
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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

  // Fetch metrics and activity (soft-fail; show placeholders if missing)
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
            todayBookings: m && m.todayBookings != null ? m.todayBookings : 0,
            pendingApprovals:
              m && m.pendingApprovals != null ? m.pendingApprovals : 0,
            revenueToday: m && m.revenueToday != null ? m.revenueToday : 0,
            openSlots: m && m.openSlots != null ? m.openSlots : 0,
            trend: (m && m.trend) || [
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
        // silence – UI will show placeholders
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
          {" "}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-serif tracking-tight leading-tight text-[#5a4a3f]">
                Admin Dashboard
              </h1>
              <p className="mt-1 text-sm text-[#7a6a5f]">
                Manage experiences, bookings, clients & more.
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
            label="Pending approvals"
            value={
              (metrics && metrics.pendingApprovals) != null
                ? metrics.pendingApprovals
                : 0
            }
            tone="amber"
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
              <h2 className="text-base font-semibold">Recent activity</h2>
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
              ).map(function (item) {
                return (
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
                );
              })}
            </ul>
          </div>

          <aside className="rounded-2xl bg-white/80 backdrop-blur border border-[#e0dcd4] shadow-xl p-5">
            <h2 className="text-base font-semibold mb-2">Quick Tips</h2>
            <ul className="space-y-2 text-sm">
              <Tip>Keep the experiences catalogue fresh.</Tip>
              <Tip>Confirm or cancel pending reservations promptly.</Tip>
              <Tip>Keep client profiles up to date for faster checkouts.</Tip>
              <Tip>Use the search (/) and shortcuts (g b, g e, g s, g u).</Tip>
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

function ActionTile({ icon, title, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-2xl bg-gradient-to-b from-white/90 to-[#fdfaf7] border border-[#e6dfd6] p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8b6f47]/40"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 h-10 w-10 rounded-xl border border-[#e0dcd4] bg-white/70 backdrop-blur flex items-center justify-center group-hover:bg-[#8b6f47] group-hover:text-white transition">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-[#5a4a3f] group-hover:text-[#3f332b]">
            {title}
          </h3>
          <p className="mt-1 text-xs text-[#7a6a5f]">{desc}</p>
        </div>
        <ChevronRight
          className="ml-auto opacity-60 group-hover:opacity-100"
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
      className="inline-flex items-center gap-1.5 rounded-full border border-[#d8cfc3] bg-white/70 px-3 py-1.5 text-xs text-[#5a4a3f] hover:bg-[#f1ede7] transition focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
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
          {Array.from({ length: 4 }).map(function (_, i) {
            return <div key={i} className="h-24 bg-[#e8e2d9] rounded-2xl" />;
          })}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map(function (_, i) {
            return <div key={i} className="h-28 bg-[#e8e2d9] rounded-2xl" />;
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------- Utils ----------------------------

function formatCurrency(n) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);
  } catch (e) {
    return "€" + Math.round(n).toLocaleString();
  }
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
      label: "Welcome to your new dashboard ✨",
      meta: "Tip: press / to search, g b for bookings",
      at: new Date().toISOString(),
    },
  ];
}
