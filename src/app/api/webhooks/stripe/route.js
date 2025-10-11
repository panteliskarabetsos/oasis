// src/app/api/webhooks/stripe/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdmin } from "../../../../lib/supabase/admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
});

export async function POST(req) {
  const admin = createSupabaseAdmin();
  if (!admin)
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 }
    );

  const sig = req.headers.get("stripe-signature");
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    const buf = Buffer.from(await req.arrayBuffer());
    event = stripe.webhooks.constructEvent(buf, sig, whSecret);
  } catch (err) {
    console.error(
      "[stripe webhook] signature verification failed:",
      err?.message
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const draftId = Number(session?.metadata?.draftId || 0);
      const slotId = Number(session?.metadata?.scheduleSlotId || 0);

      if (!Number.isFinite(draftId) || draftId <= 0) {
        console.warn("[stripe webhook] missing draftId metadata");
        return NextResponse.json({ ok: true });
      }

      // Load draft
      const { data: draft } = await admin
        .from("BookingDraft")
        .select("id, status, counts, scheduleSlotId")
        .eq("id", draftId)
        .maybeSingle();

      if (!draft) return NextResponse.json({ ok: true });

      // Idempotency: only process drafts not yet paid
      if (draft.status === "paid") return NextResponse.json({ ok: true });

      const A = Number(draft.counts?.adults || 0);
      const T = Number(draft.counts?.teens || 0);
      const K = Number(draft.counts?.kids || 0);
      const total = A + T + K;

      // 1) Mark as paid & store PaymentIntent if available
      await admin
        .from("BookingDraft")
        .update({
          status: "paid",
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : null,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", draftId);

      // 2) Increment bookedSlots for the schedule slot (best-effort)
      if (Number.isFinite(slotId) && slotId > 0) {
        await admin
          .rpc("increment_booked_slots", { p_slot_id: slotId, p_delta: total })
          .catch(async () => {
            // Fallback if no RPC: read-modify-write
            const { data: slot } = await admin
              .from("ScheduleSlot")
              .select("bookedSlots")
              .eq("id", slotId)
              .maybeSingle();

            const newBooked =
              Math.max(0, Number(slot?.bookedSlots || 0)) + total;
            await admin
              .from("ScheduleSlot")
              .update({ bookedSlots: newBooked })
              .eq("id", slotId);
          });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[stripe webhook] error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
