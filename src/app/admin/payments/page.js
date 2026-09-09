"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

import Icon from "../_ui/Icon";
import {
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

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "succeeded", label: "Succeeded" },
  { value: "processing", label: "Processing" },
  { value: "requires_payment_method", label: "Requires payment method" },
  { value: "requires_capture", label: "Requires capture" },
  { value: "canceled", label: "Canceled" },
];

const money = (cents, ccy = "EUR") =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: (ccy || "EUR").toUpperCase(),
  }).format((Number(cents) || 0) / 100);

const iso = (d) => d.toISOString().slice(0, 10);
const today = () => iso(new Date());
const daysAgo = (n) => iso(new Date(Date.now() - n * 86400000));

/** Derive a display status that accounts for refunds. */
function mapToRow(p) {
  const amountReceived = typeof p.amount_received === "number" ? p.amount_received : 0;
  const refundsTotal = Array.isArray(p.refunds)
    ? p.refunds.reduce((s, r) => s + (r.amount || 0), 0)
    : 0;

  let displayStatus = p.status;
  if (amountReceived > 0 && refundsTotal >= amountReceived) displayStatus = "refunded";
  else if (refundsTotal > 0 && refundsTotal < amountReceived)
    displayStatus = "partially_refunded";

  const apiEmail = p.customer?.email ?? null;
  return {
    id: p.id,
    created_at: (p.created || 0) * 1000,
    customer_name: p.customer?.name || (apiEmail ? apiEmail.split("@")[0] : null),
    customer_email: apiEmail,
    booking_id: p.booking_id ?? null,
    amount_cents: amountReceived || p.amount || 0,
    received_cents: amountReceived,
    refunded_cents: refundsTotal,
    currency: (p.currency || "eur").toUpperCase(),
    method: p.method || "card",
    card_brand: p.card_brand || null,
    card_last4: p.card_last4 || null,
    status: displayStatus,
    receipt_url: p.receipt_url || null,
  };
}

/* --------------------------------- page ---------------------------------- */

