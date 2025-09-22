// app/booking-confirmed/[id]/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  CheckCircle2,
  CalendarDays,
  MapPin,
  Users,
  StickyNote,
  Home,
  ArrowLeft,
  Download,
  Printer,
  ExternalLink,
} from "lucide-react";

export default function BookingConfirmedPage() {
  const { id } = useParams();
  const router = useRouter();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    if (!id) return;
    let alive = true;

    (async () => {
      try {
        const res = await fetch("/api/my-bookings", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load bookings");
        const list = await res.json();
        const found = Array.isArray(list)
          ? list.find((b) => String(b.id) === String(id))
          : null;

        if (alive) {
          setBooking(found || null);
          if (!found) setErrMsg("Booking not found.");
        }
      } catch (e) {
        console.error(e);
        if (alive) setErrMsg("Unable to load your booking right now.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  const dateISO = booking?.scheduleSlot?.date || null;
  const experience = booking?.scheduleSlot?.experience || null;
  const firstImage = useMemo(() => {
    const img = Array.isArray(experience?.images) ? experience.images[0] : null;
    return typeof img === "string" ? img : null;
  }, [experience]);

  const googleMapsHref = experience?.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        experience.location
      )}`
    : null;

  function printConfirmation() {
    window.print();
  }

  function downloadICS() {
    if (!dateISO || !experience?.name) return;
    // Basic UTC ICS (works in major calendars)
    const d = parseISO(dateISO);
    const dt = (x) =>
      `${x.getUTCFullYear()}${String(x.getUTCMonth() + 1).padStart(
        2,
        "0"
      )}${String(x.getUTCDate()).padStart(2, "0")}T${String(
        x.getUTCHours()
      ).padStart(2, "0")}${String(x.getUTCMinutes()).padStart(2, "0")}${String(
        x.getUTCSeconds()
      ).padStart(2, "0")}Z`;

    const start = d;
    // Default 2-hour duration; adjust if you store duration elsewhere
    const end = new Date(d.getTime() + 2 * 60 * 60 * 1000);

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Oasis//Booking//EN",
      "BEGIN:VEVENT",
      `UID:oasis-${booking.id}@oasis`,
      `DTSTAMP:${dt(new Date())}`,
      `DTSTART:${dt(start)}`,
      `DTEND:${dt(end)}`,
      `SUMMARY:${escapeICS(experience.name)}`,
      `LOCATION:${escapeICS(experience.location || "")}`,
      `DESCRIPTION:${escapeICS(
        `Booking #${booking.id}${
          booking.notes ? `\\nNotes: ${booking.notes}` : ""
        }`
      )}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([lines], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `oasis-booking-${booking.id}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function escapeICS(str) {
    return String(str)
      .replace(/\\/g, "\\\\")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;")
      .replace(/\n/g, "\\n");
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f4f1ec]">
        <div className="rounded-2xl border border-[#e8e4db] bg-white/80 px-6 py-4 shadow">
          <div className="flex items-center gap-3 text-[#5a4a3f]">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#8b6f47] border-t-transparent" />
            Loading your booking…
          </div>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f4f1ec] px-6">
        <div className="w-full max-w-md rounded-3xl border border-[#ecdccf] bg-[#fffaf4] p-8 text-center shadow-xl">
          <p className="text-[#b14545] font-semibold mb-2">Oops!</p>
          <p className="text-[#5a4a3f]">{errMsg || "Booking not found."}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-full border border-[#d8cfc3] bg-white px-4 py-2 text-[#5a4a3f] hover:bg-[#faf7f1]"
            >
              <ArrowLeft size={16} /> Go Back
            </button>
            <button
              onClick={() => router.push("/")}
              className="rounded-full bg-[#8b6f47] px-4 py-2 text-white hover:bg-[#7a5f3a]"
            >
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { user, numberOfPeople, notes } = booking;

  return (
    <div className="min-h-screen bg-[#f4f1ec] flex items-center justify-center px-6 py-16 print:bg-white">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-[#e8e4db] bg-white shadow-2xl print:shadow-none print:border-0">
        {/* Decorative banner / hero */}
        <div className="relative">
          <div className="h-40 w-full bg-gradient-to-r from-[#8b6f47] via-[#c2b59b] to-[#8b6f47] opacity-90" />
          {firstImage ? (
            <img
              src={firstImage}
              alt={experience?.name || "Experience image"}
              className="absolute inset-0 h-40 w-full object-cover mix-blend-overlay"
            />
          ) : null}

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-3 rounded-full bg-white/90 px-4 py-2 shadow">
              <CheckCircle2 className="h-5 w-5 text-[#3fa34d]" />
              <span className="text-sm font-medium text-[#2f2f2f]">
                Booking Confirmed
              </span>
            </div>
          </div>
        </div>

        {/* Top bar with actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ece6dc] bg-[#faf7f1] px-6 py-3 print:hidden">
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 rounded-full border border-[#d8cfc3] bg-white px-3 py-1.5 text-sm text-[#5a4a3f] hover:bg-[#faf7f1]"
          >
            <ArrowLeft size={16} />
            Home
          </button>
          <div className="flex items-center gap-2 text-xs text-[#7a6a58]">
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 border border-[#e0dcd4]">
              Ref&nbsp;#{booking.id}
            </span>
          </div>
        </div>

        {/* Main content */}
        <div className="px-6 pb-8 pt-6">
          {/* Title + intro */}
          <div className="text-center">
            <h1 className="font-serif text-3xl font-bold text-[#5a4a3f]">
              {experience?.name || "Your Experience"}
            </h1>
            <p className="mt-1 text-[#6b5e53]">
              Thank you <strong>{user?.name || user?.email || "Guest"}</strong>{" "}
              — we’re excited to welcome you.
            </p>
          </div>

          {/* Receipt card */}
          <div className="mt-6 rounded-2xl border border-[#e3dfd4] bg-[#fffaf4] p-6 shadow-sm">
            <div className="grid gap-6 sm:grid-cols-2">
              <Item
                icon={CalendarDays}
                label="Date & Time"
                value={
                  dateISO ? (
                    <>
                      <div>{format(parseISO(dateISO), "PPPP")}</div>
                      <div className="text-xs text-[#7a6a58]">
                        {format(parseISO(dateISO), "p")}
                      </div>
                    </>
                  ) : (
                    "—"
                  )
                }
              />
              <Item
                icon={Users}
                label="Number of People"
                value={numberOfPeople}
              />
              <Item
                icon={MapPin}
                label="Location"
                value={experience?.location || "—"}
              />
              <Item
                icon={Home}
                label="Experience"
                value={experience?.name || "—"}
              />
              {notes ? (
                <div className="sm:col-span-2">
                  <Item icon={StickyNote} label="Notes" value={notes} />
                </div>
              ) : null}
            </div>
          </div>

          {/* Helpful actions */}
          <div className="mt-8 grid gap-3 sm:grid-cols-3 print:hidden">
            <ActionButton onClick={downloadICS} icon={Download}>
              Add to Calendar
            </ActionButton>

            {googleMapsHref ? (
              <ActionButton
                as="a"
                href={googleMapsHref}
                target="_blank"
                rel="noopener noreferrer"
                icon={ExternalLink}
              >
                Get Directions
              </ActionButton>
            ) : (
              <ActionButton
                onClick={() => alert("No location available")}
                icon={ExternalLink}
              >
                Get Directions
              </ActionButton>
            )}

            <ActionButton onClick={printConfirmation} icon={Printer}>
              Print Confirmation
            </ActionButton>

            {/* Add to Apple Wallet */}
            {/* <ActionButton
              as="a"
              href={`/api/wallet/apple?bookingId=${booking.id}`}
              icon={Download}
            >
              Add to Apple Wallet
            </ActionButton> */}

            {/* Save to Google Wallet */}
            {/* <ActionButton
              onClick={async () => {
                try {
                  const res = await fetch(
                    `/api/wallet/google?bookingId=${booking.id}`,
                    { cache: "no-store" }
                  );
                  const { saveUrl, error } = await res.json();
                  if (error || !saveUrl)
                    return alert(error || "Could not create Wallet link.");
                  window.open(saveUrl, "_blank", "noopener,noreferrer");
                } catch {
                  alert("Could not create Wallet link.");
                }
              }}
              icon={ExternalLink}
            >
              Save to Google Wallet
            </ActionButton> */}
          </div>

          {/* Secondary nav */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 print:hidden">
            <button
              onClick={() => router.push("/my-bookings")}
              className="rounded-full border border-[#d8cfc3] bg-white px-5 py-2.5 text-[#5a4a3f] hover:bg-[#faf7f1]"
            >
              View My Bookings
            </button>
            <button
              onClick={() => router.push("/")}
              className="rounded-full bg-[#8b6f47] px-5 py-2.5 text-white hover:bg-[#7a5f3a]"
            >
              Back to Home
            </button>
          </div>

          {/* Small note */}
          <p className="mt-6 text-center text-xs text-[#7a6a58]">
            A confirmation email has been sent to your inbox.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- UI bits ---------- */

function Item({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#e9e4da] bg-white p-4">
      <div className="mt-0.5 rounded-full bg-[#efeae2] p-2">
        <Icon className="h-4 w-4 text-[#8b6f47]" />
      </div>
      <div>
        <p className="text-xs font-medium text-[#7a6a5f]">{label}</p>
        <div className="mt-0.5 text-sm text-[#4a4a4a]">{value}</div>
      </div>
    </div>
  );
}

function ActionButton({
  as,
  href,
  target,
  rel,
  onClick,
  icon: Icon,
  children,
}) {
  const classes =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-[#e0dcd4] bg-white px-4 py-3 text-sm font-medium text-[#5a4a3f] shadow-sm hover:bg-[#faf7f1]";

  if (as === "a") {
    return (
      <a href={href} target={target} rel={rel} className={classes}>
        <Icon className="h-4 w-4" />
        {children}
      </a>
    );
  }
  return (
    <button onClick={onClick} className={classes}>
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
