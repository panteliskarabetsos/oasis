// src/app/api/bookings/[id]/request-change/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../../../lib/supabase/admin";

const ok = (data, status = 200) => NextResponse.json(data, { status });
const bad = (msg, status = 400) =>
  NextResponse.json({ error: msg }, { status });

export async function POST(req, { params }) {
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  try {
    // Next.js 15: Await the params object before destructuring
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const bookingId = parseInt(id, 10);

    if (isNaN(bookingId)) {
      return bad("Invalid booking ID", 400);
    }

    const body = await req.json();
    const { type, reason, newSlotId, newMeetupPoint } = body;

    if (!["cancel", "reschedule", "meetup"].includes(type)) {
      return bad("Invalid request type", 400);
    }

    // 1. Fetch the existing booking
    const { data: booking, error: fetchError } = await admin
      .from("booking")
      .select("id, status, notes")
      .eq("id", bookingId)
      .single();

    if (fetchError || !booking) {
      return bad("Booking not found", 404);
    }

    if (booking.status === "cancelled") {
      return bad("Booking is already cancelled", 400);
    }

    // 2. Handle Cancel / Reschedule -> Send to the new booking_request table
    if (type === "cancel" || type === "reschedule") {
      // --- NEW CHECK: Enforce 1 reschedule limit & block duplicate pending cancels ---
      if (type === "reschedule") {
        const { data: existingReschedule, error: checkError } = await admin
          .from("booking_request")
          .select("id")
          .eq("booking_id", bookingId)
          .eq("type", "reschedule")
          .limit(1);

        if (checkError) {
          console.error(
            "[request-change] check existing request error:",
            checkError,
          );
          return bad("Failed to verify existing requests", 500);
        }

        if (existingReschedule && existingReschedule.length > 0) {
          return bad("This booking has already been rescheduled once.", 400);
        }
      }

      // Optional but recommended: Prevent spamming of cancellation requests
      if (type === "cancel") {
        const { data: existingCancel } = await admin
          .from("booking_request")
          .select("id")
          .eq("booking_id", bookingId)
          .eq("type", "cancel")
          .eq("status", "pending")
          .limit(1);

        if (existingCancel && existingCancel.length > 0) {
          return bad(
            "A cancellation request is already pending for this booking.",
            400,
          );
        }
      }
      // -------------------------------------------------------------------------------

      const { error: insertError } = await admin
        .from("booking_request")
        .insert({
          booking_id: bookingId,
          type: type,
          reason: reason || null,
          requested_slot_id:
            type === "reschedule" && newSlotId ? parseInt(newSlotId, 10) : null,
          status: "pending",
        });

      if (insertError) {
        console.error("[request-change] insert error:", insertError);
        return bad("Failed to submit request", 500);
      }
    }

    // 3. Handle Meetup Point Change -> Update the booking table directly
    if (type === "meetup" && newMeetupPoint) {
      const timestamp = new Date().toLocaleString("en-US", {
        timeZone: "UTC",
        dateStyle: "short",
        timeStyle: "short",
      });

      // Still appending a note for staff visibility/audit trail
      const updatedNotes =
        (booking.notes || "") +
        `\n\n--- GUEST CHANGED MEETUP POINT @ ${timestamp} UTC ---\nNew Point: ${newMeetupPoint.name || newMeetupPoint}\n`;

      const { error: updateError } = await admin
        .from("booking")
        .update({
          notes: updatedNotes,
          selected_meetup_point: newMeetupPoint,
        })
        .eq("id", bookingId);

      if (updateError) {
        console.error("[request-change] meetup update error:", updateError);
        return bad("Failed to update meetup point", 500);
      }
    }

    return ok({
      success: true,
      message: `Request to ${type} submitted successfully.`,
    });
  } catch (err) {
    console.error("[request-change] unhandled error:", err);
    return bad("An internal server error occurred.", 500);
  }
}
