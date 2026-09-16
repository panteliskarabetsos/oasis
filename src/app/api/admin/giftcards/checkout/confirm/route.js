// src/app/api/admin/giftcards/checkout/confirm/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { issueGiftCardFromSession } from "@/lib/giftcards/issueFromSession";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

const stripe = (() => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2024-06-20" });
})();

export async function GET(req) {
  const r = await requireAdmin("giftcards");
  if (!r.ok) return r.response;
  if (!stripe) return bad("Stripe is not configured", 500);

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id") || "";
  if (!sessionId) return bad("Missing 'session_id' query param", 422);

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  try {
    // The issuing itself lives in a shared function so the Stripe webhook can
    // do it too. This route stays as the path that answers the admin's browser
    // when it returns from Checkout — it is no longer the only thing that can
    // turn a payment into a card.
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    const res = await issueGiftCardFromSession(admin, session);
    if (!res.ok) return bad(res.error, res.status);

    const card = res.card;
    return ok(
      {
        id: card.id,
        code: card.code,
        amountCents: card.initial_amount_cents,
        currency: (card.currency || "EUR").toUpperCase(),
        recipientEmail: card.recipient_email || null,
        ...(res.already ? { already: true } : {}),
      },
      res.already ? 200 : 201,
    );
  } catch (e) {
    console.error("confirm error", e);
    return bad(e?.message || "Confirmation failed", 500);
  }
}
