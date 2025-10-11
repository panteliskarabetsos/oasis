// src/app/booking/[id]/payment/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Clock, Loader2, MapPin, Info } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function PaymentPage() {
  const { id } = useParams();
  const router = useRouter();
  const qs = useSearchParams();
  const cancelled = qs?.get("cancelled") === "1";

  const draftId = Number(id);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [experience, setExperience] = useState(null);
  const [slot, setSlot] = useState(null);
  const [counts, setCounts] = useState({ adults: 0, teens: 0, kids: 0 });
  const [unitPrices, setUnitPrices] = useState({ adult: 0, teen: 0, kid: 0 });

  useEffect(() => {
    if (!Number.isFinite(draftId) || draftId <= 0) {
      setError("Invalid booking id.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/bookings/drafts/${draftId}`, {
          cache: "no-store",
        });
        if (!res.ok)
          throw new Error(
            (await res.json().catch(() => ({})))?.error ||
              "Failed to load booking."
          );
        const d = await res.json();
        setExperience(d.experience || null);
        setSlot(d.slot || null);
        setCounts(d.counts || { adults: 0, teens: 0, kids: 0 });
        setUnitPrices(d.unitPrices || { adult: 0, teen: 0, kid: 0 });
      } catch (e) {
        setError(e.message || "Failed to load booking.");
      } finally {
        setLoading(false);
      }
    })();
  }, [draftId]);

  const when = useMemo(() => {
    if (!slot?.date) return null;
    const d =
      typeof slot.date === "string" ? parseISO(slot.date) : new Date(slot.date);
    return { dateLabel: format(d, "PPP"), timeLabel: format(d, "p") };
  }, [slot]);

  const breakdown = useMemo(() => {
    const A = Number(counts.adults || 0);
    const T = Number(counts.teens || 0);
    const K = Number(counts.kids || 0);
    const la = A * unitPrices.adult;
    const lt = T * unitPrices.teen;
    const lk = K * unitPrices.kid;
    const total = la + lt + lk;
    return {
      lines: [
        A > 0 && {
          label: `Adults × ${A}`,
          value: eur(unitPrices.adult),
          sum: eur(la),
        },
        T > 0 && {
          label: `Teens × ${T}`,
          value: eur(unitPrices.teen),
          sum: eur(lt),
        },
        K > 0 && {
          label: `Kids × ${K}`,
          value: eur(unitPrices.kid),
          sum: eur(lk),
        },
      ].filter(Boolean),
      total: eur(total),
    };
  }, [counts, unitPrices]);

  async function handlePay() {
    try {
      setSubmitting(true);
      const res = await fetch(`/api/bookings/drafts/${draftId}/checkout`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url)
        throw new Error(data?.error || "Could not start checkout.");
      window.location.href = data.url; // Stripe Checkout redirect
    } catch (e) {
      setError(e.message || "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f7f3ed] to-[#f4f1ec]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-24">
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#5a4a3f]">
          Secure payment
        </h1>
        {cancelled && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#f1d7d7] bg-[#fff6f6] px-3 py-2 text-xs text-[#7a4a4a] shadow-sm">
            <Info size={14} className="mt-0.5 text-[#b14545]" />
            <p>Payment cancelled. You can try again below.</p>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-16">
        {loading ? (
          <div className="mt-8 rounded-2xl border border-[#e8e5df] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-[#5a4a3f]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading booking…
            </div>
          </div>
        ) : error ? (
          <div className="mt-8 rounded-2xl border border-[#f1d7d7] bg-[#fff6f6] p-6 shadow-sm text-[#7a4a4a]">
            {error}
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-10">
            <section className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl border border-[#e8e5df] bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-[#5a4a3f] mb-3">
                  Booking summary
                </h3>
                <div className="space-y-2 text-sm text-[#5a4a3f]">
                  {experience?.name && (
                    <div className="font-medium">{experience.name}</div>
                  )}
                  <div className="flex items-center gap-3">
                    {experience?.location && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={14} className="text-[#8b6f47]" />
                        {experience.location}
                      </span>
                    )}
                    {when && (
                      <>
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays size={14} className="text-[#8b6f47]" />
                          {when.dateLabel}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock size={14} className="text-[#8b6f47]" />
                          {when.timeLabel}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 border border-[#e5e0d8] rounded-xl bg-[#faf7f2] px-6 py-4 shadow-inner">
                  <div className="space-y-1 text-sm text-[#5a4a3f]">
                    {breakdown.lines.map((ln, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between"
                      >
                        <span>
                          {ln.label} @ {ln.value}
                        </span>
                        <span className="font-semibold">{ln.sum}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 border-t border-[#e5e0d8] pt-3 flex items-center justify-between">
                    <span className="text-sm text-[#5a4a3f]">Total</span>
                    <span className="text-2xl font-bold text-[#8b6f47] tracking-wide">
                      {breakdown.total}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-6 lg:sticky lg:top-24">
              <div className="rounded-2xl border border-[#e8e5df] bg-[#fcf9f4] p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-[#5a4a3f]">
                  Pay with card
                </h3>
                <p className="text-xs text-[#7a6a58] mt-1">
                  You’ll be redirected to Stripe to complete your payment
                  securely.
                </p>

                <button
                  onClick={handlePay}
                  disabled={submitting}
                  className={`mt-6 w-full py-3 rounded-lg font-semibold text-lg transition-all flex items-center justify-center gap-2 shadow-md ${
                    submitting
                      ? "bg-gray-400 text-white"
                      : "bg-[#8b6f47] hover:bg-[#7a5f3a] text-white"
                  }`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Redirecting…
                    </>
                  ) : (
                    "Pay now"
                  )}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function eur(n) {
  return `€${(Number(n) || 0).toFixed(2)}`;
}
