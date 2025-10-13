// src/app/api/admin/schedule/slots/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // disable static caching

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

async function requireAdmin() {
  const supa = await createSupabaseServer();
  if (!supa)
    return { error: true, response: bad("Server not configured", 500) };

  const { data, error } = await supa.auth.getUser();
  const user = data?.user;
  if (error || !user)
    return { error: true, response: bad("Unauthorized", 401) };

  const admin = createSupabaseAdmin();
  if (!admin)
    return { error: true, response: bad("Server not configured", 500) };

  // authorize via your public.User table
  const { data: profile } = await admin
    .from("User")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single();

  const role =
    profile?.role ||
    user?.app_metadata?.role ||
    user?.user_metadata?.role ||
    "user";
  if (!["admin", "superadmin"].includes(role)) {
    return { error: true, response: bad("Forbidden", 403) };
  }

  return { error: false, admin };
}

export async function GET(req) {
  const auth = await requireAdmin();
  if (auth.error) return auth.response;
  const supa = auth.admin;

  try {
    const { searchParams } = new URL(req.url);
    const expId = Number(searchParams.get("experienceId")) || null;
    const from = (searchParams.get("from") || "").trim(); // YYYY-MM-DD
    const to = (searchParams.get("to") || "").trim();

    let q = supa
      .from("ScheduleSlot")
      .select(
        "id, date, totalSlots, bookedSlots, isCancelled, experienceId, Experience:Experience(id, name)"
      )
      .eq("isCancelled", false)
      .order("date", { ascending: true })
      .limit(2000);

    if (expId) q = q.eq("experienceId", expId);
    if (from) q = q.gte("date", `${from}T00:00:00`);
    if (to) q = q.lte("date", `${to}T23:59:59.999`);

    const { data, error } = await q;
    if (error) throw error;

    const items = (data || []).map((s) => ({
      id: s.id,
      date: s.date,
      experienceId: s.experienceId,
      experienceName: s.Experience?.name || null,
      totalSlots: s.totalSlots,
      bookedSlots: s.bookedSlots,
      available: Math.max(0, (s.totalSlots || 0) - (s.bookedSlots || 0)),
    }));

    return ok({ items });
  } catch (e) {
    console.error("[slots] error", e);
    return bad(e?.message || "Failed to load slots", 500);
  }
}
