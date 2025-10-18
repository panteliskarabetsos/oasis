// src/lib/email/sendBookingConfirmation.js
// Gmail (Nodemailer) version. Keeps the same call shape.
import "server-only";
import { format } from "date-fns";
import { getTransporter } from "./mailer";

const EMAIL_FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER;

export default async function sendBookingConfirmation(opts = {}) {
  const {
    to,
    draft,
    session,
    experience = null,
    slot = null,
    bookingCode,
    bookingId,
    subject: customSubject,
  } = opts;

  if (!draft || !session) {
    return { skipped: true, error: "missing-draft-or-session" };
  }

  const recipients = normalizeRecipients(
    to ||
      draft?.primary_contact?.email ||
      session?.customer_details?.email ||
      session?.customer_email
  );
  if (!recipients.length) {
    console.warn("[email] No recipient; skipping send");
    return { skipped: true, error: "no-recipient" };
  }

  const { adults, kids } = normalizeCounts(draft?.counts);

  // When
  const whenIso = slot?.date || slot?.startAt || slot?.start || null;
  const d = whenIso ? new Date(whenIso) : null;
  const dateLabel = d ? format(d, "PPP") : "";
  const timeLabel = d ? format(d, "p") : "";

  // Amount & currency
  const currency = String(
    session?.currency || draft?.currency || "eur"
  ).toUpperCase();

  const amount =
    typeof session?.amount_total === "number"
      ? session.amount_total / 100
      : Number(draft?.totalAmount ?? 0);

  const amountLabel = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(Number(amount || 0));

  const reference =
    bookingCode ||
    (bookingId ? `BK-${String(bookingId).padStart(6, "0")}` : null) ||
    (draft?.id ? `DRAFT-${String(draft.id).padStart(6, "0")}` : null);

  const subj =
    customSubject ||
    `Your booking is confirmed — ${experience?.name || "Reservation"}`;

  const attendees = deriveAttendeesFromDraft(draft, adults, kids);

  const html = renderConfirmationHtml({
    experienceName: experience?.name,
    location: experience?.location,
    dateLabel,
    timeLabel,
    attendees,
    amountLabel,
    currency,
    bookingRef: reference,
  });

  const text = renderTextFallback({
    experienceName: experience?.name,
    location: experience?.location,
    dateLabel,
    timeLabel,
    attendees,
    amountLabel,
    currency,
    bookingRef: reference,
  });

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to: recipients,
      subject: subj,
      html,
      text,
    });
    return { sent: true, id: info?.messageId };
  } catch (e) {
    console.error("[email] Gmail send error:", e?.message);
    return { sent: false, error: e?.message || "send-failed" };
  }
}

/** --------- renderers (same as before, using preformatted amountLabel) --------- */
export function renderConfirmationHtml({
  experienceName,
  location,
  dateLabel,
  timeLabel,
  attendees = [],
  amountLabel,
  currency = "EUR",
  bookingRef,
}) {
  const attendeesHtml = (attendees || []).length
    ? attendees
        .map(
          (a, i) =>
            `<tr>
              <td style="padding:6px 8px;border-bottom:1px solid #eee">${
                i + 1
              }</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(
                a?.name || "Guest"
              )}</td>
            </tr>`
        )
        .join("")
    : `<tr><td colspan="2" style="padding:8px 8px;color:#6b665d">No attendee names on file</td></tr>`;

  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2b2a28">
    <h2 style="margin:0 0 8px;font-size:18px">Booking confirmed</h2>
    <p style="margin:0 0 16px;color:#6b665d">
      Thank you for your reservation${
        experienceName
          ? ` at <strong>${escapeHtml(experienceName)}</strong>`
          : ""
      }.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#faf7f2;border:1px solid #efeae1;border-radius:12px;padding:12px">
      ${experienceName ? row("Experience", experienceName) : ""}
      ${location ? row("Location", location) : ""}
      ${
        dateLabel
          ? row("Date", `${dateLabel}${timeLabel ? `, ${timeLabel}` : ""}`)
          : ""
      }
      ${amountLabel ? row("Total", amountLabel) : ""}
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
  amountLabel,
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
    amountLabel ? `Total: ${amountLabel}` : "",
    bookingRef ? `Reference: ${bookingRef}` : "",
    "",
    "Thank you for your booking!",
  ];
  return lines.filter(Boolean).join("\n");
}

/** ---------- small helpers ---------- */
function row(label, value) {
  return `<tr><td style="padding:6px 8px"><strong>${escapeHtml(
    label
  )}</strong></td><td style="padding:6px 8px">${escapeHtml(
    value || ""
  )}</td></tr>`;
}
function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
  const arrays = [
    draft?.attendees,
    draft?.guests,
    draft?.participants,
    draft?.booking?.attendees,
    draft?.slot?.attendees,
  ].filter(Array.isArray);

  for (const arr of arrays) {
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

  const rows = [];
  for (let i = 0; i < adults; i++) rows.push({ name: `Adult ${i + 1}` });
  for (let i = 0; i < kids; i++) rows.push({ name: `Kid ${i + 1}` });
  return rows;
}
export { deriveAttendeesFromDraft };
