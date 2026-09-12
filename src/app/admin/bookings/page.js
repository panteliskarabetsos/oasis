"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import Icon from "../_ui/Icon";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  Muted,
  Page,
  PageHeader,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  Td,
  Th,
  Tr,
  inputClass,
} from "../_ui";

/* -------------------------------- helpers -------------------------------- */

const STATUSES = ["confirmed", "pending", "checked_in", "no_show", "cancelled"];

const eur = (n, ccy = "EUR") =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: ccy }).format(
    Number(n) || 0
  );

const iso = (d) => d.toISOString().slice(0, 10);
const today = () => iso(new Date());
const plusDays = (n) => iso(new Date(Date.now() + n * 86400000));

function fmtWhen(v) {
  if (!v) return "Private";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

const QUICK_RANGES = [
  { key: "today", label: "Today", from: today, to: today },
  { key: "7d", label: "Next 7 days", from: today, to: () => plusDays(7) },
  { key: "30d", label: "Next 30 days", from: today, to: () => plusDays(30) },
  { key: "all", label: "All time", from: () => "", to: () => "" },
];

/* --------------------------------- page ---------------------------------- */

export default function AdminBookingsPage() {
  const router = useRouter();

  // filters
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [experienceId, setExperienceId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // data
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  /** Whole-result tallies from the API; null on a deployment without them. */
  const [totals, setTotals] = useState(null);
  const [experiences, setExperiences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // action modals
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null); // "cancel" | "reschedule" | "delete"
  const [cancelReason, setCancelReason] = useState("");
  const [forceDelete, setForceDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [slots, setSlots] = useState([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [slotFrom, setSlotFrom] = useState(() => today());
  const [slotTo, setSlotTo] = useState(() => plusDays(60));
  const [targetSlotId, setTargetSlotId] = useState("");

  const controllerRef = useRef(null);
  const searchRef = useRef(null);

  /* debounce search */
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  /* experiences for the filter */
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/admin/experiences?fields=id,name&limit=200", {
          signal: ac.signal,
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : data;
        if (!ac.signal.aborted) setExperiences(items || []);
      } catch {
        /* filter is optional */
      }
    })();
    return () => ac.abort();
  }, []);

  /* reservations */
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();

    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (debouncedQuery) {
      const raw = debouncedQuery.trim();
      const m = raw.match(/^#\s*(.+)$/); // "#123" searches by booking code
      if (m && m[1]) qs.set("code", m[1].trim());
      else qs.set("q", raw);
    }
    if (status) qs.set("status", status);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (experienceId) qs.set("experienceId", experienceId);

    try {
      const res = await fetch(`/api/admin/reservations?${qs}`, {
        signal: controllerRef.current.signal,
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await safeJson(res))?.error || "Failed to load");
      const data = await res.json();
      const items = data?.items || [];
      setRows(items);
      setTotal(Number(data?.total || items.length));
      // Absent on an older deployment; the cards fall back to counting rows.
      setTotals(
        data?.counts
          ? { counts: data.counts, revenue: Number(data.revenue) || 0 }
          : null,
      );
    } catch (e) {
      if (e?.name === "AbortError") return;
      setError(e?.message || "Failed to load bookings");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedQuery, status, from, to, experienceId]);

  useEffect(() => {
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  /* keyboard: "/" focuses search, "r" reloads */
  useEffect(() => {
    const onKey = (e) => {
      const typing = /input|textarea|select/i.test(e.target?.tagName || "");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key.toLowerCase() === "r" && !typing && !e.metaKey && !e.ctrlKey) {
        load();
      } else if (e.key === "Escape") {
        setModal(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [load]);

  /* derived */
  /**
   * Figures for the summary cards.
   *
   * These sit next to "Results", so they have to describe the same set. When
   * the API sends whole-result tallies we use them; otherwise we fall back to
   * counting the loaded page and say so on the label, rather than quietly
   * reporting a page count as if it were the total.
   */
  const stats = useMemo(() => {
    if (totals) {
      const c = totals.counts || {};
      return {
        scope: "all",
        confirmed: Number(c.confirmed || 0),
        pending: Number(c.pending || 0),
        revenue: totals.revenue,
      };
    }
    return {
      scope: "page",
      confirmed: rows.filter((r) => r.status === "confirmed").length,
      pending: rows.filter((r) => r.status === "pending").length,
      revenue: rows.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0),
    };
  }, [rows, totals]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const isCodeSearch = /^#\s*\S/.test(query);

  const activeFilters = useMemo(() => {
    const out = [];
    if (query)
      out.push({
        key: "q",
        prefix: isCodeSearch ? "code" : "search",
        label: query.replace(/^#\s*/, ""),
        clear: () => setQuery(""),
      });
    if (status)
      out.push({
        key: "status",
        prefix: "status",
        label: status.replace(/_/g, " "),
        clear: () => {
          setStatus("");
          setPage(1);
        },
      });
    if (experienceId) {
      const exp = experiences.find((x) => String(x.id) === String(experienceId));
      out.push({
        key: "exp",
        prefix: "experience",
        label: exp?.name || `#${experienceId}`,
        clear: () => {
          setExperienceId("");
          setPage(1);
        },
      });
    }
    if (from || to)
      out.push({
        key: "dates",
        prefix: "dates",
        label: from && to ? `${from} → ${to}` : from ? `from ${from}` : `until ${to}`,
        clear: () => {
          setFrom("");
          setTo("");
          setPage(1);
        },
      });
    return out;
  }, [query, isCodeSearch, status, experienceId, experiences, from, to]);
  const activeRange = QUICK_RANGES.find(
    (r) => r.from() === from && r.to() === to
  )?.key;
  const hasFilters = Boolean(query || status || from || to || experienceId);

  function clearFilters() {
    setQuery("");
    setStatus("");
    setFrom("");
    setTo("");
    setExperienceId("");
    setPage(1);
  }

  function exportCsv() {
    const head = [
      "code", "status", "guest", "email", "phone", "experience",
      "when", "adults", "kids", "total", "created",
    ];
    const lines = rows.map((r) =>
      [
        r.code, r.status, r.guestName, r.guestEmail, r.guestPhone,
        r.experienceName, r.startTime, r.adults, r.kids, r.totalAmount, r.createdAt,
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `oasis-bookings-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* actions */
  function openModal(kind, row) {
    setSelected(row);
    setActionError("");
    setCancelReason("");
    setForceDelete(false);
    setTargetSlotId("");
    setModal(kind);
    if (kind === "reschedule") loadSlots(row.experienceId, slotFrom, slotTo);
  }

  async function loadSlots(expId, f, t) {
    if (!expId) return setSlots([]);
    setSlotLoading(true);
    try {
      const qs = new URLSearchParams({ experienceId: String(expId) });
      if (f) qs.set("from", f);
      if (t) qs.set("to", t);
      const res = await fetch(`/api/admin/schedule/slots?${qs}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error((await safeJson(res))?.error || "Error loading slots");
      const data = await res.json();
      setSlots(data?.items || []);
    } catch (e) {
      toast.error(e?.message || "Could not load slots");
      setSlots([]);
    } finally {
      setSlotLoading(false);
    }
  }

  async function run(fn, okMessage) {
    setBusy(true);
    setActionError("");
    try {
      await fn();
      if (okMessage) toast.success(okMessage);
      setModal(null);
      load();
    } catch (e) {
      setActionError(e?.message || "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const submitCancel = () =>
    run(async () => {
      const res = await fetch(`/api/admin/reservations/${selected.id}/cancel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: cancelReason }),
      });
      if (!res.ok) throw new Error((await safeJson(res))?.error || "Cancel failed");
    }, "Booking cancelled");

  const submitReschedule = () => {
    if (!targetSlotId) return toast.error("Choose a new slot");
    return run(async () => {
      const res = await fetch(`/api/admin/reservations/${selected.id}/reschedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ scheduleSlotId: Number(targetSlotId) }),
      });
      if (!res.ok) throw new Error((await safeJson(res))?.error || "Reschedule failed");
    }, "Booking moved");
  };

  const submitDelete = () =>
    run(async () => {
      const res = await fetch(
        `/api/admin/reservations/${selected.id}${forceDelete ? "?force=1" : ""}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) throw new Error((await safeJson(res))?.error || "Failed to delete booking");
    }, "Booking deleted");

  /* --------------------------------- view -------------------------------- */

  return (
    <Page>
      <PageHeader
        eyebrow="Operations"
        title="Bookings"
        description={
          loading ? "Loading reservations…" : `${total} reservation${total === 1 ? "" : "s"} match your filters`
        }
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv} disabled={!rows.length}>
              <Icon name="file" size={15} /> Export CSV
            </Button>
            <Button as={Link} href="/admin/bookings/new" variant="primary">
              <Icon name="plus" size={15} /> New booking
            </Button>
          </>
        }
      />

      {/* summary */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Results", total, "brand"],
          [stats.scope === "all" ? "Confirmed" : "Confirmed (page)", stats.confirmed, "success"],
          [stats.scope === "all" ? "Pending" : "Pending (page)", stats.pending, "warning"],
          [stats.scope === "all" ? "Revenue" : "Page revenue", eur(stats.revenue), "brand"],
        ].map(([label, value]) => (
          <Card key={label} className="py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9a8c7e]">
              {label}
            </p>
            <p className="mt-1 font-serif text-[20px] text-[#2a211a]">{value}</p>
          </Card>
        ))}
      </div>

      <Card padded={false} className="overflow-hidden">
        {/* ------------------------------ toolbar ------------------------------ */}
        <div className="border-b border-[#e6e0d6]">
          {/* search row */}
          <div className="flex flex-wrap items-center gap-2 p-4 pb-3">
            <div className="relative min-w-[240px] flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#b0a294]">
                <Icon name="search" size={16} />
              </span>
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by guest, email, phone — or #372 for a booking code"
                className={`${inputClass} h-11 pl-9 ${query ? "pr-24" : "pr-16"}`}
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                {isCodeSearch ? (
                  <span className="rounded-md bg-[#f3ece1] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#8b6f47]">
                    code
                  </span>
                ) : null}
                {query ? (
                  <button
                    onClick={() => {
                      setQuery("");
                      searchRef.current?.focus();
                    }}
                    aria-label="Clear search"
                    className="rounded-md p-1 text-[#9a8c7e] hover:bg-[#f2ede4] hover:text-[#2a211a]"
                  >
                    <Icon name="x" size={14} />
                  </button>
                ) : (
                  <kbd className="hidden rounded border border-[#e6e0d6] bg-[#faf8f4] px-1.5 py-0.5 text-[10px] font-medium text-[#b0a294] sm:block">
                    /
                  </kbd>
                )}
              </div>
            </div>

            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="h-11 !w-auto min-w-[150px]"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </Select>

            <Select
              value={experienceId}
              onChange={(e) => {
                setExperienceId(e.target.value);
                setPage(1);
              }}
              className="h-11 !w-auto min-w-[180px]"
            >
              <option value="">All experiences</option>
              {experiences.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>

            <Button
              variant={advancedOpen || from || to ? "dark" : "secondary"}
              size="md"
              className="h-11"
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              <Icon name="layers" size={15} />
              Dates
              {from || to ? (
                <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px] font-bold">1</span>
              ) : null}
            </Button>
          </div>

          {/* date panel */}
          {advancedOpen ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-[#f0ebe2] bg-[#fdfbf7] px-4 py-3">
              {QUICK_RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => {
                    setFrom(r.from());
                    setTo(r.to());
                    setPage(1);
                  }}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    activeRange === r.key
                      ? "bg-[#2a211a] text-white"
                      : "bg-white text-[#6b5c4d] ring-1 ring-inset ring-[#e6e0d6] hover:bg-[#f2ede4]"
                  }`}
                >
                  {r.label}
                </button>
              ))}
              <span className="mx-1 hidden h-5 w-px bg-[#e6e0d6] sm:block" />
              <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9a8c7e]">
                From
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setPage(1);
                  }}
                  className={`${inputClass} h-9 w-[150px] text-[12px]`}
                />
              </label>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9a8c7e]">
                To
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPage(1);
                  }}
                  className={`${inputClass} h-9 w-[150px] text-[12px]`}
                />
              </label>
            </div>
          ) : null}

          {/* active filter chips */}
          {activeFilters.length ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-[#f0ebe2] px-4 py-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9a8c7e]">
                Filtered by
              </span>
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  onClick={f.clear}
                  className="group inline-flex items-center gap-1.5 rounded-full bg-[#f3ece1] py-1 pl-2.5 pr-1.5 text-[12px] font-medium text-[#8b6f47] ring-1 ring-inset ring-[#e7dcc9] transition-colors hover:bg-[#ece0cd]"
                  title={`Remove ${f.label} filter`}
                >
                  <span className="text-[#b0a294]">{f.prefix}</span>
                  {f.label}
                  <span className="rounded-full p-0.5 group-hover:bg-[#8b6f47]/15">
                    <Icon name="x" size={11} />
                  </span>
                </button>
              ))}
              <button
                onClick={clearFilters}
                className="ml-1 text-[12px] font-semibold text-[#9a8c7e] underline-offset-2 hover:text-[#a33c22] hover:underline"
              >
                Clear all
              </button>
            </div>
          ) : null}
        </div>

        {/* table */}
        {error ? (
          <div className="p-5">
            <ErrorNote>{error}</ErrorNote>
            <Button className="mt-3" variant="secondary" onClick={load}>
              Try again
            </Button>
          </div>
        ) : loading ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Icon name="calendar" size={20} />}
            title="No bookings found"
            description={
              hasFilters
                ? "Nothing matches these filters — try widening the date range."
                : "New reservations will appear here as they come in."
            }
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Guest</Th>
                <Th>Experience</Th>
                <Th>When</Th>
                <Th className="hidden text-center xl:table-cell">Pax</Th>
                <Th className="text-right">Total</Th>
                <Th>Status</Th>
                <Th className="sticky right-0 z-10 border-l border-[#f0ebe2] bg-white text-right">
                  Actions
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Tr
                  key={`${r.source}-${r.id}`}
                  className="group"
                  onClick={() => router.push(`/admin/bookings/${r.id}`)}
                >
                  <Td className="whitespace-nowrap font-bold text-[#8b6f47]">{r.code}</Td>
                  <Td>
                    <span className="block max-w-[180px] truncate font-semibold text-[#2a211a]">
                      {r.guestName || "—"}
                    </span>
                    {r.guestEmail ? (
                      <span className="hidden truncate text-[11.5px] text-[#9a8c7e] xl:block">
                        {r.guestEmail}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="max-w-[220px]">
                    <span className="block truncate">{r.experienceName || "—"}</span>
                    {r.isPrivate ? <Badge variant="info">private</Badge> : null}
                  </Td>
                  <Td className="whitespace-nowrap text-[#7a6a5f]">{fmtWhen(r.startTime)}</Td>
                  <Td className="hidden text-center xl:table-cell">
                    {(r.adults || 0) + (r.kids || 0) || "—"}
                  </Td>
                  <Td className="whitespace-nowrap text-right font-semibold">
                    {eur(r.totalAmount)}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <StatusBadge status={r.status} />
                  </Td>
                  <Td
                    className="sticky right-0 z-10 border-l border-[#f0ebe2] bg-white text-right group-hover:bg-[#fdfbf7]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {r.scheduleSlotId ? (
                        <button
                          onClick={() => openModal("reschedule", r)}
                          title="Reschedule"
                          className="rounded-lg p-1.5 text-[#7a6a5f] hover:bg-[#f2ede4] hover:text-[#2a211a]"
                        >
                          <Icon name="clock" size={16} />
                        </button>
                      ) : null}
                      {r.status !== "cancelled" ? (
                        <button
                          onClick={() => openModal("cancel", r)}
                          title="Cancel booking"
                          className="rounded-lg p-1.5 text-[#7a6a5f] hover:bg-[#fbeae5] hover:text-[#a33c22]"
                        >
                          <Icon name="x" size={16} />
                        </button>
                      ) : null}
                      <button
                        onClick={() => openModal("delete", r)}
                        title="Delete booking"
                        className="rounded-lg p-1.5 text-[#7a6a5f] hover:bg-[#fbeae5] hover:text-[#a33c22]"
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}

        {/* pagination */}
        {!loading && rows.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6e0d6] px-4 py-3">
            <div className="flex items-center gap-2">
              <Muted className="text-[12px]">Rows</Muted>
              <Select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 w-[76px] text-[12px]"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Muted className="text-[12px]">
                Page {page} of {pages}
              </Muted>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      {/* ------------------------------ modals ------------------------------ */}
      <Modal
        open={modal === "cancel"}
        onClose={() => setModal(null)}
        title="Cancel booking"
        subtitle={selected ? `${selected.code} · ${selected.guestName || "Guest"}` : ""}
      >
        <Field label="Reason (shared with the team)">
          <Input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Guest requested cancellation"
          />
        </Field>
        <Muted className="mt-3 text-[12px]">
          This releases the seats. Refunds are issued separately from the payment screen.
        </Muted>
        {actionError ? <ErrorNote className="mt-3">{actionError}</ErrorNote> : null}
        <ModalActions>
          <Button variant="secondary" onClick={() => setModal(null)}>
            Keep booking
          </Button>
          <Button variant="danger" onClick={submitCancel} disabled={busy}>
            {busy ? "Cancelling…" : "Cancel booking"}
          </Button>
        </ModalActions>
      </Modal>

      <Modal
        open={modal === "reschedule"}
        onClose={() => setModal(null)}
        title="Reschedule"
        subtitle={selected ? `${selected.code} · ${selected.experienceName || ""}` : ""}
      >
        <div className="mb-3 flex items-center gap-2">
          <input
            type="date"
            value={slotFrom}
            onChange={(e) => {
              setSlotFrom(e.target.value);
              loadSlots(selected?.experienceId, e.target.value, slotTo);
            }}
            className={`${inputClass} h-9 flex-1 text-[12px]`}
          />
          <span className="text-[12px] text-[#9a8c7e]">→</span>
          <input
            type="date"
            value={slotTo}
            onChange={(e) => {
              setSlotTo(e.target.value);
              loadSlots(selected?.experienceId, slotFrom, e.target.value);
            }}
            className={`${inputClass} h-9 flex-1 text-[12px]`}
          />
        </div>

        {slotLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : slots.length === 0 ? (
          <Muted>No slots with availability in this range.</Muted>
        ) : (
          <div className="max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
            {slots.map((s) => {
              const active = String(targetSlotId) === String(s.id);
              const free = s.available ?? Math.max(0, (s.totalSlots || 0) - (s.bookedSlots || 0));
              return (
                <button
                  key={s.id}
                  onClick={() => setTargetSlotId(s.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "border-[#8b6f47] bg-[#f7f3ec]"
                      : "border-[#e6e0d6] hover:border-[#c9b393]"
                  }`}
                >
                  <span className="text-[13px] font-semibold text-[#2a211a]">
                    {fmtWhen(s.date)}
                  </span>
                  <span className="ml-auto text-[12px] text-[#9a8c7e]">{free} free</span>
                </button>
              );
            })}
          </div>
        )}
        {actionError ? <ErrorNote className="mt-3">{actionError}</ErrorNote> : null}
        <ModalActions>
          <Button variant="secondary" onClick={() => setModal(null)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submitReschedule} disabled={busy || !targetSlotId}>
            {busy ? "Moving…" : "Move booking"}
          </Button>
        </ModalActions>
      </Modal>

      <Modal
        open={modal === "delete"}
        onClose={() => setModal(null)}
        title="Delete booking"
        subtitle={selected ? selected.code : ""}
      >
        <Muted>
          Deleting removes the reservation permanently. Cancel it instead if you just need to
          free the seats.
        </Muted>
        <label className="mt-3 flex items-center gap-2 text-[13px] text-[#3f3127]">
          <input
            type="checkbox"
            checked={forceDelete}
            onChange={(e) => setForceDelete(e.target.checked)}
            className="h-4 w-4 rounded border-[#c9b393]"
          />
          Force delete even if it is not cancelled
        </label>
        {actionError ? <ErrorNote className="mt-3">{actionError}</ErrorNote> : null}
        <ModalActions>
          <Button variant="secondary" onClick={() => setModal(null)}>
            Keep it
          </Button>
          <Button variant="danger" onClick={submitDelete} disabled={busy}>
            {busy ? "Deleting…" : "Delete permanently"}
          </Button>
        </ModalActions>
      </Modal>
    </Page>
  );
}

/* --------------------------------- modal --------------------------------- */

function Modal({ open, onClose, title, subtitle, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-t-3xl border border-[#e6e0d6] bg-white p-6 shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-[19px] text-[#2a211a]">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[12px] text-[#9a8c7e]">{subtitle}</p> : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[#9a8c7e] hover:bg-[#f2ede4]"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ children }) {
  return <div className="mt-5 flex justify-end gap-2">{children}</div>;
}
