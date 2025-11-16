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
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  LinkAuthenticationElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

// Stripe init
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

export default function PaymentPage() {
  const { id } = useParams();
  const router = useRouter();
  const qs = useSearchParams();
  const cancelled = qs?.get("cancelled") === "1";

  const draftId = Number(id);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Draft expiry
  const [expiresAt, setExpiresAt] = useState(
    qs?.get("expiresAt") || null //seed from URL
  );
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

        let data = {};
        try {
          data = await res.json();
        } catch {}
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
          router.replace(`/booking/${draftId}/confirmation${sid}`);
          return;
        }

        setExperience(data?.experience || d?.experience || null);
        setSlot(data?.slot || d?.slot || null);
        if (d?.expiresAt) {
          setExpiresAt(d.expiresAt);
        }
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

  useEffect(() => {
    if (expired) {
      setError(
        "Your reservation hold has expired. Please go back and choose a new time."
      );
    }
  }, [expired]);

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

    const eurFmt = (n) =>
      new Intl.NumberFormat("el-GR", {
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

    return {
      lines,
      subtotalRaw: fromC(subtotalC),
      subtotal: eurFmt(fromC(subtotalC)),
      discountRaw: fromC(discountC),
      discount: discountC > 0 ? `- ${eurFmt(fromC(discountC))}` : null,
      finalTotalRaw: fromC(finalC),
      finalTotal: eurFmt(fromC(finalC)),
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
        rows.push({ idx, name: `Attendee ${idx}`, type: label, notes: "" });
        idx++;
      }
    };
    pushN(counts?.adults, "Adult");
    pushN(counts?.teens, "Teen");
    pushN(counts?.kids, "Kid");
    return rows;
  }, [attendees, counts]);

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
          }),
        });
        const data = await res.json();

        if (data?.redirectUrl) {
          window.location.replace(data.redirectUrl);
          return;
        }
        if (!res.ok || !data?.clientSecret) {
          throw new Error(data?.error || "Failed to initialize payment.");
        }
        setClientSecret(data.clientSecret);
        setPiInfo({
          amountCents: data.amountCents || 0,
          currency: (data.currency || "eur").toLowerCase(),
        });
      } catch (e) {
        setClientSecret("");
        setPiInfo({ amountCents: 0, currency: "eur" });
        setError(e.message || "Could not initialize payment.");
      }
    })();
  }, [draftId, promo?.code]);

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
            Back
          </button>

          <div className="ml-auto hidden sm:flex items-center gap-2 text-xs">
            <Lock className="h-4 w-4 text-[#8b6f47]" />
            <span>Secure checkout</span>
          </div>
        </div>

        <div className="mt-6 sm:mt-8 flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#5a4a3f] flex items-center gap-3">
            <CreditCard className="h-7 w-7 text-[#8b6f47]" />
            Secure payment
          </h1>

          <Stepper currentStep={3} />
        </div>
        {expiresAt && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {expired ? (
                  <span>
                    Your hold for this time slot has{" "}
                    <span className="font-semibold">expired</span>. Please go
                    back and choose a new time.
                  </span>
                ) : (
                  <span>
                    We&apos;re holding your seats for{" "}
                    <span className="font-mono font-semibold">{timeLeft}</span>.
                    Please complete your payment before the timer runs out.
                  </span>
                )}
              </div>

              {!expired && (
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-amber-800/80">
                    Time left
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
            Payment cancelled. You can try again below.
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

                  <button
                    onClick={() => setIsDetailsOpen(true)}
                    type="button"
                    className="text-xs inline-flex items-center gap-1 rounded-full border border-[#e8e5df] px-3 py-1.5 text-[#7a6a58] hover:bg-[#faf7f2] transition"
                  >
                    View details
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
                      No tickets selected.
                    </div>
                  )}

                  <div className="mt-4 border-t border-[#e5e0d8] pt-4 space-y-2">
                    <Row
                      label="Subtotal"
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
                            Promo{" "}
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
                          {promo ? "Total after discount" : "Total"}
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
                    All taxes included. You’ll receive a confirmation email
                    after successful payment.
                  </p>
                </div>
              </div>

              <TrustBadges />
            </section>

            {/* Right: payment */}
            <section className="space-y-6 lg:sticky lg:top-28 self-start">
              <div className="rounded-3xl border border-[#e8e5df] bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-[#5a4a3f] flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-[#8b6f47]" /> Pay with
                  card
                </h3>
                <p className="text-xs text-[#7a6a58] mt-1">
                  Secure, on-page payment via Stripe. We never store your card
                  details.
                </p>

                {!clientSecret ? (
                  <div className="mt-6 text-sm text-[#7a6a58] flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Initializing
                    payment…
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
                        amountLabel={new Intl.NumberFormat("el-GR", {
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
                      Do you have a promo code or voucher?
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
                          placeholder="ENTER CODE"
                          pattern="[A-Z0-9-]{3,32}"
                          title="Use capitals, numbers, and hyphens only"
                          className="flex-1 rounded-lg border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#5a4a3f] placeholder:text-[#b1a595] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40 uppercase tracking-wider font-voucher"
                          aria-label="Promo code"
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
  const steps = ["Tickets", "Details", "Payment"];
  return (
    <div
      className="hidden sm:flex items-center gap-2 text-xs text-[#7a6a58]"
      aria-label="progress"
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
  return (
    <div className="rounded-3xl border border-[#e8e5df] bg-[#fcf9f4] p-6 shadow-sm">
      <div className="flex flex-wrap items-center gap-4 text-sm text-[#5a4a3f]">
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#8b6f47]" /> PCI-DSS compliant
          via Stripe
        </span>
        <span className="inline-flex items-center gap-2">
          <Lock className="h-4 w-4 text-[#8b6f47]" /> 256-bit SSL encryption
        </span>
        <span className="inline-flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#8b6f47]" /> Free reschedule
          policy*
        </span>
      </div>
      <p className="mt-2 text-[11px] text-[#7a6a58]">
        *In selected experiences.
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
              Close
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
      setMessage(submitErr.message || "Please check your details.");
      onError?.(submitErr.message || "Submit error");
      return;
    }

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/booking/${draftId}/confirmation`,
        receipt_email: email || undefined,
      },
    });

    if (error) {
      setMessage(error.message || "Payment failed. Try again.");
      onError?.(error.message || "Payment failed");
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
            <Loader2 className="w-5 h-5 animate-spin" /> Processing…
          </>
        ) : expired ? (
          <>Hold expired</>
        ) : (
          <>Pay {amountLabel}</>
        )}
      </button>
      {message ? (
        <p className="text-[12px] text-[#b14545] mt-1">{message}</p>
      ) : null}
    </form>
  );
}
