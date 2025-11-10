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

  const freeConfirmTriedRef = useRef(false);

  async function confirmNow(draftId, opts = {}) {
    try {
      const res = await fetch(`/api/bookings/drafts/${draftId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts),
      });
      const j = await res.json().catch(() => ({}));
      if (j?.bookingId) setConfirmedBookingId(j.bookingId);
      if (j?.bookingCode) setBookingCode(String(j.bookingCode));
      if (j?.status) setBookingDbStatus(String(j.status));
      // If backend says it's converted, stop polling; otherwise nudge
      if (!(j?.converted && j?.bookingId)) setTries((t) => t + 1);
      return j;
    } catch {
      // non-fatal; polling continues
      return null;
    }
  }

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

      // NEW: follow backend’s redirectUrl on failure
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

        // If converted right now, capture & stop early
        if (data?.converted && data?.bookingId) {
          setConfirmedBookingId(data.bookingId);
          if (data.bookingCode) setBookingCode(data.bookingCode);
        } else {
          // otherwise we'll poll below
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

        // Try to read the json safely; may be 200 or 202
        const j = await res.json().catch(() => ({}));
        if (j?.bookingId && !confirmedBookingId) {
          setConfirmedBookingId(j.bookingId);
        }
        if (j?.bookingCode) {
          setBookingCode(String(j.bookingCode));
        } else if (j?.bookingId && !bookingCode) {
          // fallback if backend didn’t send a code this time
          setBookingCode(deriveFallbackCode(j.bookingId));
        }
        if (j?.status) setBookingDbStatus(String(j.status));

        // nudge polling no matter what
        setTries((t) => t + 1);
      } catch {
        // noop; polling continues
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, draftId]);

  const status = String(draft?.status || "").toLowerCase();
  const bookingId = draft?.convertedBookingId || confirmedBookingId || null;
  const converted = !!bookingId || status === "converted"; // final state in our model
  const paid =
    status === "paid" || bookingDbStatus.toLowerCase() === "paid" || converted; // converted implies paid already
  const processing =
    status === "draft" ||
    status === "checkout" ||
    (status === "paid" && !converted);

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

  // Prefer totals coming from the API if present (so discounts can be reflected)
  const apiPricing = draft?.pricing || null;
  /**
   * Expectation if you add it on the API:
   * draft.pricing = {
   *   subtotal: number,
   *   discountAmount: number,     // positive value (e.g. 12.50)
   *   discountLabel: string,      // e.g. "SUMMER10 (−10%)"
   *   total: number               // subtotal - discountAmount
   * }
   */
  const subtotal = Number(apiPricing?.subtotal ?? total);

  // Try to detect a discount even if no pricing object is present:
  // - If API exposes total after discount (e.g. draft.totalAmountFinal), prefer it
  // - Else if it only has totalAmount (may be before discount), fall back to subtotal
  const apiTotalMaybeFinal = Number.isFinite(Number(draft?.totalAmountFinal))
    ? Number(draft.totalAmountFinal)
    : Number.isFinite(Number(draft?.totalAmount))
    ? Number(draft.totalAmount)
    : subtotal;

  // If the API gave us an explicit discount, use it.
  // Otherwise infer it as the difference between subtotal and apiTotalMaybeFinal (clamped ≥ 0).
  const discountAmount = Number(
    apiPricing?.discountAmount ?? Math.max(0, subtotal - apiTotalMaybeFinal)
  );

  // Label for the discount line
  const discountLabel =
    apiPricing?.discountLabel ||
    (draft?.appliedPromoCode
      ? `Promo code ${draft.appliedPromoCode}`
      : "Discount");

  // Final total to display
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

  function handlePrint() {
    if (typeof window !== "undefined") window.print();
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

  function escapeICS(text = "") {
    return String(text)
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  async function manualRefresh() {
    setTries((t) => t + 1);
  }

  // Value to show on the sidebar card
  const referenceToShow = converted
    ? bookingCode || deriveFallbackCode(bookingId)
    : `DRAFT-${draftId}`;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f7f3ed] to-[#f4f1ec]">
      {/* Hero */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-20">
        <div className="relative overflow-hidden rounded-3xl border border-[#e5e0d8] bg-[#fcf9f4]">
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[#e9e3d9] opacity-60 blur-3xl" />
          <div className="relative z-10 p-6 sm:p-10">
            <div className="flex items-start justify-between gap-6">
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
                      ? "Booking confirmed — you're all set!"
                      : paid
                      ? "Payment received — finalizing your booking…"
                      : processing
                      ? "Thanks! Finalizing your booking…"
                      : "Booking status"}
                  </h1>
                  <div className="mt-2 text-sm text-[#6b5e53]">
                    {converted
                      ? "We’ve emailed your confirmation and details."
                      : paid
                      ? "Your payment succeeded. We’re finishing up your booking."
                      : processing
                      ? "We’re waiting for confirmation. This page updates automatically."
                      : "We couldn’t verify your payment yet."}
                  </div>
                </div>
              </div>
              <div className="shrink-0">{statusChip()}</div>
            </div>

            {((!converted && (processing || sessionId)) || error) && (
              <div
                className="mt-4 flex items-start gap-2 rounded-xl border border-[#ede7db] bg-white px-3 py-2 text-xs text-[#6b5e53] shadow-sm"
                role="status"
              >
                <Info size={14} className="mt-0.5 text-[#8b6f47]" />
                <p className="flex-1">
                  {error
                    ? error
                    : "If it takes longer than a minute, please check your email or contact us."}
                </p>
                <button
                  onClick={manualRefresh}
                  className="inline-flex items-center gap-1 rounded-full border border-[#cdbfa9] px-2.5 py-1 text-[11px] text-[#5a4a3f] hover:bg-white"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-20">
        {loading ? (
          <div className="mt-8 rounded-2xl border border-[#e8e5df] bg-white p-6 shadow-sm text-[#5a4a3f] flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading booking…
          </div>
        ) : !draft ? (
          <div className="mt-8 rounded-2xl border border-[#e8e5df] bg-white p-6 shadow-sm text-[#5a4a3f]">
            Booking not found.
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Left: Receipt & Details */}
            <section className="lg:col-span-2 space-y-6">
              {/* Experience Card */}
              <div className="rounded-2xl border border-[#e8e5df] bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[#5a4a3f]">
                    Your booking
                  </h3>
                  {statusChip()}
                </div>

                <div className="mt-3 text-sm text-[#5a4a3f] space-y-1">
                  {experience?.name && (
                    <div className="font-medium">{experience.name}</div>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    {experience?.location && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={14} className="text-[#8b6f47]" />
                        {experience.location}
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
                {/* Price breakdown */}
                <div className="mt-4 border border-[#e5e0d8] rounded-xl bg-[#faf7f2] px-6 py-4 shadow-inner">
                  <div className="space-y-1 text-sm text-[#5a4a3f]">
                    {A > 0 && (
                      <div className="flex items-center justify-between">
                        <span>
                          Adults × {A} @ {eur(unit.adult)}
                        </span>
                        <span className="font-semibold">{eur(lineAdult)}</span>
                      </div>
                    )}
                    {T > 0 && (
                      <div className="flex items-center justify-between">
                        <span>
                          Teens × {T} @ {eur(unit.teen)}
                        </span>
                        <span className="font-semibold">{eur(lineTeen)}</span>
                      </div>
                    )}
                    {K > 0 && (
                      <div className="flex items-center justify-between">
                        <span>
                          Kids × {K} @ {eur(unit.kid)}
                        </span>
                        <span className="font-semibold">{eur(lineKid)}</span>
                      </div>
                    )}
                  </div>

                  {/* Subtotal */}
                  <div className="mt-3 flex items-center justify-between text-sm text-[#5a4a3f]">
                    <span className="opacity-80">Subtotal</span>
                    <span className="font-medium">{eur(subtotal)}</span>
                  </div>

                  {/* Discount (only if > 0) */}
                  {discountAmount > 0 && (
                    <div className="mt-1 flex items-center justify-between text-sm text-[#5a4a3f]">
                      <span className="opacity-80">{discountLabel}</span>
                      <span className="font-medium">
                        −{eur(discountAmount)}
                      </span>
                    </div>
                  )}

                  <div className="mt-3 border-t border-[#e5e0d8] pt-3 flex items-center justify-between">
                    <span className="text-sm text-[#5a4a3f]">Total</span>
                    <span className="text-2xl font-bold text-[#8b6f47] tracking-wide">
                      {eur(finalTotal)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 flex flex-wrap gap-3">
                  {when?.start && (
                    <button
                      onClick={handleAddToCalendar}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#8b6f47] px-5 py-2 text-white text-sm font-medium hover:bg-[#7a5f3a] transition"
                    >
                      <CalendarDays className="h-4 w-4" /> Add to calendar
                    </button>
                  )}
                  <button
                    onClick={handlePrint}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#cdbfa9] px-5 py-2 text-sm text-[#5a4a3f] hover:bg-white transition"
                  >
                    <Printer className="h-4 w-4" /> Print receipt
                  </button>
                  <a
                    href="/experiences"
                    className="inline-flex items-center justify-center rounded-full border border-[#cdbfa9] px-5 py-2 text-sm text-[#5a4a3f] hover:bg-white transition"
                  >
                    Explore more experiences
                  </a>
                  <a
                    href="/"
                    className="inline-flex items-center justify-center rounded-full border border-[#cdbfa9] px-5 py-2 text-sm text-[#5a4a3f] hover:bg-white transition"
                  >
                    Back to home
                  </a>
                </div>
              </div>

              {/* Optional details card */}
              {Array.isArray(draft?.attendees) &&
                draft.attendees.length > 0 && (
                  <div className="rounded-2xl border border-[#e8e5df] bg-white p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-[#5a4a3f]">
                      Attendees
                    </h3>
                    <ul className="mt-3 space-y-1 text-sm text-[#5a4a3f]">
                      {draft.attendees.map((a, i) => (
                        <li
                          key={i}
                          className="flex items-center justify-between"
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
            <section className="space-y-6 lg:sticky lg:top-24">
              <div className="rounded-2xl border border-[#e8e5df] bg-[#fcf9f4] p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-[#5a4a3f]">Status</h3>
                <p className="text-sm text-[#5a4a3f] mt-2">
                  {converted
                    ? "All set! Your booking is confirmed. We’ve emailed your details."
                    : paid
                    ? "Your payment is complete. We’re finalizing your booking."
                    : processing
                    ? "Your payment is being confirmed. This usually takes a few seconds."
                    : "We couldn’t verify your payment yet. If you were charged, we’ll email you as soon as it clears."}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-[#6b5e53]">
                  <div className="rounded-lg border border-[#e5e0d8] bg-white p-3">
                    <div className="text-[11px]">
                      {converted ? "Booking Code" : "Reference"}
                    </div>
                    <div className="font-medium text-[#5a4a3f] break-all">
                      {referenceToShow}
                    </div>
                  </div>
                  {when?.start && (
                    <div className="rounded-lg border border-[#e5e0d8] bg-white p-3">
                      <div className="text-[11px]">Starts</div>
                      <div className="font-medium text-[#5a4a3f]">
                        {when.dateLabel}, {when.timeLabel}
                      </div>
                    </div>
                  )}
                </div>

                {sessionId && (
                  <details className="mt-3 text-[11px] text-[#7a6a58] break-all">
                    <summary className="cursor-pointer select-none">
                      Payment session
                    </summary>
                    <div className="mt-1">{sessionId}</div>
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
      <p className="text-sm text-[#6b5e53] mt-2">
        Questions about your booking? Email us and we’ll help you out.
      </p>
      <a
        href="mailto:info@example.com?subject=Booking%20question"
        className="mt-3 inline-flex items-center justify-center rounded-full border border-[#cdbfa9] px-4 py-2 text-sm text-[#5a4a3f] hover:bg-[#fcf9f4] transition"
      >
        Contact support
      </a>
    </div>
  );
}

function labelForCategory(c) {
  if (c === "adult") return "Adult (18+)";
  if (c === "kid") return "Kid (3–12)";
  return c;
}
