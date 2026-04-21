// src/app/api/bookings/lookup/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../../lib/supabase/admin";

// Response helpers
const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function GET(req) {
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  try {
    // 1. Extract query parameters
    const { searchParams } = new URL(req.url);
    const ref = searchParams.get("ref") || "";
    const lastName = searchParams.get("lastName") || "";

    // 2. Validate input
    if (!ref.trim() || !lastName.trim()) {
      return bad("Both booking reference and last name are required.", 400);
    }

    // 3. Parse the Booking ID from the Reference String
    // Assuming format like "BK-000343" -> extracts "343"
    const numericId = parseInt(ref.replace(/\D/g, ""), 10);
    if (isNaN(numericId)) {
      return bad(
        "Booking not found. Please check your details and try again.",
        404,
      );
    }

    // 4. Look up the booking in the database
    const { data: booking, error } = await admin
      .from("booking")
      .select(
        `
        id,
        experienceId,
        status,
        numberOfPeople,
        adultsCount,
        kidsCount,
        totalPaidAmount,
        startTime,
        primary_contact,
        selected_meetup_point,
        attendees,
        Experience ( name, location ),
        User ( name, surname, email ),
        ScheduleSlot ( date )
      `,
      )
      .eq("id", numericId)
      .maybeSingle();

    if (error) {
      console.error("[lookup] select error:", error);
      return bad("An error occurred while looking up your booking.", 500);
    }

    // 5. Return 404 if booking doesn't exist
    if (!booking) {
      return bad(
        "Booking not found. Please check your details and try again.",
        404,
      );
    }

    // 6. Extract and Verify the Last Name
    const contactLastName =
      booking.primary_contact?.lastName || booking.User?.surname || "";
    const contactFirstName =
      booking.primary_contact?.firstName || booking.User?.name || "";
    const contactEmail =
      booking.primary_contact?.email ||
      booking.User?.email ||
      "No email provided";

    const dbGuestName = `${contactFirstName} ${contactLastName}`.trim();
    const nameMatches = contactLastName
      .toLowerCase()
      .includes(lastName.trim().toLowerCase());

    if (!nameMatches) {
      return bad(
        "Booking not found. Please check your details and try again.",
        404,
      );
    }

    // 7. Check for existing modification requests
    const { data: requests, error: requestsError } = await admin
      .from("booking_request")
      .select("type, status")
      .eq("booking_id", numericId);

    if (requestsError) {
      console.error("[lookup] requests fetch error:", requestsError);
      // We log the error but don't fail the whole lookup just because the request check failed
    }

    let hasRescheduled = false;
    let updateRequested = false;

    if (requests && requests.length > 0) {
      // True if the user has EVER submitted a reschedule request (enforces 1-time rule)
      hasRescheduled = requests.some((req) => req.type === "reschedule");

      // True if there is currently an unresolved request pending admin action
      updateRequested = requests.some((req) => req.status === "pending");
    }

    // 8. Resolve Date and Time
    const bookingDateObj = booking.startTime
      ? new Date(booking.startTime)
      : booking.ScheduleSlot?.date
        ? new Date(booking.ScheduleSlot.date)
        : null;

    const formattedDate = bookingDateObj
      ? bookingDateObj.toISOString().split("T")[0]
      : null;
    const formattedTime = bookingDateObj
      ? bookingDateObj.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
        })
      : "TBD";

    // 9. Format the response to match the frontend expectations
    const payload = {
      id: booking.id,
      experienceId: booking.experienceId,
      reference: `BK-${String(booking.id).padStart(6, "0")}`,
      guestName: dbGuestName,
      email: contactEmail,
      experienceName: booking.Experience?.name || "Unknown Experience",
      date: formattedDate,
      time: formattedTime,
      guests: booking.numberOfPeople || 1,
      adultsCount: booking.adultsCount || 0,
      kidsCount: booking.kidsCount || 0,
      status: booking.status || "confirmed",
      totalAmount: booking.totalPaidAmount
        ? Number(booking.totalPaidAmount)
        : 0.0,
      location: booking.Experience?.location || "Main Location",
      meetupPoint: booking.selected_meetup_point || null,
      attendees: booking.attendees || [],
      updateRequested,
      hasRescheduled,
    };

    // 10. Return success
    return ok(payload);
  } catch (err) {
    console.error("[lookup] unhandled error:", err);
    return bad(
      "An internal server error occurred while looking up your booking.",
      500,
    );
  }
}
