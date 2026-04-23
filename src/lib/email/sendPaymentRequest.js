import "server-only";
import { format } from "date-fns";
import { getTransporter } from "./mailer";

const EMAIL_FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER;
const REPLY_TO = process.env.EMAIL_REPLY_TO || EMAIL_FROM;

/**
 * Sends a high-end payment request email for pending bookings.
 */
export default async function sendPaymentRequest(opts = {}) {
  const {
    to,
    booking,
    paymentLink,
    brand = {
      primary: "#8b6f47", // Oasis Gold
      bg: "#fdfcfb",
      border: "#e3ddd2",
      text: "#3f3127",
      panel: "#ffffff",
    },
  } = opts;

  if (!to || !booking || !paymentLink) {
    return { sent: false, error: "missing-data" };
  }

  const experienceName =
    booking.customExperienceName ||
    booking.Experience?.name ||
    "Oasis Experience";
  const dateLabel = booking.startTime
    ? format(new Date(booking.startTime), "PPP")
    : "TBD";
  const amountFormatted = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: booking.currency || "EUR",
  }).format(booking.totalAmount || 0);

  const subject = `Action Required: Secure your booking for ${experienceName}`;

  const html = `
    <div style="background:${brand.bg}; padding: 40px 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: ${brand.text};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto; background: ${brand.panel}; border: 1px solid ${brand.border}; border-radius: 16px; overflow: hidden;">
        <tr>
          <td style="padding: 40px; text-align: center;">
             <h2 style="font-family: serif; font-size: 24px; margin-bottom: 8px;">Secure Your Reservation</h2>
             <p style="font-size: 14px; color: #7a6a5f; margin-top: 0;">Booking Ref: ${booking.code || booking.id}</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 40px 30px;">
            <p style="font-size: 15px; line-height: 1.6;">Dear ${booking.primary_contact?.firstName || "Guest"},</p>
            <p style="font-size: 15px; line-height: 1.6;">
              Thank you for choosing <strong>Oasis</strong>. To finalize your upcoming experience, we kindly ask that you complete your payment within the next <strong>48 hours</strong>.
            </p>
            <p style="font-size: 15px; line-height: 1.6;">
              Please note that your reservation is currently on hold. Completing the payment ensures that your date and our team of artisans are fully secured.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 40px;">
            <div style="background: #fcfbf9; border: 1px solid ${brand.border}; padding: 20px; border-radius: 12px;">
              <table width="100%">
                <tr>
                  <td style="font-size: 11px; font-weight: bold; color: #a09084; text-transform: uppercase;">Experience</td>
                  <td align="right" style="font-size: 14px; font-weight: 500;">${experienceName}</td>
                </tr>
                <tr>
                  <td style="padding-top: 12px; font-size: 11px; font-weight: bold; color: #a09084; text-transform: uppercase;">Date</td>
                  <td align="right" style="padding-top: 12px; font-size: 14px; font-weight: 500;">${dateLabel}</td>
                </tr>
                <tr>
                  <td style="padding-top: 12px; font-size: 11px; font-weight: bold; color: #a09084; text-transform: uppercase;">Amount Due</td>
                  <td align="right" style="padding-top: 12px; font-size: 18px; font-weight: bold; color: ${brand.primary};">${amountFormatted}</td>
                </tr>
              </table>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px; text-align: center;">
            <a href="${paymentLink}" style="display: inline-block; background: #1a1a1a; color: #ffffff; padding: 16px 32px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">
              Complete Payment Securely
            </a>
            <p style="font-size: 11px; color: #a09084; margin-top: 24px;">
              Powered by Stripe. All major credit cards, Apple Pay, and Google Pay accepted.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 30px; background: #fcfbf9; border-top: 1px solid ${brand.border}; text-align: center; font-size: 12px; color: #7a6a5f;">
            If you have any questions or require assistance with your payment, please simply reply to this email.
            <br/><br/>
            © ${new Date().getFullYear()} Oasis Crete.
          </td>
        </tr>
      </table>
    </div>
  `;

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: EMAIL_FROM,
      to,
      replyTo: REPLY_TO,
      subject,
      html,
    });
    return { sent: true };
  } catch (e) {
    console.error("[email] Payment request error:", e);
    return { sent: false, error: e.message };
  }
}
