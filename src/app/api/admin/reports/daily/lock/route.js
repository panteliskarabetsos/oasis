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

const money = (v) => Math.round((Number(v) || 0) * 100) / 100;

export async function POST(req) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.response;

    const { admin, user } = auth;
    const body = await req.json();

    const reportDate = body.report_date;

    if (!reportDate) return bad("Missing report_date");
    if (body.opening_float === undefined) return bad("Missing opening_float");
    if (body.counted_cash === undefined) return bad("Missing counted_cash");

    const discrepancy = money(body.discrepancy);

    if (discrepancy !== 0 && !String(body.notes || "").trim()) {
      return bad("Audit notes are required when discrepancy exists");
    }

    const { data: existing, error: existingErr } = await admin
      .from("z_report")
      .select("*")
      .eq("report_date", reportDate)
      .maybeSingle();

    if (existingErr) throw existingErr;

    if (existing?.status === "locked") {
      return bad("This Z-Report is already locked", 409);
    }

    const payload = {
      report_date: reportDate,
      status: "locked",

      opening_float: money(body.opening_float),
      cash_revenue: money(body.cash_revenue),
      cash_drops: money(body.cash_drops),
      expected_drawer: money(body.expected_drawer),
      counted_cash: money(body.counted_cash),
      discrepancy,

      card_total: money(body.card_total),
      bank_transfer_total: money(body.bank_transfer_total),
      other_total: money(body.other_total),
      refund_total: money(body.refund_total),
      net_total: money(body.net_total),

      raw_payments: Number(body.raw_payments) || 0,
      raw_refunds: Number(body.raw_refunds) || 0,

      notes: String(body.notes || "").trim() || null,
      locked_at: new Date().toISOString(),
      locked_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const { data: report, error: upsertErr } = await admin
      .from("z_report")
      .upsert(payload, { onConflict: "report_date" })
      .select("*")
      .single();

    if (upsertErr) throw upsertErr;

    await admin.from("z_report_audit_log").insert({
      z_report_id: report.id,
      action: existing ? "locked" : "created",
      performed_by: user.id,
      notes: payload.notes,
    });

    if (existing) {
      await admin.from("z_report_audit_log").insert({
        z_report_id: report.id,
        action: "locked",
        performed_by: user.id,
        notes: payload.notes,
      });
    }

    return ok({
      success: true,
      report,
    });
  } catch (error) {
    console.error("Lock Z-Report Error:", error);
    return bad("Failed to lock Z-Report", 500);
  }
}
