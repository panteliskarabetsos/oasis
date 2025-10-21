// src/lib/email/sendBookingConfirmation.js
import "server-only";
import { format } from "date-fns";
import { getTransporter } from "./mailer";

/**
 * Env
 */
const EMAIL_FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER;
const REPLY_TO = process.env.EMAIL_REPLY_TO || EMAIL_FROM;

/**
 * Send a booking confirmation email with optional calendar invite.
 *
 * @param {Object} opts
 * @param {string|string[]} [opts.to]
 * @param {Object} opts.draft
 * @param {Object} opts.session
 * @param {Object|null} [opts.experience]
 * @param {Object|null} [opts.slot]
 * @param {string}   [opts.bookingCode]
 * @param {number}   [opts.bookingId]
 * @param {string}   [opts.subject]
 * @param {string[]} [opts.bcc]
 * @param {string}   [opts.locale="en-GB"]
 * @param {boolean}  [opts.addCalendarInvite=true]
 * @param {number}   [opts.durationMinutes=120]
 * @param {string}   [opts.tz="Europe/Athens"]
 * @param {Object}   [opts.brand]
 * @param {string}   [opts.preheader]
 * @param {string}   [opts.logoUrl]
 */
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
    bcc = [],
    locale = "en-GB",
    addCalendarInvite = true,
    durationMinutes = 120,
    tz = "Europe/Athens",
    brand = {
      primary: "#8b6f47",
      bg: "#faf7f2",
      border: "#efeae1",
      text: "#2b2a28",
      subtext: "#6b665d",
      panel: "#fcfbf8",
    },
    preheader,
    logoUrl,
  } = opts;

  if (!draft || !session)
    return { skipped: true, error: "missing-draft-or-session" };

  /** -------------------- recipients -------------------- */
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
  const bccList = normalizeRecipients(bcc);

  /** -------------------- counts & attendees -------------------- */
  const { adults, kids } = normalizeCounts(draft?.counts);
  const attendees = deriveAttendeesFromDraft(draft, adults, kids);

  /** -------------------- when -------------------- */
  const whenIso = slot?.date || slot?.startAt || slot?.start || null;
  const d = whenIso ? new Date(whenIso) : null;
  const dateLabel = d ? format(d, "PPP") : "";
  const timeLabel = d ? format(d, "p") : "";

  /** -------------------- amounts & currency -------------------- */
  const currency = String(
    session?.currency || draft?.currency || "eur"
  ).toUpperCase();
  const amount =
    typeof session?.amount_total === "number"
      ? session.amount_total / 100
      : Number(draft?.totalAmount ?? 0);

  const fmt = makeCurrencyFormatter(locale, currency);
  const amountLabel = fmt(Number(amount || 0));

  /** -------------------- promo / discount -------------------- */
  const promo = extractPromoFromDraft(draft);
  const hasDiscount = promo?.discountAmount > 0;
  const discountLabel = hasDiscount ? fmt(promo.discountAmount) : null;
  const subtotalLabel = hasDiscount
    ? fmt(Math.max(0, Number(amount || 0) + promo.discountAmount))
    : null;

  /** -------------------- subject / ref / preheader -------------------- */
  const reference =
    bookingCode ||
    (bookingId ? `BK-${String(bookingId).padStart(6, "0")}` : null) ||
    (draft?.id ? `DRAFT-${String(draft.id).padStart(6, "0")}` : null);

  const subj =
    customSubject ||
    `Your booking is confirmed — ${experience?.name || "Reservation"}`;

  const preheaderText =
    preheader ||
    `${experience?.name || "Reservation"} on ${dateLabel}${
      timeLabel ? `, ${timeLabel}` : ""
    } — confirmed`;

  /** -------------------- render -------------------- */
  const html = renderConfirmationHtml({
    brand,
    logoUrl,
    preheaderText,
    experienceName: experience?.name,
    location: experience?.location,
    dateLabel,
    timeLabel,
    attendees,
    amountLabel,
    currency,
    bookingRef: reference,
    promoCode: promo?.code || null,
    discountLabel,
    subtotalLabel,
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
    promoCode: promo?.code || null,
    discountLabel,
    subtotalLabel,
  });

  /** -------------------- optional ICS attachment -------------------- */
  const attachments = [];
  if (addCalendarInvite && d) {
    const ics = buildICS({
      uid: reference || `booking-${draft?.id || ""}-${Date.now()}`,
      title: experience?.name || "Reservation",
      description: `Booking${reference ? ` #${reference}` : ""}${
        experience?.name ? ` — ${experience.name}` : ""
      }`,
      location: experience?.location || "",
      start: d,
      durationMinutes,
      tz, // informational only; ICS uses UTC
    });
    attachments.push({
      filename: "booking.ics",
      content: ics,
      contentType: "text/calendar; charset=utf-8; method=REQUEST",
    });
  }

  /** -------------------- send -------------------- */
  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to: recipients,
      ...(bccList.length ? { bcc: bccList } : {}),
      replyTo: REPLY_TO,
      subject: subj,
      headers: {
        "X-Entity-Ref-ID": reference || "",
        "X-Booking-ID": String(bookingId ?? ""),
        "X-Experience-ID": String(draft?.experienceId ?? ""),
      },
      html,
      text,
      attachments,
    });
    return { sent: true, id: info?.messageId };
  } catch (e) {
    console.error("[email] Gmail send error:", e?.message || e);
    return { sent: false, error: e?.message || "send-failed" };
  }
}

/** =========================== renderers =========================== */

export function renderConfirmationHtml({
  brand,
  logoUrl,
  preheaderText,
  experienceName,
  location,
  dateLabel,
  timeLabel,
  attendees = [],
  amountLabel,
  currency = "EUR",
  bookingRef,
  promoCode,
  discountLabel,
  subtotalLabel,
}) {
  const {
    text = "#2b2a28",
    subtext = "#6b665d",
    bg = "#faf7f2",
    border = "#efeae1",
    panel = "#fcfbf8",
    primary = "#8b6f47",
  } = brand || {};

  // Build attendees rows (zebra style)
  const attendeesHtml = (attendees || []).length
    ? attendees
        .map((a, i) => {
          const zebra = i % 2 === 1 ? `background:${panel};` : "";
          return `
            <tr>
              <td style="padding:8px 10px;border-bottom:1px solid ${border};${zebra}">${
            i + 1
          }</td>
              <td style="padding:8px 10px;border-bottom:1px solid ${border};${zebra}">${escapeHtml(
            a?.name || "Guest"
          )}</td>
            </tr>`;
        })
        .join("")
    : `<tr><td colspan="2" style="padding:10px;color:${subtext}">No attendee names on file</td></tr>`;

  // Promo/discount block with clearer hierarchy
  const promoRows =
    promoCode || discountLabel || subtotalLabel
      ? `
      ${row("Promo code", promoCode || "-", border)}
      ${row("Subtotal", subtotalLabel || amountLabel || "", border)}
      ${row("Discount", discountLabel || "€0.00", border)}
      <tr>
        <td style="padding:10px;border-top:1px solid ${border}"><strong>Total</strong></td>
        <td style="padding:10px;border-top:1px solid ${border}"><strong>${escapeHtml(
          amountLabel || ""
        )}</strong></td>
      </tr>
    `
      : `
      ${row("Total", amountLabel || "", border)}
    `;

  // Google Maps link for location (if present)
  const locationRow = location
    ? rowHtml(
        "Location",
        `<a href="https://maps.google.com/?q=${encodeURIComponent(
          location
        )}" style="color:${primary};text-decoration:none;border-bottom:1px solid ${primary};">${escapeHtml(
          location
        )}</a>`,
        border
      )
    : "";

  // Date/time combined line
  const dateTime = dateLabel
    ? `${escapeHtml(dateLabel)}${timeLabel ? `, ${escapeHtml(timeLabel)}` : ""}`
    : "";

  // Outer wrapper with centered container
  return `
  <div style="margin:0;padding:0;background:${bg};color:${text};font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <!-- Preheader (hidden) -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">
      ${escapeHtml(preheaderText || "Your booking is confirmed")}
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${bg};margin:0;padding:0;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <!-- Container -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background:#ffffff;border:1px solid ${border};border-radius:14px;overflow:hidden;">
            <!-- Top accent -->
            <tr>
              <td style="height:4px;background:${primary};"></td>
            </tr>

            <!-- Header -->
            <tr>
              <td style="padding:16px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="left" style="vertical-align:middle;">
                      ${
                        logoUrl
                          ? `<img src="${escapeHtml(
                              logoUrl
                            )}" alt="" height="28" style="display:block;line-height:1;border:0;outline:none;">`
                          : `<span style="font-weight:700;font-size:16px;color:${text};">Booking Confirmation</span>`
                      }
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <span style="display:inline-block;padding:6px 10px;border-radius:9999px;background:${panel};color:${primary};font-weight:600;font-size:12px;letter-spacing:.3px;text-transform:uppercase;">
                        Confirmed
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Hero -->
            <tr>
              <td style="padding:12px 20px 0;">
                <h2 style="margin:0 0 4px;font-size:20px;line-height:1.25;">${
                  experienceName
                    ? escapeHtml(experienceName)
                    : "Your reservation"
                }</h2>
                ${
                  dateTime
                    ? `<p style="margin:0 0 2px;color:${subtext};font-size:14px;">🗓️ ${dateTime}</p>`
                    : ""
                }
                ${
                  location
                    ? `<p style="margin:0 0 12px;color:${subtext};font-size:14px;">📍 ${escapeHtml(
                        location
                      )}</p>`
                    : ""
                }
              </td>
            </tr>

            <!-- Summary card -->
            <tr>
              <td style="padding:12px 20px 20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${bg};border:1px solid ${border};border-radius:12px;">
                  <tr>
                    <td style="padding:10px 12px;border-bottom:1px solid ${border};font-weight:600;color:${subtext};" colspan="2">
                      Order summary
                    </td>
                  </tr>
                  ${
                    experienceName
                      ? row("Experience", experienceName, border)
                      : ""
                  }
                  ${locationRow}
                  ${dateTime ? row("Date", dateTime, border) : ""}
                  ${promoRows}
                  ${bookingRef ? row("Reference", bookingRef, border) : ""}
                </table>
              </td>
            </tr>

            <!-- Attendees -->
            <tr>
              <td style="padding:0 20px 20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid ${border};border-radius:12px;overflow:hidden;">
                  <thead>
                    <tr style="background:${panel};color:${subtext};">
                      <th align="left" scope="col" style="padding:8px 10px;border-bottom:1px solid ${border};font-size:13px;">#</th>
                      <th align="left" scope="col" style="padding:8px 10px;border-bottom:1px solid ${border};font-size:13px;">Name</th>
                    </tr>
                  </thead>
                  <tbody>${attendeesHtml}</tbody>
                </table>
              </td>
            </tr>

            <!-- Helper / footer -->
            <tr>
              <td style="padding:4px 20px 18px;">
                <p style="margin:12px 0 0;color:${subtext};font-size:13px;">
                  A calendar invite (.ics) is attached. For any questions, just reply to this email.
                </p>
                ${
                  location
                    ? `<div style="margin-top:12px;">
                        <a href="https://maps.google.com/?q=${encodeURIComponent(
                          location
                        )}"
                          style="display:inline-block;padding:10px 14px;border-radius:10px;border:1px solid ${border};background:${panel};text-decoration:none;color:${text};font-weight:600;">
                          Get directions →
                        </a>
                      </div>`
                    : ""
                }
                <div style="height:2px;background:${primary};opacity:.2;margin:18px 0 0;border-radius:2px;"></div>
              </td>
            </tr>

          </table>
          <!-- /Container -->
        </td>
      </tr>
    </table>
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
  promoCode,
  discountLabel,
  subtotalLabel,
}) {
  const lines = [
    `${experienceName || "Your reservation"} — confirmed`,
    location ? `Location: ${location}` : "",
    dateLabel ? `Date: ${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""}` : "",
    location
      ? `Directions: https://maps.google.com/?q=${encodeURIComponent(location)}`
      : "",
    promoCode ? `Promo: ${promoCode}` : "",
    subtotalLabel ? `Subtotal: ${subtotalLabel}` : "",
    discountLabel ? `Discount: ${discountLabel}` : "",
    amountLabel ? `Total: ${amountLabel}` : "",
    bookingRef ? `Reference: ${bookingRef}` : "",
    attendees?.length
      ? `Attendees: ${attendees.map((a) => a.name).join(", ")}`
      : "",
    "",
    "A calendar invite (.ics) is attached. We look forward to seeing you!",
  ];
  return lines.filter(Boolean).join("\n");
}

