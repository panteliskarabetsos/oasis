// ================================
// File: src/app/api/admin/reservations/[id]/route.js
// ================================
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

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

  if (!["admin", "superadmin"].includes(role))
    return { error: true, response: bad("Forbidden", 403) };

  return { error: false, admin };
}

// GET
export async function GET(req, ctx) {
  const auth = await requireAdmin();
  if (auth.error) return auth.response;
  const supa = auth.admin;

  try {
    const { id } = await ctx.params; // Next.js (app router) params are async
    const rid = Number(Array.isArray(id) ? id[0] : id);
    if (!Number.isFinite(rid) || rid <= 0) return bad("Invalid id", 400);

    // ---------- Try finalized Booking ----------
    const { data: b, error: bErr } = await supa
      .from("Booking")
      .select(
        `*,
       ScheduleSlot:ScheduleSlot(*, Experience:Experience(*)),
        Experience:Experience!Booking_experienceId_fkey(id, name, location),
        User:User(id, email, name, surname, phone)`
      )
      .eq("id", rid)
      .maybeSingle();
    if (bErr) throw bErr;

    if (b) {
      const slot = b?.ScheduleSlot || null;
      const exFromSlot = slot?.Experience || null;
      const exDirect = b?.Experience || null;
      const u = b?.User || {};

      // jsonb fields (may come back as strings)
      const countsRaw = parseJSON(b?.counts, null) || {};
      const attendees = parseJSON(b?.attendees, []) || [];
      const pc = parseJSON(b?.primary_contact, null);

      const adults =
        (isNum(b?.adultsCount) && b.adultsCount) ||
        (isNum(countsRaw?.adults) && countsRaw.adults) ||
        (isNum(b?.numberOfPeople) && b.numberOfPeople) ||
        0;
      const kids =
        (isNum(b?.kidsCount) && b.kidsCount) ||
        (isNum(countsRaw?.kids) && countsRaw.kids) ||
        0;
      const teens = isNum(countsRaw?.teens) ? countsRaw.teens : null;
      const counts = {
        adults,
        kids,
        teens,
        total: isNum(countsRaw?.total)
          ? countsRaw.total
          : Math.max(0, adults + kids),
      };
      const totalPaidAmount = isNum(b?.totalPaidAmount)
        ? b.totalPaidAmount
        : null;
      const currency = (b?.currency || "EUR").toString().toUpperCase();
      const scheduleSlotId = b?.scheduleSlotId ?? slot?.id ?? null;
      const startTime = slot?.date ?? b?.startTime ?? null;
      const experienceId =
        slot?.experienceId ?? b?.experienceId ?? exDirect?.id ?? null;
      const experienceName =
        exFromSlot?.name || exDirect?.name || b?.customExperienceName || null;
      const experienceLocation =
        exFromSlot?.location ?? exDirect?.location ?? null;

      // guest: prefer joined user, fall back to primary_contact snapshot
      const guestName =
        [u?.name, u?.surname].filter(Boolean).join(" ").trim() ||
        pc?.name ||
        [pc?.firstName, pc?.lastName].filter(Boolean).join(" ").trim() ||
        null;
      const item = {
        id: b.id,
        source: "booking",
        code: deriveCode(b),
        status: String(b.status || "").trim() || "confirmed",
        createdAt: b.createdAt ?? null,
        updatedAt: b.updatedAt ?? null,
        notes: b.notes ?? null,

        // People
        counts,
        attendees,
        // Prices snapshot
        unitPrices: {
          adult: isNum(b?.unitPriceAdult) ? b.unitPriceAdult : null,
          kid: isNum(b?.unitPriceKid) ? b.unitPriceKid : null,
          teen: isNum(b?.unitPriceTeen) ? b.unitPriceTeen : null, // tolerated if present
        },

        // Money (mirror totalPaidAmount into totalAmount for UI compatibility)
        money: {
          totalPaidAmount,
          totalAmount: totalPaidAmount, // ← mirror for consumers expecting "totalAmount"
          currency,
        },

        // Stripe
        payments: {
          stripeSessionId: b?.stripeSessionId ?? null,
          stripePaymentIntentId: b?.stripePaymentIntentId ?? null,
        },

        // Schedule / experience
        scheduleSlotId,
        startTime,
        duration: isNum(b?.duration) ? b.duration : null,
        experience: {
          id: experienceId,
          name: experienceName,
          location: experienceLocation,
          // keep optional fields if your UI uses them
          slug: exFromSlot?.slug ?? exDirect?.slug ?? null,
          images: exFromSlot?.images ?? exDirect?.images ?? null,
        },

        // Guest (joined user) and snapshot saved on booking
        guest: {
          id: b?.userId ?? u?.id ?? null,
          name: guestName,
          email: u?.email ?? pc?.email ?? null,
          phone: u?.phone ?? pc?.phone ?? null,
        },
        guestSnapshot: cleanEmpty(pc || null),

        // useful raw fallbacks if your UI references them
        currency: b?.currency ?? null,
        unitPriceAdult: isNum(b?.unitPriceAdult) ? b.unitPriceAdult : null,
        unitPriceKid: isNum(b?.unitPriceKid) ? b.unitPriceKid : null,
        totalPaidAmount: totalPaidAmount,
        customExperienceName: b?.customExperienceName ?? null,
      };

      return ok({ item });
    }

    // ---------- Otherwise, BookingDraft ----------
    const { data: d, error: dErr } = await supa
      .from("BookingDraft")
      .select(`*, ScheduleSlot:ScheduleSlot(*, Experience:Experience(*))`)
      .eq("id", rid)
      .maybeSingle();
    if (dErr) throw dErr;
    if (!d) return bad("Reservation not found", 404);

    const slot = d?.ScheduleSlot || {};
    const ex = slot?.Experience || {};
    const cnt = parseJSON(d?.counts, {}) || {};
    const pc = parseJSON(d?.primary_contact, {}) || {};
    const attendees = parseJSON(d?.attendees, []) || [];

    const item = {
      id: d.id,
      source: "draft",
      code: `D-${String(d.id).padStart(6, "0")}`,
      status: d.status,
      createdAt: d.createdAt ?? null,
      updatedAt: d.updatedAt ?? null,
      notes: d?.notes ?? null,

      // People
      counts: {
        adults: pickFirstNumber(cnt, ["adults", "adult", "A", "people"]),
        kids: pickFirstNumber(cnt, ["kids", "children", "K"]),
        teens: pickFirstNumber(cnt, ["teens", "teen", "T"]),
      },
      attendees,

      // Prices snapshot
      unitPrices: {
        adult: isNum(d?.unitPriceAdult) ? d.unitPriceAdult : null,
        kid: isNum(d?.unitPriceKid) ? d.unitPriceKid : null,
        teen: isNum(d?.unitPriceTeen) ? d.unitPriceTeen : null,
      },

      // Money (draft uses totalAmount)
      money: {
        totalAmount: isNum(d?.totalAmount) ? d.totalAmount : null,
        currency: "EUR",
      },

      // Stripe
      payments: {
        stripeSessionId: d?.stripeSessionId ?? null,
        stripePaymentIntentId: d?.stripePaymentIntentId ?? null,
      },

      // Schedule / experience
      scheduleSlotId: d.scheduleSlotId ?? null,
      startTime: slot?.date ?? null,
      experience: {
        id: slot?.experienceId ?? null,
        name: ex?.name ?? null,
        location: ex?.location ?? null,
        slug: ex?.slug ?? null,
        images: ex?.images ?? null,
      },

      // Primary contact on the draft
      guest: {
        id: isNum(pc?.userId) ? Number(pc.userId) : null,
        name:
          (pc?.name ??
            pc?.fullName ??
            [pc?.firstName, pc?.lastName].filter(Boolean).join(" ")) ||
          null,
        email: pc?.email ?? null,
        phone: pc?.phone ?? null,
      },

      convertedBookingId: d?.convertedBookingId ?? null,
      expiresAt: d?.expiresAt ?? null,
    };

    return ok({ item });
  } catch (e) {
    console.error("/api/admin/reservations/[id] GET error", e);
    return bad(e?.message || "Failed to load reservation", 500);
  }
}

