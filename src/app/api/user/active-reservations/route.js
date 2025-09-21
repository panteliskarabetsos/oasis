// src/app/api/user/active-reservations/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req) {
  try {
    const admin = createSupabaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    let userId = searchParams.get("userId");
    const emailParam = searchParams.get("email");

    // If userId not provided, resolve it via email (case-insensitive)
    if (!userId) {
      if (!emailParam) return NextResponse.json({ activeReservations: 0 });
      const email = emailParam.trim().toLowerCase();

      const { data: userRow, error: userErr } = await admin
        .from("User")
        .select("id")
        .ilike("email", email) // case-insensitive
        .maybeSingle();

      if (userErr) {
        console.error("[active-reservations] user lookup error", userErr);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
      }
      if (!userRow) return NextResponse.json({ activeReservations: 0 });
      userId = userRow.id;
    }

    // Count active reservations for this user
    // Adjust filters to match your schema:
    // - If you use different status names, tweak the .in(...) list.
    // - If "active" means not past end time, add a .gte('endAt', new Date().toISOString()) with your column name.
    const { count, error: resErr } = await admin
      .from("Reservation")
      .select("id", { count: "exact", head: true })
      .eq("userId", userId)
      .in("status", ["pending", "confirmed"]);

    if (resErr) {
      console.error("[active-reservations] reservations count error", resErr);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    return NextResponse.json({ activeReservations: count ?? 0 });
  } catch (e) {
    console.error("[active-reservations] error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
