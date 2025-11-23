export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function GET() {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("PromotionCampaign")
    .select("*")
    .order("id", { ascending: false });
  if (error) return bad(error.message, 500);
  return ok({ items: data || [] });
}

export async function POST(req) {
  const body = await req.json();
  const {
    name,
    description = null,
    scope = "global",
    experienceIds = [],
    startsAt,
    endsAt,
    active = true,
  } = body || {};

  if (!name || !startsAt || !endsAt) return bad("Missing required fields");

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("PromotionCampaign")
    .insert({
      name,
      description,
      scope,
      experienceIds,
      startsAt,
      endsAt,
      active,
    })
    .select("*")
    .single();
  if (error) return bad(error.message, 500);
  return ok(data, 201);
}
