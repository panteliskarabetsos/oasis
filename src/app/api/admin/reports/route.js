// src/app/api/admin/reports/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

/** Statuses that count as paid/occupied (added 'paid' for completeness) */
const COUNT_STATUSES = new Set([
  "confirmed",
  "completed",
  "checked_in",
  "paid",
]);
const SERIES_TZ = "Europe/Athens";

/* ------------------------------- utils ------------------------------- */
function parseDateParam(value, fallback) {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function ymdTZ(date, tz = SERIES_TZ) {
  const d = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`; // YYYY-MM-DD
}

/** Consistent admin gate with DB role check (matches other endpoints) */
async function requireAdmin() {
  const supa = await createSupabaseServer();
  if (!supa)
    return { error: true, response: bad("Server not configured", 500) };

  const {
    data: { user },
    error,
  } = await supa.auth.getUser();

  if (error || !user)
    return { error: true, response: bad("Unauthorized", 401) };

  // Check role from your User table (consistent with invoices API)
  const { data: row, error: roleErr } = await supa
    .from("User")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const role = roleErr ? "user" : row?.role ?? "user";
  if (role !== "admin") return { error: true, response: bad("Forbidden", 403) };

  const admin = createSupabaseAdmin();
  if (!admin)
    return { error: true, response: bad("Server not configured", 500) };

  return { error: false, admin };
}

/* ------------------------------- route ------------------------------- */
export async function GET(req) {
  const gate = await requireAdmin();
  if (gate.error) return gate.response;
  const admin = gate.admin;

  const url = new URL(req.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const experienceIdParam = url.searchParams.get("experienceId");

  // Defaults: last 90 days
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 90);

  const from = startOfDay(parseDateParam(fromParam, defaultFrom));
  const to = endOfDay(parseDateParam(toParam, today));
  const experienceId = experienceIdParam ? Number(experienceIdParam) : null;

  /* --------------------- fetch core data from Supabase --------------------- */

  // Bookings in window (with nested slot + experience for grouping)
  // Constraint names from your schema:
  //   Booking_scheduleSlotId_fkey, ScheduleSlot_experienceId_fkey
  const bookingSelect = `
    id, status, createdAt, totalPaidAmount, numberOfPeople, adultsCount, kidsCount, userId, scheduleSlotId,
    ScheduleSlot:ScheduleSlot!Booking_scheduleSlotId_fkey (
      id, date, totalSlots, experienceId,
      Experience:Experience!ScheduleSlot_experienceId_fkey ( id, name )
    )
  `;

  let bookingsQ = admin
    .from("booking")
    .select(bookingSelect)
    .gte("createdAt", from.toISOString())
    .lte("createdAt", to.toISOString())
    .order("createdAt", { ascending: true });

  // Apply experience filter at the DB level if provided
  if (Number.isFinite(experienceId)) {
    bookingsQ = bookingsQ.eq("ScheduleSlot.experienceId", experienceId);
  }

  const { data: bookingsRaw, error: bookingsErr } = await bookingsQ;
  if (bookingsErr) return bad(bookingsErr.message, 500);

  // Slots in window (for capacity/occupancy)
  let slotsQ = admin
    .from("ScheduleSlot")
    .select("id, date, totalSlots, experienceId")
    .gte("date", from.toISOString())
    .lte("date", to.toISOString())
    .order("date", { ascending: true });

  if (Number.isFinite(experienceId))
    slotsQ = slotsQ.eq("experienceId", experienceId);

  const { data: slotsRaw, error: slotsErr } = await slotsQ;
  if (slotsErr) return bad(slotsErr.message, 500);

  // Drafts in window (for conversion rate)
  let draftsQ = admin
    .from("BookingDraft")
    .select("id, createdAt, experienceId, convertedBookingId")
    .gte("createdAt", from.toISOString())
    .lte("createdAt", to.toISOString());

  if (Number.isFinite(experienceId))
    draftsQ = draftsQ.eq("experienceId", experienceId);

  const { data: drafts, error: draftsErr } = await draftsQ;
  if (draftsErr) return bad(draftsErr.message, 500);

  // Use raw results (already filtered)
  const bookings = bookingsRaw || [];
  const slots = slotsRaw || [];

  /* ----------------------------- aggregations ----------------------------- */

  const isPaidLike = (s) => COUNT_STATUSES.has((s || "").toLowerCase());
  const paid = bookings.filter((b) => isPaidLike(b.status));

  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  const totalRevenue = paid.reduce((acc, b) => acc + n(b.totalPaidAmount), 0);
  const totalBookings = bookings.length;
  const paidCount = paid.length;
  const avgOrderValue = paidCount ? totalRevenue / paidCount : 0;

  const partySize = (b) => {
    if (typeof b.numberOfPeople === "number") return b.numberOfPeople;
    const a = typeof b.adultsCount === "number" ? b.adultsCount : 0;
    const k = typeof b.kidsCount === "number" ? b.kidsCount : 0;
    return a + k || 1;
  };
  const avgPartySize = paidCount
    ? paid.reduce((acc, b) => acc + partySize(b), 0) / paidCount
    : 0;

  // status distribution
  const byStatus = bookings.reduce((m, b) => {
    const s = (b.status || "unknown").toLowerCase();
    m[s] = (m[s] || 0) + 1;
    return m;
  }, {});

  // bookings & revenue by day (grouping in Europe/Athens)
  const byDay = {};
  const revByDay = {};
  for (const b of bookings) {
    const key = ymdTZ(b.createdAt);
    byDay[key] = (byDay[key] || 0) + 1;
    if (isPaidLike(b.status)) {
      revByDay[key] = (revByDay[key] || 0) + n(b.totalPaidAmount);
    }
  }
  const series = Object.keys(byDay)
    .sort()
    .map((k) => ({ date: k, bookings: byDay[k], revenue: revByDay[k] || 0 }));

  // top experiences by revenue
  const byExp = new Map();
  for (const b of bookings) {
    const expId = b?.ScheduleSlot?.experienceId;
    if (!expId) continue;
    const name = b?.ScheduleSlot?.Experience?.name || `Experience ${expId}`;
    const e = byExp.get(expId) || { id: expId, name, bookings: 0, revenue: 0 };
    e.bookings += 1;
    if (isPaidLike(b.status)) e.revenue += n(b.totalPaidAmount);
    byExp.set(expId, e);
  }
  const topExperiences = Array.from(byExp.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // occupancy = sum(used seats) / sum(capacities) for slots in window
  const capacityBySlot = new Map();
  for (const s of slots) {
    capacityBySlot.set(s.id, {
      date: s.date,
      cap: n(s.totalSlots),
    });
  }
  let used = 0;
  let cap = 0;
  const dailyOcc = {}; // { yyyy-mm-dd: { used, cap } }

  // total capacity
  for (const [, info] of capacityBySlot) cap += info.cap;

  // used seats per day from bookings
  for (const b of bookings) {
    const slot = capacityBySlot.get(b.scheduleSlotId);
    if (!slot) continue;
    if (!isPaidLike(b.status)) continue;
    const ps = partySize(b);
    used += ps;
    const key = ymdTZ(slot.date);
    dailyOcc[key] = dailyOcc[key] || { date: key, used: 0, cap: 0 };
    dailyOcc[key].used += ps;
  }
  // daily capacity from slots
  for (const [, info] of capacityBySlot) {
    const key = ymdTZ(info.date);
    dailyOcc[key] = dailyOcc[key] || { date: key, used: 0, cap: 0 };
    dailyOcc[key].cap += info.cap;
  }
  const occupancyRate = cap > 0 ? used / cap : 0;
  const occupancySeries = Object.values(dailyOcc)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((x) => ({ date: x.date, occupancy: x.cap > 0 ? x.used / x.cap : 0 }));

  // new vs returning within window (window-scoped)
  const byUser = new Map();
  for (const b of bookings)
    byUser.set(b.userId || "anon", (byUser.get(b.userId || "anon") || 0) + 1);
  let newCustomers = 0;
  let returningCustomers = 0;
  for (const cnt of byUser.values()) {
    if (cnt > 1) returningCustomers += 1;
    else newCustomers += 1;
  }

  const totalDrafts = drafts.length;
  const convertedDrafts = drafts.filter((d) => !!d.convertedBookingId).length;
  const conversionRate = totalDrafts > 0 ? convertedDrafts / totalDrafts : 0;

  const statusBreakdown = Object.entries(byStatus)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  return ok({
    window: { from: from.toISOString(), to: to.toISOString(), experienceId },
    kpis: {
      totalRevenue,
      totalBookings,
      avgOrderValue,
      avgPartySize,
      occupancyRate,
      conversionRate,
      newCustomers,
      returningCustomers,
    },
    statusBreakdown,
    topExperiences,
    series,
    occupancySeries,
  });
}
