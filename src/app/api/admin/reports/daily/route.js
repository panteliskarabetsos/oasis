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

  return { error: false, admin };
}

export async function GET(req) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.response;
    const admin = auth.admin;

    // 1. Determine the target date boundaries
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date"); // e.g., "2026-04-24"

    let startDate, endDate;

    if (dateParam) {
      // If a specific date is requested, set boundaries for that date
      startDate = new Date(`${dateParam}T00:00:00`);
      endDate = new Date(`${dateParam}T23:59:59.999`);
    } else {
      // Default to "Today" based on server time
      const now = new Date();
      startDate = new Date(now.setHours(0, 0, 0, 0));
      endDate = new Date(now.setHours(23, 59, 59, 999));
    }

    const isoStart = startDate.toISOString();
    const isoEnd = endDate.toISOString();

    // 2. Fetch all payments collected within this date range
    const { data: payments, error: pErr } = await admin
      .from("payment")
      .select("amount, method, currency")
      .gte("processed_at", isoStart)
      .lte("processed_at", isoEnd);

    if (pErr) throw pErr;

    // 3. Fetch all refunds processed within this date range
    const { data: refunds, error: rErr } = await admin
      .from("payment_refund")
      .select("amount_cents, currency")
      .gte("created_at", isoStart)
      .lte("created_at", isoEnd);

    if (rErr) throw rErr;

    // 4. Calculate the Ledger Summary
    const summary = {
      cash: 0,
      card: 0, // Represents Stripe Online & Terminal
      bank_transfer: 0,
      other: 0,
      refunds: 0,
      net_total: 0,
    };

    payments?.forEach((p) => {
      const amt = Number(p.amount) || 0;

      if (p.method === "cash") summary.cash += amt;
      else if (p.method === "card") summary.card += amt;
      else if (p.method === "bank_transfer") summary.bank_transfer += amt;
      else summary.other += amt;

      summary.net_total += amt;
    });

    refunds?.forEach((r) => {
      // Note: Refunds are stored in CENTS in your schema, so we divide by 100
      const amt = (Number(r.amount_cents) || 0) / 100;
      summary.refunds += amt;
      summary.net_total -= amt;
    });

    return ok({
      date: dateParam || startDate.toISOString().split("T")[0],
      summary,
      raw_payments: payments?.length || 0,
      raw_refunds: refunds?.length || 0,
    });
  } catch (error) {
    console.error("Daily Report Error:", error);
    return bad("Failed to generate daily report", 500);
  }
}
