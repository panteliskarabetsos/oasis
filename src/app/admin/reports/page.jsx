// src/app/admin/reports/page.jsx
"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  ReferenceLine,
} from "recharts";
import {
  CalendarDays,
  TrendingUp,
  Users,
  Percent,
  ArrowLeft,
  Download,
  RefreshCw,
  Filter,
  Sparkles,
  Share2,
  RotateCcw,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from "lucide-react";

/* ---------------------------- helpers ---------------------------- */
const fmtCurrency = (n) =>
  typeof n === "number"
    ? n.toLocaleString("el-GR", { style: "currency", currency: "EUR" })
    : "-";

const fmtCompact = (n) =>
  typeof n === "number"
    ? new Intl.NumberFormat("en", { notation: "compact" }).format(n)
    : "-";

const toYMD = (d) => new Date(d).toISOString().slice(0, 10);
const cx = (...xs) => xs.filter(Boolean).join(" ");

const CHART_COLORS = {
  bookings: "#8b6f47",
  revenue: "#5a4a3f",
  occupancy: "#7f6a59",
  grid: "#e9e2d8",
};

const STATUS_COLORS = {
  confirmed: "#8b6f47",
  completed: "#5a4a3f",
  pending: "#b9a58f",
  cancelled: "#c77a7a",
  rejected: "#d9a1a1",
  refunded: "#7a8f9b",
};

function computePrevRange(from, to) {
  const dFrom = new Date(from);
  const dTo = new Date(to);
  const ms = dTo - dFrom;
  const prevTo = new Date(dFrom.getTime() - 24 * 3600 * 1000);
  const prevFrom = new Date(prevTo.getTime() - ms);
  return { prevFrom: toYMD(prevFrom), prevTo: toYMD(prevTo) };
}

function copyToClipboard(text) {
  try {
    navigator.clipboard?.writeText(text);
  } catch {}
}

/* ------------------------------- main ------------------------------- */
export default function AdminReportsPage() {
  const router = useRouter();

  /* ------------------------------ filters ------------------------------ */
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toYMD(d);
  });
  const [to, setTo] = useState(() => toYMD(new Date()));
  const [experienceId, setExperienceId] = useState("");
  const [preset, setPreset] = useState("30d"); // 7d | 30d | 90d | ytd | custom

  /* ------------------------------- data -------------------------------- */
  const [experiences, setExperiences] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState("");

  /* enhancements */
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [compare, setCompare] = useState(false);
  const [compareData, setCompareData] = useState(null);
  const [barMetric, setBarMetric] = useState("revenue"); // revenue | bookings
  const [revAsArea, setRevAsArea] = useState(true);

  const mounted = useRef(false);

  // Load experiences for filter
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(
          "/api/admin/experiences?select=id,name&visibility=all",
          { credentials: "include", cache: "no-store" }
        );
        if (!res.ok) throw new Error("Failed to load experiences");
        const xs = await res.json();
        if (!cancel) setExperiences(xs?.data || xs || []);
      } catch (e) {
        if (!cancel) setExperiences([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  // Apply a preset quickly
  const applyPreset = (code) => {
    setPreset(code);
    const now = new Date();
    if (code === "7d" || code === "30d" || code === "90d") {
      const d = new Date(now);
      d.setDate(d.getDate() - (code === "7d" ? 7 : code === "30d" ? 30 : 90));
      setFrom(toYMD(d));
      setTo(toYMD(now));
    } else if (code === "ytd") {
      const y = new Date(now.getFullYear(), 0, 1);
      setFrom(toYMD(y));
      setTo(toYMD(now));
    } else {
      // custom – leave as is
    }
  };

  // Keep URL in sync for shareable views
  useEffect(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (experienceId) params.set("experienceId", String(experienceId));
    if (preset) params.set("preset", preset);
    const url = `${location.pathname}?${params.toString()}`;
    history.replaceState(null, "", url);
  }, [from, to, experienceId, preset]);

  // Load reports
  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (experienceId) params.set("experienceId", String(experienceId));
      const res = await fetch(`/api/admin/reports?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const body = await res
        .json()
        .catch(() => ({ error: "Failed to parse response" }));
      if (!res.ok) throw new Error(body?.error || "Failed to load reports");
      setData(body);
      setLastRefreshed(
        new Date().toLocaleString("el-GR", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      );
    } catch (e) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  // Load compare data if enabled
  const loadCompare = async () => {
    if (!compare) return setCompareData(null);
    const { prevFrom, prevTo } = computePrevRange(from, to);
    const params = new URLSearchParams();
    params.set("from", prevFrom);
    params.set("to", prevTo);
    if (experienceId) params.set("experienceId", String(experienceId));
    const res = await fetch(`/api/admin/reports?${params.toString()}`, {
      credentials: "include",
      cache: "no-store",
    });
    const body = await res
      .json()
      .catch(() => ({ error: "Failed to parse response" }));
    if (res.ok) setCompareData(body);
  };

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      load();
    }
  }, []);

  // refresh compare when toggled or dates change
  useEffect(() => {
    loadCompare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compare, from, to, experienceId]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 60_000 * 5); // every 5 minutes
    return () => clearInterval(id);
  }, [autoRefresh, from, to, experienceId]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.key.toLowerCase() === "r") load();
      if (e.key.toLowerCase() === "e") exportCSV();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const k = data?.kpis || {};
  const statusBreakdown = data?.statusBreakdown || [];
  const series = data?.series || [];
  const occupancySeries = data?.occupancySeries || [];
  const topExperiences = data?.topExperiences || [];

  const kPrev = compareData?.kpis || {};
  const pieData = useMemo(
    () => statusBreakdown.map((x) => ({ name: x.status, value: x.count })),
    [statusBreakdown]
  );

  const bestDay = useMemo(() => {
    if (!series.length) return null;
    return series.reduce(
      (a, b) => (b.revenue > (a?.revenue || 0) ? b : a),
      null
    );
  }, [series]);

  const topExp = topExperiences?.[0] || null;

  /* ---------------------------- CSV Export ---------------------------- */
  const exportCSV = () => {
    const lines = [];
    lines.push("KPIs");
    lines.push("Metric,Value");
    lines.push(`Total Revenue,${k.totalRevenue ?? 0}`);
    lines.push(`Total Bookings,${k.totalBookings ?? 0}`);
    lines.push(`Avg Order Value,${k.avgOrderValue ?? 0}`);
    lines.push(`Avg Party Size,${k.avgPartySize ?? 0}`);
    lines.push(`Occupancy Rate,${k.occupancyRate ?? 0}`);
    lines.push(`Conversion Rate,${k.conversionRate ?? 0}`);
    lines.push("");

    lines.push("Bookings & Revenue by Day");
    lines.push("Date,Bookings,Revenue");
    for (const r of series) lines.push(`${r.date},${r.bookings},${r.revenue}`);
    lines.push("");

    lines.push("Status Breakdown");
    lines.push("Status,Count");
    for (const s of statusBreakdown) lines.push(`${s.status},${s.count}`);
    lines.push("");

    lines.push("Top Experiences");
    lines.push("Name,Bookings,Revenue");
    for (const e of topExperiences)
      lines.push(`${e.name},${e.bookings},${e.revenue}`);

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `oasis-reports_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ------------------------------- render ------------------------------ */
  return (
    <div className="relative min-h-screen bg-[#f4f1ec]">
      {/* Ambient background blobs */}
      <div className="pointer-events-none absolute -top-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-[#e9e4dc] blur-3xl opacity-70" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[32rem] w-[32rem] rounded-full bg-[#fff4e1] blur-3xl opacity-80" />

      <div className="relative mx-auto px-6 py-6 lg:py-10 max-w-6xl xl:max-w-7xl 2xl:max-w-[88rem]">
        {/* Top bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-full border border-[#d8cfc3] bg-white/80 px-4 py-2 text-[#5a4a3f] hover:bg-[#f4f1ec] hover:text-[#5a4a3f]"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <span className="flex items-center gap-2 text-xs rounded-full px-3 py-1 border border-[#e8e2d9] bg-[#f6f4f0] text-[#5a4a3f]">
              <CalendarDays className="h-3.5 w-3.5" /> Reports
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#6e5a4f]">
            <Clock className="h-3.5 w-3.5" /> Last refreshed:{" "}
            {lastRefreshed || "—"}
            <div className="ml-3 flex items-center gap-2 rounded-full border border-[#e0dcd4] bg-white/70 px-2 py-1">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  className="accent-[#8b6f47]"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                Auto refresh
              </label>
            </div>
          </div>
        </div>

        {/* Hero */}
        <header className="mb-4 lg:mb-6">
          <h1 className="text-3xl md:text-4xl font-serif tracking-tight leading-tight text-[#5a4a3f]">
            Insights & Analytics
          </h1>
          <p className="mt-1 text-[#7a6a5f]">
            From <strong>{from}</strong> to <strong>{to}</strong>{" "}
            {experienceId ? (
              <span>
                · Experience <strong>#{experienceId}</strong>
              </span>
            ) : (
              <span>· All experiences</span>
            )}
          </p>
        </header>

        {/* Filter toolbar (sticky) */}
        <div className="sticky top-4 z-20 mb-8 rounded-2xl border border-[#e0dcd4] bg-white/70 backdrop-blur p-4 lg:p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
              {/* Preset segmented */}
              <div>
                <label className="block text-xs text-[#7a6a5f]">Preset</label>
                <div className="mt-2 inline-grid grid-cols-5 rounded-full border border-[#e0dcd4] bg-[#fbf9f5] p-1">
                  {[
                    { code: "7d", label: "7d" },
                    { code: "30d", label: "30d" },
                    { code: "90d", label: "90d" },
                    { code: "ytd", label: "YTD" },
                    { code: "custom", label: "Custom" },
                  ].map((p) => (
                    <button
                      key={p.code}
                      onClick={() => applyPreset(p.code)}
                      className={cx(
                        "px-3 py-1 text-xs rounded-full transition",
                        preset === p.code
                          ? "bg-white shadow-sm text-[#5a4a3f]"
                          : "text-[#5a4a3f]/80 hover:text-[#5a4a3f]"
                      )}
                      aria-pressed={preset === p.code}
                      aria-label={`Preset ${p.label}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* From */}
              <div>
                <label className="block text-xs text-[#7a6a5f]">From</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setPreset("custom");
                  }}
                  className="mt-2 w-full rounded-xl border border-[#e0dcd4] bg-white/80 px-3 py-2 text-[#5a4a3f]"
                />
              </div>

              {/* To */}
              <div>
                <label className="block text-xs text-[#7a6a5f]">To</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPreset("custom");
                  }}
                  className="mt-2 w-full rounded-xl border border-[#e0dcd4] bg-white/80 px-3 py-2 text-[#5a4a3f]"
                />
              </div>

              {/* Experience */}
              <div>
                <label className="block text-xs text-[#7a6a5f]">
                  Experience
                </label>
                <select
                  className="mt-2 w-full rounded-xl border border-[#e0dcd4] bg-white/80 px-3 py-2 text-[#5a4a3f]"
                  value={experienceId}
                  onChange={(e) => setExperienceId(e.target.value)}
                >
                  <option value="">All experiences</option>
                  {experiences.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name || `Experience ${x.id}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  setFrom("");
                  setTo("");
                  setExperienceId("");
                  setPreset("custom");
                }}
                className="inline-flex items-center gap-2 rounded-full border border-[#e5ddd4] bg-white px-4 py-2 text-[#6a5a50] hover:bg-[#f7f3ec]"
              >
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
              {/* <button
                onClick={() => {
                  const url = location.href;
                  copyToClipboard(url);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-[#d8cfc3] bg-white px-4 py-2 text-[#5a4a3f] hover:bg-[#f7f3ec]"
              >
                <Share2 className="h-4 w-4" /> Share view
              </button> */}
              <button
                onClick={exportCSV}
                className="inline-flex items-center gap-2 rounded-full border border-[#d8cfc3] bg-white px-4 py-2 text-[#5a4a3f] hover:bg-[#f7f3ec]"
              >
                <Download className="h-4 w-4" /> Export CSV
              </button>
              <button
                onClick={load}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-full border border-[#d8cfc3] bg-[#fdfaf5] px-4 py-2 text-[#5a4a3f] hover:bg-[#f1ede7]"
              >
                <Filter className="h-4 w-4" /> {loading ? "Loading…" : "Apply"}
              </button>
              <button
                onClick={load}
                className="inline-flex items-center gap-2 rounded-full bg-[#8b6f47] px-4 py-2 text-white hover:opacity-90"
              >
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
            </div>
          </div>
          {err ? (
            <p
              role="status"
              aria-live="polite"
              className="mt-3 flex items-start gap-2 text-sm text-[#b44d4d]"
            >
              <Info className="h-4 w-4 mt-0.5" /> {err}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-[#6d5c51]">
              <input
                type="checkbox"
                className="accent-[#8b6f47]"
                checked={compare}
                onChange={(e) => setCompare(e.target.checked)}
              />
              Compare to previous period
            </label>
            <div className="ml-auto flex items-center gap-2 text-xs text-[#6d5c51]">
              <span>Top chart revenue style</span>
              <div className="inline-grid grid-cols-2 rounded-full border border-[#e0dcd4] bg-[#fbf9f5] p-0.5">
                <button
                  className={cx(
                    "px-2 py-0.5 rounded-full",
                    revAsArea
                      ? "text-[#5a4a3f]/70"
                      : "bg-white text-[#5a4a3f] shadow"
                  )}
                  onClick={() => setRevAsArea(false)}
                >
                  Line
                </button>
                <button
                  className={cx(
                    "px-2 py-0.5 rounded-full",
                    revAsArea
                      ? "bg-white text-[#5a4a3f] shadow"
                      : "text-[#5a4a3f]/70"
                  )}
                  onClick={() => setRevAsArea(true)}
                >
                  Area
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 mb-8">
          <KPI
            title="Total Revenue"
            value={fmtCurrency(k.totalRevenue || 0)}
            delta={
              compare ? pctDelta(k.totalRevenue, kPrev.totalRevenue) : null
            }
            icon={<TrendingUp className="h-4 w-4" />}
            loading={loading}
          />
          <KPI
            title="Total Bookings"
            value={k.totalBookings ?? 0}
            delta={
              compare ? pctDelta(k.totalBookings, kPrev.totalBookings) : null
            }
            icon={<Users className="h-4 w-4" />}
            loading={loading}
          />
          <KPI
            title="Avg Order Value"
            value={fmtCurrency(k.avgOrderValue || 0)}
            delta={
              compare ? pctDelta(k.avgOrderValue, kPrev.avgOrderValue) : null
            }
            icon={<Sparkles className="h-4 w-4" />}
            loading={loading}
          />
          <KPI
            title="Occupancy"
            value={`${((k.occupancyRate || 0) * 100).toFixed(1)}%`}
            delta={
              compare ? pctDelta(k.occupancyRate, kPrev.occupancyRate) : null
            }
            icon={<Percent className="h-4 w-4" />}
            loading={loading}
          />
        </div>

        {/* Quick Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <InsightCard
            title="Top experience"
            value={topExp ? topExp.name : "–"}
            hint={
              topExp
                ? `${fmtCurrency(topExp.revenue)} · ${topExp.bookings} bookings`
                : "No data in range"
            }
          />
          <InsightCard
            title="Best day (revenue)"
            value={bestDay ? bestDay.date : "–"}
            hint={bestDay ? fmtCurrency(bestDay.revenue) : "No data in range"}
          />
          <InsightCard
            title="Draft → Booking"
            value={`${((k.conversionRate || 0) * 100).toFixed(1)}%`}
            hint={`${k.newCustomers ?? 0} new · ${
              k.returningCustomers ?? 0
            } returning`}
          />
        </div>

        {/* Charts grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Bookings & Revenue over time" loading={loading}>
            <ResponsiveContainer width="100%" height={300}>
              {!revAsArea ? (
                <LineChart data={series} margin={{ left: 8, right: 8, top: 8 }}>
                  <CartesianGrid
                    stroke={CHART_COLORS.grid}
                    strokeDasharray="3 3"
                  />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" tickFormatter={(v) => fmtCompact(v)} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(v) => fmtCurrency(v)}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="bookings"
                    yAxisId="left"
                    dot={false}
                    stroke={CHART_COLORS.bookings}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    yAxisId="right"
                    dot={false}
                    stroke={CHART_COLORS.revenue}
                    strokeWidth={2}
                  />
                </LineChart>
              ) : (
                <AreaChart data={series} margin={{ left: 8, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={CHART_COLORS.revenue}
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="100%"
                        stopColor={CHART_COLORS.revenue}
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke={CHART_COLORS.grid}
                    strokeDasharray="3 3"
                  />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" tickFormatter={(v) => fmtCompact(v)} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(v) => fmtCurrency(v)}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="bookings"
                    yAxisId="left"
                    dot={false}
                    stroke={CHART_COLORS.bookings}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    yAxisId="right"
                    dot={false}
                    stroke={CHART_COLORS.revenue}
                    fill="url(#revGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Status breakdown" loading={loading}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={95}
                  label
                  fill="#ccc"
                >
                  {pieData.map((entry, index) => (
                    <cell
                      // eslint-disable-next-line react/no-unknown-property
                      key={`slice-${index}`}
                      // eslint-disable-next-line react/no-unknown-property
                      fill={STATUS_COLORS[entry.name] || "#cbbba8"}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Occupancy over time" loading={loading}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart
                data={occupancySeries}
                margin={{ left: 8, right: 8, top: 8 }}
              >
                <CartesianGrid
                  stroke={CHART_COLORS.grid}
                  strokeDasharray="3 3"
                />
                <XAxis dataKey="date" />
                <YAxis
                  tickFormatter={(v) => `${Math.round(v * 100)}%`}
                  domain={[0, 1]}
                />
                <Tooltip content={<CustomPctTooltip />} />
                <Legend />
                <ReferenceLine
                  y={0.75}
                  stroke="#a18a71"
                  strokeDasharray="4 4"
                  label={{
                    value: "Target 75%",
                    position: "insideTopRight",
                    fill: "#6d5c51",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="occupancy"
                  fillOpacity={0.25}
                  stroke={CHART_COLORS.occupancy}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Top experiences"
            loading={loading}
            rightSlot={
              <div className="flex items-center gap-2 text-xs text-[#6d5c51]">
                <span>Metric</span>
                <div className="inline-grid grid-cols-2 rounded-full border border-[#e0dcd4] bg-[#fbf9f5] p-0.5">
                  <button
                    className={cx(
                      "px-2 py-0.5 rounded-full",
                      barMetric === "revenue"
                        ? "bg-white text-[#5a4a3f] shadow"
                        : "text-[#5a4a3f]/70"
                    )}
                    onClick={() => setBarMetric("revenue")}
                  >
                    Revenue
                  </button>
                  <button
                    className={cx(
                      "px-2 py-0.5 rounded-full",
                      barMetric === "bookings"
                        ? "bg-white text-[#5a4a3f] shadow"
                        : "text-[#5a4a3f]/70"
                    )}
                    onClick={() => setBarMetric("bookings")}
                  >
                    Bookings
                  </button>
                </div>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topExperiences}>
                <CartesianGrid
                  stroke={CHART_COLORS.grid}
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="name"
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tickFormatter={(v) =>
                    barMetric === "revenue" ? fmtCurrency(v) : v
                  }
                />
                <Tooltip
                  formatter={(v) =>
                    barMetric === "revenue" ? fmtCurrency(v) : v
                  }
                />
                <Legend />
                <Bar
                  dataKey={barMetric}
                  fill={
                    barMetric === "revenue"
                      ? CHART_COLORS.revenue
                      : CHART_COLORS.bookings
                  }
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {!loading && !series.length && !topExperiences.length ? (
          <div className="mt-10 rounded-2xl border border-[#e0dcd4] bg-white/70 p-8 text-center text-[#7a6a5f]">
            No data in this range. Try widening the dates or removing filters.
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------ subviews ------------------------------ */
function KPI({ title, value, icon, loading, delta }) {
  const color = !delta
    ? ""
    : delta > 0
    ? "text-[#2e7d32]"
    : delta < 0
    ? "text-[#b44d4d]"
    : "text-[#7a6a5f]";
  const Arrow = !delta
    ? null
    : delta > 0
    ? ArrowUpRight
    : delta < 0
    ? ArrowDownRight
    : null;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#d8cfc3] bg-gradient-to-b from-white/90 to-[#fdfaf7] p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#7a6a5f]">{title}</p>
        {icon ? <span className="text-[#8b6f47]">{icon}</span> : null}
      </div>
      {loading ? (
        <div className="mt-1 h-8 w-28 bg-[#e8e2d9] rounded animate-pulse" />
      ) : (
        <p className="mt-1 text-2xl font-semibold text-[#5a4a3f] tracking-tight">
          {value}
        </p>
      )}
      {typeof delta === "number" ? (
        <p className={cx("mt-1 text-xs flex items-center gap-1", color)}>
          {Arrow ? <Arrow className="h-3.5 w-3.5" /> : null}
          {Math.abs(delta).toFixed(1)}%
          <span className="text-[#927f72]">vs prev</span>
        </p>
      ) : null}
      {/* decorative */}
      <div className="pointer-events-none absolute -right-6 -bottom-6 h-24 w-24 rounded-full bg-[#fff1da] opacity-60 blur-2xl" />
    </div>
  );
}

function InsightCard({ title, value, hint }) {
  return (
    <div className="rounded-2xl border border-[#e0dcd4] bg-white/80 backdrop-blur p-5 shadow-sm">
      <p className="text-sm text-[#7a6a5f]">{title}</p>
      <p className="text-xl font-semibold text-[#5a4a3f] truncate mt-1">
        {value}
      </p>
      {hint ? <p className="text-xs text-[#8a7a6f] mt-1">{hint}</p> : null}
    </div>
  );
}

function ChartCard({ title, children, loading, rightSlot }) {
  return (
    <div className="relative rounded-2xl border border-[#e0dcd4] bg-white/80 backdrop-blur p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[#5a4a3f] text-base font-medium">{title}</h3>
        {rightSlot}
      </div>
      <div
        className={cx(
          "transition-opacity",
          loading ? "opacity-60" : "opacity-100"
        )}
      >
        {children}
      </div>
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="h-8 w-8 rounded-full border-2 border-[#e0dcd4] border-t-[#8b6f47] animate-spin" />
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------ tooltips ------------------------------ */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#eadfd4] bg-white px-3 py-2 text-xs text-[#5a4a3f] shadow">
      <div className="font-medium">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.color }}
          />
          <span className="capitalize">{p.name}:</span>
          <span>{p.name === "revenue" ? fmtCurrency(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

function CustomPctTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#eadfd4] bg-white px-3 py-2 text-xs text-[#5a4a3f] shadow">
      <div className="font-medium">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.color }}
          />
          <span className="capitalize">{p.name}:</span>
          <span>{`${Math.round(p.value * 100)}%`}</span>
        </div>
      ))}
    </div>
  );
}

function CustomPieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-[#eadfd4] bg-white px-3 py-2 text-xs text-[#5a4a3f] shadow">
      <div className="font-medium capitalize">{p?.name}</div>
      <div>Count: {p?.value}</div>
    </div>
  );
}

/* --------------------------- util: % change --------------------------- */
function pctDelta(curr, prev) {
  if (typeof curr !== "number" || typeof prev !== "number" || prev === 0)
    return null;
  const delta = ((curr - prev) / Math.abs(prev)) * 100;
  return delta;
}
