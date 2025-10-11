// src/app/api/bookings/drafts/[id]/confirm/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import Stripe from "stripe";
import { format } from "date-fns";
import sendBookingConfirmation from "../../../../../../lib/email/sendConfirmationEmail";
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

  // Load draft (keep selection narrow to tolerate DB schema diffs)
  const { data: draft, error: dErr } = await admin
    .from("BookingDraft")
    .select(
      `
      id,status,counts,experienceId,scheduleSlotId,
      "unitPriceAdult","unitPriceKid"
    `
    )
    .eq("id", draftId)
    .maybeSingle();

  if (dErr || !draft) {
    console.error("[confirm] draft not found", { draftId, dErr });
    return bad("Draft not found", 404);
  }
  if (draft.status === "paid") return ok({ status: "paid", already: true });

  // Stripe
  const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent", "customer_details"],
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

  const K = Number(draft.counts?.kids || 0);
  const total = A + K;

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

  // --- Send confirmation email (best effort, non-blocking) ---
  let emailed = false;
  try {
    const { to, subject, html, text } = await buildConfirmationEmailPayload(
      admin,
      draft,
      session
    );
    if (to) {
      await sendBookingConfirmationEmail({ to, subject, html, text });
      emailed = true;
      // Try to record emailSentAt if column exists
      const emailUpd = await admin
        .from("BookingDraft")
        .update({ emailSentAt: new Date().toISOString() })
        .eq("id", draftId);
      if (emailUpd.error && String(emailUpd.error.code) === "42703") {
        console.warn("[confirm] emailSentAt column missing; skipping");
      }
    } else {
      console.warn("[confirm] no email recipient found; skipping send");
    }
  } catch (e) {
    console.error("[confirm] email send failed", e?.message);
  }

  return ok({ status: "paid", emailed });
}

async function buildConfirmationEmailPayload(admin, draft, session) {
  // Recipient: prefer Stripe checkout customer email
  const to = session?.customer_details?.email || null;

  // Load experience (optional)
  let experience = null;
  if (draft.experienceId) {
    const { data } = await admin
      .from("Experience")
      .select("name,location")
      .eq("id", draft.experienceId)
      .maybeSingle();
    experience = data || null;
  }

  // Load slot (optional) for date/time labels
  let slot = null;
  if (draft.scheduleSlotId) {
    const { data } = await admin
      .from("ScheduleSlot")
      .select("startAt,start,date,start_time")
      .eq("id", draft.scheduleSlotId)
      .maybeSingle();
    slot = data || null;
  }

  const whenIso =
    slot?.startAt || slot?.start || slot?.date || slot?.start_time || null;
  const d = whenIso ? new Date(whenIso) : null;
  const dateLabel = d ? format(d, "PPP") : "";
  const timeLabel = d ? format(d, "p") : "";

  // Build attendees list from counts (fallback; adjust if you store named attendees)
  const A = Number(draft.counts?.adults || 0);
  const K = Number(draft.counts?.kids || 0);
  const attendees = [
    ...Array.from({ length: A }, (_, i) => ({ name: `Adult ${i + 1}` })),
    ...Array.from({ length: K }, (_, i) => ({ name: `Kid ${i + 1}` })),
  ];

  const subject = `Your booking is confirmed — ${
    experience?.name || "Reservation"
  }`;
  const html = renderConfirmationHtml({
    experienceName: experience?.name,
    location: experience?.location,
    dateLabel,
    timeLabel,
    attendees,
    amount: (session?.amount_total ?? 0) / 100,
    currency: (session?.currency || "eur").toUpperCase(),
    bookingRef: String(draft?.id ?? ""),
  });
  const text = [
    `${experience?.name || "Your reservation"} — confirmed`,
    experience?.location ? `Location: ${experience.location}` : "",
    dateLabel ? `Date: ${dateLabel} ${timeLabel ? `at ${timeLabel}` : ""}` : "",
    attendees.length
      ? `Attendees: ${attendees.map((a) => a.name).join(", ")}`
      : "",
    session?.amount_total
      ? `Total: €${(session.amount_total / 100).toFixed(2)} ${(
          session.currency || "eur"
        ).toUpperCase()}`
      : "",
    "",
    "Thank you for your booking!",
  ]
    .filter(Boolean)
    .join("\n");

  return { to, subject, html, text };
}
