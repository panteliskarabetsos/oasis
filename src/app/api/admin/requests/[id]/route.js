// src/app/api/admin/requests/[id]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin"; // Adjust path if needed

export async function PATCH(req, { params }) {
  const admin = createSupabaseAdmin();
  if (!admin)
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 },
    );

  try {
    const resolvedParams = await params;
    const requestId = resolvedParams.id;
    const { action, adminNotes } = await req.json(); // action = 'approve' or 'reject'

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // 1. Fetch the request details
    const { data: request, error: fetchError } = await admin
      .from("booking_request")
      .select("*")
      .eq("id", requestId)
      .single();

    if (fetchError || !request)
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if (request.status !== "pending")
      return NextResponse.json(
        { error: "Request already processed" },
        { status: 400 },
      );

    const newStatus = action === "approve" ? "approved" : "rejected";

    // 2. If approved, apply the changes to the booking table
    if (action === "approve") {
      let bookingUpdatePayload = {};

      if (request.type === "cancel") {
        bookingUpdatePayload = { status: "cancelled" };
      } else if (request.type === "reschedule" && request.requested_slot_id) {
        // ---------- NEW LOGIC ----------
        // We must fetch the actual date/time of the newly requested slot
        // so we can overwrite the hardcoded 'startTime' on the booking table.
        const { data: newSlot, error: slotError } = await admin
          .from("ScheduleSlot")
          .select("date")
          .eq("id", request.requested_slot_id)
          .single();

        if (slotError || !newSlot) {
          console.error("Failed to fetch new slot date:", slotError);
          return NextResponse.json(
            { error: "Failed to locate the requested time slot" },
            { status: 500 },
          );
        }

        bookingUpdatePayload = {
          scheduleSlotId: request.requested_slot_id,
          startTime: newSlot.date, // Overwrite the old time with the new slot's time!
        };
        // -------------------------------
      }

      // Apply changes to booking
      if (Object.keys(bookingUpdatePayload).length > 0) {
        const { error: bookingUpdateError } = await admin
          .from("booking")
          .update(bookingUpdatePayload)
          .eq("id", request.booking_id);

        if (bookingUpdateError) {
          console.error("Failed to update booking:", bookingUpdateError);
          return NextResponse.json(
            { error: "Failed to apply changes to booking" },
            { status: 500 },
          );
        }
      }
    }

    // 3. Update the request record itself
    const { error: requestUpdateError } = await admin
      .from("booking_request")
      .update({
        status: newStatus,
        admin_notes: adminNotes || null,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (requestUpdateError) throw requestUpdateError;

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    console.error("[admin-requests-patch] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
