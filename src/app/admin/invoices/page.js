"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Download,
  CheckCircle2,
  CalendarDays,
  Users,
  Loader2,
  Search,
  Mail,
} from "lucide-react";

/**
 * /admin/invoices — Admin-facing invoices list
 * JS-only (no TS)
 *
 * Endpoints:
 *   - First‑party invoices (v2): /api/admin/invoices2
 *   - Stripe payments (legacy bookings): /api/admin/invoices
 *
 * Both endpoints return a compatible row shape used below.
 */
export default function AdminInvoicesPage() {
  const router = useRouter();

  // --- UI state ---
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [ok, setOk] = React.useState("");

  const [rows, setRows] = React.useState([]); // API page rows
  const [total, setTotal] = React.useState(0);
  const [pageTotal, setPageTotal] = React.useState(0);
  const [apiCurrency, setApiCurrency] = React.useState("EUR");

  // Filters
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all"); // API expects "all" for no filter
  const [dateFrom, setDateFrom] = React.useState(""); // yyyy-mm-dd
  const [dateTo, setDateTo] = React.useState("");

  // Pagination (server-driven)
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [totalPages, setTotalPages] = React.useState(1);

  // Sorting (client-side for the current page only)
  const [sortKey, setSortKey] = React.useState("createdAt");
  const [sortDir, setSortDir] = React.useState("desc"); // asc|desc

  // Data source tab: 'fp' (first-party invoices v2) or 'stripe' (bookings payments)
  const [mode, setMode] = React.useState("fp");

  // Per-row busy state (e.g., sending)
  const [busy, setBusy] = React.useState({ id: null, type: "" });

  // Re-fetch when filters/paging change
  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        setError("");
        const { data, meta } = await fetchInvoices({
          q: search,
          status,
          from: dateFrom,
          to: dateTo,
          p: page,
          per: pageSize,
          apiBase:
            mode === "stripe" ? "/api/admin/invoices" : "/api/admin/invoices2",
        });
        if (cancelled) return;
        setRows(sortClient(data));
        setTotal(meta.total || 0);
        const tp = Math.max(1, Math.ceil((meta.total || 0) / meta.perPage));
        setTotalPages(tp);
        setPageTotal(meta.pageTotal || 0);
        setApiCurrency(meta.currency || "EUR");
      } catch (e) {
        if (!cancelled) setError(e?.message || "Failed to load invoices.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    search,
    status,
    dateFrom,
    dateTo,
    page,
    pageSize,
    sortKey,
    sortDir,
    mode,
  ]);

  // Reset to page 1 when any filter changes (except page/per)
  React.useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, dateFrom, dateTo, mode]);

  // --- Metrics (based on API response) ---
  const metrics = React.useMemo(() => {
    const paidCount = rows.filter(
      (r) => (r.status || "").toLowerCase() === "paid"
    ).length;
    const unpaidAmount = rows
      .filter((r) => (r.status || "").toLowerCase() !== "paid")
      .reduce((s, r) => s + Number(r.totalPaidAmount || 0), 0);
    return {
      totalResults: total,
      pageAmount: pageTotal,
      pageUnpaidAmount: unpaidAmount,
      paidCount,
    };
  }, [rows, total, pageTotal]);

  // --- Row actions ---
  function openPdf(id) {
    const base =
      mode === "stripe" ? "/api/admin/invoices" : "/api/admin/invoices2";
    window.open(`${base}/${id}/pdf`, "_blank");
  }
  function downloadPdf(id) {
    const base =
      mode === "stripe" ? "/api/admin/invoices" : "/api/admin/invoices2";
    window.open(`${base}/${id}/download`, "_blank");
  }
  async function sendInvoice(id) {
    try {
      setOk("");
      setError("");
      setBusy({ id, type: "send" });
      const base =
        mode === "stripe" ? "/api/admin/invoices" : "/api/admin/invoices2";
      const res = await fetch(`${base}/${id}/send`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json().catch(() => ({}));
      setOk(json?.message || "Invoice email queued.");
    } catch (e) {
      setError(e?.message || "Failed to send invoice.");
    } finally {
      setBusy({ id: null, type: "" });
    }
  }

  // --- Render ---
  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Invoices
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Search, export CSV, and drill into{" "}
            {mode === "stripe" ? "Stripe payments" : "first‑party invoices"}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              window.open(
                buildCsvUrl({
                  q: search,
                  status,
                  from: dateFrom,
                  to: dateTo,
                  apiBase:
                    mode === "stripe"
                      ? "/api/admin/invoices"
                      : "/api/admin/invoices2",
                }),
                "_blank"
              )
            }
            className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm hover:bg-zinc-50"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <Link
            href="/admin/invoices/new"
            className="inline-flex items-center gap-2 rounded-xl bg-black text-white px-3.5 py-2 text-sm hover:bg-zinc-800"
          >
            <Plus className="h-4 w-4" /> New Invoice
          </Link>
        </div>
      </div>

      {/* Source toggle */}
      <div className="mt-5">
        <div className="inline-flex rounded-xl border bg-white p-1">
          <button
            onClick={() => setMode("fp")}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              mode === "fp"
                ? "bg-black text-white"
                : "text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            Invoices
          </button>
          <button
            onClick={() => setMode("stripe")}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              mode === "stripe"
                ? "bg-black text-white"
                : "text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            Stripe payments
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-6">
        <MetricCard
          icon={<FileText className="h-5 w-5" />}
          label="Total results"
          value={metrics.totalResults}
        />
        <MetricCard
          icon={<Users className="h-5 w-5" />}
          label="Paid this page"
          value={metrics.paidCount}
        />
        <MetricCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Amount (this page)"
          value={formatCurrency(metrics.pageAmount, apiCurrency)}
        />
        <MetricCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Unpaid (this page)"
          value={formatCurrency(metrics.pageUnpaidAmount, apiCurrency)}
        />
      </div>

      {/* Filters */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-4 flex items-center gap-2 rounded-xl border px-3 py-2 bg-white">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              mode === "stripe"
                ? "Search booking id, email, name, Stripe…"
                : "Search invoice no, customer, email…"
            }
            className="w-full bg-transparent outline-none text-sm"
          />
        </div>
        <div className="lg:col-span-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 bg-white text-sm"
          >
            <option value="all">All statuses</option>
            <option value="paid">paid</option>
            <option value="pending">pending</option>
            <option value="confirmed">confirmed</option>
            <option value="cancelled">cancelled</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
            <option value="completed">completed</option>
            <option value="finalized">finalized</option>
            <option value="draft">draft</option>
            <option value="sent">sent</option>
          </select>
        </div>
        <div className="lg:col-span-3 grid grid-cols-2 gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl border px-3 py-2 bg-white text-sm"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl border px-3 py-2 bg-white text-sm"
          />
        </div>
        <div className="lg:col-span-2 flex items-center justify-end gap-2">
          <div className="text-sm text-zinc-500">
            {total} result{total === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded-2xl border bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 text-zinc-600">
              <Th
                onSort={() => toggleSort("invoiceNo")}
                active={sortKey === "invoiceNo"}
                dir={sortDir}
              >
                Invoice
              </Th>
              <Th>Customer</Th>
              <Th
                onSort={() => toggleSort("createdAt")}
                active={sortKey === "createdAt"}
                dir={sortDir}
              >
                <div className="inline-flex items-center gap-1">
                  <CalendarDays className="h-4 w-4" /> Created
                </div>
              </Th>
              <Th
                onSort={() => toggleSort("startTime")}
                active={sortKey === "startTime"}
                dir={sortDir}
              >
                Start
              </Th>
              <Th
                onSort={() => toggleSort("numberOfPeople")}
                active={sortKey === "numberOfPeople"}
                dir={sortDir}
                className="text-right"
              >
                Guests
              </Th>
              <Th
                onSort={() => toggleSort("totalPaidAmount")}
                active={sortKey === "totalPaidAmount"}
                dir={sortDir}
                className="text-right"
              >
                Amount
              </Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-zinc-500">
                  <div className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading
                    invoices…
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-zinc-500">
                  No invoices found.
                </td>
              </tr>
            ) : (
              rows.map((inv) => (
                <tr key={inv.id} className="border-t hover:bg-zinc-50/60">
                  <Td className="font-medium">
                    <button
                      onClick={() => router.push(`/admin/invoices/${inv.id}`)}
                      className="underline underline-offset-4 hover:text-zinc-900"
                    >
                      {inv.invoiceNo}
                    </button>
                  </Td>
                  <Td>
                    <div className="leading-tight">
                      <div className="font-medium">
                        {inv.customer?.name || "—"}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {inv.customer?.email || ""}
                      </div>
                    </div>
                  </Td>
                  <Td className="text-zinc-600">{formatDate(inv.createdAt)}</Td>
                  <Td className="text-zinc-600">
                    {formatDate(inv.startTime) || "—"}
                  </Td>
                  <Td className="text-right text-zinc-600">
                    {mode === "stripe" ? Number(inv.numberOfPeople || 1) : "—"}
                  </Td>
                  <Td className="text-right font-medium">
                    {formatCurrency(
                      inv.totalPaidAmount,
                      inv.currency || apiCurrency
                    )}
                  </Td>
                  <Td>{statusBadge(inv.status)}</Td>
                  <Td className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        className="px-2 py-1 rounded-lg hover:bg-zinc-100"
                        onClick={() => openPdf(inv.id)}
                        aria-label="Open PDF"
                        title="Open PDF"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                      <button
                        className="px-2 py-1 rounded-lg hover:bg-zinc-100"
                        onClick={() => downloadPdf(inv.id)}
                        aria-label="Download PDF"
                        title="Download PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        className="px-2 py-1 rounded-lg hover:bg-zinc-100"
                        onClick={() => sendInvoice(inv.id)}
                        aria-label="Send invoice"
                        title="Send invoice"
                        disabled={busy.id === inv.id && busy.type === "send"}
                      >
                        {busy.id === inv.id && busy.type === "send" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="text-sm text-zinc-500">
          Page {page} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-xl border px-3 py-2 bg-white text-sm"
          >
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50 bg-white"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50 bg-white"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Banners */}
      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      {ok && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {ok}
        </div>
      )}
    </div>
  );

  // --- helpers ---
  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
    setRows((prev) => sortClient([...prev], key));
  }

  function sortClient(data, key = sortKey, dir = sortDir) {
    const arr = [...data];
    const d = dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const va = a[key];
      const vb = b[key];
      if (key === "totalPaidAmount" || key === "numberOfPeople") {
        return (Number(va) - Number(vb)) * d;
      }
      // string or date
      const aIsDate = !isNaN(new Date(va));
      const bIsDate = !isNaN(new Date(vb));
      if (aIsDate && bIsDate) return (new Date(va) - new Date(vb)) * d;
      return String(va || "").localeCompare(String(vb || "")) * d;
    });
    return arr;
  }
}

