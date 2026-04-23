// src/app/api/admin/schedule-slots/available/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

// Your ScheduleSlot.date is "timestamp without time zone", so compare with naive strings
function toNaiveStart(ymd) {
  return `${ymd} 00:00:00`;
}
function toNaiveStartNextDay(ymd) {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day} 00:00:00`;
}

export async function GET(req) {
  // Support both patterns of requireAdmin responses just to be safe
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  if (auth && !auth.ok && auth.response) return auth.response;

  const admin = auth?.admin || auth;

  const { searchParams } = new URL(req.url);
  const experienceId = Number(searchParams.get("experienceId"));
  const day = (searchParams.get("date") || "").trim();

  if (!Number.isFinite(experienceId)) return bad("Invalid experienceId");
  if (!day) return bad("date is required (YYYY-MM-DD)");

  const fromNaive = toNaiveStart(day);
  const toNaive = toNaiveStartNextDay(day);

  // 1. Get slots for that day
  const { data: slots, error: slotsErr } = await admin
    .from("ScheduleSlot")
    .select("id, date, totalSlots, isCancelled")
    .eq("experienceId", experienceId)
    .eq("isCancelled", false)
    .gte("date", fromNaive)
    .lt("date", toNaive)
    .order("date", { ascending: true });

  if (slotsErr) return bad(slotsErr.message, 500);
  if (!slots?.length) return ok({ items: [] });

  const slotIds = slots.map((s) => s.id);
  const usedBySlot = new Map();

  // 2. Sum confirmed bookings (FIX: lowercase 'booking' table)
  const { data: bookings, error: bookErr } = await admin
    .from("booking")
    .select("scheduleSlotId, numberOfPeople, status")
    .in("scheduleSlotId", slotIds)
    .in("status", ["confirmed"]); // Add "pending" here if you want unconfirmed bookings to take up seats

  if (bookErr) return bad(bookErr.message, 500);

  for (const b of bookings || []) {
    const n = Number(b.numberOfPeople) || 0;
    usedBySlot.set(
      b.scheduleSlotId,
      (usedBySlot.get(b.scheduleSlotId) || 0) + n,
    );
  }

  // 3. Sum active holds/drafts (So the slot picker matches the calendar numbers)
  const { data: holds, error: holdsErr } = await admin
    .from("BookingDraft")
    .select("scheduleSlotId, counts, expiresAt, status")
    .in("scheduleSlotId", slotIds)
    .in("status", ["draft", "checkout"]);

  if (holdsErr) return bad(holdsErr.message, 500);

  const now = Date.now();
  for (const h of holds || []) {
    const expTs = h.expiresAt ? new Date(h.expiresAt).getTime() : 0;
    if (!Number.isFinite(expTs) || expTs <= now) continue; // Skip if the draft has expired

    // Schema uses JSONB for counts
    const a = Number(h?.counts?.adults ?? 0) || 0;
    const k = Number(h?.counts?.kids ?? 0) || 0;
    const total = a + k;

    if (total > 0) {
      usedBySlot.set(
        h.scheduleSlotId,
        (usedBySlot.get(h.scheduleSlotId) || 0) + total,
      );
    }
  }

  // 4. Normalize for your UI
  const items = slots.map((s) => ({
    id: s.id,
    startsAt: s.date, // no end time in schema
    endsAt: null,
    capacity: Number(s.totalSlots) || 0,
    booked: usedBySlot.get(s.id) || 0,
  }));

  return ok({ items });
}
