"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import Icon from "../_ui/Icon";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Muted,
  Page,
  PageHeader,
  Select,
  Skeleton,
  Table,
  Td,
  Th,
  Tr,
  inputClass,
} from "../_ui";

/**
 * /admin/receipts — every receipt in one ledger.
 *
 * GET /api/admin/receipts?q&source&from&to&page&pageSize
 *   -> { items, total, page, pageSize, totals }
 */

const SOURCES = [
  { value: "all", label: "All sources" },
  { value: "pos", label: "Point of sale" },
  { value: "shop", label: "e-Shop" },
  { value: "booking", label: "Bookings" },
];

const SOURCE_META = {
  pos: { label: "POS", variant: "brand" },
  shop: { label: "e-Shop", variant: "info" },
  booking: { label: "Booking", variant: "neutral" },
};

const iso = (d) => d.toISOString().slice(0, 10);
const today = () => iso(new Date());
const daysAgo = (n) => iso(new Date(Date.now() - n * 86400000));

const money = (n, ccy = "EUR") =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: ccy || "EUR" }).format(
    Number(n) || 0,
  );

export default function AdminReceiptsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [source, setSource] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [datesOpen, setDatesOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const searchRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [source, from, to, pageSize]);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      setLoading(true);
      setError("");
      try {
        const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (q) qs.set("q", q);
        if (source !== "all") qs.set("source", source);
        if (from) qs.set("from", from);
        if (to) qs.set("to", to);

        const res = await fetch(`/api/admin/receipts?${qs}`, {
          cache: "no-store",
          credentials: "include",
          signal: ctrl.signal,
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || `Failed to load receipts (${res.status})`);
        setData(j);
      } catch (e) {
        if (e?.name !== "AbortError") {
          setError(e.message || "Failed to load receipts");
          setData(null);
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [q, source, from, to, page, pageSize, refreshKey]);

  useEffect(() => {
    const onKey = (e) => {
      const typing = /input|textarea|select/i.test(e.target?.tagName || "");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totals = data?.totals ?? { gross: 0, bySource: {} };
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const activeFilters = useMemo(() => {
    const out = [];
    if (q) out.push({ key: "q", prefix: "search", label: q, clear: () => setSearchInput("") });
    if (source !== "all")
      out.push({
        key: "source",
        prefix: "source",
        label: SOURCES.find((s) => s.value === source)?.label ?? source,
        clear: () => setSource("all"),
      });
    if (from || to)
      out.push({
        key: "dates",
        prefix: "dates",
        label: from && to ? `${from} → ${to}` : from ? `from ${from}` : `until ${to}`,
        clear: () => {
          setFrom("");
          setTo("");
        },
      });
    return out;
  }, [q, source, from, to]);

  const resetAll = () => {
    setSearchInput("");
    setQ("");
    setSource("all");
    setFrom("");
    setTo("");
    setPage(1);
  };

  function exportCsv() {
    const head = ["reference", "source", "date", "customer", "email", "amount", "currency", "method", "status", "payment_intent"];
    const lines = items.map((r) =>
      [
        r.reference, r.source, r.at ? new Date(r.at).toISOString() : "",
        r.customerName, r.customerEmail, (r.amount ?? 0).toFixed(2),
        r.currency, r.method, r.status, r.stripePaymentIntentId,
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `oasis-receipts-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Revenue"
        title="Receipts"
        description={
          loading && !data
            ? "Loading receipts…"
            : `${total} receipt${total === 1 ? "" : "s"} across POS, e-shop and bookings`
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setRefreshKey((k) => k + 1)}>
              <Icon name="clock" size={15} /> Refresh
            </Button>
            <Button variant="secondary" onClick={exportCsv} disabled={!items.length}>
              <Icon name="download" size={15} /> Export CSV
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total" value={money(totals.gross)} hint={`${total} receipts`} />
        <Stat label="Point of sale" value={money(totals.bySource?.pos ?? 0)} />
        <Stat label="e-Shop" value={money(totals.bySource?.shop ?? 0)} />
        <Stat label="Bookings" value={money(totals.bySource?.booking ?? 0)} />
      </div>

      <Card padded={false} className="overflow-hidden">
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
                placeholder="Search reference, customer, email or pi_…"
                className={`${inputClass} h-11 pl-9 ${searchInput ? "pr-10" : "pr-14"}`}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {searchInput ? (
                  <button
                    onClick={() => setSearchInput("")}
                    aria-label="Clear search"
                    className="rounded-md p-1 text-[#9a8c7e] hover:bg-[#f2ede4]"
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
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="h-11 !w-auto min-w-[160px]"
            >
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>

            <Button
              variant={datesOpen || from || to ? "dark" : "secondary"}
              className="h-11"
              onClick={() => setDatesOpen((v) => !v)}
            >
              <Icon name="calendar" size={15} /> Dates
            </Button>
          </div>

          {datesOpen ? (
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
                    setFrom(f);
                    setTo(t);
                  }}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    from === f && to === t
                      ? "bg-[#2a211a] text-white"
                      : "bg-white text-[#6b5c4d] ring-1 ring-inset ring-[#e6e0d6] hover:bg-[#f2ede4]"
                  }`}
                >
                  {label}
                </button>
              ))}
              <span className="mx-1 hidden h-5 w-px bg-[#e6e0d6] sm:block" />
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className={`${inputClass} h-9 w-[150px] text-[12px]`} />
              <span className="text-[12px] text-[#9a8c7e]">→</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className={`${inputClass} h-9 w-[150px] text-[12px]`} />
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

        {error ? (
          <div className="p-5">
            <ErrorNote>{error}</ErrorNote>
            <Button className="mt-3" variant="secondary" onClick={() => setRefreshKey((k) => k + 1)}>
              Try again
            </Button>
          </div>
        ) : loading && !data ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : !items.length ? (
          <EmptyState
            icon={<Icon name="file" size={20} />}
            title="No receipts found"
            description={
              activeFilters.length
                ? "Nothing matches these filters."
                : "Receipts appear here as sales are taken."
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
                <Th>Reference</Th>
                <Th>Source</Th>
                <Th>Customer</Th>
                <Th>Date</Th>
                <Th>Method</Th>
                <Th className="text-right">Amount</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const meta = SOURCE_META[r.source] ?? { label: r.source, variant: "neutral" };
                return (
                  <Tr key={r.key}>
                    <Td>
                      <Link href={r.detailHref} className="font-mono text-[12.5px] font-semibold text-[#2a211a] hover:text-[#8b6f47] hover:underline">
                        {r.reference}
                      </Link>
                      {r.lineCount ? (
                        <span className="ml-2 text-[11px] text-[#9a8c7e]">
                          {r.lineCount} line{r.lineCount === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </Td>
                    <Td>
                      <span className="block font-medium text-[#2a211a]">
                        {r.customerName || "—"}
                      </span>
                      {r.customerEmail ? (
                        <span className="block text-[11.5px] text-[#9a8c7e]">{r.customerEmail}</span>
                      ) : null}
                    </Td>
                    <Td className="whitespace-nowrap text-[#7a6a5f]">
                      {r.at
                        ? new Date(r.at).toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </Td>
                    <Td className="whitespace-nowrap text-[#7a6a5f]">
                      {(r.method || "—").replace(/_/g, " ")}
                    </Td>
                    <Td className="whitespace-nowrap text-right font-semibold">
                      {money(r.amount, r.currency)}
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {r.source === "pos" ? (
                          <a
                            href={`/api/receipts/${r.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            title="Open receipt PDF"
                            className="rounded-lg p-1.5 text-[#7a6a5f] hover:bg-[#f2ede4] hover:text-[#2a211a]"
                          >
                            <Icon name="file" size={15} />
                          </a>
                        ) : null}
                        {r.stripePaymentIntentId ? (
                          <Link
                            href={`/admin/payments/${r.stripePaymentIntentId}`}
                            title="Open the payment"
                            className="rounded-lg p-1.5 text-[#7a6a5f] hover:bg-[#f2ede4] hover:text-[#2a211a]"
                          >
                            <Icon name="card" size={15} />
                          </Link>
                        ) : null}
                        <Link
                          href={r.detailHref}
                          title="Open"
                          className="rounded-lg p-1.5 text-[#7a6a5f] hover:bg-[#f2ede4] hover:text-[#2a211a]"
                        >
                          <Icon name="external" size={15} />
                        </Link>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}

        {!loading && items.length ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6e0d6] px-4 py-3">
            <div className="flex items-center gap-2">
              <Muted className="text-[12px]">
                Page {page} of {pages} · {total} total
              </Muted>
              <Select
                value={String(pageSize)}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-8 !w-auto text-[12px]"
                aria-label="Rows per page"
              >
                {[25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <Button size="sm" variant="secondary" disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </Page>
  );
}

function Stat({ label, value, hint }) {
  return (
    <Card className="py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9a8c7e]">{label}</p>
      <p className="mt-1 font-serif text-[20px] text-[#2a211a]">{value}</p>
      {hint ? <p className="mt-0.5 text-[11.5px] text-[#9a8c7e]">{hint}</p> : null}
    </Card>
  );
}
