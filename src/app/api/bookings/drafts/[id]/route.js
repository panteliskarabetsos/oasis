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

  // Draft (include convertedBookingId + stripe ids)
  const { data: draft, error: dErr } = await admin
    .from("BookingDraft")
    .select(
      `
      id,
      "experienceId",
      "scheduleSlotId",
      counts,
      attendees,
      primary_contact,
      status,
      "unitPriceAdult",
      "unitPriceKid",
      "totalAmount",
      "expiresAt",
      "createdAt",
      "updatedAt",
      "convertedBookingId",
      "stripeSessionId",
      "stripePaymentIntentId"
    `
    )
    .eq("id", draftId)
    .maybeSingle();

  if (dErr || !draft) return bad("Draft not found", 404);

  // Experience (minimal fields for UI)
  const { data: exp, error: eErr } = await admin
    .from("Experience")
    .select(`id, name, slug, location, images, "priceAdult", "priceKid"`)
    .eq("id", draft.experienceId)
    .maybeSingle();
  if (eErr) console.error("[drafts/:id] experience fetch error", eErr);

  // Slot (date is enough for confirmation page)
  const { data: slot, error: sErr } = await admin
    .from("ScheduleSlot")
    .select("id, date")
    .eq("id", draft.scheduleSlotId)
    .maybeSingle();
  if (sErr) console.error("[drafts/:id] slot fetch error", sErr);

  // If converted, load minimal Booking for UI (ID, paid amount, currency, status)
  let booking = null;
  if (draft.convertedBookingId) {
    const { data: bData, error: bErr } = await admin
      .from("booking")
      .select(
        `
        id,
        status,
        "numberOfPeople",
        "totalPaidAmount",
        currency
      `
      )
      .eq("id", draft.convertedBookingId)
      .maybeSingle();
    if (bErr) {
      console.error("[drafts/:id] booking fetch error", bErr);
    } else {
      booking = bData || null;
    }
  }

  // Derived status helper
  const derivedStatus =
    draft.convertedBookingId && draft.status !== "converted"
      ? "converted"
      : draft.status;

  // Shape response
  return ok({
    bookingId: draft.convertedBookingId ?? null, // convenience
    booking, // minimal booking info when converted

    // expose a "draft" object so pages using data.draft || data keep working
    draft: {
      id: draft.id,
      experienceId: draft.experienceId,
      scheduleSlotId: draft.scheduleSlotId,
      counts: draft.counts,
      attendees: draft.attendees || [],
      primary_contact: draft.primary_contact || null,
      status: derivedStatus,
      unitPriceAdult: draft.unitPriceAdult,
      unitPriceKid: draft.unitPriceKid ?? draft.unitPriceAdult,
      totalAmount: draft.totalAmount,
      expiresAt: draft.expiresAt,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      convertedBookingId: draft.convertedBookingId ?? null,
      stripeSessionId: draft.stripeSessionId ?? null,
      stripePaymentIntentId: draft.stripePaymentIntentId ?? null,

      // (optional convenience) legacy helper
      unitPrices: {
        adult: draft.unitPriceAdult,
        kid: draft.unitPriceKid ?? draft.unitPriceAdult,
      },
    },

    // related entities for your page
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

  // Attendees usually editable in 'draft'
  if (draft.status !== "draft") return bad("Draft not editable", 400);

  const A = Number(draft.counts?.adults || 0);
  const K = Number(draft.counts?.kids || 0);
  const expected = A + K;

  if (attendees.length !== expected)
    return bad(`Expected ${expected} attendees, got ${attendees.length}`);

  // Basic validation (ages/categories)
  for (const a of attendees) {
    const age = Number(a?.age);
    if (!a?.firstName || !a?.lastName)
      return bad("Name missing for an attendee");
    if (!Number.isFinite(age) || age < 0 || age > 120)
      return bad("Invalid age");
    if (a?.category === "kid" && !(age >= 3 && age <= 12))
      return bad("Kid age must be 3–12");
    if (a?.category === "adult" && !(age >= 16))
      return bad("Adult age must be 16+");
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
    console.error("[drafts/:id] patch error:", upErr);
    return bad("Could not save draft", 500);
  }

  return ok({ ok: true });
}
