// src/app/api/admin/reservations/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { accessCan, resolveStaffAccess } from "@/lib/auth/requireAdmin";
import { expireStaleHolds } from "@/lib/bookings/holds";
import {
  bookingRef,
  legacyBookingId,
  normalizeBookingCode,
} from "@/lib/bookingCode";
import { isMissingSchema } from "@/lib/shop/schema";

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

  const { role, permissions } = await resolveStaffAccess(user);

  if (!accessCan(permissions, "bookings")) {
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
 * - code (a booking reference — BK-XXXX-XXXX, or a bare row id)
 * - status (pending|confirmed|cancelled|draft|paid or empty)
 * - from, to (YYYY-MM-DD)
 * - experienceId (number)
 * - sort (recent | soonest | latest; default recent)
 */
export async function GET(req) {
  const auth = await requireAdmin();
  if (auth.error) return auth.response;
  const supa = auth.admin;

  // Release seats held by unpaid bookings before reading, so the list and the
  // availability it implies are both current. Never throws.
  await expireStaleHolds(supa);

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.max(
      1,
      Math.min(200, Number(searchParams.get("pageSize")) || 20)
    );
    const rawQ = (searchParams.get("q") || "").trim();
    const q = rawQ.toLowerCase();
    const status = (searchParams.get("status") || "").trim();
    const experienceId = Number(searchParams.get("experienceId")) || null;
    const from = (searchParams.get("from") || "").trim();
    const to = (searchParams.get("to") || "").trim();
    const sort = (searchParams.get("sort") || "recent").toLowerCase();

    // A reference from the search box. It is either a booking's own code
    // (BK-XXXX-XXXX) or, for anything predating codes and for drafts, the row
    // id. Both have to resolve: the code is what the guest reads off their
    // email, the id is what the admin sees in the URL.
    const rawCode = (searchParams.get("code") || "").trim().replace(/^#\s*/, "");
    const exactCode = normalizeBookingCode(rawCode);
    const codeId = legacyBookingId(rawCode);
    // "884Q" should find BK-884Q-8FG6. Numeric terms are id searches, so they
    // are left out of this or "372" would drag in every code containing 372.
    const looseCode =
      rawCode && !/^#?\s*\d+$/.test(rawCode)
        ? rawCode.toUpperCase().replace(/[\s-]/g, "")
        : null;

    // Special #ID search: e.g. "#256" or "# 256"
    let idSearch = null;
    const hashMatch = rawQ.match(/^#\s*(\d+)\s*$/);
    if (hashMatch) {
      idSearch = Number(hashMatch[1]);
    }

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
      const bookingColumns = (withCode) => `
    id, ${withCode ? "code," : ""} "userId", "createdAt", "updatedAt",
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
  `;

      // One query, retried without `code` only if this database predates the
      // booking-codes migration — otherwise a missing column would take the
      // whole bookings screen down rather than one field on it.
      const runBookings = async (withCode) => {
        let bq = supa
          .from("booking")
          .select(bookingColumns(withCode))
          .order("createdAt", { ascending: false })
          .limit(2000);

        // Case-insensitive status filter for safety ("Paid" vs "paid")
        if (status) bq = bq.ilike("status", status);
        if (slotIds !== null) bq = bq.in("scheduleSlotId", slotIds);
        return bq;
      };

      if (slotIds !== null && slotIds.length === 0) {
        bookings = [];
      } else {
        let { data: raw, error } = await runBookings(true);
        if (error && isMissingSchema(error)) {
          ({ data: raw, error } = await runBookings(false));
        }
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

    const flatten = (v) =>
      String(v ?? "").toUpperCase().replace(/[\s-]/g, "");

    // 1️⃣ Reference search — the code on the booking, or the row id.
    if (rawCode) {
      merged = merged.filter((r) => {
        if (exactCode && r.code === exactCode) return true;
        if (codeId !== null && Number(r.id) === codeId) return true;
        if (looseCode && looseCode.length >= 3)
          return flatten(r.code).includes(looseCode);
        return false;
      });
    }
    // 2️⃣ Otherwise fall back to normal text search "q"
    else if (q) {
      // A guest quoting their reference down the phone may say "oh" for 0 or
      // read it without the dashes, so the code is matched on its normalized
      // form as well as literally.
      const qCode = normalizeBookingCode(rawQ);
      // Digit-only terms are phone numbers far more often than references, and
      // are matched as such below rather than against every code.
      const qFlat = /[A-Za-z]/.test(rawQ) ? flatten(rawQ) : "";
      const like = (s) => (s || "").toString().toLowerCase().includes(q);
      merged = merged.filter(
        (r) =>
          like(r.code) ||
          (qCode && r.code === qCode) ||
          (qFlat.length >= 4 && flatten(r.code).includes(qFlat)) ||
          like(r.guestName) ||
          like(r.guestEmail) ||
          like(r.guestPhone)
      );
    }

    // Newest first by default. Sorting by trip date put a booking for next
    // summer above one taken this morning, which is the opposite of what the
    // screen is used for; the trip-date orders stay available explicitly.
    const ms = (v) => (v ? new Date(v).getTime() || 0 : 0);
    merged.sort((a, b) => {
      if (sort === "soonest" || sort === "latest") {
        const at = ms(a.startTime);
        const bt = ms(b.startTime);
        // Private bookings carry no slot date; keep them last either way.
        if (at !== bt) {
          if (!at) return 1;
          if (!bt) return -1;
          return sort === "soonest" ? at - bt : bt - at;
        }
      }
      const diff = ms(b.createdAt) - ms(a.createdAt);
      return diff !== 0 ? diff : Number(b.id) - Number(a.id);
    });

    const total = merged.length;

    // Tallied over the whole filtered set, not the page. The bookings screen
    // showed "128 results / 4 confirmed" because it could only count the rows
    // it had been sent; `merged` is already in hand here, so the true figures
    // cost nothing.
    const counts = {};
    let revenue = 0;
    for (const r of merged) {
      const key = String(r?.status || "unknown").toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
      revenue += Number(r?.totalAmount) || 0;
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const items = merged.slice(start, end);

    return ok({ items, total, counts, revenue: Math.round(revenue * 100) / 100 });
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
      // Copied off the slot rather than left null. Everything downstream that
      // reads the booking on its own — the payment-request email above all —
      // had no date to show and fell back to "Date to be determined".
      startTime: slotCheck?.date ?? null,
      experienceId: slotCheck?.experienceId ?? null,
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
      // Where the group is met, and any charge that came with an exceptional
      // one. Dropped on the floor before, so the guest was never told.
      selected_meetup_point: isPlainObject(body.selected_meetup_point)
        ? body.selected_meetup_point
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
    // The reference the guest actually holds — on their email, their ticket
    // and their QR. This used to be a "B-000391" invented here, which matched
    // nothing the guest could quote and nothing the check-in scanner reads.
    code: bookingRef(b),
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