// --- Tiny presentational atoms ---
function MetricCard({ icon, label, value }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-500">{label}</div>
        <div className="text-zinc-400">{icon}</div>
      </div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}

function Th({ children, className = "", onSort, active = false, dir = "asc" }) {
  return (
    <th
      className={`px-3 py-3 text-left text-xs font-medium uppercase tracking-wide ${className}`}
    >
      {onSort ? (
        <button
          onClick={onSort}
          className={`inline-flex items-center gap-1 hover:text-zinc-900 ${
            active ? "text-zinc-900" : "text-zinc-600"
          }`}
        >
          {children}
          {active && (
            <span className="text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>
          )}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

function Td({ children, className = "" }) {
  return <td className={`px-3 py-3 align-middle ${className}`}>{children}</td>;
}

// --- Fetching & utils ---
async function fetchInvoices({ q, status, from, to, p, per, apiBase }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status); // "all" passes through
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (p) params.set("p", String(p));
  if (per) params.set("per", String(per));

  const res = await fetch(`${apiBase}?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const data = Array.isArray(json?.data) ? json.data : [];
  const meta = {
    page: json?.page || 1,
    perPage: json?.perPage || per || 25,
    total: json?.total ?? data.length,
    pageTotal: json?.pageTotal ?? 0,
    currency: json?.currency || "EUR",
  };
  return { data, meta };
}

function buildCsvUrl({ q, status = "all", from, to, ids, apiBase }) {
  const params = new URLSearchParams();
  params.set("format", "csv");
  if (ids) params.set("ids", ids);
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return `${apiBase}?${params.toString()}`;
}

function statusBadge(s = "") {
  const key = String(s || "").toLowerCase();
  const map = {
    paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    confirmed: "bg-sky-50 text-sky-700 border-sky-200",
    cancelled: "bg-zinc-50 text-zinc-700 border-zinc-200",
    approved: "bg-indigo-50 text-indigo-700 border-indigo-200",
    rejected: "bg-rose-50 text-rose-700 border-rose-200",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    finalized: "bg-sky-50 text-sky-700 border-sky-200",
    draft: "bg-zinc-50 text-zinc-700 border-zinc-200",
    sent: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };
  const cls = map[key] || "bg-zinc-50 text-zinc-700 border-zinc-200";
  const label = key ? key[0].toUpperCase() + key.slice(1) : "—";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

function formatCurrency(n, curr = "EUR") {
  try {
    const num = Number(n || 0);
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: curr,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${n} ${curr}`;
  }
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}
