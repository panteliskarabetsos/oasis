export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const TBL_BOOKING = "Booking";
const COUNT_STATUSES = new Set([
  "confirmed",
  "completed",
  "checked_in",
  "converted",
  "approved",
]);

function reservedCount(b) {
  if (typeof b.numberOfPeople === "number" && !Number.isNaN(b.numberOfPeople))
    return b.numberOfPeople;
  const a = typeof b.adultsCount === "number" ? b.adultsCount : 0;
  const k = typeof b.kidsCount === "number" ? b.kidsCount : 0;
  return a + k > 0 ? a + k : 1;
}

export async function GET(req) {
  const url = new URL(req.url);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || "6", 10),
    50
  );
  const tz = url.searchParams.get("tz") || "Europe/Athens";

  // auth (same as /api/admin/metrics)
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) =>
          cookieStore.set({ name, value, ...options }),
        remove: (name, options) =>
          cookieStore.set({ name, value: "", ...options, maxAge: 0 }),
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

  // admin client
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

  // latest bookings (no created_at dependency)
  const { data: rows, error } = await admin
    .from(TBL_BOOKING)
    .select(
      "id,status,startTime,totalPaidAmount,numberOfPeople,adultsCount,kidsCount"
    )
    .order("startTime", { ascending: false, nullsFirst: true })
    .limit(limit);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load activity", details: error.message },
      { status: 500 }
    );
  }

  const items = (rows || []).map((b) => {
    const count = reservedCount(b);
    const when = b.startTime || new Date().toISOString();
    const whenLabel = new Date(when).toLocaleString(undefined, {
      timeZone: tz,
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const st = (b.status || "").replaceAll("_", " ");
    return {
      id: b.id,
      label: `Booking${st ? ` ${st}` : ""} — ${count} ${
        count === 1 ? "guest" : "guests"
      }`,
      meta: b.startTime ? `For ${whenLabel}` : undefined,
      at: new Date(when).toISOString(),
    };
  });

  return NextResponse.json(items, { headers: { "cache-control": "no-store" } });
}
