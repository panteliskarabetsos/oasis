// src/app/api/my-bookings/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (data, status = 200) => NextResponse.json(data, { status });
const bad = (msg, status = 400) =>
  NextResponse.json({ error: msg }, { status });

export async function GET() {
  try {
    // 1) Auth (Supabase server client)
    const supa = await createSupabaseServer();
    const {
      data: { user },
      error: authErr,
    } = await supa.auth.getUser();

    if (authErr) {
      console.error("[my-bookings] auth error:", authErr);
      return bad("Unauthorized", 401);
    }
    if (!user?.id) return bad("Unauthorized", 401);

    // 2) DB (admin client)
    const admin = createSupabaseAdmin();
    if (!admin) return bad("Server not configured", 500);

    // Resolve your app user row by auth_user_id (preferred over email)
    const { data: appUser, error: userErr } = await admin
      .from("User")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (userErr) {
      console.error("[my-bookings] user lookup error:", userErr);
      return bad("Server error", 500);
    }
    if (!appUser) {
      // No profile row yet -> no bookings
      return ok([]);
    }

    // 3) Fetch bookings for this user (flat, then we'll join)
    const { data: bookings, error: bookErr } = await admin
      .from("Booking")
      .select(
        "id,userId,numberOfPeople,notes,status,createdAt,updatedAt,scheduleSlotId"
      )
      .eq("userId", appUser.id)
      .order("createdAt", { ascending: false });

    if (bookErr) {
      console.error("[my-bookings] bookings error:", bookErr);
      return bad("Server error", 500);
    }
    if (!bookings || bookings.length === 0) return ok([]);

    // 4) Fetch related schedule slots
    const slotIds = [
      ...new Set(
        bookings
          .map((b) => b.scheduleSlotId)
          .filter((v) => v !== null && v !== undefined)
      ),
    ];

    let slotsById = new Map();
    if (slotIds.length > 0) {
      const { data: slots, error: slotErr } = await admin
        .from("ScheduleSlot")
        .select("id,date,totalSlots,bookedSlots,isCancelled,experienceId")
        .in("id", slotIds);

      if (slotErr) {
        console.error("[my-bookings] slots error:", slotErr);
        return bad("Server error", 500);
      }
      slotsById = new Map(slots.map((s) => [s.id, s]));
    }

    // 5) Fetch related experiences
    const expIds = [
      ...new Set(
        Array.from(slotsById.values())
          .map((s) => s.experienceId)
          .filter((v) => Number.isFinite(v))
      ),
    ];

    let expsById = new Map();
    if (expIds.length > 0) {
      const { data: exps, error: expErr } = await admin
        .from("Experience")
        .select("id,name,location,slug,images")
        .in("id", expIds);

      if (expErr) {
        console.error("[my-bookings] experiences error:", expErr);
        return bad("Server error", 500);
      }
      expsById = new Map(exps.map((e) => [e.id, e]));
    }

    // 6) Join & shape like before
    const data = bookings.map((b) => {
      const slot = b.scheduleSlotId ? slotsById.get(b.scheduleSlotId) : null;
      const exp = slot?.experienceId ? expsById.get(slot.experienceId) : null;

      return {
        id: b.id,
        userId: b.userId,
        numberOfPeople: b.numberOfPeople,
        notes: b.notes ?? null,
        status: b.status,
        // Supabase returns timestamps as strings already
        createdAt: b.createdAt ?? null,
        updatedAt: b.updatedAt ?? null,
        scheduleSlot: slot
          ? {
              id: slot.id,
              date: slot.date ?? null,
              totalSlots: slot.totalSlots,
              bookedSlots: slot.bookedSlots,
              isCancelled: slot.isCancelled,
              experience: exp
                ? {
                    id: exp.id,
                    name: exp.name,
                    location: exp.location,
                    slug: exp.slug,
                    images: exp.images,
                  }
                : null,
            }
          : null,
      };
    });

    return ok(data);
  } catch (err) {
    console.error("[my-bookings] unexpected error:", err);
    return bad("Server error", 500);
  }
}
