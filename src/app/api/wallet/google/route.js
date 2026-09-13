export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

import { bookingRef } from "@/lib/bookingCode";
import {
  ACCESS_DENIED,
  authorizeBookingAccess,
} from "@/lib/bookings/bookingAccess";
import { getBookingById } from "@/lib/bookings/getBookingById";

/**
 * A Google Wallet event ticket for a booking.
 *
 * Everything on the pass is read from the booking. It used to come off the
 * query string — title, venue and date were whatever the caller typed — and
 * the barcode was "OASIS-<row id>", which the check-in scanner cannot resolve:
 * it reads a booking reference. A pass that scans is the whole point.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const bookingId = searchParams.get("bookingId");
    if (!bookingId)
      return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });

    // A pass names a booking and carries its barcode, so it is only for
    // someone entitled to that booking — not for whoever guesses the id.
    const access = await authorizeBookingAccess(req, bookingId);
    if (!access.ok) {
      console.warn(`[wallet] denied pass for booking ${bookingId}`);
      return NextResponse.json({ error: ACCESS_DENIED }, { status: 401 });
    }

    const saBase64 = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64;
    const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
    const classSuffix = process.env.GOOGLE_WALLET_CLASS_SUFFIX || "oasis_event";
    if (!saBase64 || !issuerId) {
      return NextResponse.json(
        { error: "Google Wallet is not configured." },
        { status: 500 },
      );
    }

    const booking = await getBookingById(Number(bookingId));
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const serviceAccount = JSON.parse(
      Buffer.from(saBase64, "base64").toString("utf8"),
    );

    const details = describeBooking(booking);

    // One class per experience: the name and venue belong to the experience,
    // while everything that varies per guest rides on the object below.
    const classId = `${issuerId}.${classSuffix}_${
      booking.experienceId ?? "private"
    }`;
    const objectId = `${issuerId}.b${booking.id}`;

    const claims = {
      iss: serviceAccount.client_email,
      aud: "google",
      typ: "savetowallet",
      origins: [siteOrigin(req)],
      payload: {
        // Declared inline so a class does not have to be created in the
        // console before the first guest saves a pass.
        eventTicketClasses: [
          {
            id: classId,
            issuerName: process.env.NEXT_PUBLIC_SITE_NAME || "Oasis",
            reviewStatus: "UNDER_REVIEW",
            eventName: text(details.experienceName),
            ...(details.location
              ? { venue: { name: text(details.location), address: text(details.location) } }
              : {}),
            hexBackgroundColor: "#8b6f47",
          },
        ],
        eventTicketObjects: [
          {
            id: objectId,
            classId,
            state: "ACTIVE",
            // The reference the check-in scanner resolves, shown underneath so
            // it can be read out if scanning fails.
            barcode: {
              type: "QR_CODE",
              value: details.reference,
              alternateText: details.reference,
            },
            ticketNumber: details.reference,
            ...(details.guestName ? { ticketHolderName: details.guestName } : {}),
            ...(details.startIso
              ? { validTimeInterval: { start: { date: details.startIso } } }
              : {}),
            textModulesData: details.rows,
          },
        ],
      },
    };

    const token = jwt.sign(claims, serviceAccount.private_key, {
      algorithm: "RS256",
    });

    return NextResponse.json({
      saveUrl: `https://pay.google.com/gp/v/save/${token}`,
      reference: details.reference,
    });
  } catch (e) {
    console.error("[google wallet] error", e);
    return NextResponse.json(
      { error: "Failed to create the Wallet link." },
      { status: 500 },
    );
  }
}

/* ------------------------------- helpers ------------------------------- */

const text = (value) => ({ defaultValue: { language: "en-US", value } });

/** What goes on the pass, all of it off the booking. */
function describeBooking(booking) {
  const experienceName =
    booking.customExperienceName ||
    booking.experience?.name ||
    "Oasis Experience";

  const start = booking.startTime ? new Date(booking.startTime) : null;
  const valid = start && !Number.isNaN(start.getTime()) ? start : null;

  const adults = Number(booking.adultsCount ?? booking.counts?.adults ?? 0);
  const kids = Number(booking.kidsCount ?? booking.counts?.kids ?? 0);
  const party =
    [
      adults ? `${adults} adult${adults === 1 ? "" : "s"}` : null,
      kids ? `${kids} child${kids === 1 ? "" : "ren"}` : null,
    ]
      .filter(Boolean)
      .join(", ") ||
    (booking.numberOfPeople ? `${booking.numberOfPeople} guests` : "");

  const pc = booking.primary_contact || {};
  const guestName =
    pc.name ||
    [pc.firstName, pc.lastName].filter(Boolean).join(" ").trim() ||
    "";

  const meetup = booking.selected_meetup_point || null;
  const meetupLabel = meetup?.name
    ? `${meetup.name}${meetup.time ? ` · ${meetup.time}` : ""}`
    : "";

  const rows = [
    valid
      ? {
          header: "When",
          body: valid.toLocaleString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Athens",
          }),
        }
      : null,
    meetupLabel ? { header: "Meeting point", body: meetupLabel } : null,
    party ? { header: "Party", body: party } : null,
  ].filter(Boolean);

  return {
    experienceName,
    location: booking.experience?.location || "",
    reference: bookingRef(booking),
    guestName,
    startIso: valid ? valid.toISOString() : null,
    rows,
  };
}

/** Google checks the saving page's origin against this list. */
function siteOrigin(req) {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      return new URL(
        /^https?:\/\//i.test(configured) ? configured : `https://${configured}`,
      ).origin;
    } catch {
      /* fall through to the request's own origin */
    }
  }
  try {
    return new URL(req.url).origin;
  } catch {
    return "";
  }
}
