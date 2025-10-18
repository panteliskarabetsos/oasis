// src/app/api/admin/bookings/drafts/intent/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

// Quick health check: GET /api/admin/bookings/drafts/intent?id=123
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const draftId = Number(sp.get("id"));
  if (!Number.isFinite(draftId) || draftId <= 0) return bad("Invalid draft id");
  return ok({ alive: true, draftId });
}

// POST { draftId, promoCode? } → creates/updates PaymentIntent
export async function POST(req) {
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const body = (await req.json().catch(() => ({}))) || {};
  const draftId = Number(body.draftId);
  const promoCode = (body.promoCode || "").toString().trim();

  if (!Number.isFinite(draftId) || draftId <= 0) return bad("Invalid draft id");

  // Load draft with your actual columns (incl. new currency)
  const { data: d, error: dErr } = await admin
    .from("BookingDraft")
    .select(
      `
      id,
      status,
      counts,
      "unitPriceAdult",
      "unitPriceKid",
      "stripePaymentIntentId",
      "currency",
      "appliedPromoCode"
    `
    )
    .eq("id", draftId)
    .maybeSingle();

  if (dErr) return bad("DB error loading draft", 500);
  if (!d)
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  if (String(d.status || "").toLowerCase() === "paid") {
    return bad("Already paid", 409);
  }

  // Compute subtotal (server-trusted)
  const A = Number(d?.counts?.adults || 0);
  const K = Number(d?.counts?.kids || 0);
  const toC = (x) => Math.round((Number(x) || 0) * 100);

  const unitAdult = Number(d?.unitPriceAdult || 0);
  const unitKid = Number(d?.unitPriceKid ?? unitAdult);

  if (!(unitAdult > 0) && A > 0) return bad("Invalid adult unit price", 400);
  if (!(unitKid > 0) && K > 0) return bad("Invalid kid unit price", 400);

  const subtotalC = toC(unitAdult) * A + toC(unitKid) * K;

  // Optional promo validation via your existing endpoint
  let discountC = 0;
  if (promoCode) {
    try {
      const origin = new URL(req.url).origin;
      const r = await fetch(
        `${origin}/api/promotions/validate?code=${encodeURIComponent(
          promoCode
        )}&draftId=${draftId}`,
        { cache: "no-store" }
      );
      if (r.ok) {
        const p = await r.json();
        const type = String(
          p?.discountType || p?.type || "percent"
        ).toLowerCase();
        const val = Number(p?.discountValue ?? p?.value ?? 0);
        if (type === "percent") {
          discountC = Math.floor(
            (subtotalC * Math.min(Math.max(val, 0), 100)) / 100
          );
        } else {
          discountC = Math.min(Math.max(Math.round(val * 100), 0), subtotalC);
        }
      }
    } catch {
      // ignore promo if validator unavailable
    }
  }

  const amountCents = Math.max(0, subtotalC - discountC);
  const currency = String(d.currency || "eur").toLowerCase();

  // If total is zero, mark paid and bail out
  if (amountCents === 0) {
    await admin
      .from("BookingDraft")
      .update({
        status: "paid",
        totalAmount: 0,
        appliedPromoCode: promoCode || null,
        discountAmount: (discountC || 0) / 100,
        promoJson: promoCode ? { code: promoCode } : null,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", draftId);

    return ok({
      draftId,
      zeroTotal: true,
      next: { redirectUrl: `/booking/${draftId}/confirmation` },
    });
  }

  // Create/update the PaymentIntent (using your camelCase column)
  const stripe = getStripe();
  let pi;

  if (d.stripePaymentIntentId) {
    pi = await stripe.paymentIntents.update(d.stripePaymentIntentId, {
      amount: amountCents,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: { draftId: String(draftId) },
    });
  } else {
    pi = await stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: { draftId: String(draftId) },
    });
    await admin
      .from("BookingDraft")
      .update({ stripePaymentIntentId: pi.id })
      .eq("id", draftId);
  }

  return ok({
    draftId,
    paymentIntentId: pi.id,
    clientSecret: pi.client_secret,
    amountCents,
    currency,
  });
}
