// src/app/api/receipts/send/route.js
import { NextResponse } from "next/server";
import generateReceiptEmailHtml from "@/lib/email/ReceiptEmail";
import buildReceiptPdfBuffer from "@/lib/pdf/buildReceipt";

export async function POST(req) {
  try {
    const body = await req.json();

    // Defensive check: extract receipt and email
    const receipt = body?.receipt;
    const email = body?.email;

    if (!receipt) {
      console.error("Payload received:", body);
      return NextResponse.json(
        { error: "Receipt data is missing in request body" },
        { status: 400 },
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "Recipient email is missing" },
        { status: 400 },
      );
    }

    const receiptNumber = String(receipt.id || "0").padStart(6, "0");

    // 1. Generate HTML (Passes the receipt object here)
    const htmlString = generateReceiptEmailHtml(receipt);

    // 2. Generate PDF
    const pdfBuffer = await buildReceiptPdfBuffer({
      receipt,
      store: {
        name: "Olive & Oak",
        address: "123 Artisan Lane\nChania, Crete 73100",
        taxId: "EL123456789",
      },
    });

    // ... rest of your Resend fetch code
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Email API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
