// src/app/api/admin/reservations/route.js
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

/**
 * GET /api/admin/reservations
 * Query params:
 * - page (default 1)
 * - pageSize (default 20)
 * - q (search: name/email/phone/code)
 * - status (pending|confirmed|cancelled|draft|paid or empty)
 * - from, to (YYYY-MM-DD)
 * - experienceId (number)
 */
export async function GET(req) {
  const auth = await requireAdmin();
  if (auth.error) return auth.response;
  const supa = auth.admin;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.max(
      1,
      Math.min(200, Number(searchParams.get("pageSize")) || 20)
    );
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const status = (searchParams.get("status") || "").trim();
    const experienceId = Number(searchParams.get("experienceId")) || null;
    const from = (searchParams.get("from") || "").trim();
    const to = (searchParams.get("to") || "").trim();

    const fromTs = from ? `${from}T00:00:00` : null;
    const toTs = to ? `${to}T23:59:59.999` : null;

    // ---- optional pre-filter on slots ----
    let slotIds = null;
    if (experienceId || fromTs || toTs) {
      let slotQ = supa
        .from("ScheduleSlot")
        .select("id, date, isCancelled, experienceId")
        .eq("isCancelled", false);
      if (experienceId) slotQ = slotQ.eq("experienceId", experienceId);
      if (fromTs) slotQ = slotQ.gte("date", fromTs);
      if (toTs) slotQ = slotQ.lte("date", toTs);
      const { data: slots, error: slotsErr } = await slotQ.limit(3000);
      if (slotsErr) throw slotsErr;
      slotIds = (slots || []).map((s) => s.id);
    }

    // ---- BOOKINGS (finalized) ----
    let bookings = [];
    if (status !== "draft") {
      // inside GET, replace the Booking select with this:
      let bq = supa
        .from("booking")
        .select(
          `
    id, "userId", "createdAt", "updatedAt",
    "scheduleSlotId", status, notes, "numberOfPeople",
    attendees, counts, "adultsCount", "kidsCount",
    "unitPriceAdult", "unitPriceKid", "totalPaidAmount", currency,
    primary_contact, "stripeSessionId", "stripePaymentIntentId",
    "startTime", "experienceId", "customExperienceName", duration,

    ScheduleSlot:ScheduleSlot(
      id, date, "experienceId",
      Experience:Experience(id, name)
    ),

    Experience:Experience!Booking_experienceId_fkey(id, name),

    User:User(id, email, name, surname, phone)
  `
        )
        .order("createdAt", { ascending: false })
        .limit(2000);

      // Case-insensitive status filter for safety ("Paid" vs "paid")
      if (status) bq = bq.ilike("status", status);

      if (slotIds !== null) {
        if (slotIds.length === 0) {
          bookings = [];
        } else {
          bq = bq.in("scheduleSlotId", slotIds);
          const { data: raw, error } = await bq;
          if (error) throw error;
          bookings = (raw || []).map(mapBookingRow);
        }
      } else {
        const { data: raw, error } = await bq;
        if (error) throw error;
        bookings = (raw || []).map(mapBookingRow);
      }
    }

    // ---- DRAFTS (in-progress / converted) ----
    let drafts = [];
    {
      // Keep your existing BookingDraft select, or expand if you store more columns there.
      let dq = supa
        .from("BookingDraft")
        .select(
          `
    id, status, createdAt, totalAmount, counts, primary_contact,
    experienceId, scheduleSlotId,
    ScheduleSlot:ScheduleSlot(id, date, experienceId, Experience:Experience(id, name))
  `
        )
        .order("createdAt", { ascending: false })
        .limit(2000);

      if (status) dq = dq.ilike("status", status);

      if (slotIds !== null) {
        if (slotIds.length === 0) {
          drafts = [];
        } else {
          dq = dq.in("scheduleSlotId", slotIds);
          const { data: raw, error } = await dq;
          if (error) throw error;
          drafts = (raw || []).map(mapDraft);
        }
      } else {
        const { data: raw, error } = await dq;
        if (error) throw error;
        drafts = (raw || []).map(mapDraft);
      }
    }

    // merge + search
    let merged = [...bookings, ...drafts];
    if (q) {
      const like = (s) => (s || "").toString().toLowerCase().includes(q);
      merged = merged.filter(
        (r) =>
          like(r.code) ||
          like(r.guestName) ||
          like(r.guestEmail) ||
          like(r.guestPhone)
      );
    }

    // sort by startTime desc then createdAt desc
    merged.sort((a, b) => {
      const at = a.startTime ? new Date(a.startTime).getTime() : 0;
      const bt = b.startTime ? new Date(b.startTime).getTime() : 0;
      if (bt !== at) return bt - at;
      const ac = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bc = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bc - ac;
    });

    const total = merged.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const items = merged.slice(start, end);

    return ok({ items, total });
  } catch (e) {
    console.error("/api/admin/reservations GET error", e);
    return bad(e?.message || "Failed to load reservations", 500);
  }
}

