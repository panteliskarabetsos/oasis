// src/app/api/admin/promotions/email/campaigns/[id]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function GET(_req, { params }) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum) || idNum <= 0) return bad("Invalid id");
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const { data, error } = await admin
    .from("email_campaigns")
    .select("*")
    .eq("id", idNum)
    .maybeSingle();

  if (error) return bad(error.message, 500);
  if (!data) return bad("Not found", 404);
  return ok({ campaign: data });
}

export async function PATCH(req, { params }) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum) || idNum <= 0) return bad("Invalid id");
  const body = await req.json().catch(() => ({}));

  const patch = {};
  [
    "name",
    "subject",
    "preheader",
    "from_name",
    "from_email",
    "html",
    "text",
    "status",
    "scheduled_at",
  ].forEach((k) => {
    if (body[k] !== undefined) patch[k] = body[k];
  });
  patch.updated_at = new Date().toISOString();

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const { data, error } = await admin
    .from("email_campaigns")
    .update(patch)
    .eq("id", idNum)
    .select("*")
    .single();

  if (error) return bad(error.message, 500);
  return ok({ campaign: data });
}
