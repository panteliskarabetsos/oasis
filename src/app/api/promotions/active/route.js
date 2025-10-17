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

  const nowISO = new Date().toISOString();

  // ---- Active site-wide campaigns (optional: only global) ----
  const { data: campRows, error: campErr } = await admin
    .from("PromotionCampaign")
    .select("id,name,description,scope,experienceIds,startsAt,endsAt,active")
    .eq("active", true)
    .eq("scope", "global") // <-- keep site-wide only; remove if you want all
    .lte("startsAt", nowISO)
    .gte("endsAt", nowISO)
    .order("endsAt", { ascending: true });

  if (campErr) return bad(campErr.message, 500);

  // ---- Active public discount codes (global; not exhausted) ----
  const { data: codeRows, error: codeErr } = await admin
    .from("DiscountCode")
    .select(
      "id,code,discountType,discountValue,currency,startsAt,endsAt,active,scope,maxRedemptions,redemptionCount"
    )
    .eq("active", true)
    .eq("scope", "global") // site-wide only
    .lte("startsAt", nowISO)
    .gte("endsAt", nowISO)
    .order("endsAt", { ascending: true });

  if (codeErr) return bad(codeErr.message, 500);

  // Filter out exhausted codes: keep if unlimited OR redemptionCount < maxRedemptions
  const publicCodes = (codeRows || []).filter(
    (x) =>
      x.maxRedemptions == null ||
      Number(x.redemptionCount) < Number(x.maxRedemptions)
  );

  return ok({
    campaigns: (campRows || []).map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
    })),
    codes: publicCodes.map((x) => ({
      id: x.id,
      code: x.code,
      discountType: x.discountType,
      discountValue: x.discountValue,
      currency: x.currency,
      startsAt: x.startsAt,
      endsAt: x.endsAt,
    })),
  });
}
