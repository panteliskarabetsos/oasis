// src/lib/email/sendRequestUpdateEmail.js
import "server-only";
import { format } from "date-fns";
import path from "node:path";
import { getTransporter } from "./mailer";
import buildTicketPdfBuffer from "@/lib/pdf/buildTicket";

const EMAIL_FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER;
const REPLY_TO = process.env.EMAIL_REPLY_TO || EMAIL_FROM;

export default async function sendRequestUpdateEmail({
  email,
  guestName,
  experienceName,
  requestType, // 'cancel', 'reschedule', 'meetup'
  action, // 'approve', 'reject'
  refundOption, // 'full', 'partial', 'none'
  adminNotes,
  bookingRef,
  bookingData, // The full booking object needed for the PDF
  newDateObj, // Passed if rescheduled
  newMeetupPoint, // Passed if meetup changed
  brand = {
    primary: "#000000",
    bg: "#f9f9f9",
    border: "#eaeaea",
    text: "#111111",
    subtext: "#767676",
    panel: "#ffffff",
  },
  logoUrl,
  appOrigin = process.env.APP_ORIGIN || "https://youroasis.gr",
}) {
  if (!email) return { skipped: true, error: "no-email" };

  const isApproved = action === "approve";
  const typeText =
    requestType === "cancel"
      ? "Cancellation"
      : requestType === "reschedule"
        ? "Reschedule"
        : "Meetup Point Change";

  const subject = `Update on your ${typeText} request — ${experienceName}`;
  const preheaderText = `Your request has been ${isApproved ? "approved" : "declined"}.`;

  const manageUrl = `${appOrigin}/manage-booking`;
  const defaultQrUrl = `${appOrigin}/bookings/${encodeURIComponent(bookingRef)}`;

  // ------------------------ Attachments (New PDF Ticket) ------------------------
  const attachments = [];

  // Only generate a NEW ticket if the booking is still active and was modified
  if (
    isApproved &&
    (requestType === "reschedule" || requestType === "meetup")
  ) {
    try {
      // Determine the active date/time (use new ones if provided, fallback to original)
      const finalDateObj =
        newDateObj ||
        (bookingData?.startTime ? new Date(bookingData.startTime) : null);
      const dateLabel = finalDateObj ? format(finalDateObj, "PPP") : "";
      const timeLabel = finalDateObj ? format(finalDateObj, "p") : "";

      // Determine final meetup point
      let pickupPoint =
        newMeetupPoint || bookingData?.selected_meetup_point || null;
      if (typeof pickupPoint === "object" && pickupPoint !== null) {
        pickupPoint = [pickupPoint.name, pickupPoint.time]
          .filter(Boolean)
          .join(" at ");
      }

      // Format currency
      const currency = String(bookingData?.currency || "EUR").toUpperCase();
      const amountLabel = new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: currency,
      }).format(Number(bookingData?.totalPaidAmount || 0));

      const ticketPdfBuffer = await buildTicketPdfBuffer({
        brand,
        experienceName: experienceName || "Booking",
        pickupPoint,
        location: bookingData?.Experience?.location || "",
        dateLabel,
        timeLabel,
        attendees: bookingData?.attendees || [{ name: guestName }],
        amountLabel,
        currency,
        bookingRef,
        qrValue: defaultQrUrl,
        fontDir: path.join(process.cwd(), "public", "fonts"),
        logoUrl: path.join(process.cwd(), "public", "brand", "logo.png"),
        brandName: brand?.name || "Oasis",
        status: "UPDATED",
        supportEmail: brand?.supportEmail || "info@youroasis.gr",
        supportPhone: brand?.supportPhone || "+30 210 0000000",
        footerNote: "Present this updated ticket at check-in.",
        watermarkText: brand?.watermarkText || brand?.name || "Oasis",
      });

      attachments.push({
        filename: `Updated-Ticket-${bookingRef}.pdf`,
        content: ticketPdfBuffer,
        contentType: "application/pdf",
      });
    } catch (e) {
      console.error("[email] Failed to generate updated PDF ticket:", e);
    }
  }

  // ------------------------ HTML Rendering ------------------------
  const html = renderUpdateHtml({
    brand,
    logoUrl,
    preheaderText,
    experienceName,
    guestName,
    bookingRef,
    isApproved,
    requestType,
    refundOption,
    adminNotes,
    manageUrl,
    hasNewTicket: attachments.length > 0,
    newDateObj,
    newMeetupPoint,
  });

  const text = `Hi ${guestName},\n\nYour ${typeText} request for ${experienceName} (${bookingRef}) has been ${isApproved ? "approved" : "declined"}.\n\nManage your booking here: ${manageUrl}`;

  // ------------------------ Send ------------------------
  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      replyTo: REPLY_TO,
      subject: subject,
      html,
      text,
      attachments,
    });
    return { sent: true, id: info?.messageId };
  } catch (e) {
    console.error("[email] send error:", e);
    return { sent: false, error: e?.message || "send-failed" };
  }
}

