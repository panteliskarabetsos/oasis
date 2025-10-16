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
      let bq = supa
        .from("Booking")
        .select(
          `
          id, status, createdAt, numberOfPeople, notes, scheduleSlotId,
          totalPaidAmount, currency, counts, adultsCount, kidsCount,
          ScheduleSlot:ScheduleSlot(id, date, experienceId, Experience:Experience(id, name)),
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
      let dq = supa
        .from("BookingDraft")
        .select(
          `
          id, status, createdAt, totalAmount, counts, primary_contact, experienceId, scheduleSlotId,
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

/* ---------------------------- mappers ---------------------------- */

function mapBookingRow(b) {
  const slot = b?.ScheduleSlot || {};
  const ex = slot?.Experience || {};
  const u = b?.User || {};
  const c = b?.counts || {};

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

  return {
    id: b.id,
    source: "booking",
    code: `B-${String(b.id).padStart(6, "0")}`,
    startTime: slot?.date || null,
    experienceId: slot?.experienceId || null,
    experienceName: ex?.name || null,
    guestName: [u?.name, u?.surname].filter(Boolean).join(" ") || null,
    guestEmail: u?.email || null,
    guestPhone: u?.phone || null,
    adults,
    kids,

    totalAmount: isNum(b?.totalPaidAmount) ? b.totalPaidAmount : null,
    status: b?.status || "confirmed",
    createdAt: b?.createdAt || null,
  };
}

function mapDraft(d) {
  const slot = d?.ScheduleSlot || {};
  const ex = slot?.Experience || {};
  const pc = d?.primary_contact || {};
  const cnt = d?.counts || {};
  const adults = pickFirstNumber(cnt, ["adults", "adult", "A", "people"]);
  const kids = pickFirstNumber(cnt, ["kids", "children", "K"]);
  return {
    id: d.id,
    source: "draft",
    code: `D-${String(d.id).padStart(6, "0")}`,
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
  };
}

/* ---------------------------- helpers ---------------------------- */
function isNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}
function pickFirstNumber(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (isNum(v)) return v;
  }
  return null;
}
