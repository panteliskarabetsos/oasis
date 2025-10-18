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
      "[email] Missing EMAIL_USER/EMAIL_PASS. Configure Gmail SMTP env."
    );
  }

  _transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: Number(EMAIL_PORT),
    secure: EMAIL_SECURE === "true" || EMAIL_PORT === "465",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  return _transporter;
}
