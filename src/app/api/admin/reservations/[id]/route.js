// src/app/api/admin/reservations/[id]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (data, status = 200) => NextResponse.json(data, { status });
const bad = (msg, status = 400) =>
  NextResponse.json({ error: msg }, { status });

async function requireAdmin() {
  const supabase = createSupabaseServer();
  if (!supabase) {
    return { error: true, response: bad("Supabase not configured", 500) };
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.user) {
    return {
      error: true,
      response: bad("Unauthorized – No active session", 401),
    };
  }

  const role =
    session.user.app_metadata?.role ||
    session.user.user_metadata?.role ||
    "user";
  if (role !== "admin") {
    return {
      error: true,
      response: bad("Unauthorized – Admin access required", 403),
    };
  }

  const admin = createSupabaseAdmin();
  if (!admin)
    return { error: true, response: bad("Server not configured", 500) };

  return { error: false, admin };
}

export async function GET(_req, { params }) {
  const gate = await requireAdmin();
  if (gate.error) return gate.response;

  const { admin } = gate;
  const id = Number(params?.id);
  if (!id || Number.isNaN(id)) return bad("Missing or invalid ID", 400);

  // Adjust table/column names if your schema differs.
  // This expects tables: Booking, User, ScheduleSlot, Experience
  try {
    const { data, error } = await admin
      .from("Booking")
      .select(
        `
        id,
        userId,
        scheduleSlotId,
        numberOfPeople,
        notes,
        createdAt,
        user:User (
          id,
          email,
          name,
          surname,
          phone
        ),
        scheduleSlot:ScheduleSlot (
          id,
          date,
          experience:Experience (
            id,
            name,
            location
          )
        )
      `
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[admin/reservations/[id]] select error:", error);
      return bad("Internal server error", 500);
    }
    if (!data) return bad("Booking not found", 404);

    return ok(data);
  } catch (e) {
    console.error("[admin/reservations/[id]] GET exception:", e);
    return bad("Internal server error", 500);
  }
}
