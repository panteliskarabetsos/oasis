"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
  User,
  Hash,
  Activity,
  Code2,
  AlertTriangle,
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
    setTimeout(() => setCopied(false), 1500);
  } catch {}
}

function parseAmountToCents(input, currency = "EUR") {
  if (!input) return null;
  const cleaned = String(input)
    .replace(/[^0-9.,-]/g, "")
    .replace(",", ".");
  const val = Number.parseFloat(cleaned);
  if (!Number.isFinite(val) || val < 0) return null;
  return Math.round(val * 100);
}

/* --------------------------- small UI bits -------------------------- */

function Card({ title, icon, extra, children, padded = true, className = "" }) {
  return (
    <div
      className={cls(
        "rounded-[2rem] border border-[#e1dbd2] bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden",
        className,
      )}
    >
      {(title || extra) && (
        <div className="flex items-center justify-between border-b border-[#efe9e1] bg-[#fcfbf9] px-6 py-4">
          <div className="flex items-center gap-2">
            {icon && <div className="text-[#8b6f47]">{icon}</div>}
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#a79a8f]">
              {title}
            </h3>
          </div>
          {extra && <div>{extra}</div>}
        </div>
      )}
      <div className={cls(padded ? "p-6" : "")}>{children}</div>
    </div>
  );
}

