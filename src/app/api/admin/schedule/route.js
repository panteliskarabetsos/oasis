// src/app/api/admin/schedule/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/* ---------------------------- helpers ---------------------------- */
const bad = (msg, status = 400) =>
  NextResponse.json({ error: msg }, { status });
const ok = (data, status = 200) => NextResponse.json(data, { status });
const isResponse = (x) =>
  x && typeof x === "object" && "headers" in x && "status" in x && "ok" in x;

const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};
const toISO = (v) => {
  const d = new Date(v);
  const t = d.getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};
const parseBool = (v, def = false) =>
  v == null
    ? def
    : ["1", "true", "yes", "on"].includes(String(v).toLowerCase());

const COUNT_BOOKING_STATUSES = ["confirmed", "completed", "checked_in"];
const ACTIVE_DRAFT_STATUSES = ["draft", "checkout"];

async function computeUsage(admin, slotIds) {
  const nowIso = new Date().toISOString();
  const idList = [
    ...new Set(slotIds.filter((x) => Number.isInteger(x) && x > 0)),
  ];
  const usage = {};
  for (const id of idList) usage[id] = { booked: 0, holds: 0, occupied: 0 };
  if (idList.length === 0) return usage;

  // Sum seats from bookings (all rows are confirmed by definition)
  const { data: bookings, error: bookErr } = await admin
    .from("booking")
    .select("scheduleSlotId, numberOfPeople")
    .in("scheduleSlotId", idList);

  if (bookErr) {
    console.error("[admin/schedule] bookings sum error:", bookErr);
    throw new Error("Server error");
  }

  (bookings || []).forEach((b) => {
    const sid = Number(b.scheduleSlotId);
    const n = Number(b.numberOfPeople ?? 0) || 0;
    if (usage[sid]) usage[sid].booked += n;
  });

  // Sum seats from active holds (unexpired drafts/checkout)
  const { data: drafts, error: draftErr } = await admin
    .from("BookingDraft")
    .select("scheduleSlotId, counts, expiresAt, status")
    .in("scheduleSlotId", idList)
    .in("status", ACTIVE_DRAFT_STATUSES);

  if (draftErr) {
    console.error("[admin/schedule] holds sum error:", draftErr);
    throw new Error("Server error");
  }

  (drafts || []).forEach((d) => {
    const sid = Number(d.scheduleSlotId);
    const expAt = d.expiresAt ? new Date(d.expiresAt).toISOString() : null;
    if (!expAt || expAt <= nowIso) return; // ignore null/expired holds
    const adults = Number(d?.counts?.adults ?? 0) || 0;
    const kids = Number(d?.counts?.kids ?? 0) || 0;
    if (usage[sid]) usage[sid].holds += adults + kids;
  });

  for (const sid of Object.keys(usage)) {
    usage[sid].occupied = usage[sid].booked + usage[sid].holds;
  }
  return usage;
}

async function requireAdmin() {
  const supa = await createSupabaseServer().catch(() => null);
  if (!supa?.auth?.getSession) {
    console.error("[admin/schedule] Supabase server client unavailable");
    return bad(
      "Server misconfiguration. Check NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      500
    );
  }

  const {
    data: { session },
    error,
  } = await supa.auth.getSession();

  if (error || !session?.user)
    return bad("Unauthorized – No active session", 401);

  const user = session.user;
  const metaRole = user.app_metadata?.role || user.user_metadata?.role;

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  if (metaRole === "admin") return { user, admin };

  // Fallback to DB role check (public."User" with auth_user_id)
  const { data: dbUser, error: dbErr } = await admin
    .from("User")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (dbErr) {
    console.error("[admin/schedule] role lookup error", dbErr);
    return bad("Server error", 500);
  }
  if (dbUser?.role === "admin") return { user, admin };

  return bad("Unauthorized – Admin access required", 403);
}

