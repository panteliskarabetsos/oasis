// src/app/api/pos/checkout/route.js
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// Use the service role (server only)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/* -------------------------------------------------------------
   Helpers
------------------------------------------------------------- */
const nowIso = () => new Date().toISOString();
const toCurrency = (v) => String(v || "eur").toUpperCase();
const eur = (n) => Math.round(Number(n || 0)); // integer cents helper
const fromCents = (c) => Math.max(0, Math.round(Number(c || 0))) / 100;
const clamp = (n, min, max) => Math.min(Math.max(Number(n) || 0, min), max);

function itemizeNote(items = []) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const lines = items
    .filter((l) => (Number(l.quantity) || 0) > 0)
    .map(
      (l) =>
        `• ${l.name}${l.sku ? ` (${l.sku})` : ""} × ${l.quantity} @ €${Number(
          l.unitPrice || 0,
        ).toFixed(2)} = €${(
          Number(l.unitPrice || 0) * Number(l.quantity || 0)
        ).toFixed(2)}`,
    );
  return ["Items:", ...lines].join("\n");
}

async function fetchExperience(experienceId) {
  if (!experienceId) return null;
  const { data, error } = await supabase
    .from("Experience")
    .select("id, priceAdult, priceKid, duration")
    .eq("id", experienceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function fetchDiscountByCode(code) {
  if (!code) return null;
  const { data, error } = await supabase
    .from("DiscountCode")
    .select(
      "id, code, discountType, discountValue, currency, maxRedemptions, redemptionCount, startsAt, endsAt, active, scope, experienceIds",
    )
    .ilike("code", code.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

function isDiscountActive(dc, currency, experienceId) {
  if (!dc || !dc.active) return false;
  const now = new Date();
  if (dc.startsAt && new Date(dc.startsAt) > now) return false;
  if (dc.endsAt && new Date(dc.endsAt) < now) return false;
  if (dc.currency && dc.currency.toUpperCase() !== currency.toUpperCase())
    return false;
  if (dc.maxRedemptions && dc.redemptionCount >= dc.maxRedemptions)
    return false;
  if (
    dc.scope &&
    dc.scope !== "global" &&
    Array.isArray(dc.experienceIds) &&
    experienceId &&
    !dc.experienceIds.includes(experienceId)
  )
    return false;
  return true;
}

async function incrementDiscountRedemption(id) {
  if (!id) return;
  const { data, error } = await supabase
    .from("DiscountCode")
    .select("redemptionCount")
    .eq("id", id)
    .maybeSingle();
  if (!error && data) {
    await supabase
      .from("DiscountCode")
      .update({ redemptionCount: (data.redemptionCount || 0) + 1 })
      .eq("id", id);
  }
}

async function fetchGiftCardByCode(code) {
  if (!code) return null;
  const { data, error } = await supabase
    .from("GiftCard")
    .select(
      "id, code, remaining_amount_cents, currency, status, expires_at, recipient_email, recipient_name",
    )
    .ilike("code", code.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

function canRedeemGiftCard(gc, currency) {
  if (!gc) return false;
  if (gc.status !== "active") return false;
  if (gc.expires_at && new Date(gc.expires_at) < new Date()) return false;
  if ((gc.currency || "").toUpperCase() !== (currency || "").toUpperCase())
    return false;
  return (gc.remaining_amount_cents || 0) > 0;
}

/* -------------------------------------------------------------
   Route
------------------------------------------------------------- */
export async function POST(req) {
  try {
    const body = await req.json();

    // Basic payload
    const transactionType = body?.transactionType || "experience"; // "experience", "items", "addons"
    const experienceId = body?.experienceId ?? null;
    const counts = body?.counts || null;
    const adults = Number(counts?.adults || 0);
    const kids = Number(counts?.kids || 0);
    const items = Array.isArray(body?.items) ? body.items : [];
    const manualDiscountEur = Math.max(0, Number(body?.manualDiscount || 0));
    const promoCode = (body?.promoCode || "").trim() || null;
    const giftCode = (body?.giftCode || "").trim() || null;
    const customer = body?.customer || null;
    const startTime = body?.startTime || null;
    const clientCurrency = toCurrency(body?.currency || "eur");
    const method = body?.payment?.method || "cash";
    const reference = (body?.payment?.reference || "").trim() || null;

    /* -------------------------------
       Server-side pricing
    -------------------------------- */
    let unitPriceAdult = 0;
    let unitPriceKid = 0;
    let durationMinutes = body?.duration ?? null;

    // Only strictly validate and fetch Experience pricing if this is a booking
    if (experienceId && transactionType === "experience") {
      const exp = await fetchExperience(experienceId);
      if (!exp) {
        return NextResponse.json(
          { error: "Experience not found" },
          { status: 400 },
        );
      }
      unitPriceAdult = Number(exp.priceAdult || 0);
      unitPriceKid = Number(exp.priceKid || 0);

      if (typeof durationMinutes !== "number") {
        durationMinutes = null;
      }
    }

    const itemsSubtotal = items.reduce(
      (sum, it) =>
        sum +
        Number(it.unitPrice || it.price || 0) *
          Number(it.quantity || it.qty || 0),
      0,
    );

    const expSubtotal =
      experienceId && transactionType === "experience"
        ? adults * unitPriceAdult + kids * unitPriceKid
        : 0;

    const subtotal = Math.max(
      0,
      Math.round((expSubtotal + itemsSubtotal) * 100),
    ); // in cents

    /* -------------------------------
       Promo & manual discounts
    -------------------------------- */
    let promo = null;
    if (promoCode) {
      const dc = await fetchDiscountByCode(promoCode);
      if (isDiscountActive(dc, clientCurrency, experienceId)) {
        if (dc.discountType === "percent") {
          const pct = clamp(dc.discountValue, 0, 100);
          promo = { id: dc.id, code: dc.code, type: "percent", value: pct };
        } else if (dc.discountType === "amount") {
          const amountEur = Math.max(0, Number(dc.discountValue || 0));
          promo = {
            id: dc.id,
            code: dc.code,
            type: "amount",
            value: amountEur,
            currency: dc.currency || clientCurrency,
          };
        }
      }
    }

    const manualDiscountCents = eur(manualDiscountEur * 100) / 100;
    const manualDiscountC = eur(manualDiscountEur * 100);
    let promoDiscountC = 0;

    if (promo) {
      if (promo.type === "percent") {
        promoDiscountC = Math.floor((subtotal * promo.value) / 100);
      } else if (promo.type === "amount") {
        if (
          !promo.currency ||
          promo.currency.toUpperCase() === clientCurrency.toUpperCase()
        ) {
          promoDiscountC = eur(promo.value * 100);
        }
      }
    }

    // Clamp total discount to subtotal
    const discountTotalC = Math.min(subtotal, manualDiscountC + promoDiscountC);
    const netBeforeGiftC = Math.max(0, subtotal - discountTotalC);

    /* -------------------------------
       Gift card (non-card flows)
    -------------------------------- */
    let gift = null;
    if (giftCode && method !== "card") {
      const gc = await fetchGiftCardByCode(giftCode);
      if (canRedeemGiftCard(gc, clientCurrency)) {
        const redeemable = Math.min(gc.remaining_amount_cents, netBeforeGiftC);
        gift = {
          id: gc.id,
          code: gc.code,
          redeem_cents: redeemable,
          currency: gc.currency,
        };
      }
    }

    const netAfterGiftC =
      method === "card"
        ? netBeforeGiftC
        : Math.max(0, netBeforeGiftC - (gift?.redeem_cents || 0));

    /* -------------------------------
       Payment handling
    -------------------------------- */
    let totalPaidAmount = 0; // euros
    let currency = clientCurrency;
    let stripePaymentIntentId = null;
    let paymentNote = "";
    let bookingStatus = "confirmed";

    if (method === "card") {
      const piId = body.stripePaymentIntentId;
      if (!piId) {
        return NextResponse.json(
          { error: "Missing stripePaymentIntentId" },
          { status: 400 },
        );
      }

      // Dedupe check
      const tableToCheck =
        transactionType === "items" || transactionType === "addons"
          ? "Receipt"
          : "booking";
      const { data: existing, error: exErr } = await supabase
        .from(tableToCheck)
        .select("id")
        .eq("stripePaymentIntentId", piId)
        .maybeSingle();

      if (!exErr && existing?.id) {
        return NextResponse.json(
          tableToCheck === "Receipt"
            ? { receiptId: existing.id }
            : { bookingId: existing.id },
        );
      }

      let pi = await stripe.paymentIntents.retrieve(piId, {
        expand: ["latest_charge", "charges.data"],
      });
      if (pi.status === "requires_capture") {
        pi = await stripe.paymentIntents.capture(pi.id);
      }

      const okStatuses = ["succeeded", "processing", "requires_capture"];
      if (!okStatuses.includes(pi.status)) {
        return NextResponse.json(
          { error: `PaymentIntent not payable: ${pi.status}` },
          { status: 400 },
        );
      }

      const charge =
        typeof pi.latest_charge === "string"
          ? (pi.charges?.data?.[0] ?? null)
          : pi.latest_charge;
      const brand = charge?.payment_method_details?.card?.brand?.toUpperCase();
      const last4 = charge?.payment_method_details?.card?.last4;
      const receiptUrl =
        charge?.receipt_url || pi.charges?.data?.[0]?.receipt_url || null;

      totalPaidAmount = fromCents(pi.amount_received ?? pi.amount);
      currency = toCurrency(pi.currency || currency);
      stripePaymentIntentId = pi.id;

      paymentNote =
        `Paid by web card • ${brand || "CARD"} • **** **** **** ${last4 || "????"} • PI ${pi.id}` +
        (receiptUrl ? ` • receipt: ${receiptUrl}` : "");

      bookingStatus = pi.status === "succeeded" ? "confirmed" : "pending";
    } else if (method === "comp") {
      totalPaidAmount = 0;
      paymentNote = "Complimentary";
    } else {
      const methodLabel = method.charAt(0).toUpperCase() + method.slice(1);
      const giftPart = gift?.redeem_cents
        ? ` • gift: €${(gift.redeem_cents / 100).toFixed(2)}`
        : "";

      paymentNote = `Paid by ${methodLabel}${reference ? ` • ref: ${reference}` : ""}${giftPart}`;
      totalPaidAmount = fromCents(netBeforeGiftC);
      bookingStatus = "confirmed";
    }

    const itemsForJson = items
      .filter((l) => Number(l.quantity || l.qty || 0) > 0)
      .map((l) => ({
        id: l.id ?? null,
        name: l.name ?? "",
        sku: l.sku ?? null,
        unitPrice: Number(l.unitPrice || l.price || 0),
        quantity: Number(l.quantity || l.qty || 0),
      }));

    const notesPieces = [
      itemizeNote(itemsForJson),
      paymentNote || null,
      body?.notes || null,
    ].filter(Boolean);
    const notes = notesPieces.length ? notesPieces.join("\n\n") : null;

    let responseId = null;

    /* -----------------------------------------------------------
       DATABASE INSERTS (Experience vs Items/Addons)
    ----------------------------------------------------------- */
    if (transactionType === "items" || transactionType === "addons") {
      // 1. Create a Receipt
      const receiptPayload = {
        items: itemsForJson, // Supabase JSONB
        totalPaidAmount,
        currency,
        discountAmount: fromCents(discountTotalC),
        paymentMethod: method,
        paymentReference: reference || stripePaymentIntentId || null,
        notes,
        stripePaymentIntentId,
        customerName: customer?.name || null,
        customerEmail: customer?.email || null,
        transactionType: transactionType,
        relatedBookingRef: body.relatedBookingRef || null,
      };

      const { data: createdReceipt, error: receiptErr } = await supabase
        .from("Receipt")
        .insert(receiptPayload)
        .select("id")
        .single();

      if (receiptErr) {
        throw new Error(`Receipt Insert Failed: ${receiptErr.message}`);
      }

      responseId = { receiptId: createdReceipt.id };
    } else {
      // 2. Create a Booking
      const numberOfPeople =
        experienceId && adults + kids > 0 ? adults + kids : 1;

      const promoJson = {
        currency,
        breakdown: {
          expSubtotal: fromCents(eur(expSubtotal * 100)),
          itemsSubtotal: fromCents(eur(itemsSubtotal * 100)),
          subtotal: fromCents(subtotal),
          manualDiscount: fromCents(manualDiscountC),
          promoDiscount: fromCents(promoDiscountC),
          discountTotal: fromCents(discountTotalC),
          netBeforeGift: fromCents(netBeforeGiftC),
          giftApplied:
            method === "card" ? 0 : fromCents(gift?.redeem_cents || 0),
          netAfterGift:
            method === "card"
              ? fromCents(netBeforeGiftC)
              : fromCents(netAfterGiftC),
          totalPaidAmount,
        },
        payment: {
          method,
          reference,
          stripePaymentIntentId,
          status: bookingStatus,
        },
        promo:
          promo &&
          (promo.type === "percent"
            ? {
                id: promo.id,
                code: promo.code,
                type: "percent",
                value: promo.value,
              }
            : {
                id: promo.id,
                code: promo.code,
                type: "amount",
                value: promo.value,
                currency: promo.currency || currency,
              }),
        gift: gift &&
          method !== "card" && {
            id: gift.id,
            code: gift.code,
            redeem_cents: gift.redeem_cents,
            currency: gift.currency,
          },
        items: itemsForJson,
        createdAt: nowIso(),
      };

      const insertPayload = {
        experienceId: experienceId ?? null,
        startTime: startTime ?? null,
        counts: counts ?? null,
        adultsCount: experienceId ? adults : null,
        kidsCount: experienceId ? kids : null,
        numberOfPeople,
        unitPriceAdult: experienceId ? unitPriceAdult : null,
        unitPriceKid: experienceId ? unitPriceKid : null,
        totalPaidAmount,
        currency,
        stripePaymentIntentId,
        primary_contact: customer ?? null,
        appliedPromoCode: promoCode ?? null,
        discountAmount: fromCents(discountTotalC),
        promoJson,
        notes,
        status: bookingStatus,
        duration: durationMinutes ?? null,
      };

      const { data: created, error: insertErr } = await supabase
        .from("booking")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 400 });
      }

      responseId = { bookingId: created.id };
    }

    /* -------------------------------
       Side-effects: promo & gift logs
    -------------------------------- */
    if (promo?.id) {
      await incrementDiscountRedemption(promo.id);
    }

    if (gift && method !== "card" && gift.redeem_cents > 0) {
      const { data: gcRow } = await supabase
        .from("GiftCard")
        .select("remaining_amount_cents")
        .eq("id", gift.id)
        .maybeSingle();

      if (gcRow) {
        const newRemain = Math.max(
          0,
          (gcRow.remaining_amount_cents || 0) - gift.redeem_cents,
        );
        await supabase
          .from("GiftCard")
          .update({
            remaining_amount_cents: newRemain,
            last_redeemed_at: nowIso(),
          })
          .eq("id", gift.id);
      }

      await supabase.from("GiftCardRedemption").insert({
        gift_card_id: gift.id,
        booking_id: responseId.bookingId || null, // null if it was a receipt transaction
        amount_cents: gift.redeem_cents,
        currency,
        notes: `Redeemed during POS checkout (${method}${reference ? `, ref: ${reference}` : ""})`,
      });
    }

    return NextResponse.json(responseId);
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "Checkout error" },
      { status: 400 },
    );
  }
}
