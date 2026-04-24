// src/app/api/receipts/send/route.js
import { NextResponse } from "next/server";
import generateReceiptEmailHtml from "@/lib/email/ReceiptEmail";
import buildReceiptPdfBuffer from "@/lib/pdf/buildReceipt";

function bad(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isEmail(email) {
  return /.+@.+\..+/.test(String(email || "").trim());
}

export async function POST(req) {
  try {
    const body = await req.json();

    const receipt = body?.receipt;
    const email = String(body?.email || receipt?.customerEmail || "").trim();

    if (!receipt) {
      return bad("Receipt data is missing in request body", 400);
    }

    if (!email) {
      return bad("Recipient email is missing", 400);
    }

    if (!isEmail(email)) {
      return bad("Recipient email is invalid", 400);
    }

    if (!process.env.RESEND_API_KEY) {
      return bad("RESEND_API_KEY is not configured", 500);
    }

    const receiptNumber = String(receipt.id || "0").padStart(6, "0");

    const htmlString = generateReceiptEmailHtml(receipt);

    const pdfBuffer = await buildReceiptPdfBuffer({
      receipt,
      store: {
        name: "Oasis",
        address: "123 Artisan Lane\nChania, Crete 73100",
        taxId: "EL123456789",
      },
    });

    const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

    const resendPayload = {
      from:
        process.env.RECEIPTS_FROM_EMAIL || "Oasis <receipts@yourdomain.com>",
      to: [email],
      subject: `Your Oasis Receipt #${receiptNumber}`,
      html: htmlString,
      attachments: [
        {
          filename: `receipt-${receiptNumber}.pdf`,
          content: pdfBase64,
          content_type: "application/pdf",
        },
      ],
    };

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    const resendJson = await resendRes.json().catch(() => ({}));

    if (!resendRes.ok) {
      console.error("Resend receipt email error:", resendJson);
      return bad(
        resendJson?.message || resendJson?.error || "Failed to send receipt",
        500,
      );
    }

    return NextResponse.json({
      success: true,
      emailId: resendJson?.id || null,
      sentTo: email,
      receiptId: receipt.id || null,
    });
  } catch (error) {
    console.error("Receipt email API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send receipt email" },
      { status: 500 },
    );
  }
}
