export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400, extra = {}) =>
  NextResponse.json({ error: m, ...extra }, { status: s });

/**
 * Take value off a card, on purpose, with a reason.
 *
 * Distinct from redeeming: a redemption is a guest spending their card
 * against something, and belongs to a booking. This is the business
 * correcting a balance — a card issued for the wrong amount, value written
 * off, a duplicate being neutralised — and it belongs to whoever did it.
 *
 * It goes through the same ledger so the card's history stays in one place
 * and the balances always reconcile against it. The reason is required: an
 * unexplained movement of money is the thing this exists to prevent.
 *
 * Only downwards. GiftCardRedemption has a check constraint that refuses a
 * negative amount, so adding value cannot be recorded here and is refused
 * rather than done silently off the books.
 */
export async function POST(req, ctx) {
  const auth = await requireAdmin("giftcards");
  if (!auth.ok) return auth.response;
  const admin = auth.admin;

  const { id } = await ctx.params;
  if (!id) return bad("Missing card id", 400);

  const body = await req.json().catch(() => ({}));
  const raw = typeof body?.amountCents === "string" ? Number(body.amountCents) : body?.amountCents;
  const amountCents = Number.isInteger(raw) ? raw : NaN;
  const reason = String(body?.reason || "").trim();

  if (!Number.isInteger(amountCents) || amountCents === 0) {
    return bad("Enter an amount to adjust by.", 422);
  }
  if (amountCents > 0) {
    return bad(
      "Only a deduction can be recorded here. Adding value to a card is not supported yet.",
      422,
      { reason: "credit-unsupported" },
    );
  }
  if (!reason) {
    return bad("A reason is required for an adjustment.", 422);
  }

  const takeCents = Math.abs(amountCents);

  const { data: card, error: cardErr } = await admin
    .from("GiftCard")
    .select("id, code, currency, status, remaining_amount_cents")
    .eq("id", id)
    .maybeSingle();
  if (cardErr || !card) return bad("Gift card not found", 404);
  if (card.status !== "active") {
    return bad(`This card is ${card.status}, so its balance cannot be adjusted.`, 409);
  }

  const remaining = Math.max(0, Number(card.remaining_amount_cents) || 0);
  if (takeCents > remaining) {
    return bad(
      `That is more than the card holds. ${(remaining / 100).toFixed(2)} ${card.currency} remaining.`,
      422,
      { remainingAmountCents: remaining },
    );
  }

  const newRemaining = remaining - takeCents;
  const newStatus = newRemaining === 0 ? "redeemed" : "active";

  // Conditional on the card still being active, so this cannot race a
  // redemption happening at the same moment and spend the balance twice.
  const { data: updated, error: upErr } = await admin
    .from("GiftCard")
    .update({
      remaining_amount_cents: newRemaining,
      status: newStatus,
      last_redeemed_at: new Date().toISOString(),
    })
    .eq("id", card.id)
    .eq("status", "active")
    .eq("remaining_amount_cents", remaining)
    .select("id, code, currency, remaining_amount_cents, status")
    .maybeSingle();

  if (upErr || !updated?.id) {
    return bad("The balance changed while this was being saved. Try again.", 409);
  }

  const { error: logErr } = await admin.from("GiftCardRedemption").insert({
    gift_card_id: card.id,
    amount_cents: takeCents,
    currency: card.currency,
    booking_id: null,
    notes: `Adjustment: ${reason}`,
  });
  if (logErr) {
    // The money has already moved; losing the note is bad but not worth
    // reversing a successful balance change over.
    console.error("[giftcard] adjustment not logged", logErr.message || logErr);
  }

  return ok({ card: updated, adjustedCents: takeCents, logged: !logErr });
}
