// src/app/api/admin/requests/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req) {
  const admin = createSupabaseAdmin();
  if (!admin)
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 },
    );

  try {
    const { data: requests, error } = await admin
      .from("booking_request")
      .select(
        `
        id,
        type,
        status,
        reason,
        created_at,
        requested_slot_id,
        booking_id,
        booking:booking_id (
          id,
          status,
          primary_contact,
          numberOfPeople,
          adultsCount,
          kidsCount,
          counts,
          selected_meetup_point,
          User ( name, surname, email ),
          Experience ( name )
        ),
        requested_slot:requested_slot_id (
          date,
          totalSlots
        )
      `,
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Collect requested slot IDs to calculate availability for reschedules
    const requestedSlotIds = [
      ...new Set(requests.map((r) => r.requested_slot_id).filter(Boolean)),
    ];
    const slotAvailability = {};

    if (requestedSlotIds.length > 0) {
      const COUNT_STATUSES = [
        "paid",
        "confirmed",
        "completed",
        "checked_in",
        "approved",
      ];
      const { data: slotBookings } = await admin
        .from("booking")
        .select(
          "scheduleSlotId, numberOfPeople, adultsCount, kidsCount, counts",
        )
        .in("scheduleSlotId", requestedSlotIds)
        .in("status", COUNT_STATUSES);

      const bookedMap = new Map();
      for (const b of slotBookings || []) {
        const nDirect = Number(b?.numberOfPeople);
        const nAdults = Number(b?.adultsCount);
        const nKids = Number(b?.kidsCount);
        const cAdults = Number(b?.counts?.adults ?? 0);
        const cKids = Number(b?.counts?.kids ?? 0);

        let seats = 0;
        if (Number.isFinite(nDirect) && nDirect > 0) seats = nDirect;
        else if (Number.isFinite(nAdults) || Number.isFinite(nKids))
          seats = (nAdults || 0) + (nKids || 0);
        else seats = (cAdults || 0) + (cKids || 0);

        bookedMap.set(
          b.scheduleSlotId,
          (bookedMap.get(b.scheduleSlotId) || 0) + seats,
        );
      }

      for (const slotId of requestedSlotIds) {
        slotAvailability[slotId] = bookedMap.get(slotId) || 0;
      }
    }

    // Format the response for the frontend
    const formattedRequests = requests.map((req) => {
      const b = req.booking;
      const contactLastName =
        b?.primary_contact?.lastName || b?.User?.surname || "";
      const contactFirstName =
        b?.primary_contact?.firstName || b?.User?.name || "";
      const guestName =
        `${contactFirstName} ${contactLastName}`.trim() || "Unknown Guest";

      // Calculate Party Size & Ages
      const nDirect = Number(b?.numberOfPeople);
      const nAdults = Number(b?.adultsCount);
      const nKids = Number(b?.kidsCount);
      const cAdults = Number(b?.counts?.adults ?? 0);
      const cKids = Number(b?.counts?.kids ?? 0);

      let totalGuests = 0;
      let adults = 0;
      let kids = 0;

      if (Number.isFinite(nAdults) && Number.isFinite(nKids)) {
        adults = nAdults;
        kids = nKids;
        totalGuests = adults + kids;
      } else if (Number.isFinite(cAdults) && Number.isFinite(cKids)) {
        adults = cAdults;
        kids = cKids;
        totalGuests = adults + kids;
      } else if (Number.isFinite(nDirect) && nDirect > 0) {
        totalGuests = nDirect;
        adults = nDirect; // Fallback assumption
      }

      // Calculate Available Capacity for the newly requested slot
      let availableSlots = null;
      if (req.requested_slot_id && req.requested_slot?.totalSlots) {
        const total = req.requested_slot.totalSlots;
        const booked = slotAvailability[req.requested_slot_id] || 0;
        availableSlots = Math.max(0, total - booked);
      }

      return {
        id: req.id,
        bookingId: req.booking_id,
        reference: `BK-${String(req.booking_id).padStart(6, "0")}`,
        type: req.type,
        status: req.status,
        reason: req.reason,
        createdAt: req.created_at,
        guestName,
        experienceName: b?.Experience?.name || "Unknown Experience",
        meetupPoint: b?.selected_meetup_point || null, // Added Meetup Point!
        currentBookingStatus: b?.status,
        newDate: req.requested_slot?.date || null,
        totalGuests: totalGuests || 1,
        adults: adults || 1,
        kids: kids || 0,
        availableSlots,
      };
    });

    return NextResponse.json(formattedRequests);
  } catch (error) {
    console.error("[admin-requests-get] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 },
    );
  }
}
