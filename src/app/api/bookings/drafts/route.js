// src/app/api/bookings/drafts/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../../lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

const HOLD_MINUTES = 10;

// Count these booking statuses towards capacity (align with availability API)
const COUNT_STATUSES = new Set([
  "paid",
  "approved",
  "confirmed",
  "completed",
  "checked_in",
]);

export async function POST(req) {
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const body = await req.json().catch(() => ({}));
  const experienceId = Number(body?.experienceId);
  const scheduleSlotId = Number(body?.scheduleSlotId);
  const counts = body?.counts || {};
  const A = toInt(counts.adults, 0);
  const K = toInt(counts.kids, 0);
  const requestedGroup = A + K;
  const clientToken = (body?.clientToken || "").trim() || null;

  // ---- Time anchors (shared) ----
  const nowMs = Date.now();
  const now = new Date(nowMs);
  const BUFFER_MINUTES = 0; // set to >0 if you want a small guard window

  // Basic validation
  if (!Number.isFinite(experienceId) || experienceId <= 0)
    return bad("experienceId required");
  if (!Number.isFinite(scheduleSlotId) || scheduleSlotId <= 0)
    return bad("scheduleSlotId required");
  if (requestedGroup <= 0) return bad("At least 1 attendee required");
  if (requestedGroup > 8) return bad("Maximum 8 people per booking");

  // 1) Fetch Experience (pricing + visibility)
  const { data: exp, error: expErr } = await admin
    .from("Experience")
    .select(`id, visibility, "priceAdult", "priceKid"`)
    .eq("id", experienceId)
    .maybeSingle();
  if (expErr || !exp) return bad("Experience not found", 404);
  if (!exp.visibility) return bad("Experience not public", 403);

  // 2) Fetch Slot (ensure belongs to exp, not cancelled, and in the future)
  const { data: slot, error: slotErr } = await admin
    .from("ScheduleSlot")
    .select("id, experienceId, date, totalSlots, isCancelled")
    .eq("id", scheduleSlotId)
    .maybeSingle();
  if (slotErr || !slot) return bad("Schedule slot not found", 404);
  if (slot.experienceId !== experienceId)
    return bad("Slot does not belong to experience", 400);
  if (slot.isCancelled) return bad("This slot is cancelled", 400);

  const slotTs = Date.parse(slot.date);
  if (!Number.isFinite(slotTs)) return bad("Invalid slot date", 400);
  if (slotTs <= nowMs + BUFFER_MINUTES * 60 * 1000)
    return bad("Slot no longer available", 400);

  // 3) Aggregate booked seats from real reservations (Booking)
  const { data: bookings, error: bookErr } = await admin
    .from("Booking")
    .select("scheduleSlotId, numberOfPeople, status")
    .eq("scheduleSlotId", scheduleSlotId);
  if (bookErr) {
    console.error("[drafts] bookings select error:", bookErr);
    return bad("Server error", 500);
  }
  const bookedFromReservations = (bookings || []).reduce((sum, b) => {
    const st = String(b.status || "").toLowerCase();
    if (!COUNT_STATUSES.has(st)) return sum;
    const n = Number(b.numberOfPeople || 0);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  // 4) Aggregate active holds from other drafts
  const { data: holds, error: holdsErr } = await admin
    .from("BookingDraft")
    .select('id, counts, status, "expiresAt", "convertedBookingId"')
    .eq("scheduleSlotId", scheduleSlotId);
  if (holdsErr) {
    console.error("[drafts] holds select error:", holdsErr);
    return bad("Server error", 500);
  }

  const activeHoldSize = (list, excludeId = null) =>
    (list || []).reduce((sum, d) => {
      if (excludeId && d.id === excludeId) return sum;

      const isPaidUnconverted = d.status === "paid" && !d.convertedBookingId;

      const expMs = d.expiresAt ? Date.parse(d.expiresAt) : NaN;
      const notExpired = !Number.isFinite(expMs) || expMs > nowMs;

      const isActive = isPaidUnconverted || (d.status !== "paid" && notExpired);

      if (!isActive) return sum;
      const a = toInt(d?.counts?.adults, 0);
      const k = toInt(d?.counts?.kids, 0);
      return sum + a + k;
    }, 0);

  // 5) Optional: clientToken reuse (capacity-safe)
  if (clientToken) {
    const { data: existing } = await admin
      .from("BookingDraft")
      .select("id, counts, expiresAt, status, scheduleSlotId")
      .eq("clientToken", clientToken)
      .eq("status", "draft")
      .maybeSingle();

    const existingExpMs = existing?.expiresAt
      ? Date.parse(existing.expiresAt)
      : NaN;

    if (
      existing &&
      (!Number.isFinite(existingExpMs) || existingExpMs > nowMs)
    ) {
      // Capacity check excluding this draft's current hold
      const holdsExcludingSelf = activeHoldSize(holds, existing.id);
      const remaining =
        Number(slot.totalSlots || 0) -
        bookedFromReservations -
        holdsExcludingSelf;

      if (requestedGroup > remaining) {
        return bad(
          `Only ${Math.max(remaining, 0)} spots left for this time`,
          400
        );
      }

      // Update counts/slot and bump expiry
      const newExpiry = new Date(
        nowMs + HOLD_MINUTES * 60 * 1000
      ).toISOString();

      const { error: upErr } = await admin
        .from("BookingDraft")
        .update({
          counts: { adults: A, kids: K },
          scheduleSlotId,
          expiresAt: newExpiry,
          updatedAt: new Date(nowMs).toISOString(),
        })
        .eq("id", existing.id);

      if (upErr) {
        console.error("[drafts] reuse update error", upErr);
        return bad("Could not update draft", 500);
      }
      return ok({ id: existing.id, expiresAt: newExpiry });
    }
  }

  // 6) Capacity check for a new draft (subtract other active holds)
  const lockedPending = activeHoldSize(holds, null);
  const remaining =
    Number(slot.totalSlots || 0) - bookedFromReservations - lockedPending;

  if (requestedGroup > remaining) {
    return bad(`Only ${Math.max(remaining, 0)} spots left for this time`, 400);
  }

  // 7) Pricing snapshot
  const unitAdult = toNum(exp.priceAdult, 0);
  const unitKid = isNum(exp.priceKid) ? Number(exp.priceKid) : unitAdult;
  const totalAmount = A * unitAdult + K * unitKid;

  // 8) Insert draft
  const expiresAt = new Date(nowMs + HOLD_MINUTES * 60 * 1000).toISOString();

  const insertPayload = {
    experienceId,
    scheduleSlotId,
    counts: { adults: A, kids: K },
    status: "draft",
    unitPriceAdult: unitAdult,
    unitPriceKid: unitKid,
    totalAmount,
    expiresAt,
    updatedAt: new Date(nowMs).toISOString(),
    ...(clientToken ? { clientToken } : {}),
  };

  let inserted;
  try {
    const ins = await admin
      .from("BookingDraft")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();
    inserted = ins?.data || null;
    if (!inserted) throw ins?.error || new Error("Insert failed");
  } catch (e) {
    // Handle unique active token race (partial unique index)
    if (String(e?.code) === "23505" && clientToken) {
      const { data: existing } = await admin
        .from("BookingDraft")
        .select("id, expiresAt, status")
        .eq("clientToken", clientToken)
        .eq("status", "draft")
        .maybeSingle();
      if (existing) {
        return ok({
          id: existing.id,
          reused: true,
          expiresAt: existing.expiresAt || null,
        });
      }
    }
    console.error("[drafts] insert error:", e);
    return bad("Could not create draft", 500);
  }

  return ok({
    id: inserted.id,
    expiresAt,
    remaining: remaining - requestedGroup,
  });
}

/* helpers */
function toInt(n, d = 0) {
  n = Number(n);
  return Number.isInteger(n) ? n : d;
}
function isNum(x) {
  const n = Number(x);
  return Number.isFinite(n);
}
function toNum(x, d = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}
