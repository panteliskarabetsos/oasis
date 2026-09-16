import "server-only";
import { sendEmail } from "@/lib/email/mailer";

/**
 * Ask someone to pay for a gift card they are buying.
 *
 * The admin form could only take a payment at the desk — it sent the admin
 * themselves to Stripe. This is the other half: the buyer gets the link and
 * pays in their own time, and the card is issued by the Stripe webhook when
 * they do.
 *
 * Deliberately not the gift card itself. Nothing exists yet at this point;
 * sending anything that looks like a card before the money arrives would be
 * handing out value on trust.
 */
export async function sendGiftcardPaymentLink({
  to,
  url,
  amountCents,
  currency = "EUR",
  recipientName = "",
  message = "",
  expiresAt = null,
}) {
  const appName = process.env.APP_NAME || "Oasis";
  const siteUrl = process.env.APP_URL || "https://youroasis.gr";
  const support =
    process.env.APP_SUPPORT_EMAIL || process.env.EMAIL_FROM || "";

  const amount = money(amountCents, currency);
  const greeting = recipientName ? `Hello ${escapeHtml(recipientName)},` : "Hello,";
  const subject = `Your ${appName} gift card — ${amount} to pay`;

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2a211a">
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px">${greeting}</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 20px">
      Here is the payment link for your ${escapeHtml(appName)} gift card of
      <strong>${amount}</strong>.
    </p>
    ${
      message
        ? `<p style="font-size:14px;line-height:1.6;margin:0 0 20px;padding:12px 16px;background:#faf6ef;border-radius:12px">${escapeHtml(message)}</p>`
        : ""
    }
    <p style="margin:0 0 24px">
      <a href="${escapeAttr(url)}"
         style="display:inline-block;background:#8b6f47;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600;font-size:14px">
        Pay ${amount}
      </a>
    </p>
    <p style="font-size:13px;line-height:1.6;color:#7a6a5f;margin:0 0 8px">
      The gift card is sent to this address as soon as the payment goes
      through${expiresAt ? `, and is valid until ${escapeHtml(fmtDate(expiresAt))}` : ""}.
    </p>
    <p style="font-size:12px;line-height:1.6;color:#a7988a;margin:24px 0 0">
      If the button does not work, paste this into your browser:<br />
      <span style="word-break:break-all">${escapeHtml(url)}</span>
    </p>
    ${
      support
        ? `<p style="font-size:12px;color:#a7988a;margin:16px 0 0">Questions? ${escapeHtml(support)}</p>`
        : ""
    }
    <p style="font-size:12px;color:#a7988a;margin:16px 0 0">${escapeHtml(siteUrl)}</p>
  </div>`;

  const text = [
    greeting,
    "",
    `Here is the payment link for your ${appName} gift card of ${amount}.`,
    message ? `\n${message}\n` : "",
    url,
    "",
    `The gift card is sent to this address as soon as the payment goes through${
      expiresAt ? `, and is valid until ${fmtDate(expiresAt)}` : ""
    }.`,
    support ? `\nQuestions? ${support}` : "",
    siteUrl,
  ]
    .filter((l) => l !== "")
    .join("\n");

  return sendEmail({ to, subject, html, text, from: process.env.EMAIL_FROM });
}

function money(cents, currency = "EUR") {
  const n = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}
function fmtDate(v) {
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
const escapeHtml = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (s = "") => escapeHtml(s).replace(/"/g, "&quot;");
