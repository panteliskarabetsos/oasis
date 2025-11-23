"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  ExternalLink,
  Receipt,
  CreditCard,
  ClipboardCopy,
  CheckCircle2,
  Calendar as CalIcon,
  ShieldCheck,
  ChevronDown,
  RefreshCw,
  Check,
  X,
  RotateCcw,
  Send,
  Wallet,
} from "lucide-react";

/* ------------------------------ utils ------------------------------ */
const ATHENS_TZ = "Europe/Athens";
const cls = (...xs) => xs.filter(Boolean).join(" ");
const up = (s) => (s ? String(s).toUpperCase() : s);
const pretty = (x) => JSON.stringify(x, null, 2);

const toCurrency = (cents = 0, currency = "EUR") => {
  const amt = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(amt);
  } catch {
    return `${amt.toFixed(2)} ${currency}`;
  }
};

const dt = (unixSeconds) =>
  new Date(unixSeconds * 1000).toLocaleString("en-GB", {
    timeZone: ATHENS_TZ,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const rel = (unixSeconds) => {
  try {
    const diff = Date.now() - unixSeconds * 1000;
    const mins = Math.round(diff / 60000);
    if (Math.abs(mins) < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (Math.abs(hours) < 48) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
};

async function copy(text, setCopied) {
  try {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  } catch {}
}

function parseAmountToCents(input, currency = "EUR") {
  // Accept "12", "12.34", "€12.34" etc.
  if (!input) return null;
  const cleaned = String(input)
    .replace(/[^0-9.,-]/g, "")
    .replace(",", ".");
  const val = Number.parseFloat(cleaned);
  if (!Number.isFinite(val) || val < 0) return null;
  return Math.round(val * 100);
}

/* --------------------------- small UI bits -------------------------- */
function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "border-[#e3ded6] text-[#5a4a3f] bg-white",
    subtle: "border-[#e5e0d8] text-[#5a4a3f] bg-[#faf7f1]",
  };
  return (
    <span
      className={cls(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

function Card({ title, extra, children, padded = true, bleed = false }) {
  return (
    <div
      className={cls(
        "rounded-2xl border border-[#e8e5df] bg-white",
        bleed ? "overflow-hidden" : ""
      )}
    >
      {(title || extra) && (
        <div className="flex items-center justify-between border-b border-[#eeeae3] px-5 py-3">
          {typeof title === "string" ? (
            <h3 className="text-sm font-semibold text-[#3f342c]">{title}</h3>
          ) : (
            title
          )}
          {extra}
        </div>
      )}
      <div className={cls(padded ? "p-5" : "")}>{children}</div>
    </div>
  );
}

function KeyRow({ k, v }) {
  return (
    <div className="grid grid-cols-3 items-start gap-3 py-2 text-sm">
      <div className="col-span-1 text-[#7a6a58]">{k}</div>
      <div className="col-span-2 text-[#3f342c]">{v}</div>
    </div>
  );
}

function Skeleton({ className = "" }) {
  return (
    <div className={cls("animate-pulse rounded-md bg-[#efeae1]", className)} />
  );
}

/* --------------------------- status styles -------------------------- */
function StatusBadge({ status }) {
  const map = {
    succeeded: [
      "Succeeded",
      "bg-emerald-50 text-emerald-700 border-emerald-200",
    ],
    processing: ["Processing", "bg-amber-50 text-amber-800 border-amber-200"],
    requires_action: [
      "Requires action",
      "bg-amber-50 text-amber-800 border-amber-200",
    ],
    requires_payment_method: [
      "Requires payment method",
      "bg-amber-50 text-amber-800 border-amber-200",
    ],
    requires_confirmation: [
      "Requires confirmation",
      "bg-amber-50 text-amber-800 border-amber-200",
    ],
    requires_capture: [
      "Requires capture",
      "bg-amber-50 text-amber-800 border-amber-200",
    ],
    canceled: ["Canceled", "bg-zinc-50 text-zinc-700 border-zinc-200"],
    refunded: ["Refunded", "bg-sky-50 text-sky-700 border-sky-200"],
    partially_refunded: [
      "Partially refunded",
      "bg-sky-50 text-sky-700 border-sky-200",
    ],
    failed: ["Failed", "bg-rose-50 text-rose-700 border-rose-200"],
  };
  const [text, palette] = map[status || ""] || [
    String(status || "Unknown"),
    "bg-zinc-50 text-zinc-700 border-zinc-200",
  ];
  return (
    <span
      className={cls(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
        palette
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" /> {text}
    </span>
  );
}

/* ----------------------------- toasts ------------------------------ */
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = (t) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((xs) => [...xs, { id, ...t }]);
    setTimeout(
      () => setToasts((xs) => xs.filter((x) => x.id !== id)),
      t.ttl ?? 3000
    );
  };
  const api = {
    success: (m) => push({ type: "success", m }),
    error: (m) => push({ type: "error", m, ttl: 5000 }),
    info: (m) => push({ type: "info", m }),
  };
  return [toasts, api];
}

function Toasts({ toasts }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cls(
            "pointer-events-auto flex items-center gap-2 rounded-xl border px-3 py-2 text-sm shadow",
            t.type === "success" &&
              "border-emerald-200 bg-emerald-50 text-emerald-800",
            t.type === "error" && "border-rose-200 bg-rose-50 text-rose-800",
            t.type === "info" && "border-sky-200 bg-sky-50 text-sky-800"
          )}
        >
          {t.type === "success" ? (
            <Check className="h-4 w-4" />
          ) : t.type === "error" ? (
            <X className="h-4 w-4" />
          ) : (
            <InfoDot />
          )}
          <div className="min-w-0 flex-1">{t.m}</div>
        </div>
      ))}
    </div>
  );
}

function InfoDot() {
  return <div className="h-2 w-2 rounded-full bg-current" />;
}

/* --------------------------- auto refresh -------------------------- */
function useAutoRefresh(enabled, cb, deps = []) {
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => cb?.(), 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);
}

