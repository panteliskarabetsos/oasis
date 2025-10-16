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
} from "lucide-react";
import { toast } from "react-hot-toast";
import Link from "next/link";
/* ------------------------------------------------------------------
   Visual refresh goals
   - Softer, more consistent cards and spacing
   - Cleaner filters with mobile drawer + advanced section
   - Subtle stat bar with total/paid/pending for the current result set
   - Sticky table header, zebra rows, focus rings, better empty/skeleton
   - Action buttons with tooltips and accessible labels
   - Keeps ALL your data & fetch logic as-is
------------------------------------------------------------------- */

/* ---------------------------- helpers ---------------------------- */
const LOCALE = "en-GB"; // UI in English; keep EUR
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
  { value: "paid" || "Paid", label: "Paid" },
  { value: "confirmed", label: "Confirmed" },
  { value: "pending", label: "Pending" },
  { value: "cancelled", label: "Cancelled" },
  { value: "draft", label: "Drafts" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/* ------------------------------ Page ------------------------------ */
export default function ReservationsPage() {
  const router = useRouter();

  // Filters & state
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState(""); // YYYY-MM-DD
  const [to, setTo] = useState(""); // YYYY-MM-DD
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
  const [density, setDensity] = useState("compact"); // "cozy" | "compact"
  const [filtersOpen, setFiltersOpen] = useState(false); // mobile drawer

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
  const isPrivateBooking = (row) => !row?.scheduleSlotId; // no slot => private
  const safeExperienceName = (row) =>
    row?.experienceName || row?.customExperienceName || "Private booking";

  const controllerRef = useRef(null);
  const searchRef = useRef(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  const activeFilterCount = useMemo(() => {
    return [status, from, to, experienceId, query.trim()].filter(Boolean)
      .length;
  }, [status, from, to, experienceId, query]);

  // Aggregate quick stats for current view (client-side)
  const viewStats = useMemo(() => {
    const s = {
      paid: 0,
      pending: 0,
      cancelled: 0,
      draft: 0,
      total: 0,
      revenue: 0,
    };
    for (const r of rows) {
      const k = normalizeStatus(r.status);
      if (k in s) s[k] += 1;
      s.total += 1;
      const t = rowTotal(r);
      if (typeof t === "number" && k !== "cancelled") s.revenue += t;
    }
    return s;
  }, [rows]);

  // Debounce query
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  // Keyboard shortcuts (UX): "/" focus search, "r" refresh, "e" export
  useEffect(() => {
    const onKey = (e) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  // Load experiences for filter (runs once; non-blocking)
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
          }
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
      if (debouncedQuery) qs.set("q", debouncedQuery);
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
        if (e?.name === "AbortError") return; // ignore aborted fetches
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
      r.totalPaidAmount ?? r.totalAmount ?? "",
      r.status || "",
      r.createdAt || "",
    ]);

    const csv = [headers, ...lines]
      .map((row) =>
        row.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")
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
      if (!res.ok) {
        const msg =
          (await res.json().catch(() => ({})))?.error || "Cancel failed";
        throw new Error(msg);
      }
      toast.success("Booking cancelled");
      setRows((cur) =>
        cur.map((r) =>
          r.id === selected.id ? { ...r, status: "cancelled" } : r
        )
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
    // preset date window around today or the current reservation date
    const base = r?.startTime ? new Date(r.startTime) : new Date();
    const fromStr = toDateInput(base);
    const toStr = toDateInput(plusDaysFrom(base, 60));
    setSlotFrom(fromStr);
    setSlotTo(toStr);
    loadSlots(r.experienceId, fromStr, toStr);
  }
  function openDelete(row) {
    setSelected(row); // reuse your existing `selected` state
    setDeleteError("");
    setForceDelete(row?.status !== "cancelled"); // default force if not cancelled
    setShowDelete(true);
  }

  // submit
  async function submitDelete() {
    if (!selected?.id) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(
        `/api/admin/reservations/${selected.id}${
          forceDelete ? "?force=1" : ""
        }`,
        { method: "DELETE" }
      );
      const j = await safeJson(res);
      if (!res.ok) throw new Error(j?.error || "Failed to delete booking");

      // optimistic remove
      setRows((prev) => prev.filter((x) => x.id !== selected.id));
      setTotal((t) => Math.max(0, t - 1));
      setShowDelete(false);
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
          (await res.json().catch(() => ({})))?.error || "Error loading slots"
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
        }
      );
      if (!res.ok) {
        const msg =
          (await res.json().catch(() => ({})))?.error || "Error rescheduling";
        throw new Error(msg);
      }
      const payload = await res.json().catch(() => ({}));
      const newStartTime = payload?.newStartTime;
      toast.success("Booking was rescheduled");
      setRows((cur) =>
        cur.map((r) =>
          r.id === selected.id
            ? { ...r, startTime: newStartTime || r.startTime }
            : r
        )
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

  const pad = density === "compact" ? "py-2" : "py-3";

  return (
    <div className="min-h-screen rounded-3xl bg-[radial-gradient(35%_50%_at_0%_0%,#f7f5f2,transparent),radial-gradient(35%_50%_at_100%_0%,#f3efe9,transparent)]">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#2f261f]">
              Bookings
            </h1>
            <p className="text-sm text-[#7b6a5f]">
              Manage your bookings for all the experiences.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ToolbarButton onClick={() => router.back()} icon={ArrowLeft}>
              Back
            </ToolbarButton>

            <ToolbarButton
              onClick={() => window.location.reload()}
              icon={RefreshCw}
            >
              Refresh
            </ToolbarButton>

            <ToolbarButton onClick={onExportCSV} icon={DownloadIcon}>
              Export CSV
            </ToolbarButton>

            <Link
              href="/admin/bookings/new"
              className="ml-auto inline-flex items-center gap-2 rounded-full border border-transparent bg-[#a3845b] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#b79266]"
            >
              <Plus className="h-4 w-4" />
              Add booking
            </Link>
          </div>
        </div>

        {/* Stat bar (current view) */}
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatPill label="Results" value={viewStats.total} />
          <StatPill label="Paid" value={viewStats.paid} tone="green" />

          <StatPill label="Pending" value={viewStats.pending} tone="amber" />
          <StatPill
            label="Revenue (view)"
            value={fmtMoney(viewStats.revenue)}
          />
        </div>

        {/* Filters Card */}
        <div className="mb-4 rounded-2xl border bg-white/80 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-neutral-700">
              <ListFilter className="h-4 w-4" /> Filters
              {!!activeFilterCount && (
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
                  {activeFilterCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAdvanced((s) => !s)}
                className="inline-flex items-center gap-1 rounded-xl border bg-white px-3 py-1.5 text-xs shadow-sm hover:bg-neutral-50"
              >
                {showAdvanced ? (
                  <>
                    <ChevronUp className="h-4 w-4" /> Close
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" /> Advanced
                  </>
                )}
              </button>
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-1.5 text-xs shadow-sm hover:bg-neutral-50"
              >
                <FilterIcon className="h-4 w-4" /> Clear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 lg:grid-cols-6">
            {/* search */}
            <div className="col-span-2">
              <label className="text-xs text-[#6e5e54]">Search</label>
              <div className="relative mt-1">
                <SearchIcon className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  ref={searchRef}
                  className="w-full rounded-xl border bg-white px-8 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-[#d9c6b8]"
                  placeholder="Name, email, phone or booking code… (/ to focus)"
                  value={query}
                  onChange={(e) => {
                    setPage(1);
                    setQuery(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setQuery("");
                  }}
                  aria-label="Search bookings"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-neutral-100"
                    aria-label="Clear search"
                  >
                    <XIcon className="h-4 w-4 text-neutral-500" />
                  </button>
                )}
              </div>
              {/* Quick status chips */}
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { v: "", l: "All" },
                  { v: "paid", l: "Paid" },
                  { v: "confirmed", l: "Confirmed" },
                  { v: "pending", l: "Pending" },
                  { v: "cancelled", l: "Cancelled" },
                  { v: "draft", l: "Drafts" },
                ].map((o) => (
                  <button
                    key={o.v}
                    onClick={() => {
                      setStatus(o.v);
                      setPage(1);
                    }}
                    className={cx(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition",
                      status === o.v
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "bg-white hover:bg-neutral-50"
                    )}
                    aria-pressed={status === o.v}
                  >
                    <span>{o.l}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* status */}
            <div>
              <label className="text-xs text-[#6e5e54]">Status</label>
              <select
                className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
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

            {/* experience */}
            <div>
              <label className="text-xs text-[#6e5e54]">Experience</label>
              <select
                className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                value={experienceId}
                onChange={(e) => {
                  setPage(1);
                  setExperienceId(e.target.value);
                }}
              >
                <option value="">All</option>
                {experiences?.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </div>

            {/* from */}
            <div>
              <label className="flex items-center gap-1 text-xs text-[#6e5e54]">
                From <CalendarIcon className="h-3 w-3" />
              </label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                value={from}
                onChange={(e) => {
                  setPage(1);
                  setFrom(e.target.value);
                }}
              />
            </div>

            {/* to */}
            <div>
              <label className="flex items-center gap-1 text-xs text-[#6e5e54]">
                To <CalendarIcon className="h-3 w-3" />
              </label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-neutral-600">Quick ranges:</span>
                <QuickRange onClick={quickRange} label="Today" value="today" />
                <QuickRange onClick={quickRange} label="+7 days" value="7d" />
                <QuickRange onClick={quickRange} label="+30 days" value="30d" />
                <QuickRange
                  onClick={quickRange}
                  label="This month"
                  value="month"
                />
                <QuickRange onClick={quickRange} label="All time" value="all" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-600">Row density</span>
                <button
                  onClick={() => setDensity("cozy")}
                  className={cx(
                    "rounded-full px-3 py-1 text-xs",
                    density === "cozy"
                      ? "border border-neutral-900 bg-neutral-900 text-white"
                      : "border bg-white"
                  )}
                >
                  Cozy
                </button>
                <button
                  onClick={() => setDensity("compact")}
                  className={cx(
                    "rounded-full px-3 py-1 text-xs",
                    density === "compact"
                      ? "border border-neutral-900 bg-neutral-900 text-white"
                      : "border bg-white"
                  )}
                >
                  Compact
                </button>
              </div>
            </div>
          )}

          {/* Active filter chips */}
          {!!activeFilterCount && (
            <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
              {status && (
                <Chip onClear={() => clearChip("status")}>
                  Status:{" "}
                  <strong className="ml-1">{labelStatus(status)}</strong>
                </Chip>
              )}
              {experienceId && (
                <Chip onClear={() => clearChip("experience")}>
                  Experience:{" "}
                  <strong className="ml-1">
                    {experiences.find(
                      (x) => String(x.id) === String(experienceId)
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
        </div>

        {/* Table Card */}
        <div className="relative overflow-hidden rounded-2xl border bg-white shadow-sm">
          {/* top tools */}
          <div className="flex flex-col gap-3 border-b bg-neutral-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-neutral-700" aria-live="polite">
              {error ? (
                <span className="text-red-600">{error}</span>
              ) : (
                <span>
                  Showing {rows.length ? (page - 1) * pageSize + 1 : 0}–
                  {Math.min(page * pageSize, total)} of {total}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-neutral-600">Per page</label>
                <select
                  className="rounded-xl border bg-white px-2 py-1.5 text-sm"
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

          <div className="relative overflow-x-auto" aria-busy={loading}>
            {loading && rows.length > 0 && (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-9 bg-gradient-to-b from-white/90 to-transparent" />
            )}
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-neutral-50 text-neutral-600">
                <tr className="text-left">
                  <Th className="w-[140px]">Booking Code</Th>
                  <Th>Date</Th>
                  <Th>Experience</Th>
                  <Th>Client</Th>
                  <Th>Phone</Th>
                  <Th className="text-right">People</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Status</Th>
                  <Th className="w-[120px]">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading && rows.length === 0 && (
                  <SkeletonRows columns={9} rows={8} />
                )}

                {!loading && rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="p-10 text-center text-neutral-600"
                    >
                      <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-neutral-100">
                        <SearchIcon className="h-5 w-5 text-neutral-500" />
                      </div>
                      <p className="font-medium">No bookings found.</p>
                      <p className="text-sm text-neutral-500">
                        Try adjusting your search or filters.
                      </p>
                      <div className="mt-3">
                        <button
                          onClick={resetFilters}
                          className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm shadow-sm hover:bg-neutral-50"
                        >
                          <FilterIcon className="h-4 w-4" /> Clear filters
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className={cx(
                      "group cursor-pointer transition-colors odd:bg-neutral-50/40",
                      r.status === "cancelled"
                        ? "opacity-70"
                        : "hover:bg-neutral-50/80"
                    )}
                  >
                    <Td className={pad + " font-mono"}>
                      <div className="flex items-center gap-2">
                        <span className="truncate" title={r.code || r.id}>
                          {r.code || r.id}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copy(r.code || r.id, "Booking code copied");
                          }}
                          className="invisible rounded p-1 hover:bg-neutral-100 group-hover:visible"
                          title="Copy booking code"
                          aria-label="Copy booking code"
                        >
                          <Copy className="h-3.5 w-3.5 text-neutral-500" />
                        </button>
                      </div>
                    </Td>
                    <Td className={pad}>{fmtDate(r.startTime || r.date)}</Td>
                    <Td className={pad + " max-w-[260px] truncate"}>
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="truncate"
                          title={safeExperienceName(r)}
                        >
                          {safeExperienceName(r)}
                        </span>
                        {isPrivateBooking(r) && (
                          <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            Private
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td className={pad}>
                      <div className="flex flex-col">
                        <span className="font-medium">{r.guestName}</span>
                        <a
                          href={
                            r.guestEmail ? `mailto:${r.guestEmail}` : undefined
                          }
                          onClick={(e) => !r.guestEmail && e.preventDefault()}
                          className={cx(
                            "text-neutral-500 hover:underline",
                            !r.guestEmail && "pointer-events-none"
                          )}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <span className="inline-flex items-center gap-1">
                            {r.guestEmail || "-"}
                          </span>
                        </a>
                      </div>
                    </Td>
                    <Td className={pad + " whitespace-nowrap"}>
                      <a
                        href={r.guestPhone ? `tel:${r.guestPhone}` : undefined}
                        onClick={(e) => !r.guestPhone && e.preventDefault()}
                        className={cx(
                          "hover:underline",
                          !r.guestPhone &&
                            "pointer-events-none text-neutral-500"
                        )}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <span className="inline-flex items-center gap-1">
                          {r.guestPhone || "-"}
                        </span>
                      </a>
                    </Td>
                    <Td className={pad + " text-right"}>
                      {(() => {
                        const a =
                          typeof r.adults === "number" ? r.adults : null;
                        const k = typeof r.kids === "number" ? r.kids : null;
                        if (a !== null || k !== null) {
                          return (
                            <span className="inline-flex items-center justify-end gap-1">
                              {a ?? 0}
                              {k !== null ? ` + ${k}` : ""}
                            </span>
                          );
                        }
                        const total =
                          typeof r.numberOfPeople === "number"
                            ? r.numberOfPeople
                            : 0;
                        return (
                          <span className="inline-flex items-center justify-end">
                            {total}
                          </span>
                        );
                      })()}
                    </Td>
                    <Td className={pad + " text-right"}>
                      {fmtMoney(rowTotal(r))}
                    </Td>
                    <Td className={pad}>
                      <StatusBadge status={r.status} />
                    </Td>
                    <Td className={pad}>
                      <div className="flex items-center justify-end gap-1">
                        <IconButton
                          onClick={() =>
                            window.open(`/admin/bookings/${r.id}`, "_self")
                          }
                          title="View"
                          ariaLabel="View booking"
                        >
                          <Eye className="h-4 w-4" />
                        </IconButton>
                        {r.status !== "cancelled" && (
                          <IconButton
                            onClick={() => openReschedule(r)}
                            title="Reschedule"
                            ariaLabel="Reschedule booking"
                            tone="amber"
                          >
                            <CalendarClock className="h-4 w-4" />
                          </IconButton>
                        )}
                        {r.status !== "cancelled" && (
                          <IconButton
                            onClick={() => openCancel(r)}
                            title="Cancel"
                            ariaLabel="Cancel booking"
                            tone="red"
                          >
                            <XCircleIcon className="h-4 w-4" />
                          </IconButton>
                        )}
                        {r.status == "cancelled" && (
                          <IconButton
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDelete(r);
                            }}
                            title="Delete"
                            aria-label="Delete booking"
                            className={cx(
                              "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm",
                              "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
                              deletingId === r.id && "opacity-60 cursor-wait"
                            )}
                          >
                            {deletingId === r.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Delete
                          </IconButton>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* footer */}
          <div className="flex flex-col gap-3 border-t bg-neutral-50/60 p-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-neutral-600" aria-live="polite">
              {error ? (
                <span className="text-red-600">{error}</span>
              ) : (
                <span>
                  Showing {rows.length ? (page - 1) * pageSize + 1 : 0}–
                  {Math.min(page * pageSize, total)} of {total}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={cx(
                  "rounded-xl border px-3 py-2 text-sm",
                  page <= 1
                    ? "cursor-not-allowed opacity-50"
                    : "hover:bg-neutral-50"
                )}
              >
                Previous
              </button>
              <span className="text-sm text-neutral-700">
                Page {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={cx(
                  "rounded-xl border px-3 py-2 text-sm",
                  page >= totalPages
                    ? "cursor-not-allowed opacity-50"
                    : "hover:bg-neutral-50"
                )}
              >
                Next
              </button>
            </div>
          </div>

          {loading && rows.length > 0 && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-white/40 backdrop-blur-sm">
              <div className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            </div>
          )}
        </div>

        {/* Cancel modal */}
        {showCancel && (
          <Modal onClose={() => setShowCancel(false)} title="Cancel Booking">
            <div className="space-y-3">
              {selected && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  The booking{" "}
                  <span className="font-mono">
                    {selected.code || selected.id}
                  </span>{" "}
                  for
                  <span className="font-semibold">
                    {" "}
                    {selected.guestName}
                  </span>{" "}
                  on {fmtDate(selected.startTime)} will be cancelled.
                </div>
              )}
              <p className="text-sm text-neutral-600">
                Are you sure you want to cancel? This action cannot be undone.
              </p>
              <label className="block text-sm">
                <span className="text-neutral-700">Reason (optional)</span>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border p-2 text-sm"
                  rows={3}
                  placeholder="e.g. customer unable to attend"
                />
              </label>
              <div className="flex items-center justify-end gap-2">
                <button
                  className="rounded-xl border px-3 py-2 text-sm"
                  onClick={() => setShowCancel(false)}
                >
                  Close
                </button>
                <button
                  className="rounded-xl border bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
                  onClick={submitCancel}
                >
                  Cancel booking
                </button>
              </div>
            </div>
          </Modal>
        )}

        {showDelete && selected && (
          <Modal onClose={() => setShowDelete(false)} title="Delete Booking">
            <div className="space-y-4">
              {/* Warning banner */}
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                This will permanently delete booking{" "}
                <span className="font-mono">
                  {selected.code || selected.id}
                </span>{" "}
                for{" "}
                <span className="font-semibold">
                  {selected.guestName || "-"}
                </span>
                {selected.startTime ? (
                  <> on {fmtDate(selected.startTime)}</>
                ) : null}
                . This action cannot be undone.
              </div>

              {/* Extra option for non-cancelled */}
              {selected.status !== "cancelled" && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={forceDelete}
                    onChange={(e) => setForceDelete(e.target.checked)}
                  />
                  <span>
                    Force delete (booking is <strong>{selected.status}</strong>)
                  </span>
                </label>
              )}

              {/* Error */}
              {!!deleteError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                  {deleteError}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2">
                <button
                  className="rounded-xl border px-3 py-2 text-sm"
                  onClick={() => setShowDelete(false)}
                  disabled={deleting}
                >
                  Close
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-60"
                  onClick={submitDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {deleting ? "Deleting…" : "Delete booking"}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Reschedule modal */}
        {showReschedule && (
          <Modal
            onClose={() => setShowReschedule(false)}
            title="Reschedule Booking"
          >
            <div className="space-y-3">
              {selected && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Choose a new slot for booking{" "}
                  <span className="font-mono">
                    {selected.code || selected.id}
                  </span>{" "}
                  of
                  <span className="font-semibold">
                    {" "}
                    {selected.guestName}
                  </span>{" "}
                  (current: {fmtDate(selected.startTime)}).
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs text-neutral-600">From</label>
                  <input
                    type="date"
                    value={slotFrom}
                    onChange={(e) => setSlotFrom(e.target.value)}
                    className="mt-1 w-full rounded-xl border p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-600">To</label>
                  <input
                    type="date"
                    value={slotTo}
                    onChange={(e) => setSlotTo(e.target.value)}
                    className="mt-1 w-full rounded-xl border p-2 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() =>
                      loadSlots(selected?.experienceId, slotFrom, slotTo)
                    }
                    className="w-full rounded-xl border px-3 py-2 text-sm sm:w-auto"
                  >
                    Load available slots
                  </button>
                </div>
              </div>

              <label className="block text-sm">
                <span className="text-neutral-700">New slot</span>
                <select
                  value={targetSlotId}
                  onChange={(e) => setTargetSlotId(e.target.value)}
                  className="mt-1 w-full rounded-xl border p-2 text-sm"
                >
                  <option value="">— Select —</option>
                  {slotLoading ? (
                    <option value="" disabled>
                      Loading…
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

              <div className="flex items-center justify-end gap-2">
                <button
                  className="rounded-xl border px-3 py-2 text-sm"
                  onClick={() => setShowReschedule(false)}
                >
                  Close
                </button>
                <button
                  className="rounded-xl border bg-amber-600 px-3 py-2 text-sm text-white hover:bg-amber-700"
                  onClick={submitReschedule}
                >
                  Reschedule booking
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
function Th({ children, className = "" }) {
  return (
    <th
      className={cx(
        "px-3 py-2 text-xs font-semibold uppercase tracking-wide",
        className
      )}
    >
      {children}
    </th>
  );
}
function Td({ children, className = "" }) {
  return (
    <td
      className={cx(
        "px-3 align-middle text-[13px] text-neutral-800",
        className
      )}
    >
      {children}
    </td>
  );
}
function IconButton({ children, onClick, title, ariaLabel, tone }) {
  const toneClass =
    tone === "red"
      ? "hover:bg-red-50"
      : tone === "amber"
      ? "hover:bg-amber-50"
      : "hover:bg-neutral-50";
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={cx(
        "inline-flex items-center rounded-lg border p-1.5",
        toneClass
      )}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

function SkeletonRows({ rows = 8, columns = 9 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: columns }).map((__, j) => (
            <td key={j} className="px-3 py-3">
              <div className="h-3 w-full max-w-[220px] rounded bg-neutral-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

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
  // if (v === "confirmed") return "paid"; // legacy synonym
  if (v === "processing") return "pending";
  return v || "draft";
}

function labelStatus(status) {
  const k = normalizeStatus(status);
  return (
    {
      paid: "Paid",
      pending: "Pending",
      cancelled: "Cancelled",
      draft: "Draft",
    }[k] ||
    status ||
    "-"
  );
}

function StatusBadge({ status }) {
  const k = normalizeStatus(status);
  const map = {
    paid: "bg-green-100 text-green-800 border-green-200",
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
    draft: "bg-neutral-100 text-neutral-700 border-neutral-200",
    confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs",
        map[k] || "bg-neutral-100 text-neutral-700 border-neutral-200"
      )}
    >
      {labelStatus(k)}
    </span>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-base font-semibold text-neutral-800">{title}</h3>
          <button
            className="rounded-lg p-1 hover:bg-neutral-100"
            onClick={onClose}
            aria-label="Close"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function ToolbarButton({ icon: Icon, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm shadow-sm hover:bg-neutral-50"
    >
      <Icon className="h-4 w-4" /> {children}
    </button>
  );
}

function Chip({ children, onClear }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs">
      {children}
      <button
        onClick={onClear}
        className="rounded p-0.5 text-neutral-500 hover:bg-neutral-100"
        aria-label="Clear filter"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function QuickRange({ label, value, onClick }) {
  return (
    <button
      onClick={() => onClick(value)}
      className="inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1 text-xs hover:bg-neutral-50"
    >
      <SlidersHorizontal className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function StatPill({ label, value, tone }) {
  const toneMap = {
    green: "bg-green-50 text-green-900 border-green-100",
    amber: "bg-amber-50 text-amber-900 border-amber-100",
    red: "bg-red-50 text-red-900 border-red-100",
    default: "bg-neutral-50 text-neutral-900 border-neutral-100",
  };
  const klass = tone ? toneMap[tone] : toneMap.default;
  return (
    <div className={cx("rounded-2xl border p-3", klass)}>
      <p className="text-xs/5 text-neutral-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{String(value)}</p>
    </div>
  );
}

/* ------------------------------ Utils ------------------------------ */
function today() {
  const d = new Date();
  return toDateInput(d);
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
