// src/app/api/availability/[slug]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (data, status = 200) => NextResponse.json(data, { status });
const bad = (msg, status = 400) =>
  NextResponse.json({ error: msg }, { status });
//how long the drafts are active (minutes)
const HOLD_MINUTES = 10;

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
  if (!Number.isInteger(slotIdNum) || slotIdNum <= 0) {
    return bad("Missing or invalid slotId", 400);
  }
  if (!Number.isInteger(count) || count <= 0) {
    return bad("numberOfPeople must be a positive integer", 400);
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
      .select("id,date,totalSlots,isCancelled,experienceId")
      .eq("id", slotIdNum)
      .maybeSingle();
    if (slotErr) {
      console.error("[availability] slot fetch error:", slotErr);
      return bad("Server error", 500);
    }
    if (!slot || slot.isCancelled) {
      return bad("Slot not found or is cancelled", 400);
    }

    // Past slot guard
    const slotTs = new Date(slot.date).getTime();
    if (!Number.isFinite(slotTs)) return bad("Invalid slot date", 400);
    if (slotTs < Date.now()) return bad("This slot has already passed", 400);

    // Ensure slot belongs to experience slug & fetch prices
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

    // Active holds (unexpired drafts/checkout)
    const { data: holds, error: holdsErr } = await admin
      .from("BookingDraft")
      .select("counts, expiresAt, status")
      .eq("scheduleSlotId", slot.id)
      .in("status", ["draft", "checkout"]);
    if (holdsErr) {
      console.error("[availability] holds fetch error:", holdsErr);
      return bad("Server error", 500);
    }

    const nowTs = Date.now();
    const lockedPending = (holds || []).reduce((sum, h) => {
      const expTs = h.expiresAt ? new Date(h.expiresAt).getTime() : 0;
      if (!Number.isFinite(expTs) || expTs <= nowTs) return sum; // ignore null/expired
      const adults = Number(h?.counts?.adults ?? 0) || 0;
      const kids = Number(h?.counts?.kids ?? 0) || 0;
      return sum + adults + kids;
    }, 0);

    // ✅ BOOKED seats from Booking (confirmed, paid reservations)
    // Robust: prefer numberOfPeople; else fall back to adultsCount+kidsCount; else counts JSON.
    const { data: bookings, error: bErr } = await admin
      .from("Booking")
      .select("numberOfPeople, adultsCount, kidsCount, counts")
      .eq("scheduleSlotId", slot.id);
    if (bErr) {
      console.error("[availability] bookings sum error:", bErr);
      return bad("Server error", 500);
    }

    const alreadyBooked = (bookings || []).reduce((sum, b) => {
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
      return sum + (seats || 0);
    }, 0);

    const available =
      Number(slot.totalSlots || 0) - alreadyBooked - lockedPending;
    if (available < count) {
      return bad(`Only ${Math.max(available, 0)} spots left`, 400);
    }

    // Pricing (everyone as adult in this flow)
    const unitPriceAdult = Number(exp.priceAdult ?? 0);
    const unitPriceKid = exp.priceKid; // may be null
    const adults = count;
    const kids = 0;
    const totalAmount =
      unitPriceAdult * adults +
      (unitPriceKid != null ? Number(unitPriceKid) * kids : 0);

    // Primary contact snapshot
    const primaryContact = {
      userId: appUser.id,
      email: appUser.email ?? user.email ?? null,
      name: appUser.name ?? null,
      surname: appUser.surname ?? null,
      phone: appUser.phone ?? null,
      notes: null,
    };

    // Create a BookingDraft hold
    const expiresAt = new Date(nowTs + HOLD_MINUTES * 60 * 1000).toISOString();
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
