// src/app/api/bookings/lookup/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../../lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

function money(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function calculateBookingTotal(booking) {
  const adults = Number(booking.adultsCount || booking.counts?.adults || 0);
  const kids = Number(booking.kidsCount || booking.counts?.kids || 0);

  const adultPrice = Number(booking.unitPriceAdult || 0);
  const kidPrice = Number(booking.unitPriceKid || 0);
  const discount = Number(booking.discountAmount || 0);

  let total = 0;

  if (adults > 0 || kids > 0) {
    total = adults * adultPrice + kids * kidPrice;
  } else if (booking.numberOfPeople && adultPrice > 0) {
    total = Number(booking.numberOfPeople || 1) * adultPrice;
  } else if (booking.totalPaidAmount) {
    total = Number(booking.totalPaidAmount || 0);
  }

  return money(Math.max(0, total - discount));
}

export async function GET(req) {
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  try {
    const { searchParams } = new URL(req.url);
    const ref = searchParams.get("ref") || "";
    const lastName = searchParams.get("lastName") || "";

    if (!ref.trim() || !lastName.trim()) {
      return bad("Both booking reference and last name are required.", 400);
    }

    const numericId = parseInt(ref.replace(/\D/g, ""), 10);

    if (isNaN(numericId)) {
      return bad(
        "Booking not found. Please check your details and try again.",
        404,
      );
    }

    const { data: booking, error } = await admin
      .from("booking")
      .select(
        `
        id,
        experienceId,
        customExperienceName,
        status,
        numberOfPeople,
        adultsCount,
        kidsCount,
        counts,
        unitPriceAdult,
        unitPriceKid,
        totalPaidAmount,
        discountAmount,
        currency,
        startTime,
        primary_contact,
        selected_meetup_point,
        attendees,
        promoJson,
        stripePaymentIntentId,
        stripeSessionId,
        stripeSessionUrl,
        Experience ( name, location, cancellationPolicy ),
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

    if (!booking) {
      return bad(
        "Booking not found. Please check your details and try again.",
        404,
      );
    }

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

    const [
      { data: requests, error: requestsError },
      { data: payments, error: paymentsError },
      { data: refunds, error: refundsError },
    ] = await Promise.all([
      admin
        .from("booking_request")
        .select("type, status")
        .eq("booking_id", numericId),

      admin
        .from("payment")
        .select("amount, currency")
        .eq("booking_id", numericId),

      admin
        .from("payment_refund")
        .select("amount_cents, currency")
        .eq("booking_id", numericId),
    ]);

    if (requestsError)
      console.error("[lookup] requests fetch error:", requestsError);
    if (paymentsError)
      console.error("[lookup] payments fetch error:", paymentsError);
    if (refundsError)
      console.error("[lookup] refunds fetch error:", refundsError);

    const hasRescheduled = (requests || []).some(
      (req) => req.type === "reschedule",
    );

    const updateRequested = (requests || []).some(
      (req) => req.status === "pending",
    );

    const currency = String(booking.currency || "EUR").toUpperCase();
    const bookingTotal = calculateBookingTotal(booking);

    let paidAmount = money(
      (payments || []).reduce((sum, p) => {
        if (String(p.currency || currency).toUpperCase() !== currency) {
          return sum;
        }

        return sum + Number(p.amount || 0);
      }, 0),
    );

    if (paidAmount <= 0 && booking.stripePaymentIntentId && bookingTotal > 0) {
      paidAmount = bookingTotal;
    }

    if (
      paidAmount <= 0 &&
      String(booking.status || "").toLowerCase() === "confirmed" &&
      Number(booking.totalPaidAmount || 0) >= bookingTotal &&
      bookingTotal > 0
    ) {
      paidAmount = bookingTotal;
    }

    const refundedAmount = money(
      (refunds || []).reduce((sum, r) => {
        if (String(r.currency || currency).toUpperCase() !== currency) {
          return sum;
        }

        return sum + Number(r.amount_cents || 0) / 100;
      }, 0),
    );

    const amountDue = money(
      Math.max(0, bookingTotal - paidAmount + refundedAmount),
    );

    const paymentStatus =
      amountDue <= 0 && bookingTotal > 0
        ? "paid"
        : paidAmount > 0
          ? "partially_paid"
          : "unpaid";

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

    const isPrivate =
      booking.promoJson?.private === true ||
      booking.promoJson?.isPrivate === true ||
      booking.promoJson?.bookingType === "private" ||
      Boolean(booking.customExperienceName);

    return ok({
      id: booking.id,
      experienceId: booking.experienceId,
      reference: `BK-${String(booking.id).padStart(6, "0")}`,

      guestName: dbGuestName,
      email: contactEmail,

      experienceName:
        booking.customExperienceName ||
        booking.Experience?.name ||
        "Unknown Experience",

      customExperienceName: booking.customExperienceName || null,
      isPrivate,
      bookingType: isPrivate ? "private" : "public",

      date: formattedDate,
      time: formattedTime,

      guests: booking.numberOfPeople || 1,
      adultsCount: booking.adultsCount || 0,
      kidsCount: booking.kidsCount || 0,

      status: booking.status || "confirmed",

      currency,
      totalAmount: bookingTotal,
      bookingTotal,
      paidAmount,
      refundedAmount,
      amountDue,
      paymentStatus,

      stripePaymentIntentId: booking.stripePaymentIntentId || null,
      stripeSessionId: booking.stripeSessionId || null,
      stripeSessionUrl: booking.stripeSessionUrl || null,

      location: booking.Experience?.location || "Main Location",
      meetupPoint: booking.selected_meetup_point || null,
      cancellationPolicy: booking.Experience?.cancellationPolicy || "moderate",
      attendees: booking.attendees || [],

      updateRequested,
      hasRescheduled,
    });
  } catch (err) {
    console.error("[lookup] unhandled error:", err);
    return bad(
      "An internal server error occurred while looking up your booking.",
      500,
    );
  }
}
