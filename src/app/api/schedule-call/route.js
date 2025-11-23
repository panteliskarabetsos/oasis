// src/app/api/schedule-call/route.js
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

const SITE_NAME = process.env.SITE_NAME || "Oasis";
const FROM_EMAIL = process.env.EMAIL_USER;
const TO_EMAIL = process.env.EMAIL_TO || process.env.EMAIL_USER;

if (!FROM_EMAIL) {
  console.warn(
    "[schedule-call] EMAIL_USER is not set in environment variables."
  );
}

// Reuse a single transporter instance
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST, // e.g. "smtp.gmail.com" or your provider
  port: process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : 465,
  secure: process.env.EMAIL_SECURE ? process.env.EMAIL_SECURE === "true" : true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Very small helper to avoid weird HTML injection in emails
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function humanFocusArea(value) {
  switch (value) {
    case "retreats":
      return "Retreats";
    case "private":
      return "Private gatherings";
    case "experiences":
      return "Slow experiences";
    default:
      return "Not sure yet";
  }
}

function humanTimeOfDay(value) {
  switch (value) {
    case "morning":
      return "Morning";
    case "afternoon":
      return "Afternoon";
    case "evening":
      return "Evening";
    default:
      return "No preference";
  }
}

function humanMeetingType(value) {
  switch (value) {
    case "video":
      return "Video call";
    case "audio":
      return "Audio only";
    default:
      return "Not specified";
  }
}

function humanCountry(value) {
  switch (value) {
    // Southern Europe
    case "GR":
      return "Greece";
    case "IT":
      return "Italy";
    case "ES":
      return "Spain";
    case "PT":
      return "Portugal";

    // Central & Western Europe
    case "FR":
      return "France";
    case "DE":
      return "Germany";
    case "CH":
      return "Switzerland";
    case "AT":
      return "Austria";
    case "BE":
      return "Belgium";
    case "NL":
      return "Netherlands";
    case "LU":
      return "Luxembourg";

    // Nordics + UK & Ireland
    case "GB":
      return "United Kingdom";
    case "IE":
      return "Ireland";
    case "SE":
      return "Sweden";
    case "NO":
      return "Norway";
    case "DK":
      return "Denmark";
    case "FI":
      return "Finland";

    // North America
    case "US":
      return "United States";
    case "CA":
      return "Canada";

    // Middle East / Near
    case "AE":
      return "United Arab Emirates";
    case "IL":
      return "Israel";
    case "SA":
      return "Saudi Arabia";

    // Oceania
    case "AU":
      return "Australia";
    case "NZ":
      return "New Zealand";

    // Asia hubs
    case "SG":
      return "Singapore";
    case "HK":
      return "Hong Kong";

    case "OTHER":
      return "Other / not listed";
    default:
      return "Not specified";
  }
}

