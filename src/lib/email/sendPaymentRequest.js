// src/lib/email/sendPaymentRequest.js
import "server-only";
import { format } from "date-fns";
import { getTransporter } from "./mailer";

/* ENV                                      */
const EMAIL_FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER;
const REPLY_TO = process.env.EMAIL_REPLY_TO || EMAIL_FROM;

/* MAIN: sendPaymentRequest                 */

/**
 * Sends a crisp, high-end payment request email matching the
 * primary booking confirmation template styling.
 */
export default async function sendPaymentRequest(opts = {}) {
  const {
    to,
    booking,
    paymentLink,
    amountDue,
    brand = {
      primary: "#000000",
      bg: "#f9f9f9",
      border: "#eaeaea",
      text: "#111111",
      subtext: "#767676",
      panel: "#ffffff",
    },
    logoUrl,
  } = opts;

  if (!to || !booking || !paymentLink) {
    return { sent: false, error: "missing-data" };
  }

  /* -------------------- details ------------------ */

  const experienceName =
    booking.customExperienceName ||
    booking.Experience?.name ||
    "Oasis Signature Experience";

  const dateLabel = booking.startTime
    ? format(new Date(booking.startTime), "PPP")
    : "Date to be determined";

  /* -------------------- calculate balance due ------------------ */

  // Use the exact amount passed from the front-end, fallback to 0
  const finalBalance = amountDue !== undefined ? Number(amountDue) : 0;

  const currency =
    booking?.money?.currency ||
    booking?.currency ||
    booking?.currency_code ||
    "EUR";

  const amountLabel = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency,
  }).format(finalBalance);

  const reference = booking.code || booking.id || "Pending";
  const firstName =
    booking.primary_contact?.firstName || booking.guest?.name || "Guest";

  /* ---------------------- subject / preheader ------------------------ */

  const subject = `Complete your reservation — ${experienceName}`;
  const preheaderText = `Action required: Please secure your reservation for ${experienceName} on ${dateLabel}.`;

  /* --------------------- HTML + text email bodies -------------------- */

  const html = renderPaymentRequestHtml({
    brand,
    logoUrl,
    preheaderText,
    firstName,
    experienceName,
    dateLabel,
    amountLabel,
    reference,
    paymentLink,
  });

  const text = renderTextFallback({
    firstName,
    experienceName,
    dateLabel,
    amountLabel,
    reference,
    paymentLink,
  });

  /* ------------------------------ send ------------------------------- */

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to,
      replyTo: REPLY_TO,
      subject,
      html,
      text,
    });

    return { sent: true, id: info?.messageId };
  } catch (e) {
    console.error("[email] Payment request send error:", e?.message || e);
    return { sent: false, error: e?.message || "send-failed" };
  }
}

/* -------------------------------------------------------------------------- */
/* HTML / TEXT RENDERERS                            */
/* -------------------------------------------------------------------------- */

export function renderPaymentRequestHtml({
  brand,
  logoUrl,
  preheaderText,
  firstName,
  experienceName,
  dateLabel,
  amountLabel,
  reference,
  paymentLink,
}) {
  const {
    text = "#111111",
    subtext = "#767676",
    bg = "#f9f9f9",
    border = "#eaeaea",
    panel = "#ffffff",
    primary = "#000000",
  } = brand || {};

  return `
  <div style="margin:0;padding:0;background:${bg};color:${text};font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">
      ${escapeHtml(preheaderText)}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};margin:0;padding:40px 0;">
      <tr>
        <td align="center" style="padding:20px 15px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${panel};border:1px solid ${border};">
            
            <tr>
              <td align="center" style="padding:40px 40px 20px;">
                ${
                  logoUrl
                    ? `<img src="${escapeHtml(
                        logoUrl,
                      )}" alt="" height="32" style="display:block;border:0;outline:none;margin:0 auto;">`
                    : `<span style="font-weight:600;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:${text};">Action Required</span>`
                }
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:0 40px 30px;">
                <h1 style="margin:0 0 8px;font-size:24px;font-weight:400;line-height:1.3;color:${text};">Secure Your Reservation</h1>
                <div style="color:${subtext};font-size:12px;letter-spacing:0.5px;text-transform:uppercase;">Ref: ${escapeHtml(
                  reference,
                )}</div>
              </td>
            </tr>

            <tr>
              <td style="padding:0 40px 30px;">
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${text};">Dear ${escapeHtml(firstName)},</p>
                <p style="margin:0;font-size:15px;line-height:1.6;color:${text};">
                  We are excited to welcome you to Oasis. To finalize your reservation and ensure everything is prepared for your arrival, please complete your payment within the next <strong>48 hours</strong>.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:0 40px 30px;">
                <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${subtext};margin-bottom:16px;">Booking Details</div>
                <table role="presentation" width="100%">
                  ${row("Experience", experienceName, border)}
                  ${row("Date", dateLabel, border)}
                  <tr>
                    <td style="padding:16px 0 0;border-top:1px solid ${border};font-size:16px;"><strong>Total Due</strong></td>
                    <td align="right" style="padding:16px 0 0;border-top:1px solid ${border};font-size:16px;color:${primary};"><strong>${escapeHtml(
                      amountLabel,
                    )}</strong></td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:10px 40px 40px;">
                ${cta(paymentLink, "Complete Payment", primary, primary, panel)}
                <div style="margin-top:24px;color:${subtext};font-size:12px;line-height:1.5;">
                  Processed securely by Stripe.
                </div>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:30px 40px;background:${bg};border-top:1px solid ${border}">
                <div style="color:${subtext};font-size:11px;letter-spacing:0.5px;line-height:1.6;">
                  If you require assistance or wish to use an alternative payment method, please reply directly to this email.
                  <br/>© ${new Date().getFullYear()} ${escapeHtml(
                    (experienceName || "Oasis").replace(/<[^>]*>/g, ""),
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

function renderTextFallback({
  firstName,
  experienceName,
  dateLabel,
  amountLabel,
  reference,
  paymentLink,
}) {
  const lines = [
    `Secure Your Reservation — ${experienceName}`,
    `Reference: ${reference}`,
    "",
    `Dear ${firstName},`,
    `We are excited to welcome you to Oasis. To finalize your reservation, please complete your payment of ${amountLabel} within the next 48 hours.`,
    "",
    `Date: ${dateLabel}`,
    `Total Due: ${amountLabel}`,
    "",
    `Complete your payment securely here: ${paymentLink}`,
    "",
    "If you require assistance, simply reply to this email.",
  ];
  return lines.filter((line) => line != null).join("\n");
}

/* -------------------------------------------------------------------------- */
/* HTML helpers                                 */
/* -------------------------------------------------------------------------- */

function row(label, value, border = "#eaeaea") {
  return `<tr>
    <td style="padding:12px 0;border-bottom:1px solid ${border};color:#767676;">${escapeHtml(
      label,
    )}</td>
    <td align="right" style="padding:12px 0;border-bottom:1px solid ${border};color:#111111;">${escapeHtml(
      value || "",
    )}</td>
  </tr>`;
}

function cta(
  href,
  label,
  bg = "#000000",
  border = "#000000",
  textColor = "#ffffff",
) {
  return `<a href="${href}" target="_blank" style="display:inline-block;margin:6px 4px;padding:12px 24px;background:${bg};border:1px solid ${border};color:${textColor};text-decoration:none;font-size:13px;letter-spacing:0.5px;text-transform:uppercase;">${escapeHtml(
    label,
  )}</a>`;
}

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
