import "server-only";
import { sendGiftcardEmail } from "@/lib/email/sendGiftcardEmail";

/**
 * Turn a paid Stripe Checkout Session into a gift card.
 *
 * This used to live only in the confirm route, which runs when an admin is
 * sent back to /admin/giftcards after paying. If they closed the tab, nobody
 * ever called it: the money was taken and no card was created. Five paid
 * sessions on this account had no card against them, 270.00 EUR in total.
 *
 * Moving it here lets the Stripe webhook issue the card as well, which both
 * closes that hole and makes it possible to email a payment link to a
 * customer — they will never visit an admin page, so the webhook is the only
 * thing that can finish the job.
 *
 * Safe to call more than once for the same session: an existing card for the
 * session or its payment intent is returned rather than a second one created.
 *
 * @returns {Promise<{ok:true,card:object,already:boolean}|{ok:false,error:string,status:number}>}
 */
export async function issueGiftCardFromSession(admin, session, { sendEmail = true } = {}) {
  if (!session) return { ok: false, error: "Stripe session not found", status: 404 };
  if (session.mode !== "payment")
    return { ok: false, error: "Unsupported session mode", status: 400 };
  if (session.payment_status !== "paid")
    return { ok: false, error: "Payment not completed yet", status: 409 };

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  // Already issued? Match on either id the session can be known by.
  const orClauses = [`stripe_session_id.eq.${session.id}`];
  if (paymentIntentId)
    orClauses.push(`stripe_payment_intent_id.eq.${paymentIntentId}`);

  const { data: existing, error: exErr } = await admin
    .from("GiftCard")
    .select(
      "id, code, currency, initial_amount_cents, remaining_amount_cents, status, expires_at, recipient_email, recipient_name, message",
    )
    .or(orClauses.join(","))
    .limit(1);

  if (exErr) {
    console.error("[giftcard] lookup failed", exErr);
    return { ok: false, error: "Database error", status: 500 };
  }
  if (existing?.length) return { ok: true, card: existing[0], already: true };

  const md = session.metadata || {};
  const currency = (md.currency || session.currency || "EUR").toUpperCase();
  const code = (md.code || "").toUpperCase().trim();

  const fromMeta = Number.parseInt(md.initialAmountCents, 10);
  const initialAmountCents = Number.isFinite(fromMeta)
    ? fromMeta
    : Number(session.amount_total || 0);

  if (!initialAmountCents || initialAmountCents <= 0) {
    return { ok: false, error: "Invalid amount (metadata/checkout missing)", status: 422 };
  }

  const nowIso = new Date().toISOString();
  const { data: created, error: insErr } = await admin
    .from("GiftCard")
    .insert({
      code,
      currency,
      initial_amount_cents: initialAmountCents,
      remaining_amount_cents: initialAmountCents,
      status: "active",
      recipient_email: md.recipientEmail || null,
      recipient_name: md.recipientName || null,
      message: md.message || null,
      issued_at: nowIso,
      expires_at: md.expiresAt || null,
      source: "admin-stripe",
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId || null,
    })
    .select(
      "id, code, currency, initial_amount_cents, remaining_amount_cents, status, expires_at, recipient_email, recipient_name, message",
    )
    .single();

  if (insErr) {
    console.error("[giftcard] insert failed", insErr);
    return { ok: false, error: "Failed to create gift card", status: 500 };
  }

  // The card exists whether or not the email lands, and it can be resent from
  // the list — so a failure here is logged, not raised.
  if (sendEmail && created.recipient_email) {
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
      console.warn("[giftcard] email failed (non-fatal)", e?.message || e);
    }
  }

  return { ok: true, card: created, already: false };
}
