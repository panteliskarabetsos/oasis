export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  if (!["admin", "superadmin", "manager", "finance"].includes(role)) {
    return { error: true, response: bad("Forbidden", 403) };
  }

  return { error: false, admin, user, profile };
}

export async function POST(req) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.response;

    const { admin, user } = auth;
    const body = await req.json();

    const reportDate = body.report_date;
    const reason = String(body.reason || "").trim();

    if (!reportDate) return bad("Missing report_date");
    if (!reason) return bad("Unlock reason is required");

    const { data: existing, error: existingErr } = await admin
      .from("z_report")
      .select("*")
      .eq("report_date", reportDate)
      .maybeSingle();

    if (existingErr) throw existingErr;
    if (!existing) return bad("Z-Report not found", 404);

    if (existing.status !== "locked") {
      return bad("Only locked Z-Reports can be unlocked", 409);
    }

    const { data: report, error: updateErr } = await admin
      .from("z_report")
      .update({
        status: "unlocked",
        unlocked_at: new Date().toISOString(),
        unlocked_by: user.id,
        unlock_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (updateErr) throw updateErr;

    await admin.from("z_report_audit_log").insert({
      z_report_id: report.id,
      action: "unlocked",
      performed_by: user.id,
      notes: reason,
    });

    return ok({
      success: true,
      report,
    });
  } catch (error) {
    console.error("Unlock Z-Report Error:", error);
    return bad("Failed to unlock Z-Report", 500);
  }
}
