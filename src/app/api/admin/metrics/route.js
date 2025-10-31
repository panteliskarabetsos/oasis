export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// Adjust if your table names differ
const TBL_BOOKING = "Booking";
const TBL_SLOT = "ScheduleSlot";

function utcDayRange(date = new Date()) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}
function startOfUTCNDaysAgo(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}
function bucket7DayTrend(bookings) {
  const buckets = [];
  for (let i = 6; i >= 0; i--) {
    const start = startOfUTCNDaysAgo(i);
    buckets.push({
      key: start.toISOString().slice(0, 10),
      name: start.toLocaleDateString(undefined, { weekday: "short" }),
      value: 0,
    });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const b of bookings || []) {
    if (!b.startTime || b.status === "cancelled") continue;
    const k = new Date(b.startTime).toISOString().slice(0, 10);
    const bucket = byKey.get(k);
    if (bucket) bucket.value += 1;
  }
  return buckets.map(({ name, value }) => ({ name, value }));
}
function reservedCount(b) {
  if (typeof b.numberOfPeople === "number" && !Number.isNaN(b.numberOfPeople)) {
    return b.numberOfPeople;
  }
  const adults = typeof b.adultsCount === "number" ? b.adultsCount : 0;
  const kids = typeof b.kidsCount === "number" ? b.kidsCount : 0;
  return adults + kids > 0 ? adults + kids : 1;
}

export async function GET() {
  // 1) SSR auth: verify current user via cookies using @supabase/ssr
  const cookieStore = await cookies(); // Next.js dynamic API is async
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    // publishable (anon) key; name varies in docs (publishable/anon)
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name, options) {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    }
  );

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = user.app_metadata?.role || user.user_metadata?.role || "user";
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2) Service-role client for privileged reads (metrics)
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

  // 3) Date ranges (UTC by default)
  const { start: todayStart, end: todayEnd } = utcDayRange(new Date());
  const trendStart = startOfUTCNDaysAgo(6);
  const todayStartISO = todayStart.toISOString();
  const todayEndISO = todayEnd.toISOString();
  const trendStartISO = trendStart.toISOString();

  // 4) Queries
  const { data: bookingsToday, error: btErr } = await admin
    .from(TBL_BOOKING)
    .select(
      "id,status,totalPaidAmount,startTime,numberOfPeople,adultsCount,kidsCount,scheduleSlotId"
    )
    .gte("startTime", todayStartISO)
    .lt("startTime", todayEndISO);
  if (btErr) {
    return NextResponse.json(
      { error: "Failed to load bookingsToday", details: btErr.message },
      { status: 500 }
    );
  }

  const { count: pendingApprovals, error: pErr } = await admin
    .from(TBL_BOOKING)
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (pErr) {
    return NextResponse.json(
      { error: "Failed to count pending approvals", details: pErr.message },
      { status: 500 }
    );
  }

  const { data: trendBookings, error: trErr } = await admin
    .from(TBL_BOOKING)
    .select("id,startTime,status")
    .gte("startTime", trendStartISO)
    .lt("startTime", todayEndISO);
  if (trErr) {
    return NextResponse.json(
      { error: "Failed to load trend bookings", details: trErr.message },
      { status: 500 }
    );
  }

  const { data: slots, error: sErr } = await admin
    .from(TBL_SLOT)
    .select("id,totalSlots,isCancelled,date")
    .gte("date", todayStartISO)
    .lt("date", todayEndISO)
    .eq("isCancelled", false);
  if (sErr) {
    return NextResponse.json(
      { error: "Failed to load slots", details: sErr.message },
      { status: 500 }
    );
  }

  let openSlots = 0;
  if (slots?.length) {
    const slotIds = slots.map((s) => s.id);
    const { data: slotBookings, error: sbErr } = await admin
      .from(TBL_BOOKING)
      .select("scheduleSlotId,status,numberOfPeople,adultsCount,kidsCount")
      .in("scheduleSlotId", slotIds);
    if (sbErr) {
      return NextResponse.json(
        { error: "Failed to load slot bookings", details: sbErr.message },
        { status: 500 }
      );
    }

    const capacity = slots.reduce((sum, s) => sum + (s.totalSlots || 0), 0);
    const reserved = (slotBookings || [])
      .filter((b) => b.status !== "cancelled")
      .reduce((sum, b) => sum + reservedCount(b), 0);

    openSlots = Math.max(0, capacity - reserved);
  }

  const activeToday = (bookingsToday || []).filter(
    (b) => b.status !== "cancelled"
  );
  const todayBookings = activeToday.length;
  const revenueToday = activeToday.reduce(
    (sum, b) => sum + (b.totalPaidAmount || 0),
    0
  );
  const trend = bucket7DayTrend(trendBookings);

  return NextResponse.json(
    {
      todayBookings,
      pendingApprovals: pendingApprovals || 0,
      revenueToday,
      openSlots,
      trend,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
