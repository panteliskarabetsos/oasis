// src/app/admin/page.js
"use client";

import {
  useEffect,
  useMemo,
  useState,
  useDeferredValue,
  useCallback,
  useTransition,
  useId,
} from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/SessionWrapper";
import {
  Compass,
  CalendarDays,
  CalendarRange,
  CalendarPlus,
  Users,
  Clock,
  ShieldCheck,
  Settings,
  FileBarChart2,
  Tag,
  CreditCard,
  ReceiptText,
  Search,
  Plus,
  ArrowUpRight,
  Gift,
  Star,
  QrCode,
  Store,
  Link as LinkIcon,
  Building2,
  PackagePlus,
  Boxes,
  ShoppingCart,
  ShieldUser,
  TrendingUp,
  Activity,
  Sparkles,
  Shield,
  Briefcase,
  Calculator,
  Megaphone,
  Headset,
  UserCheck,
  Inbox, // <-- Added Inbox icon for the requests tile
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

export const dynamic = "force-dynamic";

/* ------------------------------ Roles & Permissions Map ------------------------------ */

const PERMISSIONS = {
  experiences: "Experiences",
  bookings: "Bookings",
  requests: "Guest Requests", // <-- NEW: Added requests permission
  guests: "Guests & CRM",
  planner: "Planner",
  schedule: "Schedule",
  admins: "Admins",
  payments: "Payments",
  invoices: "Invoices",
  promotions: "Promotions",
  checkins: "Check-ins",
  pos: "POS",
  eshop: "e-Shop",
  giftcards: "Gift Cards",
  bundles: "Bundles",
  waitlist: "Waitlist",
  loyalty: "Loyalty",
  addons: "Add-ons",
  waivers: "Waivers",
  corporate: "Corporate",
  integrations: "Integrations",
  settings: "Settings",
};

const ADMIN_ROLES = [
  {
    id: "superadmin",
    title: "Super Admin",
    icon: Shield,
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
    permissions: Object.keys(PERMISSIONS),
  },
  {
    id: "manager",
    title: "Operations Manager",
    icon: Briefcase,
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    permissions: [
      "experiences",
      "bookings",
      "requests", // <-- Granted to Managers
      "guests",
      "planner",
      "schedule",
      "checkins",
      "pos",
      "waitlist",
      "addons",
      "waivers",
    ],
  },
  {
    id: "finance",
    title: "Finance & Billing",
    icon: Calculator,
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    permissions: ["payments", "invoices", "corporate", "giftcards", "pos"],
  },
  {
    id: "marketing",
    title: "Marketing & Growth",
    icon: Megaphone,
    color: "text-pink-700",
    bg: "bg-pink-50",
    border: "border-pink-200",
    permissions: [
      "guests",
      "promotions",
      "eshop",
      "bundles",
      "loyalty",
      "integrations",
      "settings",
    ],
  },
  {
    id: "support",
    title: "Support Agent",
    icon: Headset,
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    permissions: [
      "bookings",
      "requests", // <-- Granted to Support
      "guests",
      "checkins",
      "waitlist",
    ],
  },
  {
    id: "partner",
    title: "External Partner",
    icon: UserCheck,
    color: "text-teal-700",
    bg: "bg-teal-50",
    border: "border-teal-200",
    permissions: ["planner", "schedule", "checkins"],
  },
];

const getRoleConfig = (roleId) =>
  ADMIN_ROLES.find((r) => r.id === roleId) || ADMIN_ROLES[0];
const isAdminRole = (r) =>
  ADMIN_ROLES.some((role) => role.id === r) || r === "admin"; // 'admin' is legacy fallback to superadmin

/* ------------------------------------------------------------------------------------- */

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [role, setRole] = useState(null);
  const [booted, setBooted] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const [, startTransition] = useTransition();
  const go = useCallback(
    (p) => startTransition(() => router.push(p)),
    [router],
  );

  const [metrics, setMetrics] = useState(null);
  const [metricsRaw, setMetricsRaw] = useState(null);

  const metricsSeries = useMemo(
    () => extractMetricsSeries(metricsRaw),
    [metricsRaw],
  );
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const categories = [
    { id: "all", label: "All Modules", icon: <Boxes size={14} /> },
    { id: "ops", label: "Operations", icon: <Clock size={14} /> },
    { id: "growth", label: "Revenue & Growth", icon: <TrendingUp size={14} /> },
    { id: "finance", label: "Finance", icon: <CreditCard size={14} /> },
  ];

  // ALL possible actions
  const ALL_ACTIONS = useMemo(
    () => [
      {
        key: "experiences",
        cat: "ops",
        icon: <Compass size={20} />,
        title: "Experiences",
        desc: "Catalog & products",
        onClick: () => go("/admin/experiences"),
        keywords: ["experience", "catalog"],
      },
      {
        key: "bookings",
        cat: "ops",
        icon: <CalendarDays size={20} />,
        title: "Bookings",
        desc: "Reservations list",
        onClick: () => go("/admin/bookings"),
        keywords: ["booking", "calendar"],
      },
      {
        key: "requests", // <-- NEW: Action Tile for Requests
        cat: "ops",
        icon: <Inbox size={20} />,
        title: "Guest Requests",
        desc: "Cancellations & Reschedules",
        onClick: () => go("/admin/requests"),
        keywords: ["request", "cancel", "reschedule", "refund", "meetup"],
      },
      {
        key: "guests",
        cat: "growth",
        icon: <Users size={20} />,
        title: "Guests & CRM",
        desc: "User segmentation",
        onClick: () => go("/admin/users"),
        keywords: ["client", "user", "guest"],
      },
      {
        key: "schedule",
        cat: "ops",
        icon: <CalendarPlus size={20} />,
        title: "Schedule",
        desc: "Open slots for new bookings",
        onClick: () => go("/admin/schedule"),
        keywords: ["slots", "open", "create", "schedule"],
      },
      {
        key: "planner",
        cat: "ops",
        icon: <CalendarRange size={20} />,
        title: "Planner",
        desc: "Availability & slots",
        onClick: () => go("/admin/planner"),
        keywords: ["slots", "calendar", "schedule", "planner"],
      },
      {
        key: "admins",
        cat: "finance",
        icon: <ShieldUser size={20} />,
        title: "Admins",
        desc: "Access control",
        onClick: () => go("/admin/accounts"),
        keywords: ["admin", "staff", "security"],
      },
      {
        key: "payments",
        cat: "finance",
        icon: <CreditCard size={20} />,
        title: "Payments",
        desc: "Stripe & refunds",
        onClick: () => go("/admin/payments"),
        keywords: ["payment", "stripe"],
      },
      {
        key: "invoices",
        cat: "finance",
        icon: <ReceiptText size={20} />,
        title: "Invoices",
        desc: "Tax & PDF receipts",
        onClick: () => go("/admin/invoices"),
        keywords: ["invoice", "tax"],
      },
      {
        key: "promotions",
        cat: "growth",
        icon: <Tag size={20} />,
        title: "Promotions",
        desc: "Campaigns & codes",
        onClick: () => go("/admin/promotions"),
        keywords: ["promo", "coupon"],
      },
      {
        key: "checkins",
        cat: "ops",
        icon: <QrCode size={20} />,
        title: "Check-ins",
        desc: "Arrivals & QR",
        onClick: () => go("/admin/checkins"),
        keywords: ["qr", "arrival", "scan"],
      },
      {
        key: "pos",
        cat: "finance",
        icon: <Store size={20} />,
        title: "POS",
        desc: "In-person sales",
        onClick: () => go("/admin/pos"),
        keywords: ["pos", "terminal", "register"],
      },
      {
        key: "eshop",
        cat: "growth",
        icon: <ShoppingCart size={20} />,
        title: "e-Shop",
        desc: "Product inventory",
        onClick: () => go("/admin/eshop"),
        keywords: ["shop", "stock", "product"],
      },
      {
        key: "giftcards",
        cat: "growth",
        icon: <Gift size={20} />,
        title: "Gift Cards",
        desc: "Issue & redeem",
        onClick: () => go("/admin/giftcards"),
        keywords: ["gift", "voucher"],
      },
      {
        key: "bundles",
        cat: "growth",
        icon: <Boxes size={20} />,
        title: "Bundles",
        desc: "Multi-visit packs",
        onClick: () => go("/admin/bundles"),
        keywords: ["bundle", "package"],
      },
      {
        key: "waitlist",
        cat: "growth",
        icon: <Users size={20} />,
        title: "Waitlist",
        desc: "Demand capture",
        onClick: () => go("/admin/waitlist"),
        keywords: ["waitlist", "demand"],
      },
      {
        key: "loyalty",
        cat: "growth",
        icon: <Star size={20} />,
        title: "Loyalty",
        desc: "Reward tiers",
        onClick: () => go("/admin/loyalty"),
        keywords: ["points", "tier", "reward"],
      },
      {
        key: "addons",
        cat: "growth",
        icon: <PackagePlus size={20} />,
        title: "Add-ons",
        desc: "Upsells & extras",
        onClick: () => go("/admin/addons"),
        keywords: ["upsell", "addon", "extra"],
      },
      {
        key: "waivers",
        cat: "ops",
        icon: <ShieldCheck size={20} />,
        title: "Waivers",
        desc: "Legal & safety",
        onClick: () => go("/admin/waivers"),
        keywords: ["waiver", "safety", "legal"],
      },
      {
        key: "corporate",
        cat: "growth",
        icon: <Building2 size={20} />,
        title: "Corporate",
        desc: "B2B & bulk",
        onClick: () => go("/admin/corporate"),
        keywords: ["b2b", "company", "bulk"],
      },
      {
        key: "integrations",
        cat: "finance",
        icon: <LinkIcon size={20} />,
        title: "Integrations",
        desc: "Webhooks & OTAs",
        onClick: () => go("/admin/integrations"),
        keywords: ["webhook", "zapier", "ota"],
      },
      {
        key: "settings",
        cat: "finance",
        icon: <Settings size={20} />,
        title: "Settings",
        desc: "Brand & Email",
        onClick: () => go("/admin/settings"),
        keywords: ["settings", "brand"],
      },
    ],
    [go],
  );

  // Filter actions based on logged in user's role
  const permittedActions = useMemo(() => {
    if (!role) return [];
    // Treat legacy 'admin' as 'superadmin'
    const activeRoleConfig = getRoleConfig(
      role === "admin" ? "superadmin" : role,
    );
    return ALL_ACTIONS.filter((action) =>
      activeRoleConfig.permissions.includes(action.key),
    );
  }, [ALL_ACTIONS, role]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return permittedActions.filter((a) => {
      const matchesQuery =
        !q ||
        (a.title + a.desc + a.keywords.join(" ")).toLowerCase().includes(q);
      const matchesTab = activeTab === "all" || a.cat === activeTab;
      return matchesQuery && matchesTab;
    });
  }, [permittedActions, deferredQuery, activeTab]);

  useEffect(() => {
    let cancelled = false;
    async function resolveRole() {
      if (!user) {
        if (!cancelled) {
          setRole(null);
          setBooted(true);
        }
        return;
      }
      try {
        const res = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        });
        const data = await res.json();
        const foundRole = data?.role || user?.app_metadata?.role || "user";
        if (!cancelled) {
          setRole(foundRole);
          setBooted(true);
        }
      } catch (e) {
        if (!cancelled) {
          setRole(user?.app_metadata?.role || "user");
          setBooted(true);
        }
      }
    }
    if (!loading) resolveRole();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  useEffect(() => {
    if (!booted || !isAdminRole(role)) return;
    (async function fetchMetrics() {
      try {
        const mRes = await fetch(
          `/api/admin/metrics?group=day&tz=Europe/Athens`,
          { cache: "no-store" },
        );
        if (mRes.ok) {
          const m = await mRes.json();
          setMetricsRaw(m);
          setMetrics({
            bookings: coalesce(m?.bookings, 0),
            revenue: coalesce(m?.revenue, 0),
            openSlots: coalesce(m?.openSlots, 0),
            occupancyPct: coalesce(m?.occupancyPct, 0),
          });
        }
      } catch (e) {
        /* ignore */
      }
    })();
  }, [booted, role]);

  if (loading || !booted || role === null) return <Skeleton />;
  if (!isAdminRole(role)) return null;

  const roleConfig = getRoleConfig(role === "admin" ? "superadmin" : role);
  const RoleIcon = roleConfig.icon;

  return (
    <div className="min-h-screen bg-[#fdfcfb] text-[#3f3127] selection:bg-[#8b6f47]/20 pb-20">
      {/* Ambient background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -left-[5%] w-[40%] h-[40%] rounded-full bg-[#8b6f47]/5 blur-[120px]" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[50%] rounded-full bg-[#e3ddd2]/30 blur-[100px]" />
      </div>

      <div className="relative mx-auto px-4 sm:px-8 py-6 max-w-7xl">
        {/* Header */}
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5 ${roleConfig.bg} ${roleConfig.border} ${roleConfig.color}`}
              >
                <RoleIcon size={12} /> {roleConfig.title}
              </span>
              <span className="w-1 h-1 rounded-full bg-[#d8cfc3]" />
              <time className="text-[10px] text-[#7a6a5f] font-medium uppercase tracking-widest">
                {new Date().toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </time>
            </div>
            <h1 className="text-4xl font-serif tracking-tight text-[#2a1f18]">
              Dashboard
            </h1>
            <p className="text-[#7a6a5f] text-sm">
              Welcome back, {user?.user_metadata?.name || "Administrator"}.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {roleConfig.permissions.includes("settings") && (
              <>
                <button
                  onClick={() => go("/admin/reports")}
                  className="p-2.5 rounded-xl border border-[#e3ddd2] bg-white hover:bg-[#fdfaf5] transition-all shadow-sm group"
                >
                  <FileBarChart2
                    size={18}
                    className="text-[#5a4a3f] group-hover:scale-110 transition-transform"
                  />
                </button>
                <button
                  onClick={() => go("/admin/settings")}
                  className="p-2.5 rounded-xl border border-[#e3ddd2] bg-white hover:bg-[#fdfaf5] transition-all shadow-sm group"
                >
                  <Settings
                    size={18}
                    className="text-[#5a4a3f] group-hover:rotate-45 transition-transform duration-500"
                  />
                </button>
                <div className="h-10 w-[1px] bg-[#e3ddd2] mx-1 hidden sm:block" />
              </>
            )}

            {roleConfig.permissions.includes("experiences") && (
              <button
                onClick={() => go("/admin/experiences/new")}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1a1a1a] text-white hover:bg-[#333] transition-all shadow-lg shadow-black/10 text-sm font-semibold active:scale-95"
              >
                <Plus size={16} strokeWidth={3} />
                New Experience
              </button>
            )}
          </div>
        </header>

        {/* KPI Grid - Only show if role has access to bookings/finance */}
        {(roleConfig.permissions.includes("bookings") ||
          roleConfig.permissions.includes("payments")) && (
          <section className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <StatCard
              label="Total Bookings"
              value={metrics?.bookings ?? 0}
              trend={metricsSeries.bookings}
              delta="+12%"
              icon={<CalendarDays size={14} />}
            />
            <StatCard
              label="Avg Occupancy"
              value={formatPercent(metrics?.occupancyPct ?? 0)}
              trend={metricsSeries.occupancyPct}
              delta="-2%"
              icon={<Activity size={14} />}
            />
            <StatCard
              label="Monthly Revenue"
              value={formatCurrency(metrics?.revenue ?? 0)}
              trend={metricsSeries.revenue}
              delta="+18.4%"
              tone="green"
              icon={<TrendingUp size={14} />}
            />
            <StatCard
              label="Available Slots"
              value={metrics?.openSlots ?? 0}
              trend={metricsSeries.openSlots}
              tone="blue"
              icon={<Sparkles size={14} />}
            />
          </section>
        )}

        {/* Filters & Actions Container */}
        <div className="space-y-8">
          {/* Unified Search & Tab Bar */}
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white p-2 border border-[#e3ddd2] rounded-2xl shadow-sm">
            <div className="relative flex-1 group w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#a09084] group-focus-within:text-[#8b6f47] transition-colors" />
              <input
                id="dashboard-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to a module... (press /)"
                className="w-full bg-transparent border-none focus:ring-0 pl-11 pr-4 py-2 text-sm placeholder:text-[#a09084]"
                autoComplete="off"
              />
            </div>
            <div className="flex items-center gap-1 p-1 bg-[#fdfaf5] rounded-xl border border-[#e3ddd2]/50 w-full lg:w-auto overflow-x-auto no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === cat.id
                      ? "bg-white text-[#8b6f47] shadow-sm border border-[#e3ddd2]"
                      : "text-[#7a6a5f] hover:text-[#3f3127]"
                  }`}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action Grid */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            <AnimatePresence mode="popLayout">
              {filtered.map((a, idx) => {
                const { key, ...restProps } = a;
                return (
                  <motion.div
                    key={key}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: idx * 0.01 }}
                  >
                    <ActionTile {...restProps} />
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filtered.length === 0 && (
              <div className="col-span-full py-12 text-center text-[#7a6a5f]">
                No modules match your search or role permissions.
              </div>
            )}
          </div>

          {/* Growth Insight Footer Section - Only show to Superadmin & Marketing */}
          {(role === "superadmin" ||
            role === "admin" ||
            role === "marketing") && (
            <section className="mt-16 pt-10 border-t border-[#e3ddd2]">
              <div className="bg-[#1a1a1a] rounded-[2.5rem] p-8 sm:p-12 text-white relative overflow-hidden group shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-[#8b6f47]/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="relative z-10 max-w-xl text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-3 mb-4 text-[#8b6f47]">
                    <Sparkles size={24} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.3em]">
                      Operational Insight
                    </span>
                  </div>
                  <h3 className="font-serif text-3xl mb-4">Grow your Oasis</h3>
                  <p className="text-white/60 text-lg leading-relaxed">
                    Experiences with at least 5 high-quality photos and clear
                    arrival instructions convert 40% higher than average.
                    <span className="text-white block mt-2">
                      Check your "Waitlist" module to see unfulfilled demand.
                    </span>
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto relative z-10">
                  <button
                    onClick={() => go("/admin/experiences")}
                    className="px-8 py-4 rounded-xl bg-white text-black text-xs font-bold uppercase tracking-widest hover:bg-[#e3ddd2] transition-all active:scale-95 shadow-lg"
                  >
                    Optimize Listings
                  </button>
                  <button
                    onClick={() => go("/admin/reports")}
                    className="px-8 py-4 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-bold uppercase tracking-widest hover:bg-white/20 transition-all active:scale-95 backdrop-blur-sm"
                  >
                    Full Analytics
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Sub Components ---------------------------- */

function StatCard({ label, value, trend, tone, delta, icon }) {
  return (
    <div className="group bg-white border border-[#e3ddd2] rounded-[1.5rem] p-5 shadow-sm hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2 text-[#7a6a5f]">
          <div className="p-1.5 rounded-lg bg-[#fdfaf5] border border-[#e3ddd2]">
            {icon}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">
            {label}
          </span>
        </div>
        {delta && (
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              delta.startsWith("+")
                ? "text-green-600 bg-green-50"
                : "text-red-600 bg-red-50"
            }`}
          >
            {delta}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-4">
        <h3 className="text-3xl font-serif text-[#2a1f18]">{value}</h3>
        <div className="h-10 w-20">
          <TinyTrend data={trend} tone={tone} />
        </div>
      </div>
    </div>
  );
}

function ActionTile({ icon, title, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left p-6 rounded-2xl bg-white border border-[#e3ddd2] hover:border-[#8b6f47] hover:shadow-xl hover:shadow-[#8b6f47]/5 transition-all focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40 relative overflow-hidden"
    >
      <div className="absolute top-2 right-2 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowUpRight size={14} className="text-[#8b6f47]" />
      </div>
      <div className="flex flex-col gap-4">
        <div className="shrink-0 h-12 w-12 rounded-xl bg-[#fdfaf5] border border-[#e3ddd2] group-hover:bg-[#8b6f47] group-hover:text-white flex items-center justify-center text-[#8b6f47] transition-all duration-300 group-hover:scale-110">
          {icon}
        </div>
        <div className="min-w-0">
          <h4 className="text-[15px] font-bold text-[#3f3127] group-hover:text-[#8b6f47] transition-colors">
            {title}
          </h4>
          <p className="text-[11px] text-[#a09084] mt-1 line-clamp-2 leading-relaxed font-medium">
            {desc}
          </p>
        </div>
      </div>
    </button>
  );
}

function TinyTrend({ data, tone }) {
  const id = useId();
  const color =
    tone === "green" ? "#10b981" : tone === "blue" ? "#0ea5e9" : "#8b6f47";
  if (!data || !data.length)
    return <div className="h-full w-full rounded bg-[#fdfaf5]" />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.15} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${id})`}
          isAnimationActive={true}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function Skeleton() {
  return (
    <div className="min-h-screen bg-[#fdfcfb] animate-pulse p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="h-12 w-48 bg-[#e3ddd2]/40 rounded-xl" />
        <div className="hidden sm:grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-[#e3ddd2]/20 rounded-2xl" />
          ))}
        </div>
        <div className="space-y-6">
          <div className="h-16 bg-[#e3ddd2]/20 rounded-2xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <div key={i} className="h-28 bg-[#e3ddd2]/20 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Utils ---------------------------- */
function coalesce(...vals) {
  for (const v of vals) if (v != null && !isNaN(v)) return v;
  return 0;
}
function formatCurrency(n) {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}
function formatPercent(n) {
  return `${Math.round(n)}%`;
}

function extractMetricsSeries(m) {
  const empty = Array(7)
    .fill(0)
    .map((_, i) => ({ value: Math.floor(Math.random() * 20) + 10 }));
  if (!m?.trend)
    return {
      bookings: empty,
      revenue: empty,
      occupancyPct: empty,
      openSlots: empty,
    };
  const seriesFromKey = (k) =>
    m.trend.map((p) => ({ name: p.name, value: p[k] ?? p.value ?? 0 }));
  return {
    bookings: seriesFromKey("bookings"),
    revenue: seriesFromKey("revenue"),
    occupancyPct: seriesFromKey("occupancyPct"),
    openSlots: seriesFromKey("openSlots"),
  };
}
