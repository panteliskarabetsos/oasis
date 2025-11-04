// src/lib/email/sendBookingConfirmation.js
import "server-only";
import { format } from "date-fns";
import { getTransporter } from "./mailer";
import Stripe from "stripe";

import path from "node:path";
import buildTicketPdfBuffer from "@/lib/pdf/buildTicket";
/**
 * Env
 */
const EMAIL_FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER;
const REPLY_TO = process.env.EMAIL_REPLY_TO || EMAIL_FROM;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
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
    stripeSessionId: _stripeSessionId, // optional overrides
    stripePaymentIntentId: _stripePaymentIntentId,
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

  /** -------------------- Stripe invoice PDF + receipt URL -------------------- */
  let receiptUrl = null;
  let hasInvoicePdf = false;
  // Collect Stripe identifiers from any source available
  const ssId =
    (session && session.id) ||
    _stripeSessionId ||
    draft?.stripeSessionId ||
    null;
  const piId =
    (session &&
      (typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id)) ||
    _stripePaymentIntentId ||
    draft?.stripePaymentIntentId ||
    null;

  try {
    const {
      invoicePdfBuffer,
      invoiceFilename,
      receiptUrl: rUrl,
    } = await getStripeArtifacts({
      stripeSessionId: ssId,
      stripePaymentIntentId: piId,
    });
    receiptUrl = rUrl || null;
    if (invoicePdfBuffer) {
      attachments.push({
        filename:
          invoiceFilename ||
          `Invoice-${String(bookingId ?? draft?.id ?? "").padStart(
            6,
            "0"
          )}.pdf`,
        content: invoicePdfBuffer, // Buffer
        contentType: "application/pdf",
      });
      hasInvoicePdf = true;
    }
    console.log("[email] artifacts:", {
      stripeSessionId: ssId,
      stripePaymentIntentId: piId,
      hasInvoicePdf,
      hasReceipt: Boolean(receiptUrl),
    });
  } catch (e) {
    console.warn("[email] stripe artifacts error:", e?.message || e);
  }

  /** -------------------- Custom Ticket PDF (experience + payment + QR) -------------------- */
  if (opts.attachTicketPdf !== false) {
    const appOrigin =
      opts.appOrigin || process.env.APP_ORIGIN || "https://youroasis.gr";

    const defaultQrUrl =
      opts.checkinUrl ||
      `${appOrigin}/bookings/${encodeURIComponent(
        reference || bookingId || draft?.id || "ref"
      )}`;

    try {
      const ticketPdfBuffer = await buildTicketPdfBuffer({
        brand,
        logoUrl,
        experienceName: experience?.name || "Reservation",
        location: experience?.location || "",
        dateLabel,
        timeLabel,
        attendees,
        amountLabel,
        currency,
        bookingRef: reference || String(bookingId ?? draft?.id ?? ""),
        receiptUrl,
        qrValue: opts.qrValue || defaultQrUrl,
        fontDir: path.join(process.cwd(), "public", "fonts"), // <- explicit
        logoUrl: path.join(process.cwd(), "public", "brand", "logo.png"),
        brandName: "Oasis", // fallback text if the image can’t load
      });

      attachments.push({
        filename: `Booking-${
          reference || bookingId || draft?.id || "ticket"
        }.pdf`,
        content: ticketPdfBuffer,
        contentType: "application/pdf",
      });
    } catch (e) {
      console.warn("[email] ticket pdf error:", e?.message || e);
    }
  }

  // Re-render HTML and text with receipt link / invoice note info
  const htmlFinal = renderConfirmationHtml({
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
    receiptUrl,
    hasInvoicePdf,
  });

  const textFinal = renderTextFallback({
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
    receiptUrl,
    hasInvoicePdf,
  });
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
      html: htmlFinal,
      text: textFinal,
      attachments,
    });
    return { sent: true, id: info?.messageId };
  } catch (e) {
    console.error("[email] Gmail send error:", e?.message || e);
    return { sent: false, error: e?.message || "send-failed" };
  }
}

/** =========================== renderers =========================== */

