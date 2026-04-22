import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const intentId = searchParams.get("intentId");

    const REVOLUT_API_KEY = process.env.REVOLUT_SECRET_KEY;

    // Check the status of the intent
    const response = await fetch(
      `https://b2b.revolut.com/api/1.0/payment-intents/${intentId}`,
      {
        headers: { Authorization: `Bearer ${REVOLUT_API_KEY}` },
      },
    );

    const data = await response.json();

    // Statuses can be: pending, processing, completed, cancelled, failed
    return NextResponse.json({
      status: data.state,
      paymentId: data.payment_id,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
