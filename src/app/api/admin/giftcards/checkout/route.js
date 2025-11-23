// src/app/api/admin/giftcards/checkout/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { requireAdmin } from "@/lib/auth/requireAdmin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

const MIN_CENTS = 25 * 100;
const MAX_CENTS = 400 * 100;
const STEP_CENTS = 5 * 100;

const stripe = (() => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2024-06-20" });
})();

function sanitizeStr(v, max = 500) {
  if (!v) return "";
  return String(v).trim().slice(0, max);
}
function normalizeCode(v) {
  return sanitizeStr(v || "", 64).toUpperCase();
}

export async function POST(req) {
  const r = await requireAdmin();
  if (!r.ok) return r.response;
  if (!stripe)
    return bad("Stripe is not configured (missing STRIPE_SECRET_KEY)", 500);

  const body = await req.json().catch(() => ({}));

  const {
    initialAmountCents,
    code,
    currency = "EUR",
    recipientEmail,
    recipientName,
    message,
    expiresAt, // string (YYYY-MM-DD or ISO) – stored as-is in metadata
    successUrl,
    cancelUrl,
  } = body || {};

  // ---- Validate amount (25–400 EUR, step 5) ----
  const amt = Number(initialAmountCents);
  if (!Number.isInteger(amt)) {
    return bad("‘initialAmountCents’ must be an integer number of cents.", 422);
  }
  if (amt < MIN_CENTS || amt > MAX_CENTS) {
    return bad(
      `Amount must be between €${(MIN_CENTS / 100) | 0} and €${
        (MAX_CENTS / 100) | 0
      }.`,
      422
    );
  }
  if (amt % STEP_CENTS !== 0) {
    return bad(
      `Amount must be in €${(STEP_CENTS / 100) | 0} increments (e.g., 55, 60).`,
      422
    );
  }

  // ---- Normalize inputs ----
  const normCode = normalizeCode(code || "");
  const currLower = String(currency || "EUR").toLowerCase();
  const currUpper = String(currency || "EUR").toUpperCase();
  const email = sanitizeStr(recipientEmail, 254);
  const name = sanitizeStr(recipientName, 200);
  const note = sanitizeStr(message, 500);
  const exp = sanitizeStr(expiresAt, 64);

  // ---- Success/Cancel URLs ----
  const reqOrigin = new URL(req.url).origin; // robust on local & previews
  const appOrigin = process.env.APP_URL?.replace(/\/$/, "") || reqOrigin;
  const success =
    successUrl ||
    `${appOrigin}/admin/giftcards?paid=1&session_id={CHECKOUT_SESSION_ID}`;
  const cancel = cancelUrl || `${appOrigin}/admin/giftcards?cancel=1`;

  // ---- Product name ----
  const nameLine = `Gift Card${normCode ? ` • ${normCode}` : ""}`;

  // ---- Idempotency: prevent duplicate sessions on double-click ----
  const idempotencyKey = [
    `gc`,
    r.user.id || "anon",
    normCode || "no-code",
    amt,
    currUpper,
  ].join(":");

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        allow_promotion_codes: false,
        customer_email: email || undefined,
        billing_address_collection: "auto",
        phone_number_collection: { enabled: false },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: currLower,
              unit_amount: amt,
              product_data: {
                name: nameLine,
                // images: [`${appOrigin}/_static/giftcard.png`], // optional
              },
            },
          },
        ],
        success_url: success,
        cancel_url: cancel,
        metadata: {
          app: "giftcard",
          source: "admin",
          code: normCode,
          currency: currUpper,
          initialAmountCents: String(amt),
          recipientEmail: email,
          recipientName: name,
          message: note,
          expiresAt: exp,
          createdByAuthId: r.user.id || "",
        },
      },
      { idempotencyKey }
    );

    return ok({ id: session.id, url: session.url }, 201);
  } catch (e) {
    return bad(e?.message || "Failed to create Stripe Checkout session", 500);
  }
}
