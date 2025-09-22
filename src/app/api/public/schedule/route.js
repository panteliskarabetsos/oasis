// src/app/api/public/schedule/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (data, status = 200) => NextResponse.json(data, { status });
const bad = (msg, status = 400) =>
  NextResponse.json({ error: msg }, { status });

export async function GET(req) {
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const { searchParams } = new URL(req.url);
  const experienceIdRaw = searchParams.get("experienceId");
  const experienceId = Number(experienceIdRaw);

  if (!Number.isFinite(experienceId) || experienceId <= 0) {
    return bad("Experience ID required", 400);
  }

  try {
    const { data, error } = await admin
      .from("ScheduleSlot")
      .select("id,date,totalSlots,bookedSlots")
      .eq("experienceId", experienceId)
      .order("date", { ascending: true });

    if (error) {
      console.error("[public/schedule] select error:", error);
      return bad("Server error", 500);
    }

    return ok(data ?? []);
  } catch (e) {
    console.error("[public/schedule] exception:", e);
    return bad("Server error", 500);
  }
}
