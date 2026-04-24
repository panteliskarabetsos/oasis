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
  X,
  RotateCcw,
  Send,
  Wallet,
  User,
  Hash,
  Activity,
  Code2,
  AlertTriangle,
  Lock,
  Banknote,
  FileText,
} from "lucide-react";

const ATHENS_TZ = "Europe/Athens";

const cls = (...xs) => xs.filter(Boolean).join(" ");
const up = (s) => (s ? String(s).toUpperCase() : s);
const pretty = (x) => JSON.stringify(x, null, 2);

const todayISO = () => {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().split("T")[0];
};

const unixToLocalISODate = (unixSeconds) => {
  const d = new Date(unixSeconds * 1000);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().split("T")[0];
};

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
    await navigator.clipboard.writeText(String(text));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  } catch {}
}

function parseAmountToCents(input) {
  if (!input) return null;
  const cleaned = String(input)
    .replace(/[^0-9.,-]/g, "")
    .replace(",", ".");
  const val = Number.parseFloat(cleaned);
  if (!Number.isFinite(val) || val <= 0) return null;
  return Math.round(val * 100);
}

function Card({ title, icon, extra, children, padded = true, className = "" }) {
  return (
    <div
      className={cls(
        "rounded-[2rem] border border-black/5 bg-white/70 backdrop-blur-xl shadow-sm dark:border-white/10 dark:bg-[#121212]/80 overflow-hidden",
        className,
      )}
    >
      {(title || extra) && (
        <div className="flex items-center justify-between border-b border-black/5 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02] px-6 py-4">
          <div className="flex items-center gap-2">
            {icon && <div className="text-[#a3845b]">{icon}</div>}
            <h3 className="text-xs font-bold uppercase tracking-widest text-black/50 dark:text-white/50">
              {title}
            </h3>
          </div>
          {extra && <div>{extra}</div>}
        </div>
      )}
      <div className={cls(padded ? "p-6 sm:p-8" : "")}>{children}</div>
    </div>
  );
}

