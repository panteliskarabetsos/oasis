// src/app/bookings/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, isAfter, isBefore } from "date-fns";
import {
  CalendarDays,
  MapPin,
  Users,
  StickyNote,
  Loader2,
  Search,
  ChevronRight,
  Clock,
  CalendarCheck,
  History,
} from "lucide-react";
import { useAuth } from "@/app/components/SessionWrapper";
import { Playfair_Display, DM_Sans } from "next/font/google";

// ---- Fonts ----
const fontSerif = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const fontSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "700"],
  display: "swap",
});

export default function MyBookingsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [bookings, setBookings] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("upcoming");
  const [query, setQuery] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  // Fetch bookings
  useEffect(() => {
    const fetchBookings = async () => {
      if (!user) return;
      try {
        setFetching(true);
        setError("");
        const res = await fetch("/api/my-bookings", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setBookings(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load bookings", err);
        setError("We couldn't load your bookings. Please try again.");
      } finally {
        setFetching(false);
      }
    };
    fetchBookings();
  }, [user]);

  const now = useMemo(() => new Date(), []);

  // Normalize and Sort Data
  const normalized = useMemo(() => {
    return bookings
      .map((b) => ({
        ...b,
        _whenISO: whenISO(b),
        _exp: expOf(b),
        _people: peopleOf(b),
      }))
      .filter((b) => !!b._whenISO);
  }, [bookings]);

  const upcomingBookings = useMemo(() => {
    const arr = normalized
      .filter((b) => isAfter(parseISO(b._whenISO), now))
      .sort((a, b) => parseISO(a._whenISO) - parseISO(b._whenISO));
    return applySearch(arr, query);
  }, [normalized, now, query]);

  const pastBookings = useMemo(() => {
    const arr = normalized
      .filter((b) => isBefore(parseISO(b._whenISO), now))
      .sort((a, b) => parseISO(b._whenISO) - parseISO(a._whenISO));
    return applySearch(arr, query);
  }, [normalized, now, query]);

  // Loading State (Auth)
  if (loading) return <FullScreenLoader />;

  if (!user) return null;

  return (
    <div
      className={`${fontSerif.variable} ${fontSans.variable} font-sans min-h-screen bg-[#f4f1ec] text-[#4d3e33] pb-20`}
    >
      {/* Ambient Background */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[#e7e0d5] to-[#f4f1ec]" />
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#d8cfc3] blur-3xl opacity-40" />
      </div>

      <main className="max-w-6xl mx-auto pt-24 sm:pt-32 px-6">
        {/* Header */}
        <header className="mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C8AA86] mb-2">
                Your Journey
              </p>
              <h1 className="text-4xl md:text-5xl font-serif text-[#4d3e33]">
                My Bookings
              </h1>
            </div>

            {/* Stats Pills */}
            <div className="flex gap-3">
              <StatPill
                icon={<CalendarCheck size={14} />}
                label="Upcoming"
                value={upcomingBookings.length}
                active={tab === "upcoming"}
                onClick={() => setTab("upcoming")}
              />
              <StatPill
                icon={<History size={14} />}
                label="History"
                value={pastBookings.length}
                active={tab === "past"}
                onClick={() => setTab("past")}
              />
            </div>
          </div>
        </header>

        {/* Controls Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-10 bg-white/60 backdrop-blur-md p-2 rounded-2xl border border-[#e4ddd3] shadow-sm">
          {/* Search */}
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b6f47]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search bookings..."
              className="w-full bg-transparent border-none text-sm text-[#4d3e33] placeholder:text-[#9b8f7f] focus:ring-0 pl-10 py-2.5"
            />
          </div>

          {/* Tabs (Visual Toggle) */}
          <div className="flex bg-[#e8dfcf]/50 p-1 rounded-xl w-full sm:w-auto">
            <TabButton
              label="Upcoming"
              count={upcomingBookings.length}
              isActive={tab === "upcoming"}
              onClick={() => setTab("upcoming")}
            />
            <TabButton
              label="Past"
              count={pastBookings.length}
              isActive={tab === "past"}
              onClick={() => setTab("past")}
            />
          </div>
        </div>

        {/* Content Area */}
        {fetching ? (
          <SkeletonGrid />
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={() => window.location.reload()}
          />
        ) : bookings.length === 0 ? (
          <EmptyState onExplore={() => router.push("/experiences")} />
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {tab === "upcoming" ? (
              upcomingBookings.length > 0 ? (
                <CardsGrid>
                  {upcomingBookings.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      isUpcoming={true}
                    />
                  ))}
                </CardsGrid>
              ) : (
                <EmptyTab message="No upcoming reservations." />
              )
            ) : pastBookings.length > 0 ? (
              <CardsGrid>
                {pastBookings.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    isUpcoming={false}
                  />
                ))}
              </CardsGrid>
            ) : (
              <EmptyTab message="No past reservations found." />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* COMPONENTS                                 */
/* -------------------------------------------------------------------------- */

function BookingCard({ booking, isUpcoming }) {
  const router = useRouter();
  const exp = expOf(booking);
  const when = whenISO(booking);

  const dateObj = when ? parseISO(when) : null;
  const day = dateObj ? format(dateObj, "dd") : "--";
  const month = dateObj ? format(dateObj, "MMM") : "";
  const time = dateObj ? format(dateObj, "h:mm a") : "";
  const fullDate = dateObj ? format(dateObj, "EEEE, MMMM do, yyyy") : "";

  return (
    <div
      onClick={() => router.push(`/bookings/${booking.id}`)}
      className="group relative bg-white rounded-[1.5rem] border border-[#e4ddd3] overflow-hidden hover:shadow-[0_20px_40px_-15px_rgba(77,62,51,0.1)] hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col h-full"
    >
      {/* Top Decoration Bar */}
      <div
        className={`h-1.5 w-full ${
          isUpcoming ? "bg-[#C8AA86]" : "bg-[#e4ddd3]"
        }`}
      />

      <div className="p-7 flex flex-col h-full">
        {/* Header: Date Badge & Status */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex flex-col items-center justify-center bg-[#f9f6f3] border border-[#eee8df] rounded-2xl w-14 h-14 text-[#5a4a3f]">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {month}
            </span>
            <span className="text-xl font-serif font-bold leading-none">
              {day}
            </span>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              isUpcoming
                ? "bg-[#C8AA86]/10 text-[#C8AA86]"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {isUpcoming ? "Confirmed" : "Completed"}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-serif text-xl text-[#4d3e33] mb-2 line-clamp-2 group-hover:text-[#C8AA86] transition-colors">
          {exp?.name || "Experience Reservation"}
        </h3>

        {/* Detail Lines */}
        <div className="space-y-3 mt-4 text-sm text-[#7a6a5f]">
          <div className="flex items-center gap-2.5">
            <Clock size={16} className="text-[#b0a090]" />
            <span>
              {fullDate} <span className="text-[#C8AA86]">•</span> {time}
            </span>
          </div>

          {exp?.location && (
            <div className="flex items-center gap-2.5">
              <MapPin size={16} className="text-[#b0a090]" />
              <span className="line-clamp-1">{exp.location}</span>
            </div>
          )}

          <div className="flex items-center gap-2.5">
            <Users size={16} className="text-[#b0a090]" />
            <span>{peopleOf(booking)} guests</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-6 flex items-center justify-between border-t border-[#f4f1ec]">
          <span className="text-xs font-mono text-[#b0a090] uppercase">
            #{booking.id.toString().slice(-6)}
          </span>
          <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#4d3e33] group-hover:translate-x-1 transition-transform">
            View Details <ChevronRight size={14} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatPill({ icon, label, value, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-wider transition-all ${
        active
          ? "bg-[#4d3e33] text-white border-[#4d3e33] shadow-lg"
          : "bg-white border-[#e4ddd3] text-[#7a6a5f] hover:border-[#C8AA86]"
      }`}
    >
      {icon}
      <span>{label}</span>
      <span
        className={`ml-1 px-1.5 py-0.5 rounded-md text-[9px] ${
          active ? "bg-white/20" : "bg-[#f4f1ec]"
        }`}
      >
        {value}
      </span>
    </button>
  );
}

function TabButton({ label, count, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
        isActive
          ? "bg-white text-[#4d3e33] shadow-sm"
          : "text-[#8b7b6f] hover:text-[#4d3e33] hover:bg-white/50"
      }`}
    >
      {label} <span className="opacity-60 text-xs ml-1">({count})</span>
    </button>
  );
}

function EmptyState({ onExplore }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-[#e4ddd3] text-center px-6">
      <div className="w-16 h-16 bg-[#f9f6f3] rounded-full flex items-center justify-center mb-6 text-[#d8cfc3]">
        <CalendarDays size={28} />
      </div>
      <h2 className="font-serif text-2xl text-[#4d3e33] mb-3">
        No bookings yet
      </h2>
      <p className="text-[#8b7b6f] max-w-sm mb-8 leading-relaxed text-sm">
        You haven't made any reservations. Discover unique experiences and start
        your journey with us.
      </p>
      <button
        onClick={onExplore}
        className="px-8 py-3 rounded-full bg-[#4d3e33] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#C8AA86] transition-colors shadow-lg shadow-[#4d3e33]/10"
      >
        Explore Experiences
      </button>
    </div>
  );
}

function EmptyTab({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-[#e4ddd3] rounded-3xl">
      <p className="text-[#8b7b6f]">{message}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center text-red-800">
      <p className="font-medium mb-2">Unable to load bookings</p>
      <p className="text-sm text-red-600 mb-6">{message}</p>
      <button
        onClick={onRetry}
        className="text-xs font-bold uppercase tracking-widest border-b border-red-800 pb-0.5 hover:opacity-70"
      >
        Try Again
      </button>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <CardsGrid>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-white rounded-[1.5rem] border border-[#e4ddd3] p-7 h-[300px] animate-pulse"
        >
          <div className="flex justify-between mb-6">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl" />
            <div className="w-20 h-6 bg-gray-100 rounded-full" />
          </div>
          <div className="w-3/4 h-8 bg-gray-100 rounded-lg mb-4" />
          <div className="space-y-3">
            <div className="w-full h-4 bg-gray-100 rounded" />
            <div className="w-2/3 h-4 bg-gray-100 rounded" />
          </div>
        </div>
      ))}
    </CardsGrid>
  );
}

function CardsGrid({ children }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {children}
    </div>
  );
}

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f4f1ec]">
      <Loader2 className="w-8 h-8 animate-spin text-[#C8AA86] mb-4" />
      <p className="text-xs font-bold uppercase tracking-widest text-[#4d3e33]">
        Loading...
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* LOGIC HELPERS                               */
/* -------------------------------------------------------------------------- */

function whenISO(b) {
  return b?.scheduleSlot?.date || b?.startTime || b?.createdAt || null;
}

function expOf(b) {
  return (
    b?.scheduleSlot?.experience ||
    b?.experience ||
    (b?.experienceName ? { name: b.experienceName, location: "" } : null)
  );
}

function peopleOf(b) {
  if (Number.isFinite(b?.numberOfPeople)) return b.numberOfPeople;
  const a = Number(b?.counts?.adults ?? b?.counts?.adult ?? 0);
  const k = Number(b?.counts?.kids ?? b?.counts?.children ?? 0);
  const fromAttendees = Array.isArray(b?.attendees) ? b.attendees.length : 0;
  return a + k || fromAttendees || 1;
}

function applySearch(arr, q) {
  if (!q) return arr;
  const s = q.trim().toLowerCase();
  return arr.filter((b) => {
    const name = (b?._exp?.name || "").toLowerCase();
    const loc = (b?._exp?.location || "").toLowerCase();
    return name.includes(s) || loc.includes(s);
  });
}
