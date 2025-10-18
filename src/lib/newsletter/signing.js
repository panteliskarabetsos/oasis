// src/lib/newsletter/signing.js
import crypto from "crypto";

export function makeUnsubToken(email) {
  const secret = process.env.NEWSLETTER_SIGNING_SECRET || "";
  return crypto
    .createHmac("sha256", secret)
    .update(String(email).toLowerCase())
    .digest("hex");
}
export function verifyUnsubToken(email, token) {
  try {
    return makeUnsubToken(email) === token;
  } catch {
    return false;
  }
}
