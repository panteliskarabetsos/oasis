export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

const REFRESH_MINUTES_ON_CHECKOUT = 30;
const COUNT_STATUSES = new Set([
  "paid",
  "confirmed",
  "completed",
  "checked_in",
]);

/** Fallback helper: prefer automatic_payment_methods; if API rejects it, retry with payment_method_types:["card"] */
async function upsertPaymentIntent(stripe, piId, baseParams) {
  try {
    return piId
      ? await stripe.paymentIntents.update(piId, {
          ...baseParams,
          automatic_payment_methods: { enabled: true },
        })
      : await stripe.paymentIntents.create({
          ...baseParams,
          automatic_payment_methods: { enabled: true },
        });
  } catch (e) {
    const unknownAPM =
      e?.code === "parameter_unknown" &&
      e?.param === "automatic_payment_methods";
    if (!unknownAPM) throw e;
    return piId
      ? await stripe.paymentIntents.update(piId, {
          ...baseParams,
          payment_method_types: ["card"],
        })
      : await stripe.paymentIntents.create({
          ...baseParams,
          payment_method_types: ["card"],
        });
  }
}
async function createPIWithSmartAPM(stripe, baseParams) {
  try {
    // Preferred: APM
    return await stripe.paymentIntents.create({
      ...baseParams,
      automatic_payment_methods: { enabled: true },
    });
  } catch (e) {
    const unknownAPM =
      e?.code === "parameter_unknown" &&
      e?.param === "automatic_payment_methods";
    if (!unknownAPM) throw e;
    // Fallback: card-only
    return await stripe.paymentIntents.create({
      ...baseParams,
      payment_method_types: ["card"],
    });
  }
}

async function safeExpireSession(stripe, sessionId) {
  if (!sessionId) return;
  try {
    const s = await stripe.checkout.sessions.retrieve(sessionId);
    if (s?.status === "open") await stripe.checkout.sessions.expire(sessionId);
  } catch {}
}
async function safeCancelPI(stripe, piId) {
  if (!piId) return;
  try {
    const pi = await stripe.paymentIntents.retrieve(piId);
    if (
      [
        "requires_payment_method",
        "requires_confirmation",
        "requires_action",
        "processing",
      ].includes(pi?.status)
    ) {
      await stripe.paymentIntents.cancel(piId);
    }
  } catch {}
}

async function updatePIKeepMode(stripe, piId, baseParams) {
  // IMPORTANT: do not send automatic_payment_methods nor payment_method_types here
  // Stripe keeps whatever mode the PI was created with.
  return await stripe.paymentIntents.update(piId, {
    amount: baseParams.amount,
    currency: baseParams.currency,
    metadata: baseParams.metadata,
  });
}

