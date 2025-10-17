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
    .from("Voucher")
    .select("*")
    .order("id", { ascending: false });
  if (error) return bad(error.message, 500);
  return ok({ items: data || [] });
}

export async function POST(req) {
  const body = await req.json();
  const required = ["discountType", "discountValue", "startsAt", "endsAt"];
  for (const k of required)
    if (body[k] === undefined || body[k] === null || body[k] === "")
      return bad(`Missing ${k}`);

  const admin = createSupabaseAdmin();
  const insert = {
    campaignId: body.campaignId ?? null,
    assignedToUserId: body.assignedToUserId ?? null,
    assignedToEmail: body.assignedToEmail ?? null,
    discountType: body.discountType, // 'percent' | 'amount'
    discountValue: Number(body.discountValue),
    currency: body.currency || "EUR",
    maxRedemptions: body.maxRedemptions ?? 1,
    perUserLimit: body.perUserLimit ?? 1,
    minSpend: body.minSpend ?? null,
    scope: body.scope || "global",
    experienceIds: body.experienceIds || [],
    startsAt: body.startsAt,
    endsAt: body.endsAt,
    active: body.active !== false,
  };

  const { data, error } = await admin
    .from("Voucher")
    .insert(insert)
    .select("*")
    .single();
  if (error) return bad(error.message, 500);
  return ok(data, 201);
}