// PATCH
export async function PATCH(req, ctx) {
  const auth = await requireAdmin();
  if (auth.error) return auth.response;
  const supa = auth.admin;

  const { id } = await ctx.params;
  const rid = Number(Array.isArray(id) ? id[0] : id);
  if (!Number.isFinite(rid) || rid <= 0) return bad("Invalid id", 400);

  let body;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON", 400);
  }

  // accept flat or nested payloads
  const pickFirst = (...vals) =>
    vals.find((v) => v !== undefined && v !== null);

  const unitPriceAdult = pickFirst(
    body.unitPriceAdult,
    body?.unitPrices?.adult
  );
  const unitPriceKid = pickFirst(body.unitPriceKid, body?.unitPrices?.kid);

  const totalPaidAmount = pickFirst(
    body.totalPaidAmount,
    body?.money?.totalPaidAmount
  );
  const totalAmount = pickFirst(body.totalAmount, body?.money?.totalAmount); // for drafts
  const currency = pickFirst(body.currency, body?.money?.currency);
  const statusRaw = pickFirst(body.status);
  const status = typeof statusRaw === "string" ? statusRaw.trim() : undefined;

  const numOrNull = (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // ---- Is it a finalized Booking? ----
  const { data: existsBooking, error: bExistsErr } = await supa
    .from("Booking")
    .select("id")
    .eq("id", rid)
    .maybeSingle();
  if (bExistsErr) return bad("Failed to check booking", 500);

  if (existsBooking?.id) {
    const patch = {};
    if (status) patch.status = status;
    if (currency) patch.currency = String(currency).toUpperCase();
    if (unitPriceAdult !== undefined)
      patch.unitPriceAdult = numOrNull(unitPriceAdult);
    if (unitPriceKid !== undefined)
      patch.unitPriceKid = numOrNull(unitPriceKid);
    if (totalPaidAmount !== undefined)
      patch.totalPaidAmount = numOrNull(totalPaidAmount);

    const { data, error } = await supa
      .from("Booking")
      .update(patch)
      .eq("id", rid)
      .select(
        "id, unitPriceAdult, unitPriceKid, totalPaidAmount, currency, status, updatedAt"
      )
      .maybeSingle();

    if (error) {
      console.error("[reservations/:id PATCH] booking update error:", error);
      return bad("Failed to update booking", 500);
    }
    return ok({ id: data.id, updated: data });
  }

  // ---- Otherwise it's a BookingDraft ----
  const { data: draft, error: dExistsErr } = await supa
    .from("BookingDraft")
    .select("id, counts")
    .eq("id", rid)
    .maybeSingle();
  if (dExistsErr) return bad("Failed to check draft", 500);
  if (!draft?.id) return bad("Reservation not found", 404);

  const dUpdate = {};
  if (status) dUpdate.status = status;
  if (unitPriceAdult !== undefined)
    dUpdate.unitPriceAdult = numOrNull(unitPriceAdult);
  if (unitPriceKid !== undefined)
    dUpdate.unitPriceKid = numOrNull(unitPriceKid);

  // drafts: compute totalAmount if prices change and not provided
  if (totalAmount !== undefined) {
    dUpdate.totalAmount = numOrNull(totalAmount);
  } else if (dUpdate.unitPriceAdult != null || dUpdate.unitPriceKid != null) {
    const cnt = draft.counts || {};
    const A = Number.isFinite(Number(cnt.adults)) ? Number(cnt.adults) : 0;
    const K = Number.isFinite(Number(cnt.kids)) ? Number(cnt.kids) : 0;
    const ua = dUpdate.unitPriceAdult ?? 0;
    const uk = dUpdate.unitPriceKid ?? 0;
    dUpdate.totalAmount = +(A * ua + K * uk).toFixed(2);
  }

  const { data: dUpdated, error: dErr } = await supa
    .from("BookingDraft")
    .update(dUpdate)
    .eq("id", rid)
    .select("id, unitPriceAdult, unitPriceKid, totalAmount, status, updatedAt")
    .maybeSingle();

  if (dErr) {
    console.error("[reservations/:id PATCH] draft update error:", dErr);
    return bad("Failed to update draft", 500);
  }
  return ok({ id: dUpdated.id, updated: dUpdated });
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

export async function DELETE(req, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.response;
  const supa = auth.admin;

  const { id } = await params; // params is async
  const rid = Number(Array.isArray(id) ? id[0] : id);
  if (!Number.isInteger(rid) || rid <= 0) return bad("Invalid id", 400);

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  try {
    // 1) Try Booking
    const { data: b, error: bErr } = await supa
      .from("Booking")
      .select("id, status")
      .eq("id", rid)
      .maybeSingle(); // ← don't auto-404

    if (bErr) throw bErr;

    if (b?.id) {
      if (!force && String(b.status).toLowerCase() !== "cancelled") {
        return bad(
          "Only cancelled bookings can be deleted. Cancel first or pass ?force=1.",
          409
        );
      }

      const { error: delErr } = await supa
        .from("Booking")
        .delete()
        .eq("id", rid)
        .single();
      if (delErr) throw delErr;

      return ok({ id: rid, deleted: true, source: "booking" });
    }

    // 2) Try BookingDraft (allow delete regardless of status)
    const { data: d, error: dErr } = await supa
      .from("BookingDraft")
      .select("id")
      .eq("id", rid)
      .maybeSingle();

    if (dErr) throw dErr;

    if (d?.id) {
      const { error: delDErr } = await supa
        .from("BookingDraft")
        .delete()
        .eq("id", rid)
        .single();
      if (delDErr) throw delDErr;

      return ok({ id: rid, deleted: true, source: "draft" });
    }

    // 3) Not found anywhere
    return bad("Not found", 404);
  } catch (e) {
    console.error(`/api/admin/reservations/${rid} DELETE error`, e);
    return bad(e?.message || "Failed to delete booking", 500);
  }
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
function cleanEmpty(v) {
  if (v == null) return null;
  if (typeof v !== "object") return v;
  const out = {};
  let any = false;
  for (const k of Object.keys(v)) {
    const val = v[k];
    if (val == null) continue;
    if (typeof val === "string" && val.trim() === "") continue;
    out[k] = val;
    any = true;
  }
  return any ? out : null;
}
function deriveCode(row) {
  const cands = [
    row?.code,
    row?.reference,
    row?.bookingCode,
    row?.shortCode,
    row?.refCode,
    row?.ref,
  ].filter(Boolean);
  if (cands.length) return String(cands[0]);
  if (row?.id) return `B-${String(row.id).padStart(6, "0")}`;
  return null;
}
function parseJSON(v, fallback = null) {
  if (v == null) return fallback;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}
