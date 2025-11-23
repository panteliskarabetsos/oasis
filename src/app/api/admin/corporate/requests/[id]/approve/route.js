// ============================================================================
// File: src/app/api/admin/corporate/requests/[id]/approve/route.js
// POST -> approve request
// ============================================================================
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

async function requireAdmin() {
  try {
    const supa = createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supa.auth.getUser();
    if (error || !user) return { error: bad("Unauthorized", 401) };
    const role = user?.app_metadata?.role || user?.user_metadata?.role;
    if (role !== "admin") return { error: bad("Forbidden", 403) };
    return { supaAdmin: createSupabaseAdmin() };
  } catch {
    return { error: bad("Unauthorized", 401) };
  }
}

export async function POST(req, { params }) {
  const { supaAdmin, error } = await requireAdmin();
  if (error) return error;

  const id = params?.id;
  if (!id) return bad("Missing id", 422);

  const { error: err } = await supaAdmin
    .from("corporate_requests")
    .update({ status: "approved" })
    .eq("id", id);

  if (err) return bad(err.message, 500);
  return ok({ ok: true });
}
