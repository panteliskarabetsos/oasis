export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const TBL_BOOKING = "booking";
const TBL_SLOT = "ScheduleSlot";

// Treat these as "occupied/paid"
const COUNT_STATUSES = new Set([
  "confirmed",
  "completed",
  "checked_in",
  "converted",
  "approved",
]);

/* ------------------------------ Date helpers ------------------------------ */
// Format a Date to "YYYY-MM-DD" in a given time zone (Europe/Athens)
function formatDay(d, timeZone = "Europe/Athens") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`; // YYYY-MM-DD
}
// returns { dayFrom, dayToOpen } where dayToOpen = next day (exclusive upper bound)
function buildDayRange(from, to, timeZone = "Europe/Athens") {
  const dayFrom = formatDay(from, timeZone);
  const toPlusOne = new Date(to);
  toPlusOne.setUTCDate(toPlusOne.getUTCDate() + 1);
  const dayToOpen = formatDay(toPlusOne, timeZone);
  return { dayFrom, dayToOpen };
}
function normalizeISO(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
function eachDayKeys(from, to, timeZone = "Europe/Athens") {
  // inclusive from, exclusive to+1
  const keys = [];
  const start = new Date(from);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(0, 0, 0, 0);
  // we’ll iterate day by day in UTC, but label days using the tz
  for (
    let cur = new Date(start);
    cur <= end;
    cur.setUTCDate(cur.getUTCDate() + 1)
  ) {
    keys.push(formatDay(cur, timeZone));
  }
  return keys;
}
function reservedCount(b) {
  if (typeof b.numberOfPeople === "number" && !Number.isNaN(b.numberOfPeople)) {
    return b.numberOfPeople;
  }
  const adults = typeof b.adultsCount === "number" ? b.adultsCount : 0;
  const kids = typeof b.kidsCount === "number" ? b.kidsCount : 0;
  return adults + kids > 0 ? adults + kids : 1;
}
function estimateRevenue(b) {
  if (
    typeof b.totalPaidAmount === "number" &&
    !Number.isNaN(b.totalPaidAmount)
  ) {
    return b.totalPaidAmount;
  }
  const a = typeof b.adultsCount === "number" ? b.adultsCount : 0;
  const k = typeof b.kidsCount === "number" ? b.kidsCount : 0;
  const puA = typeof b.unitPriceAdult === "number" ? b.unitPriceAdult : 0;
  const puK = typeof b.unitPriceKid === "number" ? b.unitPriceKid : 0;
  const discount = typeof b.discountAmount === "number" ? b.discountAmount : 0;
  return Math.max(0, a * puA + k * puK - discount);
}

/* ---------------------------------- API ---------------------------------- */
export async function GET(req) {
  const url = new URL(req.url);
  const fromQ = normalizeISO(url.searchParams.get("from"));
  const toQ = normalizeISO(url.searchParams.get("to"));
  // default to MTD in Athens time if not provided
  const now = new Date();
  const monthStartAthens = new Date(now);
  // compute Athens month start by reading the current day in tz, then setting to day 1
  const todayKey = formatDay(now, "Europe/Athens"); // YYYY-MM-DD
  const [yyyy, mm] = todayKey.split("-"); // get current month in tz
  const fromDefault = new Date(
    Date.UTC(Number(yyyy), Number(mm) - 1, 1, 0, 0, 0)
  );
  const from = fromQ ?? fromDefault;
  const to = toQ ?? now;

  // Auth
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
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
  if (userErr || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = user.app_metadata?.role || user.user_metadata?.role || "user";
  if (role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Admin client
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

  // ---- CRITICAL: use day strings for timestamp-without-time-zone columns
  const { dayFrom, dayToOpen } = buildDayRange(from, to, "Europe/Athens");

  /* 1) Slots in range (primary clock) */
  const { data: slots, error: sErr } = await admin
    .from(TBL_SLOT)
    .select("id,totalSlots,isCancelled,date")
    .gte("date", dayFrom) // "YYYY-MM-DD"
    .lt("date", dayToOpen) // next day (exclusive)
    .eq("isCancelled", false);

  if (sErr) {
    return NextResponse.json(
      { error: "Failed to load slots", details: sErr.message },
      { status: 500 }
    );
  }

  const slotIds = new Set((slots || []).map((s) => s.id));
  const slotById = new Map((slots || []).map((s) => [s.id, s])); // s.date is string like "2025-11-01T10:00:00"

  /* 2) Bookings linked to slots */
  let bookingsBySlot = [];
  if (slotIds.size > 0) {
    const { data: b1, error: b1Err } = await admin
      .from(TBL_BOOKING)
      .select(
        "id,status,totalPaidAmount,numberOfPeople,adultsCount,kidsCount,unitPriceAdult,unitPriceKid,discountAmount,scheduleSlotId,startTime"
      )
      .in("scheduleSlotId", Array.from(slotIds));
    if (b1Err) {
      return NextResponse.json(
        { error: "Failed to load bookings by slot", details: b1Err.message },
        { status: 500 }
      );
    }
    bookingsBySlot = b1 || [];
  }

  /* 3) Also include bookings with startTime in range (timestamptz) */
  const fromISO = from.toISOString();
  const toISO = to.toISOString();
  const { data: b2, error: b2Err } = await admin
    .from(TBL_BOOKING)
    .select(
      "id,status,totalPaidAmount,numberOfPeople,adultsCount,kidsCount,unitPriceAdult,unitPriceKid,discountAmount,scheduleSlotId,startTime"
    )
    .gte("startTime", fromISO)
    .lt("startTime", toISO);

  if (b2Err) {
    return NextResponse.json(
      { error: "Failed to load time-range bookings", details: b2Err.message },
      { status: 500 }
    );
  }

  // Merge & dedupe
  const merged = new Map();
  for (const b of bookingsBySlot) merged.set(b.id, b);
  for (const b of b2 || []) if (!merged.has(b.id)) merged.set(b.id, b);
  const allBookings = Array.from(merged.values());

  // Keep only "active/occupied" statuses
  const activeBookings = allBookings.filter(
    (b) => b.status && COUNT_STATUSES.has(b.status)
  );

  /* 4) KPIs */
  const capacity = (slots || []).reduce(
    (sum, s) => sum + (s.totalSlots || 0),
    0
  );
  const reservedPeople = activeBookings
    .filter((b) => b.scheduleSlotId && slotById.has(b.scheduleSlotId))
    .reduce((sum, b) => sum + reservedCount(b), 0);

  const openSlotsMTD = Math.max(0, capacity - reservedPeople);
  const occupancyMTDPct = capacity > 0 ? (reservedPeople / capacity) * 100 : 0;
  const bookingsMTD = activeBookings.length;
  const revenueMTD = activeBookings.reduce(
    (sum, b) => sum + estimateRevenue(b),
    0
  );

  // Pending approvals (global)
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

  /* 5) Trend (bucket by slot date if present, else startTime) */
  const dayKeys = eachDayKeys(from, to, "Europe/Athens");
  const bookingsByDay = new Map(dayKeys.map((k) => [k, 0]));
  const revenueByDay = new Map(dayKeys.map((k) => [k, 0]));
  const reservedByDay = new Map(dayKeys.map((k) => [k, 0]));
  const capacityByDay = new Map(dayKeys.map((k) => [k, 0]));

  // capacity per day from slots
  for (const s of slots || []) {
    const k = String(s.date ?? "").slice(0, 10); // YYYY-MM-DD
    if (capacityByDay.has(k)) {
      capacityByDay.set(k, capacityByDay.get(k) + (s.totalSlots || 0));
    }
  }

  // bookings, revenue, reserved per day from active bookings
  for (const b of activeBookings) {
    let k = null;
    if (b.scheduleSlotId && slotById.has(b.scheduleSlotId)) {
      k = String(slotById.get(b.scheduleSlotId).date || "").slice(0, 10);
    } else if (b.startTime) {
      k = new Date(b.startTime).toISOString().slice(0, 10);
    }
    if (!k || !bookingsByDay.has(k)) continue;
    bookingsByDay.set(k, bookingsByDay.get(k) + 1);
    reservedByDay.set(k, reservedByDay.get(k) + reservedCount(b));
    revenueByDay.set(k, revenueByDay.get(k) + estimateRevenue(b));
  }

  // Keep your existing bookings trend for compatibility
  const trend = dayKeys.map((k) => ({
    name: new Date(k + "T00:00:00Z").toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
    }),
    value: bookingsByDay.get(k) || 0,
  }));

  // New: per-day map for all KPIs
  const byDay = Object.fromEntries(
    dayKeys.map((k) => {
      const cap = capacityByDay.get(k) || 0;
      const res = reservedByDay.get(k) || 0;
      const open = Math.max(0, cap - res);
      const occ = cap > 0 ? (res / cap) * 100 : 0;
      return [
        k,
        {
          bookings: bookingsByDay.get(k) || 0,
          revenue: revenueByDay.get(k) || 0,
          openSlots: open,
          occupancyPct: occ,
          capacity: cap,
          reservedPeople: res,
        },
      ];
    })
  );

  /* Return */
  return NextResponse.json(
    {
      from: fromISO,
      to: toISO,
      // MTD (or range) metrics
      bookingsMTD,
      revenueMTD,
      openSlotsMTD,
      occupancyMTDPct,
      pendingApprovals: pendingApprovals || 0,
      trend,
      byDay,
      // Frontend aliases
      bookings: bookingsMTD,
      revenue: revenueMTD,
      openSlots: openSlotsMTD,
      occupancyPct: occupancyMTDPct,

      todayBookings: bookingsMTD,
      revenueToday: revenueMTD,
      occupancyTodayPct: occupancyMTDPct,

      // Debug counts to verify the pipeline (remove if you like)
      _debug: {
        dayFrom,
        dayToOpen,
        slotsCount: slots?.length ?? 0,
        bookingsBySlotCount: bookingsBySlot.length,
        bookingsByStartTimeCount: (b2 || []).length,
        mergedBookingsCount: allBookings.length,
        activeBookingsCount: activeBookings.length,
        capacity,
        reservedPeople,
      },
    },
    { headers: { "cache-control": "no-store" } }
  );
}
