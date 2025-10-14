// src/app/api/availability/[slug]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (data, status = 200) => NextResponse.json(data, { status });
const bad = (msg, status = 400) =>
  NextResponse.json({ error: msg }, { status });

// How long to hold seats (minutes) while user fills attendees & goes to checkout
const HOLD_MINUTES = 30;

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
      .select("id, email, name, surname, phone")
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

    // No booking for past slots
    const now = new Date();
    const slotDate = new Date(slot.date);
    if (isFinite(slotDate) && slotDate < now) {
      return bad("This slot has already passed", 400);
    }

    // Ensure the slot belongs to the experience slug & get prices
    const { data: exp, error: expErr } = await admin
      .from("Experience")
      .select("id,slug,priceAdult,priceKid")
      .eq("id", slot.experienceId)
      .maybeSingle();

    if (expErr) {
      console.error("[availability] experience fetch error:", expErr);
      return bad("Server error", 500);
    }
    if (!exp || exp.slug !== slug) {
      return bad("Slot does not belong to this experience", 400);
    }

    // Compute locked pending (unexpired drafts) for this slot
    const { data: holds, error: holdsErr } = await admin
      .from("BookingDraft")
      .select("counts, expiresAt, status")
      .eq("scheduleSlotId", slot.id)
      .in("status", ["draft", "checkout"]);

    if (holdsErr) {
      console.error("[availability] holds fetch error:", holdsErr);
      return bad("Server error", 500);
    }

    const lockedPending = (holds || []).reduce((sum, h) => {
      const expAt = h.expiresAt ? new Date(h.expiresAt) : null;
      const validHold = !expAt || expAt > now; // treat null as valid hold
      if (!validHold) return sum;
      const adults = Number(h?.counts?.adults ?? 0) || 0;
      const kids = Number(h?.counts?.kids ?? 0) || 0;
      return sum + adults + kids;
    }, 0);

    const available =
      Number(slot.totalSlots) - Number(slot.bookedSlots) - lockedPending;
    if (available < count) {
      return bad(`Only ${Math.max(available, 0)} spots left`, 400);
    }

    // Price calculation (treat everyone as adult if we only have total count)
    const unitPriceAdult = Number(exp.priceAdult ?? 0);
    const unitPriceKid = exp.priceKid ?? null;
    const adults = count;
    const kids = 0;
    const totalAmount =
      unitPriceAdult * adults + (unitPriceKid ? unitPriceKid * kids : 0);

    // Primary contact snapshot (can be edited later in attendees step)
    const primaryContact = {
      userId: appUser.id,
      email: appUser.email ?? user.email ?? null,
      name: appUser.name ?? null,
      surname: appUser.surname ?? null,
      phone: appUser.phone ?? null,
      notes: null,
    };

    // Create a BookingDraft hold (NOT a real Booking)
    const expiresAt = new Date(
      now.getTime() + HOLD_MINUTES * 60 * 1000
    ).toISOString();
    const { data: draft, error: draftErr } = await admin
      .from("BookingDraft")
      .insert({
        experienceId: exp.id,
        scheduleSlotId: slot.id,
        counts: { adults, kids },
        attendees: null,
        primary_contact: primaryContact,
        status: "draft",
        unitPriceAdult,
        unitPriceKid,
        totalAmount,
        expiresAt,
        updatedAt: new Date().toISOString(),
      })
      .select(
        "id, experienceId, scheduleSlotId, counts, totalAmount, expiresAt, status"
      )
      .single();

    if (draftErr) {
      console.error("[availability] draft insert error:", draftErr);
      return bad("Failed to create reservation draft", 500);
    }

    // Return draft so UI can continue to /booking/{draftId}/attendees
    return ok(
      {
        draftId: draft.id,
        scheduleSlotId: draft.scheduleSlotId,
        experienceId: draft.experienceId,
        counts: draft.counts,
        totalAmount: draft.totalAmount,
        expiresAt: draft.expiresAt,
        status: draft.status,
      },
      201
    );
  } catch (e) {
    console.error("[availability] unexpected error:", e);
    return bad("Internal server error", 500);
  }
}
