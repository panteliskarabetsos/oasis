// src/app/check-availability/[id]/page.js
"use client";

import { enGB } from "date-fns/locale";
import { useEffect, useMemo, useRef, useState, useId } from "react";
import { useParams, useRouter } from "next/navigation";
import { format, isSameDay, parseISO } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import toast from "react-hot-toast";
import {
  CalendarDays,
  Clock,
  Users,
  Loader2,
  Minus,
  Plus,
  ArrowLeft,
  MapPin,
  Info,
  PauseCircle,
  CheckCircle2,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Helper utils                                 */
/* -------------------------------------------------------------------------- */

const formatEuro = (n) => `€${(Number(n) || 0).toFixed(2)}`;
const toNum = (x) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};
const normalizePricing = (exp) => {
  const pj = exp?.pricing || {};
  const adult = toNum(pj.adult ?? exp?.priceAdult ?? exp?.price ?? 0);
  const kid = toNum(pj.kid ?? exp?.priceKid ?? adult);
  return { adult, kid };
};

/* -------------------------------------------------------------------------- */
/* Main component                               */
/* -------------------------------------------------------------------------- */

export default function CheckAvailabilityPage() {
  const router = useRouter();
  const { slug } = useParams();

  // Experience + availability
  const [experience, setExperience] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Group split
  const [adults, setAdults] = useState(1);
  const [kids, setKids] = useState(0);

  const prices = useMemo(() => normalizePricing(experience), [experience]);
  const fromPrice = useMemo(() => {
    const arr = [prices.adult, prices.kid].filter((v) => v > 0);
    return arr.length ? Math.min(...arr) : null;
  }, [prices]);

  // Line items + total
  const lineAdult = adults * prices.adult;
  const lineKid = kids * prices.kid;
  const totalPrice = lineAdult + lineKid;

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Global booking settings ---
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [globalSettings, setGlobalSettings] = useState({
    bookingsPaused: false,
    bookingsPausedUntil: null,
    bookingsPausedMessage: "",
  });

  const slotsContainerRef = useRef(null);
  const timesListRef = useRef(null);

  // Remaining capacity per calendar day (not per time)
  const countsByYMD = useMemo(() => {
    const m = new Map();
    for (const s of availableSlots) {
      const d = parseISO(s.date);
      const ymd = [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
      ].join("-");
      const remaining =
        typeof s.available === "number"
          ? s.available
          : Math.max(0, (s.totalSlots ?? 0) - (s.booked ?? s.bookedSlots ?? 0));
      m.set(ymd, (m.get(ymd) || 0) + remaining);
    }
    return m;
  }, [availableSlots]);

  // Buckets for calendar coloring
  const availabilityBuckets = useMemo(() => {
    const plenty = [],
      some = [],
      few = [];
    countsByYMD.forEach((remaining, ymd) => {
      if (remaining >= 6) plenty.push(new Date(ymd));
      else if (remaining >= 4) some.push(new Date(ymd));
      else if (remaining >= 1) few.push(new Date(ymd));
    });
    return { plenty, some, few };
  }, [countsByYMD]);

  // Fetch global settings (public GET)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setSettingsLoading(true);
        const res = await fetch("/api/settings/bookings", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("settings GET failed");
        const data = await res.json();
        if (alive) setGlobalSettings(data || {});
      } catch {
        if (alive) {
          setGlobalSettings({
            bookingsPaused: false,
            bookingsPausedUntil: null,
            bookingsPausedMessage: "",
          });
        }
      } finally {
        if (alive) setSettingsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // run cleanup once when this page loads
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        await fetch("/api/cleanupDrafts", {
          method: "POST",
          cache: "no-store",
          signal: controller.signal,
        });
      } catch (e) {
        // silent fail; we don't want to block the UI
        console.warn("[check-availability] cleanupDrafts failed", e);
      }
    })();
    return () => controller.abort();
  }, []);

  const pausedNow = useMemo(() => {
    const paused = !!globalSettings.bookingsPaused;
    if (!paused) return false;
    const until = globalSettings.bookingsPausedUntil
      ? new Date(globalSettings.bookingsPausedUntil)
      : null;
    return !until || Date.now() < until.getTime();
  }, [globalSettings]);

  // Fetch experience & slots
  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        setLoadingSlots(true);
        const expRes = await fetch(`/api/experiences/${slug}`, {
          cache: "no-store",
        });
        if (!expRes.ok) throw new Error("Experience not found");
        const exp = await expRes.json();
        setExperience(exp);

        const slotsRes = await fetch(
          `/api/public/schedule?experienceId=${exp.id}`,
          { cache: "no-store" },
        );
        const slots = (await slotsRes.json()) || [];
        const now = new Date();
        const futureOnly = slots.filter((s) => {
          if (s.isCancelled) return false;
          const dt = parseISO(s.date);
          return dt.getTime() >= now.getTime();
        });
        setAvailableSlots(futureOnly);

        const firstDay = earliestDayWithAvailability(futureOnly);
        if (firstDay) setSelectedDate(firstDay);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load experience or availability.");
      } finally {
        setLoadingSlots(false);
      }
    })();
  }, [slug]);

  // Reset slot when date changes + scroll to times
  useEffect(() => {
    setSelectedSlotId(null);
    if (selectedDate && slotsContainerRef.current) {
      setTimeout(() => {
        slotsContainerRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 50);
    }
  }, [selectedDate]);

  // Calendar helpers
  const availableDates = useMemo(
    () => availableSlots.map((s) => parseISO(s.date)),
    [availableSlots],
  );

  const slotsOnSelectedDay = useMemo(() => {
    if (!selectedDate) return [];
    return availableSlots
      .filter((s) => isSameDay(parseISO(s.date), selectedDate))
      .sort((a, b) => parseISO(a.date) - parseISO(b.date));
  }, [availableSlots, selectedDate]);

  const selectedSlot = useMemo(
    () => availableSlots.find((s) => s.id === selectedSlotId) || null,
    [availableSlots, selectedSlotId],
  );

  // Hard cap per booking
  const MAX_PER_BOOKING = 8;

  // Derive availability for the selected slot
  const availablePlaces = selectedSlot
    ? Math.max(
        0,
        selectedSlot.available ??
          Number(selectedSlot.totalSlots || 0) -
            Number(selectedSlot.bookedSlots || 0),
      )
    : 0;

  const totalPeople = (Number(adults) || 0) + (Number(kids) || 0);

  // What this booking is allowed to take right now
  const bookingCap = Math.min(MAX_PER_BOOKING, availablePlaces);

  // Clamp a counter so total never exceeds `bookingCap`
  const clampGroup = (nextValue, min, who) => {
    const n = Math.max(min, Number(nextValue) || 0);
    const others = who === "adults" ? Number(kids) || 0 : Number(adults) || 0;
    const maxForThis = Math.max(min, bookingCap - others);
    return Math.min(n, maxForThis);
  };

  const canContinue =
    !!selectedSlotId &&
    totalPeople >= 1 &&
    totalPeople <= bookingCap &&
    !pausedNow;

  async function handleContinue() {
    if (!canContinue) {
      toast.error("Select a time and valid group size.");
      return;
    }
    try {
      setIsSubmitting(true);
      const payload = {
        experienceId: experience.id,
        scheduleSlotId: selectedSlotId,
        counts: { adults, kids },
      };
      const res = await fetch("/api/bookings/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Could not start booking.");
      }
      const data = await res.json();

      // pass expiresAt to the next step
      const params = new URLSearchParams();
      if (data.expiresAt) params.set("expiresAt", data.expiresAt);
      const qs = params.toString();
      router.push(`/booking/${data.id}/attendees${qs ? `?${qs}` : ""}`);
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasAnySlots = availableSlots.length > 0;
  const firstImage =
    Array.isArray(experience?.images) && experience.images.length
      ? experience.images[0]
      : null;

  const step = !selectedDate ? 1 : !selectedSlotId ? 2 : 3;

  /* Day content with small availability dot */
  const DayContent = (props) => {
    const { children } = props;
    return (
      <span className="relative inline-flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-full text-[13px]">
        {children}
      </span>
    );
  };

  const tz = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  const priceLiveId = useId();

  return (
    <main className="relative min-h-screen bg-[#f4f1ec] text-[#2f2f2f] overflow-x-clip selection:bg-[#8b6f47] selection:text-white">
      {/* Ambient blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-10 h-[30rem] w-[30rem] rounded-full bg-[#e8dfcf]/60 blur-3xl" />
        <div className="absolute top-40 -right-24 h-[35rem] w-[35rem] rounded-full bg-[#d7c6af]/40 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.05] [background:radial-gradient(circle_at_center,rgba(90,74,63,0.4)_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      <div className="relative pt-16 sm:pt-8 pb-32">
        {/* Top bar */}
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <div className="flex items-center justify-between pb-4">
            <button
              onClick={() => router.back()}
              className="group flex items-center gap-2 pr-5 pl-3 py-1.5 rounded-full border border-[#d3c2aa] bg-white/60 backdrop-blur-sm hover:bg-white text-[#5a4a3f] transition-all duration-300 shadow-sm"
            >
              <div className="bg-[#f4ede4] text-[#8b6f47] rounded-full p-1 group-hover:-translate-x-1 transition-transform">
                <ArrowLeft size={14} />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest">
                Back
              </span>
            </button>
            {experience?.name && (
              <div className="hidden sm:flex items-center gap-2 text-[#8b6f47] text-[10px] font-bold uppercase tracking-widest bg-white/50 px-3 py-1.5 rounded-full border border-[#e2d7c7]">
                <Users size={12} /> Max {MAX_PER_BOOKING} guests
              </div>
            )}
          </div>
        </div>

        {/* Header banner */}
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          {/* Reduced border radius and padding to make it thinner */}
          <div className="relative overflow-hidden rounded-[2rem] border border-[#e2d7c7] bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="absolute inset-0 bg-gradient-to-r from-[#fdfbf9] via-white/80 to-[#fdfbf9]" />
            {firstImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={firstImage}
                alt={experience?.name || "Experience"}
                className="absolute inset-0 h-full w-full object-cover opacity-10 mix-blend-multiply pointer-events-none"
              />
            )}

            <div className="relative z-10 p-6 sm:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-col gap-2 max-w-2xl">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8b6f47]">
                    Availability & Booking
                  </span>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif text-[#3a2f28] leading-[1.1]">
                    {experience?.name || "Experience"}
                  </h1>
                  {experience?.location && (
                    <p className="flex items-center gap-1.5 text-sm text-[#6b625a]">
                      <MapPin size={14} className="text-[#8b6f47]" />
                      {experience.location}
                    </p>
                  )}
                </div>

                {fromPrice !== null && (
                  <div className="flex flex-col items-start lg:items-end">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8b7a6b] mb-1">
                      Starting from
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl sm:text-3xl font-serif text-[#1A1A1A]">
                        {formatEuro(fromPrice)}
                      </span>
                      <span className="text-sm text-[#a7988a]">/ person</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Stepper */}
              <div className="mt-6 max-w-3xl">
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <Step
                    num={1}
                    label="Date"
                    active={step >= 1}
                    done={step > 1}
                  />
                  <Step
                    num={2}
                    label="Time"
                    active={step >= 2}
                    done={step > 2}
                  />
                  <Step num={3} label="Guests" active={step >= 3} />
                </div>
                <div className="h-1 w-full rounded-full bg-[#f4ede4] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#8b6f47] transition-all duration-500 ease-out"
                    style={{ width: `${(step / 3) * 100}%` }}
                    aria-hidden
                  />
                </div>
              </div>

              {/* Info / Pause banner */}
              {settingsLoading ? (
                <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#e2d7c7] bg-[#fdfbf9] px-4 py-3 text-sm text-[#6b625a] max-w-3xl">
                  <Loader2 className="h-4 w-4 animate-spin text-[#8b6f47]" />
                  Checking availability status...
                </div>
              ) : pausedNow ? (
                <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 max-w-3xl shadow-sm">
                  <PauseCircle size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold">
                      Bookings are temporarily paused.
                    </p>
                    {globalSettings.bookingsPausedUntil && (
                      <p className="mt-1 opacity-90 text-xs">
                        Resuming after{" "}
                        <span className="font-semibold">
                          {format(
                            new Date(globalSettings.bookingsPausedUntil),
                            "PPpp",
                          )}
                        </span>
                        .
                      </p>
                    )}
                    {globalSettings.bookingsPausedMessage && (
                      <p className="mt-1 opacity-90 text-xs">
                        {globalSettings.bookingsPausedMessage}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#e2d7c7] bg-[#fdfbf9] px-4 py-3 text-xs sm:text-sm text-[#6b625a] max-w-3xl">
                  <div className="flex items-center gap-2">
                    <Info size={16} className="text-[#8b6f47] shrink-0" />
                    <p>Select your date, time, and group size to continue.</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#a7988a] whitespace-nowrap bg-white px-2.5 py-1 rounded-full border border-[#e2d7c7]">
                    Times in {tz}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="mx-auto max-w-6xl px-4 sm:px-8 pt-6 md:pt-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8 md:gap-10">
            {/* Left: Calendar */}
            <section
              className={`relative rounded-[2rem] border border-[#e2d7c7] bg-white p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ${
                pausedNow ? "opacity-75 pointer-events-none" : ""
              }`}
            >
              {/* Header row: selected date + quick actions */}
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-serif text-xl sm:text-2xl text-[#3a2f28] mb-1">
                    1. Choose a date
                  </h2>
                  {selectedDate ? (
                    <SelectedDatePill
                      date={selectedDate}
                      onClear={() => setSelectedDate(null)}
                    />
                  ) : (
                    <span className="text-sm text-[#8b7a6b]">
                      Select an available highlighted day.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDate(new Date())}
                    className="rounded-full border border-[#d3c2aa] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#5a4a3f] bg-white hover:bg-[#f4ede4] transition-colors"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = earliestDayWithAvailability(availableSlots);
                      if (d && !pausedNow) setSelectedDate(d);
                    }}
                    className="rounded-full bg-[#1A1A1A] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-[#8b6f47] transition-all disabled:opacity-50 disabled:bg-[#d3c2aa]"
                    disabled={!hasAnySlots}
                  >
                    First available
                  </button>
                </div>
              </div>

              {loadingSlots ? (
                <SkeletonCalendar />
              ) : !hasAnySlots ? (
                <div className="py-16 text-center text-[#5a4a3f]">
                  <div className="w-16 h-16 bg-[#f4ede4] text-[#8b6f47] rounded-full flex items-center justify-center mx-auto mb-4">
                    <CalendarDays size={24} />
                  </div>
                  <p className="font-serif text-xl mb-2">
                    No upcoming availability.
                  </p>
                  <p className="text-sm text-[#7a6a5a]">
                    Please check back soon or reach out for a private booking.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex justify-center border border-[#f4ede4] rounded-[1.5rem] p-4 sm:p-6 bg-[#fcfbf9]">
                    <DayPicker
                      mode="single"
                      selected={selectedDate}
                      onSelect={(d) => !pausedNow && setSelectedDate(d || null)}
                      showOutsideDays
                      fixedWeeks
                      captionLayout="buttons"
                      fromMonth={new Date()}
                      toMonth={
                        new Date(new Date().setMonth(new Date().getMonth() + 6))
                      }
                      fromYear={new Date().getFullYear()}
                      toYear={new Date().getFullYear() + 1}
                      locale={enGB}
                      modifiers={{
                        plenty: availabilityBuckets.plenty,
                        some: availabilityBuckets.some,
                        few: availabilityBuckets.few,
                        weekend: { dayOfWeek: [0, 6] },
                      }}
                      disabled={[
                        { before: new Date() },
                        (date) =>
                          !availableDates.some((d) => isSameDay(d, date)),
                      ]}
                      className="inline-block"
                      classNames={{
                        root: "rdp-root",
                        caption:
                          "rdp-caption mb-6 flex items-center justify-between text-[#3a2f28]",
                        caption_label:
                          "text-xl font-serif font-semibold tracking-tight",
                        nav: "rdp-nav flex items-center gap-2",
                        nav_button:
                          "rdp-nav_button h-9 w-9 grid place-items-center rounded-full border border-[#e2d7c7] hover:border-[#8b6f47] hover:text-[#8b6f47] bg-white text-[#6b625a] transition-all",
                        table:
                          "rdp-table border-separate border-spacing-y-2 border-spacing-x-2",
                        head_row: "rdp-head_row",
                        head_cell:
                          "rdp-head_cell text-[10px] font-bold text-[#a7988a] pb-3 uppercase tracking-[0.2em]",
                        row: "rdp-row",
                        cell: "rdp-cell text-center align-middle h-10 w-10 sm:h-11 sm:w-11 [&_.rdp-day_selected]:!bg-[#8b6f47] [&_.rdp-day_selected]:!text-white",
                        day: "rdp-day !rounded-full focus:outline-none focus:ring-2 focus:ring-[#8b6f47] transition-all duration-200 text-sm font-medium text-[#5a4a3f]",
                        day_selected:
                          "rdp-day_selected !bg-[#8b6f47] !text-white !rounded-full shadow-md font-bold",
                        day_today:
                          "rdp-day_today border-2 border-[#8b6f47] text-[#8b6f47] font-bold bg-white",
                        day_outside:
                          "rdp-day_outside text-[#d3c2aa] font-normal",
                        day_disabled:
                          "rdp-day_disabled text-[#d3c2aa] opacity-50",
                      }}
                      modifiersClassNames={{
                        plenty:
                          "bg-[#eaf0ea] hover:bg-[#d8e6d8] text-[#3e5c46]",
                        some: "bg-[#f4efe8] hover:bg-[#ebdccc] text-[#5a4a3f]",
                        few: "bg-[#fdf3e1] hover:bg-[#fae2b8] text-[#8b6324]",
                        weekend: "", // Handled naturally or add subtle bg if desired
                      }}
                      components={{ DayContent }}
                    />
                  </div>

                  <Legend />
                </>
              )}
            </section>

            {/* Right: Times + Group */}
            <section className="space-y-6 md:space-y-8" ref={slotsContainerRef}>
              {/* Times Box */}
              <div
                className={`rounded-[2rem] border border-[#e2d7c7] bg-white p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ${
                  pausedNow ? "opacity-60 pointer-events-none" : ""
                }`}
              >
                <h3 className="mb-4 sm:mb-6 text-xl sm:text-2xl font-serif text-[#3a2f28]">
                  2. Select a time
                </h3>

                {!selectedDate ? (
                  <div className="flex items-center gap-3 p-4 bg-[#fcfbf9] border border-[#f4ede4] rounded-2xl text-[#6b625a] text-sm">
                    <Clock className="w-5 h-5 text-[#8b6f47]" />
                    Choose a date to see available times.
                  </div>
                ) : slotsOnSelectedDay.length === 0 ? (
                  <div className="flex items-center gap-3 p-4 bg-[#fdf3f3] border border-[#fbe5e5] rounded-2xl text-[#a34b4b] text-sm">
                    <Clock className="w-5 h-5" />
                    No availability for {format(selectedDate, "MMM d, yyyy")}.
                  </div>
                ) : (
                  <div
                    ref={timesListRef}
                    role="radiogroup"
                    aria-label="Available start times"
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                  >
                    {slotsOnSelectedDay.map((slot) => {
                      const available =
                        typeof slot.available === "number"
                          ? slot.available
                          : Math.max(
                              0,
                              (slot.totalSlots ?? 0) -
                                (slot.booked ?? slot.bookedSlots ?? 0),
                            );
                      const isSelected = selectedSlotId === slot.id;
                      const isDisabled = pausedNow || available <= 0;
                      const time = format(parseISO(slot.date), "p");

                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() =>
                            !isDisabled && setSelectedSlotId(slot.id)
                          }
                          disabled={isDisabled}
                          role="radio"
                          aria-checked={isSelected}
                          className={`relative flex items-center justify-between rounded-2xl border p-4 text-left transition-all duration-300 outline-none focus:ring-2 focus:ring-[#8b6f47] ${
                            isDisabled
                              ? "bg-[#fcfbf9] border-[#e2d7c7] opacity-60 cursor-not-allowed"
                              : isSelected
                                ? "bg-[#f4ede4] border-[#8b6f47] shadow-sm"
                                : "bg-white border-[#e2d7c7] hover:border-[#8b6f47] hover:bg-[#fcfbf9]"
                          }`}
                        >
                          <div>
                            <div
                              className={`text-base font-bold ${isSelected ? "text-[#8b6f47]" : "text-[#3a2f28]"}`}
                            >
                              {time}
                            </div>
                            <div
                              className={`text-[11px] font-bold uppercase tracking-wider mt-0.5 ${
                                available <= 0
                                  ? "text-[#a7988a]"
                                  : "text-[#5e8c6a]"
                              }`}
                            >
                              {available <= 0 ? "Booked" : `${available} spots`}
                            </div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                              isSelected
                                ? "border-[#8b6f47] bg-[#8b6f47]"
                                : "border-[#d3c2aa] bg-white"
                            }`}
                          >
                            {isSelected && (
                              <div className="w-2 h-2 rounded-full bg-white" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Group & Summary Box */}
              <div
                className={`rounded-[2rem] border border-[#e2d7c7] bg-white p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] lg:sticky lg:top-8 ${pausedNow ? "opacity-60 pointer-events-none" : ""}`}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl sm:text-2xl font-serif text-[#3a2f28]">
                    3. Who's coming?
                  </h3>
                  {(adults !== 1 || kids !== 0) && (
                    <button
                      type="button"
                      className="text-[11px] font-bold uppercase tracking-wider text-[#8b6f47] hover:text-[#5a4a3f] transition-colors bg-[#f4ede4] px-3 py-1.5 rounded-full"
                      onClick={() => {
                        setAdults(1);
                        setKids(0);
                      }}
                    >
                      Reset
                    </button>
                  )}
                </div>

                <div className="space-y-3 mb-6">
                  <Counter
                    label="Adults"
                    sublabel="Ages 15+"
                    value={adults}
                    onChange={(v) => setAdults(clampGroup(v, 1, "adults"))}
                    min={1}
                    disabled={!selectedSlot || pausedNow || bookingCap === 0}
                  />
                  <Counter
                    label="Kids"
                    sublabel="Ages 3–14"
                    value={kids}
                    onChange={(v) => setKids(clampGroup(v, 0, "kids"))}
                    disabled={!selectedSlot || pausedNow || bookingCap === 0}
                  />
                </div>

                {selectedSlot && (
                  <div className="bg-[#fcfbf9] border border-[#f4ede4] rounded-2xl p-4 mb-6">
                    <p className="text-xs text-[#6b625a] flex items-center justify-between">
                      <span className="font-medium text-[#3a2f28]">
                        Total Guests: {totalPeople}
                      </span>
                      <span>Max {MAX_PER_BOOKING} / booking</span>
                    </p>
                    <CapacityBar
                      total={selectedSlot.totalSlots}
                      booked={
                        selectedSlot.booked ??
                        selectedSlot.bookedSlots ??
                        Math.max(
                          0,
                          (selectedSlot.totalSlots ?? 0) -
                            (selectedSlot.available ?? 0),
                        )
                      }
                    />
                  </div>
                )}

                {/* Price summary */}
                <div
                  id={priceLiveId}
                  role="status"
                  aria-live="polite"
                  className="rounded-2xl border border-[#e2d7c7] bg-[#fdfbf9] p-5 shadow-sm"
                >
                  <div className="space-y-3 text-sm text-[#5a4a3f]">
                    {adults > 0 && (
                      <div className="flex items-center justify-between">
                        <span>Adults × {adults}</span>
                        <span>{formatEuro(lineAdult)}</span>
                      </div>
                    )}
                    {kids > 0 && (
                      <div className="flex items-center justify-between">
                        <span>Kids × {kids}</span>
                        <span>{formatEuro(lineKid)}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 border-t border-[#e2d7c7] pt-4 flex items-center justify-between">
                    <span className="text-base font-bold text-[#3a2f28]">
                      Total Price
                    </span>
                    <span className="text-2xl font-serif text-[#8b6f47]">
                      {formatEuro(totalPrice)}
                    </span>
                  </div>
                </div>

                {/* Continue (desktop) */}
                <button
                  onClick={handleContinue}
                  disabled={!canContinue || isSubmitting}
                  className={`mt-6 w-full py-4 rounded-full text-[11px] sm:text-xs font-bold uppercase tracking-[0.15em] transition-all duration-300 flex items-center justify-center gap-2 shadow-lg sm:flex ${
                    !canContinue
                      ? "bg-[#d3c2aa] cursor-not-allowed text-white opacity-80"
                      : "bg-[#1A1A1A] hover:bg-[#8b6f47] hover:shadow-xl hover:-translate-y-0.5 text-white"
                  }`}
                >
                  {pausedNow ? (
                    "Bookings Paused"
                  ) : isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Securing Spot...
                    </>
                  ) : !selectedSlotId ? (
                    "Select a Time to Continue"
                  ) : totalPeople <= 0 ? (
                    "Add Guests"
                  ) : (
                    "Continue to Details"
                  )}
                </button>
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* Mobile sticky action bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 border-t border-[#e2d7c7] bg-white/90 backdrop-blur-xl px-6 py-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-50">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#a7988a]">
              Total
            </span>
            <span className="text-2xl font-serif text-[#8b6f47] leading-none mt-1">
              {formatEuro(totalPrice)}
            </span>
          </div>
          <button
            onClick={handleContinue}
            disabled={!canContinue || isSubmitting}
            className={`flex-1 justify-center py-3.5 rounded-full text-[11px] font-bold uppercase tracking-[0.1em] transition-all flex items-center gap-2 shadow-md ${
              !canContinue
                ? "bg-[#d3c2aa] cursor-not-allowed text-white"
                : "bg-[#1A1A1A] hover:bg-[#8b6f47] text-white active:scale-95"
            }`}
          >
            {pausedNow ? (
              "Paused"
            ) : isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : !selectedSlotId ? (
              "Select Time"
            ) : (
              "Continue"
            )}
          </button>
        </div>
      </div>
    </main>
  );
}

/* -------------------------------- Subcomponents ------------------------------- */

function Step({ num, label, active, done }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div
          className={`flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
            done
              ? "bg-[#8b6f47] text-white"
              : active
                ? "bg-[#1A1A1A] text-white"
                : "bg-[#e2d7c7] text-[#a7988a]"
          }`}
        >
          {done ? <CheckCircle2 size={12} strokeWidth={3} /> : num}
        </div>
        <span
          className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${active ? "text-[#3a2f28]" : "text-[#a7988a]"}`}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

function CapacityBar({ total = 0, booked = 0 }) {
  const available = Math.max(0, (total ?? 0) - (booked ?? 0));
  const usedPct =
    total > 0 ? Math.min(100, Math.round((booked / total) * 100)) : 0;
  const tone =
    usedPct >= 80
      ? "bg-[#c46c6c]"
      : usedPct >= 50
        ? "bg-[#d49a5b]"
        : "bg-[#5e8c6a]";

  return (
    <div className="mt-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e2d7c7]">
        <div
          className={`h-full ${tone} transition-all duration-500`}
          style={{ width: `${usedPct}%` }}
        />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#a7988a] mt-1.5 text-right">
        {available} spots remaining
      </p>
    </div>
  );
}

function Counter({
  label,
  sublabel,
  value,
  onChange,
  min = 0,
  disabled = false,
}) {
  const inputId = useId();
  return (
    <div className="flex items-center justify-between bg-[#fcfbf9] border border-[#e2d7c7] rounded-2xl p-3 sm:p-4 transition-colors hover:border-[#d3c2aa]">
      <div className="flex flex-col">
        <label htmlFor={inputId} className="text-sm font-bold text-[#3a2f28]">
          {label}
        </label>
        <span className="text-[11px] text-[#8b7a6b]">{sublabel}</span>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => !disabled && onChange(Math.max(min, (value || 0) - 1))}
          disabled={disabled || value <= min}
          className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-white border border-[#e2d7c7] text-[#5a4a3f] transition-all hover:border-[#8b6f47] hover:text-[#8b6f47] disabled:opacity-40 disabled:hover:border-[#e2d7c7] disabled:hover:text-[#5a4a3f]"
        >
          <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
        </button>
        <input
          id={inputId}
          type="number"
          min={min}
          value={value}
          onChange={(e) =>
            !disabled && onChange(Math.max(min, Number(e.target.value) || 0))
          }
          className="w-8 text-center text-sm sm:text-base font-bold text-[#3a2f28] bg-transparent border-0 outline-none p-0"
          disabled={disabled}
          readOnly // Better UX on mobile so keyboard doesn't pop up over standard buttons
        />
        <button
          type="button"
          onClick={() => !disabled && onChange((value || 0) + 1)}
          disabled={disabled}
          className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-white border border-[#e2d7c7] text-[#5a4a3f] transition-all hover:border-[#8b6f47] hover:text-[#8b6f47] disabled:opacity-40 disabled:hover:border-[#e2d7c7] disabled:hover:text-[#5a4a3f]"
        >
          <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
        </button>
      </div>
    </div>
  );
}

/* --------------------------------- Helpers ---------------------------------- */

function SkeletonCalendar() {
  return (
    <div className="py-8">
      <div className="mx-auto h-8 w-40 rounded-lg bg-[#f4ede4] animate-pulse mb-8" />
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <div
            key={i}
            className="h-10 w-10 sm:h-11 sm:w-11 mx-auto rounded-full bg-[#f4ede4] animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

function earliestDayWithAvailability(slots = []) {
  const days = slots
    .map((s) => {
      const d = parseISO(s.date);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    })
    .sort((a, b) => a - b);
  for (let i = 0; i < days.length; i++) {
    if (i === 0 || days[i].getTime() !== days[i - 1].getTime()) return days[i];
  }
  return null;
}

function SelectedDatePill({ date, onClear }) {
  return (
    <div className="inline-flex items-center gap-2 mt-2">
      <span className="text-sm sm:text-base font-bold text-[#8b6f47] bg-[#f4ede4] px-3 sm:px-4 py-1.5 rounded-full flex items-center gap-2">
        {format(date, "EEEE, MMMM d")}
        <button
          type="button"
          onClick={onClear}
          className="bg-white/50 hover:bg-white text-[#5a4a3f] rounded-full p-0.5 transition-colors"
        >
          <Minus size={14} />
        </button>
      </span>
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-[10px] font-bold uppercase tracking-wider text-[#a7988a] border-t border-[#f4ede4] pt-5">
      <LegendChip label="Plenty" swatchClass="bg-[#eaf0ea] border-[#d8e6d8]" />
      <LegendChip label="Limited" swatchClass="bg-[#fdf3e1] border-[#fae2b8]" />
      <LegendChip label="Selected" swatchClass="bg-[#8b6f47]" />
    </div>
  );
}

function LegendChip({ label, swatchClass }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full border ${swatchClass}`}
      />
      <span>{label}</span>
    </span>
  );
}
