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
  const admin = createSupabaseAdmin();

  const patch = {};
  [
    "name",
    "description",
    "scope",
    "experienceIds",
    "startsAt",
    "endsAt",
    "active",
  ].forEach((k) => {
    if (body[k] !== undefined) patch[k] = body[k];
  });
  patch.updatedAt = new Date().toISOString();

  const { data, error } = await admin
    .from("PromotionCampaign")
    .update(patch)
    .eq("id", Number(id))
    .select("*")
    .single();
  if (error) return bad(error.message, 500);
  return ok(data);
}

export async function DELETE(req, ctx) {
  const { id } = await ctx.params;
  const campaignId = Number(id);
  if (!Number.isFinite(campaignId)) return bad("Invalid id");

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  // If DiscountCode/Voucher reference campaignId with ON DELETE SET NULL,
  // this will succeed without cascade issues.
  const { error } = await admin
    .from("PromotionCampaign")
    .delete()
    .eq("id", campaignId);

  if (error) return bad(error.message, 500);
  return ok({ deleted: true });
}
