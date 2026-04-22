// src/app/api/admin/requests/[id]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import sendRequestUpdateEmail from "@/lib/email/sendRequestUpdateEmail";

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

    const body = await req.json();
    const { action, adminNotes, refundOption } = body;

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // 1. Fetch the request details AND join the booking to get payment info & guest email
    const { data: request, error: fetchError } = await admin
      .from("booking_request")
      .select(
        `
        *, 
        booking:booking_id ( 
          id, 
          totalPaidAmount, 
          currency,
          primary_contact,
          User ( name, surname, email ),
          Experience ( name )
        )
      `,
      )
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
    let bookingUpdatePayload = {};

    // 2. If approved, apply the changes to the booking table
    if (action === "approve") {
      // ---------------- CANCELLATION & REFUND LOGIC ----------------
      if (request.type === "cancel") {
        bookingUpdatePayload = { status: "cancelled" };

        if (refundOption === "full" || refundOption === "partial") {
          const totalPaid = Number(request.booking?.totalPaidAmount) || 0;
          const refundAmount =
            refundOption === "full" ? totalPaid : totalPaid / 2;

          if (refundAmount > 0) {
            try {
              const refundRes = await fetch(
                new URL("/api/admin/refunds/create", req.url),
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    bookingId: request.booking_id,
                    amount: refundAmount,
                    currency: request.booking?.currency || "EUR",
                    reason: "requested_by_customer",
                    note: `Guest Cancellation Approved via Portal. Policy applied: ${refundOption}`,
                  }),
                },
              );

              if (!refundRes.ok) {
                const errData = await refundRes.json();
                console.error("[admin-requests] Refund failed:", errData);
                return NextResponse.json(
                  {
                    error: `Cancellation aborted because Stripe refund failed: ${errData.error || "Unknown error"}`,
                  },
                  { status: 500 },
                );
              }
            } catch (refundError) {
              console.error(
                "[admin-requests] Refund service error:",
                refundError,
              );
              return NextResponse.json(
                {
                  error:
                    "Cancellation aborted because the refund service is unreachable.",
                },
                { status: 500 },
              );
            }
          }
        }
      }
      // ---------------- RESCHEDULE LOGIC ----------------
      else if (request.type === "reschedule" && request.requested_slot_id) {
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
          startTime: newSlot.date,
        };
      }

      // Apply changes to booking table
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

    // 4. Send Email Notification to Guest
    const b = request.booking;
    const guestEmail = b?.primary_contact?.email || b?.User?.email;
    const guestName = b?.primary_contact?.firstName || b?.User?.name || "Guest";
    const experienceName = b?.Experience?.name || "Your Experience";
    const bookingRef = `BK-${String(request.booking_id).padStart(6, "0")}`;

    if (guestEmail) {
      // Determine if there are new details for the PDF generator
      let newDateObj = null;
      let passNewMeetupPoint = null;

      if (action === "approve") {
        if (request.type === "reschedule" && bookingUpdatePayload.startTime) {
          newDateObj = new Date(bookingUpdatePayload.startTime);
        }
        if (
          request.type === "meetup" &&
          bookingUpdatePayload.selected_meetup_point
        ) {
          passNewMeetupPoint = bookingUpdatePayload.selected_meetup_point;
        }
      }

      // We don't await this so it doesn't block the API response to the admin UI
      sendRequestUpdateEmail({
        email: guestEmail,
        guestName,
        experienceName,
        requestType: request.type,
        action,
        refundOption,
        adminNotes,
        bookingRef,
        bookingData: b, // Pass the full booking so it can extract location, guests, paid amount, etc.
        newDateObj,
        newMeetupPoint: passNewMeetupPoint,
      });
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    console.error("[admin-requests-patch] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
