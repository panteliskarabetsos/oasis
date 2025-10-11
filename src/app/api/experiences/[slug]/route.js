// src/app/api/experiences/[slug]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../../lib/supabase/admin";

const ok = (data, status = 200) => NextResponse.json(data, { status });
const bad = (msg, status = 400) =>
  NextResponse.json({ error: msg }, { status });

export async function GET(_req, ctx) {
  const { slug } = await ctx.params;
  if (!slug) return bad("Missing slug", 400);

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  try {
    const { data, error } = await admin
      .from("Experience")
      .select(
        `
        id,
        name,
        slug,
        description,
        location,
        duration,
        "whatsIncluded",
        "whatToBring",
        "whyYoullLove",
        images,
        "mapPin",
        "guestReviews",
        frequency,
        visibility,
        "createdAt",
        "updatedAt",
        "priceAdult",
  
        "priceKid"
      `
      )
      .eq("slug", slug)
      .eq("visibility", true)
      .maybeSingle();

    if (error) {
      console.error("[experiences/:slug] select error:", error);
      return bad("Internal server error", 500);
    }
    if (!data) return bad("Experience not found", 404);

    const priceAdult = numberOr(data.priceAdult, 85);

    const priceKid = numberOr(data.priceKid, priceAdult);

    const pricing = { adult: priceAdult, kid: priceKid };

    return ok({ ...data, pricing });
  } catch (e) {
    console.error("[experiences/:slug] exception:", e);
    return bad("Internal server error", 500);
  }
}

function numberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : Number(fallback) || 0;
}
