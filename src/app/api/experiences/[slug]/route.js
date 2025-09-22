// src/app/api/experiences/[slug]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (data, status = 200) => NextResponse.json(data, { status });
const bad = (msg, status = 400) =>
  NextResponse.json({ error: msg }, { status });

export async function GET(_req, { params }) {
  const slug = params?.slug;
  if (!slug) return bad("Missing slug", 400);

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  try {
    const { data, error } = await admin
      .from("Experience")
      .select(
        "id,name,slug,description,price,location,duration,whatsIncluded,whatToBring,whyYoullLove,images,mapPin,guestReviews,frequency,visibility,createdAt,updatedAt"
      )
      .eq("slug", slug)
      .eq("visibility", true) // only public items for this public route
      .maybeSingle();

    if (error) {
      console.error("[experiences/:slug] select error:", error);
      return bad("Internal server error", 500);
    }
    if (!data) return bad("Experience not found", 404);

    return ok(data);
  } catch (e) {
    console.error("[experiences/:slug] exception:", e);
    return bad("Internal server error", 500);
  }
}
