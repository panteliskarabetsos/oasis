// src/app/api/my-bookings/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET() {
  try {
    // 1) Auth: get Supabase user from cookies/session
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[my-bookings] auth error", authError);
    }
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) Resolve your app User row by email (lowercased)
    const email = user.email.toLowerCase();
    const appUser = await prisma.user.findUnique({ where: { email } });

    if (!appUser) {
      // No app profile yet → no bookings
      return NextResponse.json([]);
    }

    // 3) Fetch bookings for this user, include slot + experience
    const rows = await prisma.booking.findMany({
      where: { userId: appUser.id },
      orderBy: { createdAt: "desc" },
      include: {
        ScheduleSlot: {
          include: { Experience: true },
        },
      },
    });

    // 4) Map to the camelCase shape used by your UI
    const data = rows.map((b) => ({
      id: b.id,
      userId: b.userId,
      numberOfPeople: b.numberOfPeople,
      notes: b.notes ?? null,
      status: b.status,
      createdAt: b.createdAt?.toISOString?.() ?? null,
      updatedAt: b.updatedAt?.toISOString?.() ?? null,
      scheduleSlot: b.ScheduleSlot
        ? {
            id: b.ScheduleSlot.id,
            date: b.ScheduleSlot.date?.toISOString?.() ?? null,
            totalSlots: b.ScheduleSlot.totalSlots,
            bookedSlots: b.ScheduleSlot.bookedSlots,
            isCancelled: b.ScheduleSlot.isCancelled,
            experience: b.ScheduleSlot.Experience
              ? {
                  id: b.ScheduleSlot.Experience.id,
                  name: b.ScheduleSlot.Experience.name,
                  location: b.ScheduleSlot.Experience.location,
                  slug: b.ScheduleSlot.Experience.slug,
                  images: b.ScheduleSlot.Experience.images,
                }
              : null,
          }
        : null,
    }));

    return NextResponse.json(data);
  } catch (err) {
    console.error("[my-bookings] error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
