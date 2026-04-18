"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Calendar as CalIcon,
  Download,
  Filter,
  Loader2,
  RefreshCcw,
  Search,
  ExternalLink,
  Receipt,
  CreditCard,
  AlertCircle,
  Copy as CopyIcon,
  CheckCircle2,
  RotateCcw,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ShieldAlert,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Utils                                    */
/* -------------------------------------------------------------------------- */

const ATHENS_TZ = "Europe/Athens";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "succeeded", label: "Succeeded" },
  { value: "processing", label: "Processing" },
  { value: "requires_action", label: "Requires action" },
  { value: "requires_payment_method", label: "Requires payment method" },
  { value: "requires_confirmation", label: "Requires confirmation" },
  { value: "requires_capture", label: "Requires capture" },
  { value: "canceled", label: "Canceled" },
  { value: "refunded", label: "Refunded (derived)" },
  { value: "partially_refunded", label: "Partially refunded (derived)" },
];

const QUICK_RANGE_OPTIONS = [
  { key: "any", label: "Any time" },
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
];

function formatMoney(amountCents = 0, currency = "EUR") {
  try {
    const amt = (Number(amountCents) || 0) / 100;
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(amt);
  } catch {
    const amt = (Number(amountCents) || 0) / 100;
    return `${amt.toFixed(2)} ${currency}`;
  }
}

