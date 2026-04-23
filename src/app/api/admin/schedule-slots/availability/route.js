// src/app/api/admin/schedule-slots/availability/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

// Match your dates. Note: Your schema uses `timestamp with time zone` for ScheduleSlot.date
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
const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const ymdFromNaive = (ts) => String(ts).slice(0, 10); // "YYYY-MM-DD ..." → "YYYY-MM-DD"

export async function GET(req) {
  // Admin guard
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  // Params
  const { searchParams } = new URL(req.url);
  const experienceId = Number(searchParams.get("experienceId"));
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();

  if (!Number.isFinite(experienceId)) {
    console.error("[availability] invalid experienceId", {
      raw: searchParams.get("experienceId"),
    });
    return bad("Invalid experienceId");
  }
  if (!from || !to) {
    console.error("[availability] missing from/to", { from, to });
    return bad("from/to required (YYYY-MM-DD)");
  }
  if (!isYmd(from) || !isYmd(to)) {
    console.error("[availability] bad ymd format", { from, to });
    return bad("from/to must be YYYY-MM-DD");
  }

  // Normalize range (swap if caller accidentally inverted)
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  const start = fromDate <= toDate ? from : to;
  const end = fromDate <= toDate ? to : from;

  const gteDate = toNaiveStart(start);
  const ltDate = toNaiveStartNextDay(end); // half-open range [start, end+1)

  // 1) Slots in window for experience (not cancelled)
  const { data: slots, error: slotsErr } = await admin
    .from("ScheduleSlot")
    .select("id, date, totalSlots, isCancelled")
    .eq("experienceId", experienceId)
    .eq("isCancelled", false)
    .gte("date", gteDate)
    .lt("date", ltDate)
    .order("date", { ascending: true });

  if (slotsErr) return bad(slotsErr.message, 500);
  if (!slots?.length) return ok({ days: [] });

  const slotIds = slots.map((s) => s.id);

  // 2) Confirmed bookings that consume capacity
  // FIX: Changed "Booking" to "booking" to match your PostgreSQL schema exactly.
  const { data: bookings, error: bookErr } = await admin
    .from("booking")
    .select("scheduleSlotId, numberOfPeople, status")
    .in("scheduleSlotId", slotIds)
    .in("status", ["confirmed"]); // add "pending" if pending should block

  if (bookErr) return bad(bookErr.message, 500);

  const bookedBySlot = new Map();
  for (const b of bookings || []) {
    const n = Number(b.numberOfPeople) || 0;
    bookedBySlot.set(
      b.scheduleSlotId,
      (bookedBySlot.get(b.scheduleSlotId) || 0) + n,
    );
  }

  // 3) Active holds (unexpired drafts/checkout)
  const { data: holds, error: holdsErr } = await admin
    .from("BookingDraft")
    .select("scheduleSlotId, counts, expiresAt, status")
    .in("scheduleSlotId", slotIds)
    .in("status", ["draft", "checkout"]);

  if (holdsErr) return bad(holdsErr.message, 500);

  const now = Date.now();
  const heldBySlot = new Map();
  for (const h of holds || []) {
    const expTs = h.expiresAt ? new Date(h.expiresAt).getTime() : 0;
    if (!Number.isFinite(expTs) || expTs <= now) continue; // expired or null

    // Schema defines counts as JSONB, so accessing .adults and .kids is correct
    const a = Number(h?.counts?.adults ?? 0) || 0;
    const k = Number(h?.counts?.kids ?? 0) || 0;
    const total = a + k;

    if (total > 0) {
      heldBySlot.set(
        h.scheduleSlotId,
        (heldBySlot.get(h.scheduleSlotId) || 0) + total,
      );
    }
  }

  // 4) Aggregate per day
  const byDay = new Map(); // ymd -> { date, slots, booked, capacity }
  for (const s of slots) {
    const key = ymdFromNaive(s.date); // first 10 chars of naive ts
    const capacity = Number(s.totalSlots) || 0;
    const booked = (bookedBySlot.get(s.id) || 0) + (heldBySlot.get(s.id) || 0);

    const prev = byDay.get(key) || {
      date: key,
      slots: 0,
      booked: 0,
      capacity: 0,
    };
    prev.slots += 1;
    prev.booked += booked;
    prev.capacity += capacity;
    byDay.set(key, prev);
  }

  // 5) Return ordered days
  const days = Array.from(byDay.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  return ok({ days });
}
