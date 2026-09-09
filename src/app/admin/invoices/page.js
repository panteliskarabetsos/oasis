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

/**
 * /admin/invoices — first-party (v2) invoices plus a read-only Stripe view.
 *
 * API contract (unchanged):
 *   GET /api/admin/invoices2?q&status&from&to&p&per&expand&overdue&includeStripe
 *     -> { data[], page, perPage, total, pageTotal, currency }
 *   GET  same route with &format=csv&ids=…   -> CSV download
 *   POST /api/admin/invoices2/{id}/send
 *   POST /api/admin/invoices2/{id}/mark-paid { method, reference }
 *   POST /api/admin/invoices2/{id}/void
 *   DELETE /api/admin/invoices2/{id}
 *   GET  /api/admin/invoices2/{id}/pdf | /download
 */

const API_BASE = "/api/admin/invoices2";

const FP_STATUSES = [
  "all", "draft", "sent", "paid", "pending", "confirmed",
  "finalized", "approved", "completed", "rejected", "cancelled", "void",
];
const STRIPE_STATUSES = ["all", "draft", "open", "paid", "void", "uncollectible"];

const PAY_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "stripe", label: "Stripe" },
  { value: "other", label: "Other" },
];

const SORTS = [
  { key: "createdAt", label: "Issued" },
  { key: "dueDate", label: "Due" },
  { key: "amount", label: "Amount" },
  { key: "amountPaid", label: "Paid" },
  { key: "balance", label: "Balance" },
  { key: "invoiceNo", label: "Invoice" },
];

/* -------------------------------- helpers -------------------------------- */

const iso = (d) => d.toISOString().slice(0, 10);
const today = () => iso(new Date());
const daysAgo = (n) => iso(new Date(Date.now() - n * 86400000));

function fmtMoney(n, ccy = "EUR") {
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: ccy || "EUR",
      maximumFractionDigits: 2,
    }).format(Number(n) || 0);
  } catch {
    return `${n} ${ccy}`;
  }
}

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d) ? String(value) : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const sumPayments = (arr = []) =>
  (Array.isArray(arr) ? arr : []).reduce((s, p) => s + (Number(p?.amount) || 0), 0);

/** Prefer the server's computed money columns; fall back to payments & status. */
function deriveMoney(inv) {
  const amount = Number(inv.amount ?? inv.total ?? inv.meta?.total ?? inv.totalAmount ?? 0);
  const paidAmount = Number(
    (typeof inv.amountPaid === "number" && inv.amountPaid) ??
      inv.totalPaidAmount ??
      sumPayments(inv.payments)
  );
  const EPS = 0.005;
  const balanceRaw = typeof inv.balance === "number" ? inv.balance : amount - paidAmount;
  const balance = balanceRaw > EPS ? balanceRaw : 0;

  const status = String(inv.status || "").toLowerCase();
  const paid =
    inv.paid === true || status === "paid" || Boolean(inv?.meta?.paid_at || inv?.paid_at) || balance === 0;

  const dueISO = inv?.meta?.due_date ?? inv?.due_date;
  const overdue =
    typeof inv?.meta?.overdue === "boolean"
      ? inv.meta.overdue && !paid
      : !paid && dueISO
        ? new Date(dueISO).getTime() < Date.now()
        : false;

  return { amount, paidAmount, balance, paid, overdue, dueISO };
}

function sortRows(data, key, dir) {
  const d = dir === "asc" ? 1 : -1;
  const val = (r) => {
    const m = deriveMoney(r);
    switch (key) {
      case "amount": return m.amount;
      case "amountPaid": return m.paidAmount;
      case "balance": return m.balance;
      case "dueDate": return m.dueISO ? new Date(m.dueISO).getTime() : 0;
      case "invoiceNo": return String(r.invoiceNo || "");
      default: return r.createdAt ? new Date(r.createdAt).getTime() : 0;
    }
  };
  return [...data].sort((a, b) => {
    const av = val(a);
    const bv = val(b);
    if (typeof av === "string") return av.localeCompare(bv) * d;
    return (av - bv) * d;
  });
}

