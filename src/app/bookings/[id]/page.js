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
  Share2,
  Printer,
  Navigation,
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
  const [copied, setCopied] = useState(false);
  const [downloadingTicket, setDownloadingTicket] = useState(false);

  // --- Auth & Fetch Logic ---
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
        if (!data || data.error) throw new Error(data?.error || "Not found");
        setBooking(data);
      } catch (err) {
        if (!aborted) {
          console.error(err);
          setError("We couldn't load that booking.");
        }
      } finally {
        if (!aborted) setFetching(false);
      }
    };

    load();
    return () => {
      aborted = true;
    };
  }, [user, id]);

  // --- Actions ---
  async function handleDownloadTicket() {
    if (!booking?.id) return;
    try {
      setDownloadingTicket(true);
      const res = await fetch(`/api/bookings/${booking.id}/invoice`, {
        method: "GET",
      });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ticket-${getPublicBookingRef(booking)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Could not download ticket PDF.");
    } finally {
      setDownloadingTicket(false);
    }
  }

  // --- Computed Data ---
  const when = useMemo(() => (booking ? whenISO(booking) : null), [booking]);
  const dateObj = useMemo(() => {
    if (!when) return null;
    const candidate =
      typeof when === "string" ? parseISO(when) : new Date(when);
    return isValid(candidate) ? candidate : null;
  }, [when]);

  const exp = useMemo(() => (booking ? expOf(booking) : null), [booking]);
  const people = useMemo(() => (booking ? peopleOf(booking) : 0), [booking]);
  const durationMin = useMemo(
    () => getDurationMinutes(booking, exp),
    [booking, exp]
  );
  const status = useMemo(
    () => statusFlags(dateObj, durationMin),
    [dateObj, durationMin]
  );

  // Links
  const gcalHref = useMemo(() => {
    if (!dateObj) return "#";
    const startUtc = toCalStamp(dateObj);
    const endUtc = toCalStamp(addMinutes(dateObj, durationMin));
    const text = encodeURIComponent(exp?.name || "Reservation");
    const details = encodeURIComponent(
      `Ref: ${getPublicBookingRef(booking)}\n${booking?.notes || ""}`
    );
    const location = encodeURIComponent(exp?.location || "");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${startUtc}/${endUtc}&details=${details}&location=${location}`;
  }, [dateObj, durationMin, booking, exp]);

  const mapHref = useMemo(
    () => (exp?.location ? toMapHref(exp.location) : "#"),
    [exp]
  );

  // QR Logic
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

  // Copy Feedback
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  // --- RENDER ---

  if (loading) return <LoadingSkeleton />;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#fcfaf7] text-[#5a4a3f] selection:bg-[#d4c5b0] selection:text-[#3d2f26]">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#f7f0e6] rounded-full blur-3xl opacity-60" />
        <div className="absolute top-[20%] right-[-5%] w-[400px] h-[400px] bg-[#e8f5f6] rounded-full blur-3xl opacity-60" />
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-32">
        {/* Navigation & Breadcrumbs */}
        <nav className="flex items-center justify-between mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <Link
            href="/bookings"
            className="group inline-flex items-center gap-2 text-sm font-medium text-[#8b6f47] hover:text-[#6b5436] transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-white border border-[#e8e2d9] flex items-center justify-center group-hover:border-[#d4c5b0] transition-colors shadow-sm">
              <ChevronLeft className="w-4 h-4 relative right-[1px]" />
            </div>
            Back to Bookings
          </Link>

          {booking && (
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-[#8b6f47] bg-[#f4f1ec] px-3 py-1.5 rounded-full border border-[#e8e2d9]">
              <span>REF:</span>
              <span className="font-bold tracking-wider">
                {getPublicBookingRef(booking)}
              </span>
            </div>
          )}
        </nav>

        {fetching ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-10">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <StatusBadge status={status} />
                  {exp?.category && (
                    <span className="text-xs font-medium uppercase tracking-widest text-[#9ca3af]">
                      {exp.category}
                    </span>
                  )}
                </div>
                <h1 className="text-3xl md:text-5xl font-serif text-[#3d2f26] leading-tight">
                  {exp?.name || "Experience Reservation"}
                </h1>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[#7c6f60] pt-1">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-[#8b6f47]" />
                    {dateObj ? format(dateObj, "EEEE, MMMM do") : "Date TBD"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#8b6f47]" />
                    {dateObj ? format(dateObj, "h:mm a") : "--:--"}{" "}
                    <span className="opacity-50">•</span> {durationMin} min
                  </div>
                </div>
              </div>

              {/* Desktop Actions */}
              <div className="hidden md:flex flex-wrap items-center justify-end gap-3 max-w-sm">
                <button
                  onClick={() => shareBooking(booking, exp, dateObj)}
                  className="inline-flex items-center gap-2 rounded-full border border-[#e8e2d9] bg-white px-5 py-2.5 text-[#5a4a3f] font-medium shadow-sm hover:bg-[#faf9f6] transition-all active:scale-95"
                >
                  <Share2 className="w-4 h-4" /> Share
                </button>
                <button
                  onClick={handleDownloadTicket}
                  disabled={downloadingTicket}
                  className="inline-flex items-center gap-2 rounded-full bg-[#8b6f47] text-white px-6 py-2.5 font-medium shadow-md hover:bg-[#6b5436] hover:shadow-lg transition-all active:scale-95"
                >
                  {downloadingTicket ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {downloadingTicket ? "Generating..." : "Download PDF"}
                </button>
              </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Details */}
              <div className="lg:col-span-7 space-y-8">
                {/* Summary Card */}
                <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-[#e8e2d9] shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)]">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[#8b6f47] mb-4">
                    Booking Details
                  </h3>

                  <div className="space-y-5">
                    <DetailRow
                      icon={MapPin}
                      label="Location"
                      value={exp?.location}
                      action={
                        exp?.location
                          ? { label: "Get Directions", href: mapHref }
                          : null
                      }
                    />
                    <DetailRow
                      icon={Users}
                      label="Guests"
                      value={`${people} People`}
                      subValue={formatGuestBreakdown(booking)}
                    />

                    {booking?.notes && (
                      <DetailRow
                        icon={StickyNote}
                        label="Special Requests"
                        value={booking.notes}
                      />
                    )}

                    <div className="pt-4 mt-4 border-t border-dashed border-[#e8e2d9] flex justify-between items-center">
                      <span className="text-sm text-[#7c6f60]">
                        Total Payment
                      </span>
                      <span className="text-xl font-serif text-[#3d2f26]">
                        {formatMoney(
                          booking?.totalPaidAmount ??
                            booking?.total ??
                            booking?.price ??
                            0,
                          booking?.currency
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Additional Info / Reschedule */}
                <div className="bg-[#f4f1ec] rounded-xl p-6 border border-[#e8e2d9] flex items-start gap-4">
                  <div className="p-2 bg-white rounded-full shadow-sm">
                    <AlertCircle className="w-5 h-5 text-[#8b6f47]" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#5a4a3f]">
                      Need to reschedule?
                    </h4>
                    <p className="text-sm text-[#7c6f60] mt-1 leading-relaxed">
                      Changes can be made up to 24 hours before your slot.
                      Please contact support referencing your booking ID.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: The Ticket */}
              <div className="lg:col-span-5">
                <div className="sticky top-28">
                  <TicketCard
                    booking={booking}
                    qrDataUrl={qrDataUrl}
                    qrLoading={qrLoading}
                    qrError={qrError}
                    qrValue={qrValue}
                    dateObj={dateObj}
                    status={status}
                    copied={copied}
                    onCopy={() => setCopied(true)}
                  />

                  {/* Print/Calendar Actions below ticket */}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <a
                      href={gcalHref}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 p-3 rounded-xl border border-[#e8e2d9] bg-white text-sm hover:bg-[#faf9f6] transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" /> Add to Calendar
                    </a>
                    <button
                      onClick={() =>
                        printTicket({
                          qrDataUrl,
                          codeText: qrValue,
                          startsAt: dateObj,
                        })
                      }
                      className="flex items-center justify-center gap-2 p-3 rounded-xl border border-[#e8e2d9] bg-white text-sm hover:bg-[#faf9f6] transition-colors"
                    >
                      <Printer className="w-4 h-4" /> Print Ticket
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Floating Action Bar */}
      {!error && !fetching && (
        <MobileActionBar
          onDownload={handleDownloadTicket}
          onDirections={() => window.open(mapHref, "_blank")}
          onShare={() => shareBooking(booking, exp, dateObj)}
        />
      )}
    </div>
  );
}

/*  COMPONENT: TICKET CARD  */

function TicketCard({
  booking,
  qrDataUrl,
  qrLoading,
  qrError,
  qrValue,
  dateObj,
  status,
  copied,
  onCopy,
}) {
  const isGenerating = qrLoading || (qrValue && !qrDataUrl && !qrError);

  const isExpired = status.past;

  return (
    <div className="relative group filter drop-shadow-xl transition-transform duration-300 hover:scale-[1.01]">
      {/* Top Half */}
      <div
        className={`rounded-t-2xl p-6 relative overflow-hidden text-[#fcfaf7] transition-colors duration-500 ${
          isExpired ? "bg-[#5a4a3f]" : "bg-[#3d2f26]"
        }`}
      >
        {/* Decorative Circles */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-[#ffffff] opacity-5 rounded-full blur-2xl translate-x-8 -translate-y-8" />

        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-[#a89b8e] text-xs font-bold uppercase tracking-widest mb-1">
              {isExpired ? "Past Event" : "Entry Ticket"}
            </p>
            <p className="text-xl font-serif tracking-wide">
              {getPublicBookingRef(booking)}
            </p>
          </div>
          <div
            className={`px-2 py-1 rounded text-xs font-bold uppercase border ${
              status.upcoming
                ? "border-emerald-500/50 text-emerald-300"
                : status.ongoing
                ? "border-amber-500/50 text-amber-300"
                : "border-white/20 text-white/40 bg-white/5" // Expired style
            }`}
          >
            {status.upcoming ? "Valid" : status.ongoing ? "Active" : "Expired"}
          </div>
        </div>

        <div
          className={`grid grid-cols-2 gap-4 text-sm ${
            isExpired ? "opacity-50" : ""
          }`}
        >
          <div>
            <p className="text-[#8b7a6b] text-xs uppercase mb-1">Date</p>
            <p className="font-medium">
              {dateObj ? format(dateObj, "MMM dd, yyyy") : "TBD"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[#8b7a6b] text-xs uppercase mb-1">Time</p>
            <p className="font-medium">
              {dateObj ? format(dateObj, "h:mm a") : "--:--"}
            </p>
          </div>
        </div>
      </div>

      <div
        className={`relative h-6 flex items-center ${
          isExpired ? "bg-[#5a4a3f]" : "bg-[#3d2f26]"
        }`}
      >
        <div className="w-full h-[1px] border-t border-dashed border-[#6b584a] mx-4" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-6 bg-[#fcfaf7] rounded-r-full" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-6 bg-[#fcfaf7] rounded-l-full" />
      </div>

      {/* Bottom Half (QR Area) */}
      <div className="bg-white rounded-b-2xl p-6 flex flex-col items-center justify-center relative border-b border-x border-[#e8e2d9]">
        {/* CONDITIONAL RENDERING FOR QR AREA */}
        {isExpired ? (
          // 1. Expired State
          <div className="w-48 h-48 flex flex-col items-center justify-center text-[#d4c5b0] gap-2 grayscale opacity-60">
            <QrCode className="w-12 h-12 mb-1" />
            <span className="text-xs font-medium uppercase tracking-widest text-[#9ca3af]">
              Ticket Expired
            </span>
          </div>
        ) : isGenerating ? (
          // 2. Loading State
          <div className="w-48 h-48 flex flex-col items-center justify-center text-[#d4c5b0] gap-3">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-xs uppercase tracking-widest">
              Generating ID
            </span>
          </div>
        ) : qrError || !qrValue ? (
          // 3. Error State
          <div className="w-48 h-48 flex flex-col items-center justify-center text-red-400 bg-red-50 rounded-lg">
            <AlertCircle className="w-8 h-8 mb-2" />
            <span className="text-xs">Code Unavailable</span>
          </div>
        ) : (
          // 4. Success State (QR)
          <div className="relative group/qr">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="QR Code"
                className="w-48 h-48 mix-blend-multiply"
              />
            )}
            <button
              onClick={() => qrDataUrl && openQrInNewTab(qrDataUrl)}
              className="absolute inset-0 bg-black/5 flex items-center justify-center opacity-0 group-hover/qr:opacity-100 transition-opacity rounded-lg"
            >
              <Maximize2 className="w-8 h-8 text-[#3d2f26] drop-shadow-md" />
            </button>
          </div>
        )}

        {/* Copy Button */}
        {!isExpired && (
          <div
            onClick={onCopy}
            className="mt-4 flex items-center gap-2 text-xs font-mono text-[#7c6f60] bg-[#f6f4f0] px-3 py-1.5 rounded-md cursor-pointer hover:bg-[#e8e2d9] transition-colors active:scale-95 select-none"
          >
            {copied ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span className={copied ? "text-emerald-700" : ""}>
              {copied ? "Copied" : qrValue || "BK-######"}
            </span>
          </div>
        )}

        {/* Expired Text Message */}
        {isExpired && (
          <div className="mt-4 text-xs text-[#9ca3af] font-medium">
            Thank you for visiting
          </div>
        )}
      </div>
    </div>
  );
}

/* UI HELPERS */

function MobileActionBar({ onDownload, onDirections, onShare }) {
  return (
    <div className="md:hidden fixed bottom-6 left-6 right-6 z-50">
      <div className="bg-[#3d2f26]/90 backdrop-blur-lg text-white rounded-2xl p-1.5 shadow-2xl flex items-center justify-between border border-[#554335]">
        <button
          onClick={onDownload}
          className="flex-1 flex flex-col items-center py-2 gap-1 rounded-xl active:bg-white/10"
        >
          <Download className="w-5 h-5" />
          <span className="text-[10px] font-medium">Ticket</span>
        </button>
        <div className="w-[1px] h-8 bg-white/10" />
        <button
          onClick={onDirections}
          className="flex-1 flex flex-col items-center py-2 gap-1 rounded-xl active:bg-white/10"
        >
          <Navigation className="w-5 h-5" />
          <span className="text-[10px] font-medium">Map</span>
        </button>
        <div className="w-[1px] h-8 bg-white/10" />
        <button
          onClick={onShare}
          className="flex-1 flex flex-col items-center py-2 gap-1 rounded-xl active:bg-white/10"
        >
          <Share2 className="w-5 h-5" />
          <span className="text-[10px] font-medium">Share</span>
        </button>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value, subValue, action }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-4">
      <div className="shrink-0 w-10 h-10 rounded-full bg-[#fcfaf7] border border-[#e8e2d9] flex items-center justify-center">
        <Icon className="w-5 h-5 text-[#8b6f47]" />
      </div>
      <div className="flex-1">
        <p className="text-xs font-semibold uppercase text-[#9ca3af] mb-0.5">
          {label}
        </p>
        <p className="text-[#3d2f26] font-medium text-base leading-snug">
          {value}
        </p>
        {subValue && (
          <p className="text-sm text-[#7c6f60] mt-0.5">{subValue}</p>
        )}
        {action && (
          <a
            href={action.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-[#8b6f47] hover:underline"
          >
            {action.label} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  if (status.upcoming) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{" "}
        Upcoming
      </span>
    );
  }
  if (status.ongoing) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
        <Clock className="w-3.5 h-3.5" /> Happening Now
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
      Completed
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#fcfaf7] flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-4 animate-pulse">
        <div className="h-8 w-2/3 bg-gray-200 rounded mx-auto" />
        <div className="h-4 w-1/2 bg-gray-200 rounded mx-auto" />
        <div className="h-64 bg-gray-200 rounded-2xl mt-8" />
      </div>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-in zoom-in-95 duration-300">
      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>
      <h2 className="text-xl font-serif font-bold text-[#3d2f26] mb-2">
        Booking Unavailable
      </h2>
      <p className="text-[#7c6f60] max-w-md mb-8">{message}</p>
      <Link
        href="/bookings"
        className="inline-flex items-center gap-2 rounded-full bg-[#8b6f47] text-white px-6 py-2.5 font-medium shadow-md hover:bg-[#6b5436] hover:shadow-lg transition-all active:scale-95"
      >
        Return to My Bookings
      </Link>
    </div>
  );
}

/* ================= LOGIC HELPERS ================= */

function formatMoney(amount, currency = "EUR") {
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: currency || "EUR",
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function formatGuestBreakdown(b) {
  if (!b) return "";
  const a = b.counts?.adults ?? b.counts?.adult ?? 0;
  const k = b.counts?.kids ?? b.counts?.children ?? 0;
  if (a || k) {
    const parts = [];
    if (a > 0) parts.push(`${a} Adult${a > 1 ? "s" : ""}`);
    if (k > 0) parts.push(`${k} Child${k > 1 ? "ren" : ""}`);
    return parts.join(", ");
  }
  return null;
}

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
  const parse = (s) => {
    if (!s || typeof s !== "string") return 0;
    const norm = s.toLowerCase();
    const hm = norm.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/);
    if (hm) return Number(hm[1] || 0) * 60 + Number(hm[2] || 0);
    return 60;
  };
  return parse(b?.duration) || parse(exp?.duration) || 60;
}

function statusFlags(startDate, durationMin) {
  if (!startDate || !isValid(startDate))
    return { upcoming: false, ongoing: false, past: false };
  const endAt = addMinutes(startDate, durationMin);
  const now = new Date();
  return {
    upcoming: isBefore(now, startDate),
    past: isAfter(now, endAt),
    ongoing: isWithinInterval(now, { start: startDate, end: endAt }),
  };
}

function getPublicBookingRef(b) {
  return (
    b?.publicId ||
    b?.bookingRef ||
    b?.bookingCode ||
    b?.code ||
    (b?.id ? `BK-${b.id}` : "REF-???")
  );
}

function getQrValue(b) {
  if (!b) return "";
  const ref = getPublicBookingRef(b);
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://yourapp.com";
  return `${base}/bookings/${ref}`;
}

function toMapHref(loc) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    loc
  )}`;
}

function toCalStamp(date) {
  return date.toISOString().replace(/-|:|\.\d\d\d/g, "");
}

function openQrInNewTab(url) {
  const w = window.open("");
  if (w)
    w.document.write(
      `<img src="${url}" style="width:100%; height:100%; object-fit:contain;">`
    );
}

function shareBooking(b, exp, date) {
  if (typeof navigator !== "undefined" && navigator.share) {
    navigator
      .share({
        title: exp?.name,
        text: `Booking for ${exp?.name} on ${date ? format(date, "PPP") : ""}`,
        url: window.location.href,
      })
      .catch(() => {});
  } else {
    navigator.clipboard.writeText(window.location.href);
    alert("Link copied to clipboard");
  }
}

function printTicket({ qrDataUrl, codeText, startsAt }) {
  const win = window.open("", "", "width=600,height=600");
  if (!win) return;
  win.document.write(`
    <html>
      <body style="font-family: sans-serif; text-align: center; padding: 40px;">
        <h2>Ticket: ${codeText}</h2>
        <p>${startsAt ? format(startsAt, "PPPP p") : ""}</p>
        <img src="${qrDataUrl}" width="300" />
        <script>window.print(); window.close();</script>
      </body>
    </html>
  `);
  win.document.close();
}

function useQrDataUrl(text) {
  const [state, setState] = useState({
    dataUrl: "",

    loading: !!text,
    error: null,
  });

  useEffect(() => {
    if (!text) return;

    setState((s) => ({ ...s, loading: true }));

    QRCode.toDataURL(text, {
      width: 400,
      margin: 2,
      color: { dark: "#3d2f26", light: "#ffffff" },
    })
      .then((url) => setState({ dataUrl: url, loading: false, error: null }))
      .catch((err) => setState({ dataUrl: "", loading: false, error: err }));
  }, [text]);

  return state;
}
