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

  // authorize with your public.User table role
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
    // ⬅️ Next.js: params is async now
    const { id } = await ctx.params;
    const rid = Number(Array.isArray(id) ? id[0] : id);
    if (!rid) return bad("Invalid id", 400);

    // Try Booking first
    const { data: b, error: bErr } = await supa
      .from("Booking")
      .select(
        `id, createdAt, updatedAt, status, notes, numberOfPeople, scheduleSlotId,
         ScheduleSlot:ScheduleSlot(id, date, experienceId, Experience:Experience(id, name, location)),
         User:User(id, email, name, surname, phone)`
      )
      .eq("id", rid)
      .maybeSingle();
    if (bErr) throw bErr;

    if (b) {
      const slot = b?.ScheduleSlot || {};
      const ex = slot?.Experience || {};
      const u = b?.User || {};
      const item = {
        id: b.id,
        source: "booking",
        code: `B-${String(b.id).padStart(6, "0")}`,
        status: b.status,
        createdAt: b.createdAt || null,
        updatedAt: b.updatedAt || null,
        notes: b.notes || null,
        counts: {
          adults:
            typeof b.numberOfPeople === "number" ? b.numberOfPeople : null,
          kids: null,
        },
        money: { totalAmount: null, currency: "EUR" },
        payments: { stripeSessionId: null, stripePaymentIntentId: null },
        scheduleSlotId: b.scheduleSlotId,
        startTime: slot?.date || null,
        experience: {
          id: slot?.experienceId || null,
          name: ex?.name || null,
          location: ex?.location || null,
        },
        guest: {
          id: u?.id || null,
          name: [u?.name, u?.surname].filter(Boolean).join(" "),
          email: u?.email || null,
          phone: u?.phone || null,
        },
      };
      return ok({ item });
    }

    // Otherwise: BookingDraft
    const { data: d, error: dErr } = await supa
      .from("BookingDraft")
      .select(
        `id, createdAt, updatedAt, status, counts, attendees, primary_contact, totalAmount,
         unitPriceAdult,  unitPriceKid, scheduleSlotId, stripeSessionId, stripePaymentIntentId,
         ScheduleSlot:ScheduleSlot(id, date, experienceId, Experience:Experience(id, name, location))`
      )
      .eq("id", rid)
      .maybeSingle();
    if (dErr) throw dErr;
    if (!d) return bad("Reservation not found", 404);

    const slot = d?.ScheduleSlot || {};
    const ex = slot?.Experience || {};
    const pc = d?.primary_contact || {};
    const cnt = d?.counts || {};

    const item = {
      id: d.id,
      source: "draft",
      code: `D-${String(d.id).padStart(6, "0")}`,
      status: d.status,
      createdAt: d.createdAt || null,
      updatedAt: d.updatedAt || null,
      notes: null,
      counts: {
        adults: ["adults", "adult", "A", "people"].reduce(
          (acc, k) => (typeof cnt?.[k] === "number" ? cnt[k] : acc),
          null
        ),
        kids: ["kids", "children", "K"].reduce(
          (acc, k) => (typeof cnt?.[k] === "number" ? cnt[k] : acc),
          null
        ),
      },
      money: {
        totalAmount: typeof d.totalAmount === "number" ? d.totalAmount : null,
        currency: "EUR",
      },
      payments: {
        stripeSessionId: d.stripeSessionId || null,
        stripePaymentIntentId: d.stripePaymentIntentId || null,
      },
      scheduleSlotId: d.scheduleSlotId,
      startTime: slot?.date || null,
      experience: {
        id: slot?.experienceId || null,
        name: ex?.name || null,
        location: ex?.location || null,
      },
      guest: {
        id: null,
        name: pc?.name || null,
        email: pc?.email || null,
        phone: pc?.phone || null,
      },
    };

    return ok({ item });
  } catch (e) {
    console.error("/api/admin/reservations/[id] GET error", e);
    return bad(e?.message || "Failed to load reservation", 500);
  }
}
