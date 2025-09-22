// src/lib/fetchExperiences.js
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function getExperienceBySlug(slug) {
  if (!slug) return null;

  const admin = createSupabaseAdmin();
  if (!admin) {
    console.error("[fetchExperiences] Supabase admin not configured");
    return null;
  }

  const { data, error, status } = await admin
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
    .eq("slug", slug)
    .eq("visibility", true)
    .maybeSingle();

  if (status === 406) return null; // not found with maybeSingle
  if (error) {
    console.error("[fetchExperiences] getExperienceBySlug error:", error);
    return null;
  }
  return data;
}