/* -------------------------------------------------------------------------- */
/* HTML RENDERER (Matches Booking Confirmation Style)                       */
/* -------------------------------------------------------------------------- */

function renderUpdateHtml({
  brand,
  logoUrl,
  preheaderText,
  experienceName,
  guestName,
  bookingRef,
  isApproved,
  requestType,
  refundOption,
  adminNotes,
  manageUrl,
  hasNewTicket,
  newDateObj,
  newMeetupPoint,
}) {
  const {
    text = "#111111",
    subtext = "#767676",
    bg = "#f9f9f9",
    border = "#eaeaea",
    panel = "#ffffff",
    primary = "#000000",
  } = brand || {};

  let statusColor = isApproved ? "#059669" : "#dc2626"; // Emerald or Red
  let statusText = isApproved ? "Approved" : "Declined";

  // Build the dynamic message body
  let messageBody = `<p style="margin:0 0 16px;">Hi ${escapeHtml(guestName)},</p>`;
  messageBody += `<p style="margin:0 0 16px;">We have reviewed your request regarding your booking for <strong>${escapeHtml(experienceName)}</strong>.</p>`;

  if (isApproved) {
    if (requestType === "cancel") {
      messageBody += `<p style="margin:0 0 16px;">Your booking has been successfully cancelled.</p>`;
      if (refundOption === "full") {
        messageBody += `<p style="margin:0 0 16px;">A <strong>100% full refund</strong> has been issued to your original payment method. Please allow 5-10 business days for the funds to appear.</p>`;
      } else if (refundOption === "partial") {
        messageBody += `<p style="margin:0 0 16px;">A <strong>50% partial refund</strong> has been issued to your original payment method according to our cancellation policy.</p>`;
      } else {
        messageBody += `<p style="margin:0 0 16px;">As per our cancellation policy for this timeframe, no refund has been issued.</p>`;
      }
    } else if (requestType === "reschedule") {
      const formattedDate = newDateObj
        ? format(newDateObj, "EEEE, MMMM do, yyyy 'at' h:mm a")
        : "your newly requested time";
      messageBody += `<p style="margin:0 0 16px;">Your booking has been successfully rescheduled to <strong>${escapeHtml(formattedDate)}</strong>.</p>`;
    } else if (requestType === "meetup") {
      const meetupName =
        typeof newMeetupPoint === "object"
          ? newMeetupPoint?.name
          : newMeetupPoint;
      messageBody += `<p style="margin:0 0 16px;">Your meetup point has been successfully updated to <strong>${escapeHtml(meetupName)}</strong>.</p>`;
    }
  } else {
    messageBody += `<p style="margin:0 0 16px;">Unfortunately, we are unable to accommodate your request at this time. Your booking remains active and unchanged.</p>`;
  }

  if (adminNotes) {
    messageBody += `
      <div style="background-color: #fcfaf7; border-left: 3px solid #8b6f47; padding: 16px; margin: 24px 0;">
        <p style="margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #8b6f47; font-weight: bold;">Note from our team</p>
        <p style="margin: 0; font-size: 14px; color: ${text}; font-style: italic;">"${escapeHtml(adminNotes)}"</p>
      </div>
    `;
  }

  if (hasNewTicket) {
    messageBody += `<p style="margin:16px 0 0; font-weight: bold;">We have attached your updated PDF ticket to this email.</p>`;
  }

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
                    ? `<img src="${escapeHtml(logoUrl)}" alt="" height="32" style="display:block;border:0;outline:none;margin:0 auto;">`
                    : `<span style="font-weight:600;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:${text};">Request Update</span>`
                }
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:0 40px 30px;">
                <div style="color:${statusColor};font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">
                  Request ${escapeHtml(statusText)}
                </div>
                <h1 style="margin:0 0 8px;font-size:24px;font-weight:400;line-height:1.3;color:${text};">${
                  experienceName ? escapeHtml(experienceName) : "Your Booking"
                }</h1>
                <div style="color:${subtext};font-size:12px;letter-spacing:0.5px;text-transform:uppercase;">
                  Ref: ${escapeHtml(bookingRef)}
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:0 40px 30px; border-top:1px solid ${border}; padding-top: 30px;">
                <div style="font-size: 15px;">
                  ${messageBody}
                </div>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:10px 40px 40px;">
                <a href="${manageUrl}" target="_blank" style="display:inline-block;margin:6px 4px;padding:12px 24px;background:${primary};border:1px solid ${primary};color:#ffffff;text-decoration:none;font-size:13px;letter-spacing:0.5px;text-transform:uppercase;">
                  Manage Booking
                </a>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:30px 40px;background:${bg};border-top:1px solid ${border}">
                <div style="color:${subtext};font-size:11px;letter-spacing:0.5px;line-height:1.6;">
                  If you have any questions, simply reply to this email.
                  <br/>© ${new Date().getFullYear()} ${escapeHtml((experienceName || "Our venue").replace(/<[^>]*>/g, ""))}.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