/** =========================== helpers =========================== */

function row(label, value, border = "#efeae1") {
  return `<tr><td style="padding:10px;border-bottom:1px solid ${border}"><strong>${escapeHtml(
    label
  )}</strong></td><td style="padding:10px;border-bottom:1px solid ${border}">${escapeHtml(
    value || ""
  )}</td></tr>`;
}

function rowHtml(label, html, border = "#efeae1") {
  return `<tr>
    <td style="padding:10px;border-bottom:1px solid ${border};"><strong>${escapeHtml(
    label
  )}</strong></td>
    <td style="padding:10px;border-bottom:1px solid ${border};">${
    html || ""
  }</td>
  </tr>`;
}

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeRecipients(to) {
  const arr = Array.isArray(to) ? to : [to];
  return [
    ...new Set(arr.map((x) => (x || "").toString().trim()).filter(Boolean)),
  ];
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
    draft?.booking?.attendees,
    draft?.participants,
    draft?.guests,
    draft?.slot?.attendees,
    draft?.primary_contact?.attendees,
  ].filter(Array.isArray);

  for (const arr of arrays) {
    if (arr.length) {
      return arr.map((a, i) =>
        typeof a === "string" ? { name: a } : { name: pickName(a, i) }
      );
    }
  }

  const out = [];
  const buyer = draft?.primary_contact || {};
  const buyerName = pickName(buyer, 0, /*isPrimary*/ true);

  if (adults > 0 && buyerName) out.push({ name: buyerName });

  for (let i = out.length; i < adults; i++)
    out.push({ name: `Adult ${i + 1}` });
  for (let i = 0; i < kids; i++) out.push({ name: `Kid ${i + 1}` });

  return out;
}

