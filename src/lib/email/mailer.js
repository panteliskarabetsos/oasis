// src/lib/email/mailer.js
import "server-only";
import nodemailer from "nodemailer";

/**
 * One place every outgoing email goes through.
 *
 * Mail used to leave over Gmail SMTP, which meant confirmations for
 * info@youroasis.gr were signed by gmail.com — no DKIM alignment with the
 * domain they claimed to come from — and subject to Gmail's per-account daily
 * send cap. Resend sends over HTTPS from a domain you control, which suits a
 * serverless host better than holding an SMTP socket open.
 *
 * SMTP is kept as a fallback rather than deleted: if Resend refuses a send —
 * most likely because the From domain is not verified yet — the message still
 * goes out the old way instead of being lost. Every send says which transport
 * carried it, so a silent switch to the fallback is visible in the logs.
 *
 * EMAIL_TRANSPORT=resend|smtp|auto (default auto) forces one or the other.
 */

let _transporter = null;

export function getSmtpTransporter() {
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
      "[email] Missing EMAIL_USER/EMAIL_PASS. Configure SMTP env (Gmail needs an App Password).",
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

const asArray = (v) =>
  (Array.isArray(v) ? v : String(v ?? "").split(","))
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);

/**
 * Nodemailer attachments carry a Buffer or a string; Resend wants base64.
 * The .ics invite arrives as a string, the ticket and invoice as Buffers.
 */
function toResendAttachments(attachments) {
  return (attachments || [])
    .filter((a) => a && a.filename && a.content != null)
    .map((a) => ({
      filename: a.filename,
      content: Buffer.isBuffer(a.content)
        ? a.content.toString("base64")
        : Buffer.from(String(a.content), "utf8").toString("base64"),
      ...(a.contentType ? { contentType: a.contentType } : {}),
    }));
}

async function sendViaResend(message) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "no-resend-key" };

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  // Resend only accepts a From on a domain verified in that account. When a
  // caller has not set one explicitly, RESEND_FROM is the address known to be
  // verified — a better guess than EMAIL_USER, which is a gmail.com address
  // Resend would always refuse.
  const from =
    message.from || process.env.RESEND_FROM || process.env.EMAIL_FROM;

  const res = await resend.emails.send({
    from,
    to: asArray(message.to),
    ...(message.bcc ? { bcc: asArray(message.bcc) } : {}),
    ...(message.replyTo ? { replyTo: asArray(message.replyTo)[0] } : {}),
    subject: message.subject,
    ...(message.html ? { html: message.html } : {}),
    ...(message.text ? { text: message.text } : {}),
    ...(message.headers ? { headers: message.headers } : {}),
    ...(message.attachments?.length
      ? { attachments: toResendAttachments(message.attachments) }
      : {}),
  });

  // The SDK reports API failures on `error` rather than throwing.
  if (res?.error) {
    return {
      ok: false,
      error: res.error.message || String(res.error.name || "resend-error"),
    };
  }
  return { ok: true, id: res?.data?.id || null };
}

async function sendViaSmtp(message) {
  const info = await getSmtpTransporter().sendMail(message);
  return { ok: true, id: info?.messageId || null, info };
}

/**
 * Deliver one message, preferring Resend.
 *
 * @returns {Promise<{ok:boolean, transport:"resend"|"smtp"|null, id:string|null,
 *                    error?:string, info?:object}>}
 */
export async function deliver(message) {
  const mode = String(process.env.EMAIL_TRANSPORT || "auto").toLowerCase();

  if (mode !== "smtp") {
    try {
      const r = await sendViaResend(message);
      if (r.ok) return { ok: true, transport: "resend", id: r.id };
      if (mode === "resend") {
        console.error("[email] Resend refused the send:", r.error);
        return { ok: false, transport: null, id: null, error: r.error };
      }
      // Most often an unverified From domain. Say so loudly, then fall back
      // so the guest still gets their email.
      console.error(
        `[email] Resend refused the send (${r.error}); falling back to SMTP. ` +
          `Verify the From domain in Resend to stop this.`,
      );
    } catch (e) {
      const msg = e?.message || String(e);
      if (mode === "resend") {
        console.error("[email] Resend threw:", msg);
        return { ok: false, transport: null, id: null, error: msg };
      }
      console.error(`[email] Resend threw (${msg}); falling back to SMTP.`);
    }
  }

  try {
    const r = await sendViaSmtp(message);
    return { ok: true, transport: "smtp", id: r.id, info: r.info };
  } catch (e) {
    const msg = e?.message || String(e);
    console.error("[email] SMTP send failed:", msg);
    return { ok: false, transport: null, id: null, error: msg };
  }
}

/**
 * Back-compat shim.
 *
 * Six senders already call `getTransporter().sendMail(...)`. Handing them an
 * object with the same shape moves all of them onto Resend without touching
 * a line in any of them.
 */
export function getTransporter() {
  return {
    sendMail: async (message) => {
      const r = await deliver(message);
      if (!r.ok) throw new Error(r.error || "send-failed");
      return { messageId: r.id, transport: r.transport, ...(r.info || {}) };
    },
    verify: async () => {
      await getSmtpTransporter().verify();
      return true;
    },
  };
}

/**
 * Send an email.
 * @param {{to:string, subject:string, html?:string, text?:string, from?:string, replyTo?:string, attachments?:Array}} opts
 */
export async function sendEmail(opts = {}) {
  const { to, subject, html, text, from, replyTo, attachments } = opts;
  if (!to) throw new Error("[email] 'to' is required");
  if (!subject) throw new Error("[email] 'subject' is required");

  const FROM = from || process.env.EMAIL_FROM || process.env.EMAIL_USER;

  const r = await deliver({
    from: FROM,
    to,
    subject,
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
    ...(replyTo ? { replyTo } : {}),
    ...(attachments ? { attachments } : {}),
  });

  if (!r.ok) throw new Error(r.error || "send-failed");

  return {
    ok: true,
    messageId: r.id,
    transport: r.transport,
    accepted: r.info?.accepted ?? asArray(to),
    rejected: r.info?.rejected ?? [],
    response: r.info?.response ?? `sent via ${r.transport}`,
  };
}

/** Confirm the SMTP fallback still works. */
export async function verifyEmailTransport() {
  try {
    await getSmtpTransporter().verify();
    return true;
  } catch (e) {
    console.error("[email] SMTP verify failed:", e);
    return false;
  }
}

export default sendEmail;
