// src/app/api/admin/schedule/[id]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin as requireAdminAuth } from "@/lib/auth/requireAdmin";

// --- helpers ---
const ok = (data, status = 200) => NextResponse.json(data, { status });
const bad = (msg, status = 400) =>
  NextResponse.json({ error: msg }, { status });

// Delegates to the shared guard (see @/lib/auth/requireAdmin).
// Previously this called createSupabaseServer() without awaiting it, so
// supabase.auth was undefined and every request threw a 500.
async function requireAdmin() {
  const auth = await requireAdminAuth("schedule");
  if (!auth.ok) return { error: true, response: auth.response };
  return { error: false, admin: auth.admin, user: auth.user };
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
