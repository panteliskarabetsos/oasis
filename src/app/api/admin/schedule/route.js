// src/app/api/admin/schedule/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const bad = (msg, status = 400) =>
  NextResponse.json({ error: msg }, { status });
const ok = (data, status = 200) => NextResponse.json(data, { status });

async function requireAdmin() {
  const supa = await createSupabaseServer().catch(() => null);
  if (!supa?.auth?.getSession) {
    console.error("[admin/schedule] Supabase server client unavailable");
    return bad(
      "Server misconfiguration. Check NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      500
    );
  }

  const {
    data: { session },
    error,
  } = await supa.auth.getSession();

  if (error || !session?.user)
    return bad("Unauthorized – No active session", 401);

  const user = session.user;
  const metaRole = user.app_metadata?.role || user.user_metadata?.role;

  if (metaRole === "admin") return { user, admin: createSupabaseAdmin() };

  // Fallback to DB role check (public."User" with auth_user_id)
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const { data: dbUser, error: dbErr } = await admin
    .from("User")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (dbErr) {
    console.error("[admin/schedule] role lookup error", dbErr);
    return bad("Server error", 500);
  }
  if (dbUser?.role === "admin") return { user, admin };

  return bad("Unauthorized – Admin access required", 403);
}

// GET: all slots for a given experience
export async function GET(req) {
  const gate = await requireAdmin();
  if ("body" in gate) return gate; // it’s a NextResponse error

  const { admin } = gate;
  const { searchParams } = new URL(req.url);
  const experienceId = Number(searchParams.get("experienceId"));

  if (!experienceId) return bad("Experience ID required");

  const { data, error } = await admin
    .from("ScheduleSlot")
    .select("id,experienceId,date,totalSlots,bookedSlots,isCancelled")
    .eq("experienceId", experienceId)
    .order("date", { ascending: true });

  if (error) {
    console.error("GET /admin/schedule error:", error);
    return bad("Server error", 500);
  }
  return ok(data ?? []);
}

// POST: create a slot
// ...existing imports and helpers

// POST: create a slot
export async function POST(req) {
  const gate = await requireAdmin();
  if ("body" in gate) return gate;

  const { admin } = gate;
  const body = await req.json().catch(() => null);
  if (!body) return bad("Invalid JSON");

  const { experienceId, date, totalSlots } = body;
  if (!experienceId || !date || totalSlots == null)
    return bad("Missing required fields");

  const nowIso = new Date().toISOString();

  const payload = {
    experienceId: Number(experienceId),
    date: new Date(date).toISOString(),
    totalSlots: Number(totalSlots),
    bookedSlots: 0,
    createdAt: nowIso, // ✅ add this
    updatedAt: nowIso, // ✅ and this
    // isCancelled: false,  // optional if your column has a default
  };

  const { data, error } = await admin
    .from("ScheduleSlot")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("POST /admin/schedule error:", error);
    return bad("Server error", 500);
  }
  return ok(data, 201);
}

// PUT: update totalSlots (not bookedSlots)
export async function PUT(req) {
  const gate = await requireAdmin();
  if ("body" in gate) return gate;

  const { admin } = gate;
  const body = await req.json().catch(() => null);
  if (!body) return bad("Invalid JSON");

  const { id, totalSlots } = body;
  if (!id || totalSlots == null) return bad("Missing required fields");
  if (typeof totalSlots !== "number" || totalSlots < 0)
    return bad("Invalid totalSlots");

  const { data: existing, error: getErr } = await admin
    .from("ScheduleSlot")
    .select("id,bookedSlots")
    .eq("id", Number(id))
    .single();

  if (getErr) {
    console.error("PUT /admin/schedule fetch error:", getErr);
    return bad(
      getErr.code === "PGRST116" ? "Slot not found" : "Server error",
      getErr.code === "PGRST116" ? 404 : 500
    );
  }

  if ((existing?.bookedSlots ?? 0) > totalSlots) {
    return bad(
      `Cannot set total slots below currently booked (${existing.bookedSlots}).`,
      400
    );
  }

  const { data, error: updErr } = await admin
    .from("ScheduleSlot")
    .update({ totalSlots, updatedAt: new Date().toISOString() }) // ✅ keep updatedAt current
    .eq("id", Number(id))
    .select()
    .single();

  if (updErr) {
    console.error("PUT /admin/schedule update error:", updErr);
    return bad("Server error", 500);
  }
  return ok(data);
}

// DELETE: remove a slot
export async function DELETE(req) {
  const gate = await requireAdmin();
  if ("body" in gate) return gate;

  const { admin } = gate;
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return bad("Missing ID");

  const { error } = await admin.from("ScheduleSlot").delete().eq("id", id);

  if (error) {
    console.error("DELETE /admin/schedule error:", error);
    return bad("Server error", 500);
  }
  return ok({ message: "Deleted slot successfully" });
}
