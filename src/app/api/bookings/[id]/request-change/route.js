// src/app/api/bookings/[id]/request-change/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../../../lib/supabase/admin";
import {
  PORTAL_DENIED,
  portalTokenFrom,
  verifyPortalToken,
} from "@/lib/bookings/portalToken";

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

    // This route acts on a bare row id with the service-role client, and ids
    // run in sequence — so without this anyone counting from 1 could change
    // another guest's meeting point, write into staff notes, or file
    // cancellations across every booking. The portal proves who it is at
    // lookup; the token is that proof travelling here.
    const gate = verifyPortalToken(portalTokenFrom(req, body), bookingId);
    if (!gate.ok) {
      console.warn(`[request-change] denied on #${bookingId}: ${gate.reason}`);
      return bad(PORTAL_DENIED, 401);
    }

    if (!["cancel", "reschedule", "meetup"].includes(type)) {
      return bad("Invalid request type", 400);
    }

    // 1. Fetch the existing booking
    const { data: booking, error: fetchError } = await admin
      .from("booking")
      .select("id, status, notes, \"experienceId\", \"scheduleSlotId\"")
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
      // Whatever arrived here used to be written to the booking verbatim, and
      // its name interpolated into staff notes. Resolve it against the points
      // the experience actually offers instead, and store that — a guest can
      // only choose from the list the portal showed them, never invent one.
      const offered = await offeredMeetupPoints(admin, booking);
      const chosen = matchMeetupPoint(offered, newMeetupPoint);

      if (!chosen) {
        return bad(
          "That meeting point is not available for this experience.",
          400,
        );
      }

      const timestamp = new Date().toLocaleString("en-US", {
        timeZone: "UTC",
        dateStyle: "short",
        timeStyle: "short",
      });

      // Still appending a note for staff visibility/audit trail
      const updatedNotes =
        (booking.notes || "") +
        `\n\n--- GUEST CHANGED MEETUP POINT @ ${timestamp} UTC ---\nNew Point: ${chosen.name}\n`;

      const { error: updateError } = await admin
        .from("booking")
        .update({
          notes: updatedNotes,
          selected_meetup_point: chosen,
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

/* --------------------------- meeting points --------------------------- */

/** The meeting points this booking's experience offers, or [] if none. */
async function offeredMeetupPoints(admin, booking) {
  let experienceId = booking?.experienceId ?? null;

  if (!experienceId && booking?.scheduleSlotId) {
    const { data: slot } = await admin
      .from("ScheduleSlot")
      .select("experienceId")
      .eq("id", booking.scheduleSlotId)
      .maybeSingle();
    experienceId = slot?.experienceId ?? null;
  }
  if (!experienceId) return [];

  const { data: exp } = await admin
    .from("Experience")
    .select("meetupPoints")
    .eq("id", experienceId)
    .maybeSingle();

  const raw = exp?.meetupPoints;
  const list = typeof raw === "string" ? safeParse(raw) : raw;
  return Array.isArray(list) ? list : [];
}

function safeParse(v) {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

/**
 * The offered point the request refers to, or null.
 *
 * Matched by name because that is what the portal sends back; the stored value
 * is the one from the experience, so nothing the caller wrote is kept.
 */
function matchMeetupPoint(offered, requested) {
  const wanted = String(
    (requested && typeof requested === "object" ? requested.name : requested) ||
      "",
  )
    .trim()
    .toLowerCase();
  if (!wanted || !offered.length) return null;

  return (
    offered.find(
      (p) =>
        String(p?.name || "")
          .trim()
          .toLowerCase() === wanted,
    ) || null
  );
}
