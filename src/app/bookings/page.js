// src/app/bookings/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, isAfter, isBefore } from "date-fns";
import { CalendarDays, MapPin, Users, StickyNote, Loader2 } from "lucide-react";
import { useAuth } from "@/app/components/SessionWrapper";

export default function MyBookingsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [bookings, setBookings] = useState([]);
  const [fetching, setFetching] = useState(true);

  // Redirect if not authed
  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  // Fetch bookings once user is known
  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setFetching(true);
        const res = await fetch("/api/my-bookings", { cache: "no-store" });
        const data = await res.json();
        setBookings(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load bookings", err);
        setBookings([]);
      } finally {
        setFetching(false);
      }
    };
    if (user) fetchBookings();
  }, [user]);

  const now = useMemo(() => new Date(), []);
  const upcomingBookings = useMemo(
    () =>
      bookings.filter(
        (b) =>
          b.scheduleSlot?.date && isAfter(parseISO(b.scheduleSlot.date), now)
      ),
    [bookings, now]
  );
  const pastBookings = useMemo(
    () =>
      bookings.filter(
        (b) =>
          b.scheduleSlot?.date && isBefore(parseISO(b.scheduleSlot.date), now)
      ),
    [bookings, now]
  );

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f1ec] text-[#5a4a3f]">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading your bookings...
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#fdfaf7] pt-28 px-6 text-[#3d3d3d]">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-[#5a4a3f] font-serif tracking-tight">
            My Bookings
          </h1>
          <p className="text-[#776c5e] mt-3 text-base sm:text-lg">
            Manage your upcoming experiences and review your past visits.
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            <StatChip
              label="Upcoming"
              value={upcomingBookings.length}
              tone="accent"
            />
            <StatChip label="Past" value={pastBookings.length} />
          </div>
        </header>

        {bookings.length === 0 ? (
          <EmptyState onExplore={() => router.push("/experiences")} />
        ) : (
          <div className="space-y-16">
            {/* UPCOMING */}
            <section>
              <SectionTitle>Upcoming Reservations</SectionTitle>
              {upcomingBookings.length > 0 ? (
                <div className="grid gap-8">
                  {upcomingBookings.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      status="upcoming"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-center text-[#8b6f47]">
                  No upcoming reservations.
                </p>
              )}
            </section>

            {/* PAST */}
            <section>
              <SectionTitle>Past Reservations</SectionTitle>
              {pastBookings.length > 0 ? (
                <div className="grid gap-8">
                  {pastBookings.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      status="past"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-center text-[#8b6f47]">
                  No past reservations yet.
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- UI bits ---------- */

function SectionTitle({ children }) {
  return (
    <h2 className="text-2xl sm:text-3xl font-bold text-[#5a4a3f] mb-8">
      {children}
    </h2>
  );
}

function StatChip({ label, value, tone = "neutral" }) {
  const toneClass =
    tone === "accent"
      ? "bg-[#fff1d6] text-[#8b6f47] border-[#f1e2c2]"
      : "bg-[#f6f4f0] text-[#5a4a3f] border-[#e8e2d9]";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${toneClass}`}
    >
      <span className="font-semibold">{value}</span>
      <span>{label}</span>
    </span>
  );
}

function EmptyState({ onExplore }) {
  return (
    <div className="bg-white border border-[#e4ddd3] rounded-2xl p-10 text-center shadow text-[#5a4a3f]">
      <p className="text-2xl font-semibold mb-2 font-serif">No bookings yet</p>
      <p className="text-sm text-[#7c6f60] mb-6">
        Discover unique experiences and start your journey.
      </p>
      <button
        onClick={onExplore}
        className="inline-flex items-center gap-2 rounded-full bg-[#8b6f47] text-white px-5 py-2 font-medium hover:bg-[#a78b62] transition-all"
      >
        Explore Experiences
      </button>
    </div>
  );
}

/* Booking Card Component */
function BookingCard({ booking, status }) {
  const date = booking.scheduleSlot?.date;
  const experience = booking.scheduleSlot?.experience;
  const isUpcoming = status === "upcoming";

  const dateStr = date ? format(parseISO(date), "PPPP") : "—";
  const timeStr = date ? format(parseISO(date), "p") : "";

  return (
    <div className="relative bg-white border border-[#e4ddd3] rounded-2xl p-6 shadow-md hover:shadow-lg transition-all duration-300 group">
      {/* Status Label */}
      <span
        className={`absolute top-4 right-4 text-xs font-semibold rounded-full px-3 py-1 ${
          isUpcoming
            ? "bg-cyan-100 text-cyan-700"
            : "bg-emerald-100 text-emerald-700"
        }`}
      >
        {isUpcoming ? "Upcoming" : "Completed"}
      </span>

      <h3 className="text-xl font-semibold text-[#5a4a3f] mb-4 group-hover:underline">
        {experience?.name || "Experience"}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-[#5a4a3f]">
        <InfoRow icon={<CalendarDays className="w-5 h-5 text-[#8b6f47]" />}>
          <span>
            {dateStr} {timeStr && <span>at {timeStr}</span>}
          </span>
        </InfoRow>

        <InfoRow icon={<MapPin className="w-5 h-5 text-[#8b6f47]" />}>
          <span>{experience?.location || "—"}</span>
        </InfoRow>

        <InfoRow icon={<Users className="w-5 h-5 text-[#8b6f47]" />}>
          <span>
            {booking.numberOfPeople}{" "}
            {booking.numberOfPeople === 1 ? "person" : "people"}
          </span>
        </InfoRow>

        {booking.notes && (
          <InfoRow icon={<StickyNote className="w-5 h-5 text-[#8b6f47]" />}>
            <span className="line-clamp-2">{booking.notes}</span>
          </InfoRow>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon, children }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      {children}
    </div>
  );
}
