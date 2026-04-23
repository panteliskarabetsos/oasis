import { NextResponse } from "next/server";
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req, { params }) {
  // 1. AWAIT THE PARAMS FIRST
  const { id } = await params;
  const { amount } = await req.json();

  const intent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: "eur",
    payment_method_types: ["card_present"],
    capture_method: "manual", // Terminal payments must be manually captured
    metadata: { bookingId: id }, // <-- Use the awaited id
  });

  return NextResponse.json({
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
  });
}
