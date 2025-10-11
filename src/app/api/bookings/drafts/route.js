export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../../lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function POST(req) {
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const body = await req.json().catch(() => ({}));
  const experienceId = Number(body?.experienceId);
  const scheduleSlotId = Number(body?.scheduleSlotId);
  const counts = body?.counts || {};
  const A = toInt(counts.adults, 0);
  const T = toInt(counts.teens, 0);
  const K = toInt(counts.kids, 0);
  const total = A + T + K;
  const clientToken = (body?.clientToken || "").trim() || null;

  if (clientToken) {
    // Try to reuse existing draft for this token (still a draft & not expired)
    const { data: existing } = await admin
      .from("BookingDraft")
      .select("id, expiresAt, status")
      .eq("clientToken", clientToken)
      .eq("status", "draft")
      .maybeSingle();

    if (
      existing &&
      (!existing.expiresAt || new Date(existing.expiresAt) > new Date())
    ) {
      // Update counts/slot and bump expiry instead of inserting
      const newExpiry = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const { error: upErr } = await admin
        .from("BookingDraft")
        .update({
          counts: { adults: A, teens: T, kids: K },
          scheduleSlotId,
          expiresAt: newExpiry,
        })
        .eq("id", existing.id);

      if (upErr) {
        console.error("[drafts] reuse update error", upErr);
        return bad("Could not update draft", 500);
      }
      return ok({ id: existing.id });
    }
  }

  if (!Number.isFinite(experienceId) || experienceId <= 0)
    return bad("experienceId required");
  if (!Number.isFinite(scheduleSlotId) || scheduleSlotId <= 0)
    return bad("scheduleSlotId required");
  if (total <= 0) return bad("At least 1 attendee required");
  if (total > 8) return bad("Maximum 8 people per booking");

  // 1) Fetch experience (for prices + visibility)
  const { data: exp, error: expErr } = await admin
    .from("Experience")
    .select(`id, visibility, "priceAdult", "priceTeen", "priceKid"`)
    .eq("id", experienceId)
    .maybeSingle();

  if (expErr || !exp) return bad("Experience not found", 404);
  if (!exp.visibility) return bad("Experience not public", 403);

  // 2) Fetch slot + ensure it belongs to the experience and is in the future (>1h)
  const { data: slot, error: slotErr } = await admin
    .from("ScheduleSlot")
    .select("id, experienceId, date, totalSlots, bookedSlots, isCancelled")
    .eq("id", scheduleSlotId)
    .maybeSingle();

  if (slotErr || !slot) return bad("Schedule slot not found", 404);
  if (slot.experienceId !== experienceId)
    return bad("Slot does not belong to experience", 400);
  if (slot.isCancelled) return bad("This slot is cancelled", 400);

  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  if (new Date(slot.date) <= oneHourFromNow)
    return bad("Slot no longer available", 400);

  // 3) Capacity check
  const remaining = Math.max(
    0,
    (slot.totalSlots ?? 0) - (slot.bookedSlots ?? 0)
  );
  if (total > remaining)
    return bad(`Only ${remaining} spots left for this time`, 400);

  // 4) Pricing snapshot (authoritative)
  const unitAdult = toNum(exp.priceAdult, 0);
  const unitTeen = isNum(exp.priceTeen) ? Number(exp.priceTeen) : unitAdult;
  const unitKid = isNum(exp.priceKid) ? Number(exp.priceKid) : unitAdult;
  const totalAmount = A * unitAdult + T * unitTeen + K * unitKid;

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min hold

  // 5) Insert draft
  const { data: inserted, error: insErr } = await admin
    .from("BookingDraft")
    .insert({
      experienceId,
      scheduleSlotId,
      counts: { adults: A, teens: T, kids: K },
      status: "draft",
      unitPriceAdult: unitAdult,
      unitPriceTeen: unitTeen,
      unitPriceKid: unitKid,
      totalAmount,
      expiresAt,
      updatedAt: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (insErr || !inserted) {
    console.error("[drafts] insert error:", insErr);
    return bad("Could not create draft", 500);
  }

  return ok({ id: inserted.id });
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
