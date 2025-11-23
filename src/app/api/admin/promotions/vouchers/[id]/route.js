export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function PATCH(req, ctx) {
  const { id } = await ctx.params;
  const body = await req.json();

  const patch = {};
  [
    "campaignId",
    "assignedToUserId",
    "assignedToEmail",
    "discountType",
    "discountValue",
    "currency",
    "maxRedemptions",
    "perUserLimit",
    "minSpend",
    "scope",
    "experienceIds",
    "startsAt",
    "endsAt",
    "active",
  ].forEach((k) => {
    if (body[k] !== undefined) patch[k] = body[k];
  });
  patch.updatedAt = new Date().toISOString();

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("Voucher")
    .update(patch)
    .eq("id", Number(id))
    .select("*")
    .single();
  if (error) return bad(error.message, 500);
  return ok(data);
}
