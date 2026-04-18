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

// helpers
const toNumOrNull = (v) =>
  v === null || v === undefined || v === "" ? null : Number(v);

const isNonNegative = (n) => Number.isFinite(n) && n >= 0;
const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const cleanStr = (v) =>
  v === null || v === undefined ? null : String(v).trim() || null;

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

/**
 * GET /api/admin/experiences
 * All experiences (no visibility filter)
 */
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
        "location",
        "duration",
        "whatsIncluded",
        "whatToBring",
        "whyYoullLove",
        "images",
        "mapPin",
        "meetupPoints",
        "guestReviews",
        "frequency",
        "visibility",
        "createdAt",
        "updatedAt",
        "priceAdult",
        "priceKid",
        "cancellationPolicy", // <-- Added
      ].join(","),
    )
    .order("createdAt", { ascending: false });

  if (error) {
    console.error("[admin/experiences] GET error", error);
    return bad("Failed to fetch experiences", 500);
  }
  return ok(data ?? []);
}

/**
 * POST /api/admin/experiences
 * Create experience (uses tiered pricing)
 * Accepts legacy `price` and maps it to `priceAdult`
 */
export async function POST(req) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const { admin } = gate;
  const body = await req.json().catch(() => null);
  if (!body) return bad("Invalid JSON");

  const {
    name,
    slug,
    description,
    price,
    priceAdult,
    priceKid,
    location,
    duration,
    whatsIncluded,
    whatToBring,
    whyYoullLove,
    cancellationPolicy, // <-- Added
    images,
    mapPin,
    meetupPoints,
    guestReviews,
    frequency,
    visibility,
  } = body;

  if (!name) return bad("Missing required field: name");

  // normalize prices
  let pAdult = toNumOrNull(priceAdult ?? price);
  let pKid = toNumOrNull(priceKid);

  // required: priceAdult (either via priceAdult or legacy price)
  if (!Number.isFinite(pAdult))
    return bad("priceAdult is required (or legacy 'price')");

  // validate non-negative
  if (!isNonNegative(pAdult)) return bad("priceAdult must be ≥ 0");
  if (pKid !== null && !isNonNegative(pKid)) return bad("priceKid must be ≥ 0");

  const nowIso = new Date().toISOString();

  const payload = {
    name,
    slug: slugify(String(slug ?? name), { lower: true, strict: true }),
    description: cleanStr(description),
    location: cleanStr(location) || " Not specified",
    duration: cleanStr(duration),
    whatsIncluded: cleanStr(whatsIncluded),
    whatToBring: cleanStr(whatToBring),
    whyYoullLove: cleanStr(whyYoullLove),
    cancellationPolicy: cleanStr(cancellationPolicy) || "strict", // <-- Default to strict
    images: toArray(images),
    mapPin: cleanStr(mapPin),
    meetupPoints: Array.isArray(meetupPoints) ? meetupPoints : [],
    guestReviews: Array.isArray(guestReviews) ? guestReviews : null,
    frequency: Array.isArray(frequency) ? frequency : [],
    visibility: typeof visibility === "boolean" ? visibility : true,
    priceAdult: pAdult,
    priceKid: pKid,
    updatedAt: nowIso,
  };

  const { data, error } = await admin
    .from("Experience")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("[admin/experiences] POST error", error);
    if (error.code === "23505") return bad("Duplicate value", 409); // unique violation
    return bad("Failed to add experience", 500);
  }
  return ok(data, 201);
}

/**
 * PUT /api/admin/experiences
 * Update experience (tiered pricing)
 * Accepts legacy `price` and maps to priceAdult
 */
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
    priceAdult,
    priceKid,
    location,
    duration,
    whatsIncluded,
    whatToBring,
    whyYoullLove,
    cancellationPolicy, // <-- Added
    images,
    mapPin,
    meetupPoints,
    guestReviews,
    frequency,
    visibility,
  } = body;

  if (!id || !name || !description || !location || !duration) {
    return bad("Missing required fields");
  }

  // normalize prices (only update provided fields; allow partial)
  const pAdult = priceAdult ?? price; // prefer new field
  const pKid = priceKid;

  const payload = {
    name,
    slug: slugify(String(name), { lower: true, strict: true }),
    description,
    location,
    duration,
    whatsIncluded: whatsIncluded ?? null,
    whatToBring: whatToBring ?? null,
    whyYoullLove: whyYoullLove ?? null,
    cancellationPolicy: cancellationPolicy ?? "strict", // <-- Added
    images: Array.isArray(images) ? images : (images ?? null),
    mapPin: mapPin ?? null,
    meetupPoints: Array.isArray(meetupPoints)
      ? meetupPoints
      : (meetupPoints ?? null),
    guestReviews: Array.isArray(guestReviews)
      ? guestReviews
      : (guestReviews ?? null),
    frequency: Array.isArray(frequency) ? frequency : (frequency ?? null),
    visibility: visibility ?? true,
    updatedAt: new Date().toISOString(),
  };

  // Only set price fields if present in request
  if (pAdult !== undefined) {
    const n = Number(pAdult);
    if (!isNonNegative(n)) return bad("priceAdult must be ≥ 0");
    payload.priceAdult = n;
  }

  if (pKid !== undefined) {
    const n = toNumOrNull(pKid);
    if (n !== null && !isNonNegative(n)) return bad("priceKid must be ≥ 0");
    payload.priceKid = n;
  }

  const { data, error, status } = await admin
    .from("Experience")
    .update(payload)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (status === 406) return bad("Experience not found", 404);
  if (error) {
    console.error("[admin/experiences] PUT error", error);
    if (error.code === "23505") return bad("Duplicate value", 409);
    return bad("Failed to update experience", 500);
  }
  return ok(data);
}

/**
 * DELETE /api/admin/experiences
 */
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
    if (error.code === "23503") {
      return bad(
        "The experience is related to other records (e.g., bookings). Please delete them first.",
        400,
      );
    }
    return bad("Failed to delete experience", 500);
  }

  return ok(data);
}
