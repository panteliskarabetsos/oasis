// src/app/api/bookings/[id]/invoice/route.js
import { NextResponse } from "next/server";
import buildTicketPdfBuffer from "@/lib/pdf/buildTicket"; // ⬅️ use your real PDF builder
import { getBookingById } from "@/lib/bookings/getBookingById";

export const runtime = "nodejs";

export async function GET(_req, ctx) {
  // In new Next.js you must await params
  const { id } = await ctx.params;

  if (!id) {
    return NextResponse.json({ error: "Missing booking id" }, { status: 400 });
  }

  const bookingId = Number(id);
  if (!Number.isFinite(bookingId)) {
    return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
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

  const bookingRef = `BK-${String(booking.id || bookingId).padStart(6, "0")}`;

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
