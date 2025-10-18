// src/app/api/admin/promotions/email/campaigns/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function GET() {
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const { data, error } = await admin
    .from("email_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return bad(error.message, 500);
  return ok({ campaigns: data || [] });
}

export async function POST(req) {
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);
  const body = await req.json().catch(() => ({}));

  const required = ["name", "subject", "from_name", "from_email", "html"];
  for (const k of required) if (!body[k]) return bad(`Missing ${k}`, 422);

  const now = new Date().toISOString();
  const insert = {
    name: body.name,
    subject: body.subject,
    preheader: body.preheader || null,
    from_name: body.from_name,
    from_email: body.from_email,
    html: body.html,
    text: body.text || null,
    status: body.status || "draft",
    scheduled_at: body.scheduled_at || null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await admin
    .from("email_campaigns")
    .insert(insert)
    .select("*")
    .single();

  if (error) return bad(error.message, 500);
  return ok({ campaign: data }, 201);
}