function stripeLinks(inv) {
  const stripeId =
    inv?.meta?.stripe_invoice_id ||
    (typeof inv?.id === "string" && inv.id.startsWith("in_") ? inv.id : null);
  return {
    stripeId,
    hosted: inv?.meta?.hosted_invoice_url || inv?.hosted_invoice_url || null,
    pdf: inv?.meta?.invoice_pdf || inv?.invoice_pdf || null,
    dash: stripeId ? `https://dashboard.stripe.com/invoices/${stripeId}` : null,
  };
}

function buildQuery({ q, status, from, to, p, per, expand, overdue, includeStripe, format, ids }) {
  const s = new URLSearchParams();
  if (q) s.set("q", q);
  if (status && status !== "all") s.set("status", status);
  if (from) s.set("from", from);
  if (to) s.set("to", to);
  if (p) s.set("p", String(p));
  if (per) s.set("per", String(per));
  if (expand) s.set("expand", expand);
  if (overdue) s.set("overdue", "1");
  if (includeStripe) s.set("includeStripe", "1");
  if (format) s.set("format", format);
  if (ids) s.set("ids", ids);
  return s.toString();
}

/* --------------------------------- page ---------------------------------- */

export default function AdminInvoicesPage() {
  const router = useRouter();

  const [mode, setMode] = useState("fp"); // 'fp' | 'stripe'
  const isStripe = mode === "stripe";

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageTotal, setPageTotal] = useState(0);
  const [apiCurrency, setApiCurrency] = useState("EUR");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState({ id: null, type: "" });
  const [bulkBusy, setBulkBusy] = useState("");
  const [payFor, setPayFor] = useState(null); // invoice being marked paid
  const [payMethod, setPayMethod] = useState("cash");
  const [payReference, setPayReference] = useState("");

  const searchRef = useRef(null);

  /* debounce search */
  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  /* any filter change resets to page 1 */
  useEffect(() => {
    setPage(1);
  }, [q, status, dateFrom, dateTo, overdueOnly, mode, pageSize]);

  /* switching data source clears things that don't carry over */
  useEffect(() => {
    setStatus("all");
    setOverdueOnly(false);
    setSelected(new Set());
  }, [mode]);

  /* fetch */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const qs = buildQuery({
          q, status, from: dateFrom, to: dateTo, p: page, per: pageSize,
          expand: "payments",
          overdue: overdueOnly && !isStripe,
          includeStripe: isStripe,
        });
        const res = await fetch(`${API_BASE}?${qs}`, { cache: "no-store", credentials: "include" });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `Failed to load invoices (${res.status})`);
        }
        const json = await res.json();
        if (cancelled) return;
        const data = Array.isArray(json?.data) ? json.data : [];
        setRows(data);
        setTotal(json?.total ?? data.length);
        setPageTotal(json?.pageTotal ?? 0);
        setApiCurrency(json?.currency || "EUR");
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "Failed to load invoices.");
          setRows([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [q, status, dateFrom, dateTo, page, pageSize, overdueOnly, isStripe, refreshTick]);

  /* "/" focuses search, Escape closes the mark-paid dialog */
  useEffect(() => {
    const onKey = (e) => {
      const typing = /input|textarea|select/i.test(e.target?.tagName || "");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape") setPayFor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sorted = useMemo(() => sortRows(rows, sortKey, sortDir), [rows, sortKey, sortDir]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const metrics = useMemo(() => {
    let paidSum = 0, outstanding = 0, overdueCount = 0, overdueSum = 0;
    for (const r of rows) {
      const m = deriveMoney(r);
      paidSum += m.paidAmount;
      outstanding += m.balance;
      if (m.overdue) { overdueCount += 1; overdueSum += m.balance; }
    }
    return { paidSum, outstanding, overdueCount, overdueSum };
  }, [rows]);

  const activeFilters = useMemo(() => {
    const out = [];
    if (q) out.push({ key: "q", prefix: "search", label: q, clear: () => setSearchInput("") });
    if (status !== "all")
      out.push({ key: "status", prefix: "status", label: status, clear: () => setStatus("all") });
    if (overdueOnly)
      out.push({ key: "overdue", prefix: "only", label: "overdue", clear: () => setOverdueOnly(false) });
    if (dateFrom || dateTo)
      out.push({
        key: "dates", prefix: "issued",
        label: dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : dateFrom ? `from ${dateFrom}` : `until ${dateTo}`,
        clear: () => { setDateFrom(""); setDateTo(""); },
      });
    return out;
  }, [q, status, overdueOnly, dateFrom, dateTo]);

  const resetAll = () => {
    setSearchInput(""); setQ(""); setStatus("all");
    setOverdueOnly(false); setDateFrom(""); setDateTo(""); setPage(1);
  };

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "invoiceNo" ? "asc" : "desc"); }
  }

  /* ------------------------------ selection ------------------------------- */
  const selectableIds = useMemo(() => sorted.map((r) => r.id), [sorted]);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(selectableIds));

  const toggleOne = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedRows = useMemo(
    () => sorted.filter((r) => selected.has(r.id)),
    [sorted, selected]
  );
  const selectedTotal = useMemo(
    () => selectedRows.reduce((s, r) => s + deriveMoney(r).balance, 0),
    [selectedRows]
  );

  /* ------------------------------- actions -------------------------------- */

  function openInvoice(inv) {
    if (isStripe) {
      const { hosted, dash } = stripeLinks(inv);
      window.open(hosted || dash || "https://dashboard.stripe.com/invoices", "_blank");
    } else router.push(`/admin/invoices/${inv.id}`);
  }

  function openPdf(inv) {
    if (isStripe) {
      const { pdf, hosted, dash } = stripeLinks(inv);
      window.open(pdf || hosted || dash || "https://dashboard.stripe.com/invoices", "_blank");
    } else window.open(`${API_BASE}/${inv.id}/pdf`, "_blank");
  }

  function downloadPdf(inv) {
    if (isStripe) return openPdf(inv);
    window.open(`${API_BASE}/${inv.id}/download`, "_blank");
  }

  function exportCsv(ids) {
    const qs = buildQuery({
      q, status, from: dateFrom, to: dateTo,
      expand: "payments", overdue: overdueOnly && !isStripe,
      includeStripe: isStripe, format: "csv",
      ids: ids?.length ? ids.join(",") : undefined,
    });
    window.open(`${API_BASE}?${qs}`, "_blank");
  }

  async function runAction(id, type, fn, successFallback) {
    setBusy({ id, type });
    try {
      const res = await fn();
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      toast.success(json?.message || successFallback);
      setRefreshTick((t) => t + 1);
      return true;
    } catch (e) {
      toast.error(e?.message || "Something went wrong.");
      return false;
    } finally {
      setBusy({ id: null, type: "" });
    }
  }

  const sendInvoice = (id) =>
    runAction(id, "send", () => fetch(`${API_BASE}/${id}/send`, { method: "POST" }), "Invoice email queued.");

  const voidInvoice = (id) => {
    if (!window.confirm("Void this invoice? Its status will be set to 'void'.")) return;
    return runAction(id, "void", () => fetch(`${API_BASE}/${id}/void`, { method: "POST" }), "Invoice voided.");
  };

  const deleteInvoice = (id) => {
    if (!window.confirm("Delete this invoice permanently? Only drafts and voided invoices without payments can be deleted.")) return;
    return runAction(id, "delete", () => fetch(`${API_BASE}/${id}`, { method: "DELETE" }), "Invoice deleted.");
  };

  async function confirmMarkPaid() {
    if (!payFor) return;
    const okDone = await runAction(payFor.id, "mark", () =>
      fetch(`${API_BASE}/${payFor.id}/mark-paid`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method: payMethod, reference: payReference || undefined }),
      }), "Invoice marked as paid.");
    if (okDone) {
      setPayFor(null);
      setPayReference("");
    }
  }

  async function bulkSend() {
    const targets = selectedRows.filter((r) => !deriveMoney(r).paid);
    if (!targets.length) return toast.error("Every selected invoice is already paid.");
    if (!window.confirm(`Email ${targets.length} invoice${targets.length === 1 ? "" : "s"}?`)) return;
    setBulkBusy("send");
    let sent = 0, failed = 0;
    for (const r of targets) {
      try {
        const res = await fetch(`${API_BASE}/${r.id}/send`, { method: "POST" });
        res.ok ? sent++ : failed++;
      } catch { failed++; }
    }
    setBulkBusy("");
    if (sent) toast.success(`${sent} invoice${sent === 1 ? "" : "s"} queued.`);
    if (failed) toast.error(`${failed} failed to send.`);
    setSelected(new Set());
    setRefreshTick((t) => t + 1);
  }

  const openMarkPaid = useCallback((inv) => {
    setPayFor(inv);
    setPayMethod(inv?.meta?.payment_method || "cash");
    setPayReference("");
  }, []);

  /* --------------------------------- view --------------------------------- */

  const statuses = isStripe ? STRIPE_STATUSES : FP_STATUSES;

  return (
    <Page>
      <PageHeader
        eyebrow="Revenue"
        title="Invoices"
        description={
          loading
            ? "Loading invoices…"
            : `${total} invoice${total === 1 ? "" : "s"}${isStripe ? " in Stripe" : ""}`
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setRefreshTick((t) => t + 1)}>
              <Icon name="clock" size={15} /> Refresh
            </Button>
            <Button variant="secondary" onClick={() => exportCsv()} disabled={!rows.length}>
              <Icon name="download" size={15} /> Export CSV
            </Button>
            {!isStripe ? (
              <Button as={Link} href="/admin/invoices/new" variant="primary">
                <Icon name="plus" size={15} /> New invoice
              </Button>
            ) : null}
          </>
        }
      />

      {/* summary */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Page value" value={fmtMoney(pageTotal, apiCurrency)} hint={`${rows.length} on this page`} />
        <SummaryCard label="Collected" value={fmtMoney(metrics.paidSum, apiCurrency)} />
        <SummaryCard
          label="Outstanding"
          value={fmtMoney(metrics.outstanding, apiCurrency)}
          accent={metrics.outstanding > 0 ? "warn" : undefined}
        />
        <SummaryCard
          label="Overdue"
          value={fmtMoney(metrics.overdueSum, apiCurrency)}
          hint={metrics.overdueCount ? `${metrics.overdueCount} invoice${metrics.overdueCount === 1 ? "" : "s"}` : "none"}
          accent={metrics.overdueCount > 0 ? "danger" : undefined}
          onClick={!isStripe && metrics.overdueCount > 0 ? () => setOverdueOnly(true) : undefined}
        />
      </div>

      {/* data source */}
      <div className="mb-4 inline-flex rounded-xl border border-[#e6e0d6] bg-white p-1">
        {[
          ["fp", "Our invoices"],
          ["stripe", "Stripe"],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setMode(value)}
            className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              mode === value ? "bg-[#2a211a] text-white" : "text-[#6b5c4d] hover:bg-[#f2ede4]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Card padded={false} className="overflow-hidden">
        {/* toolbar */}
        <div className="border-b border-[#e6e0d6]">
          <div className="flex flex-wrap items-center gap-2 p-4 pb-3">
            <div className="relative min-w-[240px] flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#b0a294]">
                <Icon name="search" size={16} />
              </span>
              <input
                ref={searchRef}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search invoice number, customer name, email or VAT"
                className={`${inputClass} h-11 pl-9 ${searchInput ? "pr-10" : "pr-14"}`}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {searchInput ? (
                  <button
                    onClick={() => setSearchInput("")}
                    aria-label="Clear search"
                    className="rounded-md p-1 text-[#9a8c7e] hover:bg-[#f2ede4] hover:text-[#2a211a]"
                  >
                    <Icon name="x" size={14} />
                  </button>
                ) : (
                  <kbd className="hidden rounded border border-[#e6e0d6] bg-[#faf8f4] px-1.5 py-0.5 text-[10px] text-[#b0a294] sm:block">/</kbd>
                )}
              </div>
            </div>

            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-11 !w-auto min-w-[160px]"
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All statuses" : s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>

            {!isStripe ? (
              <Button
                variant={overdueOnly ? "danger" : "secondary"}
                className="h-11"
                onClick={() => setOverdueOnly((v) => !v)}
                title="Show only invoices past their due date"
              >
                <Icon name="warning" size={15} /> Overdue
              </Button>
            ) : null}

            <Button
              variant={advancedOpen || dateFrom || dateTo ? "dark" : "secondary"}
              className="h-11"
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              <Icon name="calendar" size={15} /> Dates
            </Button>
          </div>

          {advancedOpen ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-[#f0ebe2] bg-[#fdfbf7] px-4 py-3">
              {[
                ["Today", today(), today()],
                ["Last 7 days", daysAgo(7), today()],
                ["Last 30 days", daysAgo(30), today()],
                ["This year", `${new Date().getFullYear()}-01-01`, today()],
                ["All time", "", ""],
              ].map(([label, f, t]) => (
                <button
                  key={label}
                  onClick={() => { setDateFrom(f); setDateTo(t); }}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    dateFrom === f && dateTo === t
                      ? "bg-[#2a211a] text-white"
                      : "bg-white text-[#6b5c4d] ring-1 ring-inset ring-[#e6e0d6] hover:bg-[#f2ede4]"
                  }`}
                >
                  {label}
                </button>
              ))}
              <span className="mx-1 hidden h-5 w-px bg-[#e6e0d6] sm:block" />
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className={`${inputClass} h-9 w-[150px] text-[12px]`} />
              <span className="text-[12px] text-[#9a8c7e]">→</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className={`${inputClass} h-9 w-[150px] text-[12px]`} />
            </div>
          ) : null}

          {activeFilters.length ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-[#f0ebe2] px-4 py-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9a8c7e]">Filtered by</span>
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  onClick={f.clear}
                  className="group inline-flex items-center gap-1.5 rounded-full bg-[#f3ece1] py-1 pl-2.5 pr-1.5 text-[12px] font-medium text-[#8b6f47] ring-1 ring-inset ring-[#e7dcc9] hover:bg-[#ece0cd]"
                >
                  <span className="text-[#b0a294]">{f.prefix}</span>
                  {f.label}
                  <span className="rounded-full p-0.5 group-hover:bg-[#8b6f47]/15"><Icon name="x" size={11} /></span>
                </button>
              ))}
              <button onClick={resetAll} className="ml-1 text-[12px] font-semibold text-[#9a8c7e] hover:text-[#a33c22] hover:underline">
                Clear all
              </button>
            </div>
          ) : null}

          {/* bulk bar */}
          {someSelected && !isStripe ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-[#f0ebe2] bg-[#f8f4ec] px-4 py-2.5">
              <span className="text-[12.5px] font-semibold text-[#2a211a]">
                {selected.size} selected
              </span>
              <span className="text-[12px] text-[#7a6a5f]">
                · {fmtMoney(selectedTotal, apiCurrency)} outstanding
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => exportCsv([...selected])}>
                  <Icon name="download" size={14} /> Export
                </Button>
                <Button size="sm" variant="secondary" onClick={bulkSend} disabled={!!bulkBusy}>
                  <Icon name="mail" size={14} /> {bulkBusy === "send" ? "Sending…" : "Send"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {/* table */}
        {error ? (
          <div className="p-5">
            <ErrorNote>{error}</ErrorNote>
            <Button className="mt-3" variant="secondary" onClick={() => setRefreshTick((t) => t + 1)}>
              Try again
            </Button>
          </div>
        ) : loading ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11" />)}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={<Icon name="file" size={20} />}
            title="No invoices found"
            description={activeFilters.length ? "Nothing matches these filters." : "Create an invoice to get started."}
            action={
              activeFilters.length ? (
                <Button variant="secondary" onClick={resetAll}>Clear filters</Button>
              ) : !isStripe ? (
                <Button as={Link} href="/admin/invoices/new" variant="primary">New invoice</Button>
              ) : null
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                {!isStripe ? (
                  <Th className="w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all invoices on this page"
                      className="h-4 w-4 cursor-pointer accent-[#8b6f47]"
                    />
                  </Th>
                ) : null}
                <SortableTh label="Invoice" sortKey="invoiceNo" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <Th>Customer</Th>
                <SortableTh label="Issued" sortKey="createdAt" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableTh label="Due" sortKey="dueDate" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableTh label="Amount" sortKey="amount" active={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                <SortableTh label="Paid" sortKey="amountPaid" active={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                <SortableTh label="Balance" sortKey="balance" active={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((inv) => {
                const m = deriveMoney(inv);
                const ccy = inv.currency || apiCurrency;
                const isBusy = busy.id === inv.id;
                const canVoid =
                  !m.paid &&
                  String(inv.status || "").toLowerCase() !== "void" &&
                  !(Array.isArray(inv.payments) && inv.payments.length);
                const canDelete =
                  ["draft", "void"].includes(String(inv.status || "").toLowerCase()) &&
                  !(Array.isArray(inv.payments) && inv.payments.length);

                return (
                  <Tr key={inv.id} className={selected.has(inv.id) ? "bg-[#faf6ef]" : ""}>
                    {!isStripe ? (
                      <Td>
                        <input
                          type="checkbox"
                          checked={selected.has(inv.id)}
                          onChange={() => toggleOne(inv.id)}
                          aria-label={`Select invoice ${inv.invoiceNo || inv.id}`}
                          className="h-4 w-4 cursor-pointer accent-[#8b6f47]"
                        />
                      </Td>
                    ) : null}

                    <Td>
                      <button
                        onClick={() => openInvoice(inv)}
                        className="font-semibold text-[#2a211a] hover:text-[#8b6f47] hover:underline"
                      >
                        {inv.invoiceNo || inv.id}
                      </button>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {m.overdue ? <Badge variant="danger">Overdue</Badge> : null}
                        {inv?.meta?.booking_id ? (
                          <Link
                            href={`/admin/bookings/${inv.meta.booking_id}`}
                            className="rounded-full bg-[#f3ece1] px-2 py-0.5 text-[10.5px] font-semibold text-[#8b6f47] ring-1 ring-inset ring-[#e7dcc9] hover:bg-[#ece0cd]"
                          >
                            Booking #{inv.meta.booking_id}
                          </Link>
                        ) : null}
                      </div>
                    </Td>

                    <Td>
                      <span className="block font-medium text-[#2a211a]">{inv.customer?.name || "—"}</span>
                      {inv.customer?.email || inv.customer?.vat ? (
                        <span className="block text-[11.5px] text-[#9a8c7e]">
                          {[inv.customer?.email, inv.customer?.vat ? `VAT ${inv.customer.vat}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : null}
                    </Td>

                    <Td className="whitespace-nowrap text-[#7a6a5f]">{fmtDate(inv.createdAt)}</Td>
                    <Td className={`whitespace-nowrap ${m.overdue ? "font-semibold text-[#a33c22]" : "text-[#7a6a5f]"}`}>
                      {fmtDate(m.dueISO)}
                    </Td>

                    <Td className="whitespace-nowrap text-right font-semibold">{fmtMoney(m.amount, ccy)}</Td>
                    <Td className="whitespace-nowrap text-right text-[#7a6a5f]">{fmtMoney(m.paidAmount, ccy)}</Td>
                    <Td className={`whitespace-nowrap text-right ${m.balance > 0 ? "font-semibold text-[#a33c22]" : "text-[#b0a294]"}`}>
                      {m.balance > 0 ? fmtMoney(m.balance, ccy) : "—"}
                    </Td>

                    <Td><StatusBadge status={inv.status} /></Td>

                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <IconAction title="Open PDF" onClick={() => openPdf(inv)} icon="file" />
                        <IconAction title="Download PDF" onClick={() => downloadPdf(inv)} icon="download" />
                        {!isStripe ? (
                          <>
                            <IconAction
                              title="Email this invoice"
                              onClick={() => sendInvoice(inv.id)}
                              icon="mail"
                              busy={isBusy && busy.type === "send"}
                            />
                            {!m.paid ? (
                              <IconAction
                                title="Record a payment"
                                onClick={() => openMarkPaid(inv)}
                                icon="check"
                                tone="good"
                                busy={isBusy && busy.type === "mark"}
                              />
                            ) : null}
                            {canVoid ? (
                              <IconAction
                                title="Void invoice"
                                onClick={() => voidInvoice(inv.id)}
                                icon="ban"
                                tone="warn"
                                busy={isBusy && busy.type === "void"}
                              />
                            ) : null}
                            {canDelete ? (
                              <IconAction
                                title="Delete invoice"
                                onClick={() => deleteInvoice(inv.id)}
                                icon="trash"
                                tone="bad"
                                busy={isBusy && busy.type === "delete"}
                              />
                            ) : null}
                          </>
                        ) : (
                          <IconAction
                            title="Open in Stripe"
                            onClick={() => window.open(stripeLinks(inv).dash || "https://dashboard.stripe.com/invoices", "_blank")}
                            icon="external"
                          />
                        )}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}

        {/* pagination */}
        {!loading && sorted.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6e0d6] px-4 py-3">
            <div className="flex items-center gap-2">
              <Muted className="text-[12px]">
                Page {page} of {totalPages} · {total} total
              </Muted>
              <Select
                value={String(pageSize)}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-8 !w-auto text-[12px]"
                aria-label="Rows per page"
              >
                {[25, 50, 100, 200].map((n) => (
                  <option key={n} value={n}>{n} / page</option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      {/* ---------------------------- mark paid modal ---------------------------- */}
      {payFor ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPayFor(null)} />
          <div className="relative z-10 w-full max-w-md rounded-t-3xl border border-[#e6e0d6] bg-white p-6 shadow-2xl sm:rounded-3xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-[19px] text-[#2a211a]">Record payment</h2>
                <p className="mt-0.5 text-[12px] text-[#9a8c7e]">
                  {payFor.invoiceNo || payFor.id} · {payFor.customer?.name || "—"}
                </p>
              </div>
              <button onClick={() => setPayFor(null)} aria-label="Close" className="rounded-lg p-1.5 text-[#9a8c7e] hover:bg-[#f2ede4]">
                <Icon name="x" size={18} />
              </button>
            </div>

            <div className="mb-4 rounded-xl border border-[#e6e0d6] bg-[#fdfbf7] px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9a8c7e]">Outstanding balance</p>
              <p className="mt-0.5 font-serif text-[20px] text-[#2a211a]">
                {fmtMoney(deriveMoney(payFor).balance, payFor.currency || apiCurrency)}
              </p>
            </div>

            <Field label="Payment method">
              <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                {PAY_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </Select>
            </Field>

            <Field label="Reference (optional)" hint="Bank reference, receipt number, or Stripe id." className="mt-3">
              <Input
                value={payReference}
                onChange={(e) => setPayReference(e.target.value)}
                placeholder="e.g. TRX-49182"
              />
            </Field>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPayFor(null)}>Cancel</Button>
              <Button variant="primary" onClick={confirmMarkPaid} disabled={busy.type === "mark"}>
                {busy.type === "mark" ? "Saving…" : "Mark as paid"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Page>
  );
}

/* ------------------------------- small parts ------------------------------ */

function SummaryCard({ label, value, hint, accent, onClick }) {
  const color =
    accent === "danger" ? "text-[#a33c22]" : accent === "warn" ? "text-[#8a6412]" : "text-[#2a211a]";
  const body = (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9a8c7e]">{label}</p>
      <p className={`mt-1 font-serif text-[20px] ${color}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11.5px] text-[#9a8c7e]">{hint}</p> : null}
    </>
  );
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="rounded-2xl border border-[#e6e0d6] bg-white px-5 py-3.5 text-left shadow-[0_1px_2px_rgba(42,33,26,0.04)] transition-colors hover:border-[#c9b393] hover:bg-[#fdfbf7]"
      >
        {body}
      </button>
    );
  }
  return <Card className="py-3.5">{body}</Card>;
}

function SortableTh({ label, sortKey: key, active, dir, onSort, align }) {
  const isActive = active === key;
  return (
    <Th className={align === "right" ? "text-right" : ""}>
      <button
        onClick={() => onSort(key)}
        className={`inline-flex items-center gap-1 uppercase tracking-[0.14em] hover:text-[#2a211a] ${
          isActive ? "text-[#2a211a]" : ""
        }`}
      >
        {label}
        <span className={isActive ? "opacity-100" : "opacity-0"}>{dir === "asc" ? "▲" : "▼"}</span>
      </button>
    </Th>
  );
}

function IconAction({ title, onClick, icon, tone, busy }) {
  const hover =
    tone === "bad"
      ? "hover:bg-[#fbeae5] hover:text-[#a33c22]"
      : tone === "warn"
        ? "hover:bg-[#fbf1dc] hover:text-[#8a6412]"
        : tone === "good"
          ? "hover:bg-[#e9f3ec] hover:text-[#2f6b45]"
          : "hover:bg-[#f2ede4] hover:text-[#2a211a]";
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={busy}
      className={`rounded-lg p-1.5 text-[#7a6a5f] transition-colors disabled:opacity-40 ${hover}`}
    >
      <Icon name={busy ? "clock" : icon} size={15} className={busy ? "animate-spin" : ""} />
    </button>
  );
}