/* ------------------------------ GET ------------------------------ */
// GET: list slots (filters: experienceId [required], from, to, includeCancelled=true/false, withUsage=false)
export async function GET(req) {
  const gate = await requireAdmin();
  if (isResponse(gate)) return gate;

  const { admin } = gate;
  const { searchParams } = new URL(req.url);

  const experienceId = toInt(searchParams.get("experienceId"));
  if (!Number.isInteger(experienceId) || experienceId <= 0) {
    return bad("Experience ID required", 400);
  }

  const includeCancelled = parseBool(
    searchParams.get("includeCancelled"),
    true
  );
  const withUsage = parseBool(searchParams.get("withUsage"), false);
  const fromIso = searchParams.get("from")
    ? toISO(searchParams.get("from"))
    : null;
  const toIso = searchParams.get("to") ? toISO(searchParams.get("to")) : null;

  let q = admin
    .from("ScheduleSlot")
    .select("id,experienceId,date,totalSlots,isCancelled,createdAt,updatedAt")
    .eq("experienceId", experienceId);

  if (!includeCancelled) q = q.eq("isCancelled", false);
  if (fromIso) q = q.gte("date", fromIso);
  if (toIso) q = q.lt("date", toIso);

  q = q.order("date", { ascending: true });

  const { data: slots, error } = await q;
  if (error) {
    console.error("GET /admin/schedule error:", error);
    return bad("Server error", 500);
  }

  if (!withUsage || !slots?.length) return ok(slots ?? []);

  const slotIds = slots.map((s) => Number(s.id));
  try {
    const usage = await computeUsage(admin, slotIds);
    const enriched = (slots || []).map((s) => {
      const u = usage[s.id] || { booked: 0, holds: 0, occupied: 0 };
      const available = Math.max(0, Number(s.totalSlots) - u.occupied);
      return { ...s, ...u, available };
    });
    return ok(enriched);
  } catch {
    return bad("Server error", 500);
  }
}

/* ------------------------------ POST ----------------------------- */
// POST: create a slot (prevents duplicates on exact same datetime per experience)
export async function POST(req) {
  const gate = await requireAdmin();
  if (isResponse(gate)) return gate;

  const { admin } = gate;
  const body = await req.json().catch(() => null);
  if (!body) return bad("Invalid JSON", 400);

  const expId = toInt(body.experienceId);
  const dateIso = toISO(body.date);
  const totalSlots = Number(body.totalSlots);

  if (!Number.isInteger(expId) || expId <= 0 || !dateIso) {
    return bad("Missing or invalid fields (experienceId, date)", 400);
  }
  if (!Number.isInteger(totalSlots) || totalSlots < 0) {
    return bad("Invalid totalSlots", 400);
  }
  if (new Date(dateIso).getTime() < Date.now()) {
    return bad("Cannot create slot in the past", 400);
  }

  // Prevent exact duplicate (recommend a unique index on (experienceId, date))
  const { data: existing, error: existErr } = await admin
    .from("ScheduleSlot")
    .select("id")
    .eq("experienceId", expId)
    .eq("date", dateIso)
    .maybeSingle();

  if (existErr) {
    console.error("POST /admin/schedule duplicate check error:", existErr);
    return bad("Server error", 500);
  }
  if (existing) return bad("A slot for this date already exists", 409);

  const nowIso = new Date().toISOString();
  const payload = {
    experienceId: expId,
    date: dateIso,
    totalSlots,
    isCancelled: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const { data, error } = await admin
    .from("ScheduleSlot")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("POST /admin/schedule error:", error);
    return bad("Server error", 500);
  }
  return ok(data, 201);
}

