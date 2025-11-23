// src/app/api/admin/private-reservations/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (data, status = 200) => NextResponse.json(data, { status });
const bad = (msg, status = 400) =>
  NextResponse.json({ error: msg }, { status });

async function requireAdmin() {
  const supa = await createSupabaseServer();
  if (!supa)
    return { error: true, response: bad("Server not configured", 500) };

  const { data, error } = await supa.auth.getUser();
  const user = data?.user;
  if (error || !user)
    return { error: true, response: bad("Unauthorized", 401) };

  const admin = createSupabaseAdmin();
  if (!admin)
    return { error: true, response: bad("Server not configured", 500) };

  const { data: profile } = await admin
    .from("User")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single();

  const role =
    profile?.role ||
    user?.app_metadata?.role ||
    user?.user_metadata?.role ||
    "user";

  if (!["admin", "superadmin"].includes(role)) {
    return { error: true, response: bad("Forbidden", 403) };
  }

  return { error: false, admin, user, role };
}

export async function POST(req) {
  const auth = await requireAdmin();
  if (auth.error) return auth.response;
  const supa = auth.admin;

  let body;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body", 400);
  }

  try {
    // required
    const experienceId = positiveIntOrNull(body.experienceId);
    const customName = String(
      body.customExperienceName || body.experienceTitle || ""
    ).trim();
    const date = String(body.date || "").trim(); // "YYYY-MM-DD"
    const startTimeHM = String(body.startTime || "").trim(); // "HH:mm"
    if (!experienceId && !customName) {
      return bad("Provide either experienceId or customExperienceName", 400);
    }
    if (!isYMD(date)) return bad("date must be YYYY-MM-DD", 400);
    if (!isHM(startTimeHM)) return bad("startTime must be HH:mm", 400);

    // combine to local timestamp (no Z)
    const startTime = `${date}T${startTimeHM}:00`;

    // normalize people/pricing
    const counts = isPlainObject(body.counts) ? body.counts : {};
    const adultsCount =
      pickFirstNumber(counts, ["adults", "adult", "A", "people"]) ??
      intOrNull(body.adultsCount) ??
      1;
    const kidsCount =
      pickFirstNumber(counts, ["kids", "children", "K"]) ??
      intOrNull(body.kidsCount) ??
      0;

    const numberOfPeople =
      intOrNull(body.numberOfPeople) ?? adultsCount + kidsCount;

    const statusAllowed = new Set([
      "pending",
      "confirmed",
      "cancelled",
      "paid",
    ]);
    const status = statusAllowed.has(
      String(body.status || "confirmed").toLowerCase()
    )
      ? String(body.status).toLowerCase()
      : "confirmed";

    const row = {
      scheduleSlotId: null,
      experienceId,
      customExperienceName: customName || null,
      startTime,
      status,
      notes: body.notes ?? null,
      numberOfPeople,
      attendees:
        Array.isArray(body.attendees) && body.attendees.length
          ? body.attendees
          : null,
      counts: Object.keys(counts).length
        ? counts
        : {
            adults: adultsCount,
            kids: kidsCount,
            total: numberOfPeople,
          },
      adultsCount,
      kidsCount,
      unitPriceAdult: numOrNull(body.unitPriceAdult),
      unitPriceKid: numOrNull(body.unitPriceKid),
      totalPaidAmount: numOrNull(body.totalPaidAmount),
      currency: body.currency ?? "EUR",
      primary_contact: isPlainObject(body.primary_contact)
        ? body.primary_contact
        : null,
      stripeSessionId: body.stripeSessionId ?? null,
      stripePaymentIntentId: body.stripePaymentIntentId ?? null,
    };

    const { data: booking, error } = await supa
      .from("booking")
      .insert(row)
      .select(
        `
        id, status, createdAt, numberOfPeople, notes, scheduleSlotId,
        totalPaidAmount, currency, counts, adultsCount, kidsCount,
         startTime, experienceId, customExperienceName,
        Experience:Experience!Booking_experienceId_fkey (id, name),
        User:User(id, email, name, surname, phone)
      `
      )
      .single();

    if (error) throw error;

    return ok({ item: mapBookingRow(booking) }, 201);
  } catch (e) {
    console.error("/api/admin/private-reservations POST error", e);
    return bad(e?.message || "Failed to create private booking", 500);
  }
}

/* ---------------------------- mapper & helpers ---------------------------- */
function mapBookingRow(b) {
  const slot = b?.ScheduleSlot || {};
  const exFromSlot = slot?.Experience || {};
  const exDirect = b?.Experience || {};
  const c = b?.counts || {};
  const u = b?.User || {};

  const adults = isNum(b?.adultsCount)
    ? b.adultsCount
    : isNum(c?.adults)
    ? c.adults
    : isNum(b?.numberOfPeople)
    ? b.numberOfPeople
    : null;

  const kids = isNum(b?.kidsCount)
    ? b.kidsCount
    : isNum(c?.kids)
    ? c.kids
    : null;

  // Prefer slot date, else booking.startTime (private)
  const start = slot?.date || b?.startTime || null;
  // Prefer slot experience, else direct FK
  const exId = slot?.experienceId ?? b?.experienceId ?? null;
  const exName =
    exFromSlot?.name || exDirect?.name || b?.customExperienceName || null;

  return {
    id: b.id,
    source: "booking",
    code: `B-${String(b.id).padStart(6, "0")}`,
    scheduleSlotId: b?.scheduleSlotId ?? null,
    startTime: start,
    experienceId: exId,
    experienceName: exName,
    guestName: [u?.name, u?.surname].filter(Boolean).join(" ") || null,
    guestEmail: u?.email || null,
    guestPhone: u?.phone || null,
    adults,
    kids,
    totalAmount: isNum(b?.totalPaidAmount) ? b.totalPaidAmount : null,
    status: b?.status || "confirmed",
    createdAt: b?.createdAt || null,
    isPrivate: !(b?.scheduleSlotId ?? slot?.id),
  };
}

function isNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}
function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function intOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
function isPlainObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}
function pickFirstNumber(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (isNum(v)) return v;
  }
  return null;
}
function isYMD(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s || "");
}
function isHM(s) {
  return /^\d{2}:\d{2}$/.test(s || "");
}
function positiveIntOrNull(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}
