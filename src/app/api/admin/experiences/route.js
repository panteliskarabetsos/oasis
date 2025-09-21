// src/app/api/admin/experiences/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import slugify from "slugify";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (data, status = 200) => NextResponse.json(data, { status });
const bad = (msg, status = 400) =>
  NextResponse.json({ error: msg }, { status });

async function requireAdmin() {
  // 1) who is calling?
  const supa = await createSupabaseServer();
  const { data: authData, error: authErr } = await supa.auth.getUser();
  if (authErr || !authData?.user) return bad("Unauthorized", 401);

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const { user } = authData;

  // 2) quick metadata check first
  const metaRole = user?.app_metadata?.role || user?.user_metadata?.role;
  if (metaRole === "admin") return { admin, user };

  // 3) fallback: check your public."User" table by auth_user_id (or email if needed)
  const { data: dbUser, error: dbErr } = await admin
    .from("User")
    .select("role")
    .eq("auth_user_id", user.id) // make sure this column exists & is populated
    .maybeSingle();

  if (dbErr) {
    console.error("[experiences] role lookup error", dbErr);
    return bad("Server error", 500);
  }
  if (dbUser?.role === "admin") return { admin, user };

  return bad("Forbidden", 403);
}

// GET /api/admin/experiences
export async function GET() {
  const gate = await requireAdmin();
  if ("body" in gate) return gate; // it's a NextResponse error

  const { admin } = gate;
  try {
    const { data, error } = await admin
      .from("Experience")
      .select(
        [
          "id",
          "name",
          "slug",
          "description",
          "price",
          "location",
          "duration",
          "whatsIncluded",
          "whatToBring",
          "whyYoullLove",
          "images",
          "mapPin",
          "guestReviews",
          "frequency",
          "visibility",
          "createdAt",
          "updatedAt",
        ].join(",")
      )
      .order("createdAt", { ascending: false });

    if (error) throw error;
    return ok(data ?? []);
  } catch (e) {
    console.error("[experiences] GET error", e);
    return bad("Failed to fetch experiences", 500);
  }
}

// POST /api/admin/experiences
export async function POST(req) {
  const gate = await requireAdmin();
  if ("body" in gate) return gate;

  const { admin } = gate;
  const body = await req.json().catch(() => null);
  if (!body) return bad("Invalid JSON");

  const {
    name,
    description,
    price,
    location,
    duration,
    whatsIncluded,
    whatToBring,
    whyYoullLove,
    images,
    mapPin,
    guestReviews,
    frequency,
    visibility,
  } = body;

  if (!name || !description || price == null || !location || !duration) {
    return bad("Missing required fields");
  }

  const slug = slugify(String(name), { lower: true, strict: true });
  const payload = {
    name,
    slug,
    description,
    price: Number(price),
    location,
    duration,
    whatsIncluded: whatsIncluded ?? null,
    whatToBring: whatToBring ?? null,
    whyYoullLove: whyYoullLove ?? null,
    images: images ?? null, // JSON/array column
    mapPin: mapPin ?? null, // JSON
    guestReviews: guestReviews ?? null, // JSON/array
    frequency: frequency ?? null, // array/JSON
    visibility: visibility ?? true,
  };

  try {
    const { data, error } = await admin
      .from("Experience")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return ok(data, 201);
  } catch (e) {
    console.error("[experiences] POST error", e);
    return bad("Failed to add experience", 500);
  }
}

// PUT /api/admin/experiences
export async function PUT(req) {
  const gate = await requireAdmin();
  if ("body" in gate) return gate;

  const { admin } = gate;
  const body = await req.json().catch(() => null);
  if (!body) return bad("Invalid JSON");

  const {
    id,
    name,
    description,
    price,
    location,
    duration,
    whatsIncluded,
    whatToBring,
    whyYoullLove,
    images,
    mapPin,
    guestReviews,
    frequency,
    visibility,
  } = body;

  if (!id || !name || !description || price == null || !location || !duration) {
    return bad("Missing required fields");
  }

  const slug = slugify(String(name), { lower: true, strict: true });
  const payload = {
    name,
    slug,
    description,
    price: Number(price),
    location,
    duration,
    whatsIncluded: whatsIncluded ?? null,
    whatToBring: whatToBring ?? null,
    whyYoullLove: whyYoullLove ?? null,
    images: images ?? null,
    mapPin: mapPin ?? null,
    guestReviews: guestReviews ?? null,
    frequency: frequency ?? null,
    visibility: visibility ?? true,
    updatedAt: new Date().toISOString(),
  };

  try {
    const { data, error } = await admin
      .from("Experience")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error?.code === "P2025") return bad("Experience not found", 404);
    if (error) throw error;

    return ok(data);
  } catch (e) {
    console.error("[experiences] PUT error", e);
    return bad("Failed to update experience", 500);
  }
}

// DELETE /api/admin/experiences
export async function DELETE(req) {
  const gate = await requireAdmin();
  if ("body" in gate) return gate;

  const { admin } = gate;
  const { id } = await req.json().catch(() => ({}));
  if (!id) return bad("Experience ID is required");

  try {
    const { data, error } = await admin
      .from("Experience")
      .delete()
      .eq("id", id)
      .select()
      .single();

    // Supabase returns PostgREST errors; adapt messages you had before
    if (error?.code === "P2025") return bad("Experience not found", 404);
    // Foreign key violation (Postgres 23503) -> relate to bookings
    if (error?.code === "23503") {
      return bad(
        "The experience is related to other records (e.g., bookings). Please delete them first.",
        400
      );
    }
    if (error) throw error;

    return ok(data);
  } catch (e) {
    console.error("[experiences] DELETE error", e);
    return bad("Failed to delete experience", 500);
  }
}
