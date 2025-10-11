// src/app/check-availability/[slug]/page.js
"use client";
import { enGB } from "date-fns/locale";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format, isSameDay, parseISO, isAfter } from "date-fns";
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
} from "lucide-react";

// --- Currency helpers ---
function formatEuro(n) {
  return `€${(Number(n) || 0).toFixed(2)}`;
}

// --- Pricing helpers ---
function normalizePricing(exp) {
  // Priority: pricing JSON -> explicit columns -> legacy price
  const pj = exp?.pricing || {};
  const adult = toNum(pj.adult ?? exp?.priceAdult ?? exp?.price ?? 0);

  const kid = toNum(pj.kid ?? exp?.priceKid ?? adult); // default = adult
  return { adult, kid };
}
function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}
function eur(n) {
  return `€${(Number(n) || 0).toFixed(2)}`;
}

export default function CheckAvailabilityPage() {
  const router = useRouter();
  const { slug } = useParams();

  // Experience + availability
  const [experience, setExperience] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  // alias (in case other parts use `eur(...)`)
  const eur = formatEuro;
  // Group split
  const [adults, setAdults] = useState(1);

  const [kids, setKids] = useState(0);
  const totalPeople = adults + kids;

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

  // Remaining capacity per calendar day (not per time)
  const countsByYMD = useMemo(() => {
    const m = new Map();
    for (const s of availableSlots) {
      const d = parseISO(s.date);
      const ymd = d.toISOString().slice(0, 10);
      const remaining = Math.max(0, (s.totalSlots ?? 0) - (s.bookedSlots ?? 0));
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
          { cache: "no-store" }
        );
        const slots = (await slotsRes.json()) || [];
        const now = new Date();
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
        const futureOnly = slots.filter((s) =>
          isAfter(parseISO(s.date), oneHourFromNow)
        );
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
    [availableSlots]
  );

  const slotsOnSelectedDay = useMemo(() => {
    if (!selectedDate) return [];
    return availableSlots
      .filter((s) => isSameDay(parseISO(s.date), selectedDate))
      .sort((a, b) => parseISO(a.date) - parseISO(b.date));
  }, [availableSlots, selectedDate]);

  const selectedSlot = useMemo(
    () => availableSlots.find((s) => s.id === selectedSlotId) || null,
    [availableSlots, selectedSlotId]
  );

  const availablePlaces = selectedSlot
    ? Math.max(
        0,
        (selectedSlot.totalSlots ?? 0) - (selectedSlot.bookedSlots ?? 0)
      )
    : 0;

  // Business cap: max 8 per booking (and never exceed availability)
  const bookingCap = Math.min(8, availablePlaces || 8);

  const canContinue =
    !pausedNow &&
    !!selectedSlotId &&
    totalPeople > 0 &&
    totalPeople <= (availablePlaces || 0);

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
      router.push(`/booking/${data.id}/attendees`);
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f7f3ed] to-[#f4f1ec]">
      {/* Top bar */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-20">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-[#8b6f47] text-sm border border-[#8b6f47]/70 rounded-full px-4 py-2 hover:bg-[#f4f1ec] hover:text-[#5a4a3f] transition-all shadow-sm"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
      </div>

      {/* Header banner */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 mt-6">
        <div className="relative overflow-hidden rounded-3xl border border-[#e5e0d8] bg-[#fcf9f4]">
          <div className="absolute inset-0 bg-gradient-to-r from-[#efe9df] via-transparent to-[#efe9df] pointer-events-none" />
          {firstImage ? (
            <img
              src={firstImage}
              alt={experience?.name || "Experience"}
              className="absolute inset-0 h-full w-full object-cover opacity-20"
            />
          ) : null}

          <div className="relative z-10 p-6 sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-[#efeae2] p-2">
                  <CalendarDays className="h-5 w-5 text-[#8b6f47]" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#5a4a3f]">
                    {experience?.name || "Experience"}
                  </h1>
                  {experience?.location ? (
                    <p className="mt-1 flex items-center gap-2 text-sm text-[#6b5e53]">
                      <MapPin size={14} className="text-[#8b6f47]" />
                      {experience.location}
                    </p>
                  ) : null}
                </div>
              </div>
              {fromPrice !== null ? (
                <div className="mt-3 sm:mt-0 rounded-xl border border-[#e0dcd4] bg-white px-4 py-2 text-sm text-[#5a4a3f] shadow-sm">
                  From <span className="font-semibold">{eur(fromPrice)}</span> /
                  person
                </div>
              ) : null}
            </div>

            {/* Stepper */}
            <div className="mt-5 grid grid-cols-3 gap-2 text-xs sm:text-sm">
              <Step label="Choose date" active={step >= 1} done={step > 1} />
              <Step label="Choose time" active={step >= 2} done={step > 2} />
              <Step label="Group size" active={step >= 3} />
            </div>

            {/* Info / Pause banner */}
            {settingsLoading ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#ede7db] bg-white px-3 py-2 text-xs text-[#6b5e53] shadow-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8b6f47]" />
                Loading booking status…
              </div>
            ) : pausedNow ? (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#f1d7d7] bg-[#fff6f6] px-3 py-2 text-xs text-[#7a4a4a] shadow-sm">
                <PauseCircle size={14} className="mt-0.5 text-[#b14545]" />
                <div>
                  <p className="font-medium">
                    Bookings are temporarily paused.
                  </p>
                  {globalSettings.bookingsPausedUntil ? (
                    <p>
                      Resuming after{" "}
                      <span className="font-semibold">
                        {format(
                          new Date(globalSettings.bookingsPausedUntil),
                          "PPpp"
                        )}
                      </span>
                      .
                    </p>
                  ) : null}
                  {globalSettings.bookingsPausedMessage ? (
                    <p className="mt-1">
                      {globalSettings.bookingsPausedMessage}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#ede7db] bg-white px-3 py-2 text-xs text-[#6b5e53] shadow-sm">
                <Info size={14} className="mt-0.5 text-[#8b6f47]" />
                <p>
                  Pick a date and time, then set your group split. You’ll fill
                  attendee details on the next page.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-16">
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Left: Calendar */}
          <section
            className={`relative rounded-2xl border border-[#e8e5df] bg-white p-6 shadow-sm ${
              pausedNow ? "opacity-75" : ""
            }`}
          >
            {/* Header row: selected date + quick actions */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {selectedDate ? (
                  <SelectedDatePill
                    date={selectedDate}
                    onClear={() => setSelectedDate(null)}
                  />
                ) : (
                  <span className="text-xs text-[#7a6a58]">
                    Pick a date to see times
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDate(new Date())}
                  className="rounded-full border border-[#e0dcd4] px-3 py-1.5 text-xs text-[#5a4a3f] hover:bg-[#faf7f1]"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = earliestDayWithAvailability(availableSlots);
                    if (d && !pausedNow) setSelectedDate(d);
                  }}
                  className="rounded-full bg-[#8b6f47] px-3 py-1.5 text-xs text-white hover:bg-[#7a5f3a]"
                >
                  First available
                </button>
              </div>
            </div>

            {loadingSlots ? (
              <SkeletonCalendar />
            ) : !hasAnySlots ? (
              <div className="py-8 text-center text-[#5a4a3f]">
                <p className="font-medium">No upcoming availability yet.</p>
                <p className="text-sm text-[#7a6a5a] mt-1">
                  Please check back soon or reach out for custom dates.
                </p>
              </div>
            ) : (
              <>
                <DayPicker
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => !pausedNow && setSelectedDate(d || null)}
                  showOutsideDays
                  fixedWeeks
                  captionLayout="dropdown-buttons"
                  fromMonth={new Date()}
                  toMonth={
                    new Date(new Date().setMonth(new Date().getMonth() + 6))
                  }
                  fromYear={new Date().getFullYear()}
                  toYear={new Date().getFullYear() + 1}
                  locale={enGB}
                  /* style days by capacity + weekend tint */
                  modifiers={{
                    plenty: availabilityBuckets.plenty,
                    some: availabilityBuckets.some,
                    few: availabilityBuckets.few,
                    weekend: { dayOfWeek: [0, 6] },
                  }}
                  /* disable past days + days without availability */
                  disabled={[
                    { before: new Date() },
                    (date) => !availableDates.some((d) => isSameDay(d, date)),
                  ]}
                  classNames={{
                    root: "rdp-root w-full",
                    caption:
                      "rdp-caption mb-3 flex items-center justify-between",
                    caption_label:
                      "text-sm font-semibold text-[#5a4a3f] px-2 py-1 rounded-lg bg-[#f7f3ed] border border-[#ece6dc]",
                    nav: "rdp-nav flex items-center gap-2",
                    nav_button:
                      "rdp-nav_button h-8 w-8 grid place-items-center rounded-lg border border-[#e0dcd4] hover:bg-[#faf7f1] text-[#5a4a3f]",
                    table:
                      "rdp-table w-full border-separate border-spacing-y-1",
                    head_cell:
                      "rdp-head_cell text-[11px] font-medium text-[#7a6a58] pb-1",
                    row: "rdp-row",
                    cell: "rdp-cell text-center align-middle h-10 w-10 [&_.rdp-day_selected]:!bg-[#8b6f47] [&_.rdp-day_selected]:!text-white",
                    day: "rdp-day !rounded-full focus:outline-none focus:ring-2 focus:ring-[#cbb89e]",
                    day_selected:
                      "rdp-day_selected !bg-[#8b6f47] !text-white !rounded-full hover:!bg-[#7a5f3a]",
                    day_today:
                      "rdp-day_today border border-[#8b6f47] !rounded-full text-[#5a4a3f]",
                    day_outside: "rdp-day_outside text-[#cbbfae]",
                    day_disabled: "rdp-day_disabled text-[#c7c0b6] opacity-60",
                  }}
                  modifiersClassNames={{
                    plenty: "bg-[#e8f3ec] hover:bg-[#e2efe7] text-[#30433a]",
                    some: "bg-[#f4efe5] hover:bg-[#efe8dd] text-[#4a4136]",
                    few: "ring-1 ring-amber-400 bg-[#fff8ea] hover:bg-[#fff3d7] text-[#5a4a3f]",
                    weekend: "bg-[#faf7f3]",
                  }}
                  components={{ DayContent }}
                />

                <Legend />
                <p className="mt-3 text-center text-xs text-[#7a6a58]">
                  Showing the next 6 months of availability.
                </p>
              </>
            )}

            {/* Paused badge + overlay */}
            {pausedNow && (
              <>
                <div className="pointer-events-none absolute inset-0 rounded-2xl" />
                <div className="absolute right-4 top-4 rounded-full bg-[#8b6f47]/90 px-3 py-1.5 text-xs text-white shadow">
                  Bookings paused
                </div>
              </>
            )}
          </section>

          {/* Right: Times + Group card */}
          <section className="space-y-6" ref={slotsContainerRef}>
            {/* Times */}
            <div
              className={`rounded-2xl border border-[#e8e5df] bg-white p-6 shadow-sm ${
                pausedNow ? "opacity-60" : ""
              }`}
            >
              <h3 className="mb-3 text-lg font-semibold text-[#5a4a3f] flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#8b6f47]" />
                {selectedDate
                  ? `Available times on ${format(selectedDate, "PPP")}`
                  : "Select a date"}
              </h3>

              {!selectedDate ? (
                <p className="text-sm text-[#7a6a5a]">
                  Choose a date to see times.
                </p>
              ) : slotsOnSelectedDay.length === 0 ? (
                <p className="text-sm text-[#7a6a5a]">
                  No times available for this day.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {slotsOnSelectedDay.map((slot) => {
                    const available =
                      (slot.totalSlots ?? 0) - (slot.bookedSlots ?? 0);
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
                        className={`flex items-center justify-between rounded-xl border p-4 text-left transition-all shadow-sm ${
                          isDisabled
                            ? "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed"
                            : isSelected
                            ? "bg-[#f5efe4] border-[#8b6f47]"
                            : "bg-white border-[#e8e5df] hover:shadow-md"
                        }`}
                        aria-pressed={isSelected}
                      >
                        <div>
                          <div className="text-sm font-semibold">{time}</div>
                          <div
                            className={`text-xs font-medium ${
                              available <= 0
                                ? "text-gray-500"
                                : "text-green-700"
                            }`}
                          >
                            {available <= 0
                              ? "Fully booked"
                              : `${available} available`}
                          </div>
                        </div>
                        <input
                          type="radio"
                          name="slot"
                          className="accent-[#8b6f47]"
                          checked={isSelected}
                          readOnly
                          aria-label={`Time ${time}`}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Group & Summary (sticky on desktop) */}
            <div className="lg:sticky lg:top-24">
              <div className="rounded-2xl border border-[#e8e5df] bg-[#fcf9f4] p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-[#5a4a3f]">
                  Your group
                </h3>

                {/* Capacity meter */}
                {selectedSlot && (
                  <CapacityBar
                    total={selectedSlot.totalSlots}
                    booked={selectedSlot.bookedSlots}
                  />
                )}

                {/* Counters */}
                <div className={`mt-4 ${pausedNow ? "opacity-60" : ""}`}>
                  <p className="text-xs text-[#7a6a58]">
                    Adults 15+, Kids 3–14.
                  </p>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Counter
                      label="Adults"
                      value={adults}
                      onChange={(v) =>
                        setAdults(
                          clampGroup(v, 1, bookingCap, totalPeople, "adults")
                        )
                      }
                      min={1}
                      disabled={!selectedSlot || pausedNow}
                    />

                    <Counter
                      label="Kids"
                      value={kids}
                      onChange={(v) =>
                        setKids(
                          clampGroup(v, 0, bookingCap, totalPeople, "kids")
                        )
                      }
                      disabled={!selectedSlot || pausedNow}
                    />
                  </div>

                  {selectedSlot && (
                    <p className="mt-2 text-xs text-[#5a4a3f]">
                      {totalPeople} selected —{" "}
                      {Math.max(0, availablePlaces - totalPeople)} of{" "}
                      {availablePlaces} spots remain for this time. (Max 8 per
                      booking)
                    </p>
                  )}
                </div>

                {/* Price summary (tiered) */}
                <div className="mt-6 border border-[#e5e0d8] rounded-xl bg-[#faf7f2] px-6 py-4 shadow-inner">
                  <div className="space-y-1 text-sm text-[#5a4a3f]">
                    {adults > 0 && (
                      <div className="flex items-center justify-between">
                        <span>
                          Adults × {adults} @ {eur(prices.adult)}
                        </span>
                        <span className="font-semibold">{eur(lineAdult)}</span>
                      </div>
                    )}

                    {kids > 0 && (
                      <div className="flex items-center justify-between">
                        <span>
                          Kids × {kids} @ {eur(prices.kid)}
                        </span>
                        <span className="font-semibold">{eur(lineKid)}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 border-t border-[#e5e0d8] pt-3 flex items-center justify-between">
                    <span className="text-sm text-[#5a4a3f]">Total</span>
                    <span className="text-2xl font-bold text-[#8b6f47] tracking-wide">
                      {eur(totalPrice)}
                    </span>
                  </div>
                </div>

                {/* Continue */}
                <button
                  onClick={handleContinue}
                  disabled={!canContinue || isSubmitting}
                  className={`mt-6 w-full py-3 rounded-lg font-semibold text-lg transition-all flex items-center justify-center gap-2 shadow-md ${
                    !canContinue
                      ? "bg-gray-400 cursor-not-allowed text-white"
                      : "bg-[#8b6f47] hover:bg-[#7a5f3a] text-white"
                  }`}
                >
                  {pausedNow ? (
                    "Bookings are paused"
                  ) : isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Starting your booking...
                    </>
                  ) : !selectedSlotId ? (
                    "Select a time"
                  ) : totalPeople <= 0 ? (
                    "Add people"
                  ) : (
                    "Continue to Details"
                  )}
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

/* ---------- UI bits ---------- */

function Step({ label, active, done }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
        active
          ? "border-[#dcd3c6] bg-white shadow-sm"
          : "border-[#e9e4da] bg-white/70"
      }`}
    >
      <span
        className={`inline-grid h-5 w-5 place-items-center rounded-full text-[10px] ${
          done
            ? "bg-[#8b6f47] text-white"
            : active
            ? "bg-[#efe9df] text-[#5a4a3f] border border-[#e1d8c9]"
            : "bg-[#f2ede6] text-[#8b6f47]"
        }`}
      >
        {done ? "✓" : "•"}
      </span>
      <span className="text-xs text-[#5a4a3f]">{label}</span>
    </div>
  );
}

function CapacityBar({ total = 0, booked = 0 }) {
  const available = Math.max(0, (total ?? 0) - (booked ?? 0));
  const usedPct =
    total > 0 ? Math.min(100, Math.round((booked / total) * 100)) : 0;
  const tone =
    usedPct >= 80
      ? "bg-red-500"
      : usedPct >= 50
      ? "bg-yellow-500"
      : "bg-green-600";

  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between text-xs text-[#7a6a58]">
        <span>Capacity</span>
        <span>
          {available} / {total} available
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#ece6dc]">
        <div
          className={`h-2 ${tone} transition-all`}
          style={{ width: `${usedPct}%` }}
        />
      </div>
    </div>
  );
}

function Counter({ label, value, onChange, min = 0, disabled = false }) {
  return (
    <div className="bg-white border border-[#e2ddd2] rounded-xl p-3 shadow-sm">
      <div className="text-sm text-[#5a4a3f] mb-2">{label}</div>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => !disabled && onChange(Math.max(min, (value || 0) - 1))}
          disabled={disabled}
          className="text-[#8b6f47] p-1 disabled:opacity-40"
          aria-label="Decrease"
        >
          <Minus className="w-4 h-4" />
        </button>
        <input
          type="number"
          min={min}
          value={value}
          onChange={(e) =>
            !disabled && onChange(Math.max(min, Number(e.target.value) || 0))
          }
          className="w-12 text-center text-[#5a4a3f] bg-transparent border-0 focus:outline-none font-semibold"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => !disabled && onChange((value || 0) + 1)}
          disabled={disabled}
          className="text-[#8b6f47] p-1 disabled:opacity-40"
          aria-label="Increase"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */

// Keep total within cap and never drop below min adult count
function clampGroup(nextVal, min, bookingCap, totalPeople, which) {
  const raw = Math.max(min, Number(nextVal) || 0);
  // We don't know others here; caller passes setState in sequence,
  // so just rely on Continue button validation to enforce total ≤ cap.
  // Optional: enforce soft cap here by not allowing a single field to push over cap.
  // Return raw and rely on disabled button + message for UX clarity.
  return raw;
}

function SkeletonCalendar() {
  return (
    <div className="py-6">
      <div className="mx-auto h-6 w-28 rounded bg-[#ece6dc]" />
      <div className="mt-4 grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="h-10 rounded-full bg-[#f0ebe3]" />
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-[#7a6a58]">
        Loading availability…
      </p>
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
    <span className="inline-flex items-center gap-2 rounded-full border border-[#e0dcd4] bg-[#faf7f1] px-3 py-1.5 text-xs text-[#5a4a3f]">
      <CalendarDays className="h-3.5 w-3.5 text-[#8b6f47]" />
      {format(date, "EEE, d MMM")}
      <button
        type="button"
        onClick={onClear}
        className="ml-1 rounded-full px-1.5 py-0.5 hover:bg-white"
        aria-label="Clear selected date"
      >
        ×
      </button>
    </span>
  );
}

// Legend for calendar buckets
function Legend() {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-[11px] text-[#7a6a58]">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-[#e8f3ec] ring-1 ring-[#bcd8c8]" />
        Plenty
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-[#f4efe5] ring-1 ring-[#e1d6c5]" />
        Some
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-[#fff8ea] ring-1 ring-amber-400" />
        Few left
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-full border border-[#8b6f47]" />
        Today
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2 w-4 rounded bg-[#faf7f3]" />
        Weekend
      </span>
    </div>
  );
}

// a tiny dot under the date number for available days
function DayDot({ date, countsByYMD }) {
  const ymd = date.toISOString().slice(0, 10);
  const remaining = countsByYMD.get(ymd) || 0;
  if (!remaining) return null;
  const few = remaining <= 3;
  return (
    <span
      className={`pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full ${
        few ? "bg-amber-600" : "bg-[#8b6f47]"
      }`}
      aria-hidden="true"
    />
  );
}

// inject the dot inside each day cell without breaking keyboard behavior
function DayContent(props) {
  return (
    <span className="relative inline-flex items-center justify-center w-7 h-7">
      {props.children}
      {/* countsByYMD is captured from the outer scope */}
      <DayDot date={props.date} countsByYMD={countsByYMD} />
    </span>
  );
}
