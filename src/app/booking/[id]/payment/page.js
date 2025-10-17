// src/app/booking/[id]/payment/page.js
"use client";

import {
  CalendarDays,
  Clock,
  Loader2,
  MapPin,
  Info,
  Lock,
  ShieldCheck,
  CreditCard,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  X,
  Tag,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
  const [attendees, setAttendees] = useState([]);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [promo, setPromo] = useState(null); // { code, discountType, discountValue, currency, endsAt? }

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

        const data = await res.json();
        const d = data?.draft || data; // normalize

        // If this draft is already paid/converted, jump to confirmation.
        const st = String(d?.status || "").toLowerCase();
        if (st === "paid" || st === "converted") {
          const sid = d?.stripeSessionId
            ? `?session_id=${encodeURIComponent(d.stripeSessionId)}`
            : "";
          router.replace(`/booking/${draftId}/confirmation${sid}`);
          return;
        }

        setExperience(data?.experience || d?.experience || null);
        setSlot(data?.slot || d?.slot || null);

        const c = d?.counts || {};
        setCounts({
          adults: Number(c.adults || 0),
          teens: Number(c.teens || 0), // stays zero for your current schema
          kids: Number(c.kids || 0),
        });

        // Prefer unitPrices; fall back to unitPriceAdult/Kid snapshot
        const up = d?.unitPrices || {};
        const unitAdult = Number(
          up.adult ?? d?.unitPriceAdult ?? d?.unit_price_adult ?? 0
        );
        const unitKid = Number(
          up.kid ??
            d?.unitPriceKid ??
            d?.unit_price_kid ??
            unitAdult /* fallback same as adult */
        );
        setUnitPrices({
          adult: unitAdult,
          teen: unitAdult, // no teens in schema; keep compatibility if UI shows it
          kid: unitKid,
        });

        setAttendees(extractAttendees(d));
        setError("");
      } catch (e) {
        setError(e.message || "Failed to load booking.");
      } finally {
        setLoading(false);
      }
    })();
  }, [draftId, router]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setIsDetailsOpen(false);
    }
    if (isDetailsOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDetailsOpen]);
  function normalizePromo(p, fallbackCode) {
    return {
      code: (p?.code || fallbackCode || "").toString().toUpperCase(),
      discountType: String(
        p?.discountType || p?.type || "percent"
      ).toLowerCase(), // "percent" | "fixed"
      discountValue: Number(p?.discountValue ?? p?.value ?? 0),
      currency: p?.currency || "EUR",
      endsAt: p?.endsAt ? new Date(p.endsAt) : null,
    };
  }

  async function validateAndApply(code) {
    const c = code.trim();
    if (!c) {
      setPromoError("Enter a code.");
      return;
    }
    setPromoLoading(true);
    setPromoError("");
    try {
      const res = await fetch(
        `/api/promotions/validate?code=${encodeURIComponent(
          c
        )}&draftId=${draftId}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const msg =
          (await res.json().catch(() => ({})))?.error || "Invalid code.";
        throw new Error(msg);
      }
      const data = await res.json();
      const next = normalizePromo(data, c);
      if (next.endsAt && next.endsAt.getTime() < Date.now()) {
        throw new Error("This code has expired.");
      }
      setPromo(next);
      setPromoOpen(false);
    } catch (e) {
      setPromo(null);
      setPromoError(e.message || "Invalid code.");
    } finally {
      setPromoLoading(false);
    }
  }

  function applyPromo() {
    validateAndApply(promoInput);
  }

  function removePromo() {
    setPromo(null);
    setPromoError("");
    setPromoOpen(true);
    setPromoInput("");
  }

  // Optional: auto-apply from ?promo=CODE
  useEffect(() => {
    const qp = qs?.get("promo");
    if (qp && !promo && !promoLoading) {
      setPromoOpen(true);
      setPromoInput(qp);
      validateAndApply(qp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs, promoLoading]);
  const when = useMemo(() => {
    if (!slot?.date) return null;
    const d =
      typeof slot.date === "string" ? parseISO(slot.date) : new Date(slot.date);
    return { dateLabel: format(d, "PPP"), timeLabel: format(d, "p") };
  }, [slot]);

  const breakdown = useMemo(() => {
    const A = Number(counts.adults || 0);
    const K = Number(counts.kids || 0);

    // cents helpers
    const toC = (x) => Math.round((Number(x) || 0) * 100);
    const fromC = (c) => c / 100;

    const laC = toC(unitPrices.adult) * A; // adults line in cents
    const lkC = toC(unitPrices.kid) * K; // kids line in cents
    const subtotalC = laC + lkC;

    // promo discount in cents (mirror server logic: floor for percent)
    let discountC = 0;
    if (promo && subtotalC > 0) {
      if (String(promo.discountType).toLowerCase() === "percent") {
        const pct = Math.min(
          Math.max(Number(promo.discountValue || 0), 0),
          100
        );
        discountC = Math.floor((subtotalC * pct) / 100);
      } else {
        const fixedC = Math.max(
          Math.round(Number(promo.discountValue || 0) * 100),
          0
        );
        discountC = Math.min(fixedC, subtotalC);
      }
    }

    const finalC = Math.max(0, subtotalC - discountC);

    const eur = (n) =>
      new Intl.NumberFormat("el-GR", {
        style: "currency",
        currency: "EUR",
      }).format(n);

    const lines = [
      A > 0 && {
        label: `Adults × ${A}`,
        value: eur(unitPrices.adult),
        sum: eur(fromC(laC)),
      },
      K > 0 && {
        label: `Kids × ${K}`,
        value: eur(unitPrices.kid),
        sum: eur(fromC(lkC)),
      },
    ].filter(Boolean);

    return {
      lines,
      subtotalRaw: fromC(subtotalC),
      subtotal: eur(fromC(subtotalC)),
      discountRaw: fromC(discountC),
      discount: discountC > 0 ? `- ${eur(fromC(discountC))}` : null,
      finalTotalRaw: fromC(finalC),
      finalTotal: eur(fromC(finalC)),
    };
  }, [counts, unitPrices, promo]);

  const attendeesRows = useMemo(() => {
    if (Array.isArray(attendees) && attendees.length > 0) {
      return attendees.map((a, i) => ({
        idx: i + 1,
        name:
          a?.name ||
          [a?.firstName, a?.lastName].filter(Boolean).join(" ") ||
          `Attendee ${i + 1}`,
        type: a?.type || a?.category || "—",
        notes: a?.notes || a?.allergies || "",
      }));
    }
    const rows = [];
    let idx = 1;
    const pushN = (n, label) => {
      for (let i = 0; i < Number(n || 0); i++) {
        rows.push({
          idx,
          name: `Attendee ${idx}`,
          type: label,
          notes: "",
        });
        idx++;
      }
    };
    pushN(counts?.adults, "Adult");
    pushN(counts?.teens, "Teen");
    pushN(counts?.kids, "Kid");
    return rows;
  }, [attendees, counts]);

  async function handlePay() {
    try {
      setSubmitting(true);
      setError("");

      const res = await fetch(`/api/bookings/drafts/${draftId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promoCode: promo?.code ?? null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Could not start checkout.");
      }

      // Redirect to Stripe Checkout
      window.location.assign(data.url);
    } catch (e) {
      setError(e.message || "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f7f3ed] to-[#f4f1ec]">
      {/* Top bar / breadcrumbs */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-6 sm:pt-10">
        <div className="flex items-center gap-3 text-sm text-[#7a6a58]">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 border border-[#e8e5df] bg-white/80 backdrop-blur hover:bg-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="ml-auto hidden sm:flex items-center gap-2 text-xs">
            <Lock className="h-4 w-4 text-[#8b6f47]" />
            <span>Secure checkout</span>
          </div>
        </div>

        <div className="mt-6 sm:mt-10 flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#5a4a3f] flex items-center gap-3">
            <CreditCard className="h-7 w-7 text-[#8b6f47]" />
            Secure payment
          </h1>
          {/* Step indicator */}
          <div
            className="hidden sm:flex items-center gap-2 text-xs text-[#7a6a58]"
            aria-label="progress"
          >
            <Step done>Tickets</Step>
            <span className="opacity-50">—</span>
            <Step done>Details</Step>
            <span className="opacity-50">—</span>
            <Step current>Payment</Step>
          </div>
        </div>

        {cancelled && (
          <div
            className="mt-4 flex items-start gap-2 rounded-xl border border-[#f1d7d7] bg-[#fff6f6] px-3 py-2 text-xs text-[#7a4a4a] shadow-sm"
            role="alert"
            aria-live="polite"
          >
            <AlertCircle size={14} className="mt-0.5 text-[#b14545]" />
            <p>Payment cancelled. You can try again below.</p>
          </div>
        )}

        {error && (
          <div
            className="mt-4 flex items-start gap-2 rounded-xl border border-[#f1d7d7] bg-[#fff6f6] px-3 py-2 text-xs text-[#7a4a4a] shadow-sm"
            role="alert"
            aria-live="assertive"
          >
            <AlertCircle size={14} className="mt-0.5 text-[#b14545]" />
            <p className="font-medium">{error}</p>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-20 pt-6">
        {loading ? (
          <Skeleton />
        ) : (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Left: booking summary */}
            <section className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl border border-[#e8e5df] bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-[#5a4a3f] mb-3">
                      Booking summary
                    </h3>
                    <div className="space-y-2 text-sm text-[#5a4a3f]">
                      {experience?.name && (
                        <div className="font-medium text-base">
                          {experience.name}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        {experience?.location && (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin size={14} className="text-[#8b6f47]" />
                            {experience.location}
                          </span>
                        )}
                        {when && (
                          <>
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarDays
                                size={14}
                                className="text-[#8b6f47]"
                              />
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
                  </div>

                  {/* View details trigger */}
                  <button
                    onClick={() => setIsDetailsOpen(true)}
                    type="button"
                    className="text-xs inline-flex items-center gap-1 rounded-full border border-[#e8e5df] px-3 py-1.5 text-[#7a6a58] hover:bg-[#faf7f2] transition"
                  >
                    View details
                  </button>
                </div>

                <div className="mt-5 border border-[#e5e0d8] rounded-xl bg-[#faf7f2] px-6 py-4 shadow-inner">
                  {breakdown.lines.length > 0 ? (
                    <div className="space-y-2 text-sm text-[#5a4a3f]">
                      {breakdown.lines.map((ln, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between"
                        >
                          <span>
                            {ln.label}{" "}
                            <span className="opacity-70">@ {ln.value}</span>
                          </span>
                          <span className="font-semibold">{ln.sum}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-[#7a6a58]">
                      No tickets selected.
                    </div>
                  )}

                  <div className="mt-4 border-t border-[#e5e0d8] pt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#5a4a3f]">Subtotal</span>
                      <span className="text-sm font-medium text-[#5a4a3f]">
                        {breakdown.subtotal}
                      </span>
                    </div>
                    {promo && breakdown.discountRaw > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#5a4a3f]">
                          Promo{" "}
                          <span className="font-mono">({promo.code})</span>
                        </span>
                        <span className="text-sm font-semibold text-[#b14545]">
                          {breakdown.discount}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-sm text-[#5a4a3f]">
                        {promo ? "Total after discount" : "Total"}
                      </span>
                      <span className="text-2xl font-bold text-[#8b6f47] tracking-wide">
                        {breakdown.finalTotal}
                      </span>
                    </div>
                  </div>

                  <p className="mt-2 text-[11px] text-[#7a6a58]">
                    All taxes included. You’ll receive a confirmation email
                    after successful payment.
                  </p>
                </div>
              </div>

              {/* Trust / help card */}
              <div className="rounded-2xl border border-[#e8e5df] bg-[#fcf9f4] p-6 shadow-sm">
                <div className="flex flex-wrap items-center gap-4 text-sm text-[#5a4a3f]">
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#8b6f47]" /> PCI-DSS
                    compliant via Stripe
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Lock className="h-4 w-4 text-[#8b6f47]" /> 256-bit SSL
                    encryption
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#8b6f47]" /> Free
                    reschedule policy*
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-[#7a6a58]">
                  *In selected experiences.
                </p>
              </div>
            </section>

            {/* Right: payment action */}
            <section className="space-y-6 lg:sticky lg:top-28 self-start">
              <div className="rounded-2xl border border-[#e8e5df] bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-[#5a4a3f] flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-[#8b6f47]" /> Pay with
                  card
                </h3>
                <p className="text-xs text-[#7a6a58] mt-1">
                  You’ll be redirected to Stripe to complete your payment
                  securely.
                </p>

                <button
                  onClick={handlePay}
                  disabled={submitting || breakdown.finalTotalRaw <= 0}
                  className={`mt-6 w-full py-3 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2 shadow-md focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40 focus:ring-offset-2
    ${
      submitting || breakdown.finalTotalRaw < 0
        ? "bg-gray-300 text-white cursor-not-allowed"
        : "bg-gradient-to-b from-[#8b6f47] to-[#7a5f3a] text-white hover:from-[#7f643f] hover:to-[#6a5233]"
    }
  `}
                  aria-busy={submitting}
                  aria-disabled={submitting || breakdown.finalTotalRaw < 0}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Redirecting…
                    </>
                  ) : (
                    <>
                      Pay now{" "}
                      {breakdown.finalTotalRaw >= 0 && (
                        <span className="text-base opacity-80">
                          · {breakdown.finalTotal}
                        </span>
                      )}
                    </>
                  )}
                </button>

                {/* Promo code */}
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => setPromoOpen((v) => !v)}
                    className="w-full text-left inline-flex items-center justify-between rounded-xl border border-[#e8e5df] bg-[#fcf9f4] px-3 py-2 text-sm text-[#5a4a3f] hover:bg-[#faf7f2] transition"
                    aria-expanded={promoOpen}
                    aria-controls="promo-panel"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Tag className="h-4 w-4 text-[#8b6f47]" />
                      Do you have a promo code?
                    </span>
                    <span className="text-xs text-[#7a6a58]">
                      {promo
                        ? `Applied: ${promo.code}`
                        : promoOpen
                        ? "Hide"
                        : "Apply"}
                    </span>
                  </button>

                  {promoOpen && (
                    <div id="promo-panel" className="mt-3">
                      <div className="flex items-stretch gap-2">
                        <input
                          value={promoInput}
                          onChange={(e) => setPromoInput(e.target.value)}
                          inputMode="text"
                          placeholder="Enter code"
                          className="flex-1 rounded-lg border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#5a4a3f] placeholder:text-[#b1a595] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                          aria-label="Promo code"
                        />
                        <button
                          onClick={applyPromo}
                          disabled={promoLoading || !promoInput.trim()}
                          className={`rounded-lg px-4 py-2 text-sm font-semibold transition
            ${
              promoLoading || !promoInput.trim()
                ? "bg-gray-300 text-white cursor-not-allowed"
                : "bg-[#8b6f47] text-white hover:bg-[#7a5f3a]"
            }`}
                        >
                          {promoLoading ? "Checking…" : "Apply"}
                        </button>
                      </div>
                      {promoError && (
                        <p className="mt-2 text-[11px] text-[#b14545]">
                          {promoError}
                        </p>
                      )}
                      {promo && (
                        <div className="mt-2 text-xs text-[#5a4a3f]">
                          <span className="font-medium">Applied</span>:{" "}
                          <span className="font-mono">{promo.code}</span> —{" "}
                          {promo.discountType === "percent"
                            ? `${promo.discountValue}% off`
                            : `${eur(promo.discountValue)} off`}
                          <button
                            type="button"
                            onClick={removePromo}
                            className="ml-2 rounded px-2 py-0.5 border border-[#e8e5df] text-[#7a6a58] hover:bg-[#f6f2ea]"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 text-[11px] text-[#7a6a58]">
                  <div className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5" />
                    <span>
                      Payments handled by Stripe. We never store your card
                      details.
                    </span>
                  </div>
                  <div className="mt-2">Accepted: Visa · Mastercard · Amex</div>
                </div>

                <div className="mt-6 flex items-center justify-between text-xs text-[#7a6a58]">
                  <a href="/contact" className="hover:text-[#5a4a3f]">
                    Need help?
                  </a>
                </div>
              </div>

              {/* Small info note */}
              <div className="rounded-2xl border border-[#e8e5df] bg-[#fcf9f4] p-4 shadow-sm text-xs text-[#7a6a58]">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-[#8b6f47] mt-0.5" />
                  <p>
                    If you close this window during checkout, you can return to
                    this page to try again. Your reservation is held for a short
                    time.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      {isDetailsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="details-title"
          className="fixed inset-0 z-50"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsDetailsOpen(false)}
          />
          <div className="relative mx-auto max-w-2xl mt-24 px-4">
            <div className="relative rounded-2xl border border-[#e8e5df] bg-white shadow-lg">
              <button
                onClick={() => setIsDetailsOpen(false)}
                className="absolute top-3 right-3 inline-flex items-center justify-center rounded-full p-1.5 hover:bg-[#f6f2ea]"
                aria-label="Close"
              >
                <X className="h-5 w-5 text-[#7a6a58]" />
              </button>
              <div className="p-6">
                <h2
                  id="details-title"
                  className="text-lg font-semibold text-[#5a4a3f]"
                >
                  Booking details
                </h2>
                <div className="mt-1 text-sm text-[#7a6a58]">
                  {experience?.name && (
                    <div className="font-medium text-[#5a4a3f]">
                      {experience.name}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1">
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

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="text-[#7a6a58] border-b border-[#eee9df]">
                        <th className="py-2 pr-2">#</th>
                        <th className="py-2 pr-2">Name</th>
                        <th className="py-2 pr-2">Type</th>
                        <th className="py-2">Notes - Allergies</th>
                      </tr>
                    </thead>
                    <tbody className="text-[#5a4a3f]">
                      {attendeesRows.length === 0 ? (
                        <tr>
                          <td className="py-3 text-[#7a6a58]" colSpan={4}>
                            No attendee details available.
                          </td>
                        </tr>
                      ) : (
                        attendeesRows.map((row) => (
                          <tr
                            key={row.idx}
                            className="border-b last:border-0 border-[#f0ebe2]"
                          >
                            <td className="py-2 pr-2">{row.idx}</td>
                            <td className="py-2 pr-2">{row.name}</td>
                            <td className="py-2 pr-2">{row.type}</td>
                            <td className="py-2">
                              {row.notes || (
                                <span className="opacity-60">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="p-4 border-t border-[#eee9df] bg-[#fcf9f4] rounded-b-2xl flex justify-end">
                <button
                  onClick={() => setIsDetailsOpen(false)}
                  className="rounded-lg border border-[#e8e5df] px-4 py-2 text-sm text-[#5a4a3f] hover:bg-[#f6f2ea]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function eur(n) {
  return `€${(Number(n) || 0).toFixed(2)}`;
}

function extractAttendees(d) {
  const join = (a, b) => [a, b].filter(Boolean).join(" ");
  const readName = (o = {}) =>
    (
      o.name ||
      o.full_name ||
      o.fullName ||
      join(o.first_name, o.last_name) ||
      join(o.firstName, o.lastName) ||
      o.holderName ||
      o.holder ||
      o.displayName ||
      o.customer_name ||
      ""
    ).trim();
  const readType = (o = {}) =>
    o.type || o.category || o.ticketType || o.kind || o.role || "";
  const candidates = [
    d?.attendees,
    d?.guests,
    d?.participants,
    d?.tickets,
    d?.booking?.attendees,
    d?.slot?.attendees,
  ].filter(Array.isArray);

  for (const arr of candidates) {
    if (arr?.length) {
      if (typeof arr[0] === "string") {
        return arr.map((name) => ({
          name: String(name),
          type: "",
          notes: "",
        }));
      }
      return arr
        .map((o) => ({
          name: readName(o),
          type: readType(o),
          notes: o?.notes || o?.note || o?.allergies || "",
        }))
        .filter((a) => a.name || a.type || a.notes);
    }
  }

  const lead = d?.primary_contact || d?.customer || d?.contact || d?.buyer;
  if (lead && readName(lead)) {
    return [{ name: readName(lead), type: "Lead", notes: "" }];
  }

  return [];
}

function Step({ children, done, current }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border " +
        (current
          ? "border-[#8b6f47] text-[#5a4a3f] bg-[#faf7f2]"
          : done
          ? "border-[#e8e5df] text-[#7a6a58] bg-white"
          : "border-[#e8e5df] text-[#b1a595] bg-white")
      }
    >
      {done ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-[#8b6f47]" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-[#d6cfc4]" />
      )}
      <span>{children}</span>
    </span>
  );
}

function Skeleton() {
  return (
    <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-10" aria-hidden>
      <div className="lg:col-span-2 space-y-6">
        <div className="rounded-2xl border border-[#e8e5df] bg-white p-6 shadow-sm">
          <div className="h-5 w-36 bg-[#eee9df] rounded animate-pulse" />
          <div className="mt-4 space-y-2">
            <div className="h-4 w-64 bg-[#eee9df] rounded animate-pulse" />
            <div className="h-4 w-48 bg-[#eee9df] rounded animate-pulse" />
          </div>
          <div className="mt-6 space-y-2">
            <div className="h-10 w-full bg-[#f2ede4] rounded-xl animate-pulse" />
            <div className="h-10 w-full bg-[#f2ede4] rounded-xl animate-pulse" />
            <div className="h-10 w-full bg-[#f2ede4] rounded-xl animate-pulse" />
          </div>
        </div>
        <div className="rounded-2xl border border-[#e8e5df] bg-[#fcf9f4] p-6 shadow-sm">
          <div className="h-4 w-3/4 bg-[#eee9df] rounded animate-pulse" />
        </div>
      </div>

      <div className="space-y-6 lg:sticky lg:top-28">
        <div className="rounded-2xl border border-[#e8e5df] bg-white p-6 shadow-sm">
          <div className="h-5 w-40 bg-[#eee9df] rounded animate-pulse" />
          <div className="mt-4 h-12 w-full bg-[#f2ede4] rounded-xl animate-pulse" />
          <div className="mt-3 h-3 w-3/4 bg-[#eee9df] rounded animate-pulse" />
        </div>
        <div className="rounded-2xl border border-[#e8e5df] bg-[#fcf9f4] p-4 shadow-sm">
          <div className="h-3 w-2/3 bg-[#eee9df] rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
