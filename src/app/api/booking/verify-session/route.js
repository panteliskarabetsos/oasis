export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { bookingRef as refFor } from "@/lib/bookingCode";
import Stripe from "stripe";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { confirmPaidBooking } from "@/lib/email/bookingConfirmation";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing session_id" },
        { status: 400 },
      );
    }

    // 1. Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    const bookingId = session.metadata?.bookingId;

    if (!bookingId) {
      return NextResponse.json(
        { error: "No booking associated with this session" },
        { status: 404 },
      );
    }

    // 2. Fetch the actual booking data from your database
    const admin = createSupabaseAdmin();
    const { data: booking, error: dbError } = await admin
      .from("booking") // Lowercase to match your schema
      .select(
        `
        id, 
        code,
        startTime, 
        customExperienceName,
        totalPaidAmount,
        currency,
        primary_contact,
        Experience(name, location)
      `,
      )
      .eq("id", bookingId)
      .single();

    if (dbError || !booking) {
      console.error("Database lookup failed:", dbError);
      return NextResponse.json(
        { error: "Booking record not found" },
        { status: 404 },
      );
    }

    // 3. The guest is back from Stripe having paid, so confirm the booking and
    //    send their confirmation here rather than waiting on the webhook — a
    //    webhook that is slow, retried or misconfigured should not decide
    //    whether someone gets their confirmation. confirmPaidBooking claims the
    //    booking first, so the two paths cannot both send.
    let confirmation = { sent: false, reason: "not-paid" };
    if (session.payment_status === "paid") {
      const piId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);

      confirmation = await confirmPaidBooking(admin, booking.id, {
        stripe,
        sessionId: session.id,
        piId,
        amountPaid:
          typeof session.amount_total === "number"
            ? session.amount_total / 100
            : null,
      });
    }

    // 4. The booking's own code, falling back to the legacy id form.
    const derivedCode = refFor(booking);

    // 5. Return clean data for the UI
    return NextResponse.json({
      customerName:
        booking.primary_contact?.firstName ||
        session.customer_details?.name ||
        "Guest",
      experienceName:
        booking.customExperienceName ||
        booking.Experience?.name ||
        "Oasis Experience",
      date: booking.startTime,
      bookingCode: derivedCode, // Send the derived code instead
      amount: session.amount_total / 100,
      currency: (session.currency || booking.currency || "EUR").toUpperCase(),
      status: session.payment_status,
      confirmationEmail: confirmation.reason,
    });
  } catch (error) {
    console.error("Verify Session Error:", error);
    return NextResponse.json(
      { error: "Internal server error verifying session" },
      { status: 500 },
    );
  }
}