/* ------------------------------ page ------------------------------- */
export default function PaymentDetailPage() {
  const { id } = useParams(); // Payment Intent id
  const router = useRouter();

  const [toasts, toast] = useToasts();

  const [auth, setAuth] = useState({ loading: true, ok: true });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [p, setP] = useState(null);
  const [raw, setRaw] = useState(null);
  const [copied, setCopied] = useState(false);
  const [auto, setAuto] = useState(true);

  // auth gate
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const r = await fetch("/api/me", { cache: "no-store" });
        if (!ignore) setAuth({ loading: false, ok: r.ok });
      } catch {
        if (!ignore) setAuth({ loading: false, ok: false });
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const doFetch = async () => {
    if (!id) return;
    setLoading(true);
    setErr("");
    const ctrl = new AbortController();
    try {
      const r = await fetch(`/api/admin/payments/${id}`, {
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!r.ok) throw new Error(`Failed (${r.status})`);
      const data = await r.json();
      setRaw(data);
      setP(data.item || null);
    } catch (e) {
      setErr(e?.message || "Failed to load payment");
    } finally {
      setLoading(false);
    }
    return () => ctrl.abort();
  };

  // fetch payment (initial + id changes)
  useEffect(() => {
    let cancel;
    (async () => {
      cancel = await doFetch();
    })();
    return () => cancel?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // auto refresh while in a pending-ish state
  const isPendingish = useMemo(() => {
    if (!p) return false;
    const s = p.status;
    return [
      "processing",
      "requires_action",
      "requires_payment_method",
      "requires_confirmation",
      "requires_capture",
    ].includes(s);
  }, [p]);
  useAutoRefresh(auto && isPendingish, doFetch, [id, isPendingish]);

  /* derived */
  const currency = up(p?.currency || "eur");
  const amount = toCurrency(p?.amount_received ?? p?.amount ?? 0, currency);
  const refundsTotal = useMemo(
    () =>
      Array.isArray(p?.refunds)
        ? p.refunds.reduce((s, r) => s + (r.amount || 0), 0)
        : 0,
    [p]
  );
  const displayStatus = useMemo(() => {
    if (!p) return "";
    const got = p.amount_received || 0;
    if (got > 0 && refundsTotal >= got) return "refunded";
    if (refundsTotal > 0 && refundsTotal < got) return "partially_refunded";
    return p.status;
  }, [p, refundsTotal]);
  const netReceived = Math.max((p?.amount_received || 0) - refundsTotal, 0);

  /* actions */
  async function apiPOST(path, body) {
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || `Request failed (${r.status})`);
      toast.success("Done");
      await doFetch();
      return data;
    } catch (e) {
      toast.error(e.message || "Something went wrong");
      throw e;
    }
  }

  const onCapture = async () => {
    await apiPOST(`/api/admin/payments/${id}/capture`);
  };
  const onCancel = async () => {
    if (!confirm("Cancel this Payment Intent?")) return;
    await apiPOST(`/api/admin/payments/${id}/cancel`);
  };
  const onRefund = async () => {
    const val = window.prompt(
      `Refund amount (${currency}) — leave empty for full refund:`
    );
    let cents = null;
    if (val && val.trim().length > 0) {
      cents = parseAmountToCents(val, currency);
      if (cents == null) return toast.error("Invalid amount");
    }
    await apiPOST(
      `/api/admin/payments/${id}/refund`,
      cents != null ? { amount: cents } : undefined
    );
  };
  const onResendReceipt = async () => {
    await apiPOST(`/api/admin/payments/${id}/resend-receipt`);
  };

  const canCapture = p?.status === "requires_capture";
  const canCancel = [
    "requires_payment_method",
    "requires_confirmation",
    "requires_action",
    "processing",
  ].includes(p?.status);
  const canRefund = (p?.amount_received || 0) > 0 && netReceived > 0;

  /* keyboard shortcuts */
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey) return;
      if (e.key === "r" && canRefund) {
        e.preventDefault();
        onRefund();
      } else if (e.key === "c" && canCapture) {
        e.preventDefault();
        onCapture();
      } else if (e.key === "Escape") {
        router.back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRefund, canCapture, id]);

  /* loading / auth states */
  if (auth.loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="flex items-center gap-3 text-[#5a4a3f]">
          <Loader2 className="h-5 w-5 animate-spin" />
          <p>Checking access…</p>
        </div>
      </div>
    );
  }
  if (!auth.ok) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
        <h1 className="mt-3 text-xl font-semibold text-[#3f342c]">
          Not authorized
        </h1>
        <p className="mt-2 text-sm text-[#7a6a58]">
          Please sign in to view this payment.
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
    <div className="mx-auto max-w-6xl">
      <Toasts toasts={toasts} />
      {/* Sticky subheader */}
      <div className="sticky top-0 z-20 border-b border-[#ede9e2] bg-[rgba(252,249,244,0.75)] backdrop-blur">
        <div className="mx-auto flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#e8e5df] bg-white px-3 text-sm text-[#5a4a3f] hover:bg-[#faf8f5]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div className="hidden sm:block">
              <div className="text-xs text-[#7a6a58]">Payment Intent</div>
              <div className="flex items-center gap-2">
                <code className="rounded bg-[#fcf9f4] px-2 py-0.5 text-sm text-[#3f342c]">
                  {p?.id || "—"}
                </code>
                {p?.id && (
                  <button
                    onClick={() => copy(p.id, setCopied)}
                    className="rounded p-1 hover:bg-[#f6f2ec]"
                    title="Copy"
                  >
                    {copied ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <ClipboardCopy className="h-4 w-4 text-[#7a6a58]" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={doFetch}
              className="inline-flex items-center gap-1 rounded-xl border border-[#e8e5df] bg-white px-3 py-1.5 text-sm text-[#5a4a3f] hover:bg-[#faf8f5]"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <label className="hidden items-center gap-2 text-xs text-[#6b5e53] sm:inline-flex">
              <input
                type="checkbox"
                className="accent-[#8b6f47]"
                checked={auto}
                onChange={(e) => setAuto(e.target.checked)}
              />
              Auto-refresh{" "}
              {isPendingish ? (
                <span className="text-emerald-700">(active)</span>
              ) : (
                <span className="text-[#7a6a58]">(idle)</span>
              )}
            </label>
            {p?.receipt_url && (
              <a
                href={p.receipt_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-xl border border-[#e8e5df] bg-white px-3 py-1.5 text-sm text-[#5a4a3f] hover:bg-[#faf8f5]"
              >
                <Receipt className="h-4 w-4" /> Receipt
              </a>
            )}
            {p?.links?.dashboard_payment && (
              <a
                href={p.links.dashboard_payment}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-xl border border-[#e8e5df] bg-white px-3 py-1.5 text-sm text-[#5a4a3f] hover:bg-[#faf8f5]"
              >
                Open in Stripe <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="px-4 pt-6 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-[#e5e0d8] bg-[#fcf9f4]">
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[#e9e3d9] opacity-60 blur-3xl" />
          <div className="relative z-10 p-6">
            {loading ? (
              <div>
                <Skeleton className="h-6 w-28" />
                <Skeleton className="mt-2 h-8 w-40" />
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Skeleton className="h-20 w-full rounded-2xl" />
                  <Skeleton className="h-20 w-full rounded-2xl" />
                  <Skeleton className="h-20 w-full rounded-2xl" />
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm text-[#7a6a58]">Amount</div>
                    <div className="mt-1 text-3xl font-semibold text-[#3f342c]">
                      {amount}
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-[#7a6a58]">
                      <span className="inline-flex items-center gap-1">
                        <CalIcon className="h-3.5 w-3.5" />
                        {p ? dt(p.created) : "—"}
                      </span>
                      {p && <span>• {rel(p.created)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge status={displayStatus} />
                    {p?.method && (
                      <Badge tone="subtle">
                        <CreditCard className="h-4 w-4 text-[#8b6f47]" />
                        {p.method}
                        {p.card_brand && p.card_last4 && (
                          <span className="ml-1 text-[#7a6a58]">
                            • {up(p.card_brand)} **** {p.card_last4}
                          </span>
                        )}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Stat cards */}
                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl border border-[#e8e5df] bg-white p-4 shadow-sm">
                    <div className="text-xs text-[#7a6a58]">Intended</div>
                    <div className="mt-1 text-lg font-semibold text-[#3f342c]">
                      {toCurrency(p?.amount ?? 0, currency)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#e8e5df] bg-white p-4 shadow-sm">
                    <div className="text-xs text-[#7a6a58]">Captured</div>
                    <div className="mt-1 text-lg font-semibold text-[#3f342c]">
                      {toCurrency(p?.amount_received ?? 0, currency)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#e8e5df] bg-white p-4 shadow-sm">
                    <div className="text-xs text-[#7a6a58]">Refunded</div>
                    <div className="mt-1 text-lg font-semibold text-[#3f342c]">
                      {toCurrency(refundsTotal, currency)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#e8e5df] bg-white p-4 shadow-sm">
                    <div className="text-xs text-[#7a6a58]">Net</div>
                    <div className="mt-1 text-lg font-semibold text-[#3f342c]">
                      {toCurrency(netReceived, currency)}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Grid */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left column */}
          <div className="space-y-6 lg:col-span-2">
            <Card title="Customer">
              <KeyRow
                k="Name"
                v={
                  p?.customer?.name ||
                  (p?.customer?.email ? p.customer.email.split("@")[0] : "—")
                }
              />
              <KeyRow
                k="Email"
                v={
                  p?.customer?.email ? (
                    <span className="inline-flex items-center gap-2">
                      {p.customer.email}
                      <button
                        className="rounded p-1 hover:bg-[#f6f2ec]"
                        title="Copy email"
                        onClick={() => copy(p.customer.email, setCopied)}
                      >
                        <ClipboardCopy className="h-4 w-4 text-[#7a6a58]" />
                      </button>
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              {p?.customer?.id && (
                <KeyRow
                  k="Customer ID"
                  v={
                    <code className="rounded bg-[#fcf9f4] px-1 py-0.5">
                      {p.customer.id}
                    </code>
                  }
                />
              )}
            </Card>

            <Card title="Booking">
              {p?.booking_id ? (
                <Link
                  href={`/admin/bookings/${p.booking_id}`}
                  className="text-[#3f342c] underline-offset-2 hover:underline"
                >
                  #{p.booking_id}
                </Link>
              ) : (
                <span className="text-[#7a6a58]">Not linked</span>
              )}
            </Card>

            <Card
              title="Refunds"
              extra={
                <span className="text-xs text-[#7a6a58]">
                  Total: {toCurrency(refundsTotal, currency)}
                </span>
              }
              padded={false}
            >
              {Array.isArray(p?.refunds) && p.refunds.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[#fcf9f4] text-[#7a6a58]">
                      <tr>
                        <th className="px-5 py-2 text-left font-medium">
                          Refund
                        </th>
                        <th className="px-5 py-2 text-left font-medium">
                          Amount
                        </th>
                        <th className="px-5 py-2 text-left font-medium">
                          Status
                        </th>
                        <th className="px-5 py-2 text-left font-medium">
                          Created
                        </th>
                        {/* NEW: Admin */}
                        <th className="px-5 py-2 text-left font-medium">
                          Admin
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.refunds.map((r) => {
                        const adminName =
                          r.performed_by_name || r.performed_by_email || null;

                        return (
                          <tr key={r.id} className="border-t border-[#f0ece6]">
                            <td className="px-5 py-2">
                              <code className="rounded bg-[#fcf9f4] px-1 py-0.5">
                                {r.id}
                              </code>
                            </td>
                            <td className="px-5 py-2">
                              {toCurrency(r.amount, currency)}
                            </td>
                            <td className="px-5 py-2">
                              <span className="text-[#7a6a58]">{r.status}</span>
                            </td>
                            <td className="px-5 py-2">
                              <div>{dt(r.created)}</div>
                              <div className="text-xs text-[#a09386]">
                                {rel(r.created)}
                              </div>
                            </td>
                            {/* NEW: Admin cell */}
                            <td className="px-5 py-2">
                              {adminName ? (
                                <span className="text-xs text-[#3f342c]">
                                  {adminName}
                                </span>
                              ) : (
                                <span className="text-xs text-[#b0a496]">
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-5 py-6 text-sm text-[#7a6a58]">
                  No refunds
                </div>
              )}
            </Card>

            <Card title="Activity">
              <ol className="relative ml-2 border-l border-[#eee8df]">
                {p?.created ? (
                  <li className="ml-4 mb-3">
                    <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-[#c7b9a6]" />
                    <div className="text-sm text-[#3f342c]">
                      Payment created
                    </div>
                    <div className="text-xs text-[#7a6a58]">
                      {dt(p.created)} • {rel(p.created)}
                    </div>
                  </li>
                ) : null}
                {p?.amount_received ? (
                  <li className="ml-4 mb-3">
                    <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-emerald-400" />
                    <div className="text-sm text-[#3f342c]">Funds captured</div>
                    <div className="text-xs text-[#7a6a58]">
                      {toCurrency(p.amount_received, currency)}
                    </div>
                  </li>
                ) : null}
                {Array.isArray(p?.refunds) &&
                  p.refunds.map((r) => {
                    const adminName =
                      r.performed_by_name || r.performed_by_email || null;

                    return (
                      <li key={r.id} className="ml-4 mb-3">
                        <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-sky-400" />
                        <div className="text-sm text-[#3f342c]">
                          Refunded {toCurrency(r.amount, currency)}
                          {adminName && (
                            <span className="text-xs text-[#7a6a58]">
                              {" "}
                              · by {adminName}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#7a6a58]">
                          {dt(r.created)} • {rel(r.created)}
                        </div>
                      </li>
                    );
                  })}

                {!p?.created && (!p?.refunds || p.refunds.length === 0) ? (
                  <li className="ml-4 mb-3">
                    <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-[#ddd5c9]" />
                    <div className="text-sm text-[#7a6a58]">No activity</div>
                  </li>
                ) : null}
              </ol>
            </Card>

            <Card title="Metadata">
              {p?.metadata && Object.keys(p.metadata).length > 0 ? (
                <>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {Object.entries(p.metadata).map(([k, v]) => (
                      <span
                        key={k}
                        className="inline-flex items-center gap-2 rounded-full border border-[#e5e0d8] bg-[#faf7f1] px-3 py-1 text-xs text-[#5a4a3f]"
                      >
                        <span className="rounded bg-white px-1 py-0.5 text-[11px] text-[#7a6a58]">
                          {k}
                        </span>
                        <code className="text-[#3f342c]">{String(v)}</code>
                      </span>
                    ))}
                  </div>
                  <details className="mt-4 group">
                    <summary className="flex cursor-pointer select-none items-center gap-2 text-xs text-[#7a6a58] hover:text-[#5a4a3f]">
                      <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                      View raw JSON
                    </summary>
                    <pre className="mt-2 max-h-72 overflow-auto rounded-xl border border-[#efe9e0] bg-[#fcfbf8] p-3 text-xs text-[#3f342c]">
                      {pretty(p.metadata)}
                    </pre>
                  </details>
                </>
              ) : (
                <div className="mt-1 text-sm text-[#7a6a58]">No metadata</div>
              )}
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <Card title="Identifiers">
              <div className="space-y-2 text-sm">
                <KeyRow
                  k="Payment Intent"
                  v={
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-[#fcf9f4] px-2 py-0.5">
                        {p?.id}
                      </code>
                      {p?.id && (
                        <button
                          onClick={() => copy(p.id, setCopied)}
                          className="rounded p-1 hover:bg-[#f6f2ec]"
                          title="Copy"
                        >
                          {copied ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <ClipboardCopy className="h-4 w-4 text-[#7a6a58]" />
                          )}
                        </button>
                      )}
                    </div>
                  }
                />
                {p?.latest_charge && (
                  <KeyRow
                    k="Latest Charge"
                    v={
                      p?.links?.dashboard_charge ? (
                        <a
                          href={p.links.dashboard_charge}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-2"
                        >
                          {p.latest_charge}
                        </a>
                      ) : (
                        <code className="rounded bg-[#fcf9f4] px-2 py-0.5">
                          {p.latest_charge}
                        </code>
                      )
                    }
                  />
                )}
              </div>
              <div className="mt-4 rounded-xl border border-[#efe9e0] bg-[#fcfbf8] p-3 text-xs text-[#6b5e53]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" /> Processed
                  securely by Stripe.
                </div>
              </div>
            </Card>

            <Card title="Payment method">
              <div className="text-sm">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[#7a6a58]" />
                  <span className="text-[#3f342c]">{p?.method || "—"}</span>
                </div>
                {p?.card_brand && p?.card_last4 && (
                  <div className="mt-1 text-xs text-[#7a6a58]">
                    {up(p.card_brand)} • **** {p.card_last4}
                  </div>
                )}
              </div>
            </Card>

            <Card title="Actions">
              <div className="flex flex-col gap-2">
                <button
                  disabled={!canRefund}
                  onClick={onRefund}
                  className={cls(
                    "inline-flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition",
                    canRefund
                      ? "border-[#e8e5df] bg-[#fcfbf8] hover:bg-white"
                      : "cursor-not-allowed border-[#eee] bg-[#fafafa] text-[#aaa]"
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" /> Refund…
                  </span>
                </button>
                <button
                  disabled={!canCapture}
                  onClick={onCapture}
                  className={cls(
                    "inline-flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition",
                    canCapture
                      ? "border-[#e8e5df] bg-[#fcfbf8] hover:bg-white"
                      : "cursor-not-allowed border-[#eee] bg-[#fafafa] text-[#aaa]"
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <Wallet className="h-4 w-4" /> Capture
                  </span>
                </button>
                <button
                  disabled={!canCancel}
                  onClick={onCancel}
                  className={cls(
                    "inline-flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition",
                    canCancel
                      ? "border-[#e8e5df] bg-[#fcfbf8] hover:bg-white"
                      : "cursor-not-allowed border-[#eee] bg-[#fafafa] text-[#aaa]"
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <X className="h-4 w-4" /> Cancel
                  </span>
                </button>
                <button
                  onClick={onResendReceipt}
                  className="inline-flex items-center justify-between rounded-xl border border-[#e8e5df] bg-[#fcfbf8] px-3 py-2 text-sm hover:bg-white"
                >
                  <span className="inline-flex items-center gap-2">
                    <Send className="h-4 w-4" /> Resend receipt
                  </span>
                </button>
              </div>
              <div className="mt-3 text-xs text-[#7a6a58]">
                Shortcuts: <kbd className="rounded border px-1">R</kbd> refund,{" "}
                <kbd className="rounded border px-1">C</kbd> capture,{" "}
                <kbd className="rounded border px-1">Esc</kbd> back.
              </div>
            </Card>

            <Card title="Quick links">
              <div className="flex flex-col gap-2 text-sm">
                {p?.receipt_url && (
                  <a
                    href={p.receipt_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-between rounded-xl border border-[#e8e5df] bg-[#fcfbf8] px-3 py-2 hover:bg-white"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Receipt className="h-4 w-4" /> Receipt
                    </span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                {p?.links?.dashboard_payment && (
                  <a
                    href={p.links.dashboard_payment}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-between rounded-xl border border-[#e8e5df] bg-[#fcfbf8] px-3 py-2 hover:bg-white"
                  >
                    <span className="inline-flex items-center gap-2">
                      Stripe payment
                    </span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                {p?.links?.dashboard_pi && (
                  <a
                    href={p.links.dashboard_pi}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-between rounded-xl border border-[#e8e5df] bg-[#fcfbf8] px-3 py-2 hover:bg-white"
                  >
                    <span className="inline-flex items-center gap-2">
                      Stripe PI
                    </span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </Card>

            <Card title="Raw data">
              <details className="group">
                <summary className="flex cursor-pointer select-none items-center gap-2 text-xs text-[#7a6a58] hover:text-[#5a4a3f]">
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  API payload (everything we receive)
                </summary>
                <div className="mt-2 flex items-center justify-end">
                  <button
                    onClick={() => copy(pretty(raw ?? {}), setCopied)}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#e8e5df] bg-white px-3 py-1.5 text-xs text-[#5a4a3f] hover:bg-[#faf8f5]"
                  >
                    <ClipboardCopy className="h-4 w-4" /> Copy JSON
                  </button>
                </div>
                <pre className="mt-2 max-h-80 overflow-auto rounded-xl border border-[#efe9e0] bg-[#fcfbf8] p-3 text-[11px] leading-5 text-[#3f342c]">
                  {pretty(raw ?? {})}
                </pre>
              </details>

              <details className="group mt-3">
                <summary className="flex cursor-pointer select-none items-center gap-2 text-xs text-[#7a6a58] hover:text-[#5a4a3f]">
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  Normalized item (what the UI uses)
                </summary>
                <pre className="mt-2 max-h-80 overflow-auto rounded-xl border border-[#efe9e0] bg-[#fcfbf8] p-3 text-[11px] leading-5 text-[#3f342c]">
                  {pretty(p ?? {})}
                </pre>
              </details>
            </Card>
          </div>
        </div>

        {/* Loading / error placeholders */}
        {loading && (
          <div className="mt-6 rounded-2xl border border-[#e8e5df] bg-white p-6 text-[#7a6a58]">
            <Loader2 className="mr-2 inline h-5 w-5 animate-spin" /> Loading
            payment…
          </div>
        )}
        {err && !loading && (
          <div className="mt-6 rounded-2xl border border-[#f7d7d9] bg-[#fff7f8] p-6 text-rose-700">
            <div className="flex items-center justify-between">
              <div>
                <AlertCircle className="mr-2 inline h-5 w-5" /> {err}
              </div>
              <button
                onClick={doFetch}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50"
              >
                <RefreshCw className="h-4 w-4" /> Retry
              </button>
            </div>
          </div>
        )}
        {!p && !loading && !err && (
          <div className="mt-6 rounded-2xl border border-[#e8e5df] bg-white p-6 text-[#7a6a58]">
            Payment not found.
          </div>
        )}
      </div>
    </div>
  );
}
