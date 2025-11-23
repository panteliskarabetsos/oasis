// src/app/api/admin/corporate/requests/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin"; // <-- adjust if your path is different

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function GET(req) {
  const r = await requireAdmin();
  if (!r.ok) return r.response;
  const admin = r.admin;

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") || "pending").toLowerCase();

  let q = admin
    .from("corporate_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (status !== "any") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return bad(error.message, 500);

  const companyIds = [
    ...new Set((data || []).map((x) => x.company_id).filter(Boolean)),
  ];
  const expIds = [
    ...new Set((data || []).map((x) => x.experience_id).filter(Boolean)),
  ];

  const [cRes, eRes] = await Promise.all([
    companyIds.length
      ? admin.from("corporate_companies").select("id,name").in("id", companyIds)
      : { data: [] },
    expIds.length
      ? admin.from("Experience").select("id,name").in("id", expIds)
      : { data: [] },
  ]);

  const companies = Object.fromEntries(
    (cRes.data || []).map((c) => [c.id, c.name])
  );
  const exps = Object.fromEntries((eRes.data || []).map((e) => [e.id, e.name]));

  const rows = (data || []).map((r0) => ({
    id: r0.id,
    companyId: r0.company_id,
    companyName: companies[r0.company_id] || "",
    experienceId: r0.experience_id,
    experienceName: exps[r0.experience_id] || "",
    startTime: r0.start_time,
    adults: r0.adults,
    kids: r0.kids,
    budgetCents: r0.budget_cents,
    poNumber: r0.po_number,
    notes: r0.notes,
    status: r0.status,
    createdAt: r0.created_at,
  }));

  return ok(rows);
}

export async function POST(req) {
  const r = await requireAdmin();
  if (!r.ok) return r.response;
  const admin = r.admin;

  let body = {};
  try {
    body = await req.json();
  } catch {}

  if (!body.companyId) return bad("'companyId' is required", 422);

  const payload = {
    company_id: body.companyId,
    experience_id: body.experienceId || null,
    start_time: body.startTime || null,
    adults: Number.isFinite(body.adults) ? body.adults : 0,
    kids: Number.isFinite(body.kids) ? body.kids : 0,
    budget_cents: Number.isFinite(body.budgetCents) ? body.budgetCents : 0,
    po_number: body.poNumber || null,
    notes: body.notes || null,
    status: "pending",
  };

  const { data, error } = await admin
    .from("corporate_requests")
    .insert(payload)
    .select("id")
    .single();

  if (error) return bad(error.message, 500);
  return ok({ id: data.id }, 201);
}
