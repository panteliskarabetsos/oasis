export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function GET(req) {
  const url = new URL(req.url);
  const raw = (url.searchParams.get("code") || "").toUpperCase().trim();
  if (!raw || raw.length < 4) return bad("Missing or too short code", 400);

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("DiscountCode")
    .select("id")
    .eq("code", raw)
    .limit(1);

  if (error) return bad(error.message, 500);
  return ok({ code: raw, exists: (data || []).length > 0 });
}
