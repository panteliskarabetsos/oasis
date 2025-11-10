// src/app/bookings/[id]/page.js
"use client";

import { use as useUnwrap, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  format,
  parseISO,
  addMinutes,
  isAfter,
  isBefore,
  isWithinInterval,
  isValid,
} from "date-fns";
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
  QrCode,
  Copy,
  Maximize2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/app/components/SessionWrapper";
import QRCode from "qrcode";

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

  const dateObj = useMemo(() => {
    if (!when) return null;
    const candidate =
      typeof when === "string" ? parseISO(when) : new Date(when);
    return isValid(candidate) ? candidate : null;
  }, [when]);

  const exp = useMemo(() => (booking ? expOf(booking) : null), [booking]);
  const people = useMemo(() => (booking ? peopleOf(booking) : 0), [booking]);

  // Always compute numeric minutes (handles "4 Hours", "2h 30m", etc.)
  const durationMin = useMemo(
    () => getDurationMinutes(booking, exp),
    [booking, exp]
  );

  const status = useMemo(
    () => statusFlags(dateObj, durationMin),
    [dateObj, durationMin]
  );

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

  // ---------- QR support ----------
  const qrValue = useMemo(() => getQrValue(booking), [booking]);
  const shouldShowQr =
    !!dateObj &&
    isValid(dateObj) &&
    !!qrValue &&
    (status.upcoming || status.ongoing);
  const {
    dataUrl: qrDataUrl,
    loading: qrLoading,
    error: qrError,
  } = useQrDataUrl(shouldShowQr ? qrValue : null);
  const canRenderQrImage = !!qrDataUrl && !qrLoading && !qrError;

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

      <main className="max-w-5xl mx-auto pt-24 sm:pt-28 px-4 sm:px-6 pb-16">
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
              <StatusPill when={dateObj} durationMin={durationMin} />
            </header>

            {/* Main grid: left details, right check-in */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Details card */}
              <div className="lg:col-span-2 bg-white border border-[#e4ddd3] rounded-2xl p-6 shadow-md">
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
                    <InfoRow
                      icon={<MapPin className="w-5 h-5 text-[#8b6f47]" />}
                    >
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
                      <span className="whitespace-pre-wrap">
                        {booking.notes}
                      </span>
                    </InfoRow>
                  )}
                </div>

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

                {/* Actions */}
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() =>
                      downloadICS(booking, exp, dateObj, durationMin)
                    }
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
                </div>
              </div>

              {/* Check-in QR card */}
              <div className="lg:col-span-1">
                <CheckInCard
                  visible={shouldShowQr}
                  qrDataUrl={qrDataUrl}
                  qrLoading={qrLoading}
                  qrError={qrError}
                  codeText={qrValue}
                  startsAt={dateObj}
                  endsAt={status.endAt}
                  ongoing={status.ongoing}
                  canRenderQrImage={canRenderQrImage}
                />
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

