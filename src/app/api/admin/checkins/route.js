export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const TBL_BOOKING = "Booking";
const TBL_SLOT = "ScheduleSlot";
const TBL_EXPERIENCE = "Experience";

function formatDay(d = new Date(), tz = "Europe/Athens") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
function normalizeISO(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req) {
  const url = new URL(req.url);
  const tz = url.searchParams.get("tz") || "Europe/Athens";
  const dateQ = url.searchParams.get("date");
  const date = dateQ
    ? normalizeISO(dateQ + "T00:00:00") || new Date()
    : new Date();
  const dayFrom = formatDay(date, tz);
  const dayToOpen = formatDay(new Date(date.getTime() + 24 * 3600 * 1000), tz);

  // Auth
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

  // Slots for the day
  const { data: slots, error: sErr } = await admin
    .from(TBL_SLOT)
    .select("id,experienceId,date,totalSlots,isCancelled")
    .gte("date", dayFrom)
    .lt("date", dayToOpen)
    .eq("isCancelled", false)
    .order("date", { ascending: true });

  if (sErr)
    return NextResponse.json(
      { error: "Failed to load slots", details: sErr.message },
      { status: 500 }
    );

  const slotIds = (slots || []).map((s) => s.id);
  let bookings = [];
  if (slotIds.length) {
    const { data: b, error: bErr } = await admin
      .from(TBL_BOOKING)
      .select(
        "id,status,primary_contact,adultsCount,kidsCount,numberOfPeople,totalPaidAmount,scheduleSlotId"
      )
      .in("scheduleSlotId", slotIds)
      .order("id", { ascending: true });
    if (bErr)
      return NextResponse.json(
        { error: "Failed to load bookings", details: bErr.message },
        { status: 500 }
      );
    bookings = b || [];
  }

  // Experience names
  const expIds = Array.from(
    new Set((slots || []).map((s) => s.experienceId).filter(Boolean))
  );
  let expMap = new Map();
  if (expIds.length) {
    const { data: exps, error: eErr } = await admin
      .from(TBL_EXPERIENCE)
      .select("id,name")
      .in("id", expIds);
    if (eErr)
      return NextResponse.json(
        { error: "Failed to load experiences", details: eErr.message },
        { status: 500 }
      );
    expMap = new Map((exps || []).map((x) => [x.id, x.name]));
  }

  // Group
  const bySlot = new Map(
    slots.map((s) => [
      s.id,
      {
        ...s,
        experienceName: expMap.get(s.experienceId) || null,
        bookings: [],
      },
    ])
  );
  for (const b of bookings) {
    const s = bySlot.get(b.scheduleSlotId);
    if (s) s.bookings.push(b);
  }

  return NextResponse.json(
    {
      date: dayFrom,
      slots: Array.from(bySlot.values()),
      totals: {
        slots: slots.length,
        bookings: bookings.length,
      },
    },
    { headers: { "cache-control": "no-store" } }
  );
}
