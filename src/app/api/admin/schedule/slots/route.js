// src/app/api/admin/schedule/slots/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

// statuses that should count against capacity
const COUNT_STATUSES = new Set([
  "confirmed",
  "completed",
  "checked_in",
  "paid",
]);

async function requireAdmin() {
  const supa = await createSupabaseServer();
  if (!supa)
    return { error: true, response: bad("Server not configured", 500) };

  const { data, error } = await supa.auth.getUser();
  const user = data?.user;
  if (error || !user)
    return { error: true, response: bad("Unauthorized", 401) };

  const admin = createSupabaseAdmin();
  if (!admin)
    return { error: true, response: bad("Server not configured", 500) };

  // authorize via your public.User table
  const { data: profile } = await admin
    .from("User")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single();

  const role =
    profile?.role ||
    user?.app_metadata?.role ||
    user?.user_metadata?.role ||
    "user";
  if (!["admin", "superadmin"].includes(role)) {
    return { error: true, response: bad("Forbidden", 403) };
  }

  return { error: false, admin };
}

export async function GET(req) {
  const auth = await requireAdmin();
  if (auth.error) return auth.response;
  const supa = auth.admin;

  try {
    const { searchParams } = new URL(req.url);
    const expId = Number(searchParams.get("experienceId")) || null;
    const from = (searchParams.get("from") || "").trim(); // YYYY-MM-DD
    const to = (searchParams.get("to") || "").trim();

    // 1) Load slots in range
    let q = supa
      .from("ScheduleSlot")
      .select(
        "id, date, totalSlots, isCancelled, experienceId, Experience:Experience(id, name)"
      )
      .eq("isCancelled", false)
      .order("date", { ascending: true })
      .limit(2000);

    if (expId) q = q.eq("experienceId", expId);
    if (from) q = q.gte("date", `${from}T00:00:00`);
    if (to) q = q.lte("date", `${to}T23:59:59.999`);

    const { data: slots, error: slotsErr } = await q;
    if (slotsErr) throw slotsErr;

    if (!slots || slots.length === 0) {
      return ok({ items: [] });
    }

    const slotIds = slots.map((s) => s.id);

    // 2) Load confirmed/paid bookings for these slots
    const { data: bRows, error: bErr } = await supa
      .from("booking")
      .select("scheduleSlotId, status, numberOfPeople, counts")
      .in("scheduleSlotId", slotIds);
    if (bErr) throw bErr;

    // Sum confirmed people per slot
    const confirmedMap = new Map(); // slotId -> people
    for (const b of bRows || []) {
      const st = String(b?.status || "").toLowerCase();
      if (!COUNT_STATUSES.has(st)) continue;
      const np = peopleFromBooking(b);
      if (!isNum(np)) continue;
      confirmedMap.set(
        b.scheduleSlotId,
        (confirmedMap.get(b.scheduleSlotId) || 0) + np
      );
    }

    // 3) Load active holds (drafts) for these slots
    const { data: dRows, error: dErr } = await supa
      .from("BookingDraft")
      .select("scheduleSlotId, counts, status, expiresAt, convertedBookingId")
      .in("scheduleSlotId", slotIds);
    if (dErr) throw dErr;

    const now = new Date();
    const holdsMap = new Map(); // slotId -> held people
    for (const d of dRows || []) {
      const st = String(d?.status || "").toLowerCase();
      const expAt = d?.expiresAt ? new Date(d.expiresAt) : null;
      const isPaidUnconverted = st === "paid" && !d?.convertedBookingId;
      const isActive =
        isPaidUnconverted || (st !== "paid" && (!expAt || expAt > now));
      if (!isActive) continue;

      const ppl = peopleFromCounts(d?.counts);
      if (!isNum(ppl)) continue;

      holdsMap.set(
        d.scheduleSlotId,
        (holdsMap.get(d.scheduleSlotId) || 0) + ppl
      );
    }

    // 4) Compose response with accurate availability
    const items = (slots || []).map((s) => {
      const confirmed = confirmedMap.get(s.id) || 0;
      const held = holdsMap.get(s.id) || 0;
      const total = Number(s.totalSlots || 0);
      const available = Math.max(0, total - confirmed - held);

      return {
        id: s.id,
        date: s.date,
        experienceId: s.experienceId,
        experienceName: s.Experience?.name || null,
        totalSlots: total,
        bookedSlots: confirmed, // confirmed/paid reservations only
        // (optional) held, if you want to surface it for debugging:
        // heldSlots: held,
        available,
      };
    });

    return ok({ items });
  } catch (e) {
    console.error("[slots] error", e);
    return bad(e?.message || "Failed to load slots", 500);
  }
}

/* ---------------------------- helpers ---------------------------- */
function isNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}
function peopleFromCounts(cnt) {
  if (!cnt || typeof cnt !== "object") return null;
  const a = Number(cnt.adults || cnt.adult || 0) || 0;
  const k = Number(cnt.kids || cnt.children || 0) || 0;
  const t = Number(cnt.teens || cnt.teen || 0) || 0;
  const sum = a + k + t;
  return Number.isFinite(sum) ? sum : null;
}
function peopleFromBooking(b) {
  if (isNum(b?.numberOfPeople)) return b.numberOfPeople;
  return peopleFromCounts(b?.counts);
}
