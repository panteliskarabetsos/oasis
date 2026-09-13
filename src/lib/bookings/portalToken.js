import "server-only";
import crypto from "node:crypto";

/**
 * Proof that someone has already identified themselves as a booking's guest.
 *
 * The guest portal gates its lookup properly — reference plus last name — but
 * the actions that follow took a bare row id and checked nothing. Booking ids
 * are sequential, so anyone able to count could change another guest's meeting
 * point or open a Stripe session against their booking.
 *
 * So the lookup now mints a short-lived token bound to the booking it just
 * proved, and those actions require it. Nothing is stored: the token carries
 * its own booking id and expiry, and an HMAC over both.
 */

/** Long enough to browse, pay and come back; short enough to be worth little. */
const TTL_SECONDS = 60 * 60;

const PREFIX = "bp1"; // versioned, so the format can change later

function secret() {
  const value =
    process.env.BOOKING_PORTAL_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("No secret available to sign portal tokens");
  return value;
}

function sign(bookingId, exp) {
  return crypto
    .createHmac("sha256", secret())
    .update(`${PREFIX}:${bookingId}:${exp}`)
    .digest("base64url");
}

/** @returns {string} a token for this booking, or "" if signing is impossible. */
export function issuePortalToken(bookingId) {
  const id = Number(bookingId);
  if (!Number.isFinite(id) || id <= 0) return "";
  try {
    const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
    return `${PREFIX}.${id}.${exp}.${sign(id, exp)}`;
  } catch {
    return "";
  }
}

/**
 * @returns {{ok:true} | {ok:false, reason:"missing"|"malformed"|"expired"|"mismatch"|"invalid"}}
 */
export function verifyPortalToken(token, bookingId) {
  const raw = String(token || "").trim();
  if (!raw) return { ok: false, reason: "missing" };

  const parts = raw.split(".");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    return { ok: false, reason: "malformed" };
  }

  const [, idPart, expPart, mac] = parts;
  const id = Number(idPart);
  const exp = Number(expPart);
  if (!Number.isFinite(id) || !Number.isFinite(exp)) {
    return { ok: false, reason: "malformed" };
  }

  // Bound to one booking: a token for #12 must not act on #13.
  if (id !== Number(bookingId)) return { ok: false, reason: "mismatch" };

  // Signature before expiry, so a forged token is never merely "expired".
  let expected;
  try {
    expected = sign(id, exp);
  } catch {
    return { ok: false, reason: "invalid" };
  }

  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "invalid" };
  }

  if (exp < Math.floor(Date.now() / 1000)) return { ok: false, reason: "expired" };

  return { ok: true };
}

/** The token on a request: header first, then the JSON body. */
export function portalTokenFrom(req, body = null) {
  return (
    req?.headers?.get?.("x-booking-token") ||
    (body && typeof body.token === "string" ? body.token : "") ||
    ""
  );
}

/** One message for every rejection, so a probe learns nothing from the wording. */
export const PORTAL_DENIED =
  "This booking session has expired. Please look up your booking again.";
