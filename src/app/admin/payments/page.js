"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar as CalIcon,
  ChevronDown,
  Download,
  Filter,
  Loader2,
  RefreshCcw,
  Search,
  ExternalLink,
  Receipt,
  CreditCard,
  DollarSign,
  AlertCircle,
  Undo2,
  Copy as CopyIcon,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                                   Utils                                    */
/* -------------------------------------------------------------------------- */

const ATHENS_TZ = "Europe/Athens";
const PAGE_SIZE = 20;
const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "succeeded", label: "Succeeded" },
  { value: "refunded", label: "Refunded" },
  { value: "partially_refunded", label: "Partially refunded" },
  { value: "pending", label: "Pending" },
  { value: "requires_action", label: "Requires action" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];
const METHOD_OPTIONS = [
  { value: "", label: "All methods" },
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "pos", label: "POS" },
  { value: "stripe", label: "Stripe" },
];
const SORT_OPTIONS = [
  { value: "created_at.desc", label: "Newest first" },
  { value: "created_at.asc", label: "Oldest first" },
  { value: "amount_cents.desc", label: "Amount (high → low)" },
  { value: "amount_cents.asc", label: "Amount (low → high)" },
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
  if (!d) return "-";
  try {
    const date =
      typeof d === "string" || typeof d === "number" ? new Date(d) : d;
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

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function downloadCSV(filename, rows) {
  const processValue = (v) => {
    if (v === null || v === undefined) return "";
    // Escape quotes and commas
    const s = String(v).replaceAll('"', '""');
    if (s.includes(",") || s.includes("\n") || s.includes('"'))
      return '"' + s + '"';
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
/*                               Data interfaces                              */
/* -------------------------------------------------------------------------- */

/** @typedef {Object} Payment */
/** @property {number} id */
/** @property {string} created_at */
/** @property {number} amount_cents */
/** @property {string} currency */
/** @property {string} status */
/** @property {string} method */
/** @property {string | null} customer_name */
/** @property {string | null} customer_email */
/** @property {number | null} booking_id */
/** @property {string | null} stripe_payment_intent_id */
/** @property {string | null} receipt_url */
/** @property {string | null} notes */

/* -------------------------------------------------------------------------- */
/*                                   Page                                     */
/* -------------------------------------------------------------------------- */

export default function PaymentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filters & state
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [method, setMethod] = useState(searchParams.get("method") || "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("from") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("to") || "");
  const [sort, setSort] = useState(
    searchParams.get("sort") || "created_at.desc"
  );

  const [page, setPage] = useState(Number(searchParams.get("page") || 1));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState(/** @type {Payment[]} */ ([]));
  const [total, setTotal] = useState(0);
  const [auth, setAuth] = useState({ loading: true, ok: true });

  // Gate: require auth
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

  const paramsString = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    if (method) p.set("method", method);
    if (dateFrom) p.set("from", dateFrom);
    if (dateTo) p.set("to", dateTo);
    if (sort) p.set("sort", sort);
    if (page && page !== 1) p.set("page", String(page));
    return p.toString();
  }, [q, status, method, dateFrom, dateTo, sort, page]);

  // Push filters to URL
  useEffect(() => {
    const url = paramsString
      ? `/admin/payments?${paramsString}`
      : "/admin/payments";
    router.replace(url);
  }, [paramsString, router]);

  // Fetch
  useEffect(() => {
    let ignore = false;
    const ctrl = new AbortController();
    setLoading(true);
    setError("");
    (async () => {
      try {
        const qs = paramsString ? `?${paramsString}` : "";
        const res = await fetch(`/api/admin/payments${qs}`, {
          method: "GET",
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`Failed to load payments (${res.status})`);
        const data = await res.json();
        if (ignore) return;
        setRows(Array.isArray(data.payments) ? data.payments : []);
        setTotal(Number(data.total || 0));
      } catch (e) {
        if (ignore) return;
        setError(e?.message || "Failed to load payments");
        setRows([]);
        setTotal(0);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
      ctrl.abort();
    };
  }, [paramsString]);

  const fromToLabel = useMemo(() => {
    if (!dateFrom && !dateTo) return "Any time";
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;
    const f = from ? from.toLocaleDateString("en-GB") : "…";
    const t = to ? to.toLocaleDateString("en-GB") : "…";
    return `${f} → ${t}`;
  }, [dateFrom, dateTo]);

  const pageCount = Math.max(1, Math.ceil((total || 0) / PAGE_SIZE));
  const startIdx = (page - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(total, page * PAGE_SIZE);

  const exportCSV = () => {
    const headers = [
      "ID",
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
      "Notes",
    ];
    const data = rows.map((p) => [
      p.id,
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
      p.notes || "",
    ]);
    downloadCSV(`payments_${Date.now()}.csv`, [headers, ...data]);
  };

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
          <h1 className="text-2xl font-semibold tracking-tight text-[#3f342c]">
            Payments
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#5a4a3f] hover:bg-[#faf8f5]"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            onClick={() => {
              setPage(1);
              setQ("");
              setStatus("");
              setMethod("");
              setDateFrom("");
              setDateTo("");
              setSort("created_at.desc");
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#5a4a3f] hover:bg-[#faf8f5]"
          >
            <RefreshCcw className="h-4 w-4" /> Reset
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 grid grid-cols-1 gap-3 rounded-2xl border border-[#e8e5df] bg-[#fcf9f4] p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <div className="col-span-2 flex items-center gap-2 rounded-xl border border-[#e8e5df] bg-white px-3">
          <Search className="h-4 w-4 text-[#7a6a58]" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
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
              setPage(1);
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
              setPage(1);
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
              setPage(1);
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
        <div className="flex items-center gap-2 rounded-xl border border-[#e8e5df] bg-white px-3">
          <CreditCard className="h-4 w-4 text-[#7a6a58]" />
          <select
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setPage(1);
            }}
            className="h-10 w-full bg-transparent text-sm outline-none"
          >
            {METHOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[#e8e5df] bg-white px-3">
          <ChevronDown className="h-4 w-4 text-[#7a6a58]" />
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="h-10 w-full bg-transparent text-sm outline-none"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="mt-6 rounded-2xl border border-[#e8e5df] bg-white">
        <div className="flex items-center justify-between border-b border-[#eeeae3] px-4 py-3 text-sm text-[#7a6a58]">
          <p>
            Showing{" "}
            <span className="font-medium text-[#3f342c]">
              {startIdx}-{endIdx}
            </span>{" "}
            of <span className="font-medium text-[#3f342c]">{total}</span>{" "}
            payments
          </p>
          <p className="hidden sm:block">Date range: {fromToLabel}</p>
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
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-[#a09386]">
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
                                // eslint-disable-next-line no-alert
                                window.alert(
                                  "Payment Intent ID copied to clipboard"
                                );
                              }
                            }}
                            className="ml-1 inline-flex items-center rounded p-0.5 hover:bg-[#f1ebe3]"
                            title="Copy"
                          >
                            <CopyIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#3f342c]">
                        {p.customer_name || "—"}
                      </div>
                      <div className="text-xs text-[#7a6a58]">
                        {p.customer_email || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.booking_id ? (
                        <Link
                          href={`/admin/reservations/${p.booking_id}`}
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
        <div className="flex items-center justify-between border-t border-[#eeeae3] px-4 py-3 text-sm">
          <div className="text-[#7a6a58]">
            Page {page} of {pageCount}
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={classNames(
                "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5",
                page <= 1
                  ? "cursor-not-allowed border-[#eeeae3] text-[#c1b8ae]"
                  : "border-[#e8e5df] text-[#5a4a3f] hover:bg-[#faf8f5]"
              )}
            >
              Prev
            </button>
            <button
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              className={classNames(
                "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5",
                page >= pageCount
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
    pending: {
      text: "Pending",
      cls: "bg-amber-50 text-amber-800 border-amber-200",
    },
    requires_action: {
      text: "Requires action",
      cls: "bg-amber-50 text-amber-800 border-amber-200",
    },
    failed: { text: "Failed", cls: "bg-rose-50 text-rose-700 border-rose-200" },
    cancelled: {
      text: "Cancelled",
      cls: "bg-zinc-50 text-zinc-700 border-zinc-200",
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
