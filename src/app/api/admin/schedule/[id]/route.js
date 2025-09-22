// src/app/api/admin/schedule/[id]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

// --- helpers ---
const ok = (data, status = 200) => NextResponse.json(data, { status });
const bad = (msg, status = 400) =>
  NextResponse.json({ error: msg }, { status });

async function requireAdmin() {
  const supabase = createSupabaseServer();
  if (!supabase) {
    return {
      error: true,
      response: bad(
        "Server misconfiguration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        500
      ),
    };
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

  return { error: false, admin, user: session.user };
}

// --- PUT /api/admin/schedule/[id] ---
export async function PUT(req, { params }) {
  const gate = await requireAdmin();
  if (gate.error) return gate.response;

  const { admin } = gate;
  const id = Number(params?.id);

  if (!id || Number.isNaN(id)) return bad("Missing or invalid ID", 400);

  const { totalSlots } = await req.json().catch(() => ({}));
  if (typeof totalSlots !== "number" || totalSlots < 0) {
    return bad("Invalid totalSlots", 400);
  }

  // NOTE: Adjust the table name if yours differs (e.g. "schedule_slots")
  const TABLE = "ScheduleSlot";

  try {
    // 1) fetch existing to validate booked vs total
    const { data: existing, error: selErr } = await admin
      .from(TABLE)
      .select("id, bookedSlots, totalSlots")
      .eq("id", id)
      .maybeSingle();

    if (selErr) {
      console.error("[schedule/[id]] select error:", selErr);
      return bad("Server error", 500);
    }
    if (!existing) return bad("Slot not found", 404);

    if (existing.bookedSlots > totalSlots) {
      return bad(
        `Cannot set total slots below currently booked (${existing.bookedSlots}).`,
        400
      );
    }

    // 2) update
    const { data: updated, error: updErr } = await admin
      .from(TABLE)
      .update({ totalSlots })
      .eq("id", id)
      .select()
      .single();

    if (updErr) {
      console.error("[schedule/[id]] update error:", updErr);
      // Postgres FK violation example: 23503 — tailor if you need custom msg
      return bad("Server error", 500);
    }

    return ok(updated);
  } catch (e) {
    console.error("[schedule/[id]] PUT exception:", e);
    return bad("Server error", 500);
  }
}
