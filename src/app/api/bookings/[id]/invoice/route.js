// src/app/api/bookings/[id]/invoice/route.js
import { NextResponse } from "next/server";
import { bookingRef as refFor } from "@/lib/bookingCode";
import buildTicketPdfBuffer from "@/lib/pdf/buildTicket"; // ⬅️ use your real PDF builder
import { getBookingById } from "@/lib/bookings/getBookingById";
import {
  ACCESS_DENIED,
  authorizeBookingAccess,
} from "@/lib/bookings/bookingAccess";

export const runtime = "nodejs";

export async function GET(req, ctx) {
  // In new Next.js you must await params
  const { id } = await ctx.params;

  if (!id) {
    return NextResponse.json({ error: "Missing booking id" }, { status: 400 });
  }

  const bookingId = Number(id);
  if (!Number.isFinite(bookingId)) {
    return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
  }

  // This PDF is the guest's ticket: its QR is the reference the check-in
  // scanner reads. Anyone counting ids could download a working one.
  const access = await authorizeBookingAccess(req, bookingId);
  if (!access.ok) {
    console.warn(`[invoice] denied ticket for booking ${bookingId}`);
    return NextResponse.json({ error: ACCESS_DENIED }, { status: 401 });
  }

  let booking;
  try {
    booking = await getBookingById(bookingId);
  } catch (err) {
    console.error("Error loading booking for invoice:", err);
    return NextResponse.json(
      { error: "Failed to load booking" },
      { status: 500 }
    );
  }

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // A ticket is only for a booking that has been paid for.
  //
  // Hiding the download button is not enough on its own: the guest owns this
  // booking, so their session opens this route perfectly well by URL. The QR
  // inside the PDF is the reference the check-in scanner admits people on, so
  // it must not exist before the money does.
  const paidStatus = String(booking.status || "").toLowerCase();
  if (!["confirmed", "paid", "checked_in"].includes(paidStatus)) {
    return NextResponse.json(
      {
        error:
          "This booking has no ticket yet. It is issued once payment is complete.",
        status: paidStatus || "unknown",
      },
      { status: 409 },
    );
  }

  // -------- Map booking → buildTicketPdfBuffer args --------
  const start = booking.startTime ? new Date(booking.startTime) : null;

  const dateLabel = start
    ? start.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";

  const timeLabel = start
    ? start.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const experienceName =
    booking.customExperienceName || booking.experience?.name || "Experience";

  const location = booking.experience?.location || "Chania, Crete";

  const attendees =
    Array.isArray(booking.attendees) && booking.attendees.length
      ? booking.attendees.map((a, i) => ({
          name:
            a.name ||
            `${a.firstName || ""} ${a.lastName || ""}`.trim() ||
            `Guest ${i + 1}`,
        }))
      : [];

  const amountLabel =
    typeof booking.totalPaidAmount === "number"
      ? booking.totalPaidAmount.toFixed(2)
      : "0.00";

  const currency = (booking.currency || "EUR").toUpperCase();

  const bookingRef = refFor(booking.code ? booking : { id: booking.id || bookingId });

  // You can customize these or pull from env
  const supportEmail = "info@example.com";
  const supportPhone = undefined; // or "+30 210 0000000"

  let pdfBuffer;
  try {
    pdfBuffer = await buildTicketPdfBuffer({
      brandName: "Oasis",
      experienceName,
      location,
      dateLabel,
      timeLabel,
      attendees,
      amountLabel,
      currency,
      bookingRef,
      qrValue: bookingRef,
      receiptUrl: undefined, // or a URL to their booking page if you want
      supportEmail,
      supportPhone,
    });
  } catch (err) {
    console.error("Error building ticket PDF:", err);
    return NextResponse.json({ error: "Failed to build PDF" }, { status: 500 });
  }

  const body = pdfBuffer instanceof Buffer ? pdfBuffer : Buffer.from(pdfBuffer);

  const fileName = `ticket-${bookingRef}.pdf`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
    },
  });
}
