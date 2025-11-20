// src/app/[locale]/bookings/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, isAfter, isBefore } from "date-fns";
import { enGB, el as elGR } from "date-fns/locale";
import {
  CalendarDays,
  MapPin,
  Users,
  StickyNote,
  Loader2,
  Search,
  ChevronRight,
  Clock,
} from "lucide-react";
import { useAuth } from "@/app/components/SessionWrapper";
import { useTranslations, useLocale } from "next-intl";

export default function MyBookingsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const t = useTranslations("MyBookings");
  const locale = useLocale();
  const dateLocale = locale === "el" ? elGR : enGB;

  const [bookings, setBookings] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  // ✅ real useState, no broken generics
  const [tab, setTab] = useState("upcoming"); // "upcoming" | "past"
  const [query, setQuery] = useState("");

  // Redirect if not authed
  useEffect(() => {
    if (!loading && !user) {
      router.push(`/${locale}/login`);
    }
  }, [loading, user, router, locale]);

  // Fetch bookings once user is known
  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setFetching(true);
        setError("");
        const res = await fetch("/api/my-bookings", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setBookings(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load bookings", err);
        setError(t("errorFetch"));
        setBookings([]);
      } finally {
        setFetching(false);
      }
    };
    if (user) fetchBookings();
  }, [user, t]);

  const now = useMemo(() => new Date(), []);

  const normalized = useMemo(() => {
    // Pre-compute useful fields & guard against missing data
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

  if (loading) {
    return (
      <FullScreenCenter>
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        {t("checkingSession")}
      </FullScreenCenter>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#fcfaf7] text-[#3d3d3d]">
      {/* Ambient background */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(25rem_25rem_at_20%_-10%,#fff1d6_0%,transparent_60%),radial-gradient(30rem_30rem_at_120%_10%,#e7f7f7_0%,transparent_55%)]"
      />

      <main className="max-w-6xl mx-auto pt-24 sm:pt-28 px-4 sm:px-6">
        {/* Header */}
        <header className="text-center mb-8 sm:mb-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-[#5a4a3f] font-serif tracking-tight">
            {t("title")}
          </h1>
          <p className="text-[#776c5e] mt-3 text-base sm:text-lg">
            {t("subtitle")}
          </p>

          {/* Stats */}
          <div className="mt-6 flex items-center justify-center gap-3">
            <StatChip
              label={t("statUpcoming")}
              value={upcomingBookings.length}
              tone="accent"
            />
            <StatChip label={t("statPast")} value={pastBookings.length} />
          </div>
        </header>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-between mb-6">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b6f47]" />
            <input
              type="text"
              inputMode="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-xl border border-[#e8e2d9] bg-white/70 backdrop-blur px-9 py-2.5 text-sm outline-none placeholder:text-[#9b8f7f] focus:ring-2 focus:ring-[#d8c7a1] focus:border-[#d8c7a1]"
            />
          </div>

          <Tabs
            tab={tab}
            setTab={setTab}
            upcoming={upcomingBookings.length}
            past={pastBookings.length}
          />
        </div>

        {/* Content */}
        {fetching ? (
          <SkeletonGrid />
        ) : error ? (
          <ErrorCard
            message={error}
            onRetry={() => {
              setError("");
              setFetching(true);
              window.location.reload();
            }}
          />
        ) : bookings.length === 0 ? (
          <EmptyState onExplore={() => router.push(`/${locale}/experiences`)} />
        ) : (
          <div className="space-y-12">
            {tab === "upcoming" ? (
              <Section blockTitle={t("sectionUpcomingTitle")}>
                {upcomingBookings.length > 0 ? (
                  <CardsGrid>
                    {upcomingBookings.map((booking) => (
                      <BookingCard
                        key={booking.id}
                        booking={booking}
                        status="upcoming"
                        dateLocale={dateLocale}
                      />
                    ))}
                  </CardsGrid>
                ) : (
                  <MutedCenter>{t("noUpcoming")}</MutedCenter>
                )}
              </Section>
            ) : (
              <Section blockTitle={t("sectionPastTitle")}>
                {pastBookings.length > 0 ? (
                  <CardsGrid>
                    {pastBookings.map((booking) => (
                      <BookingCard
                        key={booking.id}
                        booking={booking}
                        status="past"
                        dateLocale={dateLocale}
                      />
                    ))}
                  </CardsGrid>
                ) : (
                  <MutedCenter>{t("noPast")}</MutedCenter>
                )}
              </Section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/* ---------- Logic helpers ---------- */
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

/* ---------- UI primitives ---------- */
function FullScreenCenter({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f1ec] text-[#5a4a3f] px-4">
      <div className="inline-flex items-center text-sm sm:text-base">
        {children}
      </div>
    </div>
  );
}

function Section({ blockTitle, children }) {
  return (
    <section>
      <h2 className="text-2xl sm:text-3xl font-bold text-[#5a4a3f] mb-6 sm:mb-8">
        {blockTitle}
      </h2>
      {children}
    </section>
  );
}

function CardsGrid({ children }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
      {children}
    </div>
  );
}

function MutedCenter({ children }) {
  return (
    <p className="text-center text-[#8b6f47] bg-white/60 rounded-xl py-6">
      {children}
    </p>
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

function Tabs({ tab, setTab, upcoming, past }) {
  const t = useTranslations("MyBookings");

  return (
    <div className="inline-flex items-center rounded-xl border border-[#e8e2d9] bg-white/70 backdrop-blur p-1">
      <button
        onClick={() => setTab("upcoming")}
        className={`px-4 py-2 text-sm rounded-lg transition-all ${
          tab === "upcoming"
            ? "bg-[#5a4a3f] text-white shadow"
            : "text-[#5a4a3f] hover:bg-[#f6f1e6]"
        }`}
        aria-pressed={tab === "upcoming"}
      >
        {t("tabUpcoming", { count: upcoming })}
      </button>
      <button
        onClick={() => setTab("past")}
        className={`px-4 py-2 text-sm rounded-lg transition-all ${
          tab === "past"
            ? "bg-[#5a4a3f] text-white shadow"
            : "text-[#5a4a3f] hover:bg-[#f6f1e6]"
        }`}
        aria-pressed={tab === "past"}
      >
        {t("tabPast", { count: past })}
      </button>
    </div>
  );
}

function ErrorCard({ message, onRetry }) {
  const t = useTranslations("MyBookings");
  return (
    <div className="bg-white border border-[#e4ddd3] rounded-2xl p-8 text-center shadow text-[#5a4a3f]">
      <p className="text-lg font-semibold mb-2">{t("errorTitle")}</p>
      <p className="text-sm text-[#7c6f60] mb-6">{message}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-full bg-[#8b6f47] text-white px-5 py-2 font-medium hover:bg-[#a78b62] transition-all"
      >
        {t("retryButton")}
      </button>
    </div>
  );
}

function EmptyState({ onExplore }) {
  const t = useTranslations("MyBookings");
  return (
    <div className="bg-white border border-[#e4ddd3] rounded-2xl p-10 text-center shadow text-[#5a4a3f]">
      <p className="text-2xl font-semibold mb-2 font-serif">
        {t("emptyTitle")}
      </p>
      <p className="text-sm text-[#7c6f60] mb-6">{t("emptySubtitle")}</p>
      <button
        onClick={onExplore}
        className="inline-flex items-center gap-2 rounded-full bg-[#8b6f47] text-white px-5 py-2 font-medium hover:bg-[#a78b62] transition-all"
      >
        {t("emptyCta")}
      </button>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <CardsGrid>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="relative bg-white border border-[#e4ddd3] rounded-2xl p-6 shadow-md animate-pulse"
        >
          <div className="h-6 w-2/3 bg-[#eee7dc] rounded mb-4" />
          <div className="space-y-3">
            <div className="h-4 w-4/5 bg-[#eee7dc] rounded" />
            <div className="h-4 w-3/5 bg-[#eee7dc] rounded" />
            <div className="h-4 w-2/5 bg-[#eee7dc] rounded" />
          </div>
          <div className="mt-6 h-9 w-32 bg-[#eee7dc] rounded-full" />
        </div>
      ))}
    </CardsGrid>
  );
}

/* Booking Card Component */
function BookingCard({ booking, status, dateLocale }) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("MyBookings");

  const exp = expOf(booking);
  const when = whenISO(booking);
  const isUpcoming = status === "upcoming";

  const date = when ? parseISO(when) : null;
  const dateStr = date ? format(date, "PPPP", { locale: dateLocale }) : "—";
  const timeStr = date ? format(date, "p", { locale: dateLocale }) : "";

  const nPeople = peopleOf(booking);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/${locale}/bookings/${booking.id}`)}
      onKeyDown={(e) =>
        e.key === "Enter" && router.push(`/${locale}/bookings/${booking.id}`)
      }
      className="relative group bg-white border border-[#e4ddd3] rounded-2xl p-6 shadow-md hover:shadow-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#d8c7a1]"
    >
      {/* Status Label */}
      <span
        className={`absolute top-4 right-4 text-xs font-semibold rounded-full px-3 py-1 ${
          isUpcoming
            ? "bg-cyan-100 text-cyan-700"
            : "bg-emerald-100 text-emerald-700"
        }`}
      >
        {isUpcoming ? t("statusUpcoming") : t("statusCompleted")}
      </span>

      <h3 className="text-xl font-semibold text-[#5a4a3f] mb-4 group-hover:underline">
        {exp?.name || t("experienceFallback")}
      </h3>

      <div className="grid grid-cols-1 gap-3 text-sm text-[#5a4a3f]">
        <InfoRow icon={<CalendarDays className="w-5 h-5 text-[#8b6f47]" />}>
          <span>
            {dateStr} {timeStr && <span>{t("timeAt", { time: timeStr })}</span>}
          </span>
        </InfoRow>

        {exp?.location && (
          <InfoRow icon={<MapPin className="w-5 h-5 text-[#8b6f47]" />}>
            <span>{exp.location}</span>
          </InfoRow>
        )}

        <InfoRow icon={<Users className="w-5 h-5 text-[#8b6f47]" />}>
          <span>{t("peopleCount", { count: nPeople })}</span>
        </InfoRow>

        {booking.duration && (
          <InfoRow icon={<Clock className="w-5 h-5 text-[#8b6f47]" />}>
            <span>{t("durationMinutes", { count: booking.duration })}</span>
          </InfoRow>
        )}

        {booking.notes && (
          <InfoRow icon={<StickyNote className="w-5 h-5 text-[#8b6f47]" />}>
            <span className="line-clamp-2">{booking.notes}</span>
          </InfoRow>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <span className="text-xs text-[#9b8f7f]">
          {t("bookingId", { id: booking.id })}
        </span>
        <div className="inline-flex items-center gap-1 text-[#5a4a3f] font-medium">
          {t("viewDetails")} <ChevronRight className="w-4 h-4" />
        </div>
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
