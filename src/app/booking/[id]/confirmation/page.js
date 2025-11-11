// src/app/booking/[id]/confirmation/page.js
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

  // NEW: store real booking code and DB status once we have them
  const [bookingCode, setBookingCode] = useState("");
  const [bookingDbStatus, setBookingDbStatus] = useState("");
  const [confirmedBookingId, setConfirmedBookingId] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [printing, setPrinting] = useState(false);

  const freeConfirmTriedRef = useRef(false);

  // Utilities
  const deriveFallbackCode = (id) =>
    id ? `BK-${String(id).padStart(6, "0")}` : "";

  async function tryFetchBookingCode(id) {
    // Try common public endpoints; gracefully fallback to BK-000123
    const endpoints = [
      `/api/bookings/${id}`, // if you have a public booking route
      `/api/bookings/${id}/public`, // alternate
    ];
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
        /* ignore and try next */
      }
    }
    return deriveFallbackCode(id);
  }

  async function confirmNow(draftId, opts = {}) {
    try {
      const res = await fetch(`/api/bookings/drafts/${draftId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts),
      });
      const j = await res.json().catch(() => ({}));

      // Follow backend’s redirectUrl on conflict
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

  useEffect(() => {
    const pi = qs.get("payment_intent");
    const sid = qs.get("session_id");

    if (!Number.isFinite(draftId) || draftId <= 0) return;
    if (!pi && !sid) return; // no identifiers → nothing to confirm

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

  // 2) Fetch draft + related info; poll until converted (or shortly after pay)
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

        const d = j?.draft || j; // support both {draft: {...}} and plain draft
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
          await confirmNow(draftId); // no session/PI needed
          return; // let next poll pick up any state change
        }

        // keep polling while not finalized (up to ~48s)
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

  // Confirm with sessionId (fires once) and CAPTURE bookingCode from response
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
        // noop; polling continues
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, draftId]);

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
    return { dateLabel: format(d, "PPP"), timeLabel: format(d, "p"), start: d };
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

  function eur(n) {
    return `€${(Number(n) || 0).toFixed(2)}`;
  }

  function statusChip() {
    if (converted) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 text-xs">
          <CheckCircle2 className="h-4 w-4" /> Confirmed
        </span>
      );
    }
    if (paid) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200 px-3 py-1 text-xs">
          <Loader2 className="h-4 w-4 animate-spin" /> Finalizing
        </span>
      );
    }
    if (processing) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 text-xs">
          <Loader2 className="h-4 w-4 animate-spin" /> Processing
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200 px-3 py-1 text-xs">
        {status || "unknown"}
      </span>
    );
  }

  async function handlePrint() {
    if (typeof window === "undefined") return;

    // Prefer the real booking id; fall back to draft if needed
    const idToUse = bookingId || draftId;
    if (!idToUse) {
      console.error("No booking id available for invoice");
      return;
    }

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

      // Open in a new window and trigger print
      const printWindow = window.open(url);
      if (printWindow) {
        printWindow.addEventListener("load", () => {
          printWindow.focus();
          printWindow.print();
        });
      } else {
        // Fallback: just open in same tab
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

  async function manualRefresh() {
    setTries((t) => t + 1);
  }

  const referenceToShow = converted
    ? bookingCode || deriveFallbackCode(bookingId)
    : `DRAFT-${draftId}`;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f7f3ed] via-[#f5f1ea] to-[#f1ece5] print:bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-20">
        {/* Hero */}
        <div className="pt-20">
          <div className="relative overflow-hidden rounded-3xl border border-[#e5e0d8] bg-[#fcf9f4] shadow-sm">
            <div className="pointer-events-none absolute -top-32 -right-32 h-72 w-72 rounded-full bg-[#e9e3d9] opacity-60 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-40 -left-24 h-72 w-72 rounded-full bg-[#efe7da] opacity-70 blur-3xl" />

            <div className="relative z-10 p-6 sm:p-10">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#e1d7c6] bg-white/70 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#8b6f47]">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Booking Confirmation
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="grid place-items-center h-12 w-12 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                      {converted ? (
                        <CheckCircle2 className="h-6 w-6" />
                      ) : (
                        <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                      )}
                    </div>
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#5a4a3f]">
                        {converted
                          ? "You’re all set!"
                          : paid
                          ? "Payment received — almost done"
                          : processing
                          ? "Thanks! Finalizing your booking…"
                          : "Booking status"}
                      </h1>
                      <p className="mt-1 text-sm text-[#6b5e53] max-w-xl">
                        {converted
                          ? "Your booking is confirmed. We’ve sent a confirmation email with all the details."
                          : paid
                          ? "Your payment was successful. We’re finishing up your booking and will confirm shortly."
                          : processing
                          ? "We’re waiting for confirmation from the payment provider. This page updates automatically."
                          : "We couldn’t verify your payment yet. If you were charged, we’ll email you as soon as it clears."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3">
                  {statusChip()}
                  <div className="rounded-2xl border border-[#e5e0d8] bg-white/60 px-4 py-3 text-xs text-right text-[#6b5e53]">
                    <div className="font-semibold text-[11px] uppercase tracking-[0.18em] text-[#9a8460]">
                      Reference
                    </div>
                    <div className="mt-1 font-mono text-sm text-[#4b3f36] break-all">
                      {referenceToShow}
                    </div>
                    {when?.start && (
                      <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#8b6f47]">
                        <CalendarDays className="h-3 w-3" />
                        <span>{when.dateLabel}</span>
                        <span className="text-[#c2b7a5]">•</span>
                        <Clock className="h-3 w-3" />
                        <span>{when.timeLabel}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {((!converted && (processing || sessionId)) || error) && (
                <div
                  className="mt-5 flex items-start gap-2 rounded-2xl border border-[#ede7db] bg-white/80 px-3.5 py-2.5 text-xs text-[#6b5e53] shadow-sm"
                  role="status"
                >
                  <Info size={14} className="mt-0.5 text-[#8b6f47]" />
                  <p className="flex-1 leading-relaxed">
                    {error
                      ? error
                      : "If this takes more than a minute, please check your email for confirmation. If you don’t see it, reach out and we’ll help."}
                  </p>
                  <button
                    onClick={manualRefresh}
                    className="inline-flex items-center gap-1 rounded-full border border-[#cdbfa9] bg-[#faf7f2] px-2.5 py-1 text-[11px] text-[#5a4a3f] hover:bg-white transition"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="mt-10 rounded-2xl border border-[#e8e5df] bg-white p-6 sm:p-8 shadow-sm text-[#5a4a3f] flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <div className="text-sm">
              Loading your booking details…
              <span className="block text-xs text-[#8a7c70] mt-0.5">
                This usually only takes a moment.
              </span>
            </div>
          </div>
        ) : !draft ? (
          <div className="mt-10 rounded-2xl border border-[#e8e5df] bg-white p-6 sm:p-8 shadow-sm text-[#5a4a3f]">
            Booking not found.
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
            {/* Left: Receipt & Details */}
            <section className="lg:col-span-2 space-y-6">
              {/* Experience Card */}
              <div className="rounded-2xl border border-[#e8e5df] bg-white p-6 sm:p-7 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-[#5a4a3f]">
                      Your booking
                    </h3>
                    <p className="mt-1 text-xs text-[#8a7c70]">
                      Keep these details handy for check-in.
                    </p>
                  </div>
                  <div>{statusChip()}</div>
                </div>

                <div className="mt-4 border-t border-[#f0ebe3] pt-4 space-y-2 text-sm text-[#5a4a3f]">
                  {experience?.name && (
                    <div className="font-medium text-[#473a30] text-base">
                      {experience.name}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    {experience?.location && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={14} className="text-[#8b6f47]" />
                        <span>{experience.location}</span>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            experience.location
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1 inline-flex items-center gap-1 text-[11px] underline text-[#6b5e53] hover:text-[#5a4a3f]"
                        >
                          Open map <ExternalLink className="h-3 w-3" />
                        </a>
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

                {/* Price breakdown */}
                <div className="mt-6 rounded-2xl border border-[#e5e0d8] bg-[#faf7f2] px-5 py-4 sm:px-6 sm:py-5 shadow-inner">
                  <div className="flex items-center justify-between gap-2 text-xs text-[#8a7c70] mb-3">
                    <span className="font-semibold uppercase tracking-[0.18em]">
                      Booking summary
                    </span>
                    {discountAmount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 border border-emerald-100">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Discount applied
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-sm text-[#5a4a3f]">
                    {A > 0 && (
                      <div className="flex items-center justify-between">
                        <span>
                          Adults × {A}{" "}
                          <span className="text-xs text-[#8a7c70]">
                            @ {eur(unit.adult)}
                          </span>
                        </span>
                        <span className="font-semibold">{eur(lineAdult)}</span>
                      </div>
                    )}
                    {T > 0 && (
                      <div className="flex items-center justify-between">
                        <span>
                          Teens × {T}{" "}
                          <span className="text-xs text-[#8a7c70]">
                            @ {eur(unit.teen)}
                          </span>
                        </span>
                        <span className="font-semibold">{eur(lineTeen)}</span>
                      </div>
                    )}
                    {K > 0 && (
                      <div className="flex items-center justify-between">
                        <span>
                          Kids × {K}{" "}
                          <span className="text-xs text-[#8a7c70]">
                            @ {eur(unit.kid)}
                          </span>
                        </span>
                        <span className="font-semibold">{eur(lineKid)}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-1.5 text-sm text-[#5a4a3f]">
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
                      <span className="text-sm text-[#5a4a3f] font-medium">
                        Total
                      </span>
                      <span className="text-2xl font-bold text-[#8b6f47] tracking-wide">
                        {eur(finalTotal)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 flex flex-wrap gap-3">
                  {when?.start && (
                    <button
                      onClick={handleAddToCalendar}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#8b6f47] px-5 py-2.5 text-white text-sm font-medium hover:bg-[#7a5f3a] transition shadow-sm"
                    >
                      <CalendarDays className="h-4 w-4" /> Add to calendar
                    </button>
                  )}
                  <button
                    onClick={handlePrint}
                    disabled={printing || !bookingId}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#cdbfa9] bg-white px-5 py-2.5 text-sm text-[#5a4a3f] hover:bg-[#fdf9f3] transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {printing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Generating
                        PDF…
                      </>
                    ) : (
                      <>
                        <Printer className="h-4 w-4" /> Print invoice
                      </>
                    )}
                  </button>

                  <a
                    href="/experiences"
                    className="inline-flex items-center justify-center rounded-full border border-[#cdbfa9] bg-white px-5 py-2.5 text-sm text-[#5a4a3f] hover:bg-[#fdf9f3] transition"
                  >
                    Explore more experiences
                  </a>
                  <a
                    href="/"
                    className="inline-flex items-center justify-center rounded-full border border-[#cdbfa9] bg-white px-5 py-2.5 text-sm text-[#5a4a3f] hover:bg-[#fdf9f3] transition"
                  >
                    Back to home
                  </a>
                </div>
              </div>

              {/* Attendees */}
              {Array.isArray(draft?.attendees) &&
                draft.attendees.length > 0 && (
                  <div className="rounded-2xl border border-[#e8e5df] bg-white p-6 sm:p-7 shadow-sm">
                    <h3 className="text-lg font-semibold text-[#5a4a3f]">
                      Attendees
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm text-[#5a4a3f]">
                      {draft.attendees.map((a, i) => (
                        <li
                          key={i}
                          className="flex items-center justify-between rounded-xl border border-[#f0ebe3] bg-[#fcfaf6] px-3 py-2"
                        >
                          <span>
                            {a.firstName} {a.lastName}
                            {a.category ? (
                              <span className="ml-2 inline-block rounded-full border border-[#e0dcd4] bg-[#faf7f1] px-2 py-0.5 text-[11px] text-[#5a4a3f]">
                                {labelForCategory(a.category)}
                              </span>
                            ) : null}
                          </span>
                          {Number.isFinite(Number(a.age)) ? (
                            <span className="text-[#7a6a58] text-xs">
                              {a.age}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </section>

            {/* Right: Status & Reference */}
            <section className="space-y-5 lg:space-y-6 lg:sticky lg:top-24 h-fit">
              <div className="rounded-2xl border border-[#e8e5df] bg-[#fcf9f4] p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-[#5a4a3f]">
                  Status overview
                </h3>
                <p className="text-sm text-[#6b5e53] mt-2 leading-relaxed">
                  {converted
                    ? "All set! Your booking is confirmed, and a confirmation email has been sent to the address you provided."
                    : paid
                    ? "Your payment is complete. We’re finalizing your booking and will confirm by email shortly."
                    : processing
                    ? "Your payment is still being confirmed. This usually only takes a few moments."
                    : "We couldn’t fully verify your payment yet. If you were charged, you’ll receive an email as soon as it clears."}
                </p>

                <div className="mt-5 grid grid-cols-1 gap-3 text-xs text-[#6b5e53]">
                  <div className="rounded-xl border border-[#e5e0d8] bg-white/90 p-3.5">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-[#9a8460]">
                      {converted ? "Booking code" : "Reference"}
                    </div>
                    <div className="mt-1 font-mono text-sm text-[#4b3f36] break-all">
                      {referenceToShow}
                    </div>
                    <p className="mt-1 text-[11px] text-[#8a7c70]">
                      Present this code if we ask for your booking details.
                    </p>
                  </div>

                  {when?.start && (
                    <div className="rounded-xl border border-[#e5e0d8] bg-white/90 p-3.5">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-[#9a8460]">
                        Start time
                      </div>
                      <div className="mt-1 text-sm text-[#4b3f36]">
                        {when.dateLabel}
                        <span className="text-[#c2b7a5] mx-1">•</span>
                        {when.timeLabel}
                      </div>
                      <p className="mt-1 text-[11px] text-[#8a7c70]">
                        Please arrive a little early to get settled.
                      </p>
                    </div>
                  )}
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
              </div>

              <HelpCard />
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function HelpCard() {
  return (
    <div className="rounded-2xl border border-[#e8e5df] bg-white p-6 shadow-sm">
      <h4 className="text-sm font-semibold text-[#5a4a3f]">Need help?</h4>
      <p className="text-sm text-[#6b5e53] mt-2 leading-relaxed">
        If anything looks off, or you’re unsure whether your booking went
        through, send us a message and we’ll check it for you.
      </p>
      <a
        href="mailto:info@example.com?subject=Booking%20question"
        className="mt-3 inline-flex items-center justify-center rounded-full border border-[#cdbfa9] bg-[#fcf9f4] px-4 py-2.5 text-sm text-[#5a4a3f] hover:bg-[#f6efe3] transition"
      >
        Contact support
      </a>
    </div>
  );
}

function labelForCategory(c) {
  if (c === "adult") return "Adult (18+)";
  if (c === "kid") return "Kid (3–12)";
  if (c === "teen") return "Teen";
  return c;
}
