// src/app/api/my-bookings/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supa = await createSupabaseServer();
    const {
      data: { user },
    } = await supa.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdmin();

    // Get your app-profile (public."User") for this auth user
    const { data: appUser, error: upErr } = await admin
      .from("User")
      .select("id, name, email")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (upErr) {
      console.error("[my-bookings] user lookup error", upErr);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
    if (!appUser) return NextResponse.json([]);

    // Fetch bookings for this user + include slot & experience
    const { data: rows, error } = await admin
      .from("Booking")
      .select(
        `
        id,
        numberOfPeople,
        notes,
        status,
        createdAt,
        updatedAt,
        scheduleSlot:ScheduleSlot (
          id, date, totalSlots, bookedSlots, isCancelled,
          experience:Experience ( id, name, location, slug, images )
        )
      `
      )
      .eq("userId", appUser.id)
      .order("createdAt", { ascending: false });

    if (error) {
      console.error("[my-bookings] select error", error);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    // Attach the SAME user for each booking so the page can show the explorer name
    const userInfo = { name: appUser.name, email: appUser.email };
    const data = (rows || []).map((b) => ({ ...b, user: userInfo }));

    return NextResponse.json(data);
  } catch (err) {
    console.error("[my-bookings] error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
