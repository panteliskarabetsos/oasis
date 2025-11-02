// =============================================
// PAGE: src/app/admin/giftcards/page.jsx (improved)
// =============================================
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NewGiftCardModal from "./NewGiftCardModal";
import {
  Gift,
  Plus,
  Search,
  Download,
  MoreHorizontal,
  Mail,
  CircleSlash,
  CheckCircle2,
  Copy,
  ArrowLeft,
  X,
  Loader2,
  ShieldCheck,
  RefreshCcw,
  Check,
} from "lucide-react";

export default function GiftCardsPage() {
  const router = useRouter();

  // --------------------------- state ---------------------------
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [tab, setTab] = useState("all"); // all | active | redeemed | void
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState(() => new Set());
  const [busyIds, setBusyIds] = useState(() => new Set()); // per-row spinner (resend/void)
  const [toast, setToast] = useState(null);
  const [successCard, setSuccessCard] = useState(null);

  // Load initial state from URL (tab & q)
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const q = url.searchParams.get("q") || "";
      const t = url.searchParams.get("status") || "all";
      if (q) {
        setQuery(q);
        setDebouncedQ(q);
      }
      if (["all", "active", "redeemed", "void"].includes(t)) setTab(t);
    } catch {}
  }, []);

  // Update URL when tab/query change (debounced for query)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (debouncedQ) url.searchParams.set("q", debouncedQ);
    else url.searchParams.delete("q");
    if (tab !== "all") url.searchParams.set("status", tab);
    else url.searchParams.delete("status");
    window.history.replaceState({}, "", url.toString());
    // reset page on filter change
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, tab]);

  // --------------------------- data ---------------------------
  const load = async () => {
    setLoading(true);
    setSelected(new Set());
    const qs = new URLSearchParams();
    if (tab !== "all") qs.set("status", tab);
    if (debouncedQ) qs.set("q", debouncedQ);
    const url = "/api/admin/giftcards" + (qs.toString() ? `?${qs}` : "");
    const res = await fetch(url, { cache: "no-store", credentials: "include" });
    const data = res.ok ? await res.json() : [];
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const processedReturnRef = useRef(false);
  useEffect(() => {
    if (processedReturnRef.current) return;
    const url = new URL(window.location.href);
    const paid = url.searchParams.get("paid");
    const sid = url.searchParams.get("session_id");
    const cancel = url.searchParams.get("cancel");

    (async () => {
      if (paid === "1" && sid) {
        processedReturnRef.current = true;
        const res = await fetch(
          `/api/admin/giftcards/checkout/confirm?session_id=${encodeURIComponent(
            sid
          )}`,
          { credentials: "include", cache: "no-store" }
        );
        if (res.ok) {
          const j = await res.json();
          setSuccessCard(j); // show modal
          load(); // refresh table
          loadMetrics(); // refresh KPIs
        } else {
          const j = await safeJson(res);
          errToast(j?.error || "Could not confirm payment");
        }

        // Clean URL
        url.searchParams.delete("paid");
        url.searchParams.delete("session_id");
        window.history.replaceState({}, "", url.toString());
      } else if (cancel === "1") {
        errToast("Payment canceled");
        url.searchParams.delete("cancel");
        window.history.replaceState({}, "", url.toString());
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMetrics = async () => {
    const res = await fetch("/api/admin/giftcards/metrics", {
      cache: "no-store",
      credentials: "include",
    });
    const m = res.ok ? await res.json() : null;
    setMetrics(m);
  };

  useEffect(() => {
    load();
    loadMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, debouncedQ]);

  // keyboard: / to focus search, n g to new gift card
  const seqRef = useRef("");
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/") {
        const el = document.getElementById("giftcards-search");
        if (el) {
          e.preventDefault();
          el.focus();
        }
      }
      if (e.key && e.key.length === 1) {
        seqRef.current = (seqRef.current + e.key).slice(-2);
        const s = seqRef.current.toLowerCase();
        if (s === "ng") setOpenCreate(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // --------------------------- derived ---------------------------
  const filtered = useMemo(() => {
    const q = debouncedQ.toLowerCase();
    if (!q) return items;
    return items.filter((x) => {
      const hay = `${x.code} ${x.status} ${x.currency} ${
        x.recipientEmail || ""
      } ${x.recipientName || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, debouncedQ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  // --------------------------- actions ---------------------------
  async function resend(id, to) {
    toggleBusy(id, true);
    const res = await fetch(`/api/admin/giftcards/${id}/resend`, {
      method: "POST",
      credentials: "include",
      headers: to ? { "Content-Type": "application/json" } : undefined,
      body: to ? JSON.stringify({ to }) : undefined,
    });
    toggleBusy(id, false);
    if (res.ok) return okToast("Email sent");
    const j = await safeJson(res);
    return errToast(j?.error || "Failed to send email");
  }

  async function onVoid(g) {
    if (!confirm(`Void gift card ${g.code}? This cannot be undone.`)) return;
    toggleBusy(g.id, true);
    const res = await fetch(`/api/admin/giftcards/${g.id}/void`, {
      method: "POST",
      credentials: "include",
    });
    toggleBusy(g.id, false);
    if (res.ok) {
      okToast("Card voided");
      load();
      loadMetrics();
      return;
    }
    const j = await safeJson(res);
    errToast(j?.error || "Failed to void card");
  }

  function toggleBusy(id, on) {
    setBusyIds((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  function okToast(msg) {
    setToast({ type: "ok", msg });
    setTimeout(() => setToast(null), 2000);
  }
  function errToast(msg) {
    setToast({ type: "err", msg });
    setTimeout(() => setToast(null), 2500);
  }

  // bulk
  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  function toggleAllOnPage() {
    const pageIds = pageItems.map((r) => r.id);
    const allSelected = pageIds.every((id) => selected.has(id));
    setSelected((s) => {
      const n = new Set(s);
      if (allSelected) pageIds.forEach((id) => n.delete(id));
      else pageIds.forEach((id) => n.add(id));
      return n;
    });
  }
  function toggleRow(id) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function bulkResend() {
    if (!selectedIds.length) return;
    for (const id of selectedIds) await resend(id);
  }
  async function bulkVoid() {
    if (!selectedIds.length) return;
    if (!confirm(`Void ${selectedIds.length} selected card(s)?`)) return;
    for (const id of selectedIds) {
      const g = items.find((x) => x.id === id);
      if (g?.status === "active") await onVoid(g);
    }
    setSelected(new Set());
  }

  // CSV
  function doExportCsv(rows) {
    const header = [
      "code",
      "status",
      "initial_amount",
      "remaining_amount",
      "currency",
      "recipient_email",
      "recipient_name",
      "issued_at",
      "expires_at",
    ];
    const csv = [header.join(",")]
      .concat(
        rows.map((r) =>
          [
            r.code,
            r.status,
            moneyRaw(r.initialAmountCents),
            moneyRaw(r.remainingAmountCents),
            r.currency,
            r.recipientEmail || "",
            r.recipientName || "",
            r.issuedAt || "",
            r.expiresAt || "",
          ]
            .map(escapeCsv)
            .join(",")
        )
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `giftcards_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --------------------------- render ---------------------------
  return (
    <div className="relative min-h-screen bg-[#f4f1ec] text-[#5a4a3f]">
      {/* ambient blobs */}
      <div className="pointer-events-none absolute -top-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-[#e9e4dc] blur-3xl opacity-70" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[32rem] w-[32rem] rounded-full bg-[#fff4e1] blur-3xl opacity-80" />

      <div className="relative mx-auto px-6 pt-2 lg:pt-2 pb-10 max-w-6xl xl:max-w-7xl 2xl:max-w-[88rem]">
        {/* Header */}
        <div className="sticky top-[env(safe-area-inset-top)] z-20 -mx-6 mb-4 bg-gradient-to-b from-[#f4f1ec]/90 to-[#f4f1ec]/40 backdrop-blur border-b border-[#e8e2d9] px-6 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border border-[#d8cfc3] bg-[#fcf9f5] text-black text-xs shadow-sm hover:brightness-110"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
              <div>
                <h1 className="text-2xl md:text-3xl font-serif tracking-tight leading-tight text-[#5a4a3f] flex items-center gap-2">
                  <Gift className="h-6 w-6" /> Gift Cards
                </h1>
                <p className="mt-1 text-sm text-[#7a6a5f]">
                  Issue, track and manage stored-value gift cards.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => doExportCsv(filtered)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border border-[#d8cfc3] bg-white/70 text-[#5a4a3f] hover:bg-[#f1ede7] transition text-xs"
              >
                <Download className="h-4 w-4" /> Export CSV
              </button>
              <button
                onClick={() => setOpenCreate(true)}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 border border-[#d8cfc3] bg-[#8b6f47] text-white hover:brightness-110 transition text-sm shadow-sm"
              >
                <Plus className="h-4 w-4" /> New Gift Card
              </button>
            </div>
          </div>
        </div>

        <NewGiftCardModal
          open={openCreate}
          onClose={() => setOpenCreate(false)}
          onCreated={() => {
            setOpenCreate(false);
            load(); // refresh list
            loadMetrics(); // refresh KPIs
          }}
        />

        <PaymentSuccessDialog
          card={successCard}
          onClose={() => setSuccessCard(null)}
          onResend={(id, to) => resend(id, to)}
        />

        {/* KPI row */}
        <section className="mb-6 hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI
            label="Outstanding balance"
            value={fmtMoney(
              metrics?.outstandingCents,
              metrics?.currency || "EUR"
            )}
          />
          <KPI label="Sold (30d)" value={metrics?.sold30d ?? 0} />
          <KPI label="Redemptions (30d)" value={metrics?.redemptions30d ?? 0} />
          <KPI
            label="Avg value (30d)"
            value={fmtMoney(
              metrics?.avgValue30dCents,
              metrics?.currency || "EUR"
            )}
          />
        </section>

        {/* Toolbar */}
        <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <TabBtn active={tab === "all"} onClick={() => setTab("all")}>
              All
            </TabBtn>
            <TabBtn active={tab === "active"} onClick={() => setTab("active")}>
              Active
              {metrics?.activeCount ? (
                <span className="ml-1 text-[11px] opacity-70">
                  ({metrics.activeCount})
                </span>
              ) : null}
            </TabBtn>
            <TabBtn
              active={tab === "redeemed"}
              onClick={() => setTab("redeemed")}
            >
              Redeemed
              {metrics?.redeemedCount ? (
                <span className="ml-1 text-[11px] opacity-70">
                  ({metrics.redeemedCount})
                </span>
              ) : null}
            </TabBtn>
            <TabBtn active={tab === "void"} onClick={() => setTab("void")}>
              Voided
              {metrics?.voidCount ? (
                <span className="ml-1 text-[11px] opacity-70">
                  ({metrics.voidCount})
                </span>
              ) : null}
            </TabBtn>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search
              className="absolute left-3 top-2.5 h-4 w-4 text-[#7a6a5f]"
              aria-hidden
            />
            <input
              id="giftcards-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search code, recipient, status… (/ to focus)"
              className="w-full rounded-full border border-[#d8cfc3] bg-white/80 backdrop-blur px-9 py-2 text-sm placeholder:text-[#a09084] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
            />
          </div>
        </div>

        {/* Selection bar */}
        {selectedIds.length > 0 && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-[#e6dfd6] bg-white/80 px-3 py-2 text-sm shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              <span className="font-medium">{selectedIds.length} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={bulkResend}
                className="inline-flex items-center gap-1 rounded-full border border-[#d8cfc3] bg-white/70 px-3 py-1 hover:bg-[#f1ede7]"
              >
                <Mail className="h-3.5 w-3.5" /> Resend
              </button>
              <button
                onClick={bulkVoid}
                className="inline-flex items-center gap-1 rounded-full border border-[#d8cfc3] bg-white/70 px-3 py-1 hover:bg-[#f1ede7]"
              >
                <CircleSlash className="h-3.5 w-3.5" /> Void
              </button>
              <button
                onClick={() =>
                  doExportCsv(items.filter((x) => selected.has(x.id)))
                }
                className="inline-flex items-center gap-1 rounded-full border border-[#d8cfc3] bg-white/70 px-3 py-1 hover:bg-[#f1ede7]"
              >
                <Download className="h-3.5 w-3.5" /> Export
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="inline-flex items-center gap-1 rounded-full border border-[#e6dfd6] px-3 py-1"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-[#e0dcd4] shadow-xl overflow-hidden">
          <div className="grid grid-cols-12 text-xs px-4 py-2 border-b border-[#eee5da] text-[#7a6a5f]">
            <div className="col-span-3 flex items-center gap-2">
              <input
                type="checkbox"
                aria-label="Select all on page"
                onChange={toggleAllOnPage}
                checked={
                  pageItems.length > 0 &&
                  pageItems.every((r) => selected.has(r.id))
                }
              />
              <span>Code</span>
            </div>
            <div>Status</div>
            <div>Initial</div>
            <div>Remaining</div>
            <div>Currency</div>
            <div className="col-span-2">Recipient</div>
            <div>Issued</div>
            <div>Expires</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {loading ? (
            <SkeletonRows rows={6} />
          ) : pageItems.length === 0 ? (
            <EmptyState onCreate={() => setOpenCreate(true)} />
          ) : (
            <ul className="divide-y divide-[#eee5da]">
              {pageItems.map((g) => (
                <li
                  key={g.id}
                  className="grid grid-cols-12 items-center px-4 py-3 text-sm"
                >
                  <div className="col-span-3 flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      aria-label={`Select ${g.code}`}
                      checked={selected.has(g.id)}
                      onChange={() => toggleRow(g.id)}
                    />
                    <span
                      className="font-mono text-[13px] truncate"
                      title={g.code}
                    >
                      {g.code}
                    </span>
                    <CopyBtn
                      value={g.code}
                      onCopied={() => okToast("Code copied")}
                    />
                  </div>
                  <div>{badge(g.status)}</div>
                  <div>{fmtMoney(g.initialAmountCents, g.currency)}</div>
                  <div>{fmtMoney(g.remainingAmountCents, g.currency)}</div>
                  <div>{g.currency}</div>
                  <div
                    className="col-span-2 truncate"
                    title={g.recipientEmail || g.recipientName || ""}
                  >
                    {g.recipientName || g.recipientEmail || "—"}
                  </div>
                  <div>{fmtDate(g.issuedAt)}</div>
                  <div>{g.expiresAt ? fmtDate(g.expiresAt) : "—"}</div>
                  <div className="col-span-2 flex items-center gap-4 justify-end">
                    <button
                      className="text-xs underline disabled:opacity-50"
                      onClick={() => resend(g.id)}
                      disabled={busyIds.has(g.id)}
                      title="Resend email"
                    >
                      {busyIds.has(g.id) ? (
                        <Loader2 className="inline h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Mail className="inline h-3 w-3 mr-1" />
                      )}
                      Resend
                    </button>
                    <button
                      className="text-xs underline disabled:opacity-50"
                      onClick={() => onVoid(g)}
                      disabled={g.status !== "active" || busyIds.has(g.id)}
                      title={
                        g.status !== "active"
                          ? "Only active cards can be voided"
                          : "Void card"
                      }
                    >
                      <CircleSlash className="inline h-3 w-3 mr-1" />
                      Void
                    </button>
                    <Link
                      href={`/admin/giftcards/${g.id}`}
                      className="text-xs underline"
                    >
                      <MoreHorizontal className="inline h-3 w-3 mr-1" />
                      Details
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="text-[#7a6a5f]">
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded-full border border-[#d8cfc3] bg-white/70 px-3 py-1 disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </button>
              <button
                className="rounded-full border border-[#d8cfc3] bg-white/70 px-3 py-1 disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </button>
              <select
                className="rounded-full border border-[#d8cfc3] bg-white/70 px-2 py-1"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[10, 20, 30, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}/page
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {toast && (
          <Toast type={toast.type} onClose={() => setToast(null)}>
            {toast.msg}
          </Toast>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- components ---------------------------- */

function KPI({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#e6dfd6] bg-white/80 backdrop-blur p-4 shadow-sm">
      <p className="text-xs text-[#7a6a5f]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">
        {value ?? "—"}
      </p>
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm border transition " +
        (active
          ? "bg-[#8b6f47] text-white border-[#8b6f47] shadow-sm"
          : "bg-white/70 text-[#5a4a3f] border-[#d8cfc3] hover:bg-[#f1ede7]")
      }
    >
      {children}
    </button>
  );
}

function badge(status) {
  const cls =
    status === "active"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "redeemed"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : status === "void"
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-[#f6f3ef] text-[#5a4a3f] border-[#e6dfd6]";
  const icon =
    status === "active" ? (
      <CheckCircle2 className="h-3.5 w-3.5" />
    ) : status === "void" ? (
      <CircleSlash className="h-3.5 w-3.5" />
    ) : null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] rounded-full border ${cls}`}
    >
      {icon}
      {status}
    </span>
  );
}

function CopyBtn({ value, onCopied }) {
  const [copied, setCopied] = useState(false);
  async function onCopy() {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }
  return (
    <button
      className="inline-flex items-center gap-1 rounded-full border border-[#e6dfd6] px-2 py-0.5 text-[11px] hover:bg-[#f6f3ef]"
      onClick={onCopy}
      title="Copy code"
      type="button"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{" "}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function SkeletonRows({ rows = 6 }) {
  return (
    <ul className="divide-y divide-[#eee5da]">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="grid grid-cols-12 items-center px-4 py-3">
          {[3, 1, 1, 1, 1, 2, 1, 1, 2].map((c, idx) => (
            <div
              key={idx}
              className={`col-span-${c} h-4 bg-[#eee5da] rounded`}
            ></div>
          ))}
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div className="p-10 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fbf7f1] border border-[#efe7db] shadow-sm">
        <Gift className="h-6 w-6 text-[#8b6f47]" />
      </div>
      <h3 className="mt-3 text-base font-semibold">No gift cards yet</h3>
      <p className="mt-1 text-sm text-[#7a6a5f]">
        Create your first gift card and email it to a recipient.
      </p>
      <button
        onClick={onCreate}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-2 border border-[#d8cfc3] bg-[#8b6f47] text-white hover:brightness-110 text-sm shadow-sm"
      >
        <Plus className="h-4 w-4" /> New Gift Card
      </button>
    </div>
  );
}

function Toast({ type = "ok", onClose, children }) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div
        className={
          "flex items-center gap-2 rounded-full px-3 py-2 shadow-lg border " +
          (type === "ok"
            ? "bg-emerald-600 text-white border-emerald-700"
            : "bg-red-600 text-white border-red-700")
        }
      >
        {type === "ok" ? (
          <Check className="h-4 w-4" />
        ) : (
          <X className="h-4 w-4" />
        )}{" "}
        {children}
        <button className="ml-2 opacity-80" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function PaymentSuccessDialog({ card, onClose, onResend }) {
  if (!card) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-white border border-[#e0dcd4] shadow-2xl p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100">
              <Gift className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-lg font-semibold leading-tight">
                Payment successful
              </h3>
              <p className="text-xs text-[#7a6a5f]">
                Gift card <span className="font-mono">{card.code}</span>{" "}
                created.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 border border-[#e6dfd6]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-[#e6dfd6] bg-[#fbf7f1] p-3 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[#7a6a5f]">Code</div>
              <div className="font-mono text-base">{card.code}</div>
            </div>
            <div className="text-right">
              <div className="text-[#7a6a5f]">Value</div>
              <div className="font-medium">
                {fmtMoney(card.amountCents, card.currency)}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            className="rounded-full border border-[#d8cfc3] px-3 py-1.5 bg-white hover:bg-[#f6f3ef]"
            onClick={() => navigator.clipboard?.writeText(card.code)}
          >
            Copy code
          </button>
          {card.recipientEmail ? (
            <button
              className="rounded-full border border-[#d8cfc3] px-3 py-1.5 bg-white hover:bg-[#f6f3ef]"
              onClick={() => onResend?.(card.id, card.recipientEmail)}
            >
              Send to {card.recipientEmail}
            </button>
          ) : null}
          <button
            className="rounded-full border px-3 py-1.5 bg-[#8b6f47] text-white"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- utils ---------------------------- */

function fmtMoney(cents, currency = "EUR") {
  const n = Number.isFinite(cents) ? Math.max(0, cents) / 100 : 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}
function moneyRaw(cents) {
  const n = Number.isFinite(cents) ? Math.max(0, cents) / 100 : 0;
  return n.toFixed(2);
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}
function escapeCsv(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes("\n") || s.includes('"'))
    return '"' + s.replaceAll('"', '""') + '"';
  return s;
}
function generateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let s = "";
  for (let i = 0; i < 12; i++)
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s.replace(/(.{4})/g, "$1-").replace(/-$/, "");
}
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
