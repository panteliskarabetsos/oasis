"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar as CalendarIcon,
  Search as SearchIcon,
  Filter as FilterIcon,
  Download as DownloadIcon,
  RefreshCw,
  Eye,
  X as XIcon,
  CalendarClock,
  XCircle as XCircleIcon,
  Loader2,
  Copy,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ListFilter,
  SlidersHorizontal,
  Info,
  Plus,
  Trash2,
  CalendarDays,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
} from "lucide-react";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

/* ---------------------------- helpers ---------------------------- */
const LOCALE = "en-GB";
const TIMEZONE = "Europe/Athens";

const fmtDate = (d) =>
  d
    ? new Intl.DateTimeFormat(LOCALE, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: TIMEZONE,
      }).format(new Date(d))
    : "-";

const fmtMoney = (n) =>
  typeof n === "number"
    ? n.toLocaleString(LOCALE, { style: "currency", currency: "EUR" })
    : "-";

const cx = (...xs) => xs.filter(Boolean).join(" ");

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "pending", label: "Pending" },
  { value: "checked_in", label: "Checked-in" },
  { value: "no_show", label: "No-show" },
  { value: "cancelled", label: "Cancelled" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/* ------------------------------ Page ------------------------------ */
export default function ReservationsPage() {
  const router = useRouter();

  // Filters & state
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [experienceId, setExperienceId] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [experiences, setExperiences] = useState([]);

  // UI polish
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [density, setDensity] = useState("compact");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Actions state
  const [selected, setSelected] = useState(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [forceDelete, setForceDelete] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [slotLoading, setSlotLoading] = useState(false);
  const [slots, setSlots] = useState([]);
  const [slotFrom, setSlotFrom] = useState(() => today());
  const [slotTo, setSlotTo] = useState(() => plusDays(60));
  const [targetSlotId, setTargetSlotId] = useState("");

  const isPrivateBooking = (row) => !row?.scheduleSlotId;
  const safeExperienceName = (row) =>
    row?.experienceName || row?.customExperienceName || "Private booking";

  const controllerRef = useRef(null);
  const searchRef = useRef(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  );

  const activeFilterCount = useMemo(() => {
    return [status, from, to, experienceId, query.trim()].filter(Boolean)
      .length;
  }, [status, from, to, experienceId, query]);

  // Aggregate quick stats for current view (client-side)
  const viewStats = useMemo(() => {
    const s = {
      confirmed: 0,
      pending: 0,
      checked_in: 0,
      no_show: 0,
      cancelled: 0,
      total: 0,
      revenue: 0,
    };
    for (const r of rows) {
      const k = normalizeStatus(r.status);
      if (k in s) s[k] += 1;
      s.total += 1;

      const t = rowTotal(r);
      if (typeof t === "number" && ["confirmed", "checked_in"].includes(k)) {
        s.revenue += t;
      }
    }
    return s;
  }, [rows]);

  // Debounce query
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  // Keyboard shortcuts (UX)
  useEffect(() => {
    const onKey = (e) => {
      // Ignore shortcuts while typing in inputs
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key.toLowerCase() === "r" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        window.location.reload();
      } else if (e.key.toLowerCase() === "e" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onExportCSV();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows]);

  // Load experiences for filter
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/experiences?fields=id,name&limit=200`,
          {
            signal: ac.signal,
            cache: "no-store",
            credentials: "include",
          },
        );
        if (!res.ok) throw new Error("Failed to load experiences");
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : data;
        if (!ac.signal.aborted) setExperiences(items || []);
      } catch (e) {
        if (e?.name === "AbortError") return;
        console.warn("Failed to load experiences:", e);
      }
    })();
    return () => ac.abort();
  }, []);

  // Fetch reservations
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      controllerRef.current?.abort();
      controllerRef.current = new AbortController();

      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });

      if (debouncedQuery) {
        const raw = debouncedQuery.trim();
        const match = raw.match(/^#\s*(.+)$/);
        if (match && match[1]) {
          qs.set("code", match[1].trim());
        } else {
          qs.set("q", raw);
        }
      }

      if (status) qs.set("status", status);
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      if (experienceId) qs.set("experienceId", experienceId);

      try {
        const res = await fetch(`/api/admin/reservations?${qs.toString()}`, {
          signal: controllerRef.current.signal,
          cache: "no-store",
          credentials: "include",
        });

        if (!res.ok) {
          const msg =
            (await res.json().catch(() => ({})))?.error || "Failed to load";
          throw new Error(msg);
        }

        const data = await res.json();
        const items = data?.items || [];
        setRows(items);
        setTotal(Number(data?.total || items.length));
      } catch (e) {
        if (e?.name === "AbortError") return;
        setError(e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [debouncedQuery, status, from, to, experienceId, page, pageSize]);

  function resetFilters() {
    setQuery("");
    setStatus("");
    setFrom("");
    setTo("");
    setExperienceId("");
    setPage(1);
  }

  function quickRange(range) {
    const now = new Date();
    if (range === "today") {
      const s = toDateInput(now);
      setFrom(s);
      setTo(s);
    } else if (range === "7d") {
      setFrom(toDateInput(now));
      setTo(toDateInput(plusDaysFrom(now, 7)));
    } else if (range === "30d") {
      setFrom(toDateInput(now));
      setTo(toDateInput(plusDaysFrom(now, 30)));
    } else if (range === "month") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFrom(toDateInput(first));
      setTo(toDateInput(last));
    } else if (range === "all") {
      setFrom("");
      setTo("");
    }
    setPage(1);
  }

  function onExportCSV() {
    const headers = [
      "ID",
      "Code",
      "Date",
      "Experience",
      "Name",
      "Email",
      "Phone",
      "Adults",
      "Kids",
      "Total Paid",
      "Status",
      "Created At",
    ];

    const lines = rows.map((r) => [
      r.id,
      r.code || "",
      r.date || r.startTime || "",
      r.experienceName || "",
      r.guestName || "",
      r.guestEmail || "",
      r.guestPhone || "",
      r.adults ?? "",
      r.kids ?? "",
      rowTotal(r) ?? "",
      r.status || "",
      r.createdAt || "",
    ]);

    const csv = [headers, ...lines]
      .map((row) =>
        row.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reservations_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported current view as CSV");
  }

  // ---------------------------- Actions ----------------------------
  function openCancel(r) {
    setSelected(r);
    setCancelReason("");
    setShowCancel(true);
  }

  async function submitCancel() {
    if (!selected) return;
    try {
      const res = await fetch(`/api/admin/reservations/${selected.id}/cancel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: cancelReason }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error || "Cancel failed",
        );

      toast.success("Booking cancelled");
      setRows((cur) =>
        cur.map((r) =>
          r.id === selected.id ? { ...r, status: "cancelled" } : r,
        ),
      );
      setShowCancel(false);
      setSelected(null);
    } catch (e) {
      toast.error(e.message);
    }
  }

  function openReschedule(r) {
    setSelected(r);
    setShowReschedule(true);
    setTargetSlotId("");
    const base = r?.startTime ? new Date(r.startTime) : new Date();
    const fromStr = toDateInput(base);
    const toStr = toDateInput(plusDaysFrom(base, 60));
    setSlotFrom(fromStr);
    setSlotTo(toStr);
    loadSlots(r.experienceId, fromStr, toStr);
  }

  function openDelete(row) {
    setSelected(row);
    setDeleteError("");
    setForceDelete(row?.status !== "cancelled");
    setShowDelete(true);
  }

  async function submitDelete() {
    if (!selected?.id) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(
        `/api/admin/reservations/${selected.id}${forceDelete ? "?force=1" : ""}`,
        { method: "DELETE" },
      );
      const j = await safeJson(res);
      if (!res.ok) throw new Error(j?.error || "Failed to delete booking");

      setRows((prev) => prev.filter((x) => x.id !== selected.id));
      setTotal((t) => Math.max(0, t - 1));
      setShowDelete(false);
      toast.success("Booking deleted");
    } catch (e) {
      setDeleteError(e?.message || "Something went wrong while deleting");
    } finally {
      setDeleting(false);
    }
  }

  async function safeJson(res) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  async function loadSlots(expId, fromStr, toStr) {
    if (!expId) return setSlots([]);
    setSlotLoading(true);
    try {
      const qs = new URLSearchParams({ experienceId: String(expId) });
      if (fromStr) qs.set("from", fromStr);
      if (toStr) qs.set("to", toStr);
      const res = await fetch(`/api/admin/schedule/slots?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error || "Error loading slots",
        );
      const data = await res.json();
      setSlots(data?.items || []);
    } catch (e) {
      toast.error(e.message);
      setSlots([]);
    } finally {
      setSlotLoading(false);
    }
  }

  async function submitReschedule() {
    if (!selected || !targetSlotId) return toast.error("Choose a new slot");
    try {
      const res = await fetch(
        `/api/admin/reservations/${selected.id}/reschedule`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ scheduleSlotId: Number(targetSlotId) }),
        },
      );
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error || "Error rescheduling",
        );

      const payload = await res.json().catch(() => ({}));
      toast.success("Booking was rescheduled");
      setRows((cur) =>
        cur.map((r) =>
          r.id === selected.id
            ? { ...r, startTime: payload?.newStartTime || r.startTime }
            : r,
        ),
      );
      setShowReschedule(false);
      setSelected(null);
    } catch (e) {
      toast.error(e.message);
    }
  }

  function clearChip(type) {
    if (type === "status") setStatus("");
    if (type === "experience") setExperienceId("");
    if (type === "from") setFrom("");
    if (type === "to") setTo("");
    setPage(1);
  }

  function copy(text, label = "Copied!") {
    if (!text) return;
    navigator.clipboard
      ?.writeText(String(text))
      .then(() => toast.success(label));
  }

  const pad = density === "compact" ? "py-2.5" : "py-4";

  return (
    <div className="min-h-screen bg-[#fdfcfb] text-[#3f3127] selection:bg-[#8b6f47]/20 pb-24">
      {/* Ambient background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[10%] -left-[5%] w-[40%] h-[40%] rounded-full bg-[#8b6f47]/5 blur-[120px]" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[50%] rounded-full bg-[#e3ddd2]/30 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto px-4 sm:px-8 py-6 max-w-7xl">
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-md bg-[#8b6f47]/10 text-[#8b6f47] text-[10px] font-bold uppercase tracking-wider border border-[#8b6f47]/20">
                Operations
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif tracking-tight text-[#2a1f18]">
              Bookings
            </h1>
            <p className="text-[#7a6a5f] text-sm">
              Search, filter, and manage all reservations in one place.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ToolbarButton
              onClick={() => router.back()}
              icon={ArrowLeft}
              title="Back"
            >
              Back
            </ToolbarButton>
            <ToolbarButton
              onClick={() => window.location.reload()}
              icon={RefreshCw}
              title="Refresh (r)"
            />
            <ToolbarButton
              onClick={onExportCSV}
              icon={DownloadIcon}
              title="Export to CSV (e)"
            />
            <div className="h-8 w-[1px] bg-[#e3ddd2] mx-1 hidden sm:block" />
            <Link
              href="/admin/bookings/new"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1a1a1a] text-white hover:bg-[#333] transition-all shadow-lg shadow-black/10 text-sm font-semibold active:scale-95"
            >
              <Plus size={16} strokeWidth={3} />
              New Booking
            </Link>
          </div>
        </header>

        {/* KPI Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatPill
            label="Total Results"
            value={viewStats.total}
            icon={<ListFilter size={16} />}
          />
          <StatPill
            label="Confirmed"
            value={viewStats.confirmed}
            tone="green"
            icon={<CheckCircle2 size={16} />}
          />
          <StatPill
            label="Pending"
            value={viewStats.pending}
            tone="amber"
            icon={<Clock size={16} />}
          />
          <StatPill
            label="Revenue (View)"
            value={fmtMoney(viewStats.revenue)}
            tone="blue"
            icon={<CreditCard size={16} />}
          />
        </section>

        {/* Filters Card */}
        <div className="mb-6 rounded-2xl border border-[#e3ddd2] bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-[#e3ddd2] px-5 py-3.5 bg-[#fdfcfb]">
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#3f3127]"
            >
              <ListFilter className="h-4 w-4 text-[#8b6f47]" />
              <span>Filters</span>
              {!!activeFilterCount && (
                <span className="rounded-full bg-[#8b6f47] px-2 py-0.5 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                className={cx(
                  "h-4 w-4 transition-transform",
                  filtersOpen && "rotate-180",
                )}
              />
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAdvanced((s) => !s)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#e3ddd2] bg-white px-3 py-1.5 text-xs font-medium text-[#5a4a3f] shadow-sm hover:bg-[#fdfaf5] transition-colors"
              >
                {showAdvanced ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Advanced</span>
              </button>
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#e3ddd2] bg-white px-3 py-1.5 text-xs font-medium text-[#5a4a3f] shadow-sm hover:bg-[#fdfaf5] transition-colors"
              >
                <XIcon className="h-3.5 w-3.5" /> Clear
              </button>
            </div>
          </div>

          <AnimatePresence>
            {filtersOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 lg:grid-cols-6 border-b border-[#e3ddd2]">
                  {/* Search */}
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#a09084] mb-1.5 block">
                      Search
                    </label>
                    <div className="relative">
                      <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a09084]" />
                      <input
                        ref={searchRef}
                        className="w-full rounded-xl border border-[#e3ddd2] bg-[#fdfcfb] pl-9 pr-8 py-2.5 text-sm text-[#3f3127] placeholder:text-[#a09084] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30 transition-all shadow-sm"
                        placeholder="Name, email, code (e.g. #123) or '/' to focus"
                        value={query}
                        onChange={(e) => {
                          setPage(1);
                          setQuery(e.target.value);
                        }}
                        onKeyDown={(e) => e.key === "Escape" && setQuery("")}
                      />
                      {query && (
                        <button
                          onClick={() => setQuery("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 hover:bg-[#e3ddd2]/50 text-[#a09084]"
                        >
                          <XIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#a09084] mb-1.5 block">
                      Status
                    </label>
                    <select
                      className="w-full rounded-xl border border-[#e3ddd2] bg-[#fdfcfb] px-3 py-2.5 text-sm text-[#3f3127] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30 transition-all"
                      value={status}
                      onChange={(e) => {
                        setPage(1);
                        setStatus(e.target.value);
                      }}
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Experience */}
                  <div className="col-span-1 lg:col-span-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#a09084] mb-1.5 block">
                      Experience
                    </label>
                    <select
                      className="w-full rounded-xl border border-[#e3ddd2] bg-[#fdfcfb] px-3 py-2.5 text-sm text-[#3f3127] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30 transition-all"
                      value={experienceId}
                      onChange={(e) => {
                        setPage(1);
                        setExperienceId(e.target.value);
                      }}
                    >
                      <option value="">All Experiences</option>
                      {experiences?.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date From */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#a09084] mb-1.5">
                      From <CalendarIcon className="h-3 w-3" />
                    </label>
                    <input
                      type="date"
                      className="w-full rounded-xl border border-[#e3ddd2] bg-[#fdfcfb] px-3 py-2.5 text-sm text-[#3f3127] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30 transition-all"
                      value={from}
                      onChange={(e) => {
                        setPage(1);
                        setFrom(e.target.value);
                      }}
                    />
                  </div>

                  {/* Date To */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#a09084] mb-1.5">
                      To <CalendarIcon className="h-3 w-3" />
                    </label>
                    <input
                      type="date"
                      className="w-full rounded-xl border border-[#e3ddd2] bg-[#fdfcfb] px-3 py-2.5 text-sm text-[#3f3127] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30 transition-all"
                      value={to}
                      onChange={(e) => {
                        setPage(1);
                        setTo(e.target.value);
                      }}
                    />
                  </div>
                </div>

                {/* Advanced row */}
                {showAdvanced && (
                  <div className="bg-[#fcfbf9] px-5 py-4 border-b border-[#e3ddd2]">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#a09084]">
                        Quick Ranges:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <QuickRange
                          onClick={quickRange}
                          label="Today"
                          value="today"
                        />
                        <QuickRange
                          onClick={quickRange}
                          label="+7 days"
                          value="7d"
                        />
                        <QuickRange
                          onClick={quickRange}
                          label="+30 days"
                          value="30d"
                        />
                        <QuickRange
                          onClick={quickRange}
                          label="This month"
                          value="month"
                        />
                        <QuickRange
                          onClick={quickRange}
                          label="All time"
                          value="all"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Active filter chips */}
                {!!activeFilterCount && (
                  <div className="flex flex-wrap items-center gap-2 px-5 py-3 bg-white">
                    {status && (
                      <Chip onClear={() => clearChip("status")}>
                        Status:{" "}
                        <strong className="ml-1">{labelStatus(status)}</strong>
                      </Chip>
                    )}
                    {experienceId && (
                      <Chip onClear={() => clearChip("experience")}>
                        Exp:{" "}
                        <strong className="ml-1">
                          {experiences.find(
                            (x) => String(x.id) === String(experienceId),
                          )?.name || experienceId}
                        </strong>
                      </Chip>
                    )}
                    {from && (
                      <Chip onClear={() => clearChip("from")}>
                        From: <strong className="ml-1">{from}</strong>
                      </Chip>
                    )}
                    {to && (
                      <Chip onClear={() => clearChip("to")}>
                        To: <strong className="ml-1">{to}</strong>
                      </Chip>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Table Card */}
        <div className="rounded-2xl border border-[#e3ddd2] bg-white shadow-sm overflow-hidden flex flex-col">
          {/* Table Header Controls */}
          <div className="flex flex-col gap-3 border-b border-[#e3ddd2] bg-[#fdfcfb] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div
              className="text-xs font-semibold uppercase tracking-wider text-[#7a6a5f]"
              aria-live="polite"
            >
              {error ? (
                <span className="text-red-600 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> {error}
                </span>
              ) : (
                <span>
                  Showing{" "}
                  <span className="text-[#3f3127]">
                    {rows.length ? (page - 1) * pageSize + 1 : 0} –{" "}
                    {Math.min(page * pageSize, total)}
                  </span>{" "}
                  of {total}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-1 rounded-lg border border-[#e3ddd2] bg-[#fdfcfb] p-1">
                <button
                  onClick={() => setDensity("cozy")}
                  className={cx(
                    "rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors",
                    density === "cozy"
                      ? "bg-[#3f3127] text-white shadow-sm"
                      : "text-[#7a6a5f] hover:bg-[#f5f1ea]",
                  )}
                >
                  Cozy
                </button>
                <button
                  onClick={() => setDensity("compact")}
                  className={cx(
                    "rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors",
                    density === "compact"
                      ? "bg-[#3f3127] text-white shadow-sm"
                      : "text-[#7a6a5f] hover:bg-[#f5f1ea]",
                  )}
                >
                  Compact
                </button>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-[#7a6a5f]">
                  Per page:
                </label>
                <select
                  className="rounded-lg border border-[#e3ddd2] bg-white px-2 py-1.5 text-xs text-[#3f3127] font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="relative overflow-x-auto min-h-[400px]">
            {loading && rows.length > 0 && (
              <div className="absolute inset-0 z-20 bg-white/50 backdrop-blur-[2px] flex items-start justify-center pt-20">
                <div className="bg-white border border-[#e3ddd2] rounded-full px-4 py-2 shadow-lg flex items-center gap-2 text-sm font-medium text-[#3f3127]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#8b6f47]" />{" "}
                  Updating...
                </div>
              </div>
            )}

            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="sticky top-0 z-10 bg-[#fdfaf5] text-[#a09084] border-b border-[#e3ddd2] shadow-[0_1px_0_rgba(0,0,0,0.02)]">
                <tr>
                  <Th className="pl-6 w-[130px]">Code</Th>
                  <Th>Date & Time</Th>
                  <Th>Experience</Th>
                  <Th>Client Details</Th>
                  <Th className="text-center">Guests</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Status</Th>
                  <Th className="text-right pr-6 w-[160px]">Actions</Th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#e3ddd2]/60">
                {loading && rows.length === 0 && (
                  <SkeletonRows columns={8} rows={10} />
                )}

                {!loading && rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-16 text-center bg-[#fdfcfb]"
                    >
                      <div className="w-16 h-16 bg-[#fdfaf5] border border-[#e3ddd2] rounded-full flex items-center justify-center mx-auto mb-4 text-[#c5b9aa]">
                        <SearchIcon size={24} />
                      </div>
                      <h3 className="text-lg font-serif text-[#3f3127] mb-1">
                        No bookings found
                      </h3>
                      <p className="text-sm text-[#7a6a5f] mb-6">
                        Try adjusting your filters or search query.
                      </p>
                      <button
                        onClick={resetFilters}
                        className="inline-flex items-center gap-2 rounded-full border border-[#e3ddd2] bg-white px-5 py-2.5 text-sm font-medium text-[#3f3127] shadow-sm hover:bg-[#fdfaf5] transition-colors"
                      >
                        <FilterIcon className="h-4 w-4" /> Clear all filters
                      </button>
                    </td>
                  </tr>
                )}

                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() =>
                      window.open(`/admin/bookings/${r.id}`, "_self")
                    }
                    className={cx(
                      "group cursor-pointer transition-colors even:bg-[#fcfbf9] hover:bg-[#fdfaf5]",
                      r.status === "cancelled" && "opacity-60",
                    )}
                  >
                    <Td
                      className={cx(
                        pad,
                        "pl-6 font-mono text-xs font-semibold text-[#5a4a3f]",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate" title={r.code || r.id}>
                          {r.code || r.id}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copy(r.code || r.id, "Booking code copied");
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-[#e3ddd2] text-[#a09084] transition-all"
                          title="Copy Code"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </Td>

                    <Td className={pad}>
                      <span className="text-[#3f3127] font-medium">
                        {fmtDate(r.startTime || r.date)}
                      </span>
                    </Td>

                    <Td className={pad + " max-w-[240px] truncate"}>
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="truncate font-medium text-[#3f3127]"
                          title={safeExperienceName(r)}
                        >
                          {safeExperienceName(r)}
                        </span>
                        {isPrivateBooking(r) && (
                          <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
                            Private
                          </span>
                        )}
                      </div>
                    </Td>

                    <Td className={pad}>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-[#3f3127]">
                          {r.guestName}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-[#7a6a5f]">
                          {r.guestEmail && (
                            <a
                              href={`mailto:${r.guestEmail}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-[#8b6f47] hover:underline truncate max-w-[120px]"
                            >
                              {r.guestEmail}
                            </a>
                          )}
                          {r.guestPhone && (
                            <>
                              <span className="text-[#d8cfc3]">•</span>
                              <a
                                href={`tel:${r.guestPhone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="hover:text-[#8b6f47] hover:underline truncate"
                              >
                                {r.guestPhone}
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </Td>

                    <Td className={pad + " text-center tabular-nums"}>
                      {(() => {
                        const a =
                          typeof r.adults === "number" ? r.adults : null;
                        const k = typeof r.kids === "number" ? r.kids : null;
                        if (a !== null || k !== null) {
                          return (
                            <div className="inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded-md bg-[#fdfcfb] border border-[#e3ddd2] text-xs font-semibold text-[#3f3127]">
                              <Users size={12} className="text-[#a09084]" />
                              {a ?? 0}{" "}
                              {k !== null ? (
                                <span className="text-[#a09084]">+ {k}</span>
                              ) : null}
                            </div>
                          );
                        }
                        const total =
                          typeof r.numberOfPeople === "number"
                            ? r.numberOfPeople
                            : 0;
                        return (
                          <span className="font-medium text-[#3f3127]">
                            {total}
                          </span>
                        );
                      })()}
                    </Td>

                    <Td
                      className={
                        pad +
                        " text-right tabular-nums font-semibold text-[#3f3127]"
                      }
                    >
                      {fmtMoney(rowTotal(r))}
                    </Td>

                    <Td className={pad}>
                      <StatusBadge status={r.status} />
                    </Td>

                    <Td className={cx(pad, "pr-6 text-right")}>
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <IconButton
                          onClick={() =>
                            window.open(`/admin/bookings/${r.id}`, "_self")
                          }
                          title="View Booking"
                        >
                          <Eye size={16} />
                        </IconButton>

                        {r.status !== "cancelled" && !isPrivateBooking(r) && (
                          <IconButton
                            onClick={() => openReschedule(r)}
                            title="Reschedule"
                            tone="amber"
                          >
                            <CalendarClock size={16} />
                          </IconButton>
                        )}

                        {r.status !== "cancelled" && (
                          <IconButton
                            onClick={() => openCancel(r)}
                            title="Cancel Booking"
                            tone="red"
                          >
                            <XCircleIcon size={16} />
                          </IconButton>
                        )}

                        {r.status === "cancelled" && (
                          <IconButton
                            onClick={() => openDelete(r)}
                            title="Permanently Delete"
                            tone="red"
                            className={
                              deletingId === r.id
                                ? "opacity-50 cursor-wait"
                                : ""
                            }
                          >
                            {deletingId === r.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </IconButton>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Footer */}
          <div className="flex flex-col gap-3 border-t border-[#e3ddd2] bg-[#fdfcfb] p-4 md:flex-row md:items-center md:justify-between">
            <div className="text-xs font-medium uppercase tracking-wider text-[#a09084]">
              Page <strong className="text-[#3f3127] mx-1">{page}</strong> of{" "}
              {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-4 py-2 rounded-xl border border-[#e3ddd2] bg-white text-xs font-semibold text-[#3f3127] shadow-sm hover:bg-[#fdfaf5] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-4 py-2 rounded-xl border border-[#e3ddd2] bg-white text-xs font-semibold text-[#3f3127] shadow-sm hover:bg-[#fdfaf5] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* --- MODALS --- */}

        {showCancel && (
          <Modal onClose={() => setShowCancel(false)} title="Cancel Booking">
            <div className="space-y-5">
              {selected && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 leading-relaxed">
                  Booking{" "}
                  <span className="font-mono font-bold">
                    {selected.code || selected.id}
                  </span>{" "}
                  for <span className="font-bold">{selected.guestName}</span> on{" "}
                  {fmtDate(selected.startTime)} will be cancelled.
                </div>
              )}
              <p className="text-sm text-[#7a6a5f]">
                Are you sure you want to cancel? This action cannot be undone.
              </p>
              <label className="block text-sm">
                <span className="text-[#3f3127] font-semibold mb-1.5 block">
                  Reason (Optional)
                </span>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full rounded-xl border border-[#e3ddd2] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 shadow-sm"
                  rows={3}
                  placeholder="e.g. customer requested cancellation via email"
                />
              </label>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  className="rounded-full border border-[#e3ddd2] px-6 py-2.5 text-sm font-semibold hover:bg-[#fdfaf5] transition-colors"
                  onClick={() => setShowCancel(false)}
                >
                  Keep Booking
                </button>
                <button
                  className="rounded-full bg-red-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-red-700 shadow-md transition-colors"
                  onClick={submitCancel}
                >
                  Yes, Cancel
                </button>
              </div>
            </div>
          </Modal>
        )}

        {showDelete && selected && (
          <Modal onClose={() => setShowDelete(false)} title="Delete Booking">
            <div className="space-y-5">
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 leading-relaxed">
                This will permanently delete booking{" "}
                <span className="font-mono font-bold">
                  {selected.code || selected.id}
                </span>{" "}
                for{" "}
                <span className="font-bold">{selected.guestName || "-"}</span>.
                This action is irreversible.
              </div>

              {selected.status !== "cancelled" && (
                <label className="flex items-center gap-3 p-3 border border-[#e3ddd2] rounded-xl cursor-pointer hover:bg-[#fdfaf5]">
                  <input
                    type="checkbox"
                    checked={forceDelete}
                    onChange={(e) => setForceDelete(e.target.checked)}
                    className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                  />
                  <span className="text-sm text-[#3f3127]">
                    Force delete (Currently{" "}
                    <strong>{labelStatus(selected.status)}</strong>)
                  </span>
                </label>
              )}

              {!!deleteError && (
                <div className="rounded-xl border border-red-200 bg-white p-3 text-sm text-red-600 font-medium flex items-center gap-2">
                  <AlertTriangle size={16} /> {deleteError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  className="rounded-full border border-[#e3ddd2] px-6 py-2.5 text-sm font-semibold hover:bg-[#fdfaf5] transition-colors"
                  onClick={() => setShowDelete(false)}
                  disabled={deleting}
                >
                  Close
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-red-700 shadow-md transition-colors disabled:opacity-60"
                  onClick={submitDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {deleting ? "Deleting…" : "Delete Forever"}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {showReschedule && (
          <Modal
            onClose={() => setShowReschedule(false)}
            title="Reschedule Booking"
          >
            <div className="space-y-5">
              {selected && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 leading-relaxed">
                  Moving booking{" "}
                  <span className="font-mono font-bold">
                    {selected.code || selected.id}
                  </span>{" "}
                  for <span className="font-bold">{selected.guestName}</span>.
                  <br />
                  <span className="text-amber-700/80">
                    Current: {fmtDate(selected.startTime)}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-5 p-4 bg-[#fdfcfb] border border-[#e3ddd2] rounded-xl">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#a09084] mb-1.5 block">
                    Look From
                  </label>
                  <input
                    type="date"
                    value={slotFrom}
                    onChange={(e) => setSlotFrom(e.target.value)}
                    className="w-full rounded-lg border border-[#e3ddd2] p-2 text-sm focus:ring-2 focus:ring-[#8b6f47]/30 outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#a09084] mb-1.5 block">
                    Look To
                  </label>
                  <input
                    type="date"
                    value={slotTo}
                    onChange={(e) => setSlotTo(e.target.value)}
                    className="w-full rounded-lg border border-[#e3ddd2] p-2 text-sm focus:ring-2 focus:ring-[#8b6f47]/30 outline-none"
                  />
                </div>
                <div className="sm:col-span-1 flex items-end">
                  <button
                    onClick={() =>
                      loadSlots(selected?.experienceId, slotFrom, slotTo)
                    }
                    className="w-full rounded-lg bg-white border border-[#e3ddd2] p-2 text-sm font-semibold hover:bg-[#fdfaf5] shadow-sm"
                  >
                    <SearchIcon size={18} className="mx-auto text-[#8b6f47]" />
                  </button>
                </div>
              </div>

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#a09084] mb-1.5 block">
                  Select New Slot
                </span>
                <select
                  value={targetSlotId}
                  onChange={(e) => setTargetSlotId(e.target.value)}
                  className="w-full rounded-xl border border-[#e3ddd2] p-3 text-sm focus:ring-2 focus:ring-[#8b6f47]/30 outline-none shadow-sm bg-white"
                >
                  <option value="">— Select Available Slot —</option>
                  {slotLoading ? (
                    <option value="" disabled>
                      Searching calendar…
                    </option>
                  ) : (
                    slots.map((s) => (
                      <option
                        key={s.id}
                        value={s.id}
                        disabled={s.available <= 0}
                      >
                        {labelSlot(s)}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  className="rounded-full border border-[#e3ddd2] px-6 py-2.5 text-sm font-semibold hover:bg-[#fdfaf5] transition-colors"
                  onClick={() => setShowReschedule(false)}
                >
                  Cancel
                </button>
                <button
                  className="rounded-full bg-amber-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 shadow-md transition-colors"
                  onClick={submitReschedule}
                >
                  Confirm Reschedule
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- Subcomponents ---------------------------- */

function StatPill({ label, value, tone, icon }) {
  const tones = {
    green: "bg-emerald-50 border-emerald-100 text-emerald-900",
    amber: "bg-amber-50 border-amber-100 text-amber-900",
    blue: "bg-sky-50 border-sky-100 text-sky-900",
    default: "bg-white border-[#e3ddd2] text-[#3f3127]",
  };
  const iconColors = {
    green: "text-emerald-500",
    amber: "text-amber-500",
    blue: "text-sky-500",
    default: "text-[#8b6f47]",
  };

  return (
    <div
      className={cx(
        "rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md flex flex-col justify-between",
        tones[tone] || tones.default,
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">
          {label}
        </span>
        <div className={iconColors[tone] || iconColors.default}>{icon}</div>
      </div>
      <p className="text-3xl font-serif">{String(value)}</p>
    </div>
  );
}

function Th({ children, className = "" }) {
  return (
    <th
      className={cx(
        "px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider text-[#a09084]",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }) {
  return <td className={cx("px-4 align-middle", className)}>{children}</td>;
}

function IconButton({ children, onClick, title, tone, className }) {
  const tones = {
    red: "text-red-500 hover:bg-red-50 border-transparent hover:border-red-200",
    amber:
      "text-amber-500 hover:bg-amber-50 border-transparent hover:border-amber-200",
    default:
      "text-[#7a6a5f] hover:bg-[#fdfaf5] border-transparent hover:border-[#e3ddd2]",
  };
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={cx(
        "p-2 rounded-xl border transition-all duration-200",
        tones[tone] || tones.default,
        className,
      )}
      title={title}
    >
      {children}
    </button>
  );
}

function SkeletonRows({ rows = 8, columns = 8 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="animate-pulse border-b border-[#e3ddd2]/40">
          {Array.from({ length: columns }).map((__, j) => (
            <td key={j} className="px-4 py-4">
              <div className="h-4 w-full max-w-[140px] rounded-md bg-[#e3ddd2]/40" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function StatusBadge({ status }) {
  const k = normalizeStatus(status);
  const cls =
    {
      confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
      pending: "bg-amber-50 text-amber-700 border-amber-200",
      checked_in: "bg-indigo-50 text-indigo-700 border-indigo-200",
      no_show: "bg-orange-50 text-orange-700 border-orange-200",
      cancelled: "bg-red-50 text-red-700 border-red-200",
    }[k] || "bg-gray-50 text-gray-700 border-gray-200";

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        cls,
      )}
    >
      {labelStatus(k)}
    </span>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-[2rem] bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-[#e3ddd2] px-6 py-5 bg-[#fdfcfb]">
          <h3 className="text-xl font-serif text-[#2a1f18]">{title}</h3>
          <button
            className="rounded-full p-2 hover:bg-[#e3ddd2]/50 text-[#7a6a5f] transition-colors"
            onClick={onClose}
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}

function ToolbarButton({ icon: Icon, children, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-2 rounded-xl border border-[#e3ddd2] bg-white px-3.5 py-2 text-sm font-semibold text-[#5a4a3f] shadow-sm hover:bg-[#fdfaf5] transition-colors"
    >
      <Icon className="h-4 w-4 text-[#8b6f47]" />{" "}
      <span className="hidden sm:inline">{children}</span>
    </button>
  );
}

function Chip({ children, onClear }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#e3ddd2] bg-[#fdfcfb] px-3 py-1.5 text-xs text-[#5a4a3f] shadow-sm">
      {children}
      <button
        onClick={onClear}
        className="ml-1 rounded-md p-0.5 text-[#a09084] hover:bg-[#e3ddd2] hover:text-[#3f3127] transition-colors"
      >
        <XIcon className="h-3 w-3" />
      </button>
    </span>
  );
}

function QuickRange({ label, value, onClick }) {
  return (
    <button
      onClick={() => onClick(value)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#e3ddd2] bg-white px-3 py-1.5 text-xs font-semibold text-[#5a4a3f] shadow-sm hover:bg-[#fdfcfb] hover:text-[#8b6f47] transition-colors"
    >
      <SlidersHorizontal className="h-3 w-3 opacity-60" />
      {label}
    </button>
  );
}

/* ------------------------------ Utils ------------------------------ */

function isNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}
function rowTotal(r) {
  return isNum(r.totalPaidAmount)
    ? r.totalPaidAmount
    : isNum(r.totalAmount)
      ? r.totalAmount
      : isNum(r.money?.totalPaidAmount)
        ? r.money.totalPaidAmount
        : isNum(r.money?.totalAmount)
          ? r.money.totalAmount
          : null;
}

function normalizeStatus(s) {
  const v = String(s || "")
    .toLowerCase()
    .trim();
  if (
    [
      "confirmed",
      "paid",
      "approved",
      "converted",
      "completed",
      "success",
      "ok",
    ].includes(v)
  )
    return "confirmed";
  if (
    [
      "pending",
      "processing",
      "awaiting_payment",
      "hold",
      "held",
      "unpaid",
    ].includes(v)
  )
    return "pending";
  if (["checked_in", "checkin", "checkedin"].includes(v)) return "checked_in";
  if (["no_show", "noshow", "no-show", "no_showed"].includes(v))
    return "no_show";
  if (["cancelled", "canceled", "refunded", "void"].includes(v))
    return "cancelled";
  return v || "";
}

function labelStatus(status) {
  const k = normalizeStatus(status);
  return (
    {
      confirmed: "Confirmed",
      pending: "Pending",
      checked_in: "Checked-in",
      no_show: "No-show",
      cancelled: "Cancelled",
    }[k] || (status ? String(status) : "-")
  );
}

function today() {
  return toDateInput(new Date());
}
function plusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateInput(d);
}
function plusDaysFrom(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return toDateInput(d);
}
function toDateInput(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function labelSlot(s) {
  const dt = fmtDate(s.date);
  const name = s.experienceName ? ` — ${s.experienceName}` : "";
  const avail =
    typeof s.available === "number" ? ` • Available: ${s.available}` : "";
  return `${dt}${name}${avail}`;
}
