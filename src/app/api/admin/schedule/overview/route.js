export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin"; // Adjust path if needed

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

// Statuses that mean the guest is actually coming
const ACTIVE_STATUSES = new Set([
  "paid",
  "confirmed",
  "completed",
  "checked_in",
]);

export async function GET(req) {
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const experienceId = url.searchParams.get("experienceId");

  if (!from || !to) return bad("Missing date range");

  // Build query: Get slots, join Experience, join Bookings
  // src/app/api/admin/schedule/overview/route.js

  // Build query: Get slots, join Experience, join Bookings
  let query = admin
    .from("ScheduleSlot")
    .select(
      `
      id, date, totalSlots, isCancelled,
      Experience!inner(id, name),
      booking(
        id, status, numberOfPeople, primary_contact, selected_meetup_point
      )
    `,
    ) // <--- Removed "code" from the booking() select
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });

  if (experienceId && experienceId !== "all") {
    query = query.eq("experienceId", experienceId);
  }

  const { data: slots, error } = await query;

  if (error) {
    console.error("[schedule/overview]", error);
    return bad("Failed to load schedule", 500);
  }

  // Clean and format the data for the frontend
  const formattedSlots = slots.map((slot) => {
    // Filter to only active bookings
    const activeBookings = (slot.booking || []).filter((b) =>
      ACTIVE_STATUSES.has(String(b.status).toLowerCase()),
    );

    const totalBooked = activeBookings.reduce(
      (sum, b) => sum + (Number(b.numberOfPeople) || 0),
      0,
    );

    return {
      id: slot.id,
      date: slot.date,
      experienceName: slot.Experience?.name || "Unknown Experience",
      totalSlots: slot.totalSlots,
      totalBooked,
      isCancelled: slot.isCancelled,
      bookings: activeBookings.map((b) => ({
        id: b.id,
        code: b.code || `BK-${String(b.id).padStart(6, "0")}`,
        pax: b.numberOfPeople,
        guestName:
          b.primary_contact?.name ||
          [b.primary_contact?.firstName, b.primary_contact?.lastName]
            .filter(Boolean)
            .join(" ") ||
          "Unknown Guest",
        meetupPoint: b.selected_meetup_point?.name || "No pickup set",
      })),
    };
  });

  return ok({ items: formattedSlots });
}
