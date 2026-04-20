"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  MapPin,
  Users,
  Phone,
  Mail,
  Clock,
  Printer,
  Bus,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

// ---------- Helpers ----------
const toISODate = (d) => {
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const fmtDateLong = (d) =>
  d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function DailySchedulePage() {
  const router = useRouter();

  // Date state
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Data state
  const [loading, setLoading] = useState(true);
  const [dailySlots, setDailySlots] = useState([]);

  // ---------- Fetch Data ----------
  useEffect(() => {
    const fetchDailyManifest = async () => {
      setLoading(true);
      try {
        const dateStr = toISODate(selectedDate);
        // EXPECTED API BEHAVIOR:
        // Return an array of schedule slots for the given day.
        // Each slot should include its related bookings, experience details, and pickup info.
        const res = await fetch(`/api/admin/manifest?date=${dateStr}`, {
          cache: "no-store",
        });

        if (!res.ok) throw new Error("Failed to load daily schedule.");

        const data = await res.json();
        setDailySlots(Array.isArray(data) ? data : []);
      } catch (err) {
        // Fallback or show error
        toast.error(err.message || "Error loading schedule.");
        setDailySlots([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDailyManifest();
  }, [selectedDate]);

  // ---------- Handlers ----------
  const changeDate = (days) => {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + days);
    setSelectedDate(nextDate);
  };

  const setToday = () => setSelectedDate(new Date());

  const handlePrint = () => {
    window.print();
  };

  // ---------- Derived Stats ----------
  const stats = useMemo(() => {
    let totalGuests = 0;
    let totalBookings = 0;

    dailySlots.forEach((slot) => {
      if (slot.bookings) {
        totalBookings += slot.bookings.length;
        slot.bookings.forEach((b) => {
          totalGuests += b.partySize || 0;
        });
      }
    });

    return { totalGuests, totalBookings, totalExperiences: dailySlots.length };
  }, [dailySlots]);

  // ---------- Render ----------
  return (
    <div className="min-h-screen bg-[#fdfcfb] text-[#3f3127] pb-20 print:bg-white print:pb-0">
      {/* Top Nav - Hidden when printing */}
      <header className="sticky top-0 z-30 border-b border-[#e3ddd2] bg-white/80 backdrop-blur-md px-6 py-4 print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/admin")}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e3ddd2] bg-white text-[#7a6a5f] hover:bg-[#fdfaf5] hover:text-[#3f3127] transition"
            >
              <ChevronLeft size={18} />
            </button>
            <h1 className="text-xl font-bold tracking-tight text-[#2a1f18]">
              Daily Manifest
            </h1>
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-xl border border-[#e3ddd2] bg-white px-4 py-2 text-sm font-medium text-[#5a4a3f] shadow-sm hover:bg-[#fdfaf5] transition"
          >
            <Printer size={16} />
            Print Day
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-8 print:pt-0">
        {/* Date Controller */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 print:hidden">
          <div className="flex items-center gap-2 bg-white rounded-xl border border-[#e3ddd2] p-1 shadow-sm w-fit">
            <button
              onClick={() => changeDate(-1)}
              className="p-2 rounded-lg text-[#7a6a5f] hover:bg-[#fdfaf5] hover:text-[#3f3127] transition"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2 px-4 font-semibold text-[#3f3127] min-w-[200px] justify-center">
              <CalendarDays size={18} className="text-[#8b6f47]" />
              {fmtDateLong(selectedDate)}
            </div>
            <button
              onClick={() => changeDate(1)}
              className="p-2 rounded-lg text-[#7a6a5f] hover:bg-[#fdfaf5] hover:text-[#3f3127] transition"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <button
            onClick={setToday}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white border border-[#e3ddd2] text-[#5a4a3f] hover:bg-[#fdfaf5] shadow-sm transition"
          >
            Jump to Today
          </button>
        </div>

        {/* Print Header (Only visible on paper) */}
        <div className="hidden print:block mb-6 border-b border-black pb-4">
          <h1 className="text-3xl font-bold text-black">Daily Manifest</h1>
          <p className="text-lg text-gray-700">{fmtDateLong(selectedDate)}</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8 print:grid-cols-3">
          <div className="rounded-xl border border-[#e3ddd2] bg-white p-4 shadow-sm print:border-gray-300">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#7a6a5f] print:text-gray-500">
              Experiences
            </p>
            <p className="text-2xl font-bold text-[#2a1f18] mt-1 print:text-black">
              {stats.totalExperiences}
            </p>
          </div>
          <div className="rounded-xl border border-[#e3ddd2] bg-white p-4 shadow-sm print:border-gray-300">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#7a6a5f] print:text-gray-500">
              Total Bookings
            </p>
            <p className="text-2xl font-bold text-[#2a1f18] mt-1 print:text-black">
              {stats.totalBookings}
            </p>
          </div>
          <div className="rounded-xl border border-[#e3ddd2] bg-white p-4 shadow-sm print:border-gray-300">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#7a6a5f] print:text-gray-500">
              Total Guests (Pax)
            </p>
            <p className="text-2xl font-bold text-[#2a1f18] mt-1 print:text-black">
              {stats.totalGuests}
            </p>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#7a6a5f]">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-[#8b6f47]" />
            <p>Loading schedule for {selectedDate.toLocaleDateString()}...</p>
          </div>
        ) : dailySlots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white border border-dashed border-[#e3ddd2] rounded-2xl">
            <CalendarDays size={48} className="text-[#d8cfc3] mb-4" />
            <h3 className="text-lg font-medium text-[#5a4a3f]">
              No Experiences Scheduled
            </h3>
            <p className="text-sm text-[#7a6a5f] mt-1">
              There are no slots or bookings for this date.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {dailySlots.map((slot) => {
              const bookings = slot.bookings || [];
              const totalSlotGuests = bookings.reduce(
                (sum, b) => sum + (b.partySize || 0),
                0,
              );

              return (
                <div
                  key={slot.id}
                  className="rounded-2xl border border-[#e3ddd2] bg-white shadow-sm overflow-hidden print:border-gray-400 print:break-inside-avoid"
                >
                  {/* Slot Header */}
                  <div className="bg-[#fdfaf5] border-b border-[#e3ddd2] p-5 print:bg-gray-50 print:border-gray-400">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="flex items-center justify-center bg-[#8b6f47] text-white rounded-lg px-3 py-1 font-bold tracking-wider text-sm shadow-sm print:bg-black print:text-white">
                            {fmtTime(slot.date)}
                          </span>
                          <h2 className="text-xl font-bold text-[#2a1f18] print:text-black">
                            {slot.experienceName || "Unknown Experience"}
                          </h2>
                        </div>
                        <p className="text-sm text-[#7a6a5f] flex items-center gap-2 print:text-gray-600">
                          <Users size={16} />
                          {totalSlotGuests} Guests Total • {bookings.length}{" "}
                          Bookings
                        </p>
                      </div>

                      {slot.guide && (
                        <div className="text-sm bg-white border border-[#e3ddd2] rounded-lg px-3 py-1.5 print:border-gray-300">
                          <span className="text-[#7a6a5f]">Guide/Host:</span>{" "}
                          <span className="font-semibold">{slot.guide}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bookings Table */}
                  <div className="overflow-x-auto">
                    {bookings.length > 0 ? (
                      <table className="w-full text-left text-sm text-[#3f3127] print:text-black">
                        <thead className="bg-white border-b border-[#e3ddd2] text-[#7a6a5f] uppercase tracking-wider text-[11px] print:border-black">
                          <tr>
                            <th className="px-5 py-3 font-semibold">Guest</th>
                            <th className="px-5 py-3 font-semibold text-center">
                              Pax
                            </th>
                            <th className="px-5 py-3 font-semibold">
                              Pickup Info
                            </th>
                            <th className="px-5 py-3 font-semibold">Contact</th>
                            <th className="px-5 py-3 font-semibold text-right">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e3ddd2] print:divide-gray-300">
                          {bookings.map((b) => (
                            <tr
                              key={b.id}
                              className="hover:bg-[#fdfaf5] transition print:hover:bg-transparent"
                            >
                              <td className="px-5 py-4 font-medium text-[#2a1f18] print:text-black">
                                {b.customerName}
                                {b.notes && (
                                  <span className="block mt-1 text-xs text-amber-600 bg-amber-50 rounded p-1 border border-amber-100 print:border-none print:p-0">
                                    <AlertCircle
                                      size={10}
                                      className="inline mr-1 mb-0.5"
                                    />
                                    {b.notes}
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-4 text-center font-bold">
                                {b.partySize}
                              </td>
                              <td className="px-5 py-4">
                                {b.pickupPoint ? (
                                  <div>
                                    <div className="flex items-start gap-1.5 text-[#3f3127]">
                                      <MapPin
                                        size={14}
                                        className="mt-0.5 text-[#8b6f47] shrink-0 print:text-black"
                                      />
                                      <span className="font-medium">
                                        {b.pickupPoint}
                                      </span>
                                    </div>
                                    {b.pickupTime && (
                                      <div className="flex items-center gap-1.5 text-[#7a6a5f] text-xs mt-1 print:text-gray-600">
                                        <Bus size={12} /> {b.pickupTime}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[#a09084] italic">
                                    Direct Arrival
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-4 text-[#7a6a5f] print:text-gray-700">
                                {b.phone && (
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Phone size={12} /> {b.phone}
                                  </div>
                                )}
                                {b.email && (
                                  <div className="flex items-center gap-1.5">
                                    <Mail size={12} /> {b.email}
                                  </div>
                                )}
                              </td>
                              <td className="px-5 py-4 text-right">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                    b.status === "confirmed" ||
                                    b.status === "paid"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 print:border-black"
                                      : "bg-amber-50 text-amber-700 border-amber-200 print:border-gray-500"
                                  }`}
                                >
                                  {b.status === "confirmed" ||
                                  b.status === "paid" ? (
                                    <CheckCircle2 size={12} />
                                  ) : (
                                    <AlertCircle size={12} />
                                  )}
                                  {b.status || "Pending"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-5 text-sm text-[#7a6a5f] italic text-center">
                        No bookings yet for this slot.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
