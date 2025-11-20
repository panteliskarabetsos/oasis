// src/lib/email/sendBookingConfirmation.js
// Sends a booking confirmation email (via Resend) and provides an HTML renderer.
// Usage in your confirm route:
//   import sendBookingConfirmation, { renderConfirmationHtml } from "@/lib/email/sendBookingConfirmation";
//   await sendBookingConfirmation({ to, draft, session, experience: exp, slot });

import "server-only";
import { Resend } from "resend";
import { format } from "date-fns";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "Bookings <no-reply@example.com>";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

/**
 * Send a booking confirmation email.
 * @param {Object} opts
 * @param {string|string[]} [opts.to]                 - Recipient email(s). If omitted, tries draft.primary_contact.email then session.customer_details.email.
 * @param {Object} opts.draft                         - BookingDraft row (expects id, counts, primary_contact, experienceId, scheduleSlotId, unitPriceAdult/Kid, totalAmount).
 * @param {Object} opts.session                       - Stripe Checkout Session (expects amount_total, currency, id, payment_intent, customer_details.email).
 * @param {Object|null} [opts.experience]             - { name, location } (optional, will render if provided).
 * @param {Object|null} [opts.slot]                   - { date | startAt | start } (optional; used to render date/time).
 * @param {string} [opts.subject]                     - Optional custom subject line.
 * @returns {Promise<{sent?:boolean, skipped?:boolean, id?:string, error?:string}>}
 */
export default async function sendBookingConfirmation(opts) {
  const {
    draft,
    session,
    experience = null,
    slot = null,
    subject: customSubject,
  } = opts || {};

  if (!draft || !session) {
    return { skipped: true, error: "missing-draft-or-session" };
  }

  // Resolve recipient
  const resolvedTo = normalizeRecipients(
    opts?.to ||
      draft?.primary_contact?.email ||
      session?.customer_details?.email
  );
  if (!resolvedTo.length) {
    console.warn("[email] No recipient; skipping send");
    return { skipped: true, error: "no-recipient" };
  }

  const { adults, kids } = normalizeCounts(draft?.counts);

  // When
  const whenIso = slot?.date || slot?.startAt || slot?.start || null;
  const d = whenIso ? new Date(whenIso) : null;
  const dateLabel = d ? format(d, "PPP") : "";
  const timeLabel = d ? format(d, "p") : "";

  // Email pieces
  const subj =
    customSubject ||
    `Your booking is confirmed — ${experience?.name || "Reservation"}`;
  const attendees = deriveAttendeesFromDraft(draft, adults, kids);
  const amount = (session?.amount_total ?? draft?.totalAmount ?? 0) / 100;
  const currency = (session?.currency || "eur").toUpperCase();

  const html = renderConfirmationHtml({
    experienceName: experience?.name,
    location: experience?.location,
    dateLabel,
    timeLabel,
    attendees,
    amount,
    currency,
    bookingRef: String(draft?.id ?? ""),
  });
  const text = renderTextFallback({
    experienceName: experience?.name,
    location: experience?.location,
    dateLabel,
    timeLabel,
    attendees,
    amount,
    currency,
    bookingRef: String(draft?.id ?? ""),
  });

  // Send
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set; logging preview instead.", {
      to: resolvedTo,
      subject: subj,
    });
    console.info("[email][preview][text]\n" + text);
    return { skipped: true, error: "no-api-key" };
  }

  const result = await resend.emails.send({
    from: EMAIL_FROM,
    to: resolvedTo,
    subject: subj,
    html,
    text,
  });

  if (result?.error) {
    console.error("[email] send error", result.error);
    return {
      sent: false,
      error: String(result.error?.message || result.error),
    };
  }
  return { sent: true, id: result?.data?.id };
}

