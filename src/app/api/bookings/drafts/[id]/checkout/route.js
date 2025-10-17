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

  // Read incoming body for promoCode (optional)
  let body = {};
  try {
    body = await req.json();
  } catch {}
  const promoCode = (body?.promoCode || "").trim();

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
      primary_contact, "unitPriceAdult", "unitPriceKid",
     "totalAmount", "stripeSessionId", "appliedPromoCode"
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
    return bad(`Only ${Math.max(capacityLeft, 0)} spots left`, 409);
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

  // 6) Build base line items (before discount)
  const currency = "eur";
  const base = [];
  if (A > 0)
    base.push({
      name: `${exp.name} — Adult`,
      unit: Number(draft.unitPriceAdult ?? 0),
      qty: A,
    });
  if (K > 0)
    base.push({
      name: `${exp.name} — Kid (3–12)`,
      unit: Number(draft.unitPriceKid ?? draft.unitPriceAdult ?? 0),
      qty: K,
    });
  if (base.some((it) => !(Number(it.unit) > 0))) {
    return bad("Invalid unit price for one or more items.", 400);
  }

  // Compute subtotal in cents
  const toCents = (v) => Math.round(Number(v || 0) * 100);
  const subtotalCents = base.reduce(
    (s, it) => s + toCents(it.unit) * it.qty,
    0
  );

  // 7) Validate/compute promo discount
  let promo = null; // { code, discountType, discountValue, currency, endsAt }
  let discountCents = 0;
  if (promoCode) {
    const origin = computeOrigin(req);
    const valRes = await fetch(
      `${origin}/api/promotions/validate?code=${encodeURIComponent(
        promoCode
      )}&draftId=${draftId}`,
      { cache: "no-store" }
    );
    if (!valRes.ok) {
      const msg =
        (await valRes.json().catch(() => ({})))?.error || "Invalid code.";
      return bad(msg, 400);
    }
    promo = await valRes.json();
    // Basic sanity / clamp
    if (promo.discountType === "percent") {
      const pct = Math.min(Math.max(Number(promo.discountValue || 0), 0), 100);
      discountCents = Math.floor((subtotalCents * pct) / 100);
    } else {
      // fixed
      const fixedCents = Math.max(
        Math.round(Number(promo.discountValue || 0) * 100),
        0
      );
      discountCents = Math.min(fixedCents, subtotalCents);
    }
  }
  if (base.some((it) => !(Number(it.unit) > 0))) {
    return bad("Invalid unit price for one or more items.", 400);
  }

  // 8) Produce discounted Stripe line_items (prorate fixed across lines)
  const line_items = discountedStripeItems(base, currency, discountCents);

  // 9) URLs (robust)
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

  const finalTotalCents =
    subtotalCents - Math.min(discountCents, subtotalCents);

  if (finalTotalCents === 0) {
    const newExpiresAt = new Date(
      Date.now() + REFRESH_MINUTES_ON_CHECKOUT * 60 * 1000
    ).toISOString();
    await admin
      .from("BookingDraft")
      .update({
        status: "paid",
        stripeSessionId: null,
        expiresAt: newExpiresAt,
        updatedAt: new Date().toISOString(),
        totalAmount: 0,
        appliedPromoCode: promo?.code ?? null,
        discountAmount: discountCents / 100,
        promoJson: promo ?? null,
      })
      .eq("id", draftId);

    return ok({
      url: `${origin}/booking/${draftId}/confirmation`,
      discounted: !!promo,
      discountCents,
      finalTotalCents,
    });
  }
  const currentTotalCents =
    subtotalCents - Math.min(discountCents, subtotalCents);
  const currentPromoCode = promo?.code ?? null;

  const idemKey = `checkout_draft_${draftId}_${currentTotalCents}_${
    currentPromoCode || ""
  }`;

  // 10) Create Checkout Session (attach promo metadata)
  let session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items,
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: draft.primary_contact?.email ?? undefined,
        client_reference_id: String(draftId),
        metadata: {
          draft_id: String(draftId),
          schedule_slot_id: String(draft.scheduleSlotId),
          experience_id: String(draft.experienceId),
          subtotal_cents: String(subtotalCents),
          discount_cents: String(discountCents),
          final_total_cents: String(finalTotalCents),
          promo_code: promo?.code ?? "",
          promo_type: promo?.discountType ?? "",
          promo_value:
            promo?.discountValue != null ? String(promo.discountValue) : "",
          promo_currency: promo?.currency ?? "",
        },
      },
      { idempotencyKey: idemKey }
    );
  } catch (e) {
    console.error("[checkout] stripe error", e?.message);
    return bad(e?.message || "Stripe error creating session", 400);
  }

  // Totals for metadata / draft snapshot

  // 11) Store session & move to checkout + extend hold window
  const newExpiresAt = new Date(
    Date.now() + REFRESH_MINUTES_ON_CHECKOUT * 60 * 1000
  ).toISOString();

  const draftUpdate = {
    status: "checkout",
    stripeSessionId: session.id,
    expiresAt: newExpiresAt,
    updatedAt: new Date().toISOString(),
    totalAmount: finalTotalCents / 100, // e.g. 149.00
    appliedPromoCode: promo?.code ?? null, // e.g. "FALL-2024" or null
    discountAmount: promo ? discountCents / 100 : 0, // e.g. 10.00
    promoJson: promo ?? null, // full normalized payload
  };

  let upd = await admin
    .from("BookingDraft")
    .update(draftUpdate)
    .eq("id", draftId);

  // If your DB doesn't have these columns in some env, keep a graceful fallback
  if (upd.error && String(upd.error.code) === "42703") {
    await admin
      .from("BookingDraft")
      .update({
        status: "checkout",
        stripeSessionId: session.id,
        expiresAt: newExpiresAt,
        totalAmount: finalTotalCents / 100,
      })
      .eq("id", draftId);
  }

  // Decide whether we may reuse the old open session
  const storedTotalCents = Math.round(Number(draft.totalAmount || 0) * 100);
  const storedPromoCode = draft.appliedPromoCode ?? null;
  const priceOrPromoChanged =
    storedTotalCents !== currentTotalCents ||
    storedPromoCode !== currentPromoCode;

  if (draft.status === "checkout" && draft.stripeSessionId) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(
        draft.stripeSessionId
      );

      // If the session is open AND nothing changed → reuse it
      if (
        !priceOrPromoChanged &&
        existing?.status === "open" &&
        existing?.url
      ) {
        return ok({ url: existing.url, reused: true });
      }

      // Otherwise, try to expire the stale session (non-fatal if it fails)
      if (existing?.status === "open") {
        try {
          await stripe.checkout.sessions.expire(draft.stripeSessionId);
        } catch {}
      }
    } catch (e) {
      console.warn(
        "[checkout] failed to inspect/expire prior session:",
        e?.message
      );
    }
  }

  // 12) Reserve/burn promo (optional but recommended)
  // Create a pending redemption record you can finalize on webhook success.
  // Table suggestion: PromotionRedemption(code text, draftId int, stripeSessionId text, discountCents int, status text, createdAt timestamptz, updatedAt timestamptz)
  // 12) Reserve/burn promo (optional but recommended)
  if (promo?.code) {
    const red = await admin.from("PromotionRedemption").upsert(
      {
        code: promo.code,
        draftId,
        stripeSessionId: session.id,
        discountCents,
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { onConflict: "stripeSessionId" } // requires a unique index on stripeSessionId
    );
    if (red.error) {
      // If table doesn't exist or constraint missing, don't block checkout.
      console.warn(
        "[checkout] failed to record promo redemption:",
        red.error.code,
        red.error.message
      );
    }
  }

  return ok({
    url: session.url,
    discounted: !!promo,
    discountCents,
    finalTotalCents,
  });
}

