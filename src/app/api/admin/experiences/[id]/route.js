// src/app/api/admin/experiences/[id]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (data, status = 200) => NextResponse.json(data, { status });
const bad = (msg, status = 400) =>
  NextResponse.json({ error: msg }, { status });

async function requireAdmin() {
  const supabase = await createSupabaseServer();
  if (!supabase)
    return { error: true, response: bad("Server not configured", 500) };

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user)
    return { error: true, response: bad("Unauthorized", 401) };

  const role = user.app_metadata?.role ?? user.user_metadata?.role ?? "user";

  if (role !== "admin") return { error: true, response: bad("Forbidden", 403) };

  const admin = createSupabaseAdmin();
  if (!admin)
    return { error: true, response: bad("Server not configured", 500) };

  return { error: false, admin };
}

export async function GET(req, { params }) {
  const gate = await requireAdmin();
  if (gate.error) return gate.response;

  const { admin } = gate;

  // Unwrap params safely for Next.js compatibility
  const resolvedParams = await params;
  const id = Number(resolvedParams?.id);

  if (!id || Number.isNaN(id)) return bad("Missing or invalid ID", 400);

  try {
    const { data, error } = await admin
      .from("Experience")
      .select(
        [
          "id",
          "name",
          "slug",
          "description",
          "location",
          "duration",
          "whatsIncluded",
          "whatToBring",
          "whyYoullLove",
          "mapPin",
          "meetupPoints", // <-- Added the new jsonb column here
          "images",
          "guestReviews",
          "frequency",
          "visibility",
          "createdAt",
          "updatedAt",
          "priceAdult",
          "priceKid",
        ].join(","),
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[admin/experiences/[id]] select error:", error);
      return bad("Failed to fetch experience", 500);
    }
    if (!data) return bad("Experience not found", 404);

    return ok(data);
  } catch (e) {
    console.error("[admin/experiences/[id]] GET exception:", e);
    return bad("Failed to fetch experience", 500);
  }
}
