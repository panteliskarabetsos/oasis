// admin/components/BookingPricingEditor.jsx – Stripe-aware editor with discounts
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

/**
 * Props: { bookingId: string | number, onSaved?: (payload) => void }
 */
export default function BookingPricingEditor({ bookingId, onSaved }) {
  // --- unchanged basics ---
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
  const [totalPaidAmount, setTotalPaidAmount] = React.useState("");

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

  // --- NEW: promo/discount state ---
  const [promoCode, setPromoCode] = React.useState("");
  const [promoType, setPromoType] = React.useState(null); // 'amount' | 'percent' | null
  const [promoValue, setPromoValue] = React.useState(null); // number
  const [explicitDiscount, setExplicitDiscount] = React.useState(null); // number or null

  const initialRef = React.useRef(null);

  // Money helpers
  const money = React.useCallback(
    (n, c = currency) => {
      if (n === null || n === undefined || n === "") return "—";
      const num = Number(n);
      if (!Number.isFinite(num)) return "—";
      try {
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: c || "EUR",
          currencyDisplay: "narrowSymbol",
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        }).format(num);
      } catch {
        return `${num.toFixed(2)} ${c}`;
      }
    },
    [currency]
  );
  const cents = (dec) => Math.round((Number(dec) || 0) * 100);

 
const fractionDigits = (curr) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: curr || "EUR" })
    .resolvedOptions().maximumFractionDigits;

const toMinor = (amount, curr) => {
  const fd = fractionDigits(curr);
  return Math.round((Number(amount) || 0) * 10 ** fd);
};

// replace your cents() with currency-aware variant or keep cents() for display-only.

  // ---------- totals (with discount) ----------
  const unitA = Number(unitPriceAdult || 0);
  const unitK = Number(unitPriceKid || 0);
  const estimateGross = React.useMemo(
    () => +(Number(adults || 0) * unitA + Number(kids || 0) * unitK).toFixed(2),
    [adults, kids, unitA, unitK]
  );

  const discountApplied = React.useMemo(() => {
    // 1) explicitDiscount from DB wins (already computed at the time of booking)
    if (Number.isFinite(Number(explicitDiscount))) {
      return Math.max(0, Math.min(estimateGross, Number(explicitDiscount)));
    }
    // 2) derive from promoType/value if present
    const v = Number(promoValue);
    if (!promoType || !Number.isFinite(v) || v <= 0) return 0;
    if (promoType === "percent") {
      return Math.max(0, Math.min(estimateGross, +(estimateGross * (v / 100)).toFixed(2)));
    }
    if (promoType === "amount") {
      return Math.max(0, Math.min(estimateGross, +v.toFixed(2)));
    }
    return 0;
  }, [explicitDiscount, promoType, promoValue, estimateGross]);

  const estimateNet = React.useMemo(
    () => +(Math.max(0, estimateGross - discountApplied)).toFixed(2),
    [estimateGross, discountApplied]
  );

  // balance vs what admin has recorded as paid
  const balance = React.useMemo(() => {
    const paid = totalPaidAmount === "" ? 0 : Number(totalPaidAmount) || 0;
    return +(estimateNet - paid).toFixed(2);
  }, [estimateNet, totalPaidAmount]);

  // ---------- Stripe derived ----------
// amount_received may be missing depending on how your API composes the object;
// fall back to summing captured amounts on charges.

const fmtTs = (sec) =>
  sec ? new Date(sec * 1000).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "-";

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
    currency:
      (r.currency ||
        stripe.currency ||
        stripe?.charges?.data?.[0]?.currency ||
        currency ||
        "EUR")?.toUpperCase(),
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



// Sum from normalized refunds list
const stripeRefundedCents = React.useMemo(
  () => refunds.reduce((s, r) => s + (r.amount || 0), 0),
  [refunds]
);

