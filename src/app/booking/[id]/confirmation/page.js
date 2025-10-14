// src/app/booking/[id]/confirmation/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
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

  // Fetch draft + related info; poll until converted (or for a short time after pay)
  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/bookings/drafts/${draftId}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || "Could not load booking");
        }

        const data = await res.json();
        if (!alive) return;

        const d = data?.draft || data; // support both {draft: {...}} and plain draft
        setDraft(d);
        setExperience(data?.experience || d?.experience || null);
        setSlot(data?.slot || d?.slot || null);
        setError("");

        // keep polling while not finalized
        const status = String(d?.status || "").toLowerCase();
        const converted = !!d?.convertedBookingId || status === "converted";
        if (!converted && tries < 12) {
          setTimeout(() => setTries((t) => t + 1), 4000); // ~48s total
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
    };
  }, [draftId, tries]);

  // Confirm with sessionId (fires once)
  useEffect(() => {
    if (!sessionId || !Number.isFinite(draftId) || draftId <= 0) return;

    (async () => {
      try {
        await fetch(
          `/api/bookings/drafts/${draftId}/confirm?session_id=${encodeURIComponent(
            sessionId
          )}`,
          { method: "POST" }
        );
        setTries((t) => t + 1); // nudge polling
      } catch {
        // noop; polling continues
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, draftId]);

  const status = String(draft?.status || "").toLowerCase();
  const bookingId = draft?.convertedBookingId || null;
  const converted = !!bookingId || status === "converted"; // final state in our new model
  const paid = status === "paid" || converted; // converted implies paid already
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
    const description = `Booking #${bookingId || draftId}${
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
                  <div className="mt-3 border-t border-[#e5e0d8] pt-3 flex items-center justify-between">
                    <span className="text-sm text-[#5a4a3f]">Total</span>
                    <span className="text-2xl font-bold text-[#8b6f47] tracking-wide">
                      {eur(total)}
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
                      {converted ? "Booking ID" : "Reference"}
                    </div>
                    <div className="font-medium text-[#5a4a3f]">
                      {converted ? bookingId : draftId}
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