export async function POST(req, ctx) {
  const { id } = await ctx.params;
  const draftId = Number(id);
  if (!Number.isFinite(draftId) || draftId <= 0) return bad("Invalid id");

  // Read body
  let body = {};
  try {
    body = await req.json();
  } catch {}
  const promoCode = (body?.promoCode || "").trim();
  const mode = String(body?.mode || "checkout").toLowerCase(); // "checkout" | "elements"

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  // Stripe
  const stripe = getStripe();

  // 1) Load draft (allow re-entry when status=checkout)
  const { data: draft, error: dErr } = await admin
    .from("BookingDraft")
    .select(
      `
      id, experienceId, scheduleSlotId, counts, status, expiresAt,
      primary_contact, "unitPriceAdult", "unitPriceKid",
      "totalAmount", "stripeSessionId", "appliedPromoCode",
      "stripePaymentIntentId", "currency"
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

  const { data: bookings, error: bErr } = await admin
    .from("booking")
    .select("numberOfPeople,status")
    .eq("scheduleSlotId", slot.id);
  if (bErr) return bad("Server error", 500);
  const bookedFromReservations = (bookings || []).reduce((sum, b) => {
    const st = String(b.status || "").toLowerCase();
    if (!COUNT_STATUSES.has(st)) return sum;
    const n = Number(b.numberOfPeople || 0);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const { data: holds, error: hErr } = await admin
    .from("BookingDraft")
    .select('id, counts, status, expiresAt, "convertedBookingId"')
    .eq("scheduleSlotId", slot.id);
  if (hErr) return bad("Server error", 500);

  const otherActiveHolds = (holds || []).reduce((sum, h) => {
    if (h.id === draftId) return sum;
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

  // 5) Pricing
  const currency = String(draft.currency || "eur").toLowerCase();
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
  if (base.some((it) => !(Number(it.unit) > 0)))
    return bad("Invalid unit price for one or more items.", 400);

  const toCents = (v) => Math.round(Number(v || 0) * 100);
  const subtotalCents = base.reduce(
    (s, it) => s + toCents(it.unit) * it.qty,
    0
  );

  // 6) Promo
  let promo = null;
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
    if (promo.discountType === "percent") {
      const pct = Math.min(Math.max(Number(promo.discountValue || 0), 0), 100);
      discountCents = Math.floor((subtotalCents * pct) / 100);
    } else {
      const fixedCents = Math.max(
        Math.round(Number(promo.discountValue || 0) * 100),
        0
      );
      discountCents = Math.min(fixedCents, subtotalCents);
    }
  }

  const finalTotalCents =
    subtotalCents - Math.min(discountCents, subtotalCents);
  // [ADD] Gift card metadata (if validate endpoint marked this as a gift card)
  const isGift = String(promo?.source || "").toLowerCase() === "giftcard";
  // What we'll stamp into Stripe metadata so the confirm route can redeem atomically
  const giftMeta = isGift
    ? {
        giftcard_id: promo?.giftcard?.id || promo?.giftcardId || null, // support either shape
        giftcard_code: promo?.code || promo?.giftcard?.code || null,
        giftcard_apply_cents: Math.min(discountCents, subtotalCents), // never over-apply
      }
    : null;

  // Zero total → mark paid and send confirmation
  if (finalTotalCents === 0) {
    // Ensure any previous Stripe artifacts can't be reused
    await safeExpireSession(stripe, draft.stripeSessionId);
    await safeCancelPI(stripe, draft.stripePaymentIntentId);
    const newExpiresAt = new Date(
      Date.now() + REFRESH_MINUTES_ON_CHECKOUT * 60 * 1000
    ).toISOString();
    await admin
      .from("BookingDraft")
      .update({
        status: "paid",
        stripeSessionId: null,
        stripePaymentIntentId: null,
        expiresAt: newExpiresAt,
        updatedAt: new Date().toISOString(),
        totalAmount: 0,
        appliedPromoCode: promo?.code ?? null,
        discountAmount: discountCents / 100,
        promoJson: promo ?? null,
      })
      .eq("id", draftId);

    const origin = computeOrigin(req);
    const redirectUrl = `${origin}/booking/${draftId}/confirmation`;
    // send both keys for compatibility; client uses redirectUrl
    return NextResponse.json({
      mode: "free",
      redirectUrl,
      url: redirectUrl,
      discounted: !!promo,
      discountCents,
      finalTotalCents,
      amountCents: 0,
      currency,
    }); // 200 OK
  }

  // Common: extend hold window + mark "checkout" state
  const newExpiresAt = new Date(
    Date.now() + REFRESH_MINUTES_ON_CHECKOUT * 60 * 1000
  ).toISOString();
  await admin
    .from("BookingDraft")
    .update({
      status: "checkout",
      expiresAt: newExpiresAt,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", draftId);

  // === Branch by mode ===
  if (mode === "elements") {
    // If PI exists and already confirmed/processing → suggest redirect
    if (draft.stripePaymentIntentId) {
      try {
        const existing = await stripe.paymentIntents.retrieve(
          draft.stripePaymentIntentId
        );
        if (
          existing?.status === "succeeded" ||
          existing?.status === "processing"
        ) {
          const origin = computeOrigin(req);
          return NextResponse.json(
            {
              error: "Already confirmed",
              redirectUrl: `${origin}/booking/${draftId}/confirmation`,
            },
            { status: 409 }
          );
        }
      } catch {}
    }

    // Create/update PI
    // --- inside if (mode === "elements") { ... } ---
    const baseParams = {
      amount: finalTotalCents,
      currency,
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
        promo_currency: (promo?.currency ?? "").toUpperCase(),
        source: promo?.source ?? "",
        // Gift card hints so confirm route can redeem exactly once
        ...(giftMeta
          ? {
              giftcard_id: giftMeta.giftcard_id || "",
              giftcard_code: giftMeta.giftcard_code || "",
              giftcard_apply_cents: String(giftMeta.giftcard_apply_cents || 0),
            }
          : {}),
      },
    };

    let pi;
    try {
      if (draft.stripePaymentIntentId) {
        // keep existing mode, only update amount/currency/metadata
        // (pre-check for terminal states stays as you already have it)
        pi = await updatePIKeepMode(
          stripe,
          draft.stripePaymentIntentId,
          baseParams
        );
      } else {
        // create new, prefer APM then fallback to card-only
        pi = await createPIWithSmartAPM(stripe, baseParams);
        await admin
          .from("BookingDraft")
          .update({ stripePaymentIntentId: pi.id })
          .eq("id", draftId);
      }
    } catch (e) {
      console.error("[elements] stripe error", e?.message);
      return bad(e?.message || "Stripe error creating payment intent", 400);
    }

    await admin
      .from("BookingDraft")
      .update({
        totalAmount: finalTotalCents / 100,
        appliedPromoCode: promo?.code ?? null, // works for voucher or discount
        discountAmount: promo ? discountCents / 100 : 0,
        promoJson: promo ?? null,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", draftId);

    return ok({
      mode: "elements",
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
      amountCents: finalTotalCents,
      currency,
      discounted: !!promo,
    });
  }

  // Default: CHECKOUT SESSION (redirect) mode
  const line_items = discountedStripeItems(base, currency, discountCents);

  const origin = computeOrigin(req);
  const successUrl = `${origin}/booking/${draftId}/confirmation?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/booking/${draftId}/payment?cancelled=1`;

  try {
    new URL(successUrl);
    new URL(cancelUrl);
  } catch {
    console.error("[checkout] invalid URLs", { origin, successUrl, cancelUrl });
    return bad("Server URL misconfigured. Check NEXT_PUBLIC_SITE_URL.", 500);
  }

  const currentTotalCents = finalTotalCents;
  const currentPromoCode = promo?.code ?? null;
  const idemKey = `checkout_draft_${draftId}_${currentTotalCents}_${
    currentPromoCode || ""
  }`;

  // Reuse open session if nothing changed
  if (draft.status === "checkout" && draft.stripeSessionId) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(
        draft.stripeSessionId
      );
      const storedTotalCents = Math.round(Number(draft.totalAmount || 0) * 100);
      const storedPromoCode = draft.appliedPromoCode ?? null;
      const priceOrPromoChanged =
        storedTotalCents !== currentTotalCents ||
        storedPromoCode !== currentPromoCode;

      if (
        !priceOrPromoChanged &&
        existing?.status === "open" &&
        existing?.url
      ) {
        return ok({ mode: "checkout", url: existing.url, reused: true });
      }
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

  let session;
  try {
    // Build promo metadata once so we can reuse it
    const promoMeta = {
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
      promo_currency: (promo?.currency ?? "").toUpperCase(),
      source: promo?.source ?? "",
      // Gift card metadata mirrors Elements path
      ...(giftMeta
        ? {
            giftcard_id: giftMeta.giftcard_id || "",
            giftcard_code: giftMeta.giftcard_code || "",
            giftcard_apply_cents: String(giftMeta.giftcard_apply_cents || 0),
          }
        : {}),
    };

    const customerEmail = draft.primary_contact?.email ?? undefined;

    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items,
        success_url: successUrl,
        cancel_url: cancelUrl,

        // This pre-fills the email in Checkout
        customer_email: customerEmail,

        client_reference_id: String(draftId),

        // Keep it on the Session (handy for debugging)
        metadata: promoMeta,

        // IMPORTANT: also put it on the PaymentIntent and set receipt email
        payment_intent_data: {
          // lets Stripe send the charge receipt automatically (ensure receipts are enabled in Dashboard)
          receipt_email: customerEmail,
          // copy promo metadata so your confirm route can read it from the PI reliably
          metadata: promoMeta,
        },
        payment_method_collection: "if_required",
      },
      { idempotencyKey: idemKey }
    );
  } catch (e) {
    console.error("[checkout] stripe error", e?.message);
    return bad(e?.message || "Stripe error creating session", 400);
  }

  // Store snapshot for session mode
  let upd = await admin
    .from("BookingDraft")
    .update({
      status: "checkout",
      stripeSessionId: session.id,
      expiresAt: newExpiresAt,
      updatedAt: new Date().toISOString(),
      totalAmount: finalTotalCents / 100,
      appliedPromoCode: promo?.code ?? null,
      discountAmount: promo ? discountCents / 100 : 0,
      promoJson: promo ?? null,
    })
    .eq("id", draftId);

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

  // Optional: record promo redemption pending
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
      { onConflict: "stripeSessionId" }
    );
    if (red.error) {
      console.warn(
        "[checkout] failed to record promo redemption:",
        red.error.code,
        red.error.message
      );
    }
  }

  return ok({
    mode: "checkout",
    url: session.url,
    discounted: !!promo,
    discountCents,
    finalTotalCents,
  });
}

// ---------- helpers ----------
function discountedStripeItems(baseItems, currency, discountCents) {
  const cents = (v) => Math.round(Number(v || 0) * 100);
  const subtotal = baseItems.reduce((s, it) => s + cents(it.unit) * it.qty, 0);

  if (subtotal <= 0 || discountCents <= 0) {
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

    const baseUnit = Math.floor(finalLineCents / it.qty);
    let remainder = finalLineCents - baseUnit * it.qty;

    const qtyBase = baseUnit >= 1 ? it.qty - remainder : 0;
    if (qtyBase > 0) {
      items.push({
        quantity: qtyBase,
        price_data: {
          currency,
          unit_amount: baseUnit,
          product_data: { name: it.name },
        },
      });
    }
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
  const out = new Array(weights.length).fill(0);
  if (discountCents <= 0 || totalCents <= 0) return out;
  let assigned = 0;
  for (let i = 0; i < weights.length; i++) {
    const share = Math.floor((weights[i] * discountCents) / totalCents);
    out[i] = Math.min(share, weights[i]);
    assigned += out[i];
  }
  let remainder = discountCents - assigned;
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
  const u = new URL(req.url);
  const host = `${u.protocol}//${u.host}`.replace(/\/$/, "");
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev && /^(http:\/\/)?(localhost|127\.0\.0\.1)/i.test(host)) return host;
  throw new Error("Site URL not configured");
}
