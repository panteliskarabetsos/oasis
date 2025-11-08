// admin/components/BookingPricingEditor.jsx – Stripe + Offline aware editor
"use client";

import React from "react";
import {
  Loader2,
  CreditCard,
  CheckCircle2,
  Users,
  Baby,
  User2,
  Wallet2,
  RefreshCw,
  Info,
  ArrowLeftRight,
  Save,
  ShieldCheck,
  ExternalLink,
  RotateCcw,
  Wallet,
  Tag,
} from "lucide-react";

const DEFAULT_CURRENCY = "EUR";
const EPSILON = 0.005;

/* ----------------------- money / currency helpers ----------------------- */

function fractionDigits(curr) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: curr || DEFAULT_CURRENCY,
    }).resolvedOptions().maximumFractionDigits;
  } catch {
    // fallback: most major currencies
    return 2;
  }
}

function toMinor(amount, curr) {
  const fd = fractionDigits(curr);
  return Math.round((Number(amount) || 0) * 10 ** fd);
}

function minorToMajor(amountMinor, curr) {
  const fd = fractionDigits(curr);
  return (Number(amountMinor) || 0) / 10 ** fd;
}

function formatMoney(n, c = DEFAULT_CURRENCY) {
  if (n === null || n === undefined || n === "") return "—";
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: c || DEFAULT_CURRENCY,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${num.toFixed(2)} ${c}`;
  }
}

/**
 * Props: { bookingId: string | number, onSaved?: (payload) => void }
 *
 * DB semantics:
 *   Booking.totalPaidAmount = COMBINED paid (Stripe + offline).
 * UI semantics:
 *   - `totalPaidAmount` state = OFFLINE portion only.
 *   - Combined = offline + stripeNetPaid (if same currency).
 */
export default function BookingPricingEditor({ bookingId, onSaved }) {
  // --- basics ---
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [ok, setOk] = React.useState("");

  const [adults, setAdults] = React.useState(0);
  const [kids, setKids] = React.useState(0);
  const [status, setStatus] = React.useState("confirmed");
  const [currency, setCurrency] = React.useState("EUR");

  const [unitPriceAdult, setUnitPriceAdult] = React.useState("");
  const [unitPriceKid, setUnitPriceKid] = React.useState("");
  const [totalPaidAmount, setTotalPaidAmount] = React.useState(""); // OFFLINE portion (editor)
  const [offlineTouched, setOfflineTouched] = React.useState(false); // user edited offline

  // Stripe bits
  const [piId, setPiId] = React.useState(null);
  const [stripe, setStripe] = React.useState(null);
  const [stripeLoading, setStripeLoading] = React.useState(false);
  const [stripeErr, setStripeErr] = React.useState("");

  // Refund modal
  const [showRefund, setShowRefund] = React.useState(false);
  const [refundAmount, setRefundAmount] = React.useState("");
  const [refundSaving, setRefundSaving] = React.useState(false);
  const [refundErr, setRefundErr] = React.useState("");
  const [refundOk, setRefundOk] = React.useState("");

  // Promo/discount state
  const [promoCode, setPromoCode] = React.useState("");
  const [promoType, setPromoType] = React.useState(null); // 'amount' | 'percent' | null
  const [promoValue, setPromoValue] = React.useState(null); // number
  const [explicitDiscount, setExplicitDiscount] = React.useState(null); // number or null

  // initialRef stores DB baseline & offline baseline
  const initialRef = React.useRef(null);

  // Money helpers tied to booking currency
  const money = React.useCallback(
    (n, c = currency) => formatMoney(n, c || DEFAULT_CURRENCY),
    [currency]
  );

  // ---------- totals (with discount) ----------
  const unitA = Number(unitPriceAdult || 0);
  const unitK = Number(unitPriceKid || 0);

  const estimateGross = React.useMemo(
    () => +(Number(adults || 0) * unitA + Number(kids || 0) * unitK).toFixed(2),
    [adults, kids, unitA, unitK]
  );

  const discountApplied = React.useMemo(() => {
    // explicit discount overrides promo logic
    if (Number.isFinite(Number(explicitDiscount))) {
      const disc = Number(explicitDiscount);
      return Math.max(0, Math.min(estimateGross, +disc.toFixed(2)));
    }

    const v = Number(promoValue);
    if (!promoType || !Number.isFinite(v) || v <= 0) return 0;

    if (promoType === "percent") {
      const raw = estimateGross * (v / 100);
      return Math.max(0, Math.min(estimateGross, +raw.toFixed(2)));
    }

    if (promoType === "amount") {
      return Math.max(0, Math.min(estimateGross, +v.toFixed(2)));
    }

    return 0;
  }, [explicitDiscount, promoType, promoValue, estimateGross]);

  const estimateNet = React.useMemo(
    () => +Math.max(0, estimateGross - discountApplied).toFixed(2),
    [estimateGross, discountApplied]
  );

  // ---------- Stripe derived ----------
  const fmtTs = (sec) =>
    sec
      ? new Date(sec * 1000).toLocaleString("en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "-";

  // Normalize refunds regardless of shape
  const refunds = React.useMemo(() => {
    if (!stripe) return [];
    let list = [];
    if (Array.isArray(stripe.refunds)) list = stripe.refunds;
    else if (Array.isArray(stripe?.refunds?.data)) list = stripe.refunds.data;
    else if (Array.isArray(stripe?.charges?.data)) {
      stripe.charges.data.forEach((c) => {
        const rs = Array.isArray(c?.refunds?.data)
          ? c.refunds.data
          : Array.isArray(c?.refunds)
          ? c.refunds
          : [];
        list.push(...rs);
      });
    }
    return list.map((r) => ({
      id: r.id,
      amount: Number(r.amount || 0),
      currency: (
        r.currency ||
        stripe.currency ||
        stripe?.charges?.data?.[0]?.currency ||
        currency ||
        DEFAULT_CURRENCY
      )?.toUpperCase(),
      created: Number(r.created || 0),
      status: r.status || "",
      reason: r.reason || r?.metadata?.reason || "",
    }));
  }, [stripe, currency]);

  const stripeAmountReceivedCents = React.useMemo(() => {
    if (!stripe) return 0;
    if (stripe?.amount_received != null) return Number(stripe.amount_received);
    const chs = stripe?.charges?.data;
    if (Array.isArray(chs) && chs.length) {
      return chs.reduce(
        (sum, c) => sum + Number(c?.amount_captured ?? c?.amount ?? 0),
        0
      );
    }
    return 0;
  }, [stripe]);

  const stripeRefundedCents = React.useMemo(
    () => refunds.reduce((s, r) => s + (r.amount || 0), 0),
    [refunds]
  );

  const stripeCurrency = (
    stripe?.currency ||
    stripe?.charges?.data?.[0]?.currency ||
    currency ||
    DEFAULT_CURRENCY
  ).toUpperCase();

  const stripeSucceeded =
    String(stripe?.status || "").toLowerCase() === "succeeded";

  const stripeNetPaidCents = Math.max(
    0,
    stripeAmountReceivedCents - stripeRefundedCents
  );

  const stripeNetPaidDec = minorToMajor(stripeNetPaidCents, stripeCurrency);

  // Currency handling
  const currencyMismatch =
    Boolean(stripe) && stripeCurrency !== (currency || DEFAULT_CURRENCY);

  // Comparisons must be in the SAME currency
  const stripeLessThanEstimate =
    stripeSucceeded &&
    !currencyMismatch &&
    stripeNetPaidCents < toMinor(estimateNet, stripeCurrency);

  const lockByStripe =
    Boolean(piId) &&
    stripeSucceeded &&
    !currencyMismatch &&
    stripeNetPaidCents >= toMinor(estimateNet, stripeCurrency);

  // ---------- Combined paid (Stripe + Offline) ----------
  const offlinePaid = totalPaidAmount === "" ? 0 : Number(totalPaidAmount) || 0;

  const combinedPaid = currencyMismatch
    ? offlinePaid
    : +(offlinePaid + stripeNetPaidDec).toFixed(2);

  const balanceCombined = +(estimateNet - combinedPaid).toFixed(2);

  const remainderAfterStripe = currencyMismatch
    ? estimateNet
    : +Math.max(0, estimateNet - stripeNetPaidDec).toFixed(2);

  // Block offline > remainder (same currency)
  const offlineTooHigh =
    piId &&
    stripeSucceeded &&
    !currencyMismatch &&
    offlinePaid > remainderAfterStripe + EPSILON;

  // ---------- Auto-status preview (combined net) ----------
  const nextStatusPreview = React.useMemo(() => {
    const isCancelled = String(status).toLowerCase() === "cancelled";
    if (!isCancelled && estimateNet > 0) {
      if (Math.abs(combinedPaid - estimateNet) < EPSILON) return "paid";
      if (combinedPaid < estimateNet) return "pending";
      return "paid"; // overpaid
    }
    return status;
  }, [status, estimateNet, combinedPaid]);

  const dirty = React.useMemo(() => {
    const init = initialRef.current;
    if (!init) return false;

    const combinedInit =
      init.totalPaidAmountCombined === "" ||
      init.totalPaidAmountCombined === null ||
      init.totalPaidAmountCombined === undefined
        ? 0
        : Number(init.totalPaidAmountCombined) || 0;

    const combinedNow = currencyMismatch
      ? offlinePaid
      : +(offlinePaid + stripeNetPaidDec).toFixed(2);

    return (
      init.currency !== currency ||
      init.status !== status ||
      String(init.unitPriceAdult ?? "") !== String(unitPriceAdult ?? "") ||
      String(init.unitPriceKid ?? "") !== String(unitPriceKid ?? "") ||
      combinedNow !== combinedInit
    );
  }, [
    currency,
    status,
    unitPriceAdult,
    unitPriceKid,
    offlinePaid,
    currencyMismatch,
    stripeNetPaidDec,
  ]);

  // ---------- Load booking ----------
  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/admin/reservations/${bookingId}`, {
          cache: "no-store",
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || "Failed to load booking");
        if (cancelled) return;

        const item = j?.item || j;

        // counts
        const ca = item?.counts?.adults ?? item?.adultsCount ?? 0;
        const ck = item?.counts?.kids ?? item?.kidsCount ?? 0;
        setAdults(Number(ca) || 0);
        setKids(Number(ck) || 0);

        // status + currency
        const itemStatus = item?.status || "confirmed";
        const itemCurrency =
          item?.money?.currency || item?.currency || DEFAULT_CURRENCY;
        setStatus(itemStatus);
        setCurrency(itemCurrency);

        // prices
        const pA = item?.unitPrices?.adult ?? item?.unitPriceAdult ?? 0;
        const pK = item?.unitPrices?.kid ?? item?.unitPriceKid ?? 0;
        setUnitPriceAdult(String(pA));
        setUnitPriceKid(String(pK));

        // total paid from DB (COMBINED, decimal)
        const paid =
          item?.money?.totalPaidAmount ?? item?.totalPaidAmount ?? "";
        const paidStr = paid === null || paid === undefined ? "" : String(paid);

        // For now, mirror the DB combined into offline field;
        // once Stripe loads we will derive offline = combined - stripeNet
        setTotalPaidAmount(paidStr);
        setOfflineTouched(false);

        // Stripe PI
        const pi =
          item?.payments?.stripePaymentIntentId ||
          item?.stripePaymentIntentId ||
          null;
        setPiId(pi || null);

        // promo extraction (robust to varying shapes)
        const pj =
          item?.promo?.json || item?.promoJson || item?.promo_json || {};
        const code =
          item?.appliedPromoCode || item?.promo?.code || pj?.code || "";
        const dType = pj?.discountType || pj?.type || null;
        const rawValue =
          (Number.isFinite(pj?.discountValue)
            ? Number(pj.discountValue)
            : null) ?? (Number.isFinite(pj?.value) ? Number(pj.value) : null);
        const dAmount = Number.isFinite(item?.discountAmount)
          ? Number(item.discountAmount)
          : null;

        setPromoCode(code || "");
        setPromoType(dType);
        setPromoValue(rawValue);
        setExplicitDiscount(dAmount);

        // snapshot for dirty/reset
        initialRef.current = {
          currency: itemCurrency,
          status: itemStatus,
          unitPriceAdult: String(pA),
          unitPriceKid: String(pK),
          // DB combined baseline
          totalPaidAmountCombined: paidStr,
          // offline baseline (will be updated when Stripe is known)
          totalPaidAmountOffline: paidStr,
        };
      } catch (e) {
        if (!cancelled) setError(e?.message || "Failed to load booking");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  // ---------- After Stripe loads, derive OFFLINE portion from DB combined ----------
  // offline = max(0, combinedFromDb - stripeNetPaidDec)
  React.useEffect(() => {
    const init = initialRef.current;
    if (!init) return;

    if (!stripe || !piId || currencyMismatch || offlineTouched) return;

    const combinedInit =
      init.totalPaidAmountCombined === "" ||
      init.totalPaidAmountCombined === null ||
      init.totalPaidAmountCombined === undefined
        ? 0
        : Number(init.totalPaidAmountCombined) || 0;

    const offline = Math.max(0, +(combinedInit - stripeNetPaidDec).toFixed(2));

    const offlineStr =
      init.totalPaidAmountCombined === "" && offline === 0
        ? ""
        : offline.toFixed(2);

    setTotalPaidAmount(offlineStr);
    init.totalPaidAmountOffline = offlineStr;
  }, [stripe, piId, stripeNetPaidDec, currencyMismatch, offlineTouched]);

  // ---------- Load Stripe ----------
  const refreshStripe = React.useCallback(async () => {
    if (!piId) {
      setStripe(null);
      return;
    }
    setStripeLoading(true);
    setStripeErr("");
    try {
      const r = await fetch(`/api/admin/payments/${piId}`, {
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Failed to load Stripe payment");
      setStripe(j?.item || j);
    } catch (e) {
      setStripe(null);
      setStripeErr(e?.message || "Failed to load Stripe payment");
    } finally {
      setStripeLoading(false);
    }
  }, [piId]);

  React.useEffect(() => {
    if (piId) refreshStripe();
  }, [piId, refreshStripe]);

  // ---------- Save ----------
  async function save() {
    if (lockByStripe) {
      setError(
        "This booking is fully paid via Stripe. To change amounts, refund in Stripe instead."
      );
      return;
    }

    setSaving(true);
    setError("");
    setOk("");

    try {
      const to2 = (n) =>
        n === null || n === undefined || n === ""
          ? null
          : Number.parseFloat(Number(n).toFixed(2));

      const nz = (v) => {
        const n = typeof v === "string" ? Number(v) : v;
        return Number.isFinite(n) && n >= 0 ? n : 0;
      };

      const A = nz(adults);
      const K = nz(kids);
      const UA = nz(unitPriceAdult);
      const UK = nz(unitPriceKid);

      const gross = +(A * UA + K * UK).toFixed(2);

      // Same discount logic as UI
      const disc = discountApplied; // already clamped
      const net = +Math.max(0, gross - disc).toFixed(2);

      // offline portion (editor) and combined (DB)
      const offline = totalPaidAmount === "" ? 0 : nz(totalPaidAmount);
      const combined = currencyMismatch
        ? offline
        : +(offline + stripeNetPaidDec).toFixed(2);

      // Hard guard to avoid double-counting vs Stripe
      if (piId && stripeSucceeded && !currencyMismatch) {
        const maxOffline = remainderAfterStripe; // already 2dp
        if (offline > maxOffline + EPSILON) {
          throw new Error(
            `Offline paid (${money(
              offline,
              currency
            )}) exceeds remainder after Stripe (${money(
              maxOffline,
              currency
            )}).`
          );
        }
      }

      const isCancelled = String(status).toLowerCase() === "cancelled";

      let nextStatus = status;
      if (!isCancelled && net > 0) {
        if (Math.abs(combined - net) < EPSILON) nextStatus = "paid";
        else if (combined < net) nextStatus = "pending";
        else nextStatus = "paid";
      }

      const payload = {
        status: nextStatus,
        currency,
        unitPriceAdult: to2(unitPriceAdult),
        unitPriceKid: to2(unitPriceKid),
        // IMPORTANT: DB gets COMBINED total (Stripe + offline)
        totalPaidAmount: to2(combined),
      };

      // basic validation
      for (const [k, v] of Object.entries(payload)) {
        if (["unitPriceAdult", "unitPriceKid", "totalPaidAmount"].includes(k)) {
          if (v !== null && !(Number.isFinite(v) && v >= 0)) {
            throw new Error(`${k} must be a number ≥ 0`);
          }
        }
      }

      const res = await fetch(`/api/admin/reservations/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to save changes");

      setStatus(nextStatus);
      setOk("Saved");

      // Update baseline snapshot
      initialRef.current = {
        currency,
        status: nextStatus,
        unitPriceAdult: String(unitPriceAdult),
        unitPriceKid: String(unitPriceKid),
        totalPaidAmountCombined: String(combined),
        totalPaidAmountOffline: String(totalPaidAmount),
      };
      setOfflineTouched(false);

      onSaved?.(j?.item || j);
    } catch (e) {
      setError(e?.message || "Failed to save changes");
    } finally {
      setSaving(false);
      setTimeout(() => setOk(""), 1500);
    }
  }

  // ---------- Helpers ----------
  const handleOfflineChange = React.useCallback((val) => {
    setOfflineTouched(true);
    setTotalPaidAmount(val);
  }, []);

  function markRemainderPaidOffline() {
    // Fill offline with remainder after Stripe (only if same currency)
    const value = !currencyMismatch ? remainderAfterStripe : estimateNet;
    setTotalPaidAmount(value.toFixed(2));
    setOfflineTouched(true);
    setStatus("paid");
  }

  function resetToInitial() {
    const init = initialRef.current;
    if (!init) return;
    setCurrency(init.currency);
    setStatus(init.status);
    setUnitPriceAdult(init.unitPriceAdult);
    setUnitPriceKid(init.unitPriceKid);
    setTotalPaidAmount(
      init.totalPaidAmountOffline ?? init.totalPaidAmountCombined ?? ""
    );
    setOfflineTouched(false);
  }

  function openRefundModal(amountDefaultCents) {
    const dec = minorToMajor(amountDefaultCents || 0, stripeCurrency).toFixed(
      2
    );
    setRefundAmount(dec);
    setRefundErr("");
    setRefundOk("");
    setShowRefund(true);
  }

  async function submitRefund() {
    if (!piId) return;
    const amtCents = toMinor(refundAmount, stripeCurrency);
    if (!amtCents || amtCents <= 0) {
      setRefundErr("Enter a positive amount.");
      return;
    }
    if (amtCents > stripeNetPaidCents) {
      setRefundErr("Amount exceeds net paid.");
      return;
    }
    setRefundSaving(true);
    setRefundErr("");
    setRefundOk("");
    try {
      const r = await fetch(`/api/admin/payments/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_intent: piId, amount_cents: amtCents }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Refund failed");
      setRefundOk("Refund created");
      await refreshStripe();
    } catch (e) {
      setRefundErr(e?.message || "Refund failed");
    } finally {
      setRefundSaving(false);
      setTimeout(() => setShowRefund(false), 900);
    }
  }

  // Save on Cmd/Ctrl+S
  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saving) save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving]); // intentionally not depending on `save` to keep behaviour stable

  const statusTone = (s) => {
    switch (s) {
      case "paid":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200";
      case "pending":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200";
      case "cancelled":
        return "bg-zinc-200 text-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-200";
      default:
        return "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200";
    }
  };

  const disabledAll =
    loading || saving || (lockByStripe && !stripeLessThanEstimate);

  // ---------- UI ----------
  return (
    <div className="rounded-2xl border border-black/5 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet2 className="h-5 w-5 text-[#a3845b]" />
          <h3 className="text-sm font-semibold uppercase tracking-wide opacity-70">
            Pricing &amp; Payment
          </h3>
        </div>
        <div
          className={[
            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
            statusTone(status),
          ].join(" ")}
          title="Current status"
        >
          Status: {status}
        </div>
      </div>

      {/* Stripe banner */}
      {piId && (
        <div className="mb-4 rounded-xl border border-[#e8e5df] bg-[#fcfbf8] p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="text-[#3f342c]">
                Stripe Payment Intent:{" "}
                <code className="rounded bg-white px-1 py-0.5">{piId}</code>
              </span>
              {stripeLoading && (
                <span className="inline-flex items-center gap-1 text-xs text-[#7a6a58]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> syncing…
                </span>
              )}
              {stripeErr && (
                <span className="text-xs text-rose-600">({stripeErr})</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {stripe?.links?.dashboard_payment && (
                <a
                  href={stripe.links.dashboard_payment}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-[#e8e5df] bg-white px-2 py-1 text-xs text-[#5a4a3f] hover:bg-[#faf8f5]"
                >
                  Open in Stripe <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <button
                type="button"
                onClick={refreshStripe}
                className="inline-flex items-center gap-1 rounded-lg border border-[#e8e5df] bg-white px-2 py-1 text-xs hover:bg-[#faf8f5]"
                title="Re-sync from Stripe"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Re-sync
              </button>
            </div>
          </div>

          {currencyMismatch && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-amber-300/50 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:border-amber-400/20 dark:bg-amber-900/20 dark:text-amber-100">
              <Info className="h-3.5 w-3.5" />
              Stripe is {stripeCurrency}, booking is {currency}. Totals are
              shown separately (no FX conversion).
            </div>
          )}

          {stripe && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#7a6a58]">
              <span>
                Collected:{" "}
                <strong className="text-[#3f342c]">
                  {money(
                    minorToMajor(stripeAmountReceivedCents, stripeCurrency),
                    stripeCurrency
                  )}
                </strong>
              </span>
              <span>
                • Refunded:{" "}
                {money(
                  minorToMajor(stripeRefundedCents, stripeCurrency),
                  stripeCurrency
                )}
              </span>
              <span>
                • Net:{" "}
                {money(
                  minorToMajor(stripeNetPaidCents, stripeCurrency),
                  stripeCurrency
                )}
              </span>
              {!currencyMismatch && stripeLessThanEstimate ? (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                  Partially paid on Stripe (vs discounted total)
                </span>
              ) : !currencyMismatch && lockByStripe ? (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                  Fully paid on Stripe (discounted total)
                </span>
              ) : null}
            </div>
          )}

          {refunds.length > 0 && (
            <div className="mt-2 rounded-lg border border-[#e8e5df] bg-white p-2">
              <div className="mb-1 text-xs font-semibold text-[#3f342c]">
                Refunds
              </div>
              <ul className="divide-y">
                {refunds.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 py-1.5 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[#7a6a58]">
                        <code className="rounded bg-[#fcfbf8] px-1 py-0.5">
                          {r.id}
                        </code>
                        <span className="mx-1">•</span>
                        <span className="capitalize">
                          {r.status || "unknown"}
                        </span>
                        {r.reason ? (
                          <span className="opacity-70"> — {r.reason}</span>
                        ) : null}
                      </div>
                      <div className="opacity-70">{fmtTs(r.created)}</div>
                    </div>
                    <div className="font-semibold text-rose-700">
                      -{money(minorToMajor(r.amount, r.currency), r.currency)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {stripeNetPaidCents > 0 && (
              <button
                type="button"
                onClick={() => openRefundModal(stripeNetPaidCents)}
                className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Refund…
              </button>
            )}
            {stripeLessThanEstimate && !currencyMismatch && (
              <button
                type="button"
                onClick={markRemainderPaidOffline}
                className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                title="Customer covered remainder offline"
              >
                <Wallet className="h-3.5 w-3.5" /> Mark remainder paid (offline)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Core form */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/10"
            />
          ))}
        </div>
      ) : (
        <>
          {/* People summary */}
          <div className="mb-4 grid grid-cols-3 gap-2 text-sm">
            <StatCard icon={User2} label="Adults" value={adults} />
            <StatCard icon={Baby} label="Kids" value={kids} />
            <StatCard icon={Users} label="Total" value={adults + kids} />
          </div>

          {/* Editable fields */}
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Unit price (adult)" icon={CreditCard}>
              <NumberInput
                value={unitPriceAdult}
                onChange={setUnitPriceAdult}
                placeholder="0.00"
                min={0}
                step={0.01}
                prefix={currencySymbol(currency)}
                disabled={disabledAll}
              />
            </Field>
            <Field label="Unit price (kid)" icon={CreditCard}>
              <NumberInput
                value={unitPriceKid}
                onChange={setUnitPriceKid}
                placeholder="0.00"
                min={0}
                step={0.01}
                prefix={currencySymbol(currency)}
                disabled={disabledAll}
              />
            </Field>
            <Field label="Currency" icon={CreditCard}>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={disabledAll}
                className="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-[#a3845b] focus:ring-2 focus:ring-[#a3845b]/20 dark:border-white/10 dark:bg-white/5"
              >
                <option>EUR</option>
                <option>USD</option>
                <option>GBP</option>
                <option>CHF</option>
                <option>CAD</option>
                <option>AUD</option>
              </select>
            </Field>

            <Field
              label="Offline paid (editor)"
              icon={CreditCard}
              help={
                lockByStripe
                  ? "Locked: fully paid via Stripe"
                  : currencyMismatch
                  ? "Currencies differ: this field tracks offline in booking currency only."
                  : "Set the amount collected offline (cash/bank/POS). Combined total = Stripe + Offline."
              }
            >
              <div className="flex items-center gap-2">
                <NumberInput
                  value={totalPaidAmount}
                  onChange={handleOfflineChange}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  prefix={currencySymbol(currency)}
                  disabled={disabledAll}
                />
                {!lockByStripe && (
                  <button
                    type="button"
                    onClick={markRemainderPaidOffline}
                    className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-2 text-xs font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                    title={
                      currencyMismatch
                        ? "Currencies differ — fills with discounted total"
                        : "Fill with remainder after Stripe"
                    }
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />{" "}
                    {currencyMismatch ? "Fill total" : "Fill remainder"}
                  </button>
                )}
              </div>

              {/* remainder helper + warning */}
              {!currencyMismatch && piId && stripeSucceeded && (
                <div
                  className={`mt-1 text-xs ${
                    offlineTooHigh ? "text-rose-600" : "text-[#7a6a58]"
                  }`}
                >
                  Remainder after Stripe:{" "}
                  <strong>{money(remainderAfterStripe, currency)}</strong>
                  {offlineTooHigh &&
                    " — reduce Offline paid or issue a Stripe refund."}
                </div>
              )}
            </Field>

            <Field
              label="Status"
              icon={CheckCircle2}
              help={
                lockByStripe
                  ? "Locked: fully paid via Stripe"
                  : "Auto-adjusts on save against the discounted total (Stripe + Offline)."
              }
            >
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={disabledAll}
                className="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-[#a3845b] focus:ring-2 focus:ring-[#a3845b]/20 dark:border-white/10 dark:bg-white/5"
              >
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
              </select>
              {!lockByStripe && nextStatusPreview !== status && (
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-900/30 dark:text-sky-200">
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  On save → {nextStatusPreview}
                </div>
              )}
            </Field>
          </div>

          {/* Totals (with discount breakdown) */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-black/10 bg-white/60 p-4 text-sm dark:border-white/10 dark:bg-white/5">
              <div className="mb-1 text-xs uppercase tracking-wide opacity-60">
                Total (after discounts)
              </div>
              <div className="text-lg font-semibold">
                {money(estimateNet, currency)}
              </div>
              <div className="mt-2 rounded-lg border border-[#efe9e0] bg-[#fcfbf8] p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span>{money(estimateGross, currency)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5" />
                    {promoCode ? `Discount (${promoCode})` : "Discount"}
                    {promoType === "percent" &&
                    Number.isFinite(promoValue) &&
                    promoValue > 0
                      ? ` — ${promoValue}%`
                      : ""}
                  </span>
                  <span>-{money(discountApplied, currency)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between font-semibold">
                  <span>Total</span>
                  <span>{money(estimateNet, currency)}</span>
                </div>
              </div>
              <div className="mt-1 text-xs opacity-70">
                {adults}×{money(unitPriceAdult || 0, currency)} + {kids}×
                {money(unitPriceKid || 0, currency)}
              </div>
            </div>

            <div className="rounded-xl border border-black/10 bg-white/60 p-4 text-sm dark:border-white/10 dark:bg-white/5">
              <div className="mb-1 text-xs uppercase tracking-wide opacity-60">
                Paid summary
              </div>
              <div className="text-xs text-[#7a6a58]">
                Offline (editor):{" "}
                <strong>{money(offlinePaid, currency)}</strong>
              </div>
              {stripe && (
                <div className="mt-1 text-xs text-[#7a6a58]">
                  Stripe net:{" "}
                  <strong>
                    {money(
                      minorToMajor(stripeNetPaidCents, stripeCurrency),
                      stripeCurrency
                    )}
                  </strong>
                </div>
              )}
              {refunds.length > 0 && (
                <div className="text-xs text-[#7a6a58]">
                  Stripe refunded:{" "}
                  <strong>
                    {money(
                      minorToMajor(stripeRefundedCents, stripeCurrency),
                      stripeCurrency
                    )}
                  </strong>
                </div>
              )}
              {!currencyMismatch && (
                <div className="mt-1 text-sm font-semibold text-[#3f342c]">
                  Combined paid: {money(combinedPaid, currency)}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-black/10 bg-white/60 p-4 text-sm dark:border-white/10 dark:bg-white/5">
              <div className="mb-1 text-xs uppercase tracking-wide opacity-60">
                Balance{" "}
                {currencyMismatch ? "(booking currency)" : "(Stripe + offline)"}
              </div>
              <div
                className={[
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold",
                  balanceCombined > 0
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                    : balanceCombined < 0
                    ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
                ].join(" ")}
                title={
                  balanceCombined > 0
                    ? "Amount due"
                    : balanceCombined < 0
                    ? "Overpaid (credit)"
                    : "Fully paid"
                }
              >
                {money(balanceCombined, currency)}
              </div>
              {balanceCombined < 0 && (
                <div className="mt-2 rounded-lg border border-amber-300/40 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-400/20 dark:bg-amber-900/20 dark:text-amber-100">
                  Overpaid by{" "}
                  <strong>{money(Math.abs(balanceCombined), currency)}</strong>.
                  Record a refund or keep as credit.
                </div>
              )}
            </div>
          </div>

          {/* Sticky Footer actions */}
          <div className="sticky bottom-0 z-10 mt-6 border-t border-black/10 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-white/10 dark:bg-[#0b0b0b]/70">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-3">
              {/* left messages (error/ok) */}
              <div className="min-h-[32px]">
                {error ? (
                  <div className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:border-red-400/20 dark:bg-red-900/20 dark:text-red-200">
                    <Info className="h-3.5 w-3.5" /> {error}
                  </div>
                ) : ok ? (
                  <div className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-900/20 dark:text-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {ok}
                  </div>
                ) : null}
              </div>
              {/* right buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetToInitial}
                  disabled={!dirty || saving}
                  className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                  title="Revert all changes"
                >
                  <RefreshCw className="h-4 w-4" /> Reset
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || !dirty || lockByStripe || offlineTooHigh}
                  className="inline-flex items-center gap-2 rounded-full bg-[#a3845b] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#b79266] disabled:opacity-60"
                  title={
                    lockByStripe
                      ? "Locked: fully paid via Stripe"
                      : offlineTooHigh
                      ? "Offline paid exceeds remainder after Stripe"
                      : "Save changes"
                  }
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving
                    ? "Saving…"
                    : lockByStripe
                    ? "Locked by Stripe"
                    : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Refund modal */}
      {showRefund && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Refund payment"
          onClick={() => !refundSaving && setShowRefund(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-[#111]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 text-sm font-semibold">Issue refund</div>
            <div className="text-xs text-[#7a6a58]">
              Net paid on Stripe:{" "}
              <strong>
                {money(
                  minorToMajor(stripeNetPaidCents, stripeCurrency),
                  stripeCurrency
                )}
              </strong>
            </div>
            <label className="mt-3 block text-sm">
              <span className="text-[#3f342c]">Amount to refund</span>
              <NumberInput
                value={refundAmount}
                onChange={setRefundAmount}
                placeholder="0.00"
                min={0}
                step={0.01}
                prefix={currencySymbol(stripeCurrency)}
              />
            </label>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs">
                {refundErr ? (
                  <span className="text-rose-600">{refundErr}</span>
                ) : refundOk ? (
                  <span className="text-emerald-700">{refundOk}</span>
                ) : (
                  <span className="text-[#7a6a58]">
                    Refunds are processed by Stripe.
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-black/10 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/10"
                  onClick={() => setShowRefund(false)}
                  disabled={refundSaving}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#a3845b] px-3 py-1.5 text-sm text-white hover:bg-[#b79266] disabled:opacity-60"
                  onClick={submitRefund}
                  disabled={refundSaving}
                >
                  {refundSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  {refundSaving ? "Refunding…" : "Refund"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- UI bits ----------------------------- */

function Field({ label, icon: Icon, help, children }) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        {Icon ? <Icon className="h-4 w-4 text-[#a3845b]" /> : null}
        {label}
      </div>
      {children}
      {help ? <div className="mt-1 text-xs opacity-70">{help}</div> : null}
    </label>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-black/10 p-3 dark:border-white/10">
      <div className="flex items-center justify-between">
        <div className="opacity-60">{label}</div>
        {Icon ? <Icon className="h-4 w-4 opacity-60" /> : null}
      </div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
  min = 0,
  step = 0.01,
  prefix,
  disabled,
}) {
  return (
    <div className="relative">
      {prefix ? (
        <div
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-sm opacity-70"
          aria-hidden="true"
        >
          {prefix}
        </div>
      ) : null}
      <input
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-[#a3845b] focus:ring-2 focus:ring-[#a3845b]/20 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 ${
          prefix ? "pl-10" : "pl-3"
        }`}
        placeholder={placeholder}
        aria-label={placeholder || "amount"}
      />
    </div>
  );
}

function currencySymbol(c) {
  try {
    return (
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: c || DEFAULT_CURRENCY,
      })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value || ""
    );
  } catch {
    return "";
  }
}
