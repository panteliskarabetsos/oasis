// src/app/[locale]/booking/[id]/payment/page.js
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
import { enGB, el as elGR } from "date-fns/locale";
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
import { useTranslations, useLocale } from "next-intl";

// Stripe init
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

export default function PaymentPage() {
  const router = useRouter();
  const { id } = useParams();
  const qs = useSearchParams();

  const t = useTranslations("BookingPayment");
  const locale = useLocale();
  const dateLocale = locale === "el" ? elGR : enGB;
  const numberLocale = locale === "el" ? "el-GR" : "en-GB";

  const cancelled = qs?.get("cancelled") === "1";
  const draftId = Number(id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Draft expiry
  const [expiresAt, setExpiresAt] = useState(qs?.get("expiresAt") || null);
  const {
    formatted: timeLeft,
    expired,
    progress: holdProgress,
  } = useDraftCountdown(expiresAt);

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
  const [promo, setPromo] = useState(null); // { code, discountType, discountValue, currency, endsAt? }

  const [clientSecret, setClientSecret] = useState("");
  const [piInfo, setPiInfo] = useState({ amountCents: 0, currency: "eur" });

  const sanitizePromo = (raw) =>
    raw
      .toUpperCase()
      .replace(/[\s_]/g, "-")
      .replace(/[^A-Z0-9-]/g, "");

  // Fetch draft
  useEffect(() => {
    if (!Number.isFinite(draftId) || draftId <= 0) {
      setError(t("invalidBookingId"));
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
              t("failedToLoadBooking")
          );

        let data = {};
        try {
          data = await res.json();
        } catch {
          data = {};
        }

        const d = data?.draft || data; // normalize

        if (d?.expiresAt) {
          setExpiresAt(d.expiresAt);
        }

        // If this draft is already paid/converted, jump to confirmation.
        const st = String(d?.status || "").toLowerCase();
        if (st === "paid" || st === "converted") {
          const sid = d?.stripeSessionId
            ? `?session_id=${encodeURIComponent(d.stripeSessionId)}`
            : "";
          router.replace(`/${locale}/booking/${draftId}/confirmation${sid}`);
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
          up.adult ?? d?.unitPriceAdult ?? d?.unit_price_adult ?? 0
        );
        const unitKid = Number(
          up.kid ?? d?.unitPriceKid ?? d?.unit_price_kid ?? unitAdult
        );
        setUnitPrices({ adult: unitAdult, teen: unitAdult, kid: unitKid });

        setAttendees(extractAttendees(d));
        setError("");
      } catch (e) {
        setError(e.message || t("failedToLoadBooking"));
      } finally {
        setLoading(false);
      }
    })();
  }, [draftId, router, t, locale]);

  // Close details dialog on Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setIsDetailsOpen(false);
    }
    if (isDetailsOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDetailsOpen]);

  // Expiry message
  useEffect(() => {
    if (expired) {
      setError(t("holdExpiredError"));
    }
  }, [expired, t]);

  function normalizePromo(p, fallbackCode) {
    return {
      code: (p?.code || fallbackCode || "").toString().toUpperCase(),
      discountType: String(
        p?.discountType || p?.type || "percent"
      ).toLowerCase(),
      discountValue: Number(p?.discountValue ?? p?.value ?? 0),
      currency: p?.currency || "EUR",
      endsAt: p?.endsAt ? new Date(p.endsAt) : null,
    };
  }

  async function validateAndApply(code) {
    const c = code.trim();
    if (!c) {
      setPromoError(t("promoEnterCode"));
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
          (await res.json().catch(() => ({})))?.error ||
          t("promoInvalidDefault");
        throw new Error(msg);
      }
      const data = await res.json();
      const next = normalizePromo(data, c);
      if (next.endsAt && next.endsAt.getTime() < Date.now()) {
        throw new Error(t("promoExpired"));
      }
      setPromo(next);
      setPromoOpen(false);
    } catch (e) {
      setPromo(null);
      setPromoError(e.message || t("promoInvalidDefault"));
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
  }, [qs, promo, promoLoading]); // promo in deps so we don't re-apply after success

  // When (date/time) with locale
  const when = useMemo(() => {
    if (!slot?.date) return null;
    const d =
      typeof slot.date === "string" ? parseISO(slot.date) : new Date(slot.date);
    return {
      dateLabel: format(d, "PPP", { locale: dateLocale }),
      timeLabel: format(d, "p", { locale: dateLocale }),
    };
  }, [slot, dateLocale]);

  // Price breakdown with promo
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

    const currency = (piInfo.currency || "eur").toUpperCase();
    const moneyFmt = (n) =>
      new Intl.NumberFormat(numberLocale, {
        style: "currency",
        currency,
      }).format(n);

    const lines = [
      A > 0 && {
        label: t("priceLineAdults", { count: A }),
        value: moneyFmt(unitPrices.adult),
        sum: moneyFmt(fromC(laC)),
      },
      K > 0 && {
        label: t("priceLineKids", { count: K }),
        value: moneyFmt(unitPrices.kid),
        sum: moneyFmt(fromC(lkC)),
      },
    ].filter(Boolean);

    return {
      lines,
      subtotalRaw: fromC(subtotalC),
      subtotal: moneyFmt(fromC(subtotalC)),
      discountRaw: fromC(discountC),
      discount: discountC > 0 ? `- ${moneyFmt(fromC(discountC))}` : null,
      finalTotalRaw: fromC(finalC),
      finalTotal: moneyFmt(fromC(finalC)),
    };
  }, [counts, unitPrices, promo, t, numberLocale, piInfo.currency]);

  // Build table rows for attendee details
  const attendeesRows = useMemo(() => {
    if (Array.isArray(attendees) && attendees.length > 0) {
      return attendees.map((a, i) => ({
        idx: i + 1,
        name:
          a?.name ||
          [a?.firstName, a?.lastName].filter(Boolean).join(" ") ||
          t("genericAttendeeName", { index: i + 1 }),
        type: a?.type || a?.category || "—",
        notes: a?.notes || a?.allergies || "",
      }));
    }
    const rows = [];
    let idx = 1;
    const pushN = (n, typeKey) => {
      for (let i = 0; i < Number(n || 0); i++) {
        rows.push({
          idx,
          name: t("genericAttendeeName", { index: idx }),
          type: t(typeKey),
          notes: "",
        });
        idx++;
      }
    };
    pushN(counts?.adults, "attendeeTypeAdult");
    pushN(counts?.teens, "attendeeTypeTeen");
    pushN(counts?.kids, "attendeeTypeKid");
    return rows;
  }, [attendees, counts, t]);

  // Initialize Elements checkout session (and re-init on promo changes)
  useEffect(() => {
    (async () => {
      if (!Number.isFinite(draftId) || draftId <= 0) return;

      try {
        setError("");
        setClientSecret("");
        setPiInfo({ amountCents: 0, currency: "eur" });
        const res = await fetch(`/api/bookings/drafts/${draftId}/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "elements",
            promoCode: promo?.code ?? null,
            locale,
          }),
        });
        const data = await res.json();

        if (data?.redirectUrl) {
          window.location.replace(data.redirectUrl);
          return;
        }
        if (!res.ok || !data?.clientSecret) {
          throw new Error(data?.error || t("initPaymentFailed"));
        }
        setClientSecret(data.clientSecret);
        setPiInfo({
          amountCents: data.amountCents || 0,
          currency: (data.currency || "eur").toLowerCase(),
        });
      } catch (e) {
        setClientSecret("");
        setPiInfo({ amountCents: 0, currency: "eur" });
        setError(e.message || t("initPaymentCouldNot"));
      }
    })();
  }, [draftId, promo?.code, t]);

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-50%,#fdfaf6,transparent),radial-gradient(800px_400px_at_20%_10%,#f4efe7,transparent),linear-gradient(to_bottom,#f7f3ed,#f4f1ec)]" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/60 to-transparent" />
      </div>

      {/* Header / breadcrumbs */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-6 sm:pt-8">
        <div className="flex items-center gap-3 text-sm text-[#7a6a58]">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border border-[#e8e5df] bg-white/80 backdrop-blur hover:bg-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("back")}
          </button>

          <div className="ml-auto hidden sm:flex items-center gap-2 text-xs">
            <Lock className="h-4 w-4 text-[#8b6f47]" />
            <span>{t("secureCheckout")}</span>
          </div>
        </div>

        <div className="mt-6 sm:mt-8 flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#5a4a3f] flex items-center gap-3">
            <CreditCard className="h-7 w-7 text-[#8b6f47]" />
            {t("title")}
          </h1>

          <Stepper currentStep={3} />
        </div>

        {expiresAt && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {expired ? (
                  <span>{t("holdBannerExpired")}</span>
                ) : (
                  <span>{t("holdBannerActive", { timeLeft })}</span>
                )}
              </div>

              {!expired && (
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-amber-800/80">
                    {t("holdTimeLeftLabel")}
                  </span>
                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-amber-100">
                    <div
                      className="h-full bg-amber-500 transition-[width] duration-1000 ease-linear"
                      style={{ width: `${holdProgress * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {cancelled && (
          <Banner tone="danger" icon={<AlertCircle size={14} />}>
            {t("paymentCancelled")}
          </Banner>
        )}
        {error && (
          <Banner tone="danger" icon={<AlertCircle size={14} />}>
            <span className="font-medium">{error}</span>
          </Banner>
        )}
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-20 pt-6">
        {loading ? (
          <Skeleton />
        ) : (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
            {/* Left: booking summary */}
            <section className="lg:col-span-2 space-y-6">
              <div className="rounded-3xl border border-[#e8e5df] bg-white/90 backdrop-blur p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-[#5a4a3f] mb-3">
                      {t("summaryTitle")}
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

                  <button
                    onClick={() => setIsDetailsOpen(true)}
                    type="button"
                    className="text-xs inline-flex items-center gap-1 rounded-full border border-[#e8e5df] px-3 py-1.5 text-[#7a6a58] hover:bg-[#faf7f2] transition"
                  >
                    {t("viewDetails")}
                  </button>
                </div>

                <div className="mt-5 rounded-2xl border border-[#ebe6dd] bg-[#faf7f2] px-6 py-4 shadow-inner">
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
                      {t("noTicketsSelected")}
                    </div>
                  )}

                  <div className="mt-4 border-t border-[#e5e0d8] pt-4 space-y-2">
                    <Row
                      label={t("subtotalLabel")}
                      value={
                        <span className="font-medium">
                          {breakdown.subtotal}
                        </span>
                      }
                    />
                    {promo && breakdown.discountRaw > 0 && (
                      <Row
                        label={
                          <span>
                            {t("promoRowLabel")}{" "}
                            <span className="font-mono">({promo.code})</span>
                          </span>
                        }
                        value={
                          <span className="font-semibold text-[#b14545]">
                            {breakdown.discount}
                          </span>
                        }
                      />
                    )}
                    <Row
                      label={
                        <span className="text-sm">
                          {promo
                            ? t("totalAfterDiscountLabel")
                            : t("totalLabel")}
                        </span>
                      }
                      value={
                        <span className="text-2xl font-bold text-[#8b6f47] tracking-wide">
                          {breakdown.finalTotal}
                        </span>
                      }
                    />
                  </div>

                  <p className="mt-2 text-[11px] text-[#7a6a58]">
                    {t("taxesIncluded")}
                  </p>
                </div>
              </div>

              <TrustBadges />
            </section>

            {/* Right: payment */}
            <section className="space-y-6 lg:sticky lg:top-28 self-start">
              <div className="rounded-3xl border border-[#e8e5df] bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-[#5a4a3f] flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-[#8b6f47]" />{" "}
                  {t("payWithCardTitle")}
                </h3>
                <p className="text-xs text-[#7a6a58] mt-1">
                  {t("stripeExplainer")}
                </p>

                {!clientSecret ? (
                  <div className="mt-6 text-sm text-[#7a6a58] flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />{" "}
                    {t("initializingPayment")}
                  </div>
                ) : (
                  <Elements
                    stripe={stripePromise}
                    options={{
                      clientSecret,
                      appearance: {
                        theme: "stripe",
                        variables: {
                          colorPrimary: "#8b6f47",
                          colorText: "#2f2f2f",
                          colorDanger: "#b14545",
                          borderRadius: "12px",
                        },
                      },
                    }}
                  >
                    <div className="mt-5 rounded-xl border border-[#ebe6dd] bg-[#faf7f2] p-4">
                      <CheckoutForm
                        draftId={draftId}
                        amountLabel={new Intl.NumberFormat(numberLocale, {
                          style: "currency",
                          currency: (piInfo.currency || "eur").toUpperCase(),
                        }).format((piInfo.amountCents || 0) / 100)}
                        onError={(msg) => setError(msg)}
                        expired={expired}
                      />
                    </div>
                  </Elements>
                )}

                {/* Promo */}
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
                      {t("promoQuestion")}
                    </span>
                    <span className="text-xs text-[#7a6a58]">
                      {promo
                        ? t("promoBadgeApplied", { code: promo.code })
                        : promoOpen
                        ? t("promoHide")
                        : t("promoApplyShort")}
                    </span>
                  </button>

                  {promoOpen && (
                    <div id="promo-panel" className="mt-3">
                      <div className="flex items-stretch gap-2">
                        <input
                          value={promoInput}
                          onChange={(e) =>
                            setPromoInput(sanitizePromo(e.target.value))
                          }
                          onPaste={(e) => {
                            e.preventDefault();
                            const text = e.clipboardData?.getData("text") || "";
                            setPromoInput(sanitizePromo(text));
                          }}
                          inputMode="text"
                          autoCapitalize="characters"
                          autoComplete="off"
                          spellCheck={false}
                          placeholder={t("promoPlaceholder")}
                          pattern="[A-Z0-9-]{3,32}"
                          title={t("promoTitle")}
                          className="flex-1 rounded-lg border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#5a4a3f] placeholder:text-[#b1a595] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40 uppercase tracking-wider font-voucher"
                          aria-label={t("promoAriaLabel")}
                          data-lpignore="true"
                        />
                        <button
                          onClick={applyPromo}
                          disabled={promoLoading || !promoInput.trim()}
                          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                            promoLoading || !promoInput.trim()
                              ? "bg-gray-300 text-white cursor-not-allowed"
                              : "bg-[#8b6f47] text-white hover:bg-[#7a5f3a]"
                          }`}
                        >
                          {promoLoading ? t("promoChecking") : t("promoApply")}
                        </button>
                      </div>
                      {promoError && (
                        <p className="mt-2 text-[11px] text-[#b14545]">
                          {promoError}
                        </p>
                      )}
                      {promo && (
                        <div className="mt-2 text-xs text-[#5a4a3f]">
                          <span className="font-medium">
                            {t("promoApplied")}
                          </span>
                          : <span className="font-mono">{promo.code}</span> —{" "}
                          {promo.discountType === "percent"
                            ? t("promoPercentOff", {
                                value: promo.discountValue,
                              })
                            : t("promoFixedOff", {
                                amount: eur(promo.discountValue),
                              })}
                          <button
                            type="button"
                            onClick={removePromo}
                            className="ml-2 rounded px-2 py-0.5 border border-[#e8e5df] text-[#7a6a58] hover:bg-[#f6f2ea]"
                          >
                            {t("promoRemove")}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 text-[11px] text-[#7a6a58]">
                  <div className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5" />
                    <span>{t("stripeHandledInfo")}</span>
                  </div>
                  <div className="mt-2">{t("acceptedCards")}</div>
                </div>

                <div className="mt-6 flex items-center justify-between text-xs text-[#7a6a58]">
                  <a href="/contact" className="hover:text-[#5a4a3f]">
                    {t("needHelp")}
                  </a>
                </div>
              </div>

              <div className="rounded-2xl border border-[#e8e5df] bg-[#fcf9f4] p-4 shadow-sm text-xs text-[#7a6a58]">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-[#8b6f47] mt-0.5" />
                  <p>{t("closingWindowInfo")}</p>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      {isDetailsOpen && (
        <DetailsDialog
          onClose={() => setIsDetailsOpen(false)}
          experience={experience}
          when={when}
          attendeesRows={attendeesRows}
        />
      )}
    </main>
  );
}

/* ---------- helpers & small components ---------- */

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

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[#5a4a3f]">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Banner({ children, tone = "neutral", icon }) {
  const tones = {
    neutral: {
      border: "border-[#e8e5df]",
      bg: "bg-[#fffdf8]",
      text: "text-[#6d6255]",
      icon: "text-[#8b6f47]",
    },
    danger: {
      border: "border-[#f1d7d7]",
      bg: "bg-[#fff6f6]",
      text: "text-[#7a4a4a]",
      icon: "text-[#b14545]",
    },
  }[tone];
  return (
    <div
      className={`mt-4 flex items-start gap-2 rounded-xl border ${tones.border} ${tones.bg} px-3 py-2 text-xs ${tones.text} shadow-sm`}
      role="alert"
      aria-live="polite"
    >
      <span className={`${tones.icon} mt-0.5`}>{icon}</span>
      <p>{children}</p>
    </div>
  );
}

function Stepper({ currentStep = 3 }) {
  const t = useTranslations("BookingPayment");
  const steps = [t("stepperTickets"), t("stepperDetails"), t("stepperPayment")];
  return (
    <div
      className="hidden sm:flex items-center gap-2 text-xs text-[#7a6a58]"
      aria-label={t("stepperProgressAria")}
    >
      {steps.map((label, i) => {
        const step = i + 1;
        const current = step === currentStep;
        const done = step < currentStep;
        return (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border ${
                current
                  ? "border-[#8b6f47] text-[#5a4a3f] bg-[#faf7f2]"
                  : done
                  ? "border-[#e8e5df] text-[#7a6a58] bg-white"
                  : "border-[#e8e5df] text-[#b1a595] bg-white"
              }`}
              aria-current={current ? "step" : undefined}
            >
              {done ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-[#8b6f47]" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-[#d6cfc4]" />
              )}
              <span>{label}</span>
            </span>
            {i !== steps.length - 1 && <span className="opacity-50">—</span>}
          </div>
        );
      })}
    </div>
  );
}

function TrustBadges() {
  const t = useTranslations("BookingPayment");
  return (
    <div className="rounded-3xl border border-[#e8e5df] bg-[#fcf9f4] p-6 shadow-sm">
      <div className="flex flex-wrap items-center gap-4 text-sm text-[#5a4a3f]">
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#8b6f47]" />{" "}
          {t("trustBadgeStripe")}
        </span>
        <span className="inline-flex items-center gap-2">
          <Lock className="h-4 w-4 text-[#8b6f47]" /> {t("trustBadgeSsl")}
        </span>
        <span className="inline-flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#8b6f47]" />{" "}
          {t("trustBadgeReschedule")}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-[#7a6a58]">
        {t("trustBadgeFootnote")}
      </p>
    </div>
  );
}

function Skeleton() {
  return (
    <div
      className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10"
      aria-hidden
    >
      <div className="lg:col-span-2 space-y-6">
        <div className="rounded-3xl border border-[#e8e5df] bg-white p-6 shadow-sm">
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
        <div className="rounded-3xl border border-[#e8e5df] bg-[#fcf9f4] p-6 shadow-sm">
          <div className="h-4 w-3/4 bg-[#eee9df] rounded animate-pulse" />
        </div>
      </div>

      <div className="space-y-6 lg:sticky lg:top-28">
        <div className="rounded-3xl border border-[#e8e5df] bg-white p-6 shadow-sm">
          <div className="h-5 w-40 bg-[#eee9df] rounded animate-pulse" />
          <div className="mt-4 h-12 w-full bg-[#f2ede4] rounded-xl animate-pulse" />
          <div className="mt-3 h-3 w-3/4 bg-[#eee9df] rounded animate-pulse" />
        </div>
        <div className="rounded-3xl border border-[#e8e5df] bg-[#fcf9f4] p-4 shadow-sm">
          <div className="h-3 w-2/3 bg-[#eee9df] rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function DetailsDialog({ onClose, experience, when, attendeesRows }) {
  const t = useTranslations("BookingPayment");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="details-title"
      className="fixed inset-0 z-50"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative mx-auto max-w-2xl mt-24 px-4">
        <div className="relative rounded-2xl border border-[#e8e5df] bg-white shadow-lg">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 inline-flex items-center justify-center rounded-full p-1.5 hover:bg-[#f6f2ea]"
            aria-label={t("close")}
          >
            <X className="h-5 w-5 text-[#7a6a58]" />
          </button>
          <div className="p-6">
            <h2
              id="details-title"
              className="text-lg font-semibold text-[#5a4a3f]"
            >
              {t("detailsDialogTitle")}
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
                    <th className="py-2 pr-2">{t("detailsThIndex")}</th>
                    <th className="py-2 pr-2">{t("detailsThName")}</th>
                    <th className="py-2 pr-2">{t("detailsThType")}</th>
                    <th className="py-2">{t("detailsThNotes")}</th>
                  </tr>
                </thead>
                <tbody className="text-[#5a4a3f]">
                  {attendeesRows.length === 0 ? (
                    <tr>
                      <td className="py-3 text-[#7a6a58]" colSpan={4}>
                        {t("detailsNoAttendees")}
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
                          {row.notes || <span className="opacity-60">—</span>}
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
              onClick={onClose}
              className="rounded-lg border border-[#e8e5df] px-4 py-2 text-sm text-[#5a4a3f] hover:bg-[#f6f2ea]"
            >
              {t("close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple countdown hook for draft expiry
function useDraftCountdown(expiresAtIso) {
  const [remainingMs, setRemainingMs] = useState(() => {
    if (!expiresAtIso) return 0;
    const ts = Date.parse(expiresAtIso);
    if (!Number.isFinite(ts)) return 0;
    return Math.max(0, ts - Date.now());
  });

  const [initialMs, setInitialMs] = useState(() => {
    if (!expiresAtIso) return 0;
    const ts = Date.parse(expiresAtIso);
    if (!Number.isFinite(ts)) return 0;
    return Math.max(0, ts - Date.now());
  });

  useEffect(() => {
    if (!expiresAtIso) {
      setRemainingMs(0);
      setInitialMs(0);
      return;
    }

    const ts = Date.parse(expiresAtIso);
    if (!Number.isFinite(ts)) {
      setRemainingMs(0);
      setInitialMs(0);
      return;
    }

    const update = () => {
      const diff = Math.max(0, ts - Date.now());
      setRemainingMs(diff);
    };

    setInitialMs(Math.max(0, ts - Date.now()));
    update();

    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAtIso]);

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const formatted = `${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;
  const expired = remainingMs <= 0;
  const progress =
    initialMs > 0 ? Math.max(0, Math.min(1, remainingMs / initialMs)) : 0;

  return { remainingMs, formatted, expired, progress };
}

function CheckoutForm({ draftId, amountLabel, onError, expired }) {
  const t = useTranslations("BookingPayment");
  const locale = useLocale();
  const stripe = useStripe();
  const elements = useElements();
  const [email, setEmail] = useState("");
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setMessage("");
    onError?.("");

    const { error: submitErr } = await elements.submit();
    if (submitErr) {
      setProcessing(false);
      const msg = submitErr.message || t("checkYourDetails");
      setMessage(msg);
      onError?.(msg || t("submitError"));
      return;
    }

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/${locale}/booking/${draftId}/confirmation`,
        receipt_email: email || undefined,
      },
    });

    if (error) {
      const msg = error.message || t("paymentFailed");
      setMessage(msg);
      onError?.(msg);
      setProcessing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <LinkAuthenticationElement
        onChange={(e) => setEmail(e?.value?.email || "")}
        options={{ defaultValues: { email } }}
      />
      <PaymentElement />
      <button
        type="submit"
        disabled={processing || !stripe || !elements || expired}
        className={`w-full py-3 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2 shadow-md ${
          processing || expired
            ? "bg-gray-300 text-white cursor-not-allowed"
            : "bg-gradient-to-b from-[#8b6f47] to-[#7a5f3a] text-white hover:from-[#7f643f] hover:to-[#6a5233]"
        }`}
      >
        {processing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" /> {t("processing")}
          </>
        ) : expired ? (
          <>{t("holdExpired")}</>
        ) : (
          <>{t("payAmount", { amount: amountLabel })}</>
        )}
      </button>
      {message ? (
        <p className="text-[12px] text-[#b14545] mt-1">{message}</p>
      ) : null}
    </form>
  );
}
