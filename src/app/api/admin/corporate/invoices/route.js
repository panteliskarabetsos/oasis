// ============================================================================
// File: src/app/api/admin/corporate/invoices/route.js
// GET -> list invoices
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

export async function GET() {
  const { supaAdmin, error } = await requireAdmin();
  if (error) return error;

  const { data, error: err } = await supaAdmin
    .from("corporate_invoices")
    .select(
      "id, number, company_id, request_id, issued_at, due_at, amount_cents, currency, status, pdf_url, paid_at"
    )
    .order("issued_at", { ascending: false });

  if (err) return bad(err.message, 500);

  // Enrich with company name
  const companyIds = Array.from(
    new Set((data || []).map((r) => r.company_id).filter(Boolean))
  );
  const companiesRes = companyIds.length
    ? await supaAdmin
        .from("corporate_companies")
        .select("id, name")
        .in("id", companyIds)
    : { data: [] };
  const companies = Object.fromEntries(
    (companiesRes.data || []).map((c) => [c.id, c.name])
  );

  const rows = (data || []).map((r) => ({
    id: r.id,
    number: r.number,
    companyId: r.company_id,
    companyName: companies[r.company_id] || "",
    requestId: r.request_id,
    issuedAt: r.issued_at,
    dueAt: r.due_at,
    amountCents: r.amount_cents,
    currency: r.currency,
    status: r.status,
    pdfUrl: r.pdf_url,
    paidAt: r.paid_at,
  }));

  return ok(rows);
}
