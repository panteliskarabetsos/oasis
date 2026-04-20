"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  format,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  isSameDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Users,
  MapPin,
  User,
  Loader2,
  AlertCircle,
  Printer,
  ChevronRightIcon,
  ChevronDown,
} from "lucide-react";

// Helper to group slots by day
const groupSlotsByDay = (slots) => {
  return slots.reduce((acc, slot) => {
    const dayStr = format(new Date(slot.date), "yyyy-MM-dd");
    if (!acc[dayStr]) acc[dayStr] = [];
    acc[dayStr].push(slot);
    return acc;
  }, {});
};

export default function SchedulePage() {
  const [view, setView] = useState("day"); // 'day' | 'week'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [experienceId, setExperienceId] = useState("all");
  const [experiences, setExperiences] = useState([]);

  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showCalendar, setShowCalendar] = useState(false);

  // Calculate Date Ranges based on view
  const { from, to, title } = useMemo(() => {
    if (view === "day") {
      return {
        from: startOfDay(currentDate).toISOString(),
        to: endOfDay(currentDate).toISOString(),
        title: format(currentDate, "EEEE, MMMM do, yyyy"),
      };
    } else {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Starts Monday
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return {
        from: startOfDay(start).toISOString(),
        to: endOfDay(end).toISOString(),
        title: `${format(start, "MMM do")} - ${format(end, "MMM do, yyyy")}`,
      };
    }
  }, [view, currentDate]);

  // Fetch Experiences for Dropdown
  useEffect(() => {
    fetch("/api/admin/experiences?limit=50")
      .then((res) => res.json())
      .then((data) => setExperiences(data.items || []))
      .catch(() => {});
  }, []);

  // Fetch Agenda Data
  useEffect(() => {
    const fetchAgenda = async () => {
      setLoading(true);
      setError("");
      try {
        const qs = new URLSearchParams({ from, to });
        if (experienceId !== "all") qs.set("experienceId", experienceId);

        const res = await fetch(`/api/admin/schedule/overview?${qs}`);
        if (!res.ok) throw new Error("Failed to fetch schedule");

        const data = await res.json();
        setSlots(data.items || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAgenda();
  }, [from, to, experienceId]);

  // Navigation Handlers
  const handlePrev = () =>
    setCurrentDate((prev) =>
      view === "day" ? subDays(prev, 1) : subDays(prev, 7),
    );
  const handleNext = () =>
    setCurrentDate((prev) =>
      view === "day" ? addDays(prev, 1) : addDays(prev, 7),
    );
  const handleToday = () => setCurrentDate(new Date());
  const handlePrint = () => window.print();

  const groupedSlots = groupSlotsByDay(slots);
  const sortedDays = Object.keys(groupedSlots).sort();

  return (
    <div className="min-h-screen bg-[#fdfcfb] text-[#3f3127] p-4 sm:p-8 print:p-0 print:bg-white relative">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* --- HEADER CONTROLS (Hidden on Print) --- */}
        <div className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#e3ddd2] shadow-sm relative z-20">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              className="p-2 rounded-full hover:bg-[#fdfaf5] border border-[#e3ddd2] transition-colors"
              aria-label="Previous"
            >
              <ChevronLeft size={20} className="text-[#7a6a5f]" />
            </button>
            <button
              onClick={handleToday}
              className="px-4 py-2 text-sm font-bold text-[#5a4a3f] bg-[#fdfaf5] border border-[#e3ddd2] rounded-full hover:bg-[#f5f1ea] transition-colors"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-2 rounded-full hover:bg-[#fdfaf5] border border-[#e3ddd2] transition-colors"
              aria-label="Next"
            >
              <ChevronRight size={20} className="text-[#7a6a5f]" />
            </button>

            {/* Date Title with Calendar Dropdown Trigger */}
            <div className="relative ml-2">
              <button
                onClick={() => setShowCalendar(!showCalendar)}
                className="flex items-center gap-2 text-lg font-serif font-semibold hover:text-[#8b6f47] transition-colors group"
              >
                <span className="w-56 text-left truncate">{title}</span>
                <ChevronDown
                  size={18}
                  className={`text-[#d8cfc3] transition-transform duration-200 group-hover:text-[#8b6f47] ${
                    showCalendar ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Popover Calendar */}
              {showCalendar && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowCalendar(false)}
                  />
                  <div className="absolute top-full left-0 mt-3 z-40">
                    <MiniCalendar
                      selectedDate={currentDate}
                      experienceId={experienceId}
                      onSelect={(date) => {
                        setCurrentDate(date);
                        setShowCalendar(false);
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            {/* Experience Filter */}
            <select
              value={experienceId}
              onChange={(e) => setExperienceId(e.target.value)}
              className="bg-white border border-[#e3ddd2] text-sm rounded-full px-4 py-2 focus:ring-2 focus:ring-[#8b6f47]/30 outline-none shrink-0"
            >
              <option value="all">All Experiences</option>
              {experiences.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>

            {/* View Toggle */}
            <div className="flex bg-[#fdfaf5] border border-[#e3ddd2] rounded-full p-1 shrink-0">
              <button
                onClick={() => setView("day")}
                className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-all ${
                  view === "day"
                    ? "bg-white shadow-sm text-[#3f3127]"
                    : "text-[#a09084] hover:text-[#5a4a3f]"
                }`}
              >
                Day
              </button>
              <button
                onClick={() => setView("week")}
                className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-all ${
                  view === "week"
                    ? "bg-white shadow-sm text-[#3f3127]"
                    : "text-[#a09084] hover:text-[#5a4a3f]"
                }`}
              >
                Week
              </button>
            </div>

            {/* Print Button */}
            <div className="w-[1px] h-6 bg-[#e3ddd2] mx-1 shrink-0" />
            <button
              onClick={handlePrint}
              className="p-2 rounded-full hover:bg-[#fdfaf5] border border-[#e3ddd2] text-[#7a6a5f] transition-colors shrink-0"
              title="Print Manifest"
            >
              <Printer size={18} />
            </button>
          </div>
        </div>

        {/* --- PRINT HEADER (Visible only on Print) --- */}
        <div className="hidden print:block mb-8 border-b border-black pb-4">
          <h1 className="text-2xl font-serif font-bold">Daily Manifest</h1>
          <p className="text-sm">{title}</p>
        </div>

        {/* --- MAIN CONTENT --- */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-[#8b6f47]">
            <Loader2 size={40} className="animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-200 flex items-center gap-3 print:hidden">
            <AlertCircle size={24} /> {error}
          </div>
        ) : sortedDays.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-[#e3ddd2] shadow-sm print:shadow-none print:border-none">
            <CalendarIcon
              size={48}
              className="mx-auto text-[#d8cfc3] mb-4 print:hidden"
            />
            <h3 className="text-xl font-serif text-[#7a6a5f]">
              No tours scheduled
            </h3>
            <p className="text-[#a09084] mt-1 print:hidden">
              Try selecting a different date range or experience.
            </p>
          </div>
        ) : (
          <div className="space-y-8 relative z-10">
            {sortedDays.map((dayStr) => {
              const daySlots = groupedSlots[dayStr];
              const dateObj = new Date(dayStr);
              const isToday = isSameDay(dateObj, new Date());

              return (
                <div key={dayStr} className="space-y-4 break-inside-avoid">
                  {/* Day Header */}
                  <h3 className="flex items-center gap-2 text-xl font-serif text-[#2a1f18] border-b border-[#e3ddd2] print:border-black pb-2 sticky top-0 bg-[#fdfcfb] print:bg-white z-10 pt-2">
                    {format(dateObj, "EEEE, MMM do")}
                    {isToday && (
                      <span className="text-[10px] bg-[#8b6f47] text-white px-2 py-0.5 rounded-full uppercase tracking-wider font-bold -translate-y-0.5 print:hidden">
                        Today
                      </span>
                    )}
                  </h3>

                  {/* Slots for the day */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid-cols-1 print:gap-6">
                    {daySlots.map((slot) => (
                      <SlotCard key={slot.id} slot={slot} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SUBCOMPONENTS                                                              */
/* -------------------------------------------------------------------------- */

// --- Mini Calendar Popover ---
function MiniCalendar({ selectedDate, experienceId, onSelect }) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selectedDate));
  const [activeDates, setActiveDates] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Fetch active dates for the currently viewed month
  useEffect(() => {
    setIsLoading(true);
    const start = startOfDay(startOfMonth(viewMonth)).toISOString();
    const end = endOfDay(endOfMonth(viewMonth)).toISOString();

    const qs = new URLSearchParams({ from: start, to: end });
    if (experienceId !== "all") qs.set("experienceId", experienceId);

    fetch(`/api/admin/schedule/active-dates?${qs}`)
      .then((res) => res.json())
      .then((data) => {
        setActiveDates(new Set(data.items || []));
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [viewMonth, experienceId]);

  // Generate grid of days for the calendar
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [viewMonth]);

  const handlePrevMonth = () => setViewMonth(subMonths(viewMonth, 1));
  const handleNextMonth = () => setViewMonth(addMonths(viewMonth, 1));

  return (
    <div className="bg-white rounded-2xl border border-[#e3ddd2] shadow-xl p-4 w-72 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-1 rounded-full hover:bg-[#fdfaf5] text-[#7a6a5f] transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="font-serif font-bold text-[#3f3127] flex items-center gap-2">
          {format(viewMonth, "MMMM yyyy")}
          {isLoading && (
            <Loader2 size={12} className="animate-spin text-[#8b6f47]" />
          )}
        </div>
        <button
          onClick={handleNextMonth}
          className="p-1 rounded-full hover:bg-[#fdfaf5] text-[#7a6a5f] transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Days of Week */}
      <div className="grid grid-cols-7 mb-2">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
          <div
            key={day}
            className="text-center text-[10px] font-bold uppercase tracking-wider text-[#a09084]"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Date Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, viewMonth);
          const isTodayDate = isSameDay(day, new Date());

          // Check if this date has active tours
          const dayStr = format(day, "yyyy-MM-dd");
          const hasTours = activeDates.has(dayStr);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelect(day)}
              className={`
                relative h-8 w-8 rounded-full flex items-center justify-center text-sm transition-all
                ${!isCurrentMonth ? "text-[#d8cfc3]" : "text-[#3f3127] hover:bg-[#fdfaf5]"}
                ${isSelected ? "bg-[#8b6f47] text-white hover:bg-[#7a603c] font-bold shadow-sm" : ""}
                ${isTodayDate && !isSelected ? "ring-1 ring-[#8b6f47] text-[#8b6f47] font-bold" : ""}
              `}
            >
              {format(day, "d")}
              {/* The "Active Tours" Dot */}
              {hasTours && (
                <span
                  className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-[#8b6f47]"}`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SlotCard({ slot }) {
  const fillPercentage =
    slot.totalSlots > 0
      ? Math.min(100, (slot.totalBooked / slot.totalSlots) * 100)
      : 0;

  const isFull = slot.totalBooked >= slot.totalSlots;

  return (
    <div className="bg-white rounded-2xl border border-[#e3ddd2] shadow-sm overflow-hidden flex flex-col print:shadow-none print:border-black print:rounded-none">
      {/* Slot Header */}
      <div className="bg-[#fcfbf9] border-b border-[#e3ddd2] print:border-black p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="text-sm font-bold text-[#8b6f47] print:text-black mb-0.5">
              {format(new Date(slot.date), "HH:mm")} — {slot.experienceName}
            </div>
            <div className="text-xs font-semibold text-[#a09084] print:text-gray-700 flex items-center gap-1.5">
              <Users size={12} />
              {slot.totalBooked} / {slot.totalSlots} Guests Booked
            </div>
          </div>
          {slot.isCancelled && (
            <span className="bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded print:border print:border-red-700">
              Cancelled
            </span>
          )}
        </div>

        {/* Capacity Bar */}
        {!slot.isCancelled && (
          <div className="w-full h-1.5 bg-[#e3ddd2] rounded-full overflow-hidden print:hidden mt-1">
            <div
              className={`h-full transition-all duration-500 ${isFull ? "bg-red-500" : "bg-[#8b6f47]"}`}
              style={{ width: `${fillPercentage}%` }}
            />
          </div>
        )}
      </div>

      {/* Guest Manifest */}
      <div className="p-4 flex-1">
        {slot.bookings.length === 0 ? (
          <div className="text-sm italic text-[#a09084] text-center py-4 print:text-left">
            No active bookings yet.
          </div>
        ) : (
          <ul className="space-y-3 print:space-y-1">
            {slot.bookings.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/admin/bookings/${b.id}`}
                  className="group flex justify-between items-center gap-4 p-3 rounded-xl bg-[#fdfaf5] border border-[#e3ddd2]/50 hover:border-[#8b6f47]/30 hover:shadow-sm transition-all print:bg-transparent print:border-b print:border-dashed print:border-gray-300 print:rounded-none print:p-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[#3f3127] print:text-black flex items-center gap-2 text-sm truncate">
                      <User
                        size={14}
                        className="text-[#a09084] print:hidden shrink-0"
                      />
                      <span className="truncate">{b.guestName}</span>
                      <span className="text-[10px] font-bold text-[#a09084] print:text-black bg-white print:bg-transparent border border-[#e3ddd2] print:border-black px-1.5 py-0.5 rounded shrink-0">
                        {b.pax} PAX
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-[#7a6a5f] print:text-black flex items-start gap-1.5">
                      <MapPin
                        size={12}
                        className="text-emerald-600 print:text-black mt-0.5 shrink-0"
                      />
                      <span className="leading-tight truncate">
                        {b.meetupPoint}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="text-[10px] font-mono text-[#a09084] print:text-black">
                      {b.code}
                    </div>
                    <ChevronRightIcon
                      size={14}
                      className="text-[#d8cfc3] group-hover:text-[#8b6f47] transition-colors print:hidden"
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
