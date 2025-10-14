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
         User:User(id, email, name, surname, phone)`
      )
      .eq("id", rid)
      .maybeSingle();
    if (bErr) throw bErr;

    if (b) {
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
      const teens = isNum(c?.teens) ? c.teens : null;

      const totalPaidAmount = isNum(b?.totalPaidAmount)
        ? b.totalPaidAmount
        : null;
      const currency = (b?.currency || "EUR").toString().toUpperCase();

      const item = {
        id: b.id,
        source: "booking",
        code: deriveCode(b),
        status: String(b.status || "").trim() || "confirmed",
        createdAt: b.createdAt ?? null,
        updatedAt: b.updatedAt ?? null,
        notes: b.notes ?? null,

        // People
        counts: { adults, kids, teens },
        attendees: Array.isArray(b?.attendees) ? b.attendees : [],

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
        scheduleSlotId: b.scheduleSlotId ?? null,
        startTime: slot?.date ?? null,
        experience: {
          id: slot?.experienceId ?? null,
          name: ex?.name ?? null,
          location: ex?.location ?? null,
          slug: ex?.slug ?? null,
          images: ex?.images ?? null,
        },

        // Guest (joined user) and snapshot saved on booking
        guest: {
          id: b?.userId ?? u?.id ?? null,
          name: [u?.name, u?.surname].filter(Boolean).join(" ") || null,
          email: u?.email ?? null,
          phone: u?.phone ?? null,
        },
        guestSnapshot: cleanEmpty(b?.primary_contact || null),
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
    const cnt = d?.counts || {};
    const pc = d?.primary_contact || {};

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
      attendees: Array.isArray(d?.attendees) ? d.attendees : [],

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
