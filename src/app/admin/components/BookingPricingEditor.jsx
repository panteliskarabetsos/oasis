// admin/components/BookingPricingEditor.jsx – Redesigned UI/UX
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
} from "lucide-react";

/**
 * Drop-in replacement with a modern, clearer UI, better accessibility
 * and quality-of-life improvements (skeletons, keyboard shortcut, reset, previews).
 *
 * Props: { bookingId: string, onSaved?: (item) => void }
 */
export default function BookingPricingEditor({ bookingId, onSaved }) {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [ok, setOk] = React.useState("");

  // server values
  const [adults, setAdults] = React.useState(0);
  const [kids, setKids] = React.useState(0);
  const [status, setStatus] = React.useState("confirmed");
  const [currency, setCurrency] = React.useState("EUR");

  // editable
  const [unitPriceAdult, setUnitPriceAdult] = React.useState("");
  const [unitPriceKid, setUnitPriceKid] = React.useState("");
  const [totalPaidAmount, setTotalPaidAmount] = React.useState("");

  // keep a snapshot of loaded values to detect changes / allow reset
  const initialRef = React.useRef(null);

  const estimate = React.useMemo(() => {
    const a = Number(unitPriceAdult || 0);
    const k = Number(unitPriceKid || 0);
    return Number(adults || 0) * a + Number(kids || 0) * k;
  }, [adults, kids, unitPriceAdult, unitPriceKid]);

  const balance = React.useMemo(() => {
    const paid = totalPaidAmount === "" ? 0 : Number(totalPaidAmount) || 0;
    return +(estimate - paid).toFixed(2);
  }, [estimate, totalPaidAmount]);

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
        }).format(num);
      } catch {
        return `${num.toFixed(2)} ${c}`;
      }
    },
    [currency]
  );

  // Preview the auto-status logic that will occur on Save
  const nextStatusPreview = React.useMemo(() => {
    const to2 = (n) =>
      n === null || n === undefined || n === ""
        ? 0
        : Number.parseFloat(Number(n).toFixed(2));

    const EPS = 0.005;
    const isCancelled = String(status).toLowerCase() === "cancelled";
    const est = +(+estimate).toFixed(2);
    const paidNum = totalPaidAmount === "" ? 0 : to2(totalPaidAmount);

    if (!isCancelled && est > 0) {
      if (Math.abs(paidNum - est) < EPS) return "paid";
      if (paidNum < est) return "pending";
      return "paid"; // overpaid
    }
    return status;
  }, [status, estimate, totalPaidAmount]);

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

        // prices: prefer unitPrices {adult,kid}
        const pA = item?.unitPrices?.adult ?? item?.unitPriceAdult ?? 0;
        const pK = item?.unitPrices?.kid ?? item?.unitPriceKid ?? 0;
        setUnitPriceAdult(String(pA));
        setUnitPriceKid(String(pK));

        // total paid
        const paid =
          item?.money?.totalPaidAmount ?? item?.totalPaidAmount ?? "";
        setTotalPaidAmount(
          paid === null || paid === undefined ? "" : String(paid)
        );

        // snapshot
        initialRef.current = {
          currency: item?.money?.currency || item?.currency || "EUR",
          status: item?.status || "confirmed",
          unitPriceAdult: String(pA),
          unitPriceKid: String(pK),
          totalPaidAmount:
            paid === null || paid === undefined ? "" : String(paid),
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

  async function save() {
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

      const estimate = +(A * UA + K * UK).toFixed(2);
      const paidNum = totalPaidAmount === "" ? 0 : nz(totalPaidAmount);

      const EPS = 0.005; // 0.5 cent tolerance for float rounding
      const isCancelled = String(status).toLowerCase() === "cancelled";

      let nextStatus = status;
      if (!isCancelled && estimate > 0) {
        if (Math.abs(paidNum - estimate) < EPS) {
          nextStatus = "paid";
        } else if (paidNum < estimate) {
          nextStatus = "pending";
        } else {
          // overpaid (credit)
          nextStatus = "paid";
        }
      }

      const payload = {
        status: nextStatus,
        currency,
        unitPriceAdult: to2(unitPriceAdult),
        unitPriceKid: to2(unitPriceKid),
        totalPaidAmount: to2(totalPaidAmount),
      };

      // validate non-negativity
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

      setStatus(nextStatus); // reflect auto-status change in UI
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

  function markFullyPaid() {
    setTotalPaidAmount(estimate.toFixed(2));
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
  }, [saving, save]);

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

  return (
    <div className="rounded-2xl border border-black/5 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet2 className="h-5 w-5 text-[#a3845b]" />
          <h3 className="text-sm font-semibold uppercase tracking-wide opacity-70">
            Pricing & Payment
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

      {/* Alerts */}
      <div aria-live="polite" className="sr-only">
        {error || ok}
      </div>

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
              />
            </Field>

            <Field label="Currency" icon={CreditCard}>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
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
              help={`Set the amount already collected.`}
            >
              <div className="flex items-center gap-2">
                <NumberInput
                  value={totalPaidAmount}
                  onChange={setTotalPaidAmount}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  prefix={currencySymbol(currency)}
                />
                <button
                  type="button"
                  onClick={markFullyPaid}
                  className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-2 text-xs font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                  title="Set total paid equal to estimate and mark status = paid"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Fully paid
                </button>
              </div>
            </Field>

            <Field
              label="Status"
              icon={CheckCircle2}
              help="Will auto-adjust on save if payment matches estimate."
            >
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-[#a3845b] focus:ring-2 focus:ring-[#a3845b]/20 dark:border-white/10 dark:bg-white/5"
              >
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
              </select>
              {nextStatusPreview !== status && (
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-900/30 dark:text-sky-200">
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  On save → {nextStatusPreview}
                </div>
              )}
            </Field>
          </div>

          {/* Totals strip */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-black/10 bg-white/60 p-4 text-sm dark:border-white/10 dark:bg-white/5">
              <div className="mb-1 text-xs uppercase tracking-wide opacity-60">
                Estimate
              </div>
              <div className="text-lg font-semibold">
                {money(estimate, currency)}
              </div>
              <div className="mt-1 text-xs opacity-70">
                {adults}×{money(unitPriceAdult || 0, currency)} + {kids}×
                {money(unitPriceKid || 0, currency)}
              </div>
            </div>
            <div className="rounded-xl border border-black/10 bg-white/60 p-4 text-sm dark:border-white/10 dark:bg-white/5">
              <div className="mb-1 text-xs uppercase tracking-wide opacity-60">
                Paid
              </div>
              <div className="text-lg font-semibold">
                {money(totalPaidAmount || 0, currency)}
              </div>
            </div>
            <div className="rounded-xl border border-black/10 bg-white/60 p-4 text-sm dark:border-white/10 dark:bg-white/5">
              <div className="mb-1 text-xs uppercase tracking-wide opacity-60">
                Balance
              </div>
              <div
                className={[
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold",
                  balance > 0
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                    : balance < 0
                    ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
                ].join(" ")}
                title={
                  balance > 0
                    ? "Amount due"
                    : balance < 0
                    ? "Overpaid (credit)"
                    : "Fully paid"
                }
              >
                {money(balance, currency)}
              </div>
              {balance < 0 && (
                <div className="mt-2 rounded-lg border border-amber-300/40 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-400/20 dark:bg-amber-900/20 dark:text-amber-100">
                  Overpaid by{" "}
                  <strong>{money(Math.abs(balance), currency)}</strong>. Record
                  a refund or keep as credit.
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            {/* Left side: messages */}
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
                disabled={saving || !dirty}
                className="inline-flex items-center gap-2 rounded-full bg-[#a3845b] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#b79266] disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

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
        className={`w-full rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-[#a3845b] focus:ring-2 focus:ring-[#a3845b]/20 dark:border-white/10 dark:bg-white/5 ${
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
        currency: c || "EUR",
      })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value || ""
    );
  } catch {
    return "";
  }
}
