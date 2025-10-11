// src/app/api/bookings/drafts/[id]/checkout/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

const REFRESH_MINUTES_ON_CHECKOUT = 30;

export async function POST(req, ctx) {
  const { id } = await ctx.params;
  const draftId = Number(id);
  if (!Number.isFinite(draftId) || draftId <= 0) return bad("Invalid id");

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  // Lazy import Stripe to keep it server-only
  const Stripe = (await import("stripe")).default;
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key) return bad("Stripe not configured", 500);
  const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

  // 1) Load draft (allow re-entry when status=pending_payment)
  const { data: draft, error: dErr } = await admin
    .from("BookingDraft")
    .select(
      `
      id, experienceId, scheduleSlotId, counts, status, expiresAt,
      "unitPriceAdult","unitPriceKid","totalAmount","stripeSessionId"
    `
    )
    .eq("id", draftId)
    .maybeSingle();

  if (dErr || !draft) return bad("Draft not found", 404);

  if (!["draft", "pending_payment"].includes(draft.status)) {
    return bad("Draft not in a payable state", 400);
  }

  // If there's an existing session and it's still open, reuse it
  if (draft.status === "pending_payment" && draft.stripeSessionId) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(
        draft.stripeSessionId
      );
      if (existing && existing.status === "open" && existing.url) {
        return ok({ url: existing.url, reused: true });
      }
    } catch (e) {
      // ignore and create a new session below
      console.warn("[checkout] failed to reuse session", e?.message);
    }
  }

  const A = Number(draft.counts?.adults || 0);
  const K = Number(draft.counts?.kids || 0);
  const totalPeople = A + K;
  if (totalPeople <= 0) return bad("Empty group", 400);

  // 2) Load supporting data
  const [{ data: exp }, { data: slot }] = await Promise.all([
    admin
      .from("Experience")
      .select(`id,name,slug,location`)
      .eq("id", draft.experienceId)
      .maybeSingle(),
    admin
      .from("ScheduleSlot")
      .select(`id,date,totalSlots,bookedSlots,isCancelled`)
      .eq("id", draft.scheduleSlotId)
      .maybeSingle(),
  ]);
  if (!exp || !slot || slot.isCancelled) return bad("Slot unavailable", 400);

  const remaining = Math.max(
    0,
    (slot.totalSlots ?? 0) - (slot.bookedSlots ?? 0)
  );
  if (totalPeople > remaining) return bad(`Only ${remaining} spots left`, 400);

  // 3) If draft expired, auto-extend if capacity still ok
  const isExpired = !!draft.expiresAt && new Date(draft.expiresAt) < new Date();
  if (isExpired) {
    const newExpiresAt = new Date(
      Date.now() + REFRESH_MINUTES_ON_CHECKOUT * 60 * 1000
    ).toISOString();
    const upd = await admin
      .from("BookingDraft")
      .update({ expiresAt: newExpiresAt, updatedAt: new Date().toISOString() })
      .eq("id", draftId);
    if (upd.error) {
      if (String(upd.error.code) === "42703") {
        // missing column updatedAt — retry without it
        const upd2 = await admin
          .from("BookingDraft")
          .update({ expiresAt: newExpiresAt })
          .eq("id", draftId);
        if (upd2.error) return bad("Draft expired. Please start again.", 400);
      } else {
        return bad("Draft expired. Please start again.", 400);
      }
    }
  }

  // 4) Build Stripe line items
  const currency = "eur";
  const items = [];
  if (A > 0)
    items.push(line(`${exp.name} — Adult`, currency, draft.unitPriceAdult, A));
  if (K > 0)
    items.push(
      line(
        `${exp.name} — Kid (3–12)`,
        currency,
        draft.unitPriceKid ?? draft.unitPriceAdult,
        K
      )
    );

  // 5) URLs
  const hdrs = headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${hdrs.get("x-forwarded-proto") || "https"}://${hdrs.get("host")}`;
  const successUrl = `${origin}/booking/${draftId}/confirmation?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/booking/${draftId}/payment?cancelled=1`;

  // 6) Create Checkout Session (wrap in try/catch to surface Stripe errors)
  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: items,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        draftId: String(draftId),
        scheduleSlotId: String(draft.scheduleSlotId),
        experienceId: String(draft.experienceId),
      },
    });
  } catch (e) {
    console.error("[checkout] stripe error", e?.message);
    return bad(e?.message || "Stripe error creating session", 400);
  }

  // 7) Store session & mark pending (tolerate schema diffs)
  const upd = await admin
    .from("BookingDraft")
    .update({
      status: "pending_payment",
      stripeSessionId: session.id,
      currency,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", draftId);

  if (upd.error && String(upd.error.code) === "42703") {
    // missing some columns → do minimal update
    await admin
      .from("BookingDraft")
      .update({ status: "pending_payment", stripeSessionId: session.id })
      .eq("id", draftId);
  }

  return ok({ url: session.url });
}

function line(name, currency, unitPrice, qty) {
  const amount = Math.round(Number(unitPrice || 0) * 100); // cents

  return {
    quantity: qty,
    price_data: {
      currency,
      unit_amount: amount,
      product_data: { name },
    },
  };
}