function countryDialCode(value) {
  switch (value) {
    // Southern Europe
    case "GR":
      return "+30";
    case "IT":
      return "+39";
    case "ES":
      return "+34";
    case "PT":
      return "+351";

    // Central & Western Europe
    case "FR":
      return "+33";
    case "DE":
      return "+49";
    case "CH":
      return "+41";
    case "AT":
      return "+43";
    case "BE":
      return "+32";
    case "NL":
      return "+31";
    case "LU":
      return "+352";

    // Nordics + UK & Ireland
    case "GB":
      return "+44";
    case "IE":
      return "+353";
    case "SE":
      return "+46";
    case "NO":
      return "+47";
    case "DK":
      return "+45";
    case "FI":
      return "+358";

    // North America
    case "US":
    case "CA":
      return "+1";

    // Middle East / Near
    case "AE":
      return "+971";
    case "IL":
      return "+972";
    case "SA":
      return "+966";

    // Oceania
    case "AU":
      return "+61";
    case "NZ":
      return "+64";

    // Asia hubs
    case "SG":
      return "+65";
    case "HK":
      return "+852";

    default:
      return "";
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      name,
      email,
      country,
      phone,
      timezone,
      preferredDate,
      preferredTimeOfDay,
      focusArea,
      meetingType,
      message,
    } = body || {};

    // Basic validation
    if (
      !name ||
      !email ||
      !country ||
      !phone ||
      !timezone ||
      !preferredDate ||
      !message
    ) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    if (!FROM_EMAIL) {
      return NextResponse.json(
        { error: "Email sender is not configured." },
        { status: 500 }
      );
    }

    const dialCode = countryDialCode(country);
    const humanCountryName = humanCountry(country);
    const fullPhoneRaw = dialCode ? `${dialCode} ${phone}` : phone;

    const safe = {
      name: escapeHtml(name),
      email: escapeHtml(email),
      country: escapeHtml(humanCountryName),
      phone: escapeHtml(fullPhoneRaw),
      timezone: escapeHtml(timezone),
      preferredDate: escapeHtml(preferredDate),
      preferredTimeOfDay: escapeHtml(humanTimeOfDay(preferredTimeOfDay)),
      focusArea: escapeHtml(humanFocusArea(focusArea)),
      meetingType: escapeHtml(humanMeetingType(meetingType)),
      message: escapeHtml(message),
    };

    /* ------------------- Email 1: To Oasis team ------------------- */

    const internalSubject = `New call request from ${safe.name} (${safe.focusArea})`;

    const internalHtml = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color:#f4f1ec; padding:32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:18px;border:1px solid #e3d7c6;">
          <tr>
            <td style="padding:24px 28px 12px 28px;">
              <div style="display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;border:1px solid #e0d6c6;background:#fbf7ef;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#8b6f47;">
                ${SITE_NAME} • Call request
              </div>
              <h1 style="margin:16px 0 4px 0;font-size:22px;color:#3e3128;font-weight:600;">
                New clarity call request
              </h1>
              <p style="margin:0;font-size:13px;color:#6b625a;">
                Someone just filled in the “Schedule a call” form on the site.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:12px 28px 4px 28px;">
              <h2 style="margin:0 0 8px 0;font-size:14px;color:#3e3128;">Details</h2>
              <table cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;color:#4d3d33;">
                <tr>
                  <td style="padding:3px 0;width:130px;color:#8b7a6b;">Name</td>
                  <td style="padding:3px 0;">${safe.name}</td>
                </tr>
                <tr>
                  <td style="padding:3px 0;color:#8b7a6b;">Email</td>
                  <td style="padding:3px 0;"><a href="mailto:${safe.email}" style="color:#8b6f47;text-decoration:none;">${safe.email}</a></td>
                </tr>
                <tr>
                  <td style="padding:3px 0;color:#8b7a6b;">Country</td>
                  <td style="padding:3px 0;">${safe.country}</td>
                </tr>
                <tr>
                  <td style="padding:3px 0;color:#8b7a6b;">Phone</td>
                  <td style="padding:3px 0;">${safe.phone}</td>
                </tr>
                <tr>
                  <td style="padding:3px 0;color:#8b7a6b;">Time zone</td>
                  <td style="padding:3px 0;">${safe.timezone}</td>
                </tr>
                <tr>
                  <td style="padding:3px 0;color:#8b7a6b;">Preferred day</td>
                  <td style="padding:3px 0;">${safe.preferredDate}</td>
                </tr>
                <tr>
                  <td style="padding:3px 0;color:#8b7a6b;">Preferred time</td>
                  <td style="padding:3px 0;">${safe.preferredTimeOfDay}</td>
                </tr>
                <tr>
                  <td style="padding:3px 0;color:#8b7a6b;">Focus</td>
                  <td style="padding:3px 0;">${safe.focusArea}</td>
                </tr>
                <tr>
                  <td style="padding:3px 0;color:#8b7a6b;">Call style</td>
                  <td style="padding:3px 0;">${safe.meetingType}</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:12px 28px 4px 28px;">
              <h2 style="margin:10px 0 6px 0;font-size:14px;color:#3e3128;">Context from ${safe.name}</h2>
              <div style="padding:12px 14px;border-radius:12px;background:#f9f3ea;border:1px solid #e8ddcf;font-size:13px;line-height:1.6;color:#4a4a4a;white-space:pre-wrap;">
                ${safe.message}
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 28px 22px 28px;">
              <p style="margin:0 0 4px 0;font-size:12px;color:#8b7a6b;">
                Next step: reply to this email with 2–3 possible times that fit their time zone.
              </p>
              <p style="margin:0;font-size:11px;color:#b3a596;">
                Sent automatically from the website’s “Schedule a call” page.
              </p>
            </td>
          </tr>
        </table>
      </div>
    `;

    const internalText = `
New call request from ${name} (${humanFocusArea(focusArea)})

Name: ${name}
Email: ${email}
Country: ${humanCountry(country)}
Phone: ${dialCode ? `${dialCode} ${phone}` : phone}
Time zone: ${timezone}
Preferred day: ${preferredDate}
Preferred time of day: ${humanTimeOfDay(preferredTimeOfDay)}
Call style: ${humanMeetingType(meetingType)}

Message:
${message}
`.trim();

    await transporter.sendMail({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      replyTo: email,
      subject: internalSubject,
      text: internalText,
      html: internalHtml,
    });

    /* ----------------- Email 2: Confirmation to guest ---------------- */

    const confirmationSubject = `We’ve received your call request – ${SITE_NAME}`;

    const confirmationHtml = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color:#f4f1ec; padding:32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:18px;border:1px solid #e3d7c6;">
          <tr>
            <td style="padding:24px 28px 12px 28px;">
              <div style="display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;border:1px solid #e0d6c6;background:#fbf7ef;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#8b6f47;">
                ${SITE_NAME}
              </div>
              <h1 style="margin:16px 0 4px 0;font-size:22px;color:#3e3128;font-weight:600;">
                Thank you for reaching out, ${safe.name}.
              </h1>
              <p style="margin:0;font-size:13px;color:#6b625a;">
                We’ve received your request to schedule a call. We’ll email you soon with a few suggested times.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 28px 6px 28px;">
              <h2 style="margin:0 0 6px 0;font-size:14px;color:#3e3128;">Here’s what you shared</h2>
              <table cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;color:#4d3d33;">
                <tr>
                  <td style="padding:3px 0;width:140px;color:#8b7a6b;">Focus</td>
                  <td style="padding:3px 0;">${safe.focusArea}</td>
                </tr>
                <tr>
                  <td style="padding:3px 0;color:#8b7a6b;">Preferred day</td>
                  <td style="padding:3px 0;">${safe.preferredDate}</td>
                </tr>
                <tr>
                  <td style="padding:3px 0;color:#8b7a6b;">Time of day</td>
                  <td style="padding:3px 0;">${safe.preferredTimeOfDay}</td>
                </tr>
                <tr>
                  <td style="padding:3px 0;color:#8b7a6b;">Time zone</td>
                  <td style="padding:3px 0;">${safe.timezone}</td>
                </tr>
                <tr>
                  <td style="padding:3px 0;color:#8b7a6b;">Country</td>
                  <td style="padding:3px 0;">${safe.country}</td>
                </tr>
                <tr>
                  <td style="padding:3px 0;color:#8b7a6b;">Phone</td>
                  <td style="padding:3px 0;">${safe.phone}</td>
                </tr>
                <tr>
                  <td style="padding:3px 0;color:#8b7a6b;">Call style</td>
                  <td style="padding:3px 0;">${safe.meetingType}</td>
                </tr>
              </table>

              <div style="margin-top:12px;padding:10px 12px;border-radius:12px;background:#f9f3ea;border:1px solid #e8ddcf;font-size:13px;line-height:1.6;color:#4a4a4a;white-space:pre-wrap;">
                ${safe.message}
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 28px 22px 28px;">
              <p style="margin:0 0 8px 0;font-size:13px;color:#6b625a;">
                If anything changes — your dates, your time zone or the best way to reach you — you can simply reply to this email and let us know.
              </p>
              <p style="margin:0;font-size:11px;color:#8b7a6b;">
                With warmth from Crete,<br/>
                The ${SITE_NAME} team
              </p>
            </td>
          </tr>
        </table>
      </div>
    `;

    const confirmationText = `
Hi ${name},

Thank you for reaching out to ${SITE_NAME}. We’ve received your request to schedule a call and will email you soon with a few suggested times.

Here’s what you shared:

Focus: ${humanFocusArea(focusArea)}
Preferred day: ${preferredDate}
Preferred time of day: ${humanTimeOfDay(preferredTimeOfDay)}
Time zone: ${timezone}
Country: ${humanCountry(country)}
Phone: ${dialCode ? `${dialCode} ${phone}` : phone}
Call style: ${humanMeetingType(meetingType)}

Message:
${message}

If anything changes, you can reply directly to this email.

Warmly from Crete,
The ${SITE_NAME} team
`.trim();

    try {
      await transporter.sendMail({
        from: FROM_EMAIL,
        to: email,
        subject: confirmationSubject,
        text: confirmationText,
        html: confirmationHtml,
      });
    } catch (err) {
      // Don't fail the whole request if the confirmation email has an issue
      console.error("[schedule-call] Failed to send confirmation email:", err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[schedule-call] Unexpected error:", err);
    return NextResponse.json(
      { error: "Something went wrong while sending your request." },
      { status: 500 }
    );
  }
}
