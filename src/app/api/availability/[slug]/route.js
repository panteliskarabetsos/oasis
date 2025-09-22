// src/app/api/availability/[slug]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (data, status = 200) => NextResponse.json(data, { status });
const bad = (msg, status = 400) =>
  NextResponse.json({ error: msg }, { status });

export async function POST(req, { params }) {
  const supa = await createSupabaseServer();
  if (!supa) return bad("Server not configured", 500);

  // Auth (Supabase)
  const {
    data: { user },
    error: authErr,
  } = await supa.auth.getUser();
  if (authErr || !user?.id) return bad("Unauthorized", 401);

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const { slug } = params || {};
  const { slotId, numberOfPeople } = await req.json().catch(() => ({}));

  // Basic validation
  const slotIdNum = Number(slotId);
  const count = Number(numberOfPeople);
  if (!Number.isFinite(slotIdNum) || slotIdNum <= 0) {
    return bad("Missing or invalid slotId", 400);
  }
  if (!Number.isFinite(count) || count <= 0) {
    return bad("numberOfPeople must be a positive number", 400);
  }

  try {
    // Find app user profile by auth_user_id
    const { data: appUser, error: userErr } = await admin
      .from("User")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (userErr) {
      console.error("[availability] user lookup error:", userErr);
      return bad("Server error", 500);
    }
    if (!appUser) return bad("User profile not found", 404);

    // Load the schedule slot
    const { data: slot, error: slotErr } = await admin
      .from("ScheduleSlot")
      .select("id,date,totalSlots,bookedSlots,isCancelled,experienceId")
      .eq("id", slotIdNum)
      .maybeSingle();

    if (slotErr) {
      console.error("[availability] slot fetch error:", slotErr);
      return bad("Server error", 500);
    }
    if (!slot || slot.isCancelled) {
      return bad("Slot not found or is cancelled", 400);
    }

    // If a slug is present in the route, make sure the slot belongs to that experience
    if (slug) {
      const { data: exp, error: expErr } = await admin
        .from("Experience")
        .select("id,slug")
        .eq("id", slot.experienceId)
        .maybeSingle();

      if (expErr) {
        console.error("[availability] experience fetch error:", expErr);
        return bad("Server error", 500);
      }
      if (!exp || exp.slug !== slug) {
        return bad("Slot does not belong to this experience", 400);
      }
    }

    // Availability check
    const available = Number(slot.totalSlots) - Number(slot.bookedSlots);
    if (available < count) {
      return bad(`Only ${available} spots left`, 400);
    }

    // Create booking
    const { data: booking, error: bookErr } = await admin
      .from("Booking")
      .insert({
        userId: appUser.id,
        scheduleSlotId: slot.id,
        numberOfPeople: count,
        status: "CONFIRMED",
      })
      .select()
      .single();

    if (bookErr) {
      console.error("[availability] booking insert error:", bookErr);
      return bad("Failed to create booking", 500);
    }

    // Update bookedSlots (read-modify-write)
    const newBooked = Number(slot.bookedSlots) + count;
    const { error: updErr } = await admin
      .from("ScheduleSlot")
      .update({ bookedSlots: newBooked })
      .eq("id", slot.id);

    if (updErr) {
      console.error("[availability] bookedSlots update error:", updErr);
      // Optional: delete booking if slot update failed
      // await admin.from("Booking").delete().eq("id", booking.id);
      return bad("Failed to finalize booking", 500);
    }

    return ok(booking, 201);
  } catch (e) {
    console.error("[availability] unexpected error:", e);
    return bad("Internal server error", 500);
  }
}
