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
    .from("DiscountCode")
    .select("*")
    .order("id", { ascending: false });
  if (error) return bad(error.message, 500);
  return ok({ items: data || [] });
}

export async function POST(req) {
  const body = await req.json();

  const required = [
    "discountType",
    "discountValue",
    "startsAt",
    "endsAt",
    "minSpend",
  ];

  for (const k of required)
    if (body[k] === undefined || body[k] === null || body[k] === "")
      return bad(`Missing ${k}`);

  const admin = createSupabaseAdmin();
  const insert = {
    code: body.code ? String(body.code).toUpperCase() : null, // optional custom code
    campaignId: body.campaignId ?? null,
    discountType: body.discountType, // 'percent' | 'amount'
    discountValue: Number(body.discountValue),
    currency: body.currency || "EUR",
    maxRedemptions: body.maxRedemptions ?? null,
    perUserLimit: body.perUserLimit ?? 1,
    minSpend: body.minSpend ?? null,
    scope: body.scope || "global",
    experienceIds: body.experienceIds || [],
    startsAt: body.startsAt,
    endsAt: body.endsAt,
    stackable: !!body.stackable,
    active: body.active !== false,
  };

  const { data, error } = await admin
    .from("DiscountCode")
    .insert(insert)
    .select("*")
    .single();
  // Handle unique-violation (duplicate code) as 409
  if (error && error.code === "23505") return bad("Code already exists", 409);

  if (error) return bad(error.message, 500);
  return ok(data, 201);
}
