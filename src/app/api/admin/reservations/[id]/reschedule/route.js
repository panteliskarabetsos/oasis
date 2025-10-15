// /api/admin/reservations/[id]/reschedule/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/* ---------------------------- helpers ---------------------------- */
const ok = (data, status = 200) => NextResponse.json(data, { status });
const bad = (msg, status = 400) =>
  NextResponse.json({ error: msg }, { status });

const isInt = (n) =>
  Number.isFinite(Number(n)) && Number(n) === Math.trunc(Number(n));

// Treat these as occupying capacity
const COUNT_STATUSES = new Set([
  "confirmed",
  "completed",
  "checked_in",
  "paid",
]);

/** Use public.User role (same as other admin routes) */
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

  if (!["admin", "superadmin"].includes(role))
    return { error: true, response: bad("Forbidden", 403) };

  return { error: false, admin };
}

function isNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}
function peopleFromCounts(cnt) {
  if (!cnt || typeof cnt !== "object") return 0;
  const a = Number(cnt.adults ?? cnt.adult ?? 0) || 0;
  const k = Number(cnt.kids ?? cnt.children ?? 0) || 0;
  const t = Number(cnt.teens ?? cnt.teen ?? 0) || 0;
  return a + k + t;
}
function peopleFromBookingRow(b) {
  if (isNum(b?.numberOfPeople)) return b.numberOfPeople;
  return peopleFromCounts(b?.counts);
}

/** Sum numberOfPeople for confirmed/paid bookings in a slot */
async function sumConfirmedPeople(admin, slotId) {
  const { data, error } = await admin
    .from("Booking")
    .select("numberOfPeople, counts, status")
    .eq("scheduleSlotId", slotId);
  if (error) throw error;

  let sum = 0;
  for (const r of data || []) {
    const st = String(r?.status || "").toLowerCase();
    if (!COUNT_STATUSES.has(st)) continue;
    sum += peopleFromBookingRow(r) || 0;
  }
  return sum;
}

/** Recompute and store bookedSlots as sum of confirmed/paid people */
async function recomputeBookedSlots(admin, slotId, nowISO) {
  const confirmed = await sumConfirmedPeople(admin, slotId);
  await admin
    .from("ScheduleSlot")
    .update({ bookedSlots: confirmed, updatedAt: nowISO })
    .eq("id", slotId);
  return confirmed;
}

/* ---------------------------- main handler ---------------------------- */
export async function PATCH(request, ctx) {
  try {
    const { id } = await ctx.params;
    const idRaw = Array.isArray(id) ? id[0] : id;
    if (!isInt(idRaw)) return bad("Invalid booking id", 400);
    const entityId = Number(idRaw);

    const auth = await requireAdmin();
    if (auth.error) return auth.response;
    const admin = auth.admin;

    // Parse body
    let payload;
    try {
      payload = await request.json();
    } catch {
      return bad("Invalid JSON body", 400);
    }
    const targetSlotId = Number(payload?.scheduleSlotId);
    if (!isInt(targetSlotId))
      return bad("Missing or invalid 'scheduleSlotId'", 400);

    // Try Booking first — we need its people count for capacity check
    const { data: booking, error: bErr } = await admin
      .from("Booking")
      .select("id, scheduleSlotId, status, numberOfPeople, counts")
      .eq("id", entityId)
      .maybeSingle();
    if (bErr) return bad(bErr.message || "Failed to load booking", 500);

    // Fallback: BookingDraft (doesn't affect counters)
    let draft = null;
    if (!booking) {
      const { data: d, error: dErr } = await admin
        .from("BookingDraft")
        .select("id, scheduleSlotId, status, counts")
        .eq("id", entityId)
        .maybeSingle();
      if (dErr) return bad(dErr.message || "Failed to load draft", 500);
      draft = d || null;
      if (!draft)
        return bad(`No Booking or BookingDraft found with id ${entityId}`, 404);
    }

    // Load target slot
    const { data: slot, error: slotErr } = await admin
      .from("ScheduleSlot")
      .select("id, date, totalSlots, isCancelled")
      .eq("id", targetSlotId)
      .single();
    if (slotErr || !slot) return bad("Selected slot not found", 404);
    if (slot.isCancelled) return bad("Selected slot is cancelled", 409);

    const nowISO = new Date().toISOString();

    /* ---------- If this is a finalized Booking ---------- */
    if (booking) {
      // No-op move to same slot: still recompute counters for good measure
      if (booking.scheduleSlotId === targetSlotId) {
        const newCount = await recomputeBookedSlots(
          admin,
          targetSlotId,
          nowISO
        );
        return ok(
          {
            success: true,
            booking,
            newStartTime: slot.date,
            newBookedCount: newCount,
          },
          200
        );
      }

      const thisPeople = peopleFromBookingRow(booking) || 0;

      // Capacity check on target: sum confirmed/paid people + this booking's people
      const targetConfirmed = await sumConfirmedPeople(admin, targetSlotId);
      if (
        isNum(slot.totalSlots) &&
        targetConfirmed + thisPeople > Number(slot.totalSlots)
      ) {
        return bad("That slot doesn't have enough capacity", 409);
      }

      // Move the booking
      const { data: updated, error: updErr } = await admin
        .from("Booking")
        .update({ scheduleSlotId: targetSlotId, updatedAt: nowISO })
        .eq("id", entityId)
        .select("*")
        .single();
      if (updErr) return bad(updErr.message || "Failed to reschedule", 500);

      // Recompute counters on both slots using the people-sum rule
      const oldSlotId = booking.scheduleSlotId;
      const [oldCount, newCount] = await Promise.all([
        recomputeBookedSlots(admin, oldSlotId, nowISO),
        recomputeBookedSlots(admin, targetSlotId, nowISO),
      ]);

      return ok(
        {
          success: true,
          booking: updated,
          newStartTime: slot.date,
          counters: { oldSlotId, oldCount, targetSlotId, newCount },
        },
        200
      );
    }

    /* ---------- Otherwise, it's a BookingDraft ---------- */
    if (draft) {
      if (draft.scheduleSlotId === targetSlotId) {
        return ok({ success: true, draft, newStartTime: slot.date }, 200);
      }
      const { data: updated, error: updErr } = await admin
        .from("BookingDraft")
        .update({ scheduleSlotId: targetSlotId, updatedAt: nowISO })
        .eq("id", entityId)
        .select("*")
        .single();
      if (updErr) return bad(updErr.message || "Failed to reschedule", 500);

      // Note: drafts don't touch counters
      return ok(
        { success: true, draft: updated, newStartTime: slot.date },
        200
      );
    }

    // Shouldn't reach here
    return bad("Unknown entity", 400);
  } catch (err) {
    console.error("[reschedule]", err);
    return bad("Unexpected error while rescheduling", 500);
  }
}

export async function POST(request, ctx) {
  // support POST as alias of PATCH
  return PATCH(request, ctx);
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