export default function AdminPaymentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchParams.get("q") || "");
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("from") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("to") || "");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [pageIndex, setPageIndex] = useState(0);
  const [cursorStack, setCursorStack] = useState([null]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // finance lock — refunds are blocked once today's Z-report is closed
  const [todayLocked, setTodayLocked] = useState(false);

  // refund-from-list
  const [refundFor, setRefundFor] = useState(null);
  const [refundDetail, setRefundDetail] = useState(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundError, setRefundError] = useState("");

  const searchRef = useRef(null);

  /* debounce the search box */
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(searchInput.trim());
      setPageIndex(0);
      setCursorStack((st) => (st.length === 1 && st[0] === null ? st : [null]));
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  /* keep filters in the URL so a payment view is shareable */
  useEffect(() => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (status) qs.set("status", status);
    if (dateFrom) qs.set("from", dateFrom);
    if (dateTo) qs.set("to", dateTo);
    const str = qs.toString();
    router.replace(str ? `/admin/payments?${str}` : "/admin/payments", { scroll: false });
  }, [q, status, dateFrom, dateTo, router]);

  /* today's Z-report state */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/reports/daily?date=${today()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const j = await res.json();
        setTodayLocked(Boolean(j?.locked));
      } catch {
        /* non-critical */
      }
    })();
  }, [refreshKey]);

  /* payments */
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

        const res = await fetch(`/api/admin/payments?${qs}`, {
          cache: "no-store",
          signal: ctrl.signal,
          credentials: "include",
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `Failed to load payments (${res.status})`);
        }
        const data = await res.json();
        if (ignore) return;
        const items = Array.isArray(data.items) ? data.items : [];
        setRows(items.map(mapToRow));
        setHasMore(!!data.has_more);
        setNextCursor(data.next_cursor || null);
      } catch (e) {
        if (ignore || e?.name === "AbortError") return;
        setError(e?.message || "Failed to load payments");
        setRows([]);
        setHasMore(false);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
      ctrl.abort();
    };
  }, [q, status, dateFrom, dateTo, pageIndex, cursorStack, refreshKey]);

  /* "/" focuses search */
  useEffect(() => {
    const onKey = (e) => {
      const typing = /input|textarea|select/i.test(e.target?.tagName || "");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape") setRefundFor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* page totals — a real answer to "what did we take on this page?" */
  const totals = useMemo(() => {
    const currency = rows[0]?.currency || "EUR";
    // only money Stripe actually received counts as collected — an
    // uncaptured authorisation is not revenue yet
    const collected = rows.reduce((s, r) => s + (r.received_cents || 0), 0);
    const refunded = rows.reduce((s, r) => s + (r.refunded_cents || 0), 0);
    return { currency, collected, refunded, net: collected - refunded, count: rows.length };
  }, [rows]);

  const activeFilters = useMemo(() => {
    const out = [];
    if (q) out.push({ key: "q", prefix: "search", label: q, clear: () => setSearchInput("") });
    if (status)
      out.push({
        key: "status",
        prefix: "status",
        label: status.replace(/_/g, " "),
        clear: () => setStatus(""),
      });
    if (dateFrom || dateTo)
      out.push({
        key: "dates",
        prefix: "dates",
        label:
          dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : dateFrom ? `from ${dateFrom}` : `until ${dateTo}`,
        clear: () => {
          setDateFrom("");
          setDateTo("");
        },
      });
    return out;
  }, [q, status, dateFrom, dateTo]);

  const resetAll = () => {
    setSearchInput("");
    setQ("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
    setPageIndex(0);
    setCursorStack([null]);
  };

  function exportCsv() {
    const head = ["payment_intent", "created", "customer", "email", "booking", "amount", "refunded", "currency", "status"];
    const lines = rows.map((r) =>
      [
        r.id,
        r.created_at ? new Date(r.created_at).toISOString() : "",
        r.customer_name, r.customer_email, r.booking_id,
        (r.amount_cents / 100).toFixed(2), (r.refunded_cents / 100).toFixed(2),
        r.currency, r.status,
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `oasis-payments-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ------------------------- refund from the list ------------------------- */
  const openRefund = useCallback(async (row) => {
    setRefundFor(row);
    setRefundDetail(null);
    setRefundError("");
    setRefundReason("");
    setRefundAmount("");
    try {
      const res = await fetch(`/api/admin/payments/${row.id}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Could not load this payment");
      const item = j?.item || j;
      setRefundDetail(item);
      const available = item?.aggregates?.available_to_refund_cents ?? 0;
      setRefundAmount((available / 100).toFixed(2));
    } catch (e) {
      setRefundError(e.message || "Could not load this payment");
    }
  }, []);

  async function submitRefund() {
    if (!refundFor) return;
    const cents = Math.round(Number(refundAmount) * 100);
    if (!cents || cents <= 0) return setRefundError("Enter an amount greater than zero.");
    setRefundBusy(true);
    setRefundError("");
    try {
      const res = await fetch(`/api/admin/payments/${refundFor.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          amount_cents: cents,
          reason: refundReason || "requested_by_customer",
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Refund failed");
      toast.success(`Refunded ${money(cents, refundFor.currency)}`);
      setRefundFor(null);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setRefundError(e.message || "Refund failed");
    } finally {
      setRefundBusy(false);
    }
  }

  const availableCents = refundDetail?.aggregates?.available_to_refund_cents ?? null;

  /* --------------------------------- view --------------------------------- */

  return (
    <Page>
      <PageHeader
        eyebrow="Revenue"
        title="Payments"
        description={
          loading
            ? "Loading payments from Stripe…"
            : `${totals.count} payment${totals.count === 1 ? "" : "s"} on this page`
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setRefreshKey((k) => k + 1)}>
              <Icon name="clock" size={15} /> Refresh
            </Button>
            <Button variant="secondary" onClick={exportCsv} disabled={!rows.length}>
              <Icon name="file" size={15} /> Export CSV
            </Button>
          </>
        }
      />

      {todayLocked ? (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#f0e0bb] bg-[#fbf1dc] px-4 py-3">
          <Icon name="lock" size={17} className="text-[#8a6412]" />
          <span className="text-[13px] font-semibold text-[#8a6412]">
            Today’s Z-report is locked — refunds and captures are disabled until it is reopened.
          </span>
          <Button as={Link} href="/admin/reports/daily" size="sm" variant="secondary" className="ml-auto">
            Open Z-report
          </Button>
        </div>
      ) : null}

      {/* page totals */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Payments", String(totals.count)],
          ["Collected", money(totals.collected, totals.currency)],
          ["Refunded", money(totals.refunded, totals.currency)],
          ["Net", money(totals.net, totals.currency)],
        ].map(([label, value]) => (
          <Card key={label} className="py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9a8c7e]">{label}</p>
            <p className="mt-1 font-serif text-[20px] text-[#2a211a]">{value}</p>
          </Card>
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
                placeholder="Search by email, name, or payment intent (pi_…)"
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
                  <kbd className="hidden rounded border border-[#e6e0d6] bg-[#faf8f4] px-1.5 py-0.5 text-[10px] text-[#b0a294] sm:block">
                    /
                  </kbd>
                )}
              </div>
            </div>

            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPageIndex(0);
                setCursorStack([null]);
              }}
              className="h-11 !w-auto min-w-[190px]"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>

            <Button
              variant={advancedOpen || dateFrom || dateTo ? "dark" : "secondary"}
              size="md"
              className="h-11"
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              <Icon name="layers" size={15} /> Dates
            </Button>
          </div>

          {advancedOpen ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-[#f0ebe2] bg-[#fdfbf7] px-4 py-3">
              {[
                ["Today", today(), today()],
                ["Last 7 days", daysAgo(7), today()],
                ["Last 30 days", daysAgo(30), today()],
                ["All time", "", ""],
              ].map(([label, f, t]) => (
                <button
                  key={label}
                  onClick={() => {
                    setDateFrom(f);
                    setDateTo(t);
                    setPageIndex(0);
                    setCursorStack([null]);
                  }}
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
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={`${inputClass} h-9 w-[150px] text-[12px]`}
              />
              <span className="text-[12px] text-[#9a8c7e]">→</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={`${inputClass} h-9 w-[150px] text-[12px]`}
              />
            </div>
          ) : null}

          {activeFilters.length ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-[#f0ebe2] px-4 py-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9a8c7e]">
                Filtered by
              </span>
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  onClick={f.clear}
                  className="group inline-flex items-center gap-1.5 rounded-full bg-[#f3ece1] py-1 pl-2.5 pr-1.5 text-[12px] font-medium text-[#8b6f47] ring-1 ring-inset ring-[#e7dcc9] hover:bg-[#ece0cd]"
                >
                  <span className="text-[#b0a294]">{f.prefix}</span>
                  {f.label}
                  <span className="rounded-full p-0.5 group-hover:bg-[#8b6f47]/15">
                    <Icon name="x" size={11} />
                  </span>
                </button>
              ))}
              <button
                onClick={resetAll}
                className="ml-1 text-[12px] font-semibold text-[#9a8c7e] hover:text-[#a33c22] hover:underline"
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
            <Button className="mt-3" variant="secondary" onClick={() => setRefreshKey((k) => k + 1)}>
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
            icon={<Icon name="card" size={20} />}
            title="No payments found"
            description={
              activeFilters.length
                ? "Nothing matches these filters."
                : "Payments will appear here as guests check out."
            }
            action={
              activeFilters.length ? (
                <Button variant="secondary" onClick={resetAll}>
                  Clear filters
                </Button>
              ) : null
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Customer</Th>
                <Th>Method</Th>
                <Th>Booking</Th>
                <Th className="text-right">Amount</Th>
                <Th className="text-right">Refunded</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Tr key={r.id} onClick={() => router.push(`/admin/payments/${r.id}`)}>
                  <Td className="whitespace-nowrap text-[#7a6a5f]">
                    {r.created_at
                      ? new Date(r.created_at).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </Td>
                  <Td>
                    <span className="block font-semibold text-[#2a211a]">
                      {r.customer_name || "—"}
                    </span>
                    {r.customer_email ? (
                      <span className="block text-[11.5px] text-[#9a8c7e]">{r.customer_email}</span>
                    ) : null}
                  </Td>
                  <Td className="whitespace-nowrap text-[#7a6a5f]">
                    {r.card_brand ? `${r.card_brand} •••• ${r.card_last4 || ""}` : r.method}
                  </Td>
                  <Td onClick={(e) => e.stopPropagation()}>
                    {r.booking_id ? (
                      <Link
                        href={`/admin/bookings/${r.booking_id}`}
                        className="font-semibold text-[#8b6f47] hover:underline"
                      >
                        #{r.booking_id}
                      </Link>
                    ) : (
                      <span className="text-[#b0a294]">—</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-right font-semibold">
                    {money(r.amount_cents, r.currency)}
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    {r.refunded_cents > 0 ? (
                      <span className="text-[#a33c22]">−{money(r.refunded_cents, r.currency)}</span>
                    ) : (
                      <span className="text-[#b0a294]">—</span>
                    )}
                  </Td>
                  <Td>
                    <StatusBadge status={r.status} />
                  </Td>
                  <Td className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(r.id);
                          toast.success("Payment intent copied");
                        }}
                        title="Copy payment intent id"
                        className="rounded-lg p-1.5 text-[#7a6a5f] hover:bg-[#f2ede4] hover:text-[#2a211a]"
                      >
                        <Icon name="file" size={15} />
                      </button>
                      {r.receipt_url ? (
                        <a
                          href={r.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                          title="Open Stripe receipt"
                          className="rounded-lg p-1.5 text-[#7a6a5f] hover:bg-[#f2ede4] hover:text-[#2a211a]"
                        >
                          <Icon name="external" size={15} />
                        </a>
                      ) : null}
                      {["succeeded", "partially_refunded"].includes(r.status) && !todayLocked ? (
                        <button
                          onClick={() => openRefund(r)}
                          title="Refund"
                          className="rounded-lg p-1.5 text-[#7a6a5f] hover:bg-[#fbeae5] hover:text-[#a33c22]"
                        >
                          <Icon name="tag" size={15} />
                        </button>
                      ) : null}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}

        {/* cursor pagination */}
        {!loading && rows.length > 0 ? (
          <div className="flex items-center justify-between gap-3 border-t border-[#e6e0d6] px-4 py-3">
            <Muted className="text-[12px]">Page {pageIndex + 1}</Muted>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={pageIndex === 0}
                onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!hasMore}
                onClick={() => {
                  setCursorStack((stack) => {
                    const next = [...stack];
                    next[pageIndex + 1] = nextCursor;
                    return next;
                  });
                  setPageIndex((i) => i + 1);
                }}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      {/* ------------------------------ refund modal ------------------------------ */}
      {refundFor ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRefundFor(null)} />
          <div className="relative z-10 w-full max-w-lg rounded-t-3xl border border-[#e6e0d6] bg-white p-6 shadow-2xl sm:rounded-3xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-[19px] text-[#2a211a]">Refund payment</h2>
                <p className="mt-0.5 text-[12px] text-[#9a8c7e]">
                  {refundFor.customer_name || refundFor.customer_email || refundFor.id}
                </p>
              </div>
              <button
                onClick={() => setRefundFor(null)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-[#9a8c7e] hover:bg-[#f2ede4]"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            {!refundDetail && !refundError ? (
              <Skeleton className="h-20" />
            ) : (
              <>
                <div className="mb-4 grid grid-cols-3 gap-3">
                  <MiniStat label="Charged" value={money(refundFor.amount_cents, refundFor.currency)} />
                  <MiniStat
                    label="Already refunded"
                    value={money(refundDetail?.aggregates?.refunds_total_cents ?? refundFor.refunded_cents, refundFor.currency)}
                  />
                  <MiniStat
                    label="Refundable"
                    value={availableCents == null ? "—" : money(availableCents, refundFor.currency)}
                    accent
                  />
                </div>

                <Field label={`Amount to refund (${refundFor.currency})`}>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                  />
                </Field>

                {availableCents ? (
                  <div className="mt-2 flex gap-2">
                    {[
                      ["25%", 0.25],
                      ["50%", 0.5],
                      ["Full", 1],
                    ].map(([label, f]) => (
                      <button
                        key={label}
                        onClick={() => setRefundAmount(((availableCents * f) / 100).toFixed(2))}
                        className="rounded-full bg-[#f2ede4] px-3 py-1 text-[12px] font-medium text-[#6b5c4d] hover:bg-[#e8e0d3]"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}

                <Field label="Reason (optional)" className="mt-3">
                  <Select value={refundReason} onChange={(e) => setRefundReason(e.target.value)}>
                    <option value="">Requested by customer</option>
                    <option value="duplicate">Duplicate</option>
                    <option value="fraudulent">Fraudulent</option>
                  </Select>
                </Field>
              </>
            )}

            {refundError ? <ErrorNote className="mt-3">{refundError}</ErrorNote> : null}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRefundFor(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={submitRefund}
                disabled={refundBusy || !refundDetail || !Number(refundAmount)}
              >
                {refundBusy ? "Refunding…" : `Refund ${money(Math.round(Number(refundAmount || 0) * 100), refundFor.currency)}`}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Page>
  );
}

function MiniStat({ label, value, accent }) {
  return (
    <div className="rounded-xl border border-[#e6e0d6] bg-[#fdfbf7] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9a8c7e]">{label}</p>
      <p className={`mt-0.5 font-serif text-[15px] ${accent ? "text-[#8b6f47]" : "text-[#2a211a]"}`}>
        {value}
      </p>
    </div>
  );
}
