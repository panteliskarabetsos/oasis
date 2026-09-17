// src/app/api/admin/corporate/companies/[id]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { toCompany, toColumns, withoutMissingColumn } from "@/lib/corporate/company";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400, extra) => NextResponse.json({ error: m, ...extra }, { status: s });

/** A column that the 20260917 migration adds is simply not there yet. */
function isMissingColumn(error) {
  return error?.code === "42703" || error?.code === "PGRST204";
}

export async function GET(req, ctx) {
  const r = await requireAdmin("corporate");
  if (!r.ok) return r.response;

  const { id } = await ctx.params;
  if (!id) return bad("Missing id", 422);

  const { data, error } = await r.admin
    .from("corporate_companies")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return bad(error.message, 500);
  if (!data) return bad("No such account.", 404);

  const company = toCompany(data);
  const [bookings, invoices] = await Promise.all([
    bookingRollup(r.admin, id),
    invoiceRollup(r.admin, id),
  ]);

  // Whether the billing columns exist at all, so the edit form can disable the
  // fields it cannot save instead of accepting them and dropping them.
  const billingColumns = Object.prototype.hasOwnProperty.call(data, "payment_terms");

  return ok({ company, bookings, invoices, billingColumns });
}

export async function PATCH(req, ctx) {
  const r = await requireAdmin("corporate");
  if (!r.ok) return r.response;

  const { id } = await ctx.params;
  if (!id) return bad("Missing id", 422);

  const body = await req.json().catch(() => ({}));
  let payload = toColumns(body, { partial: true });

  if ("name" in payload && !payload.name) {
    return bad("A company name is required.", 422, { field: "name" });
  }
  if (!Object.keys(payload).length) return bad("Nothing to change.", 422);

  const skipped = [];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await r.admin
      .from("corporate_companies")
      .update(payload)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (!error) {
      if (!data) return bad("No such account.", 404);
      return ok({
        company: toCompany(data),
        // Say so rather than reporting a clean save of fields that went nowhere.
        skipped,
        needsMigration: skipped.length > 0,
      });
    }

    if (error.code === "23505") {
      return bad("Another account already uses that tax id.", 409, { field: "vat" });
    }

    const reduced = withoutMissingColumn(payload, error);
    if (!reduced) return bad(error.message, 500);
    for (const key of Object.keys(payload)) {
      if (!(key in reduced)) skipped.push(key);
    }
    payload = reduced;
    if (!Object.keys(payload).length) {
      return bad(
        "Those billing fields need dump_sql/20260917_corporate_accounts.sql to be run first.",
        409,
        { needsMigration: true, skipped }
      );
    }
  }

  return bad("Could not save the account.", 500);
}

/* ------------------------------- rollups -------------------------------- */

/**
 * What this account has booked. Returns `linked: false` when booking."companyId"
 * does not exist yet, so the page can explain itself instead of showing a zero
 * that looks like a real answer.
 */
async function bookingRollup(admin, companyId) {
  const { data, error } = await admin
    .from("booking")
    .select('id,status,startTime,totalPaidAmount')
    .eq("companyId", companyId)
    .order("startTime", { ascending: false })
    .limit(200);

  if (error) {
    if (isMissingColumn(error)) return { linked: false, count: 0, paidCents: 0, upcoming: 0 };
    return { linked: true, count: 0, paidCents: 0, upcoming: 0, error: error.message };
  }

  const rows = data || [];
  const now = Date.now();
  return {
    linked: true,
    count: rows.length,
    paidCents: rows.reduce((sum, b) => sum + Math.round(Number(b.totalPaidAmount || 0) * 100), 0),
    upcoming: rows.filter((b) => {
      const t = Date.parse(b.startTime);
      return Number.isFinite(t) && t > now && b.status !== "cancelled";
    }).length,
  };
}

/** What this account has been invoiced, and what is still standing. */
async function invoiceRollup(admin, companyId) {
  const { data, error } = await admin
    .from("invoice")
    .select("id,status,total,due_date,paid_at")
    .eq("company_id", companyId)
    .limit(200);

  if (error) {
    if (isMissingColumn(error)) return { linked: false, count: 0, outstandingCents: 0, overdue: 0 };
    return { linked: true, count: 0, outstandingCents: 0, overdue: 0, error: error.message };
  }

  const rows = data || [];
  const unpaid = rows.filter((i) => String(i.status || "").toLowerCase() !== "paid" && !i.paid_at);
  const today = new Date().toISOString().slice(0, 10);

  return {
    linked: true,
    count: rows.length,
    outstandingCents: unpaid.reduce((sum, i) => sum + Math.round(Number(i.total || 0) * 100), 0),
    overdue: unpaid.filter((i) => i.due_date && String(i.due_date).slice(0, 10) < today).length,
  };
}
