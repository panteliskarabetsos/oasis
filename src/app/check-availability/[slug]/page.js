// src/app/check-availability/[slug]/page.js
"use client";

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
  StickyNote,
  Loader2,
  Minus,
  Plus,
  ArrowLeft,
  MapPin,
  Info,
  CheckCircle2,
  PauseCircle,
} from "lucide-react";
import { useAuth } from "@/app/components/SessionWrapper";

export default function CheckAvailabilityPage() {
  const router = useRouter();
  const { slug } = useParams();
  const { user, loading } = useAuth();

  const [experience, setExperience] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [numberOfPeople, setNumberOfPeople] = useState(1);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // --- Global booking settings ---
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [globalSettings, setGlobalSettings] = useState({
    bookingsPaused: false,
    bookingsPausedUntil: null,
    bookingsPausedMessage: "",
  });

  const slotsContainerRef = useRef(null);

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
        // If the public route doesn’t exist yet, just continue silently.
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
    // paused indefinitely or until a future time
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

  // Reset slot choice when date changes + scroll
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

  const selectedSlot = useMemo(
    () => availableSlots.find((s) => s.id === selectedSlotId) || null,
    [availableSlots, selectedSlotId]
  );

  const availablePlaces = selectedSlot
    ? Math.max(
        0,
        (selectedSlot.totalSlots ?? 0) - (selectedSlot.bookedSlots ?? 0)
      )
    : 8;
  const maxPeopleAllowed = Math.min(8, availablePlaces || 8);

  // DB profile → nicer display name
  const [dbProfile, setDbProfile] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!user) return;
        const res = await fetch("/api/me", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load profile");
        const data = await res.json();
        if (alive) setDbProfile(data || null);
      } catch (e) {
        console.warn("[check-availability] /api/me failed", e);
        if (alive) setDbProfile(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const displayName = useMemo(() => {
    const fromDb = [dbProfile?.name, dbProfile?.surname]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (fromDb) return fromDb;

    const md = user?.user_metadata || {};
    const first = titleCase(
      md.firstName ?? md.given_name ?? md.name ?? md.full_name ?? ""
    );
    const last = titleCase(md.lastName ?? md.family_name ?? md.surname ?? "");
    const full = [first, last].filter(Boolean).join(" ").trim();
    return full || "Explorer";
  }, [dbProfile, user]);

  async function handleReserve() {
    if (pausedNow) {
      toast.error("Bookings are temporarily paused.");
      return;
    }
    if (!selectedSlotId || numberOfPeople <= 0) {
      toast.error("Please select a time slot and number of people.");
      return;
    }
    if (!user) {
      toast.error("Please log in to continue.");
      router.push("/login");
      return;
    }
    if (!agreedToTerms) {
      toast.error("You must agree to the Terms of Use to proceed.");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        appUserId: user?.user_metadata?.appUserId ?? null,
        email: user?.email ?? null,
        scheduleSlotId: selectedSlotId,
        numberOfPeople,
        notes,
      };

      const res = await fetch("/api/admin/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/booking-confirmed/${data.id}`);
      } else {
        const error = await res.json().catch(() => ({}));
        toast.error(error?.error || "Reservation failed. Try again.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

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

          {!loading && user ? (
            <p className="text-xs sm:text-sm text-[#5a4a3f]">
              Logged in as <span className="font-medium">{displayName}</span>
            </p>
          ) : loading ? (
            <span className="text-xs text-[#7a6a5a]">Checking session…</span>
          ) : (
            <button
              onClick={() => router.push("/login")}
              className="text-xs sm:text-sm rounded-full bg-[#8b6f47] px-4 py-2 text-white hover:bg-[#7a5f3a]"
            >
              Log in
            </button>
          )}
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

              {typeof experience?.price === "number" ? (
                <div className="mt-3 sm:mt-0 rounded-xl border border-[#e0dcd4] bg-white px-4 py-2 text-sm text-[#5a4a3f] shadow-sm">
                  From{" "}
                  <span className="font-semibold">
                    €{experience.price.toFixed(2)}
                  </span>{" "}
                  / person
                </div>
              ) : null}
            </div>

            {/* Stepper */}
            <div className="mt-5 grid grid-cols-3 gap-2 text-xs sm:text-sm">
              <Step label="Choose date" active={step >= 1} done={step > 1} />
              <Step label="Choose time" active={step >= 2} done={step > 2} />
              <Step label="Confirm details" active={step >= 3} />
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
                  Pick a date with availability, then choose a time. Max 8
                  people per booking. Larger group?{" "}
                  <a href="/contact" className="underline text-[#8b6f47]">
                    Contact us
                  </a>
                  .
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
                <div className="flex items-center justify-center">
                  <DayPicker
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => !pausedNow && setSelectedDate(d || null)}
                    fromMonth={new Date()}
                    toMonth={
                      new Date(new Date().setMonth(new Date().getMonth() + 6))
                    }
                    modifiers={{ available: availableDates }}
                    disabled={[
                      { before: new Date() },
                      (date) => !availableDates.some((d) => isSameDay(d, date)),
                    ]}
                    classNames={{
                      caption: "rdp-caption mb-2",
                      day_today:
                        "rdp-day_today border border-[#8b6f47] !rounded-full",
                      day_selected:
                        "rdp-day_selected !bg-[#8b6f47] !text-white !rounded-full hover:!bg-[#7a5f3a]",
                      day: "rdp-day !rounded-full",
                    }}
                    modifiersClassNames={{
                      available:
                        "bg-[#e9e4d8] text-[#5a4a3f] font-medium hover:bg-[#efe9db] hover:text-[#3d2b1f]",
                    }}
                  />
                </div>
                <p className="mt-3 text-center text-xs text-[#7a6a58]">
                  Showing the next 6 months of availability.
                </p>
              </>
            )}

            {pausedNow && (
              <div className="pointer-events-none absolute inset-0 rounded-2xl" />
            )}
          </section>

          {/* Right: Slots + Booking card */}
          <section className="space-y-6" ref={slotsContainerRef}>
            {/* Slots */}
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

            {/* Booking card (sticky on desktop) */}
            <div className="lg:sticky lg:top-24">
              <div className="rounded-2xl border border-[#e8e5df] bg-[#fcf9f4] p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-[#5a4a3f]">
                  Your booking
                </h3>

                {/* Capacity meter */}
                {selectedSlot && (
                  <CapacityBar
                    total={selectedSlot.totalSlots}
                    booked={selectedSlot.bookedSlots}
                  />
                )}

                {/* People stepper */}
                <div
                  className={`mt-4 space-y-2 ${pausedNow ? "opacity-60" : ""}`}
                >
                  <label className="block text-sm font-medium text-[#5a4a3f] flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#8b6f47]" />
                    Number of People
                  </label>
                  <div
                    className={`flex items-center justify-between gap-3 bg-[#faf7f2] border border-[#e2ddd2] rounded-lg w-full max-w-[220px] px-2 py-2 shadow-inner ${
                      numberOfPeople >= maxPeopleAllowed
                        ? "ring-2 ring-[#d97706]/60"
                        : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        !pausedNow &&
                        setNumberOfPeople((p) => Math.max(1, p - 1))
                      }
                      disabled={pausedNow}
                      className="text-[#8b6f47] hover:text-[#5a4a3f] p-1 disabled:opacity-40"
                      aria-label="Decrease"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={maxPeopleAllowed}
                      value={numberOfPeople}
                      onChange={(e) => {
                        if (pausedNow) return;
                        const val = Math.min(
                          maxPeopleAllowed,
                          Math.max(1, Number(e.target.value) || 1)
                        );
                        setNumberOfPeople(val);
                      }}
                      className="w-12 text-center text-[#5a4a3f] bg-transparent border-0 focus:outline-none font-semibold"
                      disabled={pausedNow}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        !pausedNow &&
                        setNumberOfPeople((p) =>
                          Math.min(maxPeopleAllowed, p + 1)
                        )
                      }
                      disabled={pausedNow || numberOfPeople >= maxPeopleAllowed}
                      className="text-[#8b6f47] hover:text-[#5a4a3f] p-1 disabled:opacity-40"
                      aria-label="Increase"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {selectedSlotId && (
                    <p className="text-xs text-[#5a4a3f]">
                      Only{" "}
                      <span className="font-semibold">{maxPeopleAllowed}</span>{" "}
                      slot{maxPeopleAllowed > 1 ? "s" : ""} available for this
                      time.
                    </p>
                  )}
                </div>

                {/* Price summary */}
                {experience && typeof experience.price === "number" && (
                  <div className="mt-6 border border-[#e5e0d8] rounded-xl bg-[#faf7f2] px-6 py-4 shadow-inner">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#5a4a3f]">
                        €{experience.price.toFixed(2)} × {numberOfPeople}{" "}
                        {numberOfPeople > 1 ? "people" : "person"}
                      </span>
                      <span className="text-2xl font-bold text-[#8b6f47] tracking-wide">
                        €{(experience.price * numberOfPeople).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="mt-6 space-y-2">
                  <label className="block text-sm font-medium text-[#5a4a3f] flex items-center gap-2">
                    <StickyNote className="w-4 h-4 text-[#8b6f47]" />
                    Notes / Allergies / Special Requests
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => !pausedNow && setNotes(e.target.value)}
                    placeholder="E.g. vegan, nut allergy..."
                    className="w-full p-3 rounded-lg border border-[#d7d2c6] bg-white focus:outline-none focus:ring focus:ring-[#c4b89f] text-[#5a4a3f] disabled:opacity-40"
                    disabled={pausedNow}
                  />
                </div>

                {/* Terms */}
                <div className="mt-6 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="agreeTerms"
                    checked={agreedToTerms}
                    onChange={(e) =>
                      !pausedNow && setAgreedToTerms(e.target.checked)
                    }
                    className="accent-[#8b6f47]"
                    disabled={pausedNow}
                  />
                  <label
                    htmlFor="agreeTerms"
                    className="text-sm text-[#5a4a3f]"
                  >
                    I agree to the{" "}
                    <a href="/terms" className="underline text-[#8b6f47]">
                      Terms of Use
                    </a>
                    .
                  </label>
                </div>

                {/* Submit */}
                <button
                  onClick={handleReserve}
                  disabled={
                    pausedNow ||
                    !user ||
                    isSubmitting ||
                    !agreedToTerms ||
                    !selectedSlotId
                  }
                  className={`mt-6 w-full py-3 rounded-lg font-semibold text-lg transition-all flex items-center justify-center gap-2 shadow-md ${
                    pausedNow || !user || !agreedToTerms || !selectedSlotId
                      ? "bg-gray-400 cursor-not-allowed text-white"
                      : "bg-[#8b6f47] hover:bg-[#7a5f3a] text-white"
                  }`}
                >
                  {pausedNow ? (
                    "Bookings are paused"
                  ) : isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Reserving...
                    </>
                  ) : !user ? (
                    "Log in to Reserve"
                  ) : !selectedSlotId ? (
                    "Select a time"
                  ) : (
                    "Reserve Now"
                  )}
                </button>

                {/* Small reassurance */}
                {!pausedNow && (
                  <p className="mt-3 text-center text-[11px] text-[#7a6a58]">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      No charge yet — you’ll receive a confirmation email.
                    </span>
                  </p>
                )}
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

/* ---------- Helpers ---------- */

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

function titleCase(str = "") {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/(^.|[\s-].)/g, (m) => m.toUpperCase())
    .trim();
}
