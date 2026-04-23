// src/app/api/admin/reservations/[id]/generate-payment-link/route.js
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req, { params }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.response;
    const admin = auth.admin;

    const { id } = await params;

    const { data: booking, error: fetchErr } = await admin
      .from("booking")
      .select("*, Experience(name)")
      .eq("id", id)
      .single();

    if (fetchErr || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const adults = Number(booking.adultsCount ?? 1);
    const kids = Number(booking.kidsCount ?? 0);
    const priceA = Number(booking.unitPriceAdult ?? 0);
    const priceK = Number(booking.unitPriceKid ?? 0);
    const discount = Number(booking.discountAmount ?? 0);
    const alreadyPaid = Number(booking.totalPaidAmount ?? 0);

    const totalCost = adults * priceA + kids * priceK - discount;
    const balanceDue = Math.max(0, totalCost - alreadyPaid);

    if (balanceDue <= 0) {
      return NextResponse.json(
        { error: "This booking is already fully paid." },
        { status: 400 },
      );
    }

    // 4. Create the Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: (booking.currency || "eur").toLowerCase(),
            product_data: {
              name:
                booking.customExperienceName ||
                booking.Experience?.name ||
                "Oasis Experience",
              description: `Booking Reference: ${booking.code || id}`,
            },
            unit_amount: Math.round(balanceDue * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/bookings/${id}/payment-setup`,
      metadata: {
        bookingId: String(id),
        admin_generated: "true",
      },
      customer_email: booking.primary_contact?.email || undefined,
    });

    // 5. UPDATE: Save Session ID, Session URL, AND Payment Intent ID
    const { error: updateErr } = await admin
      .from("booking")
      .update({
        stripeSessionId: session.id,
        stripeSessionUrl: session.url,
        // session.payment_intent contains the "pi_..." ID
        stripePaymentIntentId: session.payment_intent,
      })
      .eq("id", id);

    if (updateErr) {
      console.error("Database update error:", updateErr);
    }

    return NextResponse.json({
      url: session.url,
      paymentIntentId: session.payment_intent,
      bookingCode: booking.code,
      guestName: booking.primary_contact?.firstName || "Guest",
    });
  } catch (error) {
    console.error("Payment Link Error:", error);
    return NextResponse.json(
      { error: "Internal server error while generating link" },
      { status: 500 },
    );
  }
}