function KeyRow({ k, v, copyable = false, copyValue }) {
  const [copied, setCopied] = useState(false);

  const displayValue = v || "—";
  const rawCopy = copyValue || (typeof v === "string" ? v : "");

  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between py-3 border-b border-black/5 dark:border-white/5 last:border-0 gap-1 sm:gap-4">
      <div className="sm:w-1/3 text-xs font-bold uppercase tracking-wider text-black/50 dark:text-white/50 pt-0.5">
        {k}
      </div>
      <div className="sm:w-2/3 text-sm text-black/90 dark:text-white/90 font-medium flex items-center sm:justify-end gap-2 min-w-0">
        <span className="truncate">{displayValue}</span>
        {copyable && rawCopy && rawCopy !== "—" && (
          <button
            onClick={() => copy(rawCopy, setCopied)}
            className="text-black/40 hover:text-[#a3845b] dark:text-white/40 dark:hover:text-[#a3845b] transition-colors shrink-0"
            title="Copy"
          >
            {copied ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <ClipboardCopy className="h-4 w-4" />
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
      className={cls(
        "animate-pulse rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10",
        className,
      )}
    />
  );
}

function StatusBadge({ status, lg = false }) {
  const map = {
    succeeded: [
      "Succeeded",
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400",
    ],
    processing: [
      "Processing",
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400",
    ],
    requires_action: [
      "Requires action",
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400",
    ],
    requires_payment_method: [
      "Requires payment method",
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400",
    ],
    requires_confirmation: [
      "Requires confirmation",
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400",
    ],
    requires_capture: [
      "Requires capture",
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400",
    ],
    canceled: [
      "Canceled",
      "bg-black/5 text-black/60 border-black/10 dark:bg-white/5 dark:text-white/60 dark:border-white/10",
    ],
    refunded: [
      "Refunded",
      "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:border-sky-500/20 dark:text-sky-400",
    ],
    partially_refunded: [
      "Partially refunded",
      "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:border-sky-500/20 dark:text-sky-400",
    ],
    failed: [
      "Failed",
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400",
    ],
  };

  const [text, palette] = map[status || ""] || [
    String(status || "Unknown").replace(/_/g, " "),
    "bg-black/5 text-black/60 border-black/10 dark:bg-white/5 dark:text-white/60 dark:border-white/10",
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

  return [
    toasts,
    {
      success: (m) => push({ type: "success", m }),
      error: (m) => push({ type: "error", m, ttl: 5000 }),
      info: (m) => push({ type: "info", m }),
    },
  ];
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
                "border-emerald-200 bg-emerald-50/90 text-emerald-800 dark:bg-emerald-900/80 dark:border-emerald-800 dark:text-emerald-100",
              t.type === "error" &&
                "border-rose-200 bg-rose-50/90 text-rose-800 dark:bg-rose-900/80 dark:border-rose-800 dark:text-rose-100",
              t.type === "info" &&
                "border-sky-200 bg-sky-50/90 text-sky-800 dark:bg-sky-900/80 dark:border-sky-800 dark:text-sky-100",
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

function useAutoRefresh(enabled, cb, deps = []) {
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => cb?.(), 15000);
    return () => clearInterval(id);
  }, [enabled, ...deps]);
}

export default function PaymentDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [toasts, toast] = useToasts();

  const [auth, setAuth] = useState({ loading: true, ok: true });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [err, setErr] = useState("");
  const [p, setP] = useState(null);
  const [raw, setRaw] = useState(null);
  const [piCopied, setPiCopied] = useState(false);
  const [auto, setAuto] = useState(true);

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundInput, setRefundInput] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [isRefunding, setIsRefunding] = useState(false);

  const [financeLock, setFinanceLock] = useState({
    loading: false,
    todayLocked: false,
    paymentDayLocked: false,
    todayDate: "",
    paymentDate: "",
  });

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

  const fetchFinanceLockStatus = async (payment) => {
    if (!payment?.created) return;

    const todayDate = todayISO();
    const paymentDate = unixToLocalISODate(payment.created);

    setFinanceLock((x) => ({ ...x, loading: true, todayDate, paymentDate }));

    try {
      const [todayRes, paymentDayRes] = await Promise.all([
        fetch(`/api/admin/reports/daily?date=${todayDate}`, {
          cache: "no-store",
        }),
        fetch(`/api/admin/reports/daily?date=${paymentDate}`, {
          cache: "no-store",
        }),
      ]);

      const todayJson = await todayRes.json().catch(() => ({}));
      const paymentJson = await paymentDayRes.json().catch(() => ({}));

      setFinanceLock({
        loading: false,
        todayLocked: todayJson?.locked === true,
        paymentDayLocked: paymentJson?.locked === true,
        todayDate,
        paymentDate,
      });
    } catch {
      setFinanceLock({
        loading: false,
        todayLocked: false,
        paymentDayLocked: false,
        todayDate,
        paymentDate,
      });
    }
  };

  const doFetch = async () => {
    if (!id) return;

    setLoading(true);
    setErr("");

    try {
      const r = await fetch(`/api/admin/payments/${id}`, {
        cache: "no-store",
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) throw new Error(data?.error || `Failed (${r.status})`);

      setRaw(data);
      setP(data.item || null);

      if (data.item) {
        fetchFinanceLockStatus(data.item);
      }
    } catch (e) {
      setErr(e?.message || "Failed to load payment");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    doFetch();
  }, [id]);

  const isPendingish = useMemo(() => {
    if (!p) return false;

    return [
      "processing",
      "requires_action",
      "requires_payment_method",
      "requires_confirmation",
      "requires_capture",
    ].includes(p.status);
  }, [p]);

  useAutoRefresh(auto && isPendingish, doFetch, [id, isPendingish]);

  const currency = up(p?.currency || "eur");
  const amount = toCurrency(p?.amount_received ?? p?.amount ?? 0, currency);

  const refundsTotal = useMemo(() => {
    if (!Array.isArray(p?.refunds)) return 0;
    return p.refunds.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  }, [p]);

  const displayStatus = useMemo(() => {
    if (!p) return "";
    const received = Number(p.amount_received) || 0;

    if (received > 0 && refundsTotal >= received) return "refunded";
    if (refundsTotal > 0 && refundsTotal < received)
      return "partially_refunded";

    return p.status;
  }, [p, refundsTotal]);

  const netReceived = Math.max(
    (Number(p?.amount_received) || 0) - refundsTotal,
    0,
  );

  const paymentDate = p?.created ? unixToLocalISODate(p.created) : "";
  const paymentBelongsToClosedZ = financeLock.paymentDayLocked;
  const todayClosed = financeLock.todayLocked;

  const ensureTodayOpen = (actionName) => {
    if (todayClosed) {
      toast.error(`Cannot ${actionName}. Today's Z-Report is already locked.`);
      return false;
    }

    return true;
  };

  async function apiPOST(
    path,
    body,
    successMessage = "Action completed successfully",
  ) {
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        throw new Error(data?.error || `Request failed (${r.status})`);
      }

      toast.success(successMessage);
      await doFetch();
      return data;
    } catch (e) {
      toast.error(e.message || "Something went wrong");
      throw e;
    }
  }

  const onCapture = async () => {
    if (!ensureTodayOpen("capture funds")) return;

    setActionLoading("capture");
    try {
      await apiPOST(
        `/api/admin/payments/${id}/capture`,
        undefined,
        "Funds captured successfully",
      );
    } finally {
      setActionLoading("");
    }
  };

  const onCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel this Payment Intent?"))
      return;

    setActionLoading("cancel");
    try {
      await apiPOST(
        `/api/admin/payments/${id}/cancel`,
        undefined,
        "Payment canceled successfully",
      );
    } finally {
      setActionLoading("");
    }
  };

  const handleConfirmRefund = async () => {
    if (!ensureTodayOpen("issue a refund")) return;

    let cents = null;

    if (refundInput.trim().length > 0) {
      cents = parseAmountToCents(refundInput);

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

    const refundAmountLabel =
      cents == null
        ? toCurrency(netReceived, currency)
        : toCurrency(cents, currency);

    if (
      !window.confirm(
        `Issue refund for ${refundAmountLabel}? Refunds cannot be undone.`,
      )
    ) {
      return;
    }

    setIsRefunding(true);

    try {
      const body = {};
      if (cents != null) body.amount = cents;
      if (refundReason.trim()) body.reason = refundReason.trim();

      await apiPOST(
        `/api/admin/payments/${id}/refund`,
        Object.keys(body).length ? body : undefined,
        "Refund issued successfully",
      );

      setRefundOpen(false);
      setRefundInput("");
      setRefundReason("");
    } finally {
      setIsRefunding(false);
    }
  };

  const onResendReceipt = async () => {
    setActionLoading("receipt");
    try {
      await apiPOST(
        `/api/admin/payments/${id}/resend-receipt`,
        undefined,
        "Receipt resent successfully",
      );
    } finally {
      setActionLoading("");
    }
  };

  const canCapture =
    p?.status === "requires_capture" && !todayClosed && actionLoading === "";

  const canCancel =
    [
      "requires_payment_method",
      "requires_confirmation",
      "requires_action",
      "processing",
    ].includes(p?.status) && actionLoading === "";

  const canRefund =
    (Number(p?.amount_received) || 0) > 0 &&
    netReceived > 0 &&
    !todayClosed &&
    actionLoading === "";

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey) return;

      if (e.key === "r" && canRefund && !refundOpen) {
        e.preventDefault();
        setRefundOpen(true);
      } else if (e.key === "c" && canCapture && !refundOpen) {
        e.preventDefault();
        onCapture();
      } else if (e.key === "Escape" && refundOpen) {
        setRefundOpen(false);
      } else if (e.key === "Escape" && !refundOpen) {
        router.back();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canRefund, canCapture, refundOpen, router]);

  if (auth.loading) {
    return (
      <div className="min-h-screen bg-[#f4f1ec] dark:bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#a3845b]" />
      </div>
    );
  }

  if (!auth.ok) {
    return (
      <div className="min-h-screen bg-[#f4f1ec] dark:bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#121212] rounded-[2rem] border border-black/10 dark:border-white/10 p-8 text-center shadow-xl">
          <AlertCircle className="mx-auto h-12 w-12 text-rose-500 mb-4" />
          <h1 className="text-2xl font-serif text-black/90 dark:text-white/90 mb-2">
            Access Denied
          </h1>
          <p className="text-black/60 dark:text-white/60 mb-8">
            Please sign in to view this payment.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full rounded-full bg-[#a3845b] px-6 py-3.5 text-sm font-medium text-white hover:bg-[#b79266] transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6f3ee,transparent_30%),radial-gradient(800px_400px_at_10%_-20%,#f0eadf,transparent),radial-gradient(600px_300px_at_90%_-10%,#efe7da,transparent)] text-[#2f2f2f] transition-colors duration-500 dark:bg-[#0a0a0a] dark:text-[#e9e4da] pb-24 selection:bg-[#8b6f47]/20">
      <Toasts toasts={toasts} />

      <div className="sticky top-0 z-30 border-b border-black/5 bg-white/70 backdrop-blur-md dark:border-white/10 dark:bg-[#0a0a0a]/80 shadow-sm print:hidden">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="group flex items-center justify-center h-10 w-10 rounded-full border border-black/10 bg-white/80 dark:bg-white/10 dark:border-white/10 hover:bg-white dark:hover:bg-white/20 text-black/70 dark:text-white/70 transition-all shadow-sm"
            >
              <ArrowLeft
                size={18}
                className="group-hover:-translate-x-0.5 transition-transform"
              />
            </button>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-black/50 dark:text-white/50">
                  Payment Record
                </span>

                {isPendingish && auto && (
                  <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Auto-sync
                  </span>
                )}

                {todayClosed && (
                  <span className="flex items-center gap-1 text-[9px] font-bold text-rose-700 bg-rose-50 dark:bg-rose-900/30 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                    <Lock size={10} />
                    Today Locked
                  </span>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl font-serif text-black/90 dark:text-white/90">
                Transaction Details
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setAuto((x) => !x)}
              className={cls(
                "hidden sm:inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors shadow-sm",
                auto
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
                  : "border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/5 text-black/70 dark:text-white/70",
              )}
            >
              Auto {auto ? "On" : "Off"}
            </button>

            <button
              onClick={doFetch}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-2 text-sm font-medium text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10 transition-colors shadow-sm disabled:opacity-60"
            >
              <RefreshCw
                className={cls("h-4 w-4", loading && "animate-spin")}
              />
              Refresh
            </button>

            {p?.receipt_url && (
              <a
                href={p.receipt_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#2f2f2f] dark:bg-white px-5 py-2 text-sm font-medium text-white dark:text-black hover:bg-black dark:hover:bg-white/90 transition-colors shadow-md"
              >
                <Receipt className="h-4 w-4" />
                View Receipt
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12">
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
              </div>
            </div>
          </div>
        ) : err && !p ? (
          <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-8 text-center dark:bg-rose-900/10 dark:border-rose-900/30">
            <AlertCircle className="mx-auto h-10 w-10 text-rose-500 mb-3" />
            <h3 className="text-lg font-medium text-rose-800 dark:text-rose-200 mb-1">
              Failed to load payment
            </h3>
            <p className="text-sm text-rose-600 dark:text-rose-400 mb-4">
              {err}
            </p>
            <button
              onClick={doFetch}
              className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-[#121212] border border-rose-200 dark:border-rose-800 px-5 py-2 text-sm font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-50 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        ) : !p ? (
          <div className="rounded-[2rem] border border-black/5 bg-white/70 p-12 text-center text-black/50 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
            Payment not found.
          </div>
        ) : (
          <>
            <div className="mb-6 rounded-[2rem] border border-black/5 bg-white/80 backdrop-blur-xl shadow-sm dark:border-white/10 dark:bg-[#121212]/80 overflow-hidden">
              <div className="p-6 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-black/5 dark:border-white/5">
                <div>
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <StatusBadge status={displayStatus} lg />
                    <span className="text-xs font-bold text-black/40 dark:text-white/40 uppercase tracking-wider flex items-center gap-1.5">
                      <CalIcon size={14} />
                      {dt(p.created)}
                    </span>
                  </div>

                  <div className="text-5xl sm:text-6xl font-serif text-black/90 dark:text-white/90 tracking-tight">
                    {amount}
                  </div>

                  <p className="mt-3 text-xs font-medium text-black/45 dark:text-white/45">
                    Financial day:{" "}
                    <span className="font-bold text-black/70 dark:text-white/70">
                      {paymentDate || "—"}
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 md:justify-end">
                  {p.method && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/5">
                      <CreditCard size={18} className="text-[#a3845b]" />
                      <span className="text-sm font-bold text-black/80 dark:text-white/80 uppercase tracking-wide">
                        {p.method}
                      </span>
                      {p.card_brand && p.card_last4 && (
                        <span className="text-sm text-black/50 dark:text-white/50 font-mono ml-1">
                          • **** {p.card_last4}
                        </span>
                      )}
                    </div>
                  )}

                  {p.id && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/5">
                      <Hash size={18} className="text-[#a3845b]" />
                      <code className="text-sm font-mono text-black/60 dark:text-white/60 truncate max-w-[120px] sm:max-w-none">
                        {p.id}
                      </code>
                      <button
                        onClick={() => copy(p.id, setPiCopied)}
                        className="text-black/40 hover:text-[#a3845b] transition-colors ml-1"
                      >
                        {piCopied ? (
                          <CheckCircle2
                            size={16}
                            className="text-emerald-500"
                          />
                        ) : (
                          <ClipboardCopy size={16} />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-black/5 dark:divide-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
                <AmountTile
                  label="Intended Amount"
                  value={toCurrency(p.amount ?? 0, currency)}
                />
                <AmountTile
                  label="Captured Amount"
                  value={toCurrency(p.amount_received ?? 0, currency)}
                />
                <AmountTile
                  label="Refunded"
                  value={toCurrency(refundsTotal, currency)}
                  danger
                />
                <AmountTile
                  label="Net Revenue"
                  value={toCurrency(netReceived, currency)}
                  success
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
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
                    copyValue={p?.customer?.name || ""}
                  />
                  <KeyRow
                    k="Email Address"
                    v={p?.customer?.email || "—"}
                    copyable
                    copyValue={p?.customer?.email || ""}
                  />
                  <KeyRow k="Payment Method" v={p?.method || "—"} />
                  <KeyRow
                    k="Stripe Customer ID"
                    v={p?.customer?.id || "—"}
                    copyable
                    copyValue={p?.customer?.id || ""}
                  />
                </Card>

                <Card
                  title="Refund History"
                  icon={<RotateCcw size={16} />}
                  extra={
                    <span className="text-[10px] font-bold uppercase tracking-widest text-black/50 dark:text-white/50">
                      Total: {toCurrency(refundsTotal, currency)}
                    </span>
                  }
                  padded={false}
                >
                  {Array.isArray(p?.refunds) && p.refunds.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5">
                          <tr className="text-[10px] uppercase tracking-widest text-black/50 dark:text-white/50">
                            <th className="px-6 py-4 font-bold">ID</th>
                            <th className="px-6 py-4 font-bold">Amount</th>
                            <th className="px-6 py-4 font-bold">Status</th>
                            <th className="px-6 py-4 font-bold">Date</th>
                            <th className="px-6 py-4 font-bold">Issuer</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5 dark:divide-white/5">
                          {p.refunds.map((r) => (
                            <tr
                              key={r.id}
                              className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                            >
                              <td className="px-6 py-4">
                                <code className="font-mono text-xs text-black/60 dark:text-white/60">
                                  {String(r.id || "").split("_")[1] || r.id}
                                </code>
                              </td>
                              <td className="px-6 py-4 font-medium text-rose-600 dark:text-rose-400">
                                {toCurrency(r.amount, currency)}
                              </td>
                              <td className="px-6 py-4 capitalize text-black/80 dark:text-white/80">
                                {r.status || "—"}
                              </td>
                              <td className="px-6 py-4 text-xs text-black/60 dark:text-white/60">
                                {r.created ? dt(r.created) : "—"}
                              </td>
                              <td className="px-6 py-4 text-xs text-black/80 dark:text-white/80">
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
                    <div className="p-8 text-center text-sm text-black/40 dark:text-white/40">
                      No refunds have been issued for this transaction.
                    </div>
                  )}
                </Card>

                <Card
                  title="Transaction Timeline"
                  icon={<Activity size={16} />}
                >
                  <div className="relative pl-6 border-l-2 border-black/10 dark:border-white/10 space-y-8 pb-2 ml-2">
                    {p?.created && (
                      <TimelineItem
                        color="bg-[#a3845b]"
                        title="Payment Intent Created"
                        subtitle={`${dt(p.created)} • ${rel(p.created)}`}
                      />
                    )}

                    {p?.amount_received > 0 && (
                      <TimelineItem
                        color="bg-emerald-500"
                        title={
                          <>
                            Funds Captured{" "}
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium ml-1">
                              ({toCurrency(p.amount_received, currency)})
                            </span>
                          </>
                        }
                      />
                    )}

                    {Array.isArray(p?.refunds) &&
                      p.refunds.map((r) => (
                        <TimelineItem
                          key={r.id}
                          color="bg-rose-500"
                          title={
                            <>
                              Refund Issued{" "}
                              <span className="text-rose-600 dark:text-rose-400 font-medium ml-1">
                                ({toCurrency(r.amount, currency)})
                              </span>
                            </>
                          }
                          subtitle={`${r.created ? dt(r.created) : "—"}${
                            r.created ? ` • ${rel(r.created)}` : ""
                          }${
                            r.performed_by_name || r.performed_by_email
                              ? ` • by ${r.performed_by_name || r.performed_by_email}`
                              : ""
                          }`}
                        />
                      ))}
                  </div>
                </Card>

                {(p?.metadata && Object.keys(p.metadata).length > 0) || raw ? (
                  <Card title="Developer Data" icon={<Code2 size={16} />}>
                    <details className="group">
                      <summary className="flex cursor-pointer select-none items-center gap-2 text-sm font-bold uppercase tracking-wider text-black/50 dark:text-white/50 hover:text-[#a3845b] transition-colors outline-none">
                        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                        View Raw JSON Payload
                      </summary>
                      <div className="mt-4 p-4 rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5 overflow-auto max-h-96 scrollbar-thin">
                        <pre className="text-[11px] font-mono leading-relaxed text-black/70 dark:text-white/70">
                          {pretty(raw || p)}
                        </pre>
                      </div>
                    </details>
                  </Card>
                ) : null}
              </div>

              <div className="space-y-6">
                {todayClosed && (
                  <FinanceWarning
                    tone="danger"
                    icon={<Lock size={20} />}
                    title="Finance Day Locked"
                    text="Today's Z-Report is already locked. Refunds and captures are disabled because they would affect today's financial closure."
                  />
                )}

                {paymentBelongsToClosedZ && (
                  <FinanceWarning
                    tone="success"
                    icon={<ShieldCheck size={20} />}
                    title="Original Payment Day Closed"
                    text={`This payment belongs to the Z-Report of ${financeLock.paymentDate}. Refunds issued now belong to today's Z-Report, not the original payment day.`}
                  />
                )}

                <Card
                  title="Management Actions"
                  className="border-[#a3845b]/30 shadow-[0_8px_30px_rgba(163,132,91,0.1)] dark:shadow-none"
                >
                  <div className="flex flex-col gap-3">
                    <ActionButton
                      disabled={!canCapture}
                      loading={actionLoading === "capture"}
                      onClick={onCapture}
                      icon={<Wallet size={16} />}
                      label="Capture Funds"
                      shortcut="C"
                      primary
                    />

                    <ActionButton
                      disabled={!canRefund}
                      onClick={() => setRefundOpen(true)}
                      icon={<RotateCcw size={16} />}
                      label="Issue Refund"
                      shortcut="R"
                    />

                    <ActionButton
                      disabled={!canCancel}
                      loading={actionLoading === "cancel"}
                      onClick={onCancel}
                      icon={<X size={16} />}
                      label="Cancel Payment"
                      danger
                    />
                  </div>

                  <div className="mt-6 pt-6 border-t border-black/5 dark:border-white/10">
                    <button
                      onClick={onResendReceipt}
                      disabled={actionLoading === "receipt"}
                      className="flex items-center justify-center w-full gap-2 p-3 rounded-xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-[#1a1a1a] text-black/60 dark:text-white/60 hover:bg-white dark:hover:bg-[#222] hover:text-black dark:hover:text-white transition-colors text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                    >
                      {actionLoading === "receipt" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      Resend Receipt
                    </button>
                  </div>
                </Card>

                <Card
                  title="Financial Classification"
                  icon={<Banknote size={16} />}
                >
                  <KeyRow k="Payment Z-Report Date" v={paymentDate || "—"} />
                  <KeyRow
                    k="Payment Day Status"
                    v={paymentBelongsToClosedZ ? "Closed / Locked" : "Open"}
                  />
                  <KeyRow
                    k="Today Status"
                    v={todayClosed ? "Closed / Locked" : "Open"}
                  />
                  <KeyRow
                    k="Refund Accounting Rule"
                    v="Refunds count on the day they are processed"
                  />
                </Card>

                <Card title="Linked Records" icon={<ExternalLink size={16} />}>
                  <div className="flex flex-col gap-3">
                    <div className="p-4 rounded-xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-[#1a1a1a]">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-black/50 dark:text-white/50 mb-1.5">
                        Oasis Booking
                      </div>
                      {p?.booking_id ? (
                        <Link
                          href={`/admin/bookings/${p.booking_id}`}
                          className="flex items-center justify-between text-sm font-bold text-black/80 dark:text-white/80 hover:text-[#a3845b] dark:hover:text-[#a3845b] transition-colors"
                        >
                          Booking #{p.booking_id}
                          <ExternalLink size={14} />
                        </Link>
                      ) : (
                        <span className="text-sm text-black/40 dark:text-white/40 italic">
                          Not linked to a booking
                        </span>
                      )}
                    </div>

                    {p?.links?.dashboard_payment && (
                      <ExternalCard
                        href={p.links.dashboard_payment}
                        icon={<CreditCard size={16} />}
                        label="Stripe Payment"
                      />
                    )}

                    {p?.links?.dashboard_pi && (
                      <ExternalCard
                        href={p.links.dashboard_pi}
                        icon={<Hash size={16} />}
                        label="Stripe Intent"
                      />
                    )}
                  </div>
                </Card>

                <div className="flex items-start gap-3 p-5 rounded-2xl border border-emerald-200/50 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-800/30">
                  <ShieldCheck
                    size={20}
                    className="text-emerald-600 dark:text-emerald-500 shrink-0 mt-0.5"
                  />
                  <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200/70 leading-relaxed">
                    Sensitive card data is tokenized by Stripe and never touches
                    your servers.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {refundOpen && (
          <div className="fixed inset-0 z-[100] grid place-items-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isRefunding && setRefundOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white dark:bg-[#1a1a1a] rounded-[2rem] shadow-2xl overflow-hidden border border-black/5 dark:border-white/10"
            >
              <div className="px-6 py-5 border-b border-black/5 dark:border-white/10 flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02]">
                <h3 className="text-lg font-serif text-black/90 dark:text-white/90 flex items-center gap-2">
                  <AlertTriangle className="text-amber-500" size={20} />
                  Issue Refund
                </h3>
                <button
                  onClick={() => setRefundOpen(false)}
                  disabled={isRefunding}
                  className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-black/50 dark:text-white/50 transition-colors disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {todayClosed && (
                  <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-medium">
                    Today's Z-Report is locked. Refunds are disabled.
                  </div>
                )}

                <div className="flex items-center justify-between p-5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/10">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-black/50 dark:text-white/50 mb-1">
                      Available to refund
                    </div>
                    <div className="text-2xl font-serif text-black/90 dark:text-white/90">
                      {toCurrency(netReceived, currency)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setRefundInput((netReceived / 100).toFixed(2))
                    }
                    disabled={isRefunding || todayClosed}
                    className="px-4 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#121212] text-xs font-bold text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5 transition-colors shadow-sm disabled:opacity-50"
                  >
                    Full Amount
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-black/60 dark:text-white/60 mb-2 ml-1">
                    Refund Amount
                  </label>
                  <div className="relative">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40 font-medium text-lg">
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
                      disabled={isRefunding || todayClosed}
                      className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#121212] pl-10 pr-5 py-4 text-xl font-medium text-black/90 dark:text-white/90 placeholder:text-black/30 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#a3845b]/30 focus:border-[#a3845b] transition-all disabled:opacity-50"
                    />
                  </div>
                  <p className="text-[11px] text-black/50 dark:text-white/50 mt-2 ml-1">
                    Leave empty to refund the full available amount.
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-black/60 dark:text-white/60 mb-2 ml-1">
                    <FileText size={13} />
                    Internal Refund Note
                  </label>
                  <textarea
                    rows={3}
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    disabled={isRefunding || todayClosed}
                    placeholder="Optional internal note..."
                    className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#121212] px-4 py-3 text-sm text-black/90 dark:text-white/90 placeholder:text-black/30 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#a3845b]/30 focus:border-[#a3845b] transition-all disabled:opacity-50 resize-none"
                  />
                </div>

                <p className="text-xs text-amber-800 dark:text-amber-200/70 leading-relaxed bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 p-4 rounded-xl">
                  <strong>Accounting rule:</strong> this refund will affect
                  today's Z-Report, not the original payment day's Z-Report.
                </p>
              </div>

              <div className="px-6 py-4 bg-black/[0.02] dark:bg-white/[0.02] border-t border-black/5 dark:border-white/10 flex items-center justify-end gap-3">
                <button
                  onClick={() => setRefundOpen(false)}
                  disabled={isRefunding}
                  className="px-6 py-3 rounded-full text-sm font-bold text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmRefund}
                  disabled={isRefunding || todayClosed}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#2f2f2f] dark:bg-white text-white dark:text-black text-sm font-bold uppercase tracking-wider hover:bg-black dark:hover:bg-gray-100 transition-colors disabled:opacity-50 shadow-sm"
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
    </main>
  );
}

function AmountTile({ label, value, success, danger }) {
  return (
    <div
      className={cls(
        "p-6",
        success && "bg-emerald-50/50 dark:bg-emerald-900/10",
      )}
    >
      <div
        className={cls(
          "text-[10px] font-bold uppercase tracking-widest mb-1.5",
          success
            ? "text-emerald-800/70 dark:text-emerald-200/50"
            : danger
              ? "text-rose-700/70 dark:text-rose-300/60"
              : "text-black/50 dark:text-white/50",
        )}
      >
        {label}
      </div>
      <div
        className={cls(
          "text-2xl font-serif",
          success
            ? "font-bold text-emerald-700 dark:text-emerald-400"
            : danger
              ? "text-rose-600 dark:text-rose-400"
              : "text-black/80 dark:text-white/80",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function TimelineItem({ color, title, subtitle }) {
  return (
    <div className="relative">
      <div
        className={cls(
          "absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full ring-4 ring-white dark:ring-[#121212]",
          color,
        )}
      />
      <div className="text-sm font-bold text-black/90 dark:text-white/90">
        {title}
      </div>
      {subtitle && (
        <div className="text-xs font-medium text-black/50 dark:text-white/50 mt-1">
          {subtitle}
        </div>
      )}
    </div>
  );
}

function FinanceWarning({ tone, icon, title, text }) {
  const danger = tone === "danger";

  return (
    <div
      className={cls(
        "flex items-start gap-3 p-5 rounded-2xl border",
        danger
          ? "border-rose-200 bg-rose-50 dark:bg-rose-900/10 dark:border-rose-800/30"
          : "border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-800/30",
      )}
    >
      <div
        className={cls(
          "shrink-0 mt-0.5",
          danger
            ? "text-rose-600 dark:text-rose-400"
            : "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {icon}
      </div>
      <div>
        <p
          className={cls(
            "text-xs font-bold uppercase tracking-widest mb-1",
            danger
              ? "text-rose-800 dark:text-rose-300"
              : "text-emerald-800 dark:text-emerald-300",
          )}
        >
          {title}
        </p>
        <p
          className={cls(
            "text-xs font-medium leading-relaxed",
            danger
              ? "text-rose-700 dark:text-rose-200/70"
              : "text-emerald-700 dark:text-emerald-200/70",
          )}
        >
          {text}
        </p>
      </div>
    </div>
  );
}

function ActionButton({
  disabled,
  loading,
  onClick,
  icon,
  label,
  shortcut,
  primary,
  danger,
}) {
  return (
    <button
      disabled={disabled || loading}
      onClick={onClick}
      className={cls(
        "flex items-center justify-between w-full p-4 rounded-xl border transition-all shadow-sm text-sm font-bold uppercase tracking-wider disabled:cursor-not-allowed",
        primary &&
          !disabled &&
          "border-black/10 bg-[#2f2f2f] dark:bg-white text-white dark:text-black hover:bg-black dark:hover:bg-gray-100",
        danger &&
          !disabled &&
          "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-900/40",
        !primary &&
          !danger &&
          !disabled &&
          "border-black/10 bg-white dark:bg-[#1a1a1a] text-black/80 dark:text-white/80 hover:border-[#a3845b] hover:text-[#a3845b] dark:hover:border-[#a3845b]",
        disabled &&
          "border-black/5 bg-black/5 text-black/30 dark:border-white/5 dark:bg-white/5 dark:text-white/30 shadow-none",
      )}
    >
      <span className="flex items-center gap-2">
        {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
        {label}
      </span>
      {shortcut && !disabled && (
        <kbd className="hidden sm:inline-block font-sans text-[10px] bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded">
          {shortcut}
        </kbd>
      )}
    </button>
  );
}

function ExternalCard({ href, icon, label }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between p-4 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#121212] text-sm font-bold text-black/70 dark:text-white/70 hover:border-[#a3845b] hover:text-[#a3845b] transition-all group"
    >
      <span className="flex items-center gap-2">
        <span className="text-black/40 group-hover:text-[#a3845b]">{icon}</span>
        {label}
      </span>
      <ExternalLink
        size={14}
        className="text-black/30 group-hover:text-[#a3845b]"
      />
    </a>
  );
}
