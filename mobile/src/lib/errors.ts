/**
 * Turning a failed request into something a guest should read.
 *
 * The booking and shop screens were passing the raw error straight into their
 * empty state, so a guest whose session had lapsed was shown the word
 * "Unauthorized". Server messages in this app are often written for people
 * ("That date is no longer available"), so those are kept — only the technical
 * ones are replaced.
 */

const TECHNICAL =
  /^(unauthori[sz]ed|forbidden|not found|bad request|internal server error|request failed|failed to fetch|network request failed|typeerror|\{)/i;

const BY_STATUS: Record<number, string> = {
  0: "We couldn't reach Oasis. Check your connection and try again.",
  401: "Your session has expired. Please sign in again.",
  403: "This isn't available on your account.",
  404: "We couldn't find that.",
  408: "That took too long. Please try again.",
  429: "A little too fast — give it a moment and try again.",
};

const FALLBACK = "Something went wrong. Please try again.";
const SERVER_SIDE = "Something went wrong on our end. Please try again in a moment.";

/**
 * @param raw     the message thrown by the API layer
 * @param status  HTTP status, when the caller kept hold of it
 */
export function guestMessage(raw?: string | null, status?: number | null): string {
  const text = String(raw ?? "").trim();

  if (typeof status === "number") {
    if (BY_STATUS[status]) return BY_STATUS[status];
    if (status >= 500) return SERVER_SIDE;
  }

  if (!text) return FALLBACK;

  // The API layer already phrases connection failures for guests.
  if (/check your connection/i.test(text)) return text;

  if (TECHNICAL.test(text)) {
    if (/unauthori[sz]ed/i.test(text)) return BY_STATUS[401];
    if (/forbidden/i.test(text)) return BY_STATUS[403];
    if (/not found/i.test(text)) return BY_STATUS[404];
    if (/internal server error|request failed \(5/i.test(text)) return SERVER_SIDE;
    if (/failed to fetch|network request failed/i.test(text)) return BY_STATUS[0];
    return FALLBACK;
  }

  // Anything else was written for a person; leave it alone.
  return text;
}
