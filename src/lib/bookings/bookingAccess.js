import "server-only";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { accessCan, resolveStaffAccess } from "@/lib/auth/requireAdmin";
import { verifyPortalToken } from "./portalToken";

/**
 * May this caller have the ticket for this booking?
 *
 * The ticket PDF is not a harmless document: its QR carries the booking's
 * reference, which is exactly what the check-in scanner reads. These routes
 * took a bare sequential id and asked nothing, so counting from 1 handed out
 * working tickets — guest names, date, meeting point and all.
 *
 * Three ways to be entitled to it, and one is enough:
 *
 *  1. a portal token, issued after the reference-and-last-name check;
 *  2. a signed-in user the booking belongs to;
 *  3. staff, who can already see every booking in the admin console.
 *
 * @returns {Promise<{ok:true, via:string} | {ok:false, via:null}>}
 */
export async function authorizeBookingAccess(req, bookingId) {
  const id = Number(bookingId);
  if (!Number.isFinite(id) || id <= 0) return DENIED;

  if (portalTokenOk(req, id)) return { ok: true, via: "portal-token" };

  // Anything below needs a session; most callers will not have one.
  let authUser = null;
  try {
    const supa = await createSupabaseServer();
    const { data } = await supa.auth.getUser();
    authUser = data?.user ?? null;
  } catch {
    authUser = null;
  }
  if (!authUser?.id) return DENIED;

  const admin = createSupabaseAdmin();
  if (!admin) return DENIED;

  if (await ownsBooking(admin, authUser, id)) return { ok: true, via: "owner" };

  try {
    const { permissions } = await resolveStaffAccess(authUser);
    if (accessCan(permissions, "bookings")) return { ok: true, via: "staff" };
  } catch {
    /* not staff */
  }

  return DENIED;
}

const DENIED = { ok: false, via: null };

/** The token travels in a header, or as ?token= for links opened directly. */
function portalTokenOk(req, id) {
  let fromQuery = "";
  try {
    fromQuery = new URL(req.url).searchParams.get("token") || "";
  } catch {
    fromQuery = "";
  }
  const token = req?.headers?.get?.("x-booking-token") || fromQuery;
  return Boolean(token) && verifyPortalToken(token, id).ok;
}

/** The booking is theirs if it is filed under their user row, or their email. */
async function ownsBooking(admin, authUser, bookingId) {
  const { data: booking } = await admin
    .from("booking")
    .select('"userId", primary_contact')
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return false;

  const { data: profile } = await admin
    .from("User")
    .select("id, email")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (profile?.id && Number(booking.userId) === Number(profile.id)) return true;

  const mine = String(profile?.email || authUser.email || "").trim().toLowerCase();
  const onBooking = String(booking.primary_contact?.email || "").trim().toLowerCase();
  return Boolean(mine) && mine === onBooking;
}

/** One wording for every refusal, so probing teaches nothing. */
export const ACCESS_DENIED =
  "You do not have access to this booking. Look it up from the guest portal, or sign in.";