function discountedStripeItems(baseItems, currency, discountCents) {
  const cents = (v) => Math.round(Number(v || 0) * 100);
  const subtotal = baseItems.reduce((s, it) => s + cents(it.unit) * it.qty, 0);

  if (subtotal <= 0 || discountCents <= 0) {
    // no discount → 1 stripe line per base item
    return baseItems.map((it) => line(it.name, currency, it.unit, it.qty));
  }

  const perLineCents = baseItems.map((it) => cents(it.unit) * it.qty);
  const allocations = prorate(subtotal, discountCents, perLineCents);

  const items = [];
  for (let i = 0; i < baseItems.length; i++) {
    const it = baseItems[i];
    const totalLineCents = perLineCents[i];
    const lineDiscount = allocations[i];
    const finalLineCents = Math.max(0, totalLineCents - lineDiscount);
    if (finalLineCents === 0) continue;

    // Distribute finalLineCents across qty tickets using at most two price points.
    const baseUnit = Math.floor(finalLineCents / it.qty); // integer cents
    let remainder = finalLineCents - baseUnit * it.qty; // 0..qty-1

    // Only emit the "base" chunk if baseUnit >= 1
    const qtyBase = baseUnit >= 1 ? it.qty - remainder : 0;
    if (qtyBase > 0) {
      items.push({
        quantity: qtyBase,
        price_data: {
          currency,
          unit_amount: baseUnit, // >= 1
          product_data: { name: it.name },
        },
      });
    }

    // Remainder tickets get +1 cent each. If baseUnit was 0, this is unit_amount = 1.
    if (remainder > 0) {
      items.push({
        quantity: remainder,
        price_data: {
          currency,
          unit_amount: Math.max(1, baseUnit + 1),
          product_data: { name: it.name },
        },
      });
    }
  }
  return items;
}

function prorate(totalCents, discountCents, weights) {
  // weights: per-line contribution in cents; returns array of per-line discount cents summing to discountCents
  const out = new Array(weights.length).fill(0);
  if (discountCents <= 0 || totalCents <= 0) return out;

  // First pass: floor
  let assigned = 0;
  for (let i = 0; i < weights.length; i++) {
    const share = Math.floor((weights[i] * discountCents) / totalCents);
    out[i] = Math.min(share, weights[i]); // cap at line total
    assigned += out[i];
  }

  // Distribute remainder greedily to lines with highest fractional remainder, capped by line total
  let remainder = discountCents - assigned;
  // Compute fractions
  const fracs = weights.map((w, i) => ({
    i,
    frac: (w * discountCents) / totalCents - out[i],
  }));
  fracs.sort((a, b) => b.frac - a.frac);
  for (const { i } of fracs) {
    if (remainder <= 0) break;
    const room = Math.max(0, weights[i] - out[i]);
    const add = Math.min(room, remainder);
    out[i] += add;
    remainder -= add;
  }
  return out;
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
  let envUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    ""
  ).trim();

  if (envUrl) {
    if (!/^https?:\/\//i.test(envUrl)) envUrl = `https://${envUrl}`;
    const u = new URL(envUrl);
    return `${u.protocol}//${u.host}`.replace(/\/$/, "");
  }
  // Final fallback: parse from req.url but only allow localhost in dev
  const u = new URL(req.url);
  const host = `${u.protocol}//${u.host}`.replace(/\/$/, "");
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev && /^(http:\/\/)?(localhost|127\.0\.0\.1)/i.test(host)) return host;
  throw new Error("Site URL not configured");
}
