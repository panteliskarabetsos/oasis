import { createHmac } from "crypto";

const SECRET = process.env.NEWSLETTER_UNSUB_SECRET;

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function signUnsub(email, exp = null) {
  if (!SECRET) throw new Error("NEWSLETTER_UNSUB_SECRET not set");
  const canonical = String(email).trim().toLowerCase();
  const payload = exp ? `${canonical}|${exp}` : canonical;
  const sig = createHmac("sha256", SECRET).update(payload).digest();
  return b64url(sig);
}

/** Build link for each recipient (call this where you render the email) */
export function buildUnsubLink(email, origin, ttlDays = 0) {
  const canonical = String(email).trim().toLowerCase();
  const base = origin || process.env.NEXT_PUBLIC_SITE_URL || "";
  const exp = ttlDays ? Math.floor(Date.now() / 1000) + ttlDays * 86400 : null;
  const sig = signUnsub(canonical, exp);
  const params = new URLSearchParams({ email: canonical, sig });
  if (exp) params.set("exp", String(exp));
  const href = `${
    base ? base : ""
  }/api/newsletter/unsubscribe?${params.toString()}`;
  return href.replace(/\/\//g, "/").replace(":/", "://"); // tidy // if base empty
}
