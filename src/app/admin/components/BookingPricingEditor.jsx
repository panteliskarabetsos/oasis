// admin/components/BookingPricingEditor.jsx
"use client";

import React from "react";
import { Loader2, CreditCard, CheckCircle2 } from "lucide-react";

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

  const estimate = React.useMemo(() => {
    const a = Number(unitPriceAdult || 0);
    const k = Number(unitPriceKid || 0);
    return Number(adults || 0) * a + Number(kids || 0) * k;
  }, [adults, kids, unitPriceAdult, unitPriceKid]);

  const balance = React.useMemo(() => {
    const paid = totalPaidAmount === "" ? 0 : Number(totalPaidAmount) || 0;
    return +(estimate - paid).toFixed(2);
  }, [estimate, totalPaidAmount]);

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

        // prices: prefer unitPrices {adult,kid}, fall back to flat cols, else 0
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

  function money(n, c = "EUR") {
    if (n === null || n === undefined || n === "") return "—";
    const num = Number(n);
    return Number.isFinite(num) ? `${num.toFixed(2)} ${c}` : "—";
  }

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

  return (
    <div className="rounded-2xl border border-black/5 bg-white/70 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide opacity-70">
        Pricing & Payment
      </h3>

      {loading ? (
        <div className="flex items-center gap-2 text-sm opacity-70">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {/* People summary */}
          <div className="mb-4 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-xl border border-black/10 p-3 dark:border-white/10">
              <div className="opacity-60">Adults</div>
              <div className="text-lg font-semibold">{adults}</div>
            </div>
            <div className="rounded-xl border border-black/10 p-3 dark:border-white/10">
              <div className="opacity-60">Kids</div>
              <div className="text-lg font-semibold">{kids}</div>
            </div>
            <div className="rounded-xl border border-black/10 p-3 dark:border-white/10">
              <div className="opacity-60">Total</div>
              <div className="text-lg font-semibold">{adults + kids}</div>
            </div>
          </div>

          {/* Editable fields */}
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <label className="block">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <CreditCard className="h-4 w-4 text-[#a3845b]" />
                Unit price (adult)
              </div>
              <input
                type="number"
                min={0}
                step="0.01"
                value={unitPriceAdult}
                onChange={(e) => setUnitPriceAdult(e.target.value)}
                className="input"
                placeholder="0.00"
              />
            </label>

            <label className="block">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <CreditCard className="h-4 w-4 text-[#a3845b]" />
                Unit price (kid)
              </div>
              <input
                type="number"
                min={0}
                step="0.01"
                value={unitPriceKid}
                onChange={(e) => setUnitPriceKid(e.target.value)}
                className="input"
                placeholder="0.00"
              />
            </label>

            <label className="block">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <CreditCard className="h-4 w-4 text-[#a3845b]" />
                Currency
              </div>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="input"
              >
                <option>EUR</option>
                <option>USD</option>
                <option>GBP</option>
                <option>CHF</option>
                <option>CAD</option>
                <option>AUD</option>
              </select>
            </label>

            <label className="block">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <CreditCard className="h-4 w-4 text-[#a3845b]" />
                Total paid
              </div>
              <input
                type="number"
                min={0}
                step="0.01"
                value={totalPaidAmount}
                onChange={(e) => setTotalPaidAmount(e.target.value)}
                className="input"
                placeholder="0.00"
              />
              <div className="mt-2">
                <button
                  type="button"
                  onClick={markFullyPaid}
                  className="rounded-full border border-black/10 px-3 py-1 text-xs hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                  title="Set total paid equal to estimate and mark status = paid"
                >
                  Mark fully paid
                </button>
              </div>
            </label>

            <label className="block">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-[#a3845b]" />
                Status
              </div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="input"
              >
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
          </div>

          {/* Totals strip */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/10 bg-white/60 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5">
            <span className="opacity-70">
              Estimate: <strong>{money(estimate, currency)}</strong>
            </span>
            <span
              className={[
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                balance > 0
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                  : balance < 0
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
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
              Balance: {money(balance, currency)}
            </span>
          </div>
          {balance < 0 && (
            <div className="mt-2 rounded-lg border border-amber-300/40 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-900/20 dark:text-amber-100">
              Overpaid by <strong>{money(Math.abs(balance), currency)}</strong>.
              Record a refund or keep as credit.
            </div>
          )}
          {/* Actions */}
          <div className="mt-4 flex items-center justify-end gap-2">
            {error ? (
              <div className="mr-auto rounded-md border border-red-500/30 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:border-red-400/20 dark:bg-red-900/20 dark:text-red-200">
                {error}
              </div>
            ) : null}
            {ok ? (
              <div className="mr-auto rounded-md border border-emerald-500/30 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-900/20 dark:text-emerald-200">
                {ok}
              </div>
            ) : null}
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-[#a3845b] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#b79266] disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