async function fetchPdfBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PDF fetch failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Look up Stripe artifacts by ID(s).
 * Returns: { invoicePdfBuffer?, invoiceFilename?, receiptUrl? }
 */
async function getStripeArtifacts({ stripeSessionId, stripePaymentIntentId }) {
  if (!STRIPE_SECRET_KEY) {
    console.warn("[email] STRIPE_SECRET_KEY missing; skipping Stripe lookups");
    return {};
  }
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

  // Re-fetch the session to expand invoice + latest charge
  let sess = null;
  if (stripeSessionId) {
    try {
      sess = await stripe.checkout.sessions.retrieve(stripeSessionId, {
        expand: ["invoice", "payment_intent.latest_charge"],
      });
    } catch (e) {
      console.warn("[email] retrieve session failed:", e?.message || e);
    }
  }

  // Hosted receipt URL from PI/Charge
  let receiptUrl = null;
  async function receiptFromPI(idOrObj) {
    const pi =
      typeof idOrObj === "string"
        ? await stripe.paymentIntents.retrieve(idOrObj, {
            expand: ["latest_charge"],
          })
        : idOrObj;
    if (!pi) return null;

    if (pi.latest_charge) {
      const ch =
        typeof pi.latest_charge === "string"
          ? await stripe.charges.retrieve(pi.latest_charge)
          : pi.latest_charge;
      return ch?.receipt_url || null;
    }
    return pi?.charges?.data?.[0]?.receipt_url || null;
  }

  if (sess?.payment_intent) {
    try {
      receiptUrl = await receiptFromPI(sess.payment_intent);
    } catch (e) {
      console.warn("[email] receipt from session PI failed:", e?.message || e);
    }
  }
  if (!receiptUrl && stripePaymentIntentId) {
    try {
      receiptUrl = await receiptFromPI(stripePaymentIntentId);
    } catch (e) {
      console.warn("[email] retrieve PI failed:", e?.message || e);
    }
  }

  // Invoice PDF (if invoice_creation enabled at Checkout)
  let invoicePdfBuffer = null;
  let invoiceFilename = null;
  if (sess?.invoice) {
    try {
      const inv =
        typeof sess.invoice === "string"
          ? await stripe.invoices.retrieve(sess.invoice)
          : sess.invoice;
      if (inv?.invoice_pdf) {
        invoicePdfBuffer = await fetchPdfBuffer(inv.invoice_pdf);
        invoiceFilename = inv?.number ? `${inv.number}.pdf` : undefined;
      }
    } catch (e) {
      console.warn("[email] retrieve invoice failed:", e?.message || e);
    }
  }

  return { invoicePdfBuffer, invoiceFilename, receiptUrl };
}

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
  receiptUrl,
  hasInvoicePdf,
  // NEW (optional):
  calendarUrl, // e.g. a Google Calendar template link
  manageUrl, // e.g. “Manage booking” link in your app
}) {
  const {
    text = "#2b2a28",
    subtext = "#6b665d",
    bg = "#faf7f2",
    border = "#efeae1",
    panel = "#fcfbf8",
    primary = "#8b6f47",
  } = brand || {};

  const dateTime = dateLabel
    ? `${escapeHtml(dateLabel)}${timeLabel ? `, ${escapeHtml(timeLabel)}` : ""}`
    : "";

  const headKpis = [
    dateTime ? { label: "When", value: dateTime } : null,
    attendees?.length
      ? { label: "Guests", value: String(attendees.length) }
      : null,
    location
      ? {
          label: "Location",
          value: `<a href="https://maps.google.com/?q=${encodeURIComponent(
            location
          )}" style="color:${primary};text-decoration:none;border-bottom:1px solid ${primary}">${escapeHtml(
            location
          )}</a>`,
        }
      : null,
  ].filter(Boolean);

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

  const totalsRows =
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
      : row("Total", amountLabel || "", border);

  return `
  <div style="margin:0;padding:0;background:${bg};color:${text};font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <!-- Preheader -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">
      ${escapeHtml(preheaderText || "Your booking is confirmed")}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};margin:0;padding:0;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid ${border};border-radius:14px;overflow:hidden;">
            <!-- Accent -->
            <tr><td style="height:4px;background:${primary};"></td></tr>

            <!-- Header -->
            <tr>
              <td style="padding:16px 20px;border-bottom:1px solid ${border}">
                <table role="presentation" width="100%">
                  <tr>
                    <td align="left">
                      ${
                        logoUrl
                          ? `<img src="${escapeHtml(
                              logoUrl
                            )}" alt="" height="28" style="display:block;border:0;outline:none;">`
                          : `<span style="font-weight:700;font-size:16px;color:${text};">Booking Confirmation</span>`
                      }
                    </td>
                    <td align="right">
                      <span style="display:inline-block;padding:6px 10px;border-radius:9999px;background:${panel};color:${primary};font-weight:700;font-size:12px;letter-spacing:.3px;text-transform:uppercase;">
                        ✓ Confirmed
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Title -->
            <tr>
              <td style="padding:16px 20px 8px;">
                <h1 style="margin:0 0 4px;font-size:20px;line-height:1.25;color:${text};">${
    experienceName ? escapeHtml(experienceName) : "Your reservation"
  }</h1>
                ${
                  bookingRef
                    ? `<div style="color:${subtext};font-size:13px;">Ref: ${escapeHtml(
                        bookingRef
                      )}</div>`
                    : ""
                }
              </td>
            </tr>

            <!-- Key details bar -->
            ${
              headKpis.length
                ? `
                  <tr>
                    <td style="padding:8px 20px 4px;">
                      <table role="presentation" width="100%" style="border:1px solid ${border};border-radius:10px;background:${panel};">
                        ${headKpis
                          .map(
                            (k) => `
                          <tr>
                            <td style="width:120px;padding:10px 12px;border-bottom:1px solid ${border};color:${subtext};font-size:12px;">${k.label}</td>
                            <td style="padding:10px 12px;border-bottom:1px solid ${border};font-size:14px;color:${text};">${k.value}</td>
                          </tr>
                        `
                          )
                          .join("")
                          .replace(/<\/tr>\s*$/, "</tr>")}
                      </table>
                    </td>
                  </tr>`
                : ""
            }

            <!-- Summary -->
            <tr>
              <td style="padding:12px 20px 8px;">
                <table role="presentation" width="100%" style="border:1px solid ${border};border-radius:12px;overflow:hidden;">
                  <tr>
                    <td colspan="2" style="padding:10px 12px;background:${panel};color:${subtext};font-weight:700;">Order summary</td>
                  </tr>
                  ${
                    experienceName
                      ? row("Experience", experienceName, border)
                      : ""
                  }
                  ${
                    location
                      ? rowHtml(
                          "Location",
                          `<a href="https://maps.google.com/?q=${encodeURIComponent(
                            location
                          )}" style="color:${primary};text-decoration:none;border-bottom:1px solid ${primary}">${escapeHtml(
                            location
                          )}</a>`,
                          border
                        )
                      : ""
                  }
                  ${dateTime ? row("Date", dateTime, border) : ""}
                  ${totalsRows}
                </table>
              </td>
            </tr>

            <!-- CTAs -->
            ${
              calendarUrl || receiptUrl || manageUrl
                ? `
                <tr>
                  <td style="padding:4px 20px 14px;">
                    ${
                      calendarUrl
                        ? cta(calendarUrl, "Add to calendar", primary)
                        : ""
                    }
                    ${
                      receiptUrl
                        ? cta(
                            receiptUrl,
                            "View Stripe receipt",
                            "#3f382f",
                            border,
                            panel
                          )
                        : ""
                    }
                    ${
                      manageUrl
                        ? cta(
                            manageUrl,
                            "Manage booking",
                            "#3f382f",
                            border,
                            panel
                          )
                        : ""
                    }
                    <div style="margin-top:8px;color:${subtext};font-size:12px;">
                      A calendar invite (.ics) is attached.${
                        hasInvoicePdf
                          ? " We\u2019ve also attached your invoice PDF."
                          : ""
                      }
                    </div>
                  </td>
                </tr>`
                : `
                <tr>
                  <td style="padding:4px 20px 14px;">
                    <div style="color:${subtext};font-size:12px;">
                      A calendar invite (.ics) is attached.${
                        hasInvoicePdf
                          ? " We\u2019ve also attached your invoice PDF."
                          : ""
                      }
                    </div>
                  </td>
                </tr>`
            }

            <!-- Attendees -->
            <tr>
              <td style="padding:0 20px 18px;">
                <table role="presentation" width="100%" style="border:1px solid ${border};border-radius:12px;overflow:hidden;">
                  <thead>
                    <tr style="background:${panel};color:${subtext};">
                      <th align="left" style="padding:8px 10px;border-bottom:1px solid ${border};font-size:13px;">#</th>
                      <th align="left" style="padding:8px 10px;border-bottom:1px solid ${border};font-size:13px;">Name</th>
                    </tr>
                  </thead>
                  <tbody>${attendeesHtml}</tbody>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:14px 20px;border-top:1px solid ${border}">
                <div style="color:${subtext};font-size:12px;line-height:18px;">
                  Questions? Reply to this email.
                  <br/>© ${new Date().getFullYear()} ${escapeHtml(
    (experienceName || "Our venue").replace(/<[^>]*>/g, "")
  )}.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

