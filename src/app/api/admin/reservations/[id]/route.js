// src/app/api/admin/reservations/[id]/status/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse as NextResponse2 } from "next/server";
import { createSupabaseServer as createSupabaseServer2 } from "@/lib/supabase/server";
import { createSupabaseAdmin as createSupabaseAdmin2 } from "@/lib/supabase/admin";

const ok2 = (data, status = 200) => NextResponse2.json(data, { status });
const bad2 = (msg, status = 400) =>
  NextResponse2.json({ error: msg }, { status });

async function requireAdmin2() {
  const supa = await createSupabaseServer2();
  if (!supa)
    return { error: true, response: bad2("Server not configured", 500) };
  const { data, error } = await supa.auth.getUser();
  const user = data?.user;
  if (error || !user)
    return { error: true, response: bad2("Unauthorized", 401) };
  const admin = createSupabaseAdmin2();
  if (!admin)
    return { error: true, response: bad2("Server not configured", 500) };
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
  if (!["admin", "superadmin"].includes(role))
    return { error: true, response: bad2("Forbidden", 403) };
  return { error: false, admin, user, role };
}

export async function PATCH(req, { params }) {
  const auth = await requireAdmin2();
  if (auth.error) return auth.response;
  const supa = auth.admin;

  try {
    const id = Number(params?.id);
    if (!id) return bad2("Invalid reservation id", 400);

    const body = await req.json().catch(() => ({}));
    const next = (body?.status || "").trim();
    const allowed = new Set(["pending", "confirmed", "cancelled", "draft"]);
    if (!allowed.has(next)) return bad2("Invalid status", 400);

    // Try Booking first
    let updated = false;
    {
      const { data, error } = await supa
        .from("Booking")
        .update({ status: next })
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (Array.isArray(data) && data.length > 0) updated = true;
    }

    if (!updated) {
      const { data, error } = await supa
        .from("BookingDraft")
        .update({ status: next })
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (Array.isArray(data) && data.length > 0) updated = true;
    }

    if (!updated) return bad2("Reservation not found", 404);

    return ok2({ ok: true });
  } catch (e) {
    console.error("/api/admin/reservations/[id]/status PATCH error", e);
    return bad2(e?.message || "Failed to update status", 500);
  }
}