// --- add below your GET ---
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
    const mode = String(body.mode || "public").toLowerCase();

    // ---- resolve / create slot ----
    let scheduleSlotId = intOrNull(body.scheduleSlotId);
    if (mode === "private") {
      const experienceId = intOrNull(body.experienceId);
      const date = (body.date || "").trim();
      const startTime = (body.startTime || "").trim();
      if (!experienceId)
        return bad("experienceId is required for private bookings", 400);
      if (!isYMD(date)) return bad("date must be YYYY-MM-DD", 400);
      if (!isHM(startTime)) return bad("startTime must be HH:mm", 400);

      const slotDate = `${date}T${startTime}:00`;
      const { data: slot, error: slotErr } = await supa
        .from("ScheduleSlot")
        .insert({
          experienceId,
          date: slotDate,
          isCancelled: false,
        })
        .select("id, date, experienceId")
        .single();
      if (slotErr) throw slotErr;
      scheduleSlotId = slot.id;
    }

    if (!scheduleSlotId)
      return bad("scheduleSlotId is required for public bookings", 400);

    // Ensure slot exists and is active
    const { data: slotCheck, error: slotCheckErr } = await supa
      .from("ScheduleSlot")
      .select(
        "id, isCancelled, date, experienceId, Experience:Experience(id, name)"
      )
      .eq("id", scheduleSlotId)
      .single();
    if (slotCheckErr) throw slotCheckErr;
    if (!slotCheck || slotCheck.isCancelled)
      return bad("Slot not found or cancelled", 400);

    // ---- normalize payload for Booking table ----
    const counts = isPlainObject(body.counts) ? body.counts : {};
    const adultsCount =
      pickFirstNumber(counts, ["adults", "adult", "A", "people"]) ??
      intOrNull(body.adultsCount);
    const kidsCount =
      pickFirstNumber(counts, ["kids", "children", "K"]) ??
      intOrNull(body.kidsCount);
    const numberOfPeople =
      intOrNull(body.numberOfPeople) ??
      (isNum(adultsCount) || isNum(kidsCount)
        ? (adultsCount || 0) + (kidsCount || 0)
        : 1);

    const allowedStatus = new Set([
      "pending",
      "confirmed",
      "cancelled",
      "paid",
    ]);
    const status = String(body.status || "confirmed").toLowerCase();
    const finalStatus = allowedStatus.has(status) ? status : "confirmed";

    const row = {
      userId: intOrNull(body.userId) ?? null,
      scheduleSlotId,
      status: finalStatus,
      notes: body.notes ?? null,
      numberOfPeople,
      attendees: isArray(body.attendees) ? body.attendees : null,
      counts: Object.keys(counts).length ? counts : null,
      adultsCount: isNum(adultsCount) ? adultsCount : null,
      kidsCount: isNum(kidsCount) ? kidsCount : null,
      unitPriceAdult: numOrNull(body.unitPriceAdult),
      unitPriceKid: numOrNull(body.unitPriceKid),
      totalPaidAmount: numOrNull(body.totalPaidAmount),
      currency: body.currency ?? null,
      primary_contact: isPlainObject(body.primary_contact)
        ? body.primary_contact
        : null,
      stripeSessionId: body.stripeSessionId ?? null,
      stripePaymentIntentId: body.stripePaymentIntentId ?? null,
    };

    // ---- insert Booking ----
    const { data: booking, error: insErr } = await supa
      .from("booking")
      .insert(row)
      .select(
        `
        id, status, createdAt, numberOfPeople, notes, scheduleSlotId,
        totalPaidAmount, currency, counts, adultsCount, kidsCount,
        ScheduleSlot:ScheduleSlot(id, date, experienceId, Experience:Experience(id, name)),
        User:User(id, email, name, surname, phone)
      `
      )
      .single();

    if (insErr) throw insErr;

    return ok({ item: mapBookingRow(booking) }, 201);
  } catch (e) {
    console.error("/api/admin/reservations POST error", e);
    return bad(e?.message || "Failed to create booking", 500);
  }
}

