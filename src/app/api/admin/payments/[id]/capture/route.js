// Capture a previously authorised PaymentIntent.
// The payments detail page calls this for intents in `requires_capture`.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { requireAdmin } from "@/lib/auth/requireAdmin";

const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function POST(_req, ctx) {
  const auth = await requireAdmin("payments");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id?.startsWith("pi_")) return bad("Invalid payment intent id");

  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SK;
  if (!key) return bad("Stripe not configured", 500);
  const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

  try {
    const pi = await stripe.paymentIntents.capture(id);
    return NextResponse.json({
      success: true,
      paymentIntent: {
        id: pi.id,
        status: pi.status,
        amount_received: pi.amount_received,
        currency: pi.currency,
      },
    });
  } catch (e) {
    return bad(e?.message || "Capture failed", 502);
  }
}
