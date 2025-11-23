// src/lib/email/mailer.js
import "server-only";
import nodemailer from "nodemailer";

let _transporter = null;

export function getTransporter() {
  if (_transporter) return _transporter;

  const {
    EMAIL_HOST = "smtp.gmail.com",
    EMAIL_PORT = "465",
    EMAIL_SECURE = "true",
    EMAIL_USER,
    EMAIL_PASS,
  } = process.env;

  if (!EMAIL_USER || !EMAIL_PASS) {
    throw new Error(
      "[email] Missing EMAIL_USER/EMAIL_PASS. Configure Gmail SMTP env (use an App Password)."
    );
  }

  _transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: Number(EMAIL_PORT),
    secure: EMAIL_SECURE === "true" || EMAIL_PORT === "465",
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });

  return _transporter;
}

/**
 * Send an email via SMTP.
 * @param {{to:string, subject:string, html?:string, text?:string, from?:string, replyTo?:string, attachments?:Array}} opts
 * @returns {Promise<{ok:true,messageId:string,accepted:string[],rejected:string[],response:string}>}
 */
export async function sendEmail(opts = {}) {
  const { to, subject, html, text, from, replyTo, attachments } = opts;
  if (!to) throw new Error("[email] 'to' is required");
  if (!subject) throw new Error("[email] 'subject' is required");

  const transporter = getTransporter();
  const FROM = from || process.env.EMAIL_FROM || process.env.EMAIL_USER;

  const info = await transporter.sendMail({
    from: FROM,
    to,
    subject,
    // at least one of html/text must be present
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
    ...(replyTo ? { replyTo } : {}),
    ...(attachments ? { attachments } : {}),
  });

  return {
    ok: true,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
  };
}

/** Optional: call once at startup to confirm SMTP works */
export async function verifyEmailTransport() {
  try {
    await getTransporter().verify();
    return true;
  } catch (e) {
    console.error("[email] Transport verify failed:", e);
    return false;
  }
}

// Export default too so both `import { sendEmail }` and `import sendEmail` work
export default sendEmail;
