// src/app/api/admin/checkins/[id]/route.js
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const TBL_BOOKING = "Booking";

export async function PATCH(req, ctx) {
  // 👇 IMPORTANT: await params
  const { id } = await ctx.params;
  const bookingId = Number(id);
  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "").toLowerCase();

  let nextStatus = null;
  if (action === "checkin") nextStatus = "checked_in";
  else if (action === "undo") nextStatus = "confirmed";
  else if (action === "no_show" || action === "noshow") nextStatus = "no_show";
  else return NextResponse.json({ error: "Unknown action" }, { status: 400 });

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = user.app_metadata?.role || user.user_metadata?.role || "user";
  if (role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Service-role client
  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json(
      { error: "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }
  const admin = createAdminClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) Read current status first (idempotency + guard rails)
  const { data: current, error: curErr } = await admin
    .from(TBL_BOOKING)
    .select("id,status")
    .eq("id", bookingId)
    .single();

  if (curErr || !current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const curr = String(current.status || "").toLowerCase();
  const next = String(nextStatus);

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
