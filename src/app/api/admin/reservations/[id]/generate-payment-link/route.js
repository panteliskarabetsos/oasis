// src/app/api/admin/reservations/[id]/generate-payment-link/route.js
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createBookingPaymentLink } from "@/lib/bookings/paymentLink";

/**
 * Create a Stripe Checkout link for a booking's outstanding balance.
 *
 * The link itself is built in @/lib/bookings/paymentLink so this and the
 * new-booking flow cannot disagree about what the guest owes.
 */
export async function POST(req, { params }) {
  try {
    const auth = await requireAdmin("bookings");
    if (!auth.ok) return auth.response;

    const { id } = await params;

    const link = await createBookingPaymentLink(auth.admin, id, {
      baseUrl: new URL(req.url).origin,
    });
    if (!link.ok) {
      return NextResponse.json({ error: link.error }, { status: link.status });
    }

    return NextResponse.json({
      url: link.url,
      paymentIntentId: link.paymentIntentId,
      amountDue: link.amountDue,
      bookingCode: link.booking.code,
      guestName: link.booking.primary_contact?.firstName || "Guest",
    });
  } catch (error) {
    console.error("Payment Link Error:", error);
    return NextResponse.json(
      { error: "Internal server error while generating link" },
      { status: 500 },
    );
  }
}
