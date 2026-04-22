import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const { amount, currency, reference } = body;

    const REVOLUT_API_KEY = process.env.REVOLUT_SECRET_KEY;
    const TERMINAL_ID = process.env.REVOLUT_TERMINAL_ID;

    // 1. Check if environment variables are actually loaded
    if (!REVOLUT_API_KEY || !TERMINAL_ID) {
      console.error("❌ ERROR: Missing Revolut API Key or Terminal ID in .env");
      return NextResponse.json(
        { error: "Server configuration missing Revolut credentials." },
        { status: 400 },
      );
    }

    const payload = {
      amount: Math.round(amount * 100), // Revolut expects integer cents
      currency: (currency || "EUR").toUpperCase(),
      // Note: Some Revolut APIs use 'merchant_order_ext_ref' instead of 'reference' depending on the exact endpoint
      reference: reference || `POS-${Date.now()}`,
      terminal_id: TERMINAL_ID,
    };

    console.log("➡️ Sending Payload to Revolut:", payload);

    // 2. Note: If you are using a sandbox/test account, the URL is usually sandbox-merchant.revolut.com
    // Production is usually merchant.revolut.com
    const response = await fetch(
      "https://merchant.revolut.com/api/1.0/orders",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REVOLUT_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const data = await response.json();

    console.log("⬅️ Revolut Response Status:", response.status);
    console.log("⬅️ Revolut Response Data:", data);

    if (!response.ok) {
      // Pass Revolut's exact error message to the frontend
      throw new Error(data.message || data.description || JSON.stringify(data));
    }

    return NextResponse.json({ intentId: data.id });
  } catch (error) {
    console.error("❌ Revolut Push Error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
