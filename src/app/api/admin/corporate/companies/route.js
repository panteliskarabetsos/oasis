// src/app/api/admin/corporate/companies/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function GET() {
  const r = await requireAdmin();
  if (!r.ok) return r.response;

  const { admin } = r;
  const { data, error } = await admin
    .from("corporate_companies")
    .select(
      "id,name,vat,email,phone,contact_name,is_active,credit_cents,notes,created_at"
    )
    .order("created_at", { ascending: false });

  if (error) return bad(error.message, 500);
  return ok(
    (data || []).map((x) => ({
      id: x.id,
      name: x.name,
      vat: x.vat,
      email: x.email,
      phone: x.phone,
      contactName: x.contact_name,
      isActive: x.is_active,
      creditCents: x.credit_cents,
      notes: x.notes,
      createdAt: x.created_at,
    }))
  );
}

export async function POST(req) {
  const r = await requireAdmin();
  if (!r.ok) return r.response;

  const body = await req.json().catch(() => ({}));
  const name = (body.name || "").trim();
  if (!name) return bad("'name' is required", 422);

  const payload = {
    name,
    vat: body.vat || null,
    email: body.email || null,
    phone: body.phone || null,
    contact_name: body.contactName || null,
    is_active: true,
    credit_cents: 0,
    notes: body.notes || null,
  };

  const { data, error } = await r.admin
    .from("corporate_companies")
    .insert(payload)
    .select(
      "id,name,vat,email,phone,contact_name,is_active,credit_cents,notes,created_at"
    )
    .single();

  if (error) return bad(error.message, 500);

  return ok(
    {
      id: data.id,
      name: data.name,
      vat: data.vat,
      email: data.email,
      phone: data.phone,
      contactName: data.contact_name,
      isActive: data.is_active,
      creditCents: data.credit_cents,
      notes: data.notes,
      createdAt: data.created_at,
    },
    201
  );
}
