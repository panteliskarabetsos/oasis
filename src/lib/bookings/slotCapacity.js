import "server-only";

/**
 * How many places are left on a schedule slot.
 *
 * Two things consume a slot: bookings that have been paid for, and holds —
 * unexpired drafts sitting in someone's checkout. Every route that grants or
 * renews a hold has to agree on what counts, or one of them will hand out a
 * seat another has already promised. This is that definition, in one place.
 */

/** Booking statuses that occupy a place. Mirrors the public availability API. */
export const COUNT_STATUSES = Object.freeze(
  new Set(["paid", "approved", "confirmed", "completed", "checked_in"]),
);

/** The default life of a hold, and the longest one can ever be stretched to. */
export const HOLD_MINUTES = 15;
// Half an hour from when the draft was created. Renewals top the hold back up
// to HOLD_MINUTES until this is reached, so a checkout can run a little long
// without a seat being held all afternoon.
export const MAX_HOLD_MINUTES = 30;

/**
 * Read a timestamp as the database means it.
 *
 * Some columns come back with an offset ("...+00:00") and some without
 * ("2026-09-15T11:36:50.134474"), because they are `timestamp` rather than
 * `timestamptz`. Date.parse reads the bare form as *local* time, which on a
 * server set to Athens shifts it three hours earlier — enough to put a
 * one-hour ceiling in the past and make every hold look already maxed out.
 * Bare values are UTC, so they are told so.
 */
export function parseDbTime(value) {
  if (!value) return NaN;
  const s = String(value).trim();
  const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(s);
  return Date.parse(hasZone ? s : `${s}Z`);
}

const toInt = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : d;
};

export function draftPartySize(draft) {
  return toInt(draft?.counts?.adults, 0) + toInt(draft?.counts?.kids, 0);
}

/**
 * Is this draft still holding places?
 *
 * A draft that has been paid for but not yet turned into a booking still
 * holds, expiry or not — the money is in and the row is mid-conversion.
 */
export function isActiveHold(draft, nowMs = Date.now()) {
  if (!draft) return false;
  if (draft.status === "paid" && !draft.convertedBookingId) return true;
  if (draft.status === "paid") return false;

  const expMs = parseDbTime(draft.expiresAt);
  // An unparseable expiry is treated as still held rather than free: handing
  // out a seat on a row we cannot read is the worse of the two mistakes.
  return !Number.isFinite(expMs) || expMs > nowMs;
}

/** Places held by the given drafts, optionally ignoring one of them. */
export function activeHoldSize(drafts, excludeId = null, nowMs = Date.now()) {
  return (drafts || []).reduce((sum, d) => {
    if (excludeId != null && d.id === excludeId) return sum;
    return isActiveHold(d, nowMs) ? sum + draftPartySize(d) : sum;
  }, 0);
}

/**
 * Places left on a slot, counting paid bookings and everyone else's holds.
 *
 * @returns {Promise<{ok:true,total:number,booked:number,held:number,remaining:number}
 *                 | {ok:false,error:string}>}
 */
export async function remainingForSlot(
  admin,
  scheduleSlotId,
  { excludeDraftId = null, nowMs = Date.now() } = {},
) {
  const { data: slot, error: slotErr } = await admin
    .from("ScheduleSlot")
    .select("id, totalSlots, isCancelled")
    .eq("id", scheduleSlotId)
    .maybeSingle();
  if (slotErr || !slot) return { ok: false, error: "Slot not found" };
  if (slot.isCancelled) return { ok: false, error: "This time was cancelled" };

  const [{ data: bookings, error: bookErr }, { data: holds, error: holdsErr }] =
    await Promise.all([
      admin
        .from("booking")
        .select("numberOfPeople, status")
        .eq("scheduleSlotId", scheduleSlotId),
      admin
        .from("BookingDraft")
        .select('id, counts, status, "expiresAt", "convertedBookingId"')
        .eq("scheduleSlotId", scheduleSlotId),
    ]);
  if (bookErr || holdsErr) return { ok: false, error: "Server error" };

  const booked = (bookings || []).reduce((sum, b) => {
    if (!COUNT_STATUSES.has(String(b.status || "").toLowerCase())) return sum;
    return sum + toInt(b.numberOfPeople, 0);
  }, 0);

  const held = activeHoldSize(holds, excludeDraftId, nowMs);
  const total = toInt(slot.totalSlots, 0);

  return { ok: true, total, booked, held, remaining: total - booked - held };
}
