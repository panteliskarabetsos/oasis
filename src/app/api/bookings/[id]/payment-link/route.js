import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function bad(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function moneyToCents(amount) {
  return Math.max(0, Math.round(Number(amount || 0) * 100));
}

function centsToMoney(cents) {
  return Math.max(0, Math.round(Number(cents || 0))) / 100;
}

function getBookingGrossTotal(booking) {
  const explicitTotal = Number(
    booking.totalAmount ??
      booking.total_amount ??
      booking.expectedTotal ??
      booking.expected_total ??
      0,
  );

  if (explicitTotal > 0) return explicitTotal;

  const paidField = Number(booking.totalPaidAmount || 0);

  // If this field was historically used as total booking price, keep it usable.
  if (paidField > 0) return paidField;

  const adults = Number(booking.adultsCount || 0);
  const kids = Number(booking.kidsCount || 0);
  const people = Number(booking.numberOfPeople || 0);

  const adultPrice = Number(booking.unitPriceAdult || 0);
  const kidPrice = Number(booking.unitPriceKid || 0);

  let calculated = 0;

  if (adults > 0 || kids > 0) {
    calculated = adults * adultPrice + kids * kidPrice;
  } else if (people > 0 && adultPrice > 0) {
    calculated = people * adultPrice;
  }

  const discount = Number(booking.discountAmount || 0);

  return Math.max(0, calculated - discount);
}

export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    if (!id) return bad("Missing booking id", 400);

    const { data: booking, error } = await supabase
      .from("booking")
      .select(
        `
        id,
        status,
        numberOfPeople,
        adultsCount,
        kidsCount,
        unitPriceAdult,
        unitPriceKid,
        totalPaidAmount,
        discountAmount,
        currency,
        primary_contact,
        stripeSessionId,
        stripeSessionUrl,
        stripePaymentIntentId,
        experienceId,
        customExperienceName,
        updatedAt,
        Experience (
          name
        )
      `,
      )
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!booking) return bad("Booking not found", 404);

    const status = String(booking.status || "").toLowerCase();

    if (status === "cancelled" || status === "canceled") {
      return bad("Cancelled bookings cannot be paid.", 400);
    }

    const currency = String(booking.currency || "EUR").toLowerCase();

    const { data: payments, error: paymentsErr } = await supabase
      .from("payment")
      .select("amount, method, currency, stripe_payment_intent_id")
      .eq("booking_id", booking.id);

    if (paymentsErr) throw paymentsErr;

    const { data: refunds, error: refundsErr } = await supabase
      .from("payment_refund")
      .select("amount_cents, currency")
      .eq("booking_id", booking.id);

    if (refundsErr) throw refundsErr;

    const bookingTotal = getBookingGrossTotal(booking);

    const paidAmount = (payments || []).reduce((sum, p) => {
      if (String(p.currency || currency).toLowerCase() !== currency) return sum;
      return sum + Number(p.amount || 0);
    }, 0);

    const refundedAmount = (refunds || []).reduce((sum, r) => {
      if (String(r.currency || currency).toLowerCase() !== currency) return sum;
      return sum + centsToMoney(r.amount_cents || 0);
    }, 0);

    const amountDue = Math.max(0, bookingTotal - paidAmount + refundedAmount);
    const amountCents = moneyToCents(amountDue);

    if (amountCents <= 0) {
      return bad("This booking is already fully paid.", 400);
    }

    const contact = booking.primary_contact || {};
    const customerEmail =
      contact.email || contact.customerEmail || body.email || undefined;

    const experienceName =
      booking.Experience?.name ||
      booking.customExperienceName ||
      `Booking #${booking.id}`;

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: customerEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amountCents,
            product_data: {
              name: experienceName,
              description: `Remaining balance for booking #${booking.id}`,
            },
          },
        },
      ],
      metadata: {
        bookingId: String(booking.id),
        bookingTotal: String(bookingTotal),
        paidAmount: String(paidAmount),
        refundedAmount: String(refundedAmount),
        amountDue: String(amountDue),
        source: "manage_booking_payment_link",
      },
      payment_intent_data: {
        metadata: {
          bookingId: String(booking.id),
          source: "manage_booking_payment_link",
        },
      },
      success_url: `${baseUrl}/manage-booking?paid=1&booking=${booking.id}`,
      cancel_url: `${baseUrl}/manage-booking?cancelled=1&booking=${booking.id}`,
    });

    await supabase
      .from("booking")
      .update({
        stripeSessionId: session.id,
        stripeSessionUrl: session.url,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", booking.id);

    return NextResponse.json({
      success: true,
      url: session.url,
      checkoutUrl: session.url,
      sessionId: session.id,
      bookingId: booking.id,
      bookingTotal,
      paidAmount,
      refundedAmount,
      amountDue,
      amountCents,
      currency: currency.toUpperCase(),
    });
  } catch (error) {
    console.error("Booking payment-link error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create payment link" },
      { status: 500 },
    );
  }
}
