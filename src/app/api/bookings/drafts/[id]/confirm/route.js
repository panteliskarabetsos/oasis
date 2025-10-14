// src/app/api/bookings/drafts/[id]/confirm/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import Stripe from "stripe";
import { format } from "date-fns";
import sendBookingConfirmation from "@/lib/email/sendConfirmationEmail";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function POST(req, ctx) {
  const { id } = await ctx.params; // Next requires awaiting params
  const draftId = Number(id);
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id") || "";

  if (!Number.isFinite(draftId) || draftId <= 0) return bad("Invalid draft id");
  if (!sessionId) return bad("Missing session_id");

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  // --- Stripe live/test guard
  const key = process.env.STRIPE_SECRET_KEY || "";
  const isTestKey = key.startsWith("sk_test_");
  const isLiveKey = key.startsWith("sk_live_");
  const isLiveSession = sessionId.startsWith("cs_live_");
  const isTestSession = sessionId.startsWith("cs_test_");
  if ((isLiveSession && !isLiveKey) || (isTestSession && !isTestKey)) {
    return bad(
      "Stripe mode mismatch: session_id and secret key don't match",
      400
    );
  }

  // --- Load draft (narrow selection; tolerant to schema diffs)
  const { data: draft, error: dErr } = await admin
    .from("BookingDraft")
    .select(
      `
      id, status, counts, attendees, experienceId, scheduleSlotId,
      primary_contact, "unitPriceAdult", "unitPriceKid",
      "totalAmount", "stripeSessionId", "convertedBookingId"
    `
    )
    .eq("id", draftId)
    .maybeSingle();

  if (dErr || !draft) return bad("Draft not found", 404);

  // Already finalized? (idempotent fast path)
  if (draft.convertedBookingId) {
    return ok({
      status: "paid",
      already: true,
      bookingId: draft.convertedBookingId,
    });
  }

  // --- Retrieve Stripe session
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

  // Optional integrity check (warn only)
  if (
    session?.metadata?.draft_id &&
    String(session.metadata.draft_id) !== String(draftId)
  ) {
    console.warn("[confirm] warning: session draft_id != route draftId", {
      sessionDraftId: session.metadata.draft_id,
      routeDraftId: draftId,
    });
  }

  const paid =
    session?.payment_status === "paid" ||
    (session?.status === "complete" &&
      session?.payment_intent?.status === "succeeded");

  if (!paid) return ok({ status: "pending" }, 202);

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  // --- Mark draft as paid (tolerate missing cols) & store session id if missing
  const nowIso = new Date().toISOString();
  const baseUpdate = { status: "paid", updatedAt: nowIso };
  let upd = await admin
    .from("BookingDraft")
    .update({
      ...baseUpdate,
      stripeSessionId: draft.stripeSessionId || session.id,
      stripePaymentIntentId: paymentIntentId,
    })
    .eq("id", draftId);

  if (upd.error) {
    if (String(upd.error.code) === "42703") {
      await admin.from("BookingDraft").update(baseUpdate).eq("id", draftId);
    } else {
      console.error("[confirm] update error", upd.error);
      return bad("Could not mark as paid", 500);
    }
  }

  // --- Ensure valid User for Booking.userId FK
  const ensuredUserId = await ensureDraftUserId(admin, draft, session);
  if (!ensuredUserId) {
    console.error("[confirm] no valid User found to attach booking");
    return ok({ status: "paid", pending: true }, 202);
  }
  // Write/refresh primary_contact.userId if needed
  if (Number(draft?.primary_contact?.userId) !== ensuredUserId) {
    const newPrimary = {
      ...(draft.primary_contact || {}),
      userId: ensuredUserId,
    };
    await admin
      .from("BookingDraft")
      .update({ primary_contact: newPrimary })
      .eq("id", draftId);
  }

  // --- Finalize to real Booking (IDEMPOTENT, derived-capacity inside DB)
  const { data: bookingId, error: rpcErr } = await admin.rpc(
    "finalize_booking",
    { p_draft_id: draftId }
  );
  if (rpcErr) {
    console.error("[confirm] finalize_booking error", rpcErr);
    // Payment is captured; webhook or subsequent retries will finalize
    return ok({ status: "paid", pending: true }, 202);
  }

  // --- Patch the Booking with attendees/counts/prices and ACTUAL paid amount
  try {
    const A = Number(draft.counts?.adults || 0);
    const K = Number(draft.counts?.kids || 0);
    const numberOfPeople = A + K;

    const paidAmount =
      typeof session?.amount_total === "number"
        ? session.amount_total / 100
        : Number(draft?.totalAmount ?? 0);
    const currency = (session?.currency || "eur").toUpperCase();

    const patch = {
      // snapshots from draft
      counts: draft.counts,
      attendees: Array.isArray(draft.attendees) ? draft.attendees : [],
      adultsCount: A,
      kidsCount: K,
      unitPriceAdult: draft.unitPriceAdult ?? null,
      unitPriceKid: draft.unitPriceKid ?? draft.unitPriceAdult ?? null,
      primary_contact: draft.primary_contact ?? null,
      numberOfPeople, // keep consistent with counts snapshot

      // payment info from Stripe
      totalPaidAmount: paidAmount ?? null,
      currency,
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,

      updatedAt: nowIso,
    };

    const updBooking = await admin
      .from("Booking")
      .update(patch)
      .eq("id", bookingId);

    // tolerate older schema by falling back to a minimal patch
    if (updBooking.error && String(updBooking.error.code) === "42703") {
      await admin
        .from("Booking")
        .update({
          totalPaidAmount: paidAmount ?? null,
          currency,
          updatedAt: nowIso,
        })
        .eq("id", bookingId);
    }
  } catch (e) {
    console.error("[confirm] booking patch failed", e?.message);
  }

  // --- Send confirmation email (best effort)
  let emailed = false;
  try {
    const { to, subject, html, text } = await buildConfirmationEmailPayload(
      admin,
      {
        draftId,
        bookingId,
        experienceId: draft.experienceId,
        scheduleSlotId: draft.scheduleSlotId,
      },
      session
    );
    if (to) {
      await sendBookingConfirmation({ to, subject, html, text });
      emailed = true;
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

  return ok({ status: "paid", bookingId, emailed });
}

/** Ensure a valid User id exists to satisfy Booking.userId FK.
 * 1) Use draft.primary_contact.userId if present and exists.
 * 2) Else, find by Stripe email.
 * 3) Else, fallback to oldest existing user (if any).
 */
async function ensureDraftUserId(admin, draft, session) {
  const pcUserId = Number(draft?.primary_contact?.userId);
  if (Number.isFinite(pcUserId) && pcUserId > 0) {
    const { data: exists } = await admin
      .from("User")
      .select("id")
      .eq("id", pcUserId)
      .maybeSingle();
    if (exists?.id) return pcUserId;
  }

  const email =
    session?.customer_details?.email || session?.customer_email || null;
  if (email) {
    const { data: byEmail } = await admin
      .from("User")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (byEmail?.id) return byEmail.id;
  }

  const { data: fallback } = await admin
    .from("User")
    .select("id")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (fallback?.id) return fallback.id;

  return null;
}

/** Build a minimal confirmation email payload (no external templates). */
async function buildConfirmationEmailPayload(admin, ids, session) {
  const to = session?.customer_details?.email || null;

  const [{ data: exp }, { data: slot }] = await Promise.all([
    admin
      .from("Experience")
      .select("name,location")
      .eq("id", ids.experienceId)
      .maybeSingle(),
    admin
      .from("ScheduleSlot")
      .select("date")
      .eq("id", ids.scheduleSlotId)
      .maybeSingle(),
  ]);

  const when = slot?.date ? new Date(slot.date) : null;
  const dateLabel = when ? format(when, "PPP") : "";
  const timeLabel = when ? format(when, "p") : "";

  const amountEur =
    typeof session?.amount_total === "number"
      ? (session.amount_total / 100).toFixed(2)
      : null;
  const currency = (session?.currency || "eur").toUpperCase();

  const subject = `Your booking is confirmed — ${exp?.name || "Reservation"}`;

  const lines = [
    `<h2 style="margin:0 0 8px;font-family:system-ui,-apple-system,Segoe UI,Roboto">Booking confirmed</h2>`,
    `<p style="margin:0 0 12px">Thank you for your reservation${
      to ? `, ${to.split("@")[0]}` : ""
    }.</p>`,
    exp?.name
      ? `<p style="margin:0"><strong>Experience:</strong> ${escapeHtml(
          exp.name
        )}</p>`
      : "",
    exp?.location
      ? `<p style="margin:0"><strong>Location:</strong> ${escapeHtml(
          exp.location
        )}</p>`
      : "",
    when
      ? `<p style="margin:0"><strong>When:</strong> ${escapeHtml(
          dateLabel
        )} at ${escapeHtml(timeLabel)}</p>`
      : "",
    ids.bookingId
      ? `<p style="margin:0 0 12px"><strong>Booking #</strong> ${ids.bookingId}</p>`
      : "",
    amountEur
      ? `<p style="margin:0 0 12px"><strong>Total paid:</strong> €${amountEur} ${currency}</p>`
      : "",
    `<p style="margin:12px 0 0">We look forward to seeing you!</p>`,
  ].filter(Boolean);

  const html = `<div>${lines.join("")}</div>`;
  const text = [
    "Booking confirmed",
    exp?.name ? `Experience: ${exp.name}` : "",
    exp?.location ? `Location: ${exp.location}` : "",
    when ? `When: ${dateLabel} at ${timeLabel}` : "",
    ids.bookingId ? `Booking #: ${ids.bookingId}` : "",
    amountEur ? `Total paid: €${amountEur} ${currency}` : "",
    "",
    "We look forward to seeing you!",
  ]
    .filter(Boolean)
    .join("\n");

  return { to, subject, html, text };
}

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