/* small helpers used above */
function row(label, value, border = "#efeae1") {
  return `<tr>
    <td style="padding:10px;border-bottom:1px solid ${border};width:140px;color:#6b665d;"><strong>${escapeHtml(
    label
  )}</strong></td>
    <td style="padding:10px;border-bottom:1px solid ${border};color:#2b2a28;">${escapeHtml(
    value || ""
  )}</td>
  </tr>`;
}
function rowHtml(label, html, border = "#efeae1") {
  return `<tr>
    <td style="padding:10px;border-bottom:1px solid ${border};width:140px;color:#6b665d;"><strong>${escapeHtml(
    label
  )}</strong></td>
    <td style="padding:10px;border-bottom:1px solid ${border};color:#2b2a28;">${
    html || ""
  }</td>
  </tr>`;
}
function cta(href, label, bg = "#8b6f47", border = "transparent", fgPanel) {
  const styles = `display:inline-block;margin:6px 8px 0 0;padding:11px 16px;border-radius:10px;border:1px solid ${border};background:${bg};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;line-height:20px;`;
  const onPanel = fgPanel ? `background:${fgPanel};color:#2b2a28;` : "";
  return `<a href="${href}" target="_blank" style="${
    fgPanel
      ? styles.replace(
          `background:${bg};color:#ffffff;`,
          onPanel + `border:1px solid ${border};`
        )
      : styles
  }">${escapeHtml(label)} →</a>`;
}
function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
  receiptUrl,
  hasInvoicePdf,
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
    receiptUrl ? `Receipt: ${receiptUrl}` : "",
    attendees?.length
      ? `Attendees: ${attendees.map((a) => a.name).join(", ")}`
      : "",
    "",
    `A calendar invite (.ics) is attached.${
      hasInvoicePdf ? " Invoice PDF attached." : ""
    } We look forward to seeing you!`,
  ];
  return lines.filter(Boolean).join("\n");
}

/** =========================== helpers =========================== */

// function row(label, value, border = "#efeae1") {
//   return `<tr><td style="padding:10px;border-bottom:1px solid ${border}"><strong>${escapeHtml(
//     label
//   )}</strong></td><td style="padding:10px;border-bottom:1px solid ${border}">${escapeHtml(
//     value || ""
//   )}</td></tr>`;
// }

// function rowHtml(label, html, border = "#efeae1") {
//   return `<tr>
//     <td style="padding:10px;border-bottom:1px solid ${border};"><strong>${escapeHtml(
//     label
//   )}</strong></td>
//     <td style="padding:10px;border-bottom:1px solid ${border};">${
//     html || ""
//   }</td>
//   </tr>`;
// }

// function escapeHtml(s = "") {
//   return String(s)
//     .replace(/&/g, "&amp;")
//     .replace(/</g, "&lt;")
//     .replace(/>/g, "&gt;");
// }

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
