"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                                   Utils                                    */
/* -------------------------------------------------------------------------- */

const ATHENS_TZ = "Europe/Athens";

// Stripe-native PaymentIntent statuses (plus derived refund labels)
const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "succeeded", label: "Succeeded" },
  { value: "processing", label: "Processing" },
  { value: "requires_action", label: "Requires action" },
  { value: "requires_payment_method", label: "Requires payment method" },
  { value: "requires_confirmation", label: "Requires confirmation" },
  { value: "requires_capture", label: "Requires capture" },
  { value: "canceled", label: "Canceled" },
  // derived client-side from refunds:
  { value: "refunded", label: "Refunded (derived)" },
  { value: "partially_refunded", label: "Partially refunded (derived)" },
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
/*                                   Page                                     */
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

  // Filters panel (mobile)
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Cursor-based pagination
  const [pageIndex, setPageIndex] = useState(
    Math.max(0, Number(searchParams.get("page") || 1) - 1)
  );
  const [cursorStack, setCursorStack] = useState([null]); // per-page starting_after cursor

  // Data state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);

  // Copy feedback (for PI or email)
  const [copiedValue, setCopiedValue] = useState("");

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

  // Build query string for URL (shareable filters)
  const paramsString = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    if (dateFrom) p.set("from", dateFrom);
    if (dateTo) p.set("to", dateTo);
    if (pageIndex > 0) p.set("page", String(pageIndex + 1));
    return p.toString();
  }, [q, status, dateFrom, dateTo, pageIndex]);

  // Push filters to URL
  useEffect(() => {
    const url = paramsString
      ? `/admin/payments?${paramsString}`
      : "/admin/payments";
    router.replace(url);
  }, [paramsString, router]);

  // Debounce search input -> q filter
  useEffect(() => {
    const handle = setTimeout(() => {
      setPageIndex(0);
      setCursorStack([null]);
      setQ(searchInput.trim());
    }, 400);

    return () => clearTimeout(handle);
  }, [searchInput]);

  // Keep searchInput in sync if q changes from URL / reset
  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  // Label for date range
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
    []
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

    // Fallback name from email if name is missing
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

  // Fetch current page using cursorStack[pageIndex] as starting_after
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
  }, [q, status, dateFrom, dateTo, pageIndex, cursorStack]);

  const goReset = () => {
    setQ("");
    setSearchInput("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
    setPageIndex(0);
    setCursorStack([null]);
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
    q || status || dateFrom || dateTo || pageIndex > 0
  );
  const showSummary = !loading && !error && rows.length > 0;

  if (auth.loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center gap-3 text-[#5a4a3f]">
          <Loader2 className="h-5 w-5 animate-spin" />
          <p>Checking access…</p>
        </div>
      </div>
    );
  }

  if (!auth.ok) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
        <h1 className="mt-3 text-xl font-semibold text-[#3f342c]">
          Not authorized
        </h1>
        <p className="mt-2 text-sm text-[#7a6a58]">
          Please sign in to view payments.
        </p>
        <div className="mt-6">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-[#3f342c] px-4 py-2 text-white hover:bg-[#2f2721]"
          >
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#e8e5df] bg-white px-3 text-sm text-[#5a4a3f] hover:bg-[#faf8f5]"
          >
            <ArrowLeft className="h-4 w-4" />
            Admin
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#3f342c]">
              Payments
            </h1>
            <p className="mt-1 text-xs text-[#7a6a58]">
              Search, filter and export Stripe payments linked to your bookings.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={!rows.length || loading}
            className={classNames(
              "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
              !rows.length || loading
                ? "cursor-not-allowed border-[#eeeae3] bg-[#f9f6f0] text-[#c1b8ae]"
                : "border-[#e8e5df] bg-white text-[#5a4a3f] hover:bg-[#faf8f5]"
            )}
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            onClick={goReset}
            disabled={!isFiltered}
            className={classNames(
              "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
              !isFiltered
                ? "cursor-not-allowed border-[#eeeae3] bg-[#f9f6f0] text-[#c1b8ae]"
                : "border-[#e8e5df] bg-white text-[#5a4a3f] hover:bg-[#faf8f5]"
            )}
          >
            <RefreshCcw className="h-4 w-4" /> Reset filters
          </button>
        </div>
      </div>

      {/* Summary cards (current page) */}
      {showSummary && (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryCard
            icon={<CreditCard className="h-5 w-5 text-[#7a6a58]" />}
            label="Total (this page)"
            value={formatMoney(stats.totalAmount, rows[0]?.currency || "EUR")}
            helper="Sum of amounts for visible payments"
          />
          <SummaryCard
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            label="Succeeded"
            value={`${stats.succeededCount} payment${
              stats.succeededCount === 1 ? "" : "s"
            }`}
            helper="Completed and captured payments"
          />
          <SummaryCard
            icon={<RotateCcw className="h-5 w-5 text-sky-600" />}
            label="Refunded"
            value={`${stats.refundedCount} payment${
              stats.refundedCount === 1 ? "" : "s"
            }`}
            helper="Fully or partially refunded"
          />
        </div>
      )}

      {/* Filters toggle (mobile) */}
      <div className="mt-6 flex items-center justify-between gap-3 sm:hidden">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl border border-[#e8e5df] bg-[#fcf9f4] px-3 py-2 text-xs text-[#5a4a3f]"
        >
          <Filter className="h-4 w-4" />
          <span>{filtersOpen ? "Hide filters" : "Show filters"}</span>
        </button>
        <div className="text-[11px] text-right text-[#7a6a58]">
          <div>{fromToLabel}</div>
          {status && (
            <div className="mt-0.5">
              Status:{" "}
              <span className="font-medium">
                {STATUS_OPTIONS.find((s) => s.value === status)?.label ||
                  status}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div
        className={classNames(
          "mt-3 sm:mt-6 gap-3 rounded-2xl border border-[#e8e5df] bg-[#fcf9f4] p-4",
          filtersOpen
            ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
            : "hidden sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
        )}
      >
        <div className="col-span-1 sm:col-span-2 flex items-center gap-2 rounded-xl border border-[#e8e5df] bg-white px-3">
          <Search className="h-4 w-4 text-[#7a6a58]" />
          <input
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
            }}
            placeholder="Search name, email, booking, PI…"
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-[#a09386]"
          />
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[#e8e5df] bg-white px-3">
          <CalIcon className="h-4 w-4 text-[#7a6a58]" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPageIndex(0);
              setCursorStack([null]);
            }}
            className="h-10 w-full bg-transparent text-sm outline-none"
          />
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[#e8e5df] bg-white px-3">
          <CalIcon className="h-4 w-4 text-[#7a6a58]" />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPageIndex(0);
              setCursorStack([null]);
            }}
            className="h-10 w-full bg-transparent text-sm outline-none"
          />
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[#e8e5df] bg-white px-3">
          <Filter className="h-4 w-4 text-[#7a6a58]" />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPageIndex(0);
              setCursorStack([null]);
            }}
            className="h-10 w-full bg-transparent text-sm outline-none"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Quick range chips */}
        <div className="col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-5 flex flex-wrap items-center gap-2 text-xs text-[#7a6a58]">
          <span className="font-medium text-[#5a4a3f]">Quick range:</span>
          {[
            { key: "any", label: "Any time" },
            { key: "today", label: "Today" },
            { key: "7d", label: "Last 7 days" },
            { key: "30d", label: "Last 30 days" },
          ].map((opt) => {
            let isActive = false;
            if (opt.key === "any") {
              isActive = !dateFrom && !dateTo;
            } else {
              const range = quickRanges[opt.key];
              if (range) {
                isActive =
                  dateFrom === range.from && dateTo === range.to && !!dateFrom;
              }
            }
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => handleQuickRange(opt.key)}
                className={classNames(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1",
                  isActive
                    ? "border-[#3f342c] bg-[#3f342c] text-white"
                    : "border-[#e8e5df] bg-white text-[#5a4a3f] hover:bg-[#faf8f5]"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="mt-6 rounded-2xl border border-[#e8e5df] bg-white">
        <div className="flex items-center justify-between border-b border-[#eeeae3] px-4 py-3 text-sm text-[#7a6a58]">
          <p>
            Page{" "}
            <span className="font-medium text-[#3f342c]">{pageIndex + 1}</span>
            {hasMore ? "" : " (end)"}
          </p>
          <p className="hidden sm:block">
            Date range: <span className="font-medium">{fromToLabel}</span>
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 px-4 py-10 text-[#7a6a58]">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading payments…
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 px-4 py-10 text-rose-600">
            <AlertCircle className="h-5 w-5" /> {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-10 text-[#7a6a58]">No payments found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#fcf9f4] text-[#7a6a58]">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Booking</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-[#f0ece6] hover:bg-[#fcfbf8]"
                  >
                    <td className="px-4 py-3 text-[#3f342c]">
                      <div className="font-medium">
                        {formatDate(p.created_at)}
                      </div>
                      {p.stripe_payment_intent_id && (
                        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-[#a09386]">
                          <span>PI:</span>
                          <code className="rounded bg-[#f6f2ec] px-1 py-0.5">
                            {p.stripe_payment_intent_id}
                          </code>
                          <button
                            onClick={async () => {
                              const ok = await copyToClipboard(
                                p.stripe_payment_intent_id || ""
                              );
                              if (ok) {
                                setCopiedValue(p.stripe_payment_intent_id);
                                setTimeout(() => {
                                  setCopiedValue((current) =>
                                    current === p.stripe_payment_intent_id
                                      ? ""
                                      : current
                                  );
                                }, 1500);
                              }
                            }}
                            className="ml-1 inline-flex items-center rounded p-0.5 hover:bg-[#f1ebe3]"
                            title="Copy Payment Intent ID"
                          >
                            <CopyIcon className="h-3.5 w-3.5" />
                          </button>
                          {copiedValue === p.stripe_payment_intent_id && (
                            <span className="text-[10px] font-medium text-emerald-700">
                              Copied
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#3f342c]">
                        {p.customer_name || "—"}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-[#7a6a58]">
                        {p.customer_email ? (
                          <>
                            <a
                              href={`mailto:${p.customer_email}`}
                              className="hover:underline"
                            >
                              {p.customer_email}
                            </a>
                            <button
                              onClick={async () => {
                                const ok = await copyToClipboard(
                                  p.customer_email || ""
                                );
                                if (ok) {
                                  setCopiedValue(p.customer_email);
                                  setTimeout(() => {
                                    setCopiedValue((current) =>
                                      current === p.customer_email
                                        ? ""
                                        : current
                                    );
                                  }, 1500);
                                }
                              }}
                              className="inline-flex items-center rounded p-0.5 hover:bg-[#f1ebe3]"
                              title="Copy email"
                            >
                              <CopyIcon className="h-3.5 w-3.5" />
                            </button>
                            {copiedValue === p.customer_email && (
                              <span className="text-[10px] font-medium text-emerald-700">
                                Copied
                              </span>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.booking_id ? (
                        <Link
                          href={`/admin/bookings/${p.booking_id}`}
                          className="inline-flex items-center gap-1 text-[#3f342c] underline-offset-2 hover:underline"
                        >
                          #{p.booking_id}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <span className="text-[#7a6a58]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#3f342c]">
                        {formatMoney(p.amount_cents, p.currency || "EUR")}
                      </div>
                      <div className="text-xs text-[#7a6a58]">
                        {p.currency || "EUR"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-1 text-[#3f342c]">
                        <CreditCard className="h-4 w-4" /> {p.method || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {p.receipt_url && (
                          <a
                            href={p.receipt_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-[#e8e5df] bg-white px-2 py-1 text-xs text-[#5a4a3f] hover:bg-[#faf8f5]"
                          >
                            <Receipt className="h-3.5 w-3.5" /> Receipt
                          </a>
                        )}
                        <Link
                          href={`/admin/payments/${p.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#e8e5df] bg-white px-2 py-1 text-xs text-[#5a4a3f] hover:bg-[#faf8f5]"
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
        <div className="flex flex-col gap-2 border-t border-[#eeeae3] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[#7a6a58]">
            Page {pageIndex + 1} {hasMore ? "" : "(end)"} •{" "}
            {rows.length ? `${rows.length} payments on this page` : "No data"}
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={pageIndex <= 0}
              onClick={goPrev}
              className={classNames(
                "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5",
                pageIndex <= 0
                  ? "cursor-not-allowed border-[#eeeae3] text-[#c1b8ae]"
                  : "border-[#e8e5df] text-[#5a4a3f] hover:bg-[#faf8f5]"
              )}
            >
              Prev
            </button>
            <button
              disabled={!hasMore}
              onClick={goNext}
              className={classNames(
                "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5",
                !hasMore
                  ? "cursor-not-allowed border-[#eeeae3] text-[#c1b8ae]"
                  : "border-[#e8e5df] text-[#5a4a3f] hover:bg-[#faf8f5]"
              )}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Legend / Help */}
      <div className="mt-6 text-xs text-[#7a6a58]">
        <p>
          Tip: Use the search box for name, email, Booking ID (e.g.{" "}
          <code>#123</code>) or Stripe Payment Intent (e.g. <code>pi_*</code>).
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Helper components                            */
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
      cls: "bg-zinc-50 text-zinc-700 border-zinc-200",
    },
    failed: {
      text: "Failed",
      cls: "bg-rose-50 text-rose-700 border-rose-200",
    },
  };

  const meta = map[status] || {
    text: String(status || "Unknown"),
    cls: "bg-zinc-50 text-zinc-700 border-zinc-200",
  };

  return (
    <span
      className={classNames(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
        meta.cls
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />{" "}
      {meta.text}
    </span>
  );
}

function SummaryCard({ icon, label, value, helper }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[#e8e5df] bg-[#fcf9f4] px-4 py-3">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-[11px] font-medium tracking-wide text-[#7a6a58] uppercase">
          {label}
        </p>
        <p className="mt-1 text-base font-semibold text-[#3f342c]">{value}</p>
        {helper && (
          <p className="mt-0.5 text-[11px] text-[#a09386]">{helper}</p>
        )}
      </div>
    </div>
  );
}
