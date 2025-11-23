export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import crypto from "node:crypto";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

const toCents = (n) => Math.round(Number(n || 0) * 100);

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      experienceId,
      startTime,
      counts,
      items = [],
      manualDiscount = 0,
      promoCode,
      giftCode,
      customer = {},
      currency = "eur",
    } = body || {};

    const supa = await createSupabaseAdmin();

    /* -------- Experience (optional) -------- */
    const adults = Number(counts?.adults || 0);
    const kids = Number(counts?.kids || 0);

    let unitAdult = 0,
      unitKid = 0;
    if (experienceId) {
      const { data: e, error: ee } = await supa
        .from("Experience")
        .select("id,priceAdult,priceKid")
        .eq("id", experienceId)
        .single();
      if (ee || !e) return bad("Experience not found", 404);
      if (adults + kids <= 0) return bad("No attendees");
      if (!startTime) return bad("Missing startTime");

      unitAdult = Number(e.priceAdult || 0);
      unitKid = Number(e.priceKid || 0);
    }

    const expSubtotalCents =
      toCents(unitAdult) * adults + toCents(unitKid) * kids;

    /* -------------- Items --------------- */
    // (For full trust, fetch prices server-side by id.)
    const cleanItems = (items || [])
      .filter((it) => Number(it.quantity) > 0)
      .map((it) => ({
        id: it.id ?? null,
        name: String(it.name || "").slice(0, 120),
        sku: it.sku ? String(it.sku).slice(0, 80) : null,
        unitPriceCents: toCents(it.unitPrice),
        quantity: Number(it.quantity || 0),
      }));

    const itemsSubtotalCents = cleanItems.reduce(
      (s, it) => s + it.unitPriceCents * it.quantity,
      0
    );

    const grossCents = expSubtotalCents + itemsSubtotalCents;

    /* -------------- Promo --------------- */
    let promoDeductionCents = 0;
    if (promoCode) {
      const { data: pc } = await supa
        .from("DiscountCode")
        .select("*")
        .ilike("code", String(promoCode).trim())
        .maybeSingle();

      if (pc && pc.active) {
        const now = new Date();
        const within =
          (!pc.startsAt || new Date(pc.startsAt) <= now) &&
          (!pc.endsAt || new Date(pc.endsAt) >= now);
        const scopeOk =
          pc.scope === "global" ||
          (experienceId &&
            Array.isArray(pc.experienceIds) &&
            pc.experienceIds.includes(experienceId));
        const notMaxed =
          pc.maxRedemptions == null ||
          Number(pc.redemptionCount || 0) < Number(pc.maxRedemptions || 0);

        if (within && scopeOk && notMaxed) {
          const t = pc.discountType;
          const v = Number(pc.discountValue || 0);
          promoDeductionCents =
            t === "percent"
              ? Math.round((grossCents * v) / 100)
              : Math.min(grossCents, toCents(v));
        }
      }
    }

    /* -------------- Gift --------------- */
    let giftDeductionCents = 0;
    if (giftCode) {
      const { data: gc } = await supa
        .from("GiftCard")
        .select("*")
        .ilike("code", String(giftCode).trim())
        .maybeSingle();

      if (
        gc &&
        gc.status === "active" &&
        Number(gc.remaining_amount_cents) > 0
      ) {
        const baseAfterPromoCents = Math.max(
          0,
          grossCents - promoDeductionCents
        );
        giftDeductionCents = Math.min(
          baseAfterPromoCents,
          Number(gc.remaining_amount_cents)
        );
      }
    }

    const manualCents = Math.max(0, toCents(manualDiscount));
    const netCents = Math.max(
      0,
      grossCents - promoDeductionCents - giftDeductionCents - manualCents
    );

    const stripeCurrency = (currency || "eur").toLowerCase();

    // No payment needed (e.g., fully discounted)
    if (netCents === 0) {
      return ok({
        requiresPayment: false,
        intentId: null,
        clientSecret: null,
        amount: 0,
        currency: stripeCurrency,
        quote: {
          gross: grossCents / 100,
          net: 0,
          promoDeduction: promoDeductionCents / 100,
          giftDeduction: giftDeductionCents / 100,
          manual: manualCents / 100,
          amountCents: 0,
          currency: stripeCurrency,
        },
      });
    }

    // Guard common causes of errors
    if (!Number.isFinite(netCents))
      return bad("Computed amount is invalid (NaN).", 400);
    if (netCents < 50)
      return bad("Amount below minimum charge (EUR 0.50).", 400);

    /* -------- Stripe PI (card-only) -------- */
    const stripe = getStripe();

    const idemKey = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          experienceId: experienceId ?? null,
          startTime: startTime ?? null,
          adults,
          kids,
          items: cleanItems.map(({ id, sku, quantity, unitPriceCents }) => ({
            id,
            sku,
            quantity,
            unitPriceCents,
          })),
          promoCode: promoCode || "",
          giftCode: giftCode || "",
          manualCents,
          netCents,
          currency: stripeCurrency,
          email: customer?.email || "",
        })
      )
      .digest("hex");

    const pi = await stripe.paymentIntents.create(
      {
        amount: netCents,
        currency: stripeCurrency,
        payment_method_types: ["card"], // CARD ONLY
        metadata: {
          pos: "true",
          mode: experienceId ? "experience_or_mixed" : "items_only",
          experienceId: experienceId ? String(experienceId) : "",
          startTime: startTime ? String(startTime) : "",
          adults: String(adults || 0),
          kids: String(kids || 0),
          itemsCount: String(cleanItems.length),
          promoCode: promoCode || "",
          giftCode: giftCode || "",
          manualDiscountCents: String(manualCents),
          grossCents: String(grossCents),
          netCents: String(netCents),
          currency: stripeCurrency.toUpperCase(),
        },
        receipt_email: customer?.email || undefined,
      },
      { idempotencyKey: idemKey }
    );

    return ok({
      requiresPayment: true,
      intentId: pi.id,
      clientSecret: pi.client_secret,
      amount: pi.amount,
      currency: pi.currency,
      quote: {
        gross: grossCents / 100,
        net: netCents / 100,
        promoDeduction: promoDeductionCents / 100,
        giftDeduction: giftDeductionCents / 100,
        manual: manualCents / 100,
        amountCents: netCents,
        currency: stripeCurrency,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 400 }
    );
  }
}
