// src/app/api/admin/checkins/[id]/route.js
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { accessCan, resolveStaffAccess } from "@/lib/auth/requireAdmin";
import { legacyBookingId, normalizeBookingCode } from "@/lib/bookingCode";

const TBL_BOOKING = "booking";
const TBL_EXPERIENCE = "Experience";

/* ---------------------------------------------
   Utils
----------------------------------------------*/
function formatDayTZ(d = new Date(), tz = "Europe/Athens") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function partySize(b) {
  if (typeof b?.numberOfPeople === "number" && !Number.isNaN(b.numberOfPeople))
    return b.numberOfPeople;
  const a = typeof b?.adultsCount === "number" ? b.adultsCount : 0;
  const k = typeof b?.kidsCount === "number" ? b.kidsCount : 0;
  return a + k > 0 ? a + k : 1;
}

async function getAuthedAdmin() {
  // Auth (SSR)
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (n) => cookieStore.get(n)?.value,
        set: (n, v, o) => cookieStore.set({ name: n, value: v, ...o }),
        remove: (n, o) =>
          cookieStore.set({ name: n, value: "", ...o, maxAge: 0 }),
      },
    }
  );
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user)
    return {
      errorResponse: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };

  const { role, permissions } = await resolveStaffAccess(user);
  if (!accessCan(permissions, "checkins"))
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };

  // Service-role client
  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return {
      errorResponse: NextResponse.json(
        { error: "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      ),
    };
  }
  const admin = createAdminClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { admin, user };
}


/**
 * Resolve a scanned or typed reference to a booking id.
 *
 * A ticket QR carries the booking's reference, which is now a random code like
 * BK-WD7A-FR1X. Tickets printed before codes existed carry "BK-" plus the row
 * id, so both have to resolve — and a code must never be coerced into a number,
 * which would silently admit a different guest.
 */
async function resolveBookingId(admin, raw) {
  const asId = legacyBookingId(raw) ?? (/^\d+$/.test(String(raw ?? "").trim()) ? Number(raw) : null);
  if (asId) return asId;

  const code = normalizeBookingCode(raw);
  if (!code) return null;

  const { data, error } = await admin
    .from("booking")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (error || !data) return null;
  return Number(data.id);
}

/* ---------------------------------------------
   GET /api/admin/checkins/:id
   → Return booking metadata for pop-up (any date)
----------------------------------------------*/
export async function GET(_req, ctx) {
  const { id } = await ctx.params;

  const { admin, errorResponse } = await getAuthedAdmin();
  if (errorResponse) return errorResponse;

  const bookingId = await resolveBookingId(admin, id);
  if (!bookingId) {
    return NextResponse.json({ error: "Invalid booking reference" }, { status: 400 });
  }

  // Pull essential fields
  const { data: b, error } = await admin
    .from(TBL_BOOKING)
    .select(
      [
        "id",
        "code",
        "status",
        "startTime",
        "duration",
        "experienceId",
        "adultsCount",
        "kidsCount",
        "numberOfPeople",
        "primary_contact",
      ].join(",")
    )
    .eq("id", bookingId)
    .single();

  if (error || !b) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Try to fetch experience name (best-effort)
  let experienceName = null;
  if (b.experienceId) {
    const { data: exp } = await admin
      .from(TBL_EXPERIENCE)
      .select("id,name,title")
      .eq("id", b.experienceId)
      .single();
    experienceName = exp?.name || exp?.title || null;
  }

  const pc = b.primary_contact && typeof b.primary_contact === "object" ? b.primary_contact : {};

  return NextResponse.json(
    {
      id: b.id,
      code: b.code ?? null,
      status: b.status,
      startTime: b.startTime,
      duration: b.duration,
      experienceId: b.experienceId,
      experienceName,
      adultsCount: b.adultsCount,
      kidsCount: b.kidsCount,
      numberOfPeople: b.numberOfPeople ?? partySize(b),
      // Flattened for the scanner, which shows a name and a headcount and
      // should not have to know how primary_contact is shaped.
      guestName:
        pc.name || [pc.firstName, pc.lastName].filter(Boolean).join(" ") || null,
      pax: partySize(b),
      primary_contact: b.primary_contact ?? null,
      day: b.startTime
        ? formatDayTZ(new Date(b.startTime), "Europe/Athens")
        : null,
    },
    { headers: { "cache-control": "no-store" } }
  );
}

/* ---------------------------------------------
   PATCH /api/admin/checkins/:id
   → checkin / undo / no_show
   (with "not today" guard for checkin)
----------------------------------------------*/
export async function PATCH(req, ctx) {
  // 👇 IMPORTANT: await params
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "").toLowerCase();

  let nextStatus = null;
  if (action === "checkin") nextStatus = "checked_in";
  else if (action === "undo") nextStatus = "confirmed";
  else if (action === "no_show" || action === "noshow") nextStatus = "no_show";
  else return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  const { admin, errorResponse } = await getAuthedAdmin();
  if (errorResponse) return errorResponse;

  const bookingId = await resolveBookingId(admin, id);
  if (!bookingId) {
    return NextResponse.json({ error: "Invalid booking reference" }, { status: 400 });
  }

  // 1) Read current status + startTime first (idempotency + guard rails)
  const { data: current, error: curErr } = await admin
    .from(TBL_BOOKING)
    .select("id,status,startTime")
    .eq("id", bookingId)
    .single();

  if (curErr || !current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const curr = String(current.status || "").toLowerCase();
  const next = String(nextStatus);

  // --- Guard: check-in only for "today" (Europe/Athens) ---
  if (action === "checkin") {
    const todayAthens = formatDayTZ(new Date(), "Europe/Athens");
    const bookingDayAthens = current.startTime
      ? formatDayTZ(new Date(current.startTime), "Europe/Athens")
      : null;

    if (!bookingDayAthens || bookingDayAthens !== todayAthens) {
      return NextResponse.json(
        { error: "not_today", day: bookingDayAthens },
        { status: 409 }
      );
    }
  }

  // If already in target status → return early with 'already'
  if (curr === next) {
    return NextResponse.json(
      { id: current.id, status: current.status, already: true },
      { headers: { "cache-control": "no-store" } }
    );
  }

  // Guard: prevent invalid transitions
  if (
    (action === "checkin" || action === "no_show" || action === "noshow") &&
    (curr === "cancelled" || curr === "completed")
  ) {
    return NextResponse.json(
      {
        error: `Cannot ${action.replace("_", "-")} a ${curr} booking.`,
        status: curr,
      },
      { status: 409 }
    );
  }

  // 2) Perform the update
  const { data, error } = await admin
    .from(TBL_BOOKING)
    .update({ status: nextStatus, updatedAt: new Date().toISOString() })
    .eq("id", bookingId)
    .select("id,status")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Update failed", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { id: data.id, status: data.status },
    { headers: { "cache-control": "no-store" } }
  );
}
