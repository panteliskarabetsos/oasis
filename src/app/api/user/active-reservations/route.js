// src/app/api/user/active-reservations/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

// Adjust if you add more "active" statuses
const ACTIVE_STATUSES = ["confirmed", "pending"];

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
    const userIdParam = searchParams.get("userId");
    const emailParam = searchParams.get("email");

    if (!userIdParam && !emailParam) {
      return NextResponse.json({ activeReservations: 0 });
    }

    const nowIso = new Date().toISOString();

    let resolvedUserId =
      userIdParam && Number.isFinite(Number(userIdParam))
        ? Number(userIdParam)
        : null;

    let normalizedEmail = null;

    // If we don't have a numeric userId but we have an email, resolve internal User.id
    if (!resolvedUserId && emailParam) {
      normalizedEmail = emailParam.trim().toLowerCase();

      const { data: userRow, error: userErr } = await admin
        .from("User")
        .select("id")
        .eq("email", normalizedEmail) // email is likely CITEXT
        .maybeSingle();

      if (userErr) {
        console.error("[active-reservations] user lookup error", userErr);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
      }

      if (userRow) {
        resolvedUserId = userRow.id;
      }
    }

    let activeCount = 0;

    // 1) Primary path: bookings linked to internal User via userId
    if (resolvedUserId) {
      const { count, error: resErr } = await admin
        .from("booking")
        .select("id", { count: "exact", head: true })
        .eq("userId", resolvedUserId)
        .in("status", ACTIVE_STATUSES)
        .gte("startTime", nowIso); // only upcoming

      if (resErr) {
        console.error(
          "[active-reservations] bookings count by userId error",
          resErr
        );
        return NextResponse.json({ error: "Server error" }, { status: 500 });
      }

      activeCount = count ?? 0;
    }

    // 2) Fallback: guest bookings matched by primary_contact.email
    if (activeCount === 0 && emailParam) {
      const email = (normalizedEmail || emailParam).trim().toLowerCase();

      const { count, error: resErr2 } = await admin
        .from("booking")
        .select("id", { count: "exact", head: true })
        .in("status", ACTIVE_STATUSES)
        .gte("startTime", nowIso)
        .ilike("primary_contact->>email", email);

      if (resErr2) {
        console.error(
          "[active-reservations] bookings count by email error",
          resErr2
        );
        return NextResponse.json({ error: "Server error" }, { status: 500 });
      }

      activeCount = count ?? 0;
    }

    return NextResponse.json({ activeReservations: activeCount });
  } catch (e) {
    console.error("[active-reservations] error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
