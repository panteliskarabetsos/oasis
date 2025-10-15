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
    // 1) Load slots for the experience (ordered)
    const { data: slots, error: slotErr } = await admin
      .from("ScheduleSlot")
      .select("id, date, totalSlots, isCancelled")
      .eq("experienceId", experienceId)
      .order("date", { ascending: true });

    if (slotErr) {
      console.error("[public/schedule] slots error:", slotErr);
      return bad("Server error", 500);
    }
    if (!slots?.length) return ok([]);

    const slotIds = slots.map((s) => s.id);

    // 2) Booked seats from Booking (all rows are confirmed/paid)
    const { data: bookings, error: bookErr } = await admin
      .from("Booking")
      .select("scheduleSlotId, numberOfPeople, adultsCount, kidsCount, counts")
      .in("scheduleSlotId", slotIds);

    if (bookErr) {
      console.error("[public/schedule] bookings error:", bookErr);
      return bad("Server error", 500);
    }

    const bookedMap = new Map(); // slotId -> seats
    for (const b of bookings || []) {
      const nDirect = Number(b?.numberOfPeople);
      const nAdults = Number(b?.adultsCount);
      const nKids = Number(b?.kidsCount);
      const cAdults = Number(b?.counts?.adults ?? 0);
      const cKids = Number(b?.counts?.kids ?? 0);

      let seats = 0;
      if (Number.isFinite(nDirect) && nDirect > 0) {
        seats = nDirect;
      } else if (
        (Number.isFinite(nAdults) && nAdults >= 0) ||
        (Number.isFinite(nKids) && nKids >= 0)
      ) {
        seats = (nAdults || 0) + (nKids || 0);
      } else {
        seats = (cAdults || 0) + (cKids || 0);
      }

      const sid = b.scheduleSlotId;
      bookedMap.set(sid, (bookedMap.get(sid) || 0) + (seats || 0));
    }

    // 3) Active holds from BookingDraft (unexpired)
    const { data: drafts, error: draftErr } = await admin
      .from("BookingDraft")
      .select("scheduleSlotId, counts, expiresAt, status")
      .in("scheduleSlotId", slotIds)
      .in("status", ["draft", "checkout"]);

    if (draftErr) {
      console.error("[public/schedule] drafts error:", draftErr);
      return bad("Server error", 500);
    }

    const nowTs = Date.now();
    const holdsMap = new Map();
    for (const d of drafts || []) {
      const expTs = d.expiresAt ? new Date(d.expiresAt).getTime() : 0;
      if (!Number.isFinite(expTs) || expTs <= nowTs) continue; // ignore null/expired
      const adults = Number(d?.counts?.adults ?? 0) || 0;
      const kids = Number(d?.counts?.kids ?? 0) || 0;
      const held = adults + kids;
      const sid = d.scheduleSlotId;
      holdsMap.set(sid, (holdsMap.get(sid) || 0) + held);
    }

    // 4) Build response per slot
    const out = slots.map((s) => {
      const totalSlots = Number(s.totalSlots || 0);
      const booked = Number(bookedMap.get(s.id) || 0);
      const holds = Number(holdsMap.get(s.id) || 0);
      const available = Math.max(0, totalSlots - booked - holds);

      return {
        id: s.id,
        date: s.date,
        totalSlots,
        booked, // explicit field
        holds, // explicit field
        available, // what users care about
        isCancelled: !!s.isCancelled,

        // backwards compatibility for older UIs:
        bookedSlots: booked,
      };
    });

    return ok(out);
  } catch (e) {
    console.error("[public/schedule] exception:", e);
    return bad("Server error", 500);
  }
}
