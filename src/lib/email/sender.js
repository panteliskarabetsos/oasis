import nodemailer from "nodemailer";

export function createTransport() {
  // Accept either SMTP_* or EMAIL_*; prefer SMTP_* if present
  const user = process.env.SMTP_USER || process.env.EMAIL_USER || "";
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS || "";

  // If a host is explicitly provided, use it. Otherwise auto-pick Gmail when email ends with @gmail.com
  let host = process.env.SMTP_HOST || "";
  if (!host && /@gmail\.com$/i.test(user)) host = "smtp.gmail.com";

  const port = Number(
    process.env.SMTP_PORT || (host === "smtp.gmail.com" ? 465 : 587)
  );

  // default secure=true for Gmail 465; else STARTTLS on 587
  const secure =
    String(
      process.env.SMTP_SECURE ??
        (host === "smtp.gmail.com" && port === 465 ? "true" : "false")
    ) === "true";

  if (!user || !pass) {
    throw new Error(
      "Email credentials not configured (set EMAIL_USER/EMAIL_PASS or SMTP_USER/SMTP_PASS)."
    );
  }
  if (!host) {
    throw new Error(
      "SMTP host not configured (set SMTP_HOST or use a @gmail.com user to auto-configure)."
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure, // true -> TLS (465), false -> STARTTLS (587)
    auth: { user, pass },
  });
}
