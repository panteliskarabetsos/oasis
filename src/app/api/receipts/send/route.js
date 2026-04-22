// src/app/api/receipts/send/route.js
import { NextResponse } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import ReceiptEmail from "@/components/emails/ReceiptEmail";

export async function POST(req) {
  try {
    const { receipt, email } = await req.json();

    // 1. Convert the React Component into a raw HTML string
    const htmlString = renderToStaticMarkup(<ReceiptEmail receipt={receipt} />);

    // 2. Send the email using your preferred provider (Resend, SendGrid, NodeMailer, etc.)
    // Example using a generic fetch to an email provider:
    /*
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "receipts@yourstore.com",
        to: email,
        subject: `Your Receipt #${String(receipt.id).padStart(6, "0")}`,
        html: htmlString // <-- Pass the compiled HTML here!
      })
    });
    */

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
