// src/app/api/admin/corporate/companies/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { toCompany, toColumns, withoutMissingColumn } from "@/lib/corporate/company";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400, extra) => NextResponse.json({ error: m, ...extra }, { status: s });

export async function GET() {
  const r = await requireAdmin("corporate");
  if (!r.ok) return r.response;

  // `select("*")` rather than a column list on purpose: the billing columns
  // only exist once 20260917_corporate_accounts.sql has been run, and naming
  // them would fail the whole request until then.
  const { data, error } = await r.admin
    .from("corporate_companies")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return bad(error.message, 500);

  // Tell the page whether the billing columns are there, so it can offer the
  // migration rather than silently showing every account as prepaid.
  const probe = await r.admin.from("corporate_companies").select("payment_terms").limit(1);
  const billingColumns = !probe.error;

  return ok({ companies: (data || []).map(toCompany), billingColumns });
}

export async function POST(req) {
  const r = await requireAdmin("corporate");
  if (!r.ok) return r.response;

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return bad("A company name is required.", 422);

  let payload = { ...toColumns(body), is_active: true };
  if (!("credit_cents" in payload)) payload.credit_cents = 0;

  // Retry without whichever billing column the database has not got yet, so a
  // console running ahead of its migration still creates accounts.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await r.admin
      .from("corporate_companies")
      .insert(payload)
      .select("*")
      .single();

    if (!error) return ok(toCompany(data), 201);

    if (error.code === "23505") {
      return bad("Another account already uses that tax id.", 409, { field: "vat" });
    }

    const reduced = withoutMissingColumn(payload, error);
    if (!reduced) return bad(error.message, 500);
    payload = reduced;
  }

  return bad("Could not create the account.", 500);
}
