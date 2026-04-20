// src/app/booking/[id]/payment/page.js
"use client";

import {
  CalendarDays,
  Clock,
  Loader2,
  MapPin,
  Lock,
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  X,
  Tag,
  Receipt,
  Users,
  Info,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  LinkAuthenticationElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";

// Stripe init
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
);

// Structured policy map for clear timeline UI
const POLICY_MAP = {
  flexible: {
    title: "Flexible",
    points: [
      {
        label: "100% Refund",
        desc: "Up to 48 hours before the experience starts.",
      },
      { label: "No Refund", desc: "Within 48 hours of the experience." },
    ],
  },
  moderate: {
    title: "Moderate",
    points: [
      {
        label: "100% Refund",
        desc: "Up to 7 days before the experience starts.",
      },
      { label: "50% Refund", desc: "Between 7 days and 48 hours before." },
      { label: "No Refund", desc: "Within 48 hours of the experience." },
    ],
  },
  strict: {
    title: "Strict (Oasis Bespoke)",
    points: [
      {
        label: "100% Refund",
        desc: "More than 14 days before the experience.",
      },
      { label: "50% Refund", desc: "Between 14 and 7 days before." },
      { label: "No Refund", desc: "Within 7 days of the experience." },
    ],
  },
};

export default function PaymentPage() {
  const { id } = useParams();
  const router = useRouter();
  const qs = useSearchParams();
  const cancelled = qs?.get("cancelled") === "1";

  // 🔑 SECURITY: Grab token from the URL
  const token = qs?.get("token") || "";

  const draftId = Number(id);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Draft expiry
  const [expiresAt, setExpiresAt] = useState(qs?.get("expiresAt") || null);
  const {
    remainingMs,
    formatted: timeLeft,
    expired,
    progress: holdProgress,
    hasMounted,
  } = useDraftCountdown(expiresAt);
  const isUrgent = remainingMs > 0 && remainingMs < 5 * 60 * 1000; // Less than 5 mins

  const [experience, setExperience] = useState(null);
  const [slot, setSlot] = useState(null);
  const [counts, setCounts] = useState({ adults: 0, teens: 0, kids: 0 });
  const [unitPrices, setUnitPrices] = useState({ adult: 0, teen: 0, kid: 0 });
  const [attendees, setAttendees] = useState([]);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Promo state
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [promo, setPromo] = useState(null);

  const [clientSecret, setClientSecret] = useState("");
  const [piInfo, setPiInfo] = useState({ amountCents: 0, currency: "eur" });

  const policy = useMemo(() => {
    const key = experience?.cancellationPolicy || "strict";
    return POLICY_MAP[key] || POLICY_MAP.strict;
  }, [experience]);

  const sanitizePromo = (raw) =>
    raw
      .toUpperCase()
      .replace(/[\s_]/g, "-")
      .replace(/[^A-Z0-9-]/g, "");

  useEffect(() => {
    if (!Number.isFinite(draftId) || draftId <= 0) {
      setError("Invalid booking id.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);

        try {
          // 🔑 SECURITY: Pass token to the extend route
          await fetch(`/api/bookings/drafts/${draftId}/extend?token=${token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ minutes: 10 }),
          });
        } catch (extendErr) {
          console.warn("Could not extend booking hold:", extendErr);
        }

        // 🔑 SECURITY: Pass token to the GET route
        const res = await fetch(
          `/api/bookings/drafts/${draftId}?token=${token}`,
          {
            cache: "no-store",
          },
        );
        if (!res.ok)
          throw new Error(
            (await res.json().catch(() => ({})))?.error ||
              "Failed to load booking.",
          );

        let data = {};
        try {
          data = await res.json();
        } catch {}
        const d = data?.draft || data;

        if (d?.expiresAt) setExpiresAt(d.expiresAt);

        const st = String(d?.status || "").toLowerCase();
        if (st === "paid" || st === "converted") {
          const sid = d?.stripeSessionId
            ? `?session_id=${encodeURIComponent(d.stripeSessionId)}`
            : "";
          router.replace(
            `/booking/${draftId}/confirmation${sid}&token=${token}`,
          );
          return;
        }

        setExperience(data?.experience || d?.experience || null);
        setSlot(data?.slot || d?.slot || null);

        const c = d?.counts || {};
        setCounts({
          adults: Number(c.adults || 0),
          teens: Number(c.teens || 0),
          kids: Number(c.kids || 0),
        });

        const up = d?.unitPrices || {};
        const unitAdult = Number(
          up.adult ?? d?.unitPriceAdult ?? d?.unit_price_adult ?? 0,
        );
        const unitKid = Number(
          up.kid ?? d?.unitPriceKid ?? d?.unit_price_kid ?? unitAdult,
        );
        setUnitPrices({ adult: unitAdult, teen: unitAdult, kid: unitKid });

        setAttendees(extractAttendees(d));
        setError("");
      } catch (e) {
        setError(e.message || "Failed to load booking.");
      } finally {
        setLoading(false);
      }
    })();
  }, [draftId, router, token]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setIsDetailsOpen(false);
    }
    if (isDetailsOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDetailsOpen]);

  useEffect(() => {
    if (expired) {
      setError(
        "Your reservation hold has expired. Please go back and choose a new time.",
      );
    }
  }, [expired]);

  function normalizePromo(p, fallbackCode) {
    return {
      code: (p?.code || fallbackCode || "").toString().toUpperCase(),
      discountType: String(
        p?.discountType || p?.type || "percent",
      ).toLowerCase(),
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
        `/api/promotions/validate?code=${encodeURIComponent(c)}&draftId=${draftId}`,
        { cache: "no-store" },
      );
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error || "Invalid code.",
        );

      const data = await res.json();
      const next = normalizePromo(data, c);
      if (next.endsAt && next.endsAt.getTime() < Date.now())
        throw new Error("This code has expired.");

      setPromo(next);
      setPromoOpen(false);
      toast.success("Promo code applied!");
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
    toast.success("Promo code removed.");
  }

  useEffect(() => {
    const qp = qs?.get("promo");
    if (qp && !promo && !promoLoading) {
      setPromoOpen(true);
      setPromoInput(qp);
      validateAndApply(qp);
    }
  }, [qs, promoLoading]);

  useEffect(() => {
    (async () => {
      if (!Number.isFinite(draftId) || draftId <= 0) return;
      try {
        setClientSecret("");
        // 🔑 SECURITY: Pass token to the checkout route
        const res = await fetch(
          `/api/bookings/drafts/${draftId}/checkout?token=${token}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: "elements",
              promoCode: promo?.code ?? null,
            }),
          },
        );
        const data = await res.json();
        if (!res.ok || !data?.clientSecret)
          throw new Error(data?.error || "Failed to initialize payment.");
        setClientSecret(data.clientSecret);
        setPiInfo({
          amountCents: data.amountCents || 0,
          currency: (data.currency || "eur").toLowerCase(),
        });
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [draftId, promo?.code, token]);

  const when = useMemo(() => {
    if (!slot?.date) return null;
    const d =
      typeof slot.date === "string" ? parseISO(slot.date) : new Date(slot.date);
    return { dateLabel: format(d, "PPP"), timeLabel: format(d, "p") };
  }, [slot]);

  const breakdown = useMemo(() => {
    const A = Number(counts.adults || 0);
    const K = Number(counts.kids || 0);
    const toC = (x) => Math.round((Number(x) || 0) * 100);
    const fromC = (c) => c / 100;

    const laC = toC(unitPrices.adult) * A;
    const lkC = toC(unitPrices.kid) * K;
    const subtotalC = laC + lkC;

    let discountC = 0;
    if (promo && subtotalC > 0) {
      if (String(promo.discountType).toLowerCase() === "percent") {
        const pct = Math.min(
          Math.max(Number(promo.discountValue || 0), 0),
          100,
        );
        discountC = Math.floor((subtotalC * pct) / 100);
      } else {
        const fixedC = Math.max(
          Math.round(Number(promo.discountValue || 0) * 100),
          0,
        );
        discountC = Math.min(fixedC, subtotalC);
      }
    }

    const finalC = Math.max(0, subtotalC - discountC);
    const eurFmt = (n) =>
      new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: "EUR",
      }).format(n);

    const lines = [
      A > 0 && {
        label: `Adults × ${A}`,
        value: eurFmt(unitPrices.adult),
        sum: eurFmt(fromC(laC)),
      },
      K > 0 && {
        label: `Kids × ${K}`,
        value: eurFmt(unitPrices.kid),
        sum: eurFmt(fromC(lkC)),
      },
    ].filter(Boolean);

    const VAT_RATE = 0.24;
    const finalTotalRaw = fromC(finalC);

    let vatRaw = 0;
    let netRaw = 0;
    if (finalTotalRaw > 0) {
      vatRaw = finalTotalRaw - finalTotalRaw / (1 + VAT_RATE);
      netRaw = finalTotalRaw - vatRaw;
    }

    return {
      lines,
      subtotalRaw: fromC(subtotalC),
      subtotal: eurFmt(fromC(subtotalC)),
      discountRaw: fromC(discountC),
      discount: discountC > 0 ? `- ${eurFmt(fromC(discountC))}` : null,
      finalTotalRaw,
      finalTotal: eurFmt(finalTotalRaw),
      vatRaw,
      vat: vatRaw > 0 ? eurFmt(vatRaw) : null,
      netRaw,
      net: netRaw > 0 ? eurFmt(netRaw) : null,
    };
  }, [counts, unitPrices, promo]);

  const attendeesRows = useMemo(() => {
    if (Array.isArray(attendees) && attendees.length > 0) {
      return attendees.map((a, i) => ({
        idx: i + 1,
        name:
          a?.name ||
          [a?.firstName, a?.lastName].filter(Boolean).join(" ") ||
          `Guest ${i + 1}`,
        type: a?.type || a?.category || "—",
        notes: a?.notes || a?.allergies || "",
      }));
    }
    const rows = [];
    let idx = 1;
    const pushN = (n, label) => {
      for (let i = 0; i < Number(n || 0); i++) {
        rows.push({ idx, name: `Guest ${idx}`, type: label, notes: "" });
        idx++;
      }
    };
    pushN(counts?.adults, "Adult");
    pushN(counts?.teens, "Teen");
    pushN(counts?.kids, "Kid");
    return rows;
  }, [attendees, counts]);

  const amountLabel = useMemo(() => {
    const amount = (piInfo.amountCents || 0) / 100;
    const currency = (piInfo.currency || "eur").toUpperCase();
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency,
    }).format(amount);
  }, [piInfo]);

  return (
    <main className="min-h-screen bg-[#f4f1ec] font-sans pb-32 sm:pb-24 selection:bg-[#8b6f47] selection:text-white">
      {/* Top Nav (Glassmorphism) */}
      <div className="bg-[#f4f1ec]/80 backdrop-blur-xl border-b border-[#e2d7c7] sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="group flex items-center gap-2 pr-4 pl-2 py-1.5 rounded-full border border-[#d3c2aa] bg-white/60 hover:bg-white text-[#5a4a3f] transition-all duration-300 shadow-sm"
            >
              <div className="bg-[#f4ede4] text-[#8b6f47] rounded-full p-1 group-hover:-translate-x-1 transition-transform">
                <ArrowLeft size={14} />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest">
                Back
              </span>
            </button>
          </div>
          <Stepper currentStep={3} />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-8 pt-8 md:pt-12">
        {/* Urgency / Status Banners */}
        <div className="max-w-4xl mx-auto lg:max-w-none">
          <AnimatePresence mode="wait">
            {hasMounted && expiresAt && !expired && !cancelled && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className={`mb-8 rounded-2xl border px-6 py-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] overflow-hidden relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isUrgent
                    ? "bg-[#fffafa] border-[#f2dada]"
                    : "bg-white border-[#e2d7c7]"
                }`}
              >
                <div className="absolute bottom-0 left-0 h-1 bg-[#f4ede4] w-full">
                  <div
                    className={`h-full transition-[width] duration-1000 ease-linear ${isUrgent ? "bg-[#b14545]" : "bg-[#8b6f47]"}`}
                    style={{ width: `${holdProgress * 100}%` }}
                  />
                </div>
                <div
                  className={`flex items-center gap-3 ${isUrgent ? "text-[#9a3b3b]" : "text-[#5a4a3f]"}`}
                >
                  {isUrgent ? (
                    <AlertCircle className="h-5 w-5 shrink-0" />
                  ) : (
                    <Clock className="h-5 w-5 text-[#8b6f47] shrink-0" />
                  )}
                  <span className="text-sm font-medium leading-tight">
                    {isUrgent
                      ? "Hurry! Your reservation hold is about to expire."
                      : "We're holding your seats. Please complete payment to confirm."}
                  </span>
                </div>
                <div
                  className={`text-xl font-serif font-bold tracking-tight shrink-0 ${isUrgent ? "text-[#9a3b3b] animate-pulse" : "text-[#8b6f47]"}`}
                >
                  {timeLeft}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {cancelled && (
            <div className="mb-8 rounded-2xl border border-[#f2dada] bg-[#fffafa] px-6 py-4 shadow-sm flex items-center gap-3 text-[#9a3b3b]">
              <AlertCircle size={20} className="text-[#b14545] shrink-0" />
              <span className="text-sm font-medium">
                Payment was cancelled. You can try again below.
              </span>
            </div>
          )}

          {error && (
            <div className="mb-8 rounded-2xl border border-[#f2dada] bg-[#fffafa] px-6 py-4 shadow-sm flex items-center gap-3 text-[#9a3b3b]">
              <AlertCircle size={20} className="text-[#b14545] shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}
        </div>

        {loading ? (
          <Skeleton />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            {/* Left Column: Summary & Policy (7 cols) */}
            <section className="lg:col-span-7 space-y-8 order-2 lg:order-1">
              {/* Booking Summary Card */}
              <div className="rounded-[2rem] border border-[#e2d7c7] bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                <div className="px-8 py-6 border-b border-[#e2d7c7] bg-[#fcfbf9] flex items-center justify-between">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8b7a6b] flex items-center gap-2">
                    <Receipt size={16} className="text-[#8b6f47]" /> Booking
                    Summary
                  </h3>
                  <button
                    onClick={() => setIsDetailsOpen(true)}
                    className="text-[10px] font-bold uppercase tracking-wider text-[#8b6f47] bg-[#f4ede4] px-3 py-1.5 rounded-full hover:bg-[#8b6f47] hover:text-white transition-colors"
                  >
                    View Guests
                  </button>
                </div>

                <div className="p-8">
                  <h2 className="text-3xl font-serif text-[#3a2f28] leading-tight mb-6">
                    {experience?.name}
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-8 border-b border-[#e2d7c7]">
                    {when && (
                      <div className="flex items-start gap-3">
                        <CalendarDays
                          size={18}
                          className="text-[#8b6f47] shrink-0 mt-0.5"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-[#3a2f28]">
                            {when.dateLabel}
                          </span>
                          <span className="text-xs text-[#6b625a]">
                            at {when.timeLabel}
                          </span>
                        </div>
                      </div>
                    )}
                    {experience?.location && (
                      <div className="flex items-start gap-3">
                        <MapPin
                          size={18}
                          className="text-[#8b6f47] shrink-0 mt-0.5"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-[#3a2f28]">
                            Location
                          </span>
                          <span className="text-xs text-[#6b625a]">
                            {experience.location}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3 sm:col-span-2">
                      <Users
                        size={18}
                        className="text-[#8b6f47] shrink-0 mt-0.5"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-[#3a2f28]">
                          Party Size
                        </span>
                        <span className="text-xs text-[#6b625a]">
                          {counts.adults} Adults{" "}
                          {counts.kids > 0 && `• ${counts.kids} Children`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ledger */}
                  <div className="pt-8 space-y-4 text-sm text-[#5a4a3f]">
                    {breakdown.lines.length > 0 ? (
                      breakdown.lines.map((ln, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between"
                        >
                          <span className="text-[#6b625a] font-medium">
                            {ln.label}{" "}
                            <span className="text-[#a7988a] text-xs ml-1">
                              (@ {ln.value})
                            </span>
                          </span>
                          <span className="font-bold text-[#3a2f28]">
                            {ln.sum}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-[#a7988a] italic">
                        No tickets selected.
                      </div>
                    )}

                    <div className="pt-6 mt-4 border-t border-dashed border-[#d3c2aa] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#3a2f28]">
                          Subtotal
                        </span>
                        <span className="font-bold text-[#3a2f28]">
                          {breakdown.subtotal}
                        </span>
                      </div>

                      {promo && breakdown.discountRaw > 0 && (
                        <div className="flex items-center justify-between text-[#4A7854]">
                          <span className="flex items-center gap-1.5 font-bold">
                            <Tag size={14} /> Promo ({promo.code})
                          </span>
                          <span className="font-bold">
                            {breakdown.discount}
                          </span>
                        </div>
                      )}

                      {breakdown.vatRaw > 0 && (
                        <div className="flex items-center justify-between text-xs text-[#a7988a] font-medium">
                          <span>Included VAT (24%)</span>
                          <span>{breakdown.vat}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-6 mt-6 border-t border-[#e2d7c7] flex items-end justify-between bg-[#fcfbf9] -mx-8 -mb-8 p-8 rounded-b-[2rem]">
                      <span className="font-bold text-[#3a2f28] uppercase tracking-widest text-[11px]">
                        Total Amount
                      </span>
                      <span className="text-4xl font-serif text-[#8b6f47] leading-none">
                        {breakdown.finalTotal}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Clear & Pretty Cancellation Policy Box */}
              <div className="bg-[#fcfbf9] border border-[#e2d7c7] rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#e2d7c7] via-[#8b6f47] to-[#e2d7c7] opacity-40" />

                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-white border border-[#e2d7c7] shadow-sm rounded-full flex items-center justify-center text-[#8b6f47]">
                    <ShieldCheck size={24} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a7988a] mb-1">
                      Cancellation Policy
                    </h4>
                    <p className="text-xl font-serif text-[#3a2f28] leading-none">
                      {policy.title}
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  <ul className="flex flex-col gap-5 relative before:absolute before:inset-y-2 before:left-[7px] before:w-[2px] before:bg-[#e2d7c7] pl-1">
                    {policy.points.map((pt, i) => (
                      <li key={i} className="flex items-start gap-4 relative">
                        <div className="w-4 h-4 rounded-full bg-white border-4 border-[#8b6f47] shrink-0 mt-1 shadow-sm z-10" />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-[#3a2f28]">
                            {pt.label}
                          </span>
                          <span className="text-sm text-[#6b625a] mt-0.5">
                            {pt.desc}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="pt-5 mt-2 border-t border-[#e2d7c7] flex items-start gap-2">
                    <Info
                      size={16}
                      className="text-[#a7988a] shrink-0 mt-0.5"
                    />
                    <p className="text-[11px] text-[#8b7a6b] uppercase tracking-wider font-bold leading-relaxed">
                      Please note: No-shows at the designated meeting time are
                      100% non-refundable.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Right Column: Payment (5 cols) */}
            <section className="lg:col-span-5 space-y-6 lg:sticky lg:top-28 order-1 lg:order-2">
              <div className="rounded-[2.5rem] border border-[#e2d7c7] bg-white p-8 shadow-[0_12px_40px_rgb(0,0,0,0.06)]">
                <div className="mb-8">
                  <h3 className="text-2xl font-serif text-[#3a2f28] flex items-center gap-2 mb-2">
                    Secure Checkout
                  </h3>
                  <p className="text-xs text-[#a7988a] font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Lock size={12} /> Encrypted via Stripe
                  </p>
                </div>

                {/* 🔒 SECURITY UI: Display a dead form only if a fatal API error occurred (not Stripe form errors) */}
                {error ? (
                  <div className="mt-6 flex flex-col gap-4">
                    <div className="p-6 bg-[#fffafa] border border-[#f2dada] rounded-2xl flex flex-col items-center justify-center text-center gap-2 text-[#9a3b3b]">
                      <AlertCircle size={24} className="opacity-80" />
                      <span className="text-xs font-bold uppercase tracking-widest">
                        Payment Disabled
                      </span>
                      <span className="text-xs opacity-80">
                        Please resolve the error above or start a new booking.
                      </span>
                    </div>
                    <button
                      disabled
                      className="w-full py-5 rounded-full font-bold text-[11px] sm:text-xs uppercase tracking-[0.2em] bg-[#e2d7c7] text-[#a7988a] cursor-not-allowed flex items-center justify-center gap-3 shadow-none"
                    >
                      <Lock size={14} /> Pay Now
                    </button>
                  </div>
                ) : !clientSecret ? (
                  <div className="flex flex-col items-center justify-center py-12 bg-[#fcfbf9] border border-[#e2d7c7] rounded-[1.5rem] text-[#8b6f47]">
                    <Loader2 className="w-8 h-8 animate-spin mb-4" />
                    <span className="text-xs font-bold uppercase tracking-widest text-[#a7988a]">
                      Preparing Secure Gateway...
                    </span>
                  </div>
                ) : (
                  <Elements
                    stripe={stripePromise}
                    options={{
                      clientSecret,
                      appearance: {
                        theme: "stripe",
                        variables: {
                          colorPrimary: "#1A1A1A",
                          colorBackground: "#ffffff",
                          colorText: "#3a2f28",
                          colorDanger: "#b14545",
                          fontFamily: "inherit",
                          borderRadius: "16px",
                          spacingUnit: "5px",
                          colorBorder: "#e2d7c7",
                        },
                        rules: {
                          ".Input": {
                            backgroundColor: "#fcfbf9",
                            boxShadow: "none",
                          },
                          ".Input:focus": {
                            border: "1px solid #8b6f47",
                            boxShadow: "0 0 0 1px #8b6f47",
                          },
                        },
                      },
                    }}
                  >
                    <CheckoutForm
                      draftId={draftId}
                      amountLabel={amountLabel}
                      expired={expired}
                      token={token}
                    />
                  </Elements>
                )}

                {/* Promo Code Section */}
                {!error && (
                  <div className="mt-8 pt-8 border-t border-[#e2d7c7]">
                    <button
                      type="button"
                      onClick={() => setPromoOpen((v) => !v)}
                      className="w-full flex items-center justify-between text-sm font-bold text-[#5a4a3f] hover:text-[#8b6f47] transition-colors group"
                    >
                      <span className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-[#8b6f47] group-hover:scale-110 transition-transform" />
                        Add Promo Code
                      </span>
                      <span className="text-[10px] uppercase tracking-widest text-[#a7988a] font-bold">
                        {promo
                          ? `Applied: ${promo.code}`
                          : promoOpen
                            ? "Close"
                            : "Add"}
                      </span>
                    </button>

                    <AnimatePresence>
                      {promoOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-5">
                            <div className="flex items-center gap-2 bg-[#fcfbf9] p-1.5 rounded-2xl border border-[#e2d7c7] focus-within:border-[#8b6f47] focus-within:ring-1 focus-within:ring-[#8b6f47]/30 transition-all shadow-sm">
                              <input
                                value={promoInput}
                                onChange={(e) =>
                                  setPromoInput(sanitizePromo(e.target.value))
                                }
                                placeholder="ENTER CODE"
                                className="flex-1 bg-transparent px-4 py-2 text-sm text-[#3a2f28] placeholder:text-[#a7988a] uppercase tracking-widest font-bold outline-none"
                              />
                              <button
                                onClick={applyPromo}
                                disabled={promoLoading || !promoInput.trim()}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                                  promoLoading || !promoInput.trim()
                                    ? "bg-[#e2d7c7] text-[#a7988a] cursor-not-allowed"
                                    : "bg-[#1A1A1A] text-white hover:bg-[#8b6f47] shadow-md"
                                }`}
                              >
                                {promoLoading ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                                ) : (
                                  "Apply"
                                )}
                              </button>
                            </div>

                            {promoError && (
                              <p className="mt-3 text-[10px] font-bold text-[#b14545] uppercase tracking-wider pl-2 flex items-center gap-1.5">
                                <AlertCircle size={12} /> {promoError}
                              </p>
                            )}

                            {promo && (
                              <div className="mt-4 flex items-center justify-between bg-[#eaf0ea] border border-[#d8e6d8] rounded-xl px-4 py-3">
                                <span className="text-xs font-bold text-[#3e5c46] flex items-center gap-2">
                                  <CheckCircle2 size={16} /> {promo.code}{" "}
                                  applied
                                </span>
                                <button
                                  onClick={removePromo}
                                  className="text-[10px] font-bold uppercase tracking-wider text-[#3e5c46] hover:underline opacity-80"
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              <TrustBadges />
            </section>
          </div>
        )}
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {isDetailsOpen && (
          <DetailsModal
            onClose={() => setIsDetailsOpen(false)}
            experience={experience}
            when={when}
            attendeesRows={attendeesRows}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

/* ---------------------------- Subcomponents ---------------------------- */

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
        return arr.map((name) => ({ name: String(name), type: "", notes: "" }));
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

function Stepper({ currentStep = 3 }) {
  const steps = [
    { id: 1, label: "Group" },
    { id: 2, label: "Guests" },
    { id: 3, label: "Pay" },
  ];
  return (
    <div className="w-full sm:w-64">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-[#e2d7c7] z-0" />
        {steps.map((s) => {
          const active = s.id === currentStep;
          const passed = s.id < currentStep;
          return (
            <div
              key={s.id}
              className="relative z-10 flex flex-col items-center gap-1.5 bg-[#f4f1ec] px-2"
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                  active
                    ? "bg-[#1A1A1A] text-white ring-4 ring-[#1A1A1A]/10"
                    : passed
                      ? "bg-[#8b6f47] text-white"
                      : "bg-white border-2 border-[#e2d7c7] text-[#a7988a]"
                }`}
              >
                {passed ? <CheckCircle2 size={12} strokeWidth={3} /> : s.id}
              </div>
              <span
                className={`text-[9px] font-bold uppercase tracking-wider ${active ? "text-[#3a2f28]" : "text-[#a7988a]"}`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrustBadges() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-6 pt-4 border-t border-[#e2d7c7] text-[10px] font-bold uppercase tracking-wider text-[#a7988a]">
      <div className="flex items-center gap-1.5">
        <ShieldCheck size={14} className="text-[#8b6f47]" /> Secure
      </div>
      <div className="flex items-center gap-1.5">
        <Lock size={14} className="text-[#8b6f47]" /> Encrypted
      </div>
      <div className="flex items-center gap-1.5">
        <CheckCircle2 size={14} className="text-[#8b6f47]" /> Confirmed
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
      <div className="lg:col-span-7 space-y-8">
        <div className="h-[500px] animate-pulse rounded-[2rem] bg-white border border-[#e2d7c7]" />
      </div>
      <div className="lg:col-span-5 space-y-6">
        <div className="h-[600px] animate-pulse rounded-[2.5rem] bg-white border border-[#e2d7c7]" />
      </div>
    </div>
  );
}

function CheckoutForm({ draftId, amountLabel, expired, token }) {
  const stripe = useStripe();
  const elements = useElements();
  const [email, setEmail] = useState("");
  const [processing, setProcessing] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [formError, setFormError] = useState(""); // Track form-specific validation errors here

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements || !agreed) return;

    setProcessing(true);
    setFormError(""); // Clear any previous errors

    const { error: submitErr } = await elements.submit();
    if (submitErr) {
      setProcessing(false);
      setFormError(submitErr.message); // Set local error, don't bubble up
      return;
    }

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/booking/${draftId}/confirmation?token=${token}`,
        receipt_email: email,
      },
    });

    if (error) {
      setFormError(error.message); // Set local error, don't bubble up
      setProcessing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 mt-6">
      <div className="space-y-5">
        <LinkAuthenticationElement
          onChange={(e) => setEmail(e?.value?.email || "")}
        />
        <PaymentElement />
      </div>

      {formError && (
        <div className="p-4 bg-[#fffafa] border border-[#f2dada] rounded-xl text-[#9a3b3b] text-xs font-medium flex items-start gap-2 shadow-sm">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      {/* POLICY AGREEMENT CHECKBOX */}
      <div className="pt-6 border-t border-[#e2d7c7]">
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative flex items-center justify-center mt-0.5 shrink-0">
            <input
              type="checkbox"
              className="peer h-5 w-5 appearance-none rounded border-2 border-[#d3c2aa] bg-white transition-all checked:bg-[#8b6f47] checked:border-[#8b6f47] hover:border-[#8b6f47] cursor-pointer"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <CheckCircle2
              size={14}
              strokeWidth={3}
              className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
            />
          </div>
          <span className="text-xs text-[#6b625a] leading-relaxed select-none">
            I agree to the legal terms and the{" "}
            <span className="font-bold text-[#3a2f28] hover:text-[#8b6f47] transition-colors underline cursor-help">
              Cancellation Policy
            </span>{" "}
            and understand that my payment is subject to these terms.
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={processing || !stripe || !elements || expired || !agreed}
        className={`w-full py-5 rounded-full font-bold text-[11px] sm:text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl ${
          processing || expired || !agreed
            ? "bg-[#e2d7c7] text-[#a7988a] cursor-not-allowed shadow-none"
            : "bg-[#1A1A1A] text-white hover:bg-[#8b6f47] hover:-translate-y-0.5 active:translate-y-0"
        }`}
      >
        {processing ? (
          <Loader2 className="animate-spin" size={18} />
        ) : (
          <Lock size={14} />
        )}
        {processing ? "Authorizing..." : `Pay ${amountLabel}`}
      </button>

      {!agreed && !expired && !processing && (
        <p className="text-[10px] text-center text-[#b14545] font-bold uppercase tracking-widest animate-pulse mt-2">
          Accept policy to continue
        </p>
      )}
    </form>
  );
}

function DetailsModal({ onClose, experience, when, attendeesRows }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] grid place-items-center bg-[#1A1A1A]/40 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-2xl rounded-[2.5rem] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden relative"
      >
        <div className="px-8 py-6 border-b border-[#e2d7c7] bg-[#fcfbf9] flex items-center justify-between">
          <h3 className="text-xl font-serif text-[#3a2f28] flex items-center gap-2">
            <Users size={20} className="text-[#8b6f47]" /> Guest Roster
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#f4ede4] text-[#a7988a] hover:text-[#5a4a3f] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8">
          <div className="mb-8 space-y-2">
            <div className="font-bold text-lg text-[#3a2f28]">
              {experience?.name}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-[#6b625a]">
              {when && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={16} className="text-[#8b6f47]" />{" "}
                  {when.dateLabel}
                </span>
              )}
              {experience?.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={16} className="text-[#8b6f47]" />{" "}
                  {experience.location}
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto border border-[#e2d7c7] rounded-2xl bg-white">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#fcfbf9] border-b border-[#e2d7c7] text-[10px] uppercase tracking-widest text-[#a7988a] font-bold">
                <tr>
                  <th className="px-6 py-4">#</th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Notes & Dietary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2d7c7] text-[#3a2f28] font-medium">
                {attendeesRows.map((row) => (
                  <tr
                    key={row.idx}
                    className="hover:bg-[#fcfbf9] transition-colors"
                  >
                    <td className="px-6 py-4 text-[#a7988a] font-bold">
                      {row.idx}
                    </td>
                    <td className="px-6 py-4">{row.name}</td>
                    <td className="px-6 py-4 text-xs">
                      <span className="bg-[#f4ede4] text-[#5a4a3f] px-2.5 py-1 rounded-md font-bold">
                        {row.type}
                      </span>
                    </td>
                    <td
                      className="px-6 py-4 text-xs font-normal text-[#6b625a] max-w-[200px] truncate"
                      title={row.notes}
                    >
                      {row.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-[#1A1A1A] text-white rounded-full text-[11px] font-bold uppercase tracking-widest hover:bg-[#8b6f47] transition-colors"
            >
              Close Roster
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function useDraftCountdown(expiresAtIso) {
  const [hasMounted, setHasMounted] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  const [initialMs, setInitialMs] = useState(0);

  useEffect(() => {
    setHasMounted(true);
    if (!expiresAtIso) return;

    const ts = Date.parse(expiresAtIso);
    if (!Number.isFinite(ts)) return;

    const update = () => setRemainingMs(Math.max(0, ts - Date.now()));
    setInitialMs(Math.max(0, ts - Date.now()));
    update();

    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAtIso]);

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return {
    remainingMs,
    formatted,
    expired: hasMounted && remainingMs <= 0,
    progress:
      initialMs > 0 ? Math.max(0, Math.min(1, remainingMs / initialMs)) : 0,
    hasMounted,
  };
}