function KeyRow({ k, v, copyable = false, onCopy }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-3 border-b border-[#f4f1ec] last:border-0 gap-1 sm:gap-4">
      <div className="sm:w-1/3 text-[13px] font-medium text-[#a79a8f]">{k}</div>
      <div className="sm:w-2/3 text-sm text-[#3a2f28] font-medium flex items-center gap-2 min-w-0">
        <span className="truncate">{v}</span>
        {copyable && v && v !== "—" && (
          <button
            onClick={() => {
              if (onCopy) onCopy(setCopied);
              else copy(String(v), setCopied);
            }}
            className="text-[#a79a8f] hover:text-[#8b6f47] transition-colors shrink-0"
            title="Copy"
          >
            {copied ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <ClipboardCopy className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function Skeleton({ className = "" }) {
  return (
    <div
      className={cls("animate-pulse rounded-xl bg-[#e3ddd4]/50", className)}
    />
  );
}

/* --------------------------- status styles -------------------------- */
function StatusBadge({ status, lg = false }) {
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
    canceled: ["Canceled", "bg-[#f5f1ea] text-[#7c6d62] border-[#e7e0d6]"],
    refunded: ["Refunded", "bg-sky-50 text-sky-700 border-sky-200"],
    partially_refunded: [
      "Partially refunded",
      "bg-sky-50 text-sky-700 border-sky-200",
    ],
    failed: ["Failed", "bg-rose-50 text-rose-700 border-rose-200"],
  };

  const [text, palette] = map[status || ""] || [
    String(status || "Unknown").replace(/_/g, " "),
    "bg-[#f5f1ea] text-[#7c6d62] border-[#e7e0d6]",
  ];

  return (
    <span
      className={cls(
        "inline-flex items-center gap-1.5 rounded-full border font-bold tracking-wide uppercase",
        lg ? "px-3 py-1.5 text-xs" : "px-2.5 py-1 text-[10px]",
        palette,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {text}
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
      t.ttl ?? 3000,
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
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cls(
              "pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur-md",
              t.type === "success" &&
                "border-[#d8e6d8] bg-[#eaf0ea]/90 text-[#3e5c46]",
              t.type === "error" &&
                "border-rose-200 bg-rose-50/90 text-rose-800",
              t.type === "info" && "border-sky-200 bg-sky-50/90 text-sky-800",
            )}
          >
            {t.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : t.type === "error" ? (
              <AlertCircle className="h-5 w-5 shrink-0" />
            ) : (
              <div className="h-2 w-2 rounded-full bg-current shrink-0" />
            )}
            <div className="min-w-0 flex-1 font-medium">{t.m}</div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* --------------------------- auto refresh -------------------------- */
function useAutoRefresh(enabled, cb, deps = []) {
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => cb?.(), 15000);
    return () => clearInterval(id);
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
  const [piCopied, setPiCopied] = useState(false);
  const [auto, setAuto] = useState(true);

  // Refund UI State
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundInput, setRefundInput] = useState("");
  const [isRefunding, setIsRefunding] = useState(false);

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

  useEffect(() => {
    let cancel;
    (async () => {
      cancel = await doFetch();
    })();
    return () => cancel?.();
  }, [id]);

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
    [p],
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
      toast.success("Action completed successfully");
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
    if (!window.confirm("Are you sure you want to cancel this Payment Intent?"))
      return;
    await apiPOST(`/api/admin/payments/${id}/cancel`);
  };

  const handleConfirmRefund = async () => {
    let cents = null;

    // Parse input if they entered a partial amount
    if (refundInput.trim().length > 0) {
      cents = parseAmountToCents(refundInput, currency);

      if (cents == null) {
        return toast.error("Invalid amount entered. Please use numbers.");
      }
      if (cents > netReceived) {
        return toast.error(
          "You cannot refund more than the available net balance.",
        );
      }
      if (cents <= 0) {
        return toast.error("Refund amount must be greater than zero.");
      }
    }

    setIsRefunding(true);
    try {
      await apiPOST(
        `/api/admin/payments/${id}/refund`,
        cents != null ? { amount: cents } : undefined, // If undefined, Stripe does full refund automatically
      );
      setRefundOpen(false);
      setRefundInput("");
    } catch (error) {
      // Error is handled by apiPOST
    } finally {
      setIsRefunding(false);
    }
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
      if (e.key === "r" && canRefund && !refundOpen) {
        e.preventDefault();
        setRefundOpen(true);
      } else if (e.key === "c" && canCapture && !refundOpen) {
        e.preventDefault();
        onCapture();
      } else if (e.key === "Escape" && !refundOpen) {
        router.back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canRefund, canCapture, id, refundOpen]);

  /* loading / auth states */
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
          <AlertCircle className="mx-auto h-12 w-12 text-rose-500 mb-4" />
          <h1 className="text-2xl font-serif text-[#2f261f] mb-2">
            Access Denied
          </h1>
          <p className="text-[#7c6d62] mb-8">
            Please sign in to view this payment.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full rounded-full bg-[#2f261f] px-6 py-3.5 text-sm font-medium text-white hover:bg-[#1a1511] transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f3ee] pb-24 font-sans selection:bg-[#8b6f47]/20">
      <Toasts toasts={toasts} />

      {/* Ambient background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[10%] -left-[5%] w-[40%] h-[40%] rounded-full bg-[#8b6f47]/5 blur-[120px]" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[50%] rounded-full bg-[#e3ddd2]/30 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Top Nav & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="group flex items-center justify-center h-10 w-10 rounded-full border border-[#ded6cb] bg-white/85 hover:bg-white text-[#5a4a3f] transition-all shadow-sm"
              title="Back (Esc)"
            >
              <ArrowLeft
                size={18}
                className="group-hover:-translate-x-0.5 transition-transform"
              />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#a79a8f]">
                  Payment Details
                </span>
                {isPendingish && auto && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />{" "}
                    Auto-sync
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-serif text-[#2f261f] flex items-center gap-2">
                Transaction Record
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={doFetch}
              className="inline-flex items-center gap-2 rounded-full border border-[#e7e0d6] bg-white px-4 py-2.5 text-sm font-medium text-[#4f4137] hover:bg-[#f5f1ea] transition-colors shadow-sm"
            >
              <RefreshCw
                className={cls("h-4 w-4", loading && "animate-spin")}
              />{" "}
              Refresh
            </button>
            {p?.receipt_url && (
              <a
                href={p.receipt_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#1a1a1a] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#333] transition-colors shadow-sm"
              >
                <Receipt className="h-4 w-4" /> View Receipt
              </a>
            )}
          </div>
        </div>

        {loading && !p ? (
          <div className="space-y-6">
            <Skeleton className="h-48 w-full" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
              <div className="space-y-6">
                <Skeleton className="h-56 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            </div>
          </div>
        ) : err && !p ? (
          <div className="rounded-[2rem] border border-rose-200 bg-rose-50/50 p-8 text-center backdrop-blur-sm">
            <AlertCircle className="mx-auto h-10 w-10 text-rose-500 mb-3" />
            <h3 className="text-lg font-medium text-rose-800 mb-1">
              Failed to load payment
            </h3>
            <p className="text-sm text-rose-600 mb-4">{err}</p>
            <button
              onClick={doFetch}
              className="inline-flex items-center gap-2 rounded-full bg-white border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Try Again
            </button>
          </div>
        ) : !p ? (
          <div className="rounded-[2rem] border border-[#e7e0d6] bg-white p-8 text-center text-[#7c6d62]">
            Payment not found.
          </div>
        ) : (
          <>
            {/* Hero / Top Summary Card */}
            <div className="mb-6 rounded-[2rem] border border-[#e1dbd2] bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
              <div className="p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[#f4f1ec]">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <StatusBadge status={displayStatus} lg />
                    <span className="text-xs font-bold text-[#a79a8f] uppercase tracking-wider flex items-center gap-1.5">
                      <CalIcon size={12} /> {dt(p.created)}
                    </span>
                  </div>
                  <div className="text-4xl sm:text-5xl font-serif text-[#2f261f]">
                    {amount}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 md:justify-end">
                  {p.method && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#e7e0d6] bg-[#fcfbf9]">
                      <CreditCard size={16} className="text-[#8b6f47]" />
                      <span className="text-sm font-bold text-[#4f4137] uppercase">
                        {p.method}
                      </span>
                      {p.card_brand && p.card_last4 && (
                        <span className="text-sm text-[#7c6d62] font-mono">
                          • **** {p.card_last4}
                        </span>
                      )}
                    </div>
                  )}
                  {p.id && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#e7e0d6] bg-[#fcfbf9]">
                      <Hash size={16} className="text-[#8b6f47]" />
                      <code className="text-xs font-mono text-[#7c6d62] truncate max-w-[120px] sm:max-w-none">
                        {p.id}
                      </code>
                      <button
                        onClick={() => copy(p.id, setPiCopied)}
                        className="text-[#a79a8f] hover:text-[#8b6f47] transition-colors"
                      >
                        {piCopied ? (
                          <CheckCircle2
                            size={14}
                            className="text-emerald-500"
                          />
                        ) : (
                          <ClipboardCopy size={14} />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-[#f4f1ec] bg-[#fcfbf9]">
                <div className="p-5">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#a79a8f] mb-1">
                    Intended
                  </div>
                  <div className="text-xl font-medium text-[#4f4137]">
                    {toCurrency(p.amount ?? 0, currency)}
                  </div>
                </div>
                <div className="p-5">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#a79a8f] mb-1">
                    Captured
                  </div>
                  <div className="text-xl font-medium text-[#4f4137]">
                    {toCurrency(p.amount_received ?? 0, currency)}
                  </div>
                </div>
                <div className="p-5">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#a79a8f] mb-1">
                    Refunded
                  </div>
                  <div className="text-xl font-medium text-rose-600">
                    {toCurrency(refundsTotal, currency)}
                  </div>
                </div>
                <div className="p-5">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#a79a8f] mb-1">
                    Net Revenue
                  </div>
                  <div className="text-xl font-bold text-emerald-700">
                    {toCurrency(netReceived, currency)}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column (Wider) */}
              <div className="lg:col-span-2 space-y-6">
                {/* Customer Details */}
                <Card title="Customer Information" icon={<User size={16} />}>
                  <KeyRow
                    k="Name"
                    v={
                      p?.customer?.name ||
                      (p?.customer?.email
                        ? p.customer.email.split("@")[0]
                        : "—")
                    }
                    copyable
                  />
                  <KeyRow
                    k="Email Address"
                    v={p?.customer?.email || "—"}
                    copyable
                  />
                  {p?.customer?.id && (
                    <KeyRow
                      k="Stripe Customer ID"
                      v={
                        <code className="font-mono text-xs bg-[#f5f1ea] px-1.5 py-0.5 rounded">
                          {p.customer.id}
                        </code>
                      }
                      copyable={false}
                    />
                  )}
                </Card>

                {/* Refund History */}
                <Card
                  title="Refund History"
                  icon={<RotateCcw size={16} />}
                  extra={
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#a79a8f]">
                      Total: {toCurrency(refundsTotal, currency)}
                    </span>
                  }
                  padded={false}
                >
                  {Array.isArray(p?.refunds) && p.refunds.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-[#fcfbf9] border-b border-[#efe9e1]">
                          <tr className="text-[10px] uppercase tracking-widest text-[#a79a8f]">
                            <th className="px-6 py-3 font-bold">ID</th>
                            <th className="px-6 py-3 font-bold">Amount</th>
                            <th className="px-6 py-3 font-bold">Status</th>
                            <th className="px-6 py-3 font-bold">Date</th>
                            <th className="px-6 py-3 font-bold">Issuer</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f4f1ec]">
                          {p.refunds.map((r) => (
                            <tr
                              key={r.id}
                              className="hover:bg-[#fcfbf9] transition-colors"
                            >
                              <td className="px-6 py-3">
                                <code className="font-mono text-xs text-[#7c6d62]">
                                  {r.id.split("_")[1] || r.id}
                                </code>
                              </td>
                              <td className="px-6 py-3 font-medium text-rose-600">
                                {toCurrency(r.amount, currency)}
                              </td>
                              <td className="px-6 py-3 capitalize text-[#4f4137]">
                                {r.status}
                              </td>
                              <td className="px-6 py-3 text-xs text-[#7c6d62]">
                                {dt(r.created)}
                              </td>
                              <td className="px-6 py-3 text-xs text-[#4f4137]">
                                {r.performed_by_name ||
                                  r.performed_by_email ||
                                  "System"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-sm text-[#a79a8f]">
                      No refunds have been issued for this transaction.
                    </div>
                  )}
                </Card>

                {/* Timeline / Activity */}
                <Card
                  title="Transaction Timeline"
                  icon={<Activity size={16} />}
                >
                  <div className="relative pl-4 border-l-2 border-[#efe9e1] space-y-6 pb-2">
                    {/* Creation */}
                    {p?.created && (
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-[#d3c9bd] border-2 border-white" />
                        <div className="text-sm font-bold text-[#3a2f28]">
                          Payment Intent Created
                        </div>
                        <div className="text-xs font-medium text-[#a79a8f] mt-0.5">
                          {dt(p.created)} • {rel(p.created)}
                        </div>
                      </div>
                    )}

                    {/* Capture */}
                    {p?.amount_received > 0 && (
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-emerald-400 border-2 border-white" />
                        <div className="text-sm font-bold text-[#3a2f28]">
                          Funds Captured{" "}
                          <span className="text-emerald-600 font-medium ml-1">
                            ({toCurrency(p.amount_received, currency)})
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Refunds */}
                    {Array.isArray(p?.refunds) &&
                      p.refunds.map((r) => (
                        <div key={r.id} className="relative">
                          <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-rose-400 border-2 border-white" />
                          <div className="text-sm font-bold text-[#3a2f28]">
                            Refund Issued{" "}
                            <span className="text-rose-600 font-medium ml-1">
                              ({toCurrency(r.amount, currency)})
                            </span>
                          </div>
                          <div className="text-xs font-medium text-[#a79a8f] mt-0.5">
                            {dt(r.created)} • {rel(r.created)}
                            {(r.performed_by_name || r.performed_by_email) &&
                              ` • by ${r.performed_by_name || r.performed_by_email}`}
                          </div>
                        </div>
                      ))}
                  </div>
                </Card>

                {/* JSON Metadata (Hidden by default, clean UI) */}
                {(p?.metadata && Object.keys(p.metadata).length > 0) || raw ? (
                  <Card title="Developer Data" icon={<Code2 size={16} />}>
                    <details className="group">
                      <summary className="flex cursor-pointer select-none items-center gap-2 text-sm font-medium text-[#7c6d62] hover:text-[#8b6f47] transition-colors outline-none">
                        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                        View Raw JSON Payload
                      </summary>
                      <div className="mt-4 p-4 rounded-xl border border-[#efe9e1] bg-[#fcfbf9] overflow-auto max-h-96">
                        <pre className="text-[11px] font-mono leading-relaxed text-[#5a4a3f]">
                          {pretty(raw || p)}
                        </pre>
                      </div>
                    </details>
                  </Card>
                ) : null}
              </div>

              {/* Right Column (Narrower) */}
              <div className="space-y-6">
                {/* Actions Box */}
                <Card
                  title="Management Actions"
                  className="border-[#8b6f47]/30 shadow-[0_8px_30px_rgba(139,111,71,0.08)]"
                >
                  <div className="flex flex-col gap-3">
                    <button
                      disabled={!canCapture}
                      onClick={onCapture}
                      className={cls(
                        "flex items-center justify-between w-full p-3 rounded-xl border transition-all shadow-sm text-sm font-bold uppercase tracking-wider",
                        canCapture
                          ? "border-[#e7e0d6] bg-[#1a1a1a] text-white hover:bg-[#333]"
                          : "border-[#f4f1ec] bg-[#fcfbf9] text-[#d3c9bd] cursor-not-allowed shadow-none",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Wallet size={16} /> Capture Funds
                      </span>
                      {canCapture && (
                        <kbd className="hidden sm:inline-block font-sans text-[10px] bg-white/20 px-1.5 rounded">
                          C
                        </kbd>
                      )}
                    </button>

                    <button
                      disabled={!canRefund}
                      onClick={() => setRefundOpen(true)}
                      className={cls(
                        "flex items-center justify-between w-full p-3 rounded-xl border transition-all shadow-sm text-sm font-bold uppercase tracking-wider",
                        canRefund
                          ? "border-[#e7e0d6] bg-white text-[#4f4137] hover:border-[#8b6f47] hover:text-[#8b6f47]"
                          : "border-[#f4f1ec] bg-[#fcfbf9] text-[#d3c9bd] cursor-not-allowed shadow-none",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <RotateCcw size={16} /> Issue Refund
                      </span>
                      {canRefund && (
                        <kbd className="hidden sm:inline-block font-sans text-[10px] bg-[#f5f1ea] px-1.5 rounded text-[#a79a8f]">
                          R
                        </kbd>
                      )}
                    </button>

                    <button
                      disabled={!canCancel}
                      onClick={onCancel}
                      className={cls(
                        "flex items-center justify-between w-full p-3 rounded-xl border transition-all shadow-sm text-sm font-bold uppercase tracking-wider",
                        canCancel
                          ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                          : "border-[#f4f1ec] bg-[#fcfbf9] text-[#d3c9bd] cursor-not-allowed shadow-none",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <X size={16} /> Cancel Payment
                      </span>
                    </button>
                  </div>

                  <div className="mt-4 pt-4 border-t border-[#f4f1ec]">
                    <button
                      onClick={onResendReceipt}
                      className="flex items-center justify-center w-full gap-2 p-2.5 rounded-xl border border-[#e7e0d6] bg-[#fcfbf9] text-[#7c6d62] hover:bg-white hover:text-[#4f4137] transition-colors text-xs font-semibold"
                    >
                      <Send size={14} /> Resend Receipt Email
                    </button>
                  </div>
                </Card>

                {/* System Links */}
                <Card title="Linked Records" icon={<ExternalLink size={16} />}>
                  <div className="flex flex-col gap-2">
                    {/* Internal Booking Link */}
                    <div className="p-3 rounded-xl border border-[#e7e0d6] bg-[#fcfbf9]">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#a79a8f] mb-1">
                        Oasis Booking
                      </div>
                      {p?.booking_id ? (
                        <Link
                          href={`/admin/bookings/${p.booking_id}`}
                          className="flex items-center justify-between text-sm font-semibold text-[#4f4137] hover:text-[#8b6f47] transition-colors"
                        >
                          Booking #{p.booking_id}
                          <ArrowLeft size={14} className="rotate-135" />
                        </Link>
                      ) : (
                        <span className="text-sm text-[#a79a8f] italic">
                          Not linked to a booking
                        </span>
                      )}
                    </div>

                    {/* Stripe Links */}
                    {p?.links?.dashboard_payment && (
                      <a
                        href={p.links.dashboard_payment}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-3 rounded-xl border border-[#e7e0d6] bg-white text-sm font-medium text-[#4f4137] hover:border-[#8b6f47] hover:text-[#8b6f47] transition-all group"
                      >
                        <span className="flex items-center gap-2">
                          <CreditCard
                            size={14}
                            className="text-[#a79a8f] group-hover:text-[#8b6f47]"
                          />{" "}
                          Stripe Payment
                        </span>
                        <ExternalLink
                          size={14}
                          className="text-[#d3c9bd] group-hover:text-[#8b6f47]"
                        />
                      </a>
                    )}

                    {p?.links?.dashboard_pi && (
                      <a
                        href={p.links.dashboard_pi}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-3 rounded-xl border border-[#e7e0d6] bg-white text-sm font-medium text-[#4f4137] hover:border-[#8b6f47] hover:text-[#8b6f47] transition-all group"
                      >
                        <span className="flex items-center gap-2">
                          <Hash
                            size={14}
                            className="text-[#a79a8f] group-hover:text-[#8b6f47]"
                          />{" "}
                          Stripe Intent
                        </span>
                        <ExternalLink
                          size={14}
                          className="text-[#d3c9bd] group-hover:text-[#8b6f47]"
                        />
                      </a>
                    )}
                  </div>
                </Card>

                {/* Security Badge */}
                <div className="flex items-start gap-3 p-4 rounded-2xl border border-emerald-100 bg-emerald-50/50">
                  <ShieldCheck
                    size={18}
                    className="text-emerald-600 shrink-0 mt-0.5"
                  />
                  <p className="text-xs font-medium text-emerald-800 leading-relaxed">
                    This transaction was processed securely via Stripe.
                    Sensitive card data is tokenized and never touches your
                    servers.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* --- Refund Modal --- */}
      <AnimatePresence>
        {refundOpen && (
          <div className="fixed inset-0 z-[100] grid place-items-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isRefunding && setRefundOpen(false)}
              className="absolute inset-0 bg-[#1a1a1a]/40 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-[#efe9e1] flex items-center justify-between bg-[#fcfbf9]">
                <h3 className="text-lg font-serif text-[#2f261f] flex items-center gap-2">
                  <AlertTriangle className="text-amber-500" size={20} />
                  Issue Refund
                </h3>
                <button
                  onClick={() => setRefundOpen(false)}
                  disabled={isRefunding}
                  className="p-2 rounded-full hover:bg-[#e7e0d6] text-[#7c6d62] transition-colors disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Available Balance */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-[#fcfbf9] border border-[#e7e0d6]">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-[#a79a8f] mb-1">
                      Available to refund
                    </div>
                    <div className="text-xl font-bold text-[#4f4137]">
                      {toCurrency(netReceived, currency)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setRefundInput((netReceived / 100).toFixed(2))
                    }
                    className="px-3 py-1.5 rounded-xl border border-[#d3c9bd] bg-white text-xs font-bold text-[#5a4a3f] hover:bg-[#f5f1ea] transition-colors shadow-sm"
                  >
                    Full Amount
                  </button>
                </div>

                {/* Input Field */}
                <div>
                  <label className="block text-xs font-bold text-[#7c6d62] mb-2 ml-1">
                    Refund Amount
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a79a8f] font-medium">
                      {currency === "EUR"
                        ? "€"
                        : currency === "USD"
                          ? "$"
                          : currency === "GBP"
                            ? "£"
                            : ""}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={(netReceived / 100).toFixed(2)}
                      placeholder="0.00"
                      value={refundInput}
                      onChange={(e) => setRefundInput(e.target.value)}
                      disabled={isRefunding}
                      className="w-full rounded-2xl border border-[#e7e0d6] bg-white pl-8 pr-4 py-3 text-lg font-medium text-[#2f261f] placeholder:text-[#d3c9bd] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30 focus:border-[#8b6f47] transition-all disabled:opacity-50"
                    />
                  </div>
                  <p className="text-[11px] text-[#a79a8f] mt-2 ml-1">
                    Leave empty to refund the full available amount.
                  </p>
                </div>

                <p className="text-xs text-[#7c6d62] leading-relaxed bg-amber-50 border border-amber-100 p-3 rounded-xl">
                  <strong>Note:</strong> Refunds cannot be undone. It may take
                  5-10 business days for the funds to appear on the customer's
                  bank statement.
                </p>
              </div>

              <div className="px-6 py-4 bg-[#fcfbf9] border-t border-[#efe9e1] flex items-center justify-end gap-3">
                <button
                  onClick={() => setRefundOpen(false)}
                  disabled={isRefunding}
                  className="px-5 py-2.5 rounded-full text-sm font-bold text-[#7c6d62] hover:bg-[#e7e0d6] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmRefund}
                  disabled={isRefunding}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#1a1a1a] text-white text-sm font-bold uppercase tracking-wider hover:bg-[#333] transition-colors disabled:opacity-70 shadow-sm"
                >
                  {isRefunding ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RotateCcw size={16} />
                  )}
                  Confirm Refund
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
