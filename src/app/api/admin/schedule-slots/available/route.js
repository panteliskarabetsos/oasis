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
  // Match the pattern you used elsewhere: requireAdmin returns { ok, response?, admin }
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const { searchParams } = new URL(req.url);
  const experienceId = Number(searchParams.get("experienceId"));
  const day = (searchParams.get("date") || "").trim();

  if (!Number.isFinite(experienceId)) return bad("Invalid experienceId");
  if (!day) return bad("date is required (YYYY-MM-DD)");

  const fromNaive = toNaiveStart(day);
  const toNaive = toNaiveStartNextDay(day);

  // Get slots for that day
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

  // Sum booked seats per slot (confirmed only)
  const slotIds = slots.map((s) => s.id);
  const { data: bookings, error: bookErr } = await admin
    .from("Booking")
    .select("scheduleSlotId, numberOfPeople, status")
    .in("scheduleSlotId", slotIds)
    .in("status", ["confirmed"]);

  if (bookErr) return bad(bookErr.message, 500);

  const usedBySlot = new Map();
  for (const b of bookings || []) {
    const n = Number(b.numberOfPeople) || 0;
    usedBySlot.set(
      b.scheduleSlotId,
      (usedBySlot.get(b.scheduleSlotId) || 0) + n
    );
  }

  // Normalize for your UI
  const items = slots.map((s) => ({
    id: s.id,
    startsAt: s.date, // no end time in schema
    endsAt: null,
    capacity: Number(s.totalSlots) || 0,
    booked: usedBySlot.get(s.id) || 0,
  }));

  return ok({ items });
}
