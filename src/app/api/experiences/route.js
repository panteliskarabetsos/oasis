// src/app/api/experiences/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (data, status = 200) => NextResponse.json(data, { status });
const bad = (msg, status = 400) =>
  NextResponse.json({ error: msg }, { status });

/**
 * GET /api/experiences
 * Optional: ?limit=20&offset=0&order=asc|desc  (defaults: 100, 0, desc)
 * Only returns public (visibility=true) experiences.
 */
export async function GET(req) {
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 100, 200);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
  const order = (searchParams.get("order") || "desc").toLowerCase(); // 'asc' | 'desc'

  try {
    const { data, error } = await admin
      .from("Experience")
      .select(
        "id,name,slug,description,price,location,duration,whatsIncluded,whatToBring,whyYoullLove,images,mapPin,guestReviews,frequency,visibility,createdAt,updatedAt"
      )
      .eq("visibility", true)
      .order("createdAt", { ascending: order === "asc" })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return ok(data ?? []);
  } catch (e) {
    console.error("[public/experiences] GET error:", e);
    return bad("Failed to load experiences.", 500);
  }
}
