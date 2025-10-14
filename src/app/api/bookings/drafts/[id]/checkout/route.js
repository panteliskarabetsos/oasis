// src/app/api/bookings/drafts/[id]/checkout/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

const REFRESH_MINUTES_ON_CHECKOUT = 30;
const COUNT_STATUSES = new Set(["confirmed", "completed", "checked_in"]);

export async function POST(req, ctx) {
  const { id } = await ctx.params;
  const draftId = Number(id);
  if (!Number.isFinite(draftId) || draftId <= 0) return bad("Invalid id");

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  // Lazy import Stripe
  const Stripe = (await import("stripe")).default;
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key) return bad("Stripe not configured", 500);
  const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

  // 1) Load draft (allow re-entry when status=checkout)
  const { data: draft, error: dErr } = await admin
    .from("BookingDraft")
    .select(
      `
      id, experienceId, scheduleSlotId, counts, status, expiresAt,
      primary_contact, "unitPriceAdult", "unitPriceKid", "totalAmount", "stripeSessionId"
    `
    )
    .eq("id", draftId)
    .maybeSingle();

  if (dErr || !draft) return bad("Draft not found", 404);
  if (!["draft", "checkout"].includes(draft.status)) {
    return bad("Draft not in a payable state", 400);
  }

  const A = Number(draft.counts?.adults || 0);
  const K = Number(draft.counts?.kids || 0);
  const totalPeople = A + K;
  if (totalPeople <= 0) return bad("Empty group", 400);

  // 2) Load supporting data
  const [{ data: exp, error: eErr }, { data: slot, error: sErr }] =
    await Promise.all([
      admin
        .from("Experience")
        .select(`id,name,slug,location,"priceAdult","priceKid"`)
        .eq("id", draft.experienceId)
        .maybeSingle(),
      admin
        .from("ScheduleSlot")
        .select(`id,date,totalSlots,isCancelled,experienceId`)
        .eq("id", draft.scheduleSlotId)
        .maybeSingle(),
    ]);
  if (eErr || sErr) return bad("Server error", 500);
  if (!exp || !slot || slot.isCancelled) return bad("Slot unavailable", 400);
  if (slot.experienceId !== draft.experienceId)
    return bad("Slot/experience mismatch", 400);

  // 3) Derived capacity: totalSlots − confirmed bookings − active holds from other drafts
  const now = new Date();

  // 3a) Confirmed bookings
  const { data: bookings, error: bErr } = await admin
    .from("Booking")
    .select("numberOfPeople,status")
    .eq("scheduleSlotId", slot.id);
  if (bErr) return bad("Server error", 500);
  const bookedFromReservations = (bookings || []).reduce((sum, b) => {
    const st = String(b.status || "").toLowerCase();
    if (!COUNT_STATUSES.has(st)) return sum;
    const n = Number(b.numberOfPeople || 0);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  // 3b) Other active holds (draft/checkout unexpired + paid not converted)
  const { data: holds, error: hErr } = await admin
    .from("BookingDraft")
    .select('id, counts, status, expiresAt, "convertedBookingId"')
    .eq("scheduleSlotId", slot.id);
  if (hErr) return bad("Server error", 500);

  const otherActiveHolds = (holds || []).reduce((sum, h) => {
    if (h.id === draftId) return sum; // exclude current draft
    const isPaidUnconverted = h.status === "paid" && !h.convertedBookingId;
    const expAt = h.expiresAt ? new Date(h.expiresAt) : null;
    const isActive =
      isPaidUnconverted || (h.status !== "paid" && (!expAt || expAt > now));
    if (!isActive) return sum;
    const a = Number(h?.counts?.adults ?? 0) || 0;
    const k = Number(h?.counts?.kids ?? 0) || 0;
    return sum + a + k;
  }, 0);

  const capacityLeft =
    Number(slot.totalSlots || 0) - bookedFromReservations - otherActiveHolds;

  if (totalPeople > capacityLeft) {
    return bad(`Only ${Math.max(capacityLeft, 0)} spots left`, 400);
  }

  // 4) If draft expired, auto-extend the hold window
  const isExpired = !!draft.expiresAt && new Date(draft.expiresAt) < now;
  if (isExpired) {
    const newExpiresAt = new Date(
      Date.now() + REFRESH_MINUTES_ON_CHECKOUT * 60 * 1000
    ).toISOString();
    const upd = await admin
      .from("BookingDraft")
      .update({ expiresAt: newExpiresAt, updatedAt: new Date().toISOString() })
      .eq("id", draftId);
    if (upd.error) {
      if (String(upd.error.code) === "42703") {
        const upd2 = await admin
          .from("BookingDraft")
          .update({ expiresAt: newExpiresAt })
          .eq("id", draftId);
        if (upd2.error) return bad("Draft expired. Please start again.", 400);
      } else {
        return bad("Draft expired. Please start again.", 400);
      }
    }
  }

  // 5) Reuse existing open Stripe session if present
  if (draft.status === "checkout" && draft.stripeSessionId) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(
        draft.stripeSessionId
      );
      if (existing && existing.status === "open" && existing.url) {
        return ok({ url: existing.url, reused: true });
      }
    } catch (e) {
      console.warn("[checkout] failed to reuse session", e?.message);
    }
  }

  // 6) Build Stripe line items
  const currency = "eur";
  const items = [];
  if (A > 0)
    items.push(line(`${exp.name} — Adult`, currency, draft.unitPriceAdult, A));
  if (K > 0)
    items.push(
      line(
        `${exp.name} — Kid (3–12)`,
        currency,
        draft.unitPriceKid ?? draft.unitPriceAdult,
        K
      )
    );

  // 7) URLs (robust)
  const origin = computeOrigin(req);
  const successUrl = `${origin}/booking/${draftId}/confirmation?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/booking/${draftId}/payment?cancelled=1`;

  try {
    // validate URLs (throws if invalid)
    new URL(successUrl);
    new URL(cancelUrl);
  } catch {
    console.error("[checkout] invalid URLs", { origin, successUrl, cancelUrl });
    return bad("Server URL misconfigured. Check NEXT_PUBLIC_SITE_URL.", 500);
  }

  // 8) Create Checkout Session
  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: items,
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: draft.primary_contact?.email ?? undefined,
      metadata: {
        draft_id: String(draftId),
        schedule_slot_id: String(draft.scheduleSlotId),
        experience_id: String(draft.experienceId),
      },
    });
  } catch (e) {
    console.error("[checkout] stripe error", e?.message);
    return bad(e?.message || "Stripe error creating session", 400);
  }

  // 9) Store session & move to checkout + extend hold window
  const newExpiresAt = new Date(
    Date.now() + REFRESH_MINUTES_ON_CHECKOUT * 60 * 1000
  ).toISOString();

  const upd = await admin
    .from("BookingDraft")
    .update({
      status: "checkout",
      stripeSessionId: session.id,
      expiresAt: newExpiresAt,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", draftId);

  if (upd.error && String(upd.error.code) === "42703") {
    await admin
      .from("BookingDraft")
      .update({
        status: "checkout",
        stripeSessionId: session.id,
        expiresAt: newExpiresAt,
      })
      .eq("id", draftId);
  }

  return ok({ url: session.url });
}

function line(name, currency, unitPrice, qty) {
  const amount = Math.round(Number(unitPrice || 0) * 100);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Invalid price");
  return {
    quantity: qty,
    price_data: {
      currency,
      unit_amount: amount,
      product_data: { name },
    },
  };
}

/** Build a safe absolute origin.
 * Priority:
 *   1) NEXT_PUBLIC_SITE_URL (must include http/https)
 *   2) req.url (Next provides absolute URL in route handlers)
 */
function computeOrigin(req) {
  let envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) {
    if (!/^https?:\/\//i.test(envUrl)) envUrl = `https://${envUrl}`;
    try {
      const u = new URL(envUrl);
      return `${u.protocol}//${u.host}`.replace(/\/$/, "");
    } catch {
      // fall through
    }
  }
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`.replace(/\/$/, "");
}
