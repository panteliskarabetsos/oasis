// Where the guest is actually told to turn up.
//
// Bookings and drafts store this as JSON — name, time, map pin, instructions —
// but older rows carry a plain string, and every surface that shows it was
// re-deriving the same shape slightly differently. The ticket PDF, the
// confirmation screen and the bookings pages all read it through here so they
// cannot drift apart about what a meeting point is.

/**
 * @returns {{name:string,time:string,instructions:string,address:string,mapPin:string}|null}
 */
export function normalizeMeetingPoint(raw) {
  if (!raw) return null;

  if (typeof raw === "string") {
    const t = raw.trim();
    return t
      ? { name: t, time: "", instructions: "", address: "", mapPin: "" }
      : null;
  }
  if (typeof raw !== "object") return null;

  const str = (v) => String(v ?? "").trim();
  const mp = {
    name: str(raw.name),
    time: str(raw.time),
    instructions: str(raw.instructions),
    address: str(raw.address),
    // Stored as "35.512950, 23.967630". Useless to read, but it is the only
    // thing that drops a pin on the exact spot rather than the village.
    mapPin: str(raw.mapPin),
  };

  if (!mp.name && !mp.address && !mp.instructions && !mp.mapPin) return null;
  return mp;
}

/** True when the pin is a usable "lat, lng" pair. */
export function hasCoordinates(mapPin) {
  return /^\s*-?\d{1,3}(\.\d+)?\s*,\s*-?\d{1,3}(\.\d+)?\s*$/.test(
    String(mapPin || ""),
  );
}

/**
 * A Google Maps link for the meeting point.
 *
 * The coordinates win when there are any: "Agora Chania" drops a pin on a
 * market that covers a block, while the stored pin is the corner the guide is
 * standing on. Falls back to the place name, then to the experience's town, so
 * the link is never dead.
 */
export function meetingPointMapHref(meetingPoint, fallbackLocation = "") {
  const mp = normalizeMeetingPoint(meetingPoint);
  const query =
    (mp && hasCoordinates(mp.mapPin) && mp.mapPin.replace(/\s+/g, "")) ||
    (mp && [mp.name, mp.address].filter(Boolean).join(", ")) ||
    String(fallbackLocation || "").trim();

  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** "Agora Chania · Meet at 08:45AM" — a single line for tight spaces. */
export function meetingPointSummary(meetingPoint) {
  const mp = normalizeMeetingPoint(meetingPoint);
  if (!mp) return "";
  return [mp.name || mp.address, mp.time ? `Meet at ${mp.time}` : ""]
    .filter(Boolean)
    .join(" · ");
}
