// src/app/api/public/schedule/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (data, status = 200) => NextResponse.json(data, { status });
const bad = (msg, status = 400) =>
  NextResponse.json({ error: msg }, { status });

export async function GET(req) {
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const { searchParams } = new URL(req.url);
  const experienceId = Number(searchParams.get("experienceId"));
  if (!Number.isFinite(experienceId) || experienceId <= 0) {
    return bad("Experience ID required", 400);
  }

  try {
    // 1) Load all slots for the experience
    const { data: slots, error: slotErr } = await admin
      .from("ScheduleSlot")
      .select("id, date, totalSlots, isCancelled")
      .eq("experienceId", experienceId)
      .order("date", { ascending: true });

    if (slotErr) {
      console.error("[public/schedule] slots error:", slotErr);
      return bad("Server error", 500);
    }
    if (!slots || slots.length === 0) return ok([]);

    const slotIds = slots.map((s) => s.id);

    // 2) Load bookings for these slots and aggregate booked people
    const { data: bookings, error: bookErr } = await admin
      .from("Booking")
      .select("scheduleSlotId, numberOfPeople, status")
      .in("scheduleSlotId", slotIds);

    if (bookErr) {
      console.error("[public/schedule] bookings error:", bookErr);
      return bad("Server error", 500);
    }

    // Count only "confirmed-like" statuses (case-insensitive)
    const COUNT_STATUSES = new Set(["confirmed", "completed", "checked_in"]);
    const bookedMap = new Map(); // slotId -> total people
    for (const b of bookings || []) {
      const status = String(b.status || "").toLowerCase();
      if (!COUNT_STATUSES.has(status)) continue;
      const k = b.scheduleSlotId;
      const n = Number(b.numberOfPeople || 0);
      bookedMap.set(k, (bookedMap.get(k) || 0) + (Number.isFinite(n) ? n : 0));
    }

    // 3) Build response per slot
    const out = slots.map((s) => {
      const totalSlots = Number(s.totalSlots || 0);
      const booked = Number(bookedMap.get(s.id) || 0);
      const available = Math.max(0, totalSlots - booked);

      return {
        id: s.id,
        date: s.date,
        totalSlots,
        // kept for compatibility with any existing UI expecting this name:
        bookedSlots: booked, // derived from reservations
        available,
        isCancelled: !!s.isCancelled,
      };
    });

    return ok(out);
  } catch (e) {
    console.error("[public/schedule] exception:", e);
    return bad("Server error", 500);
  }
}
