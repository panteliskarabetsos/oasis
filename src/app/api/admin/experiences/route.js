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
  const supa = await createSupabaseServer();
  if (!supa) return bad("Server not configured", 500);

  const { data: userRes, error: userErr } = await supa.auth.getUser();
  if (userErr || !userRes?.user) return bad("Unauthorized", 401);

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const user = userRes.user;
  const metaRole = user?.app_metadata?.role || user?.user_metadata?.role;
  if (metaRole === "admin") return { admin, user };

  const { data: dbUser, error: dbErr } = await admin
    .from("User")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (dbErr) {
    console.error("[admin/experiences] role lookup error", dbErr);
    return bad("Server error", 500);
  }
  if (dbUser?.role === "admin") return { admin, user };

  return bad("Forbidden", 403);
}

// GET /api/admin/experiences  (all experiences, no visibility filter)
export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const { admin } = gate;
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

  if (error) {
    console.error("[admin/experiences] GET error", error);
    return bad("Failed to fetch experiences", 500);
  }
  return ok(data ?? []);
}

// POST /api/admin/experiences  (create)
export async function POST(req) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

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

  const payload = {
    name,
    slug: slugify(String(name), { lower: true, strict: true }),
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
  };

  const { data, error } = await admin
    .from("Experience")
    .insert(payload)
    .select()
    .single();
  if (error) {
    console.error("[admin/experiences] POST error", error);
    // 23505 = unique violation (e.g. duplicate slug)
    if (error.code === "23505") return bad("Duplicate value", 409);
    return bad("Failed to add experience", 500);
  }
  return ok(data, 201);
}

// PUT /api/admin/experiences  (update)
export async function PUT(req) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

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

  const payload = {
    name,
    slug: slugify(String(name), { lower: true, strict: true }),
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

  const { data, error, status } = await admin
    .from("Experience")
    .update(payload)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (status === 406) return bad("Experience not found", 404); // no row matched
  if (error) {
    console.error("[admin/experiences] PUT error", error);
    if (error.code === "23505") return bad("Duplicate value", 409);
    return bad("Failed to update experience", 500);
  }
  return ok(data);
}

// DELETE /api/admin/experiences  (delete)
export async function DELETE(req) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const { admin } = gate;
  const { id } = await req.json().catch(() => ({}));
  if (!id) return bad("Experience ID is required");

  const { data, error, status } = await admin
    .from("Experience")
    .delete()
    .eq("id", id)
    .select()
    .maybeSingle();

  if (status === 406) return bad("Experience not found", 404);
  if (error) {
    console.error("[admin/experiences] DELETE error", error);
    // 23503 = foreign key violation (e.g., bookings referencing this)
    if (error.code === "23503") {
      return bad(
        "The experience is related to other records (e.g., bookings). Please delete them first.",
        400
      );
    }
    return bad("Failed to delete experience", 500);
  }

  return ok(data);
}
