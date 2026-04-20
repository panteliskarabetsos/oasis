// src/app/booking/[id]/confirmation/page.js
"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
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
  Compass,
  ArrowLeft,
  Ticket,
  FileText,
} from "lucide-react";
import { parseISO, format, addMinutes } from "date-fns";

export default function BookingConfirmationPage() {
  const { id } = useParams();
  const qs = useSearchParams();
  const router = useRouter();

  const sessionId = qs?.get("session_id"); // from Stripe success redirect
  // 🔑 SECURITY: Grab token from the URL
  const token = qs?.get("token") || "";
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
    const pi = qs?.get("payment_intent") || "";
    const sid = qs?.get("session_id") || "";
    const query = `?payment_intent=${pi}&session_id=${sid}`;

    const endpoints = [
      `/api/bookings/${id}${query}`,
      `/api/bookings/${id}/public${query}`,
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
      } catch {}
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

  useEffect(() => {
    const pi = qs?.get("payment_intent");
    const sid = qs?.get("session_id");

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
        if (data?.error)
          throw new Error(data?.error || "Could not finalize booking");

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

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        // 🔑 SECURITY: Pass the token to the draft fetch
        const res = await fetch(
          `/api/bookings/drafts/${draftId}?token=${token}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );
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
          return;
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
  }, [draftId, tries, token]); // Added token to dependencies

  useEffect(() => {
    if (!sessionId || !Number.isFinite(draftId) || draftId <= 0) return;

    (async () => {
      try {
        const res = await fetch(
          `/api/bookings/drafts/${draftId}/confirm?session_id=${encodeURIComponent(sessionId)}`,
          { method: "POST" },
        );
        const j = await res.json().catch(() => ({}));

        if (j?.bookingId && !confirmedBookingId)
          setConfirmedBookingId(j.bookingId);
        if (j?.bookingCode) setBookingCode(String(j.bookingCode));
        else if (j?.bookingId && !bookingCode)
          setBookingCode(deriveFallbackCode(j.bookingId));
        if (j?.status) setBookingDbStatus(String(j.status));

        setTries((t) => t + 1);
      } catch {}
    })();
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
    apiPricing?.discountAmount ?? Math.max(0, subtotal - apiTotalMaybeFinal),
  );

  const finalTotal = Number(apiPricing?.total ?? subtotal - discountAmount);
  const durationMinutes = Number(draft?.durationMinutes || 90);

  const referenceToShow = converted
    ? bookingCode || deriveFallbackCode(bookingId)
    : `DRAFT-${draftId}`;

  function eur(n) {
    return `€${(Number(n) || 0).toFixed(2)}`;
  }

  const uiState = useMemo(() => {
    if (converted) {
      return {
        tone: "success",
        title: "You're all set! 🎉",
        subtitle:
          "Your booking is confirmed. We've emailed you the details. Keep your booking code handy.",
        chipLabel: "Confirmed",
      };
    }
    if (paid) {
      return {
        tone: "info",
        title: "Payment received",
        subtitle:
          "Your payment went through. We're finalizing your booking and will confirm via email shortly.",
        chipLabel: "Finalizing",
      };
    }
    if (processing) {
      return {
        tone: "pending",
        title: "Confirming your booking...",
        subtitle:
          "Waiting for final confirmation from the payment provider. This page will update automatically.",
        chipLabel: "Processing",
      };
    }
    return {
      tone: "neutral",
      title: "Checking booking status",
      subtitle:
        "We couldn't fully verify your payment yet. If you've been charged, we'll email you as soon as it clears.",
      chipLabel: status || "Unknown",
    };
  }, [converted, paid, processing, status]);

  function statusChip() {
    if (uiState.tone === "success") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
          <CheckCircle2 size={12} /> {uiState.chipLabel}
        </span>
      );
    }
    if (uiState.tone === "info") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
          <Loader2 size={12} className="animate-spin" /> {uiState.chipLabel}
        </span>
      );
    }
    if (uiState.tone === "pending") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
          <Loader2 size={12} className="animate-spin" /> {uiState.chipLabel}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 text-neutral-700 border border-neutral-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
        {uiState.chipLabel}
      </span>
    );
  }

  // ---------- Actions ----------

  function manualRefresh() {
    setTries((t) => t + 1);
  }

  async function handlePrint() {
    if (typeof window === "undefined") return;
    const idToUse = bookingId || draftId;
    if (!idToUse) return;

    const printWindow = window.open("", "_blank");

    try {
      setPrinting(true);
      const res = await fetch(`/api/bookings/${idToUse}/invoice`, {
        method: "GET",
      });
      if (!res.ok) throw new Error("Fetch failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      if (printWindow) {
        printWindow.location.href = url;
        printWindow.addEventListener("load", () => {
          printWindow.focus();
          printWindow.print();
        });
      } else {
        window.location.href = url;
      }
    } catch (err) {
      if (printWindow) printWindow.close();
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
      Number.isFinite(durationMinutes) ? durationMinutes : 90,
    );

    const toICS = (d) =>
      d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const summary = experience?.name || "Booked Experience";
    const location = experience?.location || "";
    const description = bookingCode
      ? `Booking ${bookingCode}${converted ? " (Confirmed)" : paid ? " (Paid)" : ""}`
      : `Booking #${bookingId || draftId}${converted ? " (Confirmed)" : paid ? " (Paid)" : ""}`;

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

  return (
    <main className="min-h-screen bg-[#fcf9f4] font-sans pb-32 sm:pb-16 selection:bg-[#8b6f47]/20 relative overflow-hidden">
      {/* Ambient background decoration */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-[#8b6f47]/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[50%] h-[50%] rounded-full bg-[#e3ddd2]/30 blur-[100px]" />
      </div>

      {/* Top Nav */}
      <div className="bg-white border-b border-[#e5e0d8] sticky top-0 z-30 shadow-sm print:hidden">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-center relative">
          {!converted && (
            <button
              onClick={() => router.back()}
              className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 inline-flex items-center gap-2 text-[#5a4a3f] text-sm border border-[#e0dcd4] rounded-full px-4 py-2 hover:bg-[#f4f1ec] transition-all"
            >
              <ArrowLeft size={16} /> Back
            </button>
          )}
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#a09084] mx-auto">
            <Ticket size={16} className="text-[#8b6f47]" />{" "}
            {converted ? "Booking Complete" : "Processing"}
          </span>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 pt-10 sm:pt-16">
        {/* Top Hero */}
        <section className="text-center mb-10 sm:mb-14">
          <div className="mx-auto h-20 w-20 sm:h-24 sm:w-24 rounded-full flex items-center justify-center mb-6 shadow-sm border-[3px] border-white relative">
            <div className="absolute inset-0 rounded-full bg-white opacity-50 blur-md -z-10" />
            {converted ? (
              <div className="w-full h-full rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <CheckCircle2 size={40} />
              </div>
            ) : (
              <div className="w-full h-full rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <Loader2 size={40} className="animate-spin" />
              </div>
            )}
          </div>

          <h1 className="text-3xl sm:text-5xl font-serif text-[#3a2f28] mb-4">
            {uiState.title}
          </h1>
          <p className="text-[#7a6a5f] max-w-lg mx-auto text-sm sm:text-base leading-relaxed">
            {uiState.subtitle}
          </p>

          {((!converted && (processing || sessionId)) || error) && (
            <div className="mt-8 max-w-md mx-auto text-left rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-4 text-sm text-amber-900 shadow-sm backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <Info size={20} className="shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-semibold mb-1">Status Update</p>
                  <p className="text-xs leading-relaxed opacity-90 mb-3">
                    {error
                      ? error
                      : "If this takes longer than expected, check your email for confirmation. If you can't find it, reach out and we'll take a look."}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={manualRefresh}
                      className="text-[10px] font-bold uppercase tracking-wider bg-white border border-amber-200 px-3 py-1.5 rounded-md hover:bg-amber-100 transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw size={12} /> Refresh Page
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Main Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#8b6f47] mb-4" />
            <p className="text-[#7a6a5f] text-sm">Loading booking details...</p>
          </div>
        ) : !draft ? (
          <div className="text-center py-20 rounded-[2rem] border border-[#e0dcd4] bg-white shadow-sm">
            <p className="text-[#7a6a5f] text-lg">Booking not found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            {/* Left: Digital Ticket (7 cols on Desktop) */}
            <section className="lg:col-span-7 space-y-6">
              <div className="rounded-[2rem] border border-[#e0dcd4] bg-white shadow-sm overflow-hidden flex flex-col h-full relative">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#8b6f47]" />

                <div className="px-6 py-5 border-b border-[#e0dcd4] bg-[#fdfaf5] flex items-center justify-between pl-8">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#a09084] flex items-center gap-2">
                    <FileText size={16} className="text-[#8b6f47]" /> Booking
                    Details
                  </h3>
                  {statusChip()}
                </div>

                <div className="p-6 sm:p-8 pl-8">
                  {/* Reference Code Prominent */}
                  <div className="mb-8 pb-8 border-b border-[#e0dcd4] text-center sm:text-left">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#a09084] mb-2">
                      {converted ? "Booking Reference" : "Draft Reference"}
                    </p>
                    <p className="text-4xl font-mono text-[#3a2f28] tracking-tight bg-[#fdfaf5] border border-[#e0dcd4] inline-block px-4 py-2 rounded-xl shadow-inner select-all">
                      {referenceToShow}
                    </p>
                  </div>

                  <h2 className="text-2xl font-serif text-[#3a2f28] leading-tight mb-6">
                    {experience?.name}
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4 mb-8">
                    {when && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#a09084] mb-1.5">
                          Date & Time
                        </p>
                        <p className="text-sm font-medium text-[#3a2f28] flex items-center gap-2">
                          <CalendarDays size={16} className="text-[#8b6f47]" />{" "}
                          {when.dateLabel}
                        </p>
                        <p className="text-sm font-medium text-[#3a2f28] flex items-center gap-2 mt-1">
                          <Clock size={16} className="text-[#8b6f47]" />{" "}
                          {when.timeLabel}
                        </p>
                      </div>
                    )}
                    {experience?.location && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#a09084] mb-1.5">
                          Location
                        </p>
                        <p className="text-sm font-medium text-[#3a2f28] flex items-start gap-2">
                          <MapPin
                            size={16}
                            className="text-[#8b6f47] shrink-0 mt-0.5"
                          />
                          <span>{experience.location}</span>
                        </p>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(experience.location)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-bold uppercase tracking-wider text-[#8b6f47] hover:underline mt-2 inline-block pl-6"
                        >
                          View on Map{" "}
                          <ExternalLink size={10} className="inline mb-0.5" />
                        </a>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#a09084] mb-1.5">
                        Guests
                      </p>
                      <p className="text-sm font-medium text-[#3a2f28] flex items-center gap-2">
                        <Users size={16} className="text-[#8b6f47]" />
                        {A} Adults {K > 0 && `, ${K} Children`}
                      </p>
                    </div>
                  </div>

                  {Array.isArray(draft?.attendees) &&
                    draft.attendees.length > 0 && (
                      <div className="pt-6 border-t border-[#e0dcd4]">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#a09084] mb-3">
                          Guest List
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {draft.attendees.map((a, i) => (
                            <div
                              key={i}
                              className="inline-flex items-center gap-2 bg-[#fdfcfb] border border-[#e0dcd4] px-3 py-1.5 rounded-lg text-xs font-medium text-[#5a4a3f]"
                            >
                              {a.firstName} {a.lastName}{" "}
                              <span className="opacity-50">|</span>{" "}
                              <span className="text-[#8b6f47]">
                                {a.category === "kid" ? "Child" : "Adult"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Payment Summary */}
                  <div className="mt-8 pt-6 border-t border-[#e0dcd4] border-dashed">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#a09084]">
                        Payment Summary
                      </p>
                      {discountAmount > 0 && (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                          Discount Applied
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 text-sm text-[#5a4a3f] mb-4">
                      {A > 0 && (
                        <div className="flex justify-between">
                          <span>Adults × {A}</span>{" "}
                          <span>{eur(lineAdult)}</span>
                        </div>
                      )}
                      {K > 0 && (
                        <div className="flex justify-between">
                          <span>Children × {K}</span>{" "}
                          <span>{eur(lineKid)}</span>
                        </div>
                      )}
                      {discountAmount > 0 && (
                        <div className="flex justify-between text-emerald-600 font-medium">
                          <span>Discount</span>{" "}
                          <span>-{eur(discountAmount)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-[#e0dcd4]">
                      <span className="font-bold text-[#3a2f28] uppercase tracking-wider text-xs">
                        Total Paid
                      </span>
                      <span className="text-2xl font-serif text-[#8b6f47]">
                        {eur(finalTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Right: Actions (5 cols on Desktop) */}
            <aside className="lg:col-span-5 space-y-6 lg:sticky lg:top-24 h-fit print:hidden">
              <div className="rounded-[2rem] border border-[#e0dcd4] bg-white p-6 sm:p-8 shadow-sm">
                <h3 className="text-lg font-serif text-[#3a2f28] mb-2">
                  Next Steps
                </h3>
                <p className="text-xs text-[#7a6a5f] leading-relaxed mb-6">
                  You will receive an email shortly with these details. You can
                  also save them directly to your calendar or print an invoice.
                </p>

                <div className="flex flex-col gap-3">
                  {when?.start && (
                    <button
                      onClick={handleAddToCalendar}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1A1A1A] px-4 py-3.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-[#C8AA86] transition-colors shadow-md active:scale-95"
                    >
                      <CalendarDays className="h-4 w-4" /> Add to Calendar
                    </button>
                  )}

                  <button
                    onClick={handlePrint}
                    disabled={printing || !bookingId}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#e0dcd4] bg-white px-4 py-3.5 text-xs font-bold uppercase tracking-widest text-[#3a2f28] hover:bg-[#fdfcfb] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                  >
                    {printing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Printer className="h-4 w-4" />
                    )}
                    Print Invoice
                  </button>

                  <div className="h-px w-full bg-[#e0dcd4] my-3" />

                  <a
                    href="/experiences"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#e0dcd4] bg-[#fdfaf5] px-4 py-3.5 text-xs font-bold uppercase tracking-widest text-[#8b6f47] hover:bg-[#f5f1ea] transition-colors shadow-sm active:scale-95"
                  >
                    <Compass className="h-4 w-4" /> Browse More Experiences
                  </a>
                </div>

                {sessionId && (
                  <details className="mt-6 text-[10px] text-[#a09084] break-all">
                    <summary className="cursor-pointer select-none hover:text-[#8b6f47] uppercase tracking-widest font-bold">
                      Show Technical Details
                    </summary>
                    <div className="mt-2 rounded-lg bg-[#fdfcfb] border border-[#e0dcd4] p-3 font-mono">
                      Stripe Session ID:
                      <br />
                      {sessionId}
                    </div>
                  </details>
                )}
              </div>

              <div className="rounded-[2rem] border border-[#e0dcd4] bg-[#fdfcfb] p-6 shadow-sm flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#fdfaf5] border border-[#e0dcd4] flex items-center justify-center shrink-0">
                  <Info className="h-5 w-5 text-[#8b6f47]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#3a2f28] mb-1">
                    Need help?
                  </h4>
                  <p className="text-xs text-[#7a6a5f] leading-relaxed mb-3">
                    If anything looks off, send us a message with your booking
                    reference code.
                  </p>
                  <a
                    href="mailto:info@youroasis.gr?subject=Booking%20question"
                    className="text-xs font-bold uppercase tracking-wider text-[#8b6f47] hover:underline flex items-center gap-1.5"
                  >
                    <Mail className="h-3 w-3" /> Contact Support
                  </a>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