function pickName(obj = {}, idx = 0, isPrimary = false) {
  const fields = [
    "name",
    "fullName",
    "full_name",
    "displayName",
    "display_name",
    "holderName",
    "holder_name",
    ["firstName", "lastName"],
    ["first_name", "last_name"],
    ["given_name", "family_name"],
  ];

  for (const f of fields) {
    if (Array.isArray(f)) {
      const v = [obj?.[f[0]], obj?.[f[1]]].filter(Boolean).join(" ").trim();
      if (v) return v;
    } else if (obj?.[f]) {
      const v = String(obj[f]).trim();
      if (v) return v;
    }
  }

  if (isPrimary && obj?.email) {
    const local = String(obj.email).split("@")[0] || "";
    if (local)
      return local
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (m) => m.toUpperCase());
  }

  return `Guest ${idx + 1}`;
}

/** promo extracted from draft */
function extractPromoFromDraft(draft) {
  try {
    const code = draft?.appliedPromoCode || draft?.promoJson?.code || null;
    const discountAmount = Number(draft?.discountAmount || 0);
    const out = { code, discountAmount };
    if (draft?.promoJson?.discountType)
      out.discountType = draft.promoJson.discountType;
    if (draft?.promoJson?.discountValue != null)
      out.discountValue = draft.promoJson.discountValue;
    return out;
  } catch {
    return { code: null, discountAmount: 0 };
  }
}

/** currency formatter factory */
function makeCurrencyFormatter(locale, currency) {
  try {
    const nf = new Intl.NumberFormat(locale || "en-GB", {
      style: "currency",
      currency: (currency || "EUR").toUpperCase(),
      currencyDisplay: "symbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return (n) => nf.format(Number(n || 0));
  } catch {
    return (n) => `€${Number(n || 0).toFixed(2)}`;
  }
}

/** Build a minimal ICS invite in UTC */
function buildICS({
  uid,
  title,
  description,
  location,
  start,
  durationMinutes = 120,
  tz = "Europe/Athens",
}) {
  const dtStart = toICSDateUTC(start);
  const dtEnd = toICSDateUTC(
    new Date(start.getTime() + Math.max(15, durationMinutes) * 60000)
  );
  const now = toICSDateUTC(new Date());

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//YourBrand//Booking Confirm//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid || `${Date.now()}@yourbrand`}`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICS(title || "Reservation")}`,
    location ? `LOCATION:${escapeICS(location)}` : null,
    description ? `DESCRIPTION:${escapeICS(description)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

function toICSDateUTC(d) {
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const mm = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mi = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

function escapeICS(s = "") {
  return String(s)
    .replace(/\\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export { deriveAttendeesFromDraft };
