export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const bookingId = searchParams.get("bookingId");
    if (!bookingId)
      return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });

    // Minimal fields; for best results, POST real booking details or fetch them here.
    const title = searchParams.get("title") || "Oasis Experience";
    const location = searchParams.get("loc") || "Crete, Greece";
    const dateISO = searchParams.get("date"); // optional

    // Service account (base64 JSON)
    const saBase64 = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64;
    const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID; // numeric issuer ID
    const classSuffix = process.env.GOOGLE_WALLET_CLASS_SUFFIX || "oasis_event";
    if (!saBase64 || !issuerId) {
      return NextResponse.json(
        { error: "Google Wallet env missing" },
        { status: 500 }
      );
    }

    const serviceAccount = JSON.parse(
      Buffer.from(saBase64, "base64").toString("utf8")
    );
    const privateKey = serviceAccount.private_key;
    const clientEmail = serviceAccount.client_email;

    const objectId = `${issuerId}.${bookingId}`; // must be globally unique
    const classId = `${issuerId}.${classSuffix}`; // create this class in console first

    // Build a Save-to-Wallet JWT payload (Event Ticket)
    const claims = {
      iss: clientEmail,
      aud: "google",
      typ: "savetowallet",
      origins: [process.env.NEXT_PUBLIC_SITE_URL || "https://example.com"],
      payload: {
        eventTicketObjects: [
          {
            id: objectId,
            classId,
            state: "ACTIVE",
            // Visible fields:
            eventName: { defaultValue: { language: "en-US", value: title } },
            venue: { defaultValue: { language: "en-US", value: location } },
            startDateTime: dateISO || undefined, // RFC3339 format if provided
            // Show a QR with booking ID
            barcode: { type: "QR_CODE", value: `OASIS-${bookingId}` },
          },
        ],
      },
    };

    const token = jwt.sign(claims, privateKey, { algorithm: "RS256" });
    const saveUrl = `https://pay.google.com/gp/v/save/${token}`;

    return NextResponse.json({ saveUrl });
  } catch (e) {
    console.error("[google wallet] error", e);
    return NextResponse.json(
      { error: "Failed to create Save URL" },
      { status: 500 }
    );
  }
}
