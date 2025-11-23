// src/app/api/admin/giftcards/checkout/confirm/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendGiftcardEmail } from "@/lib/email/sendGiftcardEmail";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

const stripe = (() => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2024-06-20" });
})();

export async function GET(req) {
  const r = await requireAdmin();
  if (!r.ok) return r.response;
  if (!stripe) return bad("Stripe is not configured", 500);

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id") || "";
  if (!sessionId) return bad("Missing 'session_id' query param", 422);

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  try {
    // 1) Retrieve Checkout Session – expand only payment_intent here
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });
    if (!session) return bad("Stripe session not found", 404);
    if (session.mode !== "payment") return bad("Unsupported session mode", 400);
    if (session.payment_status !== "paid")
      return bad("Payment not completed yet", 409);

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || null;

    // 2) Idempotency check – build OR only with present values
    const orClauses = [`stripe_session_id.eq.${session.id}`];
    if (paymentIntentId)
      orClauses.push(`stripe_payment_intent_id.eq.${paymentIntentId}`);

    const { data: existing, error: exErr } = await admin
      .from("GiftCard")
      .select("id, code, currency, initial_amount_cents, recipient_email")
      .or(orClauses.join(","))
      .limit(1);

    if (exErr) {
      console.error("giftcards lookup failed", exErr);
      return bad("Database error", 500);
    }
    if (existing?.length) {
      const row = existing[0];
      // Return full shape for the success dialog
      return ok({
        id: row.id,
        code: row.code,
        amountCents: row.initial_amount_cents,
        currency: (row.currency || "EUR").toUpperCase(),
        recipientEmail: row.recipient_email || null,
        already: true,
      });
    }

    // 3) Compose fields from metadata
    const md = session.metadata || {};
    const currency = (md.currency || session.currency || "EUR").toUpperCase();
    const code = (md.code || "").toUpperCase().trim();

    const fromMeta = Number.parseInt(md.initialAmountCents, 10);
    const fromSession = Number(session.amount_total || 0);
    const initialAmountCents = Number.isFinite(fromMeta)
      ? fromMeta
      : fromSession;

    if (!initialAmountCents || initialAmountCents <= 0) {
      return bad("Invalid amount (metadata/checkout missing)", 422);
    }

    const recipientEmail = md.recipientEmail || "";
    const recipientName = md.recipientName || "";
    const message = md.message || "";
    const expiresAt = md.expiresAt || null; // allow null/'' => NULL in DB

    // 4) Insert gift card
    const nowIso = new Date().toISOString();
    const insertPayload = {
      code,
      currency,
      initial_amount_cents: initialAmountCents,
      remaining_amount_cents: initialAmountCents,
      status: "active",
      recipient_email: recipientEmail || null,
      recipient_name: recipientName || null,
      message: message || null,
      issued_at: nowIso,
      expires_at: expiresAt || null,
      source: "admin-stripe",
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId || null,
    };

    const { data: created, error: insErr } = await admin
      .from("GiftCard")
      .insert(insertPayload)
      .select(
        "id, code, currency, initial_amount_cents, remaining_amount_cents, status, expires_at, recipient_email, recipient_name, message"
      )
      .single();

    if (insErr) {
      console.error("giftcards insert failed", insErr);
      return bad("Failed to create gift card", 500);
    }

    // 5) Best-effort email (non-fatal)
    if (created.recipient_email) {
      try {
        await sendGiftcardEmail({
          to: created.recipient_email,
          card: {
            id: created.id,
            code: created.code,
            currency: created.currency,
            initialAmountCents: created.initial_amount_cents,
            remainingAmountCents: created.remaining_amount_cents,
            status: created.status,
            expiresAt: created.expires_at,
            recipientEmail: created.recipient_email,
            recipientName: created.recipient_name,
            message: created.message,
          },
        });
      } catch (e) {
        console.warn("giftcard email failed (non-fatal)", e?.message || e);
      }
    }

    // 6) Return the fields your UI needs
    return ok(
      {
        id: created.id,
        code: created.code,
        amountCents: created.initial_amount_cents,
        currency: (created.currency || "EUR").toUpperCase(),
        recipientEmail: created.recipient_email || null,
      },
      201
    );
  } catch (e) {
    console.error("confirm error", e);
    return bad(e?.message || "Confirmation failed", 500);
  }
}
