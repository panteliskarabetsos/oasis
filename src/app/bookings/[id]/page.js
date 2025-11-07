// src/app/bookings/[id]/page.js
"use client";

import { use as useUnwrap, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO, addMinutes } from "date-fns";
import {
  CalendarDays,
  MapPin,
  Users,
  StickyNote,
  Loader2,
  Clock,
  ChevronLeft,
  Download,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/app/components/SessionWrapper";

export default function BookingDetailsPage({ params }) {
  const { id } = useUnwrap(params);
  const router = useRouter();
  const { user, loading } = useAuth();

  const [booking, setBooking] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  // redirect if no session
  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !id) return;

    let aborted = false;
    const load = async () => {
      try {
        setFetching(true);
        setError("");
        // Try RESTful first, then query-style as a fallback.
        const tryUrls = [`/api/my-bookings/${id}`, `/api/my-bookings?id=${id}`];
        let data = null;
        for (const url of tryUrls) {
          const res = await fetch(url, { cache: "no-store" });
          if (res.ok) {
            data = await res.json();
            break;
          }
        }
        if (aborted) return;
        if (!data || (data && data.error))
          throw new Error(data?.error || "Not found");
        setBooking(data);
      } catch (err) {
        if (aborted) return;
        console.error(err);
        setError(
          "We couldn't load that booking. It may have been removed or the link is incorrect."
        );
      } finally {
        if (!aborted) setFetching(false);
      }
    };

    load();
    return () => {
      aborted = true;
    };
  }, [user, id]);

  const when = useMemo(() => (booking ? whenISO(booking) : null), [booking]);
  const dateObj = useMemo(() => (when ? parseISO(when) : null), [when]);
  const exp = useMemo(() => (booking ? expOf(booking) : null), [booking]);
  const people = useMemo(() => (booking ? peopleOf(booking) : 0), [booking]);

  const durationMin =
    booking?.duration ||
    booking?.duration_minutes ||
    booking?.durationMinutes ||
    60;

  const gcalHref = useMemo(() => {
    if (!dateObj) return "#";
    const startUtc = toCalStamp(dateObj);
    const endUtc = toCalStamp(addMinutes(dateObj, durationMin));
    const text = encodeURIComponent(exp?.name || "Reservation");
    const details = encodeURIComponent(
      `Booking ID: ${booking?.id}\n${booking?.notes || ""}`
    );
    const location = encodeURIComponent(exp?.location || "");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${startUtc}/${endUtc}&details=${details}&location=${location}`;
  }, [dateObj, durationMin, booking, exp]);

  if (loading || fetching) {
    return (
      <FullScreenCenter>
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading booking...
      </FullScreenCenter>
    );
  }
  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#fcfaf7] text-[#3d3d3d]">
      {/* ambient background */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(25rem_25rem_at_20%_-10%,#fff1d6_0%,transparent_60%),radial-gradient(30rem_30rem_at_120%_10%,#e7f7f7_0%,transparent_55%)]"
      />

      <main className="max-w-4xl mx-auto pt-24 sm:pt-28 px-4 sm:px-6 pb-16">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/bookings"
            className="inline-flex items-center gap-2 text-[#5a4a3f] hover:underline"
          >
            <ChevronLeft className="w-4 h-4" /> Back to My Bookings
          </Link>
        </div>

        {error ? (
          <ErrorCard message={error} />
        ) : (
          <div className="space-y-6">
            {/* Title & status */}
            <header className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-[#5a4a3f] font-serif tracking-tight">
                  {exp?.name || "Experience"}
                </h1>
                <p className="text-sm text-[#7c6f60] mt-1">
                  Booking ID: {booking?.id}
                </p>
              </div>
              <StatusPill when={dateObj} />
            </header>

            {/* Card */}
            <section className="bg-white border border-[#e4ddd3] rounded-2xl p-6 shadow-md">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-[#5a4a3f]">
                <InfoRow
                  icon={<CalendarDays className="w-5 h-5 text-[#8b6f47]" />}
                >
                  {dateObj ? (
                    <span>
                      {format(dateObj, "PPPP")}{" "}
                      <span className="text-[#7c6f60]">at</span>{" "}
                      {format(dateObj, "p")} (<span>{durationMin}</span> min)
                    </span>
                  ) : (
                    <span>—</span>
                  )}
                </InfoRow>

                {exp?.location && (
                  <InfoRow icon={<MapPin className="w-5 h-5 text-[#8b6f47]" />}>
                    <span>{exp.location}</span>
                  </InfoRow>
                )}

                <InfoRow icon={<Users className="w-5 h-5 text-[#8b6f47]" />}>
                  <span>
                    {people} {people === 1 ? "person" : "people"}
                  </span>
                </InfoRow>

                {booking?.counts && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs rounded-full bg-[#f6f4f0] px-2 py-1 border border-[#e8e2d9]">
                      adults:{" "}
                      {booking.counts.adults ?? booking.counts.adult ?? 0}
                    </span>
                    <span className="text-xs rounded-full bg-[#f6f4f0] px-2 py-1 border border-[#e8e2d9]">
                      kids:{" "}
                      {booking.counts.kids ?? booking.counts.children ?? 0}
                    </span>
                  </div>
                )}

                {booking?.notes && (
                  <InfoRow
                    icon={<StickyNote className="w-5 h-5 text-[#8b6f47]" />}
                  >
                    <span className="whitespace-pre-wrap">{booking.notes}</span>
                  </InfoRow>
                )}
              </div>

              {/* Price (if available) */}
              {(booking?.totalPaidAmount ||
                booking?.total ||
                booking?.price) && (
                <div className="mt-6 pt-4 border-t border-[#eee7dc] flex items-center justify-between">
                  <span className="text-[#7c6f60] text-sm">Total paid</span>
                  <span className="text-lg font-semibold">
                    {formatMoney(
                      booking?.totalPaidAmount ??
                        booking?.total ??
                        booking?.price,
                      booking?.currency || booking?.totalPaidCurrency || "EUR"
                    )}
                  </span>
                </div>
              )}
            </section>

            {/* Actions */}
            <section className="flex flex-wrap gap-3">
              <button
                onClick={() => downloadICS(booking, exp, dateObj, durationMin)}
                className="inline-flex items-center gap-2 rounded-full bg-[#8b6f47] text-white px-5 py-2 font-medium hover:bg-[#a78b62] transition-all"
              >
                <Download className="w-4 h-4" /> Download .ics
              </button>

              <a
                href={gcalHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-[#e8e2d9] bg-white px-5 py-2 text-[#5a4a3f] hover:bg-[#f6f1e6]"
              >
                <ExternalLink className="w-4 h-4" /> Add to Google Calendar
              </a>

              {/* Future: enable when endpoints exist */}
              {/* <button className="inline-flex items-center gap-2 rounded-full border border-[#e8e2d9] bg-white px-5 py-2 text-[#5a4a3f] hover:bg-[#f6f1e6]">Reschedule</button>
              <button className="inline-flex items-center gap-2 rounded-full border border-[#e8e2d9] bg-white px-5 py-2 text-[#5a4a3f] hover:bg-[#f6f1e6]">Cancel booking</button> */}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

/* ---------- helpers ---------- */
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

function toCalStamp(date) {
  // YYYYMMDDTHHmmssZ in UTC
  const pad = (n) => String(n).padStart(2, "0");
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const mm = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

function formatMoney(amount, currency = "EUR") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function downloadICS(booking, exp, dateObj, durationMin) {
  if (!dateObj) return;
  const dtStart = toCalStamp(dateObj);
  const dtEnd = toCalStamp(addMinutes(dateObj, durationMin));
  const uid = `${booking?.id}@yourapp`;
  const title = (exp?.name || "Reservation").replace(/\n/g, " ");
  const loc = (exp?.location || "").replace(/\n/g, ", ");
  const details = `Booking ID: ${booking?.id}\n${booking?.notes || ""}`.replace(
    /\n/g,
    "\\n"
  );

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Your App//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toCalStamp(new Date())}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICS(title)}`,
    loc ? `LOCATION:${escapeICS(loc)}` : "",
    details ? `DESCRIPTION:${escapeICS(details)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(title)}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeICS(str) {
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/* ---------- UI bits ---------- */
function FullScreenCenter({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f1ec] text-[#5a4a3f] px-4">
      <div className="inline-flex items-center text-sm sm:text-base">
        {children}
      </div>
    </div>
  );
}

function ErrorCard({ message }) {
  return (
    <div className="bg-white border border-[#e4ddd3] rounded-2xl p-8 text-center shadow text-[#5a4a3f]">
      <p className="text-lg font-semibold mb-2">Not available</p>
      <p className="text-sm text-[#7c6f60] mb-6">{message}</p>
      <Link
        href="/bookings"
        className="inline-flex items-center gap-2 rounded-full bg-[#8b6f47] text-white px-5 py-2 font-medium hover:bg-[#a78b62] transition-all"
      >
        <ChevronLeft className="w-4 h-4" /> Back to My Bookings
      </Link>
    </div>
  );
}

function StatusPill({ when }) {
  const now = new Date();
  const upcoming = when && when.getTime() > now.getTime();
  const tone = upcoming
    ? "bg-cyan-100 text-cyan-700"
    : "bg-emerald-100 text-emerald-700";
  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${tone}`}
    >
      {upcoming ? "Upcoming" : "Completed"}
    </span>
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
