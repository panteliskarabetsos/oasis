// src/app/api/bookings/drafts/[id]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../../../lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function GET(_req, ctx) {
  const { id } = await ctx.params;
  const draftId = Number(id);
  if (!Number.isFinite(draftId) || draftId <= 0) return bad("Invalid id");

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  // Draft
  const { data: draft, error: dErr } = await admin
    .from("BookingDraft")
    .select(
      `
      id,
      experienceId,
      scheduleSlotId,
      counts,
      attendees,
      primary_contact,
      status,
      "unitPriceAdult",
      "unitPriceTeen",
      "unitPriceKid",
      "totalAmount",
      "expiresAt",
      "createdAt",
      "updatedAt"
    `
    )
    .eq("id", draftId)
    .maybeSingle();

  if (dErr || !draft) return bad("Draft not found", 404);

  // Experience (minimal fields for UI)
  const { data: exp } = await createSupabaseAdmin()
    .from("Experience")
    .select(
      `id, name, slug, location, images, "priceAdult", "priceTeen", "priceKid"`
    )
    .eq("id", draft.experienceId)
    .maybeSingle();

  // Slot
  const { data: slot } = await createSupabaseAdmin()
    .from("ScheduleSlot")
    .select("id, date, totalSlots, bookedSlots")
    .eq("id", draft.scheduleSlotId)
    .maybeSingle();

  // Shape response to what your UI expects
  return ok({
    id: draft.id,
    counts: draft.counts,
    attendees: draft.attendees || [],
    primary_contact: draft.primary_contact || null, // matches your AttendeesPage
    status: draft.status,
    unitPrices: {
      adult: draft.unitPriceAdult,
      teen: draft.unitPriceTeen ?? draft.unitPriceAdult,
      kid: draft.unitPriceKid ?? draft.unitPriceAdult,
    },
    totalAmount: draft.totalAmount,
    expiresAt: draft.expiresAt,
    experience: exp || null,
    slot: slot || null,
  });
}

export async function PATCH(req, ctx) {
  const { id } = await ctx.params;
  const draftId = Number(id);
  if (!Number.isFinite(draftId) || draftId <= 0) return bad("Invalid id");

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const body = await req.json().catch(() => ({}));
  const primaryContact = body?.primaryContact || null;
  const attendees = Array.isArray(body?.attendees) ? body.attendees : [];

  // Fetch counts to validate numbers/ages vs requested attendees length
  const { data: draft } = await admin
    .from("BookingDraft")
    .select("counts, status")
    .eq("id", draftId)
    .maybeSingle();

  if (!draft) return bad("Draft not found", 404);
  if (draft.status !== "draft") return bad("Draft not editable", 400);

  const A = Number(draft.counts?.adults || 0);
  const T = Number(draft.counts?.teens || 0);
  const K = Number(draft.counts?.kids || 0);
  const expected = A + T + K;

  if (attendees.length !== expected)
    return bad(`Expected ${expected} attendees, got ${attendees.length}`);

  // Basic validation (ages/categories)
  for (const a of attendees) {
    const age = Number(a?.age);
    if (!a?.firstName || !a?.lastName)
      return bad("Name missing for an attendee");
    if (!Number.isFinite(age) || age < 0 || age > 120)
      return bad("Invalid age");
    if (a?.category === "teen" && !(age >= 13 && age <= 17))
      return bad("Teen age must be 13–17");
    if (a?.category === "kid" && !(age >= 3 && age <= 12))
      return bad("Kid age must be 3–12");
    if (a?.category === "adult" && !(age >= 18))
      return bad("Adult age must be 18+");
  }

  const { error: upErr } = await admin
    .from("BookingDraft")
    .update({
      attendees,
      primary_contact: primaryContact,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", draftId);

  if (upErr) {
    console.error("[drafts] patch error:", upErr);
    return bad("Could not save draft", 500);
  }

  return ok({ ok: true });
}
