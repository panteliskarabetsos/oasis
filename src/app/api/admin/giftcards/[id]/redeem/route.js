// =============================================
// API: src/app/api/admin/giftcards/[id]/redeem/route.js (optional admin-side redeem)
// =============================================
export const runtime_rr = "nodejs";
export const dynamic_rr = "force-dynamic";
import { NextResponse as NX3 } from "next/server";
import { requireAdmin as rAdm3 } from "@/lib/auth/requireAdmin";

export async function POST(req, { params }) {
  const r = await rAdm3();
  if (!r.ok) return r.response;
  const admin = r.admin;
  const id = params?.id;
  let body = {};
  try {
    body = await req.json();
  } catch {}
  const amountCents = Math.max(0, Number(body.amountCents || 0));
  const bookingId = body.bookingId || null;
  const notes = body.notes || null;
  if (!id) return NX3.json({ error: "Missing id" }, { status: 422 });
  if (amountCents <= 0)
    return NX3.json({ error: "amountCents must be > 0" }, { status: 422 });

  // Fetch card
  const { data: card, error: e1 } = await admin
    .from("GiftCard")
    .select("id, status, remaining_amount_cents, currency")
    .eq("id", id)
    .single();
  if (e1) return NX3.json({ error: e1.message }, { status: 500 });
  if (!card || card.status !== "active")
    return NX3.json({ error: "Not redeemable" }, { status: 400 });
  if (card.remaining_amount_cents < amountCents)
    return NX3.json({ error: "Insufficient balance" }, { status: 400 });

  // Perform redemption (transaction-light)
  const newRemain = card.remaining_amount_cents - amountCents;
  const updates = {
    remaining_amount_cents: newRemain,
    last_redeemed_at: new Date().toISOString(),
  };
  if (newRemain === 0) updates.status = "redeemed";

  const { error: e2 } = await admin
    .from("GiftCard")
    .update(updates)
    .eq("id", id);
  if (e2) return NX3.json({ error: e2.message }, { status: 500 });

  const { error: e3 } = await admin.from("GiftCardRedemption").insert({
    gift_card_id: id,
    amount_cents: amountCents,
    currency: card.currency,
    booking_id: bookingId,
    notes,
  });
  if (e3) return NX3.json({ error: e3.message }, { status: 500 });

  return NX3.json({ ok: true, remainingAmountCents: newRemain });
}
