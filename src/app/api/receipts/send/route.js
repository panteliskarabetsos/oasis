// src/app/api/receipts/send/route.js
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import generateReceiptEmailHtml from "@/lib/email/ReceiptEmail";
import buildReceiptPdfBuffer from "@/lib/pdf/buildReceipt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isEmail(email) {
  return /.+@.+\..+/.test(String(email || "").trim());
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 465),
    secure: String(process.env.EMAIL_SECURE) === "true", // true for 465
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

export async function POST(req) {
  try {
    const body = await req.json();

    const receipt = body?.receipt;
    const email = String(body?.email || receipt?.customerEmail || "").trim();

    if (!receipt) return bad("Receipt data is missing", 400);
    if (!email) return bad("Recipient email is missing", 400);
    if (!isEmail(email)) return bad("Recipient email is invalid", 400);

    if (
      !process.env.EMAIL_HOST ||
      !process.env.EMAIL_USER ||
      !process.env.EMAIL_PASS
    ) {
      return bad("SMTP is not configured", 500);
    }

    const receiptNumber = String(receipt.id || "0").padStart(6, "0");

    const html = generateReceiptEmailHtml(receipt);

    const pdfBuffer = await buildReceiptPdfBuffer({
      receipt,
      store: {
        name: "Oasis",
        address: "123 Artisan Lane\nChania, Crete 73100",
        taxId: "EL123456789",
      },
    });

    const transporter = createTransporter();

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"Oasis" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Your Oasis Receipt #${receiptNumber}`,
      html,
      attachments: [
        {
          filename: `receipt-${receiptNumber}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
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
