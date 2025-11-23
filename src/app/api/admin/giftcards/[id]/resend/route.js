export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { sendGiftcardEmail } from "@/lib/email/sendGiftcardEmail";

export async function POST(req, ctx) {
  const r = await requireAdmin();
  if (!r.ok) return r.response;
  const admin = r.admin;

  // 👇 Next dev guard: await params
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 422 });

  let body = {};
  try {
    body = await req.json();
  } catch {}

  // Load the card
  const { data: card, error } = await admin
    .from("GiftCard")
    .select(
      "id, code, status, initial_amount_cents, remaining_amount_cents, currency, recipient_email, recipient_name, message, issued_at, expires_at"
    )
    .eq("id", id)
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Where to send it
  const toEmail = (body.to || card.recipient_email || "").trim();
  if (!toEmail) {
    return NextResponse.json(
      {
        error:
          'No recipient email on card. Pass { to: "email@domain" } in body.',
      },
      { status: 422 }
    );
  }

  // Send email
  try {
    await sendGiftcardEmail({
      to: toEmail,
      card: {
        code: card.code,
        currency: card.currency,
        initialAmountCents: card.initial_amount_cents,
        remainingAmountCents: card.remaining_amount_cents,
        recipientName: card.recipient_name,
        message: card.message,
        issuedAt: card.issued_at,
        expiresAt: card.expires_at,
        status: card.status,
      },
    });
  } catch (e) {
    console.error("giftcard resend failed:", e);
    return NextResponse.json({ error: "Email send failed" }, { status: 500 });
  }

  // (Optional) stamp a “last sent” column if you add it
  // await admin.from("GiftCard").update({ delivery_last_sent_at: new Date().toISOString() }).eq("id", id);

  return NextResponse.json({ ok: true });
}
