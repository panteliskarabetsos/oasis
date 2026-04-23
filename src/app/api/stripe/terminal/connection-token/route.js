import { NextResponse } from "next/server";
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST() {
  const token = await stripe.terminal.connectionTokens.create();
  return NextResponse.json({ secret: token.secret });
}
