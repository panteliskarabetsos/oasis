// src/lib/bookings/getBookingById.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export async function getBookingById(id) {
  // 1) Load booking
  const { data: booking, error } = await supabase
    .from("booking") // table name from your schema
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[getBookingById] Supabase error:", error);
    throw error;
  }

  if (!booking) return null;

  // 2) Load related Experience (if any)
  let experience = null;

  if (booking.experienceId) {
    const { data: exp, error: expError } = await supabase
      .from("Experience") // table name in your schema: public.Experience
      .select("id, name, location, duration, priceAdult, priceKid")
      .eq("id", booking.experienceId)
      .maybeSingle();

    if (expError) {
      console.error("[getBookingById] Error loading Experience:", expError);
    } else {
      experience = exp;
    }
  }

  // 3) Return booking + attached experience object
  return {
    ...booking,
    experience,
  };
}