/** Render HTML body for confirmation email */
export function renderConfirmationHtml({
  experienceName,
  location,
  dateLabel,
  timeLabel,
  attendees = [],
  amount,
  currency = "EUR",
  bookingRef,
}) {
  const attendeesHtml = (attendees || []).length
    ? attendees
        .map(
          (a, i) =>
            `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${
              i + 1
            }</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(
              a?.name || "Guest"
            )}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="2" style="padding:8px 8px;color:#6b665d">No attendee names on file</td></tr>`;

  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2b2a28">
    <h2 style="margin:0 0 8px;font-size:18px">Booking confirmed</h2>
    <p style="margin:0 0 16px;color:#6b665d">Thank you for your reservation$${
      experienceName ? ` at <strong>${escapeHtml(experienceName)}</strong>` : ""
    }.</p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#faf7f2;border:1px solid #efeae1;border-radius:12px;padding:12px">
      ${experienceName ? row("Experience", experienceName) : ""}
      ${location ? row("Location", location) : ""}
      ${
        dateLabel
          ? row("Date", `${dateLabel}${timeLabel ? `, ${timeLabel}` : ""}`)
          : ""
      }
      ${
        amount != null
          ? row("Total", `€${Number(amount).toFixed(2)} ${currency}`)
          : ""
      }
      ${bookingRef ? row("Reference", bookingRef) : ""}
    </table>

    <h3 style="margin:18px 0 8px;font-size:15px">Attendees</h3>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;border:1px solid #efeae1;border-radius:12px">
      <thead>
        <tr style="background:#fcfbf8;color:#6b665d">
          <th align="left" style="padding:8px 8px;border-bottom:1px solid #efeae1">#</th>
          <th align="left" style="padding:8px 8px;border-bottom:1px solid #efeae1">Name</th>
        </tr>
      </thead>
      <tbody>${attendeesHtml}</tbody>
    </table>

    <p style="margin:16px 0 0;color:#6b665d">We look forward to seeing you!</p>
  </div>`;
}

function renderTextFallback({
  experienceName,
  location,
  dateLabel,
  timeLabel,
  attendees = [],
  amount,
  currency = "EUR",
  bookingRef,
}) {
  const lines = [
    `${experienceName || "Your reservation"} — confirmed`,
    location ? `Location: ${location}` : "",
    dateLabel ? `Date: ${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""}` : "",
    attendees?.length
      ? `Attendees: ${attendees.map((a) => a.name).join(", ")}`
      : "",
    amount != null ? `Total: €${Number(amount).toFixed(2)} ${currency}` : "",
    bookingRef ? `Reference: ${bookingRef}` : "",
    "",
    "Thank you for your booking!",
  ];
  return lines.filter(Boolean).join("\n");
}

// ---------- helpers ----------
function row(label, value) {
  return `<tr><td style="padding:6px 8px"><strong>${escapeHtml(
    label
  )}</strong></td><td style="padding:6px 8px">${escapeHtml(
    value || ""
  )}</td></tr>`;
}

function escapeHtml(s = "") {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function normalizeRecipients(to) {
  if (!to) return [];
  return Array.isArray(to) ? to.filter(Boolean) : [to];
}

function normalizeCounts(c = {}) {
  const n = (v) => (v == null ? 0 : Number(v) || 0);
  return {
    adults: n(
      c.adults ?? c.adult ?? c.numAdults ?? c.adultCount ?? c.adultsCount
    ),
    kids: n(
      c.kids ??
        c.kid ??
        c.children ??
        c.numChildren ??
        c.childCount ??
        c.childrenCount
    ),
  };
}

function deriveAttendeesFromDraft(draft, adults, kids) {
  // Prefer named attendees if present
  const arrs = [
    draft?.attendees,
    draft?.guests,
    draft?.participants,
    draft?.booking?.attendees,
    draft?.slot?.attendees,
  ].filter(Array.isArray);

  for (const arr of arrs) {
    if (arr.length) {
      if (typeof arr[0] === "string")
        return arr.map((name) => ({ name: String(name) }));
      return arr.map((a, i) => ({
        name:
          a?.name ||
          [a?.first_name, a?.last_name].filter(Boolean).join(" ") ||
          a?.displayName ||
          a?.holderName ||
          `Guest ${i + 1}`,
      }));
    }
  }

  // Fallback to synthetic rows from counts
  const rows = [];
  for (let i = 0; i < adults; i++) rows.push({ name: `Adult ${i + 1}` });
  for (let i = 0; i < kids; i++) rows.push({ name: `Kid ${i + 1}` });
  return rows;
}

export { deriveAttendeesFromDraft };
