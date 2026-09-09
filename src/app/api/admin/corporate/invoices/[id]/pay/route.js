// ============================================================================
// File: src/app/api/admin/corporate/invoices/[id]/pay/route.js
// POST -> mark invoice paid
// ============================================================================
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin as requireAdminAuth } from "@/lib/auth/requireAdmin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

// Delegates to the shared guard (see @/lib/auth/requireAdmin).
// Previously this called createSupabaseServer() without awaiting it, so
// supa.auth was undefined and every request returned 401.
async function requireAdmin() {
  const auth = await requireAdminAuth("corporate");
  if (!auth.ok) return { error: auth.response };
  return { supaAdmin: auth.admin };
}
export async function POST(req, { params }) {
  const { supaAdmin, error } = await requireAdmin();
  if (error) return error;

  const id = params?.id;
  if (!id) return bad("Missing id", 422);

  const now = new Date().toISOString();
  const { error: err } = await supaAdmin
    .from("corporate_invoices")
    .update({ status: "paid", paid_at: now })
    .eq("id", id);

  if (err) return bad(err.message, 500);
  return ok({ ok: true, paidAt: now });
}
