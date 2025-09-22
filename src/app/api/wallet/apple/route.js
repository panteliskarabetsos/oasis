export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { Template } from "passkit-generator";
import { writeFile } from "node:fs/promises";

const ORG_NAME = "Oasis";
const BRAND_COLOR = "rgb(90,74,63)"; // text color
const LABEL_COLOR = "rgb(139,111,71)";
const BG_COLOR = "rgb(250,247,241)";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const bookingId = searchParams.get("bookingId");
    if (!bookingId)
      return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });

    // In production you’d load booking details from your DB.
    // Keep it simple: the client already has these; but we’ll show defaults if missing.
    // (If you want, POST the details from the page instead of refetching here.)
    // For demo we accept some optional hints:
    const name = searchParams.get("title") || "Oasis Experience";
    const location = searchParams.get("loc") || "Crete, Greece";
    const dateISO = searchParams.get("date"); // e.g., 2025-10-10T09:00:00.000Z

    // Certificates (store securely in env as base64)
    const p12 = process.env.APPLE_PASS_CERT_P12_BASE64;
    const p12Password = process.env.APPLE_PASS_CERT_PASSWORD;
    const wwdr = process.env.APPLE_WWDR_PEM_BASE64;
    const passTypeIdentifier = process.env.APPLE_PASS_TYPE_IDENTIFIER; // like 'pass.com.your.bundleid'
    const teamIdentifier = process.env.APPLE_TEAM_IDENTIFIER; // like 'ABCDE12345'

    if (
      !p12 ||
      !p12Password ||
      !wwdr ||
      !passTypeIdentifier ||
      !teamIdentifier
    ) {
      return NextResponse.json(
        { error: "Apple Wallet env missing" },
        { status: 500 }
      );
    }

    // Write certs to tmp files (serverless-safe)
    const certPath = "/tmp/pass.p12";
    const wwdrPath = "/tmp/wwdr.pem";
    await writeFile(certPath, Buffer.from(p12, "base64"));
    await writeFile(wwdrPath, Buffer.from(wwdr, "base64"));

    // Create an Event Ticket template
    const template = new Template("eventTicket", {
      passTypeIdentifier,
      teamIdentifier,
      organizationName: ORG_NAME,
      description: `${ORG_NAME} Experience`,
      backgroundColor: BG_COLOR,
      foregroundColor: BRAND_COLOR,
      labelColor: LABEL_COLOR,
    });

    // Logos / icons (optional). If you have PNGs in /public, you can add them:
    // await template.images.add("icon", fileBuffer);
    // await template.images.add("logo", fileBuffer);

    await template.loadCertificate(certPath, p12Password);
    await template.loadWWDRCert(wwdrPath);

    // Build the pass
    const pass = template.createPass({
      serialNumber: String(bookingId),
      webServiceURL: undefined, // set if you plan to update passes later
      authenticationToken: undefined,
      // Primary/secondary fields (visible on the pass)
      eventTicket: {
        primaryFields: [{ key: "event", label: "EXPERIENCE", value: name }],
        secondaryFields: [
          {
            key: "when",
            label: "WHEN",
            value: dateISO ? new Date(dateISO).toUTCString() : "—",
          },
          { key: "where", label: "LOCATION", value: location },
        ],
      },
    });

    // Barcode/QR (use booking id)
    pass.setBarcodes({
      message: `OASIS-${bookingId}`,
      format: "PKBarcodeFormatQR",
      messageEncoding: "iso-8859-1",
      altText: `Booking #${bookingId}`,
    });

    // Output
    const buffer = await pass.asBuffer();
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="oasis-booking-${bookingId}.pkpass"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[apple wallet] error", e);
    return NextResponse.json(
      { error: "Failed to generate pass" },
      { status: 500 }
    );
  }
}
