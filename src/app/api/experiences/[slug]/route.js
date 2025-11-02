// src/app/api/experiences/[slug]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (data, status = 200) => NextResponse.json(data, { status });
const bad = (msg, status = 400) =>
  NextResponse.json({ error: msg }, { status });

// Only these statuses "occupy" a seat in a slot.
// Tweak this list if your workflow needs it.
const COUNT_STATUSES = [
  "paid",
  "confirmed",
  "completed",
  "checked_in",
  "approved",
];

export async function GET(_req, ctx) {
  const { slug } = await ctx.params;
  if (!slug) return bad("Missing slug", 400);

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  try {
    // 1) Load the experience record
    const { data: exp, error } = await admin
      .from("Experience")
      .select(
        `
        id,
        name,
        slug,
        description,
        location,
        duration,
        "whatsIncluded",
        "whatToBring",
        "whyYoullLove",
        images,
        "mapPin",
        "guestReviews",
        frequency,
        visibility,
        "createdAt",
        "updatedAt",
        "priceAdult",
        "priceKid"
      `
      )
      .eq("slug", slug)
      .eq("visibility", true)
      .maybeSingle();

    if (error) {
      console.error("[experiences/:slug] select error:", error);
      return bad("Internal server error", 500);
    }
    if (!exp) return bad("Experience not found", 404);

    const priceAdult = numberOr(exp.priceAdult, 85);
    const priceKid = numberOr(exp.priceKid, priceAdult);
    const pricing = { adult: priceAdult, kid: priceKid };

    // 2) Load upcoming (non-cancelled) slots for this experience
    const nowIso = new Date().toISOString();
    const { data: slots, error: sErr } = await admin
      .from("ScheduleSlot")
      .select("id, date, totalSlots, isCancelled")
      .eq("experienceId", exp.id)
      .eq("isCancelled", false)
      .gte("date", nowIso)
      .order("date", { ascending: true })
      .limit(150); // adjust as needed

    if (sErr) {
      console.error("[experiences/:slug] slots error:", sErr);
      // still return the experience; just no availability
      return ok({ ...exp, pricing, slots: [] });
    }

    if (!slots?.length) {
      return ok({ ...exp, pricing, slots: [] });
    }

    const slotIds = slots.map((s) => s.id);

    // 3) Load bookings ONLY in occupying statuses for those slots
    const { data: occRows, error: bErr } = await admin
      .from("Booking")
      .select("scheduleSlotId, status")
      .in("scheduleSlotId", slotIds)
      .in("status", COUNT_STATUSES);

    if (bErr) {
      console.error("[experiences/:slug] bookings error:", bErr);
      return ok({ ...exp, pricing, slots: annotateSlots(slots, new Map()) });
    }

    // 4) Tally per slot
    const counts = new Map(); // slotId -> count
    for (const row of occRows || []) {
      const key = row.scheduleSlotId;
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    // 5) Attach availability
    const annotated = annotateSlots(slots, counts);

    return ok({ ...exp, pricing, slots: annotated });
  } catch (e) {
    console.error("[experiences/:slug] exception:", e);
    return bad("Internal server error", 500);
  }
}

function annotateSlots(slots, countsMap) {
  return (slots || []).map((s) => {
    const booked = countsMap.get(s.id) || 0;
    const available = Math.max(0, Number(s.totalSlots || 0) - booked);
    return {
      id: s.id,
      date: s.date,
      totalSlots: s.totalSlots,
      booked,
      available,
      isCancelled: !!s.isCancelled,
      isFullyBooked: !s.isCancelled && available <= 0, // reflects cancellations correctly
    };
  });
}

function numberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : Number(fallback) || 0;
}