// Prefer PI currency, else charge currency, else editor currency
const stripeCurrency = (
  stripe?.currency ||
  stripe?.charges?.data?.[0]?.currency ||
  currency ||
  "EUR"
).toUpperCase();

  const stripeSucceeded = String(stripe?.status || "").toLowerCase() === "succeeded";
  const stripeNetPaidCents = Math.max(0, stripeAmountReceivedCents - stripeRefundedCents);
  const estimateNetCents = cents(estimateNet);

  // compare Stripe net vs discounted total
  const stripeLessThanEstimate =
    stripeSucceeded && estimateNetCents > 0 && stripeNetPaidCents < estimateNetCents;

  // lock when fully paid via Stripe against the discounted total
  const lockByStripe =
    Boolean(piId) && stripeSucceeded && estimateNetCents > 0 && stripeNetPaidCents >= estimateNetCents;

  
  // ---------- Auto-status preview uses NET ----------
  const nextStatusPreview = React.useMemo(() => {
    const to2 = (n) =>
      n === null || n === undefined || n === ""
        ? 0
        : Number.parseFloat(Number(n).toFixed(2));
    const EPS = 0.005;
    const isCancelled = String(status).toLowerCase() === "cancelled";
    const paidNum = totalPaidAmount === "" ? 0 : to2(totalPaidAmount);

    if (!isCancelled && estimateNet > 0) {
      if (Math.abs(paidNum - estimateNet) < EPS) return "paid";
      if (paidNum < estimateNet) return "pending";
      return "paid"; // overpaid
    }
    return status;
  }, [status, estimateNet, totalPaidAmount]);

  const dirty = React.useMemo(() => {
    const init = initialRef.current;
    if (!init) return false;
    return (
      init.currency !== currency ||
      init.status !== status ||
      String(init.unitPriceAdult ?? "") !== String(unitPriceAdult ?? "") ||
      String(init.unitPriceKid ?? "") !== String(unitPriceKid ?? "") ||
      String(init.totalPaidAmount ?? "") !== String(totalPaidAmount ?? "")
    );
  }, [currency, status, unitPriceAdult, unitPriceKid, totalPaidAmount]);

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
        setStatus(item?.status || "confirmed");
        setCurrency(item?.money?.currency || item?.currency || "EUR");

        // prices
        const pA = item?.unitPrices?.adult ?? item?.unitPriceAdult ?? 0;
        const pK = item?.unitPrices?.kid ?? item?.unitPriceKid ?? 0;
        setUnitPriceAdult(String(pA));
        setUnitPriceKid(String(pK));

        // total paid (decimal)
        const paid = item?.money?.totalPaidAmount ?? item?.totalPaidAmount ?? "";
        setTotalPaidAmount(paid === null || paid === undefined ? "" : String(paid));

        // Stripe PI
        const pi = item?.payments?.stripePaymentIntentId || item?.stripePaymentIntentId || null;
        setPiId(pi || null);

        // --- NEW: promo extraction (robust to varying shapes) ---
        const pj = item?.promo?.json || item?.promoJson || item?.promo_json || {};
        const code =
          item?.appliedPromoCode ||
          item?.promo?.code ||
          pj?.code ||
          "";
        const dType =
          pj?.discountType ||
          pj?.type ||
          null;
        const dValue =
          (Number.isFinite(pj?.discountValue) ? Number(pj.discountValue) : null) ??
          (Number.isFinite(pj?.value) ? Number(pj.value) : null);
        const dAmount =
          Number.isFinite(item?.discountAmount) ? Number(item.discountAmount) : null;

        setPromoCode(code || "");
        setPromoType(dType);
        setPromoValue(dValue);
        setExplicitDiscount(dAmount);

        // snapshot for dirty/reset
        initialRef.current = {
          currency: item?.money?.currency || item?.currency || "EUR",
          status: item?.status || "confirmed",
          unitPriceAdult: String(pA),
          unitPriceKid: String(pK),
          totalPaidAmount: paid === null || paid === undefined ? "" : String(paid),
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

  // ---------- Load Stripe ----------
  const refreshStripe = React.useCallback(async () => {
    if (!piId) {
      setStripe(null);
      return;
    }
    setStripeLoading(true);
    setStripeErr("");
    try {
      const r = await fetch(`/api/admin/payments/${piId}`, { cache: "no-store" });
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
      setError("This booking is fully paid via Stripe. To change amounts, refund in Stripe instead.");
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

      // Use the same discount calculation we show in the UI
      const disc = discountApplied; // already clamped
      const net = +(Math.max(0, gross - disc)).toFixed(2);

      const paidNum = totalPaidAmount === "" ? 0 : nz(totalPaidAmount);

      const EPS = 0.005;
      const isCancelled = String(status).toLowerCase() === "cancelled";

      let nextStatus = status;
      if (!isCancelled && net > 0) {
        if (Math.abs(paidNum - net) < EPS) nextStatus = "paid";
        else if (paidNum < net) nextStatus = "pending";
        else nextStatus = "paid";
      }

      const payload = {
        status: nextStatus,
        currency,
        unitPriceAdult: to2(unitPriceAdult),
        unitPriceKid: to2(unitPriceKid),
        totalPaidAmount: to2(totalPaidAmount),
      };

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
      initialRef.current = {
        currency,
        status: nextStatus,
        unitPriceAdult: String(unitPriceAdult),
        unitPriceKid: String(unitPriceKid),
        totalPaidAmount: String(totalPaidAmount),
      };
      onSaved?.(j?.item || j);
    } catch (e) {
      setError(e?.message || "Failed to save changes");
    } finally {
      setSaving(false);
      setTimeout(() => setOk(""), 1500);
    }
  }

  // ---------- Helpers ----------
  function markFullyPaid() {
    setTotalPaidAmount(estimateNet.toFixed(2)); // ← NET after discount
    setStatus("paid");
  }

  function resetToInitial() {
    const init = initialRef.current;
    if (!init) return;
    setCurrency(init.currency);
    setStatus(init.status);
    setUnitPriceAdult(init.unitPriceAdult);
    setUnitPriceKid(init.unitPriceKid);
    setTotalPaidAmount(init.totalPaidAmount);
  }

  function openRefundModal(amountDefaultCents) {
    const dec = (Number(amountDefaultCents || 0) / 100).toFixed(2);
    setRefundAmount(dec);
    setRefundErr("");
    setRefundOk("");
    setShowRefund(true);
  }

  async function submitRefund() {
    if (!piId) return;
    const amtCents = cents(refundAmount);
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
  }, [saving]);

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

  const disabledAll = loading || saving || (lockByStripe && !stripeLessThanEstimate);

  // ---------- UI ----------
  return (
    <div className="rounded-2xl border border-black/5 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5" >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet2 className="h-5 w-5 text-[#a3845b]" />
          <h3 className="text-sm font-semibold uppercase tracking-wide opacity-70">
            Pricing & Payment
          </h3>
        </div>
        <div className={["rounded-full px-2.5 py-0.5 text-xs font-semibold", statusTone(status)].join(" ")} title="Current status">
          Status: {status}
        </div>
      </div>

      {/* Stripe banner (unchanged except net logic) */}
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
              {stripeErr && <span className="text-xs text-rose-600">({stripeErr})</span>}
            </div>
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
          </div>

          {stripe && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#7a6a58]">
              <span>
                Collected: <strong className="text-[#3f342c]">{money(stripeAmountReceivedCents / 100, stripeCurrency)}</strong>
              </span>
              <span>• Refunded: {money(stripeRefundedCents / 100, stripeCurrency)}</span>
              <span>• Net: {money(stripeNetPaidCents / 100, stripeCurrency)}</span>
              {stripeLessThanEstimate ? (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                  Partially paid on Stripe (vs discounted total)
                </span>
              ) : lockByStripe ? (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                  Fully paid on Stripe (discounted total)
                </span>
              ) : null}
            </div>
          )}
{refunds.length > 0 && (
  <div className="mt-2 rounded-lg border border-[#e8e5df] bg-white p-2">
    <div className="mb-1 text-xs font-semibold text-[#3f342c]">Refunds</div>
    <ul className="divide-y">
      {refunds.map((r) => (
        <li key={r.id} className="py-1.5 text-xs flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[#7a6a58]">
              <code className="rounded bg-[#fcfbf8] px-1 py-0.5">{r.id}</code>
              <span className="mx-1">•</span>
              <span className="capitalize">{r.status || "unknown"}</span>
              {r.reason ? <span className="opacity-70"> — {r.reason}</span> : null}
            </div>
            <div className="opacity-70">{fmtTs(r.created)}</div>
          </div>
          <div className="font-semibold text-rose-700">
            -{money(r.amount / 100, r.currency)}
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
            {stripeLessThanEstimate && (
              <button
                type="button"
                onClick={markFullyPaid}
                className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                title="Customer covered remainder offline"
              >
                <Wallet className="h-3.5 w-3.5" /> Mark fully paid (offline)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Core form (fields are same, now disabled via lockByStripe) */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/10" />
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
              label="Total paid"
              icon={CreditCard}
              help={lockByStripe ? "Locked: fully paid via Stripe" : "Set the amount already collected."}
            >
              <div className="flex items-center gap-2">
                <NumberInput
                  value={totalPaidAmount}
                  onChange={setTotalPaidAmount}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  prefix={currencySymbol(currency)}
                  disabled={disabledAll}
                />
                {!lockByStripe && (
                  <button
                    type="button"
                    onClick={markFullyPaid}
                    className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-2 text-xs font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                    title="Set total paid equal to discounted total and mark status = paid"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Fully paid
                  </button>
                )}
              </div>
            </Field>

            <Field
              label="Status"
              icon={CheckCircle2}
              help={
                lockByStripe
                  ? "Locked: fully paid via Stripe"
                  : "Auto-adjusts on save against the discounted total."
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
              <div className="text-lg font-semibold">{money(estimateNet, currency)}</div>
              <div className="mt-2 rounded-lg border border-[#efe9e0] bg-[#fcfbf8] p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span>{money(estimateGross, currency)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5" />
                    {promoCode ? `Discount (${promoCode})` : "Discount"}
                    {promoType === "percent" && Number.isFinite(promoValue) ? ` — ${promoValue}%` : ""}
                  </span>
                  <span>-{money(discountApplied, currency)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between font-semibold">
                  <span>Total</span>
                  <span>{money(estimateNet, currency)}</span>
                </div>
              </div>
              <div className="mt-1 text-xs opacity-70">
                {adults}×{money(unitPriceAdult || 0, currency)} + {kids}×{money(unitPriceKid || 0, currency)}
              </div>
            </div>

            <div className="rounded-xl border border-black/10 bg-white/60 p-4 text-sm dark:border-white/10 dark:bg-white/5">
              <div className="mb-1 text-xs uppercase tracking-wide opacity-60">Paid (editor)</div>
              <div className="text-lg font-semibold">{money(totalPaidAmount || 0, currency)}</div>
              {stripe && (
                <div className="mt-1 text-xs text-[#7a6a58]">
                  Stripe net: <strong>{money(stripeNetPaidCents / 100, stripeCurrency)}</strong>
                </div>
              )}
              {refunds.length > 0 && (
  <div className="text-xs text-[#7a6a58]">
    Stripe refunded: <strong>{money(stripeRefundedCents / 100, stripeCurrency)}</strong>
  </div>
)}

            </div>

            <div className="rounded-xl border border-black/10 bg-white/60 p-4 text-sm dark:border-white/10 dark:bg-white/5">
              <div className="mb-1 text-xs uppercase tracking-wide opacity-60">Balance</div>
              <div
                className={[
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold",
                  balance > 0
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                    : balance < 0
                    ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
                ].join(" ")}
                title={balance > 0 ? "Amount due" : balance < 0 ? "Overpaid (credit)" : "Fully paid"}
              >
                {money(balance, currency)}
              </div>
              {balance < 0 && (
                <div className="mt-2 rounded-lg border border-amber-300/40 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-400/20 dark:bg-amber-900/20 dark:text-amber-100">
                  Overpaid by <strong>{money(Math.abs(balance), currency)}</strong>. Record a refund or keep as credit.
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
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
           disabled={saving || !dirty || lockByStripe}
           className="inline-flex items-center gap-2 rounded-full bg-[#a3845b] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#b79266] disabled:opacity-60"
           title={lockByStripe ? "Locked: fully paid via Stripe" : "Save changes"}
         >
           {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
           {saving ? "Saving…" : lockByStripe ? "Locked by Stripe" : "Save changes"}
         </button>
       </div>
     </div>
   </div>
        </>
      )}

      {/* Refund modal (unchanged) */}
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
              Net paid on Stripe: <strong>{money(stripeNetPaidCents / 100, stripeCurrency)}</strong>
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
                  <span className="text-[#7a6a58]">Refunds are processed by Stripe.</span>
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
                  {refundSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
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

function NumberInput({ value, onChange, placeholder, min = 0, step = 0.01, prefix, disabled }) {
  return (
    <div className="relative">
      {prefix ? (
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-sm opacity-70" aria-hidden="true">
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
      new Intl.NumberFormat(undefined, { style: "currency", currency: c || "EUR" })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value || ""
    );
  } catch {
    return "";
  }
}
