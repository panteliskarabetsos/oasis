import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req, { params }) {
  const auth = await requireAdmin("pos");
  if (!auth.ok) return auth.response;
  const { paymentIntentId } = await req.json();
  const intent = await stripe.paymentIntents.capture(paymentIntentId);

  // Update your database immediately
  const admin = createSupabaseAdmin();
  await admin
    .from("booking")
    .update({
      status: "confirmed",
      totalPaidAmount: intent.amount_received / 100,
      stripePaymentIntentId: intent.id,
    })
    .eq("id", params.id);

  return NextResponse.json({ success: true });
}
