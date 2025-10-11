export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function POST(req, ctx) {
  const { id } = await ctx.params;
  const draftId = Number(id);
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id") || "";

  console.log("[confirm] hit", {
    draftId,
    sessionIdPrefix: sessionId.slice(0, 7),
    url: req.url,
  });

  if (!Number.isFinite(draftId) || draftId <= 0) return bad("Invalid draft id");
  if (!sessionId) return bad("Missing session_id");

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  // Guard against test/live mismatch (very common gotcha)
  const key = process.env.STRIPE_SECRET_KEY || "";
  const isTestKey = key.startsWith("sk_test_");
  const isLiveKey = key.startsWith("sk_live_");
  const isLiveSession = sessionId.startsWith("cs_live_");
  const isTestSession = sessionId.startsWith("cs_test_");
  if ((isLiveSession && !isLiveKey) || (isTestSession && !isTestKey)) {
    console.warn("[confirm] mode mismatch", {
      sessionIdPrefix: sessionId.slice(0, 7),
      keyPrefix: key.slice(0, 7),
    });
    return bad(
      "Stripe mode mismatch: session_id and secret key don't match",
      400
    );
  }

  // Load draft
  const { data: draft, error: dErr } = await admin
    .from("BookingDraft")
    .select(
      `
      id,status,counts,experienceId,scheduleSlotId,
      "unitPriceAdult","unitPriceTeen","unitPriceKid"
    `
    ) // don't select stripe* columns so we tolerate missing columns
    .eq("id", draftId)
    .maybeSingle();

  if (dErr || !draft) {
    console.error("[confirm] draft not found", { draftId, dErr });
    return bad("Draft not found", 404);
  }
  if (draft.status === "paid") return ok({ status: "paid", already: true });

  // Stripe
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });
  } catch (e) {
    console.error("[confirm] retrieve session error:", e?.message);
    return bad("Invalid session_id", 400);
  }

  const paid =
    session?.payment_status === "paid" ||
    (session?.status === "complete" &&
      session?.payment_intent?.status === "succeeded");

  if (!paid) return ok({ status: "pending" });

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  // Capacity increment (best-effort)
  const A = Number(draft.counts?.adults || 0);
  const T = Number(draft.counts?.teens || 0);
  const K = Number(draft.counts?.kids || 0);
  const total = A + T + K;

  try {
    await admin.rpc("increment_booked_slots", {
      p_slot_id: draft.scheduleSlotId,
      p_delta: total,
    });
  } catch (e) {
    console.warn("[confirm] rpc fallback:", e?.message);
    const { data: slot } = await admin
      .from("ScheduleSlot")
      .select("bookedSlots")
      .eq("id", draft.scheduleSlotId)
      .maybeSingle();
    const newBooked = Math.max(0, Number(slot?.bookedSlots || 0)) + total;
    await admin
      .from("ScheduleSlot")
      .update({ bookedSlots: newBooked })
      .eq("id", draft.scheduleSlotId);
  }

  // Mark paid; tolerate DBs without stripe columns (fallback to status-only)
  const baseUpdate = {
    status: "paid",
    updatedAt: new Date().toISOString(),
  };

  let upd = await admin
    .from("BookingDraft")
    .update({
      ...baseUpdate,
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
    })
    .eq("id", draftId);

  if (upd.error && String(upd.error.code) === "42703") {
    // undefined column → do status-only update
    console.warn("[confirm] stripe columns missing; status-only update");
    await admin.from("BookingDraft").update(baseUpdate).eq("id", draftId);
  } else if (upd.error) {
    console.error("[confirm] update error", upd.error);
    return bad("Could not mark as paid", 500);
  }

  return ok({ status: "paid" });
}
