export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import crypto from "node:crypto";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { quotePosSale } from "@/lib/pos/quote";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });


export async function POST(req) {
  const auth = await requireAdmin("pos");
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    const { experienceId, startTime, counts, customer = {} } = body || {};

    const supa = await createSupabaseAdmin();

    // Priced by the shared POS quote so the card sheet and the QR payment
    // link can never charge different amounts for the same basket.
    const priced = await quotePosSale(supa, body);
    if (!priced.ok) return bad(priced.error, priced.status);

    const { adults, kids, cleanItems } = priced;
    const {
      grossCents,
      promoDeductionCents,
      giftDeductionCents,
      manualCents,
      netCents,
      currency: stripeCurrency,
    } = priced.quote;

    const promoCode = body?.promoCode;
    const giftCode = body?.giftCode;

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
