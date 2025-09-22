// src/app/api/public/settings/bookings/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const fail = (d, s = 500) => NextResponse.json(d, { status: s });

export async function GET() {
  try {
    const admin = createSupabaseAdmin();

    // Alias snake/lowercase DB columns → camelCase API keys
    const { data, error } = await admin
      .from("AppSetting")
      .select(
        `
        bookingsPaused:bookingspaused,
        bookingsPausedMessage:bookingspausedmessage,
        bookingsPausedUntil:bookingspauseduntil
      `
      )
      .eq("key", "global")
      .maybeSingle();

    if (error) {
      console.warn("[public settings GET] supabase error:", error);
    }

    // Always return a complete, camelCased object
    return ok({
      bookingsPaused: data?.bookingsPaused ?? false,
      bookingsPausedMessage: data?.bookingsPausedMessage ?? "",
      bookingsPausedUntil: data?.bookingsPausedUntil ?? null,
    });
  } catch (e) {
    console.error("[public settings GET] unexpected error:", e);
    return ok({
      bookingsPaused: false,
      bookingsPausedMessage: "",
      bookingsPausedUntil: null,
    });
  }
}
