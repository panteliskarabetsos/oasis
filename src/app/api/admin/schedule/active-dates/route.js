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

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const experienceId = url.searchParams.get("experienceId");

  if (!from || !to)
    return NextResponse.json({ error: "Missing date range" }, { status: 400 });

  let query = admin
    .from("ScheduleSlot")
    .select("date")
    .gte("date", from)
    .lte("date", to)
    .eq("isCancelled", false);

  if (experienceId && experienceId !== "all") {
    query = query.eq("experienceId", experienceId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[active-dates]", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // Extract unique dates as YYYY-MM-DD local strings to match the frontend
  const activeDates = [
    ...new Set(
      (data || []).map((slot) => {
        const d = new Date(slot.date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
          d.getDate(),
        ).padStart(2, "0")}`;
      }),
    ),
  ];

  return NextResponse.json({ items: activeDates });
}
