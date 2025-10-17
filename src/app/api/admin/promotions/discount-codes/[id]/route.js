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
    "stackable",
    "active",
  ].forEach((k) => {
    if (body[k] !== undefined) patch[k] = body[k];
  });
  patch.updatedAt = new Date().toISOString();

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("DiscountCode")
    .update(patch)
    .eq("id", Number(id))
    .select("*")
    .single();
  if (error) return bad(error.message, 500);
  return ok(data);
}
export async function DELETE(_req, { params }) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum) || idNum <= 0) return bad("Invalid id");

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const { data: row, error: getErr } = await admin
    .from("DiscountCode")
    .select("id, code")
    .eq("id", idNum)
    .maybeSingle();

  if (getErr) return bad("Server error", 500);
  if (!row) return bad("Not found", 404);

  const { error: delErr } = await admin
    .from("DiscountCode")
    .delete()
    .eq("id", idNum);

  if (delErr) {
    if (String(delErr.code) === "23503") {
      return bad("Cannot delete: code is referenced by other records.", 409);
    }
    return bad(delErr.message || "Delete failed", 500);
  }

  return ok({ ok: true });
}

export async function GET(_req, { params }) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum) || idNum <= 0) return bad("Invalid id");

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const { data, error } = await admin
    .from("DiscountCode")
    .select("*")
    .eq("id", idNum)
    .maybeSingle();

  if (error) return bad("Server error", 500);
  if (!data) return bad("Not found", 404);
  return ok({ promo: data });
}
