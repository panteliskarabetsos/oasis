// Re-send the Stripe receipt for a payment.
// Stripe has no explicit "resend" API — re-setting receipt_email on the
// succeeded charge triggers delivery. (Stripe does not send receipt emails
// for test-mode charges, so this is a no-op there.)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { requireAdmin } from "@/lib/auth/requireAdmin";

const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function POST(req, ctx) {
  const auth = await requireAdmin("payments");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id?.startsWith("pi_")) return bad("Invalid payment intent id");

  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SK;
  if (!key) return bad("Stripe not configured", 500);
  const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

  let overrideEmail = null;
  try {
    const body = await req.json();
    overrideEmail = body?.email || null;
  } catch {
    /* no body is fine */
  }

  try {
    const pi = await stripe.paymentIntents.retrieve(id, {
      expand: ["latest_charge"],
    });
    const charge =
      typeof pi.latest_charge === "object" ? pi.latest_charge : null;
    if (!charge) return bad("No charge to send a receipt for", 409);

    const to = overrideEmail || charge.receipt_email || pi.receipt_email;
    if (!to) return bad("No email address on this payment", 409);

    const updated = await stripe.charges.update(charge.id, {
      receipt_email: to,
    });

    return NextResponse.json({
      success: true,
      sentTo: to,
      receiptUrl: updated.receipt_url || charge.receipt_url || null,
    });
  } catch (e) {
    return bad(e?.message || "Could not resend the receipt", 502);
  }
}