/* ---------------------------- mappers ---------------------------- */

function mapBookingRow(b) {
  const slot = b?.ScheduleSlot || {};
  const exFromSlot = slot?.Experience || {};
  const exDirect = b?.Experience || {};
  const u = b?.User || {};
  const c = b?.counts || {};

  // Adults/Kids computed with sensible fallbacks
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

  // Prefer slot date; else booking.startTime (private)
  const startTime = slot?.date || b?.startTime || null;

  // Prefer slot experience id/name; else booking FK; else custom name
  const experienceId = slot?.experienceId ?? b?.experienceId ?? null;

  const experienceName =
    exFromSlot?.name || exDirect?.name || b?.customExperienceName || null;

  const scheduleSlotId = b?.scheduleSlotId ?? slot?.id ?? null;

  const guestName =
    [u?.name, u?.surname].filter(Boolean).join(" ").trim() ||
    b?.primary_contact?.name ||
    [b?.primary_contact?.firstName, b?.primary_contact?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    null;

  const guestEmail = u?.email || b?.primary_contact?.email || null;
  const guestPhone = u?.phone || b?.primary_contact?.phone || null;

  return {
    // --- existing list fields (backward compatible) ---
    id: b.id,
    source: "booking",
    code: `B-${String(b.id).padStart(6, "0")}`,
    scheduleSlotId,
    startTime,
    experienceId,
    experienceName,
    guestName,
    guestEmail,
    guestPhone,
    adults,
    kids,
    totalAmount: isNum(b?.totalPaidAmount) ? b.totalPaidAmount : null,
    status: b?.status || "confirmed",
    createdAt: b?.createdAt || null,

    // convenience
    isPrivate: !scheduleSlotId,

    // --- full DB payload for table/detail views ---
    userId: b?.userId ?? null,
    updatedAt: b?.updatedAt ?? null,
    notes: b?.notes ?? null,
    numberOfPeople: b?.numberOfPeople ?? null,
    attendees: b?.attendees ?? null,
    counts: b?.counts ?? null,
    adultsCount: b?.adultsCount ?? null,
    kidsCount: b?.kidsCount ?? null,
    unitPriceAdult: b?.unitPriceAdult ?? null,
    unitPriceKid: b?.unitPriceKid ?? null,
    totalPaidAmount: b?.totalPaidAmount ?? null,
    currency: b?.currency ?? null,
    primary_contact: b?.primary_contact ?? null,
    stripeSessionId: b?.stripeSessionId ?? null,
    stripePaymentIntentId: b?.stripePaymentIntentId ?? null,
    customExperienceName: b?.customExperienceName ?? null,
    duration: b?.duration ?? null,

    // nested (if you want them handy for UI)
    user: u?.id
      ? {
          id: u.id,
          email: u.email,
          name: u.name,
          surname: u.surname,
          phone: u.phone,
        }
      : null,
    slot: scheduleSlotId
      ? {
          id: scheduleSlotId,
          date: slot?.date || null,
          experienceId: slot?.experienceId ?? null,
        }
      : null,
  };
}

function mapDraft(d) {
  const slot = d?.ScheduleSlot || {};
  const ex = slot?.Experience || {};
  const pc = d?.primary_contact || {};
  const cnt = d?.counts || {};
  const adults = pickFirstNumber(cnt, ["adults", "adult", "A", "people"]);
  const kids = pickFirstNumber(cnt, ["kids", "children", "K"]);

  const scheduleSlotId = d?.scheduleSlotId ?? slot?.id ?? null;

  return {
    id: d.id,
    source: "draft",
    code: `D-${String(d.id).padStart(6, "0")}`,
    scheduleSlotId,
    startTime: slot?.date || null,
    experienceId: slot?.experienceId || d?.experienceId || null,
    experienceName: ex?.name || null,
    guestName:
      pc?.name ??
      pc?.fullName ??
      ([pc?.firstName, pc?.lastName].filter(Boolean).join(" ").trim() || null),
    guestEmail: pc?.email ?? null,
    guestPhone: pc?.phone || null,
    adults,
    kids,
    totalAmount: isNum(d?.totalAmount) ? d.totalAmount : null,
    status: d?.status || "draft",
    createdAt: d?.createdAt || null,
    isPrivate: !scheduleSlotId,

    // pass-through commonly used draft fields
    counts: d?.counts ?? null,
    primary_contact: d?.primary_contact ?? null,
  };
}

/* ---------------------------- helpers ---------------------------- */
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
function isArray(v) {
  return Array.isArray(v);
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
