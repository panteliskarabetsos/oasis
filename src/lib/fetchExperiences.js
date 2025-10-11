// src/lib/fetchExperiences.js
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Fetch a single public experience by slug.
 * Returns: { ...dbFields, pricing: { adult, teen, kid } } or null if not found.
 */
export async function getExperienceBySlug(slug) {
  if (!slug) return null;

  const supa = createSupabaseAdmin();
  if (!supa) {
    console.error("[fetchExperiences] Missing Supabase admin client");
    return null;
  }

  // Select ONLY columns that exist in your current schema
  const { data, error } = await supa
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
      "priceTeen",
      "priceKid"
    `
    )
    .eq("slug", slug)
    .eq("visibility", true)
    .maybeSingle();

  // Not found
  if (!data && !error) return null;

  if (error) {
    // Log with useful fields (the earlier {} log wasn’t helpful)
    console.error("[fetchExperiences] getExperienceBySlug error:", {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });
    return null;
  }

  // Normalize pricing (teen/kid fallback to adult if null)
  const priceAdult = numOr(data.priceAdult, 85);
  const priceTeen = numOr(data.priceTeen, priceAdult);
  const priceKid = numOr(data.priceKid, priceAdult);

  return {
    ...data,
    pricing: { adult: priceAdult, teen: priceTeen, kid: priceKid },
  };
}

/**
 * Optional: fetch public list (used by /experiences). Keeps tiered prices too.
 */
export async function getPublicExperiences() {
  const supa = createSupabaseAdmin();
  if (!supa) return [];

  const { data, error } = await supa
    .from("Experience")
    .select(
      `
      id,
      name,
      slug,
      description,
      location,
      duration,
      images,
      frequency,
      visibility,
      "createdAt",
      "priceAdult",
      "priceTeen",
      "priceKid"
    `
    )
    .eq("visibility", true)
    .order("createdAt", { ascending: false });

  if (error) {
    console.error("[fetchExperiences] getPublicExperiences error:", {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });
    return [];
  }

  return (data || []).map((row) => {
    const priceAdult = numOr(row.priceAdult, 85);
    const priceTeen = numOr(row.priceTeen, priceAdult);
    const priceKid = numOr(row.priceKid, priceAdult);
    return {
      ...row,
      pricing: { adult: priceAdult, teen: priceTeen, kid: priceKid },
    };
  });
}

/* ---------------- helpers ---------------- */
function numOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : Number(fallback) || 0;
}
