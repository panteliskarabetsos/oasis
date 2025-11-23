"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  Loader2,
  MapPin,
  Info,
  Printer,
  ExternalLink,
  RefreshCw,
  Mail,
  Users,
} from "lucide-react";
import { parseISO, format, addMinutes } from "date-fns";

export default function BookingConfirmationPage() {
  const { id } = useParams();
  const qs = useSearchParams();

  const sessionId = qs?.get("session_id"); // from Stripe success redirect
  const draftId = Number(id);

  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(null);
  const [experience, setExperience] = useState(null);
  const [slot, setSlot] = useState(null);
  const [error, setError] = useState("");
  const [tries, setTries] = useState(0);
  const timerRef = useRef(null);

  const [bookingCode, setBookingCode] = useState("");
  const [bookingDbStatus, setBookingDbStatus] = useState("");
  const [confirmedBookingId, setConfirmedBookingId] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [printing, setPrinting] = useState(false);

  const freeConfirmTriedRef = useRef(false);

  // ---------- Utils ----------

  const deriveFallbackCode = (id) =>
    id ? `BK-${String(id).padStart(6, "0")}` : "";

  async function tryFetchBookingCode(id) {
    // Try common public endpoints; gracefully fallback to BK-000123
    const endpoints = [`/api/bookings/${id}`, `/api/bookings/${id}/public`];
    for (const url of endpoints) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const b = await res.json().catch(() => ({}));
        const code =
          b?.code ||
          b?.reference ||
          b?.bookingCode ||
          b?.shortCode ||
          b?.refCode ||
          b?.ref ||
          "";
        if (code) return String(code);
      } catch {
        // ignore
      }
    }
    return deriveFallbackCode(id);
  }

  async function confirmNow(dId, opts = {}) {
    try {
      const res = await fetch(`/api/bookings/drafts/${dId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts),
      });
      const j = await res.json().catch(() => ({}));

      if (res.status === 409 && j?.redirectUrl) {
        window.location.replace(j.redirectUrl);
        return j;
      }

      if (j?.bookingId) setConfirmedBookingId(j.bookingId);
      if (j?.bookingCode) setBookingCode(String(j.bookingCode));
      if (j?.status) setBookingDbStatus(String(j.status));
      if (!(j?.converted && j?.bookingId)) setTries((t) => t + 1);

      return j;
    } catch {
      return null;
    }
  }

  // ---------- Effects: confirm & poll ----------

  // First confirmation attempt (with payment identifiers)
  useEffect(() => {
    const pi = qs.get("payment_intent");
    const sid = qs.get("session_id");

    if (!Number.isFinite(draftId) || draftId <= 0) return;
    if (!pi && !sid) return;

    let alive = true;

    (async () => {
      try {
        setConfirming(true);
        setError("");
        const data = await confirmNow(draftId, {
          payment_intent: pi || undefined,
          session_id: sid || undefined,
        });
        if (!alive) return;
        if (data?.error) {
          throw new Error(data?.error || "Could not finalize booking");
        }

        if (data?.converted && data?.bookingId) {
          setConfirmedBookingId(data.bookingId);
          if (data.bookingCode) setBookingCode(data.bookingCode);
        }
      } catch (e) {
        if (alive) setError(e.message || "Finalization failed");
      } finally {
        if (alive) setConfirming(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [draftId, qs]);

  // Poll draft until converted / finalized
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/bookings/drafts/${draftId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || "Could not load booking");
        if (!alive) return;

        const d = j?.draft || j;
        setDraft(d);
        setExperience(j?.experience || d?.experience || null);
        setSlot(j?.slot || d?.slot || null);
        setError("");

        const convertedId = Number(d?.convertedBookingId) || null;
        const status = String(d?.status || "").toLowerCase();
        const converted = !!convertedId || status === "converted";

        if (converted) {
          if (convertedId && !confirmedBookingId)
            setConfirmedBookingId(convertedId);
          if (convertedId && !bookingCode) {
            const code = await tryFetchBookingCode(convertedId);
            if (alive && code) setBookingCode(code);
          }
          return; // stop polling
        }

        if (status === "paid" && !freeConfirmTriedRef.current) {
          freeConfirmTriedRef.current = true;
          await confirmNow(draftId);
          return;
        }

        if (tries < 12) {
          timerRef.current = window.setTimeout(() => {
            if (alive) setTries((t) => t + 1);
          }, 4000);
        }
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Could not load booking");
      } finally {
        if (alive) setLoading(false);
      }
    }

    if (Number.isFinite(draftId) && draftId > 0) load();

    return () => {
      alive = false;
      controller.abort();
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, tries]);

  // Extra confirm with session_id (Stripe)
  useEffect(() => {
    if (!sessionId || !Number.isFinite(draftId) || draftId <= 0) return;

    (async () => {
      try {
        const res = await fetch(
          `/api/bookings/drafts/${draftId}/confirm?session_id=${encodeURIComponent(
            sessionId
          )}`,
          { method: "POST" }
        );
        const j = await res.json().catch(() => ({}));

        if (j?.bookingId && !confirmedBookingId) {
          setConfirmedBookingId(j.bookingId);
        }
        if (j?.bookingCode) {
          setBookingCode(String(j.bookingCode));
        } else if (j?.bookingId && !bookingCode) {
          setBookingCode(deriveFallbackCode(j.bookingId));
        }
        if (j?.status) setBookingDbStatus(String(j.status));

        setTries((t) => t + 1);
      } catch {
        // polling continues
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, draftId]);

  // ---------- Derived state ----------

  const status = String(draft?.status || "").toLowerCase();
  const bookingId = draft?.convertedBookingId || confirmedBookingId || null;
  const converted = !!bookingId || status === "converted";
  const paid =
    status === "paid" || bookingDbStatus.toLowerCase() === "paid" || converted;
  const processing =
    status === "draft" ||
    status === "checkout" ||
    (status === "paid" && !converted) ||
    confirming;

  const when = useMemo(() => {
    if (!slot?.date) return null;
    const d =
      typeof slot.date === "string" ? parseISO(slot.date) : new Date(slot.date);
    return {
      dateLabel: format(d, "PPP"),
      timeLabel: format(d, "p"),
      start: d,
    };
  }, [slot]);

  const counts = draft?.counts || { adults: 0, kids: 0, teens: 0 };
  const unit = {
    adult: draft?.unitPriceAdult ?? 0,
    teen: draft?.unitPriceTeen ?? draft?.unitPriceAdult ?? 0,
    kid: draft?.unitPriceKid ?? draft?.unitPriceAdult ?? 0,
  };

  const A = Number(counts.adults || 0);
  const T = Number(counts.teens || 0);
  const K = Number(counts.kids || 0);

  const lineAdult = A * unit.adult;
  const lineTeen = T * unit.teen;
  const lineKid = K * unit.kid;
  const total = lineAdult + lineTeen + lineKid;

  const apiPricing = draft?.pricing || null;
  const subtotal = Number(apiPricing?.subtotal ?? total);

  const apiTotalMaybeFinal = Number.isFinite(Number(draft?.totalAmountFinal))
    ? Number(draft.totalAmountFinal)
    : Number.isFinite(Number(draft?.totalAmount))
    ? Number(draft.totalAmount)
    : subtotal;

  const discountAmount = Number(
    apiPricing?.discountAmount ?? Math.max(0, subtotal - apiTotalMaybeFinal)
  );
  const discountLabel =
    apiPricing?.discountLabel ||
    (draft?.appliedPromoCode
      ? `Promo code ${draft.appliedPromoCode}`
      : "Discount");

  const finalTotal = Number(apiPricing?.total ?? subtotal - discountAmount);
  const durationMinutes = Number(draft?.durationMinutes || 90);

  const referenceToShow = converted
    ? bookingCode || deriveFallbackCode(bookingId)
    : `DRAFT-${draftId}`;

  function eur(n) {
    return `€${(Number(n) || 0).toFixed(2)}`;
  }

  // Text + tone for main hero
  const uiState = useMemo(() => {
    if (converted) {
      return {
        tone: "success",
        title: "You’re all set! 🎉",
        subtitle:
          "Your booking is confirmed. We’ve emailed you all the details. Save your code and date below.",
        chipLabel: "Confirmed",
      };
    }
    if (paid) {
      return {
        tone: "info",
        title: "Payment received — finishing up",
        subtitle:
          "Your payment went through. We’re finalizing your booking and will confirm via email shortly.",
        chipLabel: "Payment complete",
      };
    }
    if (processing) {
      return {
        tone: "pending",
        title: "Hold on while we confirm your booking",
        subtitle:
          "We’re still waiting for a final confirmation from the payment provider. This page updates automatically.",
        chipLabel: "Processing",
      };
    }
    return {
      tone: "neutral",
      title: "We’re checking your booking status",
      subtitle:
        "We couldn’t fully verify your payment yet. If you’ve been charged, we’ll email you as soon as it clears.",
      chipLabel: status || "Unknown status",
    };
  }, [converted, paid, processing, status]);

  function statusChip() {
    if (uiState.tone === "success") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 text-xs">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {uiState.chipLabel}
        </span>
      );
    }
    if (uiState.tone === "info") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 px-3 py-1 text-xs">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" />
          {uiState.chipLabel}
        </span>
      );
    }
    if (uiState.tone === "pending") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {uiState.chipLabel}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200 px-3 py-1 text-xs">
        {uiState.chipLabel}
      </span>
    );
  }

  // ---------- Actions ----------

  async function handlePrint() {
    if (typeof window === "undefined") return;

    const idToUse = bookingId || draftId;
    if (!idToUse) return;

    try {
      setPrinting(true);

      const res = await fetch(`/api/bookings/${idToUse}/invoice`, {
        method: "GET",
      });

      if (!res.ok) {
        console.error("Failed to fetch invoice PDF");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const printWindow = window.open(url);
      if (printWindow) {
        printWindow.addEventListener("load", () => {
          printWindow.focus();
          printWindow.print();
        });
      } else {
        window.location.href = url;
      }
    } catch (err) {
      console.error("Error printing invoice:", err);
    } finally {
      setPrinting(false);
    }
  }

  function escapeICS(text = "") {
    return String(text)
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  function handleAddToCalendar() {
    if (!when?.start) return;
    const start = when.start;
    const end = addMinutes(
      start,
      Number.isFinite(durationMinutes) ? durationMinutes : 90
    );

    const toICS = (d) =>
      d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const summary = experience?.name || "Booked Experience";
    const location = experience?.location || "";
    const description = bookingCode
      ? `Booking ${bookingCode}${
          converted ? " (Confirmed)" : paid ? " (Paid)" : ""
        }`
      : `Booking #${bookingId || draftId}${
          converted ? " (Confirmed)" : paid ? " (Paid)" : ""
        }`;

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//oasis//Booking//EN",
      "BEGIN:VEVENT",
      `UID:booking-${bookingId || draftId}@oasis`,
      `DTSTAMP:${toICS(new Date())}`,
      `DTSTART:${toICS(start)}`,
      `DTEND:${toICS(end)}`,
      `SUMMARY:${escapeICS(summary)}`,
      location ? `LOCATION:${escapeICS(location)}` : "",
      `DESCRIPTION:${escapeICS(description)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `booking-${bookingId || draftId}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function manualRefresh() {
    setTries((t) => t + 1);
  }

  // ---------- UI ----------

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f4f1ec] via-[#f8f4ee] to-[#f2ece4] print:bg-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-16 pt-24">
        {/* Top hero */}
        <section className="rounded-3xl border border-[#e3ddd2] bg-white/80 shadow-sm backdrop-blur-sm p-5 sm:p-7 lg:p-8 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-[#efe4d3] opacity-70 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-20 h-52 w-52 rounded-full bg-[#f4e8d8] opacity-70 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-6 sm:gap-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl border border-emerald-100 bg-emerald-50 flex items-center justify-center">
                {converted ? (
                  <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                ) : (
                  <Loader2 className="h-7 w-7 text-amber-600 animate-spin" />
                )}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#9a8460] mb-1.5">
                  Booking confirmation
                </p>
                <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-[#3e332a]">
                  {uiState.title}
                </h1>
                <p className="mt-2 text-sm sm:text-[15px] leading-relaxed text-[#6c5b4c] max-w-xl">
                  {uiState.subtitle}
                </p>

                {((!converted && (processing || sessionId)) || error) && (
                  <div
                    className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#efe3d1] bg-[#fdf7ef] px-3.5 py-3 text-xs text-[#6c5b4c]"
                    role="status"
                  >
                    <div className="flex items-start gap-2">
                      <Info size={14} className="mt-0.5 text-[#b17c2a]" />
                      <p className="leading-relaxed">
                        {error
                          ? error
                          : "If this takes longer than expected, check your email for confirmation. If you can’t find it, reach out and we’ll take a look."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={manualRefresh}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#d2c4ac] bg-white px-3 py-1.5 text-[11px] font-medium text-[#4b3f34] hover:bg-[#faf4eb] transition"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh status
                      </button>
                      <a
                        href="mailto:info@example.com?subject=Booking%20question"
                        className="inline-flex items-center gap-1.5 rounded-full border border-transparent bg-[#f0e3cf] px-3 py-1.5 text-[11px] font-medium text-[#4b3f34] hover:bg-[#e8d7c0] transition"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        Contact support
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right side: reference + status */}
            <div className="flex flex-col items-stretch gap-3 sm:max-w-xs lg:items-end">
              <div className="flex justify-between items-center lg:justify-end gap-3">
                <div className="hidden sm:block">{statusChip()}</div>
                <div className="sm:hidden">{statusChip()}</div>
              </div>

              <div className="rounded-2xl border border-[#e3ddd2] bg-white/80 px-4 py-3.5 text-xs text-[#645649] shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[#a18a65]">
                      {converted ? "Booking code" : "Reference"}
                    </div>
                    <div className="mt-1 font-mono text-[13px] text-[#3f342b] break-all">
                      {referenceToShow}
                    </div>
                  </div>
                </div>
                {when?.start && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#7c6a59]">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-[#8b6f47]" />
                      <span>{when.dateLabel}</span>
                    </span>
                    <span className="text-[#d2c5b5]">•</span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-[#8b6f47]" />
                      <span>{when.timeLabel}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Main content */}
        {loading ? (
          <div className="mt-8 rounded-2xl border border-[#e6dfd4] bg-white p-6 sm:p-7 shadow-sm flex items-center gap-3 text-[#5a4a3f]">
            <Loader2 className="h-5 w-5 animate-spin" />
            <div className="text-sm">
              Loading your booking details…
              <span className="block text-xs text-[#8a7c70] mt-0.5">
                This usually only takes a moment.
              </span>
            </div>
          </div>
        ) : !draft ? (
          <div className="mt-8 rounded-2xl border border-[#e6dfd4] bg-white p-6 sm:p-7 shadow-sm text-[#5a4a3f]">
            Booking not found.
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)] gap-7 lg:gap-8">
            {/* Left column */}
            <div className="space-y-6">
              {/* Experience */}
              <section className="rounded-2xl border border-[#e6dfd4] bg-white p-6 sm:p-7 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-[15px] sm:text-base font-semibold text-[#3f342b]">
                      Your experience
                    </h2>
                    <p className="mt-1 text-xs text-[#8a7c70]">
                      Save these details for check-in and arrival.
                    </p>
                  </div>
                  <div className="sm:block hidden">{statusChip()}</div>
                  <div className="sm:hidden block">{statusChip()}</div>
                </div>

                <div className="mt-4 border-t border-[#f0ebe3] pt-4 flex flex-col gap-3 text-sm text-[#4b3f34]">
                  {experience?.name && (
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 h-7 w-7 rounded-xl bg-[#f5ede0] flex items-center justify-center">
                        <Users className="h-4 w-4 text-[#8b6f47]" />
                      </div>
                      <div>
                        <p className="text-[15px] font-medium">
                          {experience.name}
                        </p>
                        {experience?.shortDescription && (
                          <p className="mt-1 text-xs text-[#8a7c70]">
                            {experience.shortDescription}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {experience?.location && (
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 h-7 w-7 rounded-xl bg-[#f5ede0] flex items-center justify-center">
                        <MapPin className="h-4 w-4 text-[#8b6f47]" />
                      </div>
                      <div className="text-sm">
                        <p className="font-medium text-[#4b3f34]">
                          Meeting point
                        </p>
                        <p className="text-sm text-[#6c5b4c]">
                          {experience.location}
                        </p>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            experience.location
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-[#8b6f47] hover:text-[#745534]"
                        >
                          Open in Maps
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}

                  {when && (
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 h-7 w-7 rounded-xl bg-[#f5ede0] flex items-center justify-center">
                        <CalendarDays className="h-4 w-4 text-[#8b6f47]" />
                      </div>
                      <div>
                        <p className="font-medium text-[#4b3f34]">
                          Date & time
                        </p>
                        <p className="text-sm text-[#6c5b4c]">
                          {when.dateLabel}
                          <span className="text-[#c2b7a5] mx-1">•</span>
                          {when.timeLabel}
                        </p>
                        <p className="mt-1 text-xs text-[#8a7c70]">
                          We recommend arriving a little early so you can get
                          settled in.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Price breakdown */}
              <section className="rounded-2xl border border-[#e6dfd4] bg-white p-6 sm:p-7 shadow-sm">
                <div className="flex items-center justify-between gap-2 text-xs text-[#8a7c70] mb-3">
                  <span className="font-semibold uppercase tracking-[0.18em]">
                    Booking summary
                  </span>
                  {discountAmount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] text-emerald-700 border border-emerald-100">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Discount applied
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-sm text-[#4b3f34]">
                  {A > 0 && (
                    <SummaryRow
                      label={`Adults × ${A}`}
                      unit={eur(unit.adult)}
                      total={eur(lineAdult)}
                    />
                  )}
                  {T > 0 && (
                    <SummaryRow
                      label={`Teens × ${T}`}
                      unit={eur(unit.teen)}
                      total={eur(lineTeen)}
                    />
                  )}
                  {K > 0 && (
                    <SummaryRow
                      label={`Kids × ${K}`}
                      unit={eur(unit.kid)}
                      total={eur(lineKid)}
                    />
                  )}
                </div>

                <div className="mt-4 space-y-1.5 text-sm text-[#4b3f34]">
                  <div className="flex items-center justify-between">
                    <span className="opacity-80">Subtotal</span>
                    <span className="font-medium">{eur(subtotal)}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="opacity-80">{discountLabel}</span>
                      <span className="font-medium">
                        −{eur(discountAmount)}
                      </span>
                    </div>
                  )}

                  <div className="pt-3 mt-2 border-t border-dashed border-[#e0d7c8] flex items-center justify-between">
                    <span className="text-sm text-[#4b3f34] font-medium">
                      Total paid
                    </span>
                    <span className="text-2xl font-bold text-[#8b6f47] tracking-wide">
                      {eur(finalTotal)}
                    </span>
                  </div>
                </div>
              </section>

              {/* Attendees */}
              {Array.isArray(draft?.attendees) &&
                draft.attendees.length > 0 && (
                  <section className="rounded-2xl border border-[#e6dfd4] bg-white p-6 sm:p-7 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-[15px] sm:text-base font-semibold text-[#3f342b]">
                        Attendees
                      </h2>
                      <p className="text-xs text-[#8a7c70]">
                        {draft.attendees.length}{" "}
                        {draft.attendees.length === 1 ? "guest" : "guests"}
                      </p>
                    </div>
                    <ul className="mt-4 space-y-2">
                      {draft.attendees.map((a, i) => (
                        <li
                          key={i}
                          className="flex items-center justify-between rounded-xl border border-[#f0ebe3] bg-[#fcfaf6] px-3.5 py-2.5 text-sm text-[#4b3f34]"
                        >
                          <div>
                            <span className="font-medium">
                              {a.firstName} {a.lastName}
                            </span>
                            {a.category && (
                              <span className="ml-2 inline-block rounded-full border border-[#e0dcd4] bg-[#faf7f1] px-2 py-0.5 text-[11px] text-[#5a4a3f]">
                                {labelForCategory(a.category)}
                              </span>
                            )}
                          </div>
                          {Number.isFinite(Number(a.age)) && (
                            <span className="text-xs text-[#7a6a58]">
                              {a.age} yrs
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
            </div>

            {/* Right column: actions + status */}
            <aside className="space-y-5 lg:space-y-6 lg:sticky lg:top-24 h-fit">
              <section className="rounded-2xl border border-[#e6dfd4] bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-[#3f342b]">
                  Next steps
                </h3>
                <p className="mt-2 text-xs text-[#8a7c70] leading-relaxed">
                  Keep your booking code handy and add the date to your
                  calendar. You’ll also receive everything by email.
                </p>

                <div className="mt-4 flex flex-col gap-2.5">
                  {when?.start && (
                    <button
                      onClick={handleAddToCalendar}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#8b6f47] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#7a5f3a] transition shadow-sm"
                    >
                      <CalendarDays className="h-4 w-4" />
                      Add to calendar
                    </button>
                  )}

                  <button
                    onClick={handlePrint}
                    disabled={printing || !bookingId}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#d2c4ac] bg-white px-4 py-2.5 text-sm text-[#4b3f34] hover:bg-[#fbf6ee] transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {printing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating invoice…
                      </>
                    ) : (
                      <>
                        <Printer className="h-4 w-4" />
                        Print invoice
                      </>
                    )}
                  </button>

                  <a
                    href="/experiences"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#d2c4ac] bg-[#fcf8f1] px-4 py-2.5 text-sm text-[#4b3f34] hover:bg-[#f6eee3] transition"
                  >
                    Browse more experiences
                  </a>
                  <a
                    href="/"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-transparent bg-[#f0e3cf] px-4 py-2.5 text-sm text-[#4b3f34] hover:bg-[#e6d4bd] transition"
                  >
                    Back to homepage
                  </a>
                </div>

                {sessionId && (
                  <details className="mt-4 text-[11px] text-[#7a6a58] break-all">
                    <summary className="cursor-pointer select-none">
                      Payment session details
                    </summary>
                    <div className="mt-1 rounded-lg bg-[#f5efe4] px-2 py-1.5">
                      {sessionId}
                    </div>
                  </details>
                )}
              </section>

              <HelpCard />
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

// ---------- Small subcomponents ----------

function SummaryRow({ label, unit, total }) {
  return (
    <div className="flex items-center justify-between">
      <span>
        {label} <span className="text-xs text-[#8a7c70]">@ {unit}</span>
      </span>
      <span className="font-semibold">{total}</span>
    </div>
  );
}

function HelpCard() {
  return (
    <section className="rounded-2xl border border-[#e6dfd4] bg-white p-6 shadow-sm">
      <h4 className="text-sm font-semibold text-[#3f342b]">Need help?</h4>
      <p className="text-sm text-[#6c5b4c] mt-2 leading-relaxed">
        If anything looks off or you’re unsure whether your booking went
        through, send us a message with your booking code and we’ll check it for
        you.
      </p>
      <a
        href="mailto:info@youroasis.gr?subject=Booking%20question"
        className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-full border border-[#d2c4ac] bg-[#fcf8f1] px-4 py-2.5 text-sm text-[#4b3f34] hover:bg-[#f6eee3] transition"
      >
        <Mail className="h-4 w-4" />
        Contact support
      </a>
    </section>
  );
}

function labelForCategory(c) {
  if (c === "adult") return "Adult (18+)";
  if (c === "kid") return "Kid (3–12)";
  if (c === "teen") return "Teen";
  return c;
}