/* ------------------------------- PUT ----------------------------- */
// PUT: update totalSlots (ensure >= current booked + active holds)
export async function PUT(req) {
  const gate = await requireAdmin();
  if (isResponse(gate)) return gate;

  const { admin } = gate;
  const body = await req.json().catch(() => null);
  if (!body) return bad("Invalid JSON", 400);

  const id = toInt(body.id);
  const totalSlots = Number(body.totalSlots);

  if (!Number.isInteger(id) || id <= 0)
    return bad("Missing or invalid id", 400);
  if (!Number.isInteger(totalSlots) || totalSlots < 0)
    return bad("Invalid totalSlots", 400);

  const { data: slot, error: getErr } = await admin
    .from("ScheduleSlot")
    .select("id, totalSlots, experienceId, date, isCancelled")
    .eq("id", id)
    .maybeSingle();

  if (getErr) {
    console.error("PUT /admin/schedule fetch error:", getErr);
    return bad("Server error", 500);
  }
  if (!slot) return bad("Slot not found", 404);

  // Compute occupancy for this slot
  let usage;
  try {
    usage = await computeUsage(admin, [id]);
  } catch {
    return bad("Server error", 500);
  }
  const { booked = 0, holds = 0, occupied = 0 } = usage[id] || {};
  if (totalSlots < booked)
    return bad(`Cannot set totalSlots below booked seats (${booked}).`, 400);
  if (totalSlots < occupied)
    return bad(
      `Cannot set totalSlots below booked+active holds (${occupied}).`,
      400
    );

  const { data, error: updErr } = await admin
    .from("ScheduleSlot")
    .update({ totalSlots, updatedAt: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (updErr) {
    console.error("PUT /admin/schedule update error:", updErr);
    return bad("Server error", 500);
  }
  return ok({
    ...data,
    booked,
    holds,
    available: Math.max(0, totalSlots - occupied),
  });
}

/* ------------------------------ PATCH ---------------------------- */
// PATCH: toggle cancel/un-cancel a slot (body: { id, isCancelled })
export async function PATCH(req) {
  const gate = await requireAdmin();
  if (isResponse(gate)) return gate;

  const { admin } = gate;
  const body = await req.json().catch(() => null);
  if (!body) return bad("Invalid JSON", 400);

  const id = toInt(body.id);
  const isCancelled =
    typeof body.isCancelled === "boolean" ? body.isCancelled : null;

  if (!Number.isInteger(id) || id <= 0 || isCancelled === null) {
    return bad("Missing or invalid fields (id, isCancelled)", 400);
  }

  const { data, error } = await admin
    .from("ScheduleSlot")
    .update({ isCancelled, updatedAt: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("PATCH /admin/schedule error:", error);
    return bad("Server error", 500);
  }
  return ok(data);
}

/* ----------------------------- DELETE ---------------------------- */
// DELETE: remove a slot; if bookings or active holds exist, soft-cancel instead
export async function DELETE(req) {
  const gate = await requireAdmin();
  if (isResponse(gate)) return gate;

  const { admin } = gate;
  const { searchParams } = new URL(req.url);
  const id = toInt(searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return bad("Missing ID", 400);

  const nowIso = new Date().toISOString();

  // Any confirmed bookings?
  const { count: bookingCount, error: bookErr } = await admin
    .from("booking")
    .select("id", { count: "exact", head: true })
    .eq("scheduleSlotId", id)
    .in("status", COUNT_BOOKING_STATUSES);

  if (bookErr) {
    console.error("DELETE /admin/schedule bookings count error:", bookErr);
    return bad("Server error", 500);
  }

  // Any active holds?
  const { count: holdCount, error: holdErr } = await admin
    .from("BookingDraft")
    .select("id", { count: "exact", head: true })
    .eq("scheduleSlotId", id)
    .in("status", ACTIVE_DRAFT_STATUSES)
    .gt("expiresAt", nowIso);

  if (holdErr) {
    console.error("DELETE /admin/schedule holds count error:", holdErr);
    return bad("Server error", 500);
  }

  // If there are bookings or active holds, soft-cancel instead of delete
  if ((bookingCount ?? 0) > 0 || (holdCount ?? 0) > 0) {
    const { data, error: cancelErr } = await admin
      .from("ScheduleSlot")
      .update({ isCancelled: true, updatedAt: nowIso })
      .eq("id", id)
      .select()
      .single();

    if (cancelErr) {
      console.error("DELETE /admin/schedule soft-cancel error:", cancelErr);
      return bad("Server error", 500);
    }

    return ok({
      message:
        "Slot has bookings or active holds; it was marked as cancelled instead.",
      slot: data,
    });
  }

  // No dependencies -> hard delete
  const { error } = await admin.from("ScheduleSlot").delete().eq("id", id);
  if (error) {
    console.error("DELETE /admin/schedule error:", error);
    return bad("Server error", 500);
  }
  return ok({ message: "Deleted slot successfully" });
}
