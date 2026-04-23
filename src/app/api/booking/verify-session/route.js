export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

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
        startTime, 
        customExperienceName,
        totalPaidAmount,
        currency,
        primary_contact,
        Experience(name, location)
      `,
      ) // Removed 'code' from here because it doesn't exist in DB
      .eq("id", bookingId)
      .single();

    if (dbError || !booking) {
      console.error("Database lookup failed:", dbError);
      return NextResponse.json(
        { error: "Booking record not found" },
        { status: 404 },
      );
    }

    // 3. Generate the booking code on the fly (BK-000XXX)
    const derivedCode = `BK-${String(booking.id).padStart(6, "0")}`;

    // 4. Return clean data for the UI
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
    });
  } catch (error) {
    console.error("Verify Session Error:", error);
    return NextResponse.json(
      { error: "Internal server error verifying session" },
      { status: 500 },
    );
  }
}
