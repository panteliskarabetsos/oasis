// src/lib/email/send.js
import "server-only";
import nodemailer from "nodemailer";

/**
 * sendEmail({
 *   to: "user@example.com",
 *   subject: "Hello",
 *   html: "<p>Hi</p>",
 *   text: "Hi",                 // optional
 *   from: "Oasis <no-reply@oasis.example>", // optional
 *   attachments: [              // optional
 *     { filename: "invoice.pdf", content: Buffer, contentType: "application/pdf" }
 *   ]
 * })
 */
export async function sendEmail(opts = {}) {
  const {
    to,
    subject = "",
    html = "",
    text,
    from = process.env.EMAIL_FROM || "Oasis <no-reply@oasis.example>",
    attachments = [],
  } = opts;

  if (!to) throw new Error("sendEmail: 'to' is required");

  // Build transporter from env
  // Works on runtime: "nodejs" (NOT edge)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "localhost",
    port: Number(process.env.SMTP_PORT || 587),
    secure:
      String(process.env.SMTP_SECURE || "").toLowerCase() === "true" ||
      Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" }
      : undefined,
  });

  // Verify connection in dev (non-fatal)
  try {
    await transporter.verify();
  } catch {}

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html,
    text:
      text ||
      html
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    attachments,
  });

  return { messageId: info.messageId };
}

export default sendEmail;
