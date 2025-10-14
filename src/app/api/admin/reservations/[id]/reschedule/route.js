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
const CONFIRMED_STATUSES = ["confirmed"]; // adjust if you treat other statuses as occupying capacity

async function countConfirmedBookings(admin, slotId) {
  const { count, error } = await admin
    .from("Booking")
    .select("id", { head: true, count: "exact" })
    .eq("scheduleSlotId", slotId)
    .in("status", CONFIRMED_STATUSES);
  if (error) throw error;
  return count ?? 0;
}

async function recomputeBookedSlots(admin, slotId, nowISO) {
  const count = await countConfirmedBookings(admin, slotId);
  await admin
    .from("ScheduleSlot")
    .update({ bookedSlots: count, updatedAt: nowISO })
    .eq("id", slotId);
  return count;
}

/* ---------------------------- main handler ---------------------------- */
export async function PATCH(request, { params }) {
  try {
    const { id } = (await params) || {};
    if (!isInt(id)) return bad("Invalid booking id", 400);
    const entityId = Number(id);

    const supa = await createSupabaseServer();
    if (!supa) return bad("Server not configured", 500);

    // AuthN
    const { data: userRes, error: userErr } = await supa.auth.getUser();
    if (userErr || !userRes?.user) return bad("Unauthorized", 401);

    // AuthZ
    const role = (
      userRes.user?.app_metadata?.role ||
      userRes.user?.user_metadata?.role ||
      ""
    ).toLowerCase();
    if (!["admin", "superadmin"].includes(role)) return bad("Forbidden", 403);

    const admin = createSupabaseAdmin();
    if (!admin) return bad("Server not configured", 500);

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

    // Fetch target slot
    const { data: slot, error: slotErr } = await admin
      .from("ScheduleSlot")
      .select("id, date, totalSlots, bookedSlots, isCancelled")
      .eq("id", targetSlotId)
      .single();
    if (slotErr || !slot) return bad("Selected slot not found", 404);
    if (slot.isCancelled) return bad("Selected slot is cancelled", 409);

    // Capacity check uses only confirmed bookings
    const targetConfirmed = await countConfirmedBookings(admin, targetSlotId);
    if (
      typeof slot.totalSlots === "number" &&
      targetConfirmed >= slot.totalSlots
    ) {
      return bad("That slot is already full", 409);
    }

    // Try Booking first
    const { data: bookingRows } = await admin
      .from("Booking")
      .select("id, scheduleSlotId, status, updatedAt")
      .eq("id", entityId)
      .limit(1);
    const booking = bookingRows?.[0] || null;

    const nowISO = new Date().toISOString();

    if (booking) {
      // If same slot, nothing to change but make sure counters are right
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

      const oldSlotId = booking.scheduleSlotId;

      // Move the booking
      const { data: updated, error: updErr } = await admin
        .from("Booking")
        .update({ scheduleSlotId: targetSlotId, updatedAt: nowISO })
        .eq("id", entityId)
        .select("*")
        .single();
      if (updErr) return bad(updErr.message || "Failed to reschedule", 500);

      // Recompute counters on both slots (confirmed bookings only)
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

    // Then try BookingDraft (rescheduling drafts shouldn't affect counters)
    const { data: draftRows } = await admin
      .from("BookingDraft")
      .select("id, scheduleSlotId, status, updatedAt")
      .eq("id", entityId)
      .limit(1);
    const draft = draftRows?.[0] || null;

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

      return ok(
        { success: true, draft: updated, newStartTime: slot.date },
        200
      );
    }

    return bad(`No Booking or BookingDraft found with id ${entityId}`, 404);
  } catch (err) {
    console.error("[reschedule]", err);
    return bad("Unexpected error while rescheduling", 500);
  }
}

export async function POST(request, ctx) {
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