/* ---------- helpers ---------- */
function whenISO(b) {
  return b?.scheduleSlot?.date || b?.startTime || null;
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
      currency: String(currency || "EUR").toUpperCase(),
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

/* ---------- status helpers ---------- */
function statusFlags(startDate, durationMin = 60) {
  const dur = Number(durationMin);
  if (
    !(startDate instanceof Date) ||
    !isValid(startDate) ||
    !Number.isFinite(dur)
  ) {
    return { upcoming: false, ongoing: false, past: false, endAt: null };
  }
  const endAt = addMinutes(startDate, dur);
  if (!isValid(endAt)) {
    return { upcoming: false, ongoing: false, past: false, endAt: null };
  }
  const now = new Date();
  const upcoming = isBefore(now, startDate);
  const past = isAfter(now, endAt);
  const ongoing =
    !upcoming &&
    !past &&
    isWithinInterval(now, { start: startDate, end: endAt });
  return { upcoming, ongoing, past, endAt };
}

/* ---------- duration parsing ---------- */
function getDurationMinutes(b, exp) {
  const candidates = [
    b?.durationMinutes,
    b?.duration_minutes,
    b?.durationMin,
    exp?.durationMinutes,
    exp?.duration_minutes,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const fromStr =
    parseDurationToMinutes(b?.duration) ??
    parseDurationToMinutes(exp?.duration);
  if (Number.isFinite(fromStr) && fromStr > 0) return fromStr;
  return 60;
}

function parseDurationToMinutes(input) {
  if (!input || typeof input !== "string") return null;
  const s = input.trim().toLowerCase();
  // "2h 30m" / "2 hours 30 minutes"
  const hm = s.match(
    /(?:(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?/i
  );
  if (hm) {
    const h = hm[1] ? parseFloat(hm[1]) : 0;
    const m = hm[2] ? parseInt(hm[2], 10) : 0;
    if (h || m) return Math.round(h * 60 + m);
  }
  // "4h" / "4 hours"
  const onlyH =
    s.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?$/i) ||
    s.match(/^(\d+(?:\.\d+)?)\s*hour(?:s)?$/i);
  if (onlyH) return Math.round(parseFloat(onlyH[1]) * 60);
  // "150m" / "150 minutes"
  const onlyM = s.match(/^(\d+)\s*m(?:in(?:utes?)?)?$/i);
  if (onlyM) return parseInt(onlyM[1], 10);
  return null;
}

/* ---------- QR helpers ---------- */
/* ---------- QR helpers ---------- */
function getPublicBookingRef(b) {
  // Prefer a human-friendly public ref if your API provides one
  const ref =
    b?.publicId || // e.g., "BK-000258"
    b?.bookingRef || // e.g., "BK-000258"
    b?.bookingCode || // alternate naming
    b?.reference || // alternate naming
    b?.code || // if you already store it here
    (Number.isFinite(b?.id) ? `BK-${String(b.id).padStart(6, "0")}` : ""); // fallback from id
  return ref;
}

function getQrValue(b) {
  if (!b) return "";
  const ref = getPublicBookingRef(b);
  if (!ref) return "";
  // Use env if available, else hardcode as requested
  const base =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SITE_URL) ||
    "https://www.youroasis.gr";
  return `${base.replace(/\/+$/, "")}/bookings/${encodeURIComponent(ref)}`;
}

function useQrDataUrl(value) {
  const [dataUrl, setDataUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (!value) {
      setDataUrl("");
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    setDataUrl(""); // ensure we don't flash a stale QR

    QRCode.toDataURL(String(value), { width: 256, margin: 1 })
      .then((url) => {
        if (!cancelled) setDataUrl(url || "");
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setError("QR generation failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [value]);

  return { dataUrl, loading, error };
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

function StatusPill({ when, durationMin = 60 }) {
  const { upcoming, ongoing } = statusFlags(when, durationMin);
  const tone = upcoming
    ? "bg-cyan-100 text-cyan-700"
    : ongoing
    ? "bg-amber-100 text-amber-800"
    : "bg-emerald-100 text-emerald-700";
  const label = upcoming ? "Upcoming" : ongoing ? "Ongoing" : "Completed";
  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${tone}`}
    >
      {label}
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

function CheckInCard({
  visible,
  qrDataUrl,
  qrLoading,
  qrError,
  codeText,
  startsAt,
  endsAt,
  ongoing,
  canRenderQrImage,
}) {
  if (!visible) {
    return (
      <div className="bg-white/70 border border-[#e4ddd3] rounded-2xl p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#7c6f60] mt-0.5" />
          <div>
            <p className="font-medium text-[#5a4a3f]">Check-in unavailable</p>
            <p className="text-sm text-[#7c6f60]">
              The QR appears here for upcoming or ongoing bookings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#e4ddd3] bg-[linear-gradient(180deg,#fffdf8,rgba(255,255,255,0.9))] shadow-md p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <QrCode className="w-5 h-5 text-[#8b6f47]" />
          <h2 className="text-base font-semibold text-[#5a4a3f]">
            Check-in QR
          </h2>
        </div>
        <span className="inline-flex items-center gap-1 text-xs rounded-full bg-[#f1efe8] px-2 py-0.5 border border-[#e8e2d9]">
          <Clock className="w-3.5 h-3.5" />
          {ongoing
            ? "Open now"
            : startsAt && isValid(startsAt)
            ? `Opens at ${format(startsAt, "p")}`
            : "Opens at start time"}
        </span>
      </div>

      <div className="rounded-xl border border-[#eee7dc] bg-white p-4 flex flex-col items-center">
        {qrLoading ? (
          <div className="h-[220px] flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#7c6f60]" />
          </div>
        ) : qrError ? (
          <div className="w-full text-center text-sm text-red-700">
            Could not render QR. Code: {codeText}
          </div>
        ) : canRenderQrImage ? (
          <img
            src={qrDataUrl}
            alt="Check-in QR code"
            className="w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56 select-none"
            draggable={false}
          />
        ) : (
          // Safety net for the "empty src" frame between renders
          <div className="h-[220px] flex items-center justify-center text-xs text-[#7c6f60]">
            Preparing QR…
          </div>
        )}
        <div className="mt-3 w-full flex items-center justify-between text-xs text-[#7c6f60]">
          <span className="truncate" title={codeText}>
            {codeText}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigator.clipboard?.writeText(codeText)}
              className="inline-flex items-center gap-1 rounded-full border border-[#e8e2d9] bg-white px-2 py-1 hover:bg-[#f6f1e6]"
              title="Copy code"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </button>
            {canRenderQrImage && (
              <button
                onClick={() => openQrInNewTab(qrDataUrl)}
                className="inline-flex items-center gap-1 rounded-full border border-[#e8e2d9] bg-white px-2 py-1 hover:bg-[#f6f1e6]"
                title="Open larger"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                View
              </button>
            )}
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-2 text-xs text-[#7c6f60]">
        <li className="flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600" />
          Show this QR at check-in. It’s valid until{" "}
          {endsAt && isValid(endsAt)
            ? format(endsAt, "p")
            : "the end of your slot"}
          .
        </li>
        <li className="flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600" />
          If scanners fail, staff can use the code text as a fallback.
        </li>
      </ul>
    </div>
  );
}

function openQrInNewTab(dataUrl) {
  try {
    const win = window.open();
    if (win) {
      win.document.write(
        `<html><head><title>Check-in QR</title><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
         <body style="margin:0;display:flex;align-items:center;justify-content:center;background:#fff">
           <img src="${dataUrl}" alt="QR" style="max-width:90vw;max-height:90vh"/>
         </body></html>`
      );
      win.document.close();
    }
  } catch {}
}