function formatDate(d) {
  if (!d && d !== 0) return "-";
  try {
    const date =
      typeof d === "number"
        ? new Date(d)
        : typeof d === "string"
          ? new Date(d)
          : d;
    return date.toLocaleString("en-GB", {
      timeZone: ATHENS_TZ,
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(d);
  }
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getQuickRange(key) {
  const now = new Date();
  const tzNow = new Date(now.toLocaleString("en-US", { timeZone: ATHENS_TZ }));
  const todayStr = formatDateInput(tzNow);

  if (key === "today") {
    return { from: todayStr, to: todayStr };
  }
  if (key === "7d") {
    const start = new Date(tzNow);
    start.setDate(start.getDate() - 6);
    return { from: formatDateInput(start), to: todayStr };
  }
  if (key === "30d") {
    const start = new Date(tzNow);
    start.setDate(start.getDate() - 29);
    return { from: formatDateInput(start), to: todayStr };
  }
  return { from: "", to: "" };
}

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function downloadCSV(filename, rows) {
  const processValue = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replaceAll('"', '""');
    if (s.includes(",") || s.includes("\n") || s.includes('"')) return `"${s}"`;
    return s;
  };
  const csv = rows.map((r) => r.map(processValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Page                                     */
/* -------------------------------------------------------------------------- */

export default function PaymentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filters
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("from") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("to") || "");

  // UI state for search input (debounced to q)
  const [searchInput, setSearchInput] = useState(q);

  // Filters panel
  const [filtersOpen, setFiltersOpen] = useState(
    Boolean(
      searchParams.get("status") ||
      searchParams.get("from") ||
      searchParams.get("to"),
    ),
  );

  // Cursor-based pagination
  const [pageIndex, setPageIndex] = useState(
    Math.max(0, Number(searchParams.get("page") || 1) - 1),
  );
  const [cursorStack, setCursorStack] = useState([null]);

  // Data state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);

  // Copy feedback
  const [copiedValue, setCopiedValue] = useState("");

  // Manual refresh
  const [refreshKey, setRefreshKey] = useState(0);

  // Auth gate
  const [auth, setAuth] = useState({ loading: true, ok: true });

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (!ignore) setAuth({ loading: false, ok: res.ok });
      } catch {
        if (!ignore) setAuth({ loading: false, ok: false });
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const handleCopy = async (value) => {
    if (!value) return;
    const ok = await copyToClipboard(value);
    if (!ok) return;

    setCopiedValue(value);
    setTimeout(() => {
      setCopiedValue((current) => (current === value ? "" : current));
    }, 1500);
  };

  const paramsString = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    if (dateFrom) p.set("from", dateFrom);
    if (dateTo) p.set("to", dateTo);
    if (pageIndex > 0) p.set("page", String(pageIndex + 1));
    return p.toString();
  }, [q, status, dateFrom, dateTo, pageIndex]);

  useEffect(() => {
    const url = paramsString
      ? `/admin/payments?${paramsString}`
      : "/admin/payments";
    router.replace(url);
  }, [paramsString, router]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setPageIndex(0);
      setCursorStack([null]);
      setQ(searchInput.trim());
    }, 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  const fromToLabel = useMemo(() => {
    if (!dateFrom && !dateTo) return "Any time";
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;
    const f = from ? from.toLocaleDateString("en-GB") : "…";
    const t = to ? to.toLocaleDateString("en-GB") : "…";
    return `${f} → ${t}`;
  }, [dateFrom, dateTo]);

  const quickRanges = useMemo(
    () => ({
      any: { from: "", to: "" },
      today: getQuickRange("today"),
      "7d": getQuickRange("7d"),
      "30d": getQuickRange("30d"),
    }),
    [],
  );

  function mapToRow(p) {
    const amountReceived =
      typeof p.amount_received === "number" ? p.amount_received : 0;
    const refundsTotal = Array.isArray(p.refunds)
      ? p.refunds.reduce((s, r) => s + (r.amount || 0), 0)
      : 0;

    let displayStatus = p.status;
    if (amountReceived > 0 && refundsTotal >= amountReceived)
      displayStatus = "refunded";
    else if (refundsTotal > 0 && refundsTotal < amountReceived)
      displayStatus = "partially_refunded";

    const apiName = p.customer?.name ?? null;
    const apiEmail = p.customer?.email ?? null;
    const fallbackName = apiEmail ? apiEmail.split("@")[0] : null;
    const customer_name = apiName || fallbackName;

    return {
      id: p.id,
      created_at: (p.created || 0) * 1000,
      customer_name,
      customer_email: apiEmail,
      booking_id: p.booking_id ?? null,
      amount_cents: amountReceived || p.amount || 0,
      currency: (p.currency || "eur").toUpperCase(),
      method: p.method || "card",
      status: displayStatus,
      stripe_payment_intent_id: p.id || null,
      receipt_url: p.receipt_url || null,
      notes: null,
    };
  }

  useEffect(() => {
    let ignore = false;
    const ctrl = new AbortController();

    (async () => {
      setLoading(true);
      setError("");

      try {
        const qs = new URLSearchParams();
        if (q) qs.set("q", q);
        if (status) qs.set("status", status);
        if (dateFrom) qs.set("date_from", dateFrom);
        if (dateTo) qs.set("date_to", dateTo);
        const startingAfter = cursorStack[pageIndex];
        if (startingAfter) qs.set("starting_after", startingAfter);

        const res = await fetch(`/api/admin/payments?${qs.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`Failed to load payments (${res.status})`);
        const data = await res.json();

        if (ignore) return;
        const items = Array.isArray(data.items) ? data.items : [];
        setRows(items.map(mapToRow));
        setHasMore(!!data.has_more);
        setNextCursor(data.next_cursor || null);
      } catch (e) {
        if (ignore) return;
        setError(e?.message || "Failed to load payments");
        setRows([]);
        setHasMore(false);
        setNextCursor(null);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
      ctrl.abort();
    };
  }, [q, status, dateFrom, dateTo, pageIndex, cursorStack, refreshKey]);

  const goReset = () => {
    setQ("");
    setSearchInput("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
    setPageIndex(0);
    setCursorStack([null]);
    setFiltersOpen(false);
  };

  const goNext = () => {
    if (!hasMore || !nextCursor) return;
    setCursorStack((stk) => [...stk.slice(0, pageIndex + 1), nextCursor]);
    setPageIndex((i) => i + 1);
  };

  const goPrev = () => {
    if (pageIndex <= 0) return;
    setPageIndex((i) => Math.max(0, i - 1));
  };

  const handleQuickRange = (key) => {
    if (key === "any") {
      setDateFrom("");
      setDateTo("");
    } else {
      const range = quickRanges[key];
      if (!range) return;
      setDateFrom(range.from);
      setDateTo(range.to);
    }
    setPageIndex(0);
    setCursorStack([null]);
  };

  const exportCSV = () => {
    if (!rows.length) return;
    const headers = [
      "Date (Athens)",
      "Customer",
      "Email",
      "Booking ID",
      "Amount",
      "Currency",
      "Method",
      "Status",
      "Stripe PI",
      "Receipt URL",
    ];
    const data = rows.map((p) => [
      formatDate(p.created_at),
      p.customer_name || "",
      p.customer_email || "",
      p.booking_id || "",
      (Number(p.amount_cents) / 100).toFixed(2),
      p.currency || "EUR",
      p.method || "",
      p.status || "",
      p.stripe_payment_intent_id || "",
      p.receipt_url || "",
    ]);
    downloadCSV(`payments_${Date.now()}.csv`, [headers, ...data]);
  };

  const stats = useMemo(() => {
    if (!rows || !rows.length) {
      return { totalAmount: 0, succeededCount: 0, refundedCount: 0 };
    }
    let totalAmount = 0;
    let succeededCount = 0;
    let refundedCount = 0;
    rows.forEach((p) => {
      const amt = Number(p.amount_cents) || 0;
      totalAmount += amt;
      if (p.status === "succeeded") succeededCount += 1;
      if (p.status === "refunded" || p.status === "partially_refunded") {
        refundedCount += 1;
      }
    });
    return { totalAmount, succeededCount, refundedCount };
  }, [rows]);

  const isFiltered = Boolean(
    q || status || dateFrom || dateTo || pageIndex > 0,
  );
  const showSummary = !loading && !error && rows.length > 0;

  if (auth.loading) {
    return (
      <div className="min-h-screen bg-[#f6f3ee] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#8b6f47]" />
      </div>
    );
  }

  if (!auth.ok) {
    return (
      <div className="min-h-screen bg-[#f6f3ee] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[2rem] border border-[#e1dbd2] p-8 text-center shadow-xl">
          <ShieldAlert className="mx-auto h-12 w-12 text-rose-500 mb-4" />
          <h1 className="text-2xl font-serif text-[#2f261f] mb-2">
            Access Denied
          </h1>
          <p className="text-[#7c6d62] mb-8">
            You do not have permission to view the payments module.
          </p>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center w-full rounded-full bg-[#2f261f] px-6 py-3.5 text-sm font-medium text-white hover:bg-[#1a1511] transition-colors"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f3ee] pb-24">
      {/* Ambient background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -left-[5%] w-[40%] h-[40%] rounded-full bg-[#8b6f47]/5 blur-[120px]" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[50%] rounded-full bg-[#e3ddd2]/30 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-white border border-[#e7e0d6] shadow-sm flex items-center justify-center">
                <CreditCard className="text-[#8b6f47]" size={18} />
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#a79a8f]">
                Finance & Billing
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-serif tracking-tight text-[#2f261f]">
              Payments
            </h1>
            <p className="text-[#7c6d62] text-sm">
              Search, filter and export Stripe payments linked to your bookings.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/admin")}
              className="inline-flex items-center gap-2 rounded-full border border-[#ded6cb] bg-white/85 px-4 py-2.5 text-sm font-medium text-[#4f4137] hover:bg-[#f2ede6] transition shadow-sm"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              type="button"
              onClick={exportCSV}
              disabled={!rows.length || loading}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#7a5b33] to-[#a17f55] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={16} /> Export CSV
            </button>
          </div>
        </header>

        {/* Summary cards (current page) */}
        <AnimatePresence>
          {showSummary && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3"
            >
              <SummaryCard
                icon={<CreditCard size={18} className="text-[#8b6f47]" />}
                label="Total (this page)"
                value={formatMoney(
                  stats.totalAmount,
                  rows[0]?.currency || "EUR",
                )}
                helper="Sum of amounts for visible payments"
              />
              <SummaryCard
                icon={<CheckCircle2 size={18} className="text-emerald-600" />}
                label="Succeeded"
                value={`${stats.succeededCount} payment${stats.succeededCount === 1 ? "" : "s"}`}
                helper="Completed and captured payments"
              />
              <SummaryCard
                icon={<RotateCcw size={18} className="text-sky-600" />}
                label="Refunded"
                value={`${stats.refundedCount} payment${stats.refundedCount === 1 ? "" : "s"}`}
                helper="Fully or partially refunded"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters Toolbar */}
        <div className="mb-6 rounded-3xl border border-[#e7e0d6] bg-white/70 backdrop-blur shadow-[0_14px_45px_-28px_rgba(0,0,0,0.18)] p-2">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#a79a8f]" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, email, booking ID or PI..."
                className="w-full rounded-2xl border-none bg-transparent pl-11 pr-4 py-3 text-sm text-[#4f4137] placeholder-[#b6aaa0] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/35 focus:bg-white transition-colors"
                aria-label="Search payments"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a79a8f] hover:text-[#4f4137]"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Filter Toggle & Reset Buttons */}
            <div className="flex items-center gap-2 px-2 pb-2 md:pb-0 md:px-2 border-t md:border-t-0 md:border-l border-[#e7e0d6] pt-2 md:pt-0">
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className={`inline-flex flex-1 md:flex-none justify-center items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  filtersOpen
                    ? "bg-[#f5f1ea] text-[#4f4137]"
                    : "bg-transparent text-[#7c6d62] hover:bg-[#fbfaf7]"
                }`}
              >
                <Filter className="h-4 w-4" />
                Filters
                {(status || dateFrom || dateTo) && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#8b6f47] text-[10px] text-white">
                    {Number(!!status) + Number(!!dateFrom || !!dateTo)}
                  </span>
                )}
              </button>

              {isFiltered && (
                <button
                  type="button"
                  onClick={goReset}
                  className="inline-flex justify-center items-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-100 transition-colors"
                >
                  <RotateCcw className="h-4 w-4" /> Reset
                </button>
              )}
            </div>
          </div>

          {/* Expandable Filters Panel */}
          <AnimatePresence>
            {filtersOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="border-t border-[#e7e0d6] p-4 bg-[#fbfaf7] rounded-b-3xl mt-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Status Dropdown */}
                  <div>
                    <label className="block text-xs font-medium text-[#7c6d62] mb-1.5 ml-1">
                      Status
                    </label>
                    <div className="relative">
                      <select
                        value={status}
                        onChange={(e) => {
                          setStatus(e.target.value);
                          setPageIndex(0);
                          setCursorStack([null]);
                        }}
                        className="w-full appearance-none rounded-xl border border-[#e3ddd4] bg-white px-4 py-2.5 text-sm text-[#4f4137] outline-none focus:border-[#8b6f47] focus:ring-1 focus:ring-[#8b6f47]"
                      >
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#a79a8f] pointer-events-none" />
                    </div>
                  </div>

                  {/* Date From */}
                  <div>
                    <label className="block text-xs font-medium text-[#7c6d62] mb-1.5 ml-1">
                      From Date
                    </label>
                    <div className="relative">
                      <CalIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#a79a8f]" />
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => {
                          setDateFrom(e.target.value);
                          setPageIndex(0);
                          setCursorStack([null]);
                        }}
                        className="w-full rounded-xl border border-[#e3ddd4] bg-white pl-10 pr-4 py-2.5 text-sm text-[#4f4137] outline-none focus:border-[#8b6f47] focus:ring-1 focus:ring-[#8b6f47] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Date To */}
                  <div>
                    <label className="block text-xs font-medium text-[#7c6d62] mb-1.5 ml-1">
                      To Date
                    </label>
                    <div className="relative">
                      <CalIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#a79a8f]" />
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => {
                          setDateTo(e.target.value);
                          setPageIndex(0);
                          setCursorStack([null]);
                        }}
                        className="w-full rounded-xl border border-[#e3ddd4] bg-white pl-10 pr-4 py-2.5 text-sm text-[#4f4137] outline-none focus:border-[#8b6f47] focus:ring-1 focus:ring-[#8b6f47] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Quick Ranges */}
                  <div className="col-span-1 sm:col-span-3 pt-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-medium text-[#7c6d62] mr-2">
                        Quick filters:
                      </span>
                      {QUICK_RANGE_OPTIONS.map((opt) => {
                        let isActive = false;
                        if (opt.key === "any") {
                          isActive = !dateFrom && !dateTo;
                        } else {
                          const range = quickRanges[opt.key];
                          if (range) {
                            isActive =
                              dateFrom === range.from &&
                              dateTo === range.to &&
                              !!dateFrom;
                          }
                        }
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => handleQuickRange(opt.key)}
                            className={`rounded-full border px-3 py-1.5 transition-colors ${
                              isActive
                                ? "border-[#4f4137] bg-[#4f4137] text-white"
                                : "border-[#e3ddd4] bg-white text-[#7c6d62] hover:bg-[#f5f1ea]"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Data Table */}
        <div className="rounded-[2rem] border border-[#e1dbd2] bg-white/80 backdrop-blur-xl shadow-[0_18px_55px_-28px_rgba(0,0,0,0.22)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#efe9e1] px-6 py-4 bg-white/50">
            <h2 className="text-sm font-semibold text-[#2f261f]">
              Transaction History
            </h2>
            <div className="text-xs text-[#a79a8f] font-medium">
              {fromToLabel}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#a79a8f]">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-[#8b6f47]" />
              <p>Loading transactions...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-rose-600">
              <ShieldAlert className="h-10 w-10 mb-3" />
              <p className="font-medium mb-4">{error}</p>
              <button
                type="button"
                onClick={() => setRefreshKey((k) => k + 1)}
                className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 hover:bg-rose-100 transition-colors"
              >
                <RefreshCcw className="h-4 w-4" />
                Retry
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-12 w-12 rounded-2xl bg-[#fbfaf7] border border-[#e7e0d6] flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-[#a79a8f]" />
              </div>
              <h3 className="text-lg font-serif text-[#2f261f] mb-1">
                No payments found
              </h3>
              <p className="text-sm text-[#7c6d62]">
                Try adjusting your search or filters.
              </p>
              {isFiltered && (
                <button
                  onClick={goReset}
                  className="mt-4 text-sm font-medium text-[#8b6f47] hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[#fbfaf7] border-b border-[#efe9e1]">
                  <tr className="text-[10px] uppercase tracking-widest text-[#a79a8f]">
                    <th className="px-6 py-4 font-bold">Date & ID</th>
                    <th className="px-6 py-4 font-bold">Customer</th>
                    <th className="px-6 py-4 font-bold">Booking</th>
                    <th className="px-6 py-4 font-bold">Amount</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#efe9e1]">
                  {rows.map((p) => (
                    <tr
                      key={p.id}
                      className="group bg-white hover:bg-[#fdfaf5] transition-colors"
                    >
                      {/* Date & ID */}
                      <td className="px-6 py-4 align-middle">
                        <div className="font-semibold text-[#4f4137]">
                          {formatDate(p.created_at)}
                        </div>
                        {p.stripe_payment_intent_id && (
                          <div className="mt-1 flex items-center gap-1.5 group/pi">
                            <span className="text-[10px] font-bold uppercase text-[#a79a8f]">
                              PI:
                            </span>
                            <code className="text-xs text-[#7c6d62] font-mono bg-[#f5f1ea] px-1.5 py-0.5 rounded">
                              {p.stripe_payment_intent_id.slice(0, 14)}...
                            </code>
                            <button
                              onClick={() =>
                                handleCopy(p.stripe_payment_intent_id)
                              }
                              className="text-[#a79a8f] opacity-0 group-hover/pi:opacity-100 hover:text-[#8b6f47] transition-all"
                              title="Copy full ID"
                            >
                              <CopyIcon className="h-3.5 w-3.5" />
                            </button>
                            {copiedValue === p.stripe_payment_intent_id && (
                              <span className="text-[10px] font-medium text-emerald-600 animate-in fade-in">
                                Copied
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="px-6 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-[#f5f1ea] border border-[#e7e0d6] flex items-center justify-center text-xs font-bold text-[#8b6f47]">
                            {(p.customer_name || "G")[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-[#2f261f]">
                              {p.customer_name || "Guest"}
                            </div>
                            <div className="flex items-center gap-1.5 group/email mt-0.5">
                              <span className="text-xs text-[#7c6d62]">
                                {p.customer_email || "No email"}
                              </span>
                              {p.customer_email && (
                                <>
                                  <button
                                    onClick={() => handleCopy(p.customer_email)}
                                    className="text-[#a79a8f] opacity-0 group-hover/email:opacity-100 hover:text-[#8b6f47] transition-all"
                                  >
                                    <CopyIcon className="h-3 w-3" />
                                  </button>
                                  {copiedValue === p.customer_email && (
                                    <span className="text-[10px] font-medium text-emerald-600 animate-in fade-in">
                                      Copied
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Booking */}
                      <td className="px-6 py-4 align-middle">
                        {p.booking_id ? (
                          <Link
                            href={`/admin/bookings/${p.booking_id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e7e0d6] bg-[#fbfaf7] px-2.5 py-1.5 text-xs font-medium text-[#4f4137] hover:border-[#8b6f47] hover:text-[#8b6f47] transition-colors"
                          >
                            #{p.booking_id}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-[#a79a8f]">—</span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="px-6 py-4 align-middle">
                        <div className="font-serif text-lg text-[#2f261f]">
                          {formatMoney(p.amount_cents, p.currency || "EUR")}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[#a79a8f]">
                          <CreditCard className="h-3 w-3" />{" "}
                          {p.method || "card"}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 align-middle">
                        <StatusBadge status={p.status} />
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 align-middle text-right">
                        <div className="flex items-center justify-end gap-2">
                          {p.receipt_url && (
                            <a
                              href={p.receipt_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-[#e7e0d6] bg-white text-[#7c6d62] hover:text-[#8b6f47] hover:border-[#8b6f47] transition-colors"
                              title="View Receipt"
                            >
                              <Receipt className="h-4 w-4" />
                            </a>
                          )}
                          <Link
                            href={`/admin/payments/${p.id}`}
                            className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#f5f1ea] text-[#4f4137] text-xs font-semibold hover:bg-[#e7e0d6] transition-colors"
                          >
                            Details
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer / Pagination */}
          {rows.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#efe9e1] bg-[#fbfaf7] px-6 py-4">
              <div className="text-xs font-medium text-[#7c6d62]">
                Showing page{" "}
                <span className="text-[#2f261f] font-bold">
                  {pageIndex + 1}
                </span>{" "}
                {hasMore ? "" : "(End of list)"}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pageIndex <= 0}
                  onClick={goPrev}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-[#e7e0d6] bg-white text-[#4f4137] hover:bg-[#f5f1ea] disabled:opacity-40 disabled:hover:bg-white transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={!hasMore}
                  onClick={goNext}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-[#e7e0d6] bg-white text-[#4f4137] hover:bg-[#f5f1ea] disabled:opacity-40 disabled:hover:bg-white transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Helper components                            */
/* -------------------------------------------------------------------------- */

function StatusBadge({ status }) {
  const map = {
    succeeded: {
      text: "Succeeded",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    refunded: {
      text: "Refunded",
      cls: "bg-sky-50 text-sky-700 border-sky-200",
    },
    partially_refunded: {
      text: "Partially refunded",
      cls: "bg-sky-50 text-sky-700 border-sky-200",
    },
    processing: {
      text: "Processing",
      cls: "bg-amber-50 text-amber-800 border-amber-200",
    },
    requires_action: {
      text: "Requires action",
      cls: "bg-amber-50 text-amber-800 border-amber-200",
    },
    requires_payment_method: {
      text: "Requires payment method",
      cls: "bg-amber-50 text-amber-800 border-amber-200",
    },
    requires_confirmation: {
      text: "Requires confirmation",
      cls: "bg-amber-50 text-amber-800 border-amber-200",
    },
    requires_capture: {
      text: "Requires capture",
      cls: "bg-amber-50 text-amber-800 border-amber-200",
    },
    canceled: {
      text: "Canceled",
      cls: "bg-[#f5f1ea] text-[#7c6d62] border-[#e7e0d6]",
    },
    failed: {
      text: "Failed",
      cls: "bg-rose-50 text-rose-700 border-rose-200",
    },
  };

  const meta = map[status] || {
    text: String(status || "Unknown").replace(/_/g, " "),
    cls: "bg-[#f5f1ea] text-[#7c6d62] border-[#e7e0d6]",
  };

  return (
    <span
      className={classNames(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase",
        meta.cls,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {meta.text}
    </span>
  );
}

function SummaryCard({ icon, label, value, helper }) {
  return (
    <div className="flex items-start gap-4 rounded-[1.5rem] border border-[#e7e0d6] bg-white p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-md transition-shadow">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fbfaf7] border border-[#efe9e1]">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#a79a8f]">
          {label}
        </p>
        <p className="mt-1 text-2xl font-serif text-[#2f261f]">{value}</p>
        {helper && (
          <p className="mt-1 text-xs font-medium text-[#7c6d62]">{helper}</p>
        )}
      </div>
    </div>
  );
}
