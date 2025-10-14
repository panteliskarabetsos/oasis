// src/app/api/bookings/drafts/[id]/confirm/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { randomBytes } from "node:crypto";
import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import Stripe from "stripe";
import { format } from "date-fns";
import sendBookingConfirmation from "@/lib/email/sendConfirmationEmail";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function POST(req, ctx) {
  const { id } = await ctx.params;
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

  // --- Load draft
  const { data: draft, error: dErr } = await admin
    .from("BookingDraft")
    .select(
      `
      id, status, counts, attendees, experienceId, scheduleSlotId,
      primary_contact, "unitPriceAdult", "unitPriceKid",
      "totalAmount", "stripeSessionId", "stripePaymentIntentId",
      "convertedBookingId"
    `
    )
    .eq("id", draftId)
    .maybeSingle();

  if (dErr || !draft) return bad("Draft not found", 404);

  if (draft.convertedBookingId) {
    const bookingRow = await getBookingRow(admin, draft.convertedBookingId);
    const bookingCode = deriveBookingCode(bookingRow);
    return ok({
      status: bookingRow?.status || "Paid",
      already: true,
      bookingId: draft.convertedBookingId,
      bookingCode,
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

  // --- Mark draft as paid & store session ids
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
      return bad("Could not mark draft as paid", 500);
    }
  }

  // --- Resolve/ensure correct user by email (never fall back to a random id)
  const ensuredUserId = await ensureDraftUserId(admin, draft, session);
  if (!ensuredUserId) {
    console.error("[confirm] no valid User found/created to attach booking");
    return ok({ status: "Paid", pending: true }, 202);
  }

  // Sync primary_contact.userId on the draft
  if (Number(draft?.primary_contact?.userId) !== ensuredUserId) {
    const newPrimary = {
      ...(draft.primary_contact || {}),
      userId: ensuredUserId,
    };
    await admin
      .from("BookingDraft")
      .update({ primary_contact: newPrimary })
      .eq("id", draftId);
    draft.primary_contact = newPrimary;
  }

  // --- Finalize to real Booking (DB-side capacity + idempotency)
  const { data: bookingId, error: rpcErr } = await admin.rpc(
    "finalize_booking",
    {
      p_draft_id: draftId,
    }
  );
  if (rpcErr || !bookingId) {
    console.error("[confirm] finalize_booking error", rpcErr);
    return ok({ status: "Paid", pending: true }, 202);
  }

  // --- Patch Booking with identity + snapshots + payment info; force "Paid"

  // --- Patch Booking with identity + snapshots + payment info; force "Paid"
  try {
    const A = Number(draft.counts?.adults || 0);
    const K = Number(draft.counts?.kids || 0);
    const numberOfPeople = A + K;

    const { amount: paidAmount, currency } = extractPaidAmountAndCurrency(
      session,
      draft?.totalAmount
    );

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || null;

    // Rich patch first (covers most schemas)
    const fullPatch = {
      userId: ensuredUserId,

      // snapshots
      counts: draft.counts,
      attendees: Array.isArray(draft.attendees) ? draft.attendees : [],
      adultsCount: A,
      kidsCount: K,
      unitPriceAdult: draft.unitPriceAdult ?? null,
      unitPriceKid: draft.unitPriceKid ?? draft.unitPriceAdult ?? null,
      primary_contact: draft.primary_contact ?? null,
      numberOfPeople,

      // payment
      totalPaidAmount: paidAmount, // <-- WRITE IT HERE (0 is valid)
      currency,
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,

      status: "Paid",
      updatedAt: nowIso,
    };

    let upd1 = await admin
      .from("Booking")
      .update(fullPatch)
      .eq("id", bookingId);

    if (upd1.error && String(upd1.error.code) === "42703") {
      // Minimal fallback if some columns don't exist in your schema
      await admin
        .from("Booking")
        .update({
          userId: ensuredUserId,
          totalPaidAmount: paidAmount,
          currency,
          stripeSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
          status: "Paid",
          updatedAt: nowIso,
        })
        .eq("id", bookingId);
    } else if (upd1.error) {
      console.error("[confirm] booking patch error", upd1.error);
    }

    // VERIFY the write and self-heal once if needed
    const { data: verify } = await admin
      .from("Booking")
      .select(
        "id,totalPaidAmount,currency,status,stripeSessionId,stripePaymentIntentId"
      )
      .eq("id", bookingId)
      .maybeSingle();

    const needsRepair =
      !verify ||
      (paidAmount != null &&
        Number(verify.totalPaidAmount ?? NaN) !== Number(paidAmount)) ||
      (verify?.currency || "").toUpperCase() !== currency ||
      verify?.status !== "Paid" ||
      !verify?.stripeSessionId ||
      !verify?.stripePaymentIntentId;

    if (needsRepair) {
      await admin
        .from("Booking")
        .update({
          totalPaidAmount: paidAmount,
          currency,
          status: "Paid",
          stripeSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
          updatedAt: nowIso,
        })
        .eq("id", bookingId);
    }
  } catch (e) {
    console.error("[confirm] booking patch failed", e?.message);
  }

  // --- Ensure the draft is marked converted and linked (if RPC didn’t)
  try {
    await admin
      .from("BookingDraft")
      .update({ status: "converted", convertedBookingId: bookingId })
      .eq("id", draftId);
  } catch (_) {}

  // --- Load booking row to get the proper CODE/REFERENCE for display
  const bookingRow = await getBookingRow(admin, bookingId);
  const bookingCode = deriveBookingCode(bookingRow);

  // --- Send confirmation email (best effort)
  let emailed = false;
  try {
    const { to, subject, html, text } = await buildConfirmationEmailPayload(
      admin,
      {
        draftId,
        bookingId,
        bookingCode,
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

  return ok({ status: "Paid", bookingId, bookingCode, emailed });
}

/* ---------------------------- helpers ---------------------------- */

async function getBookingRow(admin, id) {
  const { data, error } = await admin
    .from("Booking")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.warn("[confirm] could not load booking row", error);
    return null;
  }
  return data || null;
}

function deriveBookingCode(row) {
  if (!row) return null;
  const candidates = [
    row.code,
    row.reference,
    row.bookingCode,
    row.shortCode,
    row.refCode,
    row.ref,
  ].filter(Boolean);
  if (candidates.length) return String(candidates[0]);
  if (row.id) return `BK-${String(row.id).padStart(6, "0")}`;
  return null;
}

function extractPaidAmountAndCurrency(session, draftTotal) {
  const pi =
    (typeof session?.payment_intent === "object" && session.payment_intent) ||
    null;

  // Stripe truth source: amount_received (in cents).
  const cents =
    (typeof pi?.amount_received === "number" ? pi.amount_received : null) ??
    (typeof pi?.amount === "number" ? pi.amount : null) ??
    (typeof session?.amount_total === "number" ? session.amount_total : null);

  const amount =
    cents != null
      ? cents / 100
      : Number.isFinite(Number(draftTotal))
      ? Number(draftTotal)
      : null;

  const currency = (pi?.currency || session?.currency || "eur").toUpperCase();

  return { amount, currency };
}

// Email-first identity resolver that *never* falls back to a random user.
// Creates a user with createdAt/updatedAt to satisfy NOT NULL.
async function ensureDraftUserId(admin, draft, session) {
  const contactEmail =
    draft?.primary_contact?.email ||
    session?.customer_details?.email ||
    session?.customer_email ||
    null;

  const pcId = Number(draft?.primary_contact?.userId);

  async function getUserById(id) {
    if (!Number.isFinite(id) || id <= 0) return null;
    const { data } = await admin
      .from("User")
      .select("id,email")
      .eq("id", id)
      .maybeSingle();
    return data || null;
  }

  async function getUserByEmail(email) {
    const { data } = await admin
      .from("User")
      .select("id,email")
      .eq("email", email)
      .maybeSingle();
    return data || null;
  }

  if (contactEmail) {
    const byEmail = await getUserByEmail(contactEmail);
    if (byEmail?.id) return byEmail.id;

    const pc = await getUserById(pcId);
    if (pc?.email && pc.email.toLowerCase() === contactEmail.toLowerCase()) {
      return pc.id;
    }

    const nowIso = new Date().toISOString();
    const password = randomBytes(16).toString("hex");
    const name =
      draft?.primary_contact?.fullName ||
      [draft?.primary_contact?.firstName, draft?.primary_contact?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      draft?.primary_contact?.name ||
      null;

    // Try rich shape first; fall back if some columns don't exist
    let ins = await admin
      .from("User")
      .insert({
        email: contactEmail,
        password,
        role: "customer",
        name,
        createdAt: nowIso,
        updatedAt: nowIso, // <-- prevents 23502
      })
      .select("id")
      .single();

    if (ins.error && String(ins.error.code) === "42703") {
      ins = await admin
        .from("User")
        .insert({
          email: contactEmail,
          password,
          createdAt: nowIso,
          updatedAt: nowIso,
        })
        .select("id")
        .single();
    }

    if (ins.error && String(ins.error.code) === "23505") {
      const again = await getUserByEmail(contactEmail);
      if (again?.id) return again.id;
    }

    if (ins.error) {
      // Optional safety net: RPC that sets timestamps server-side if you created it
      try {
        const { data: rpcId, error: rpcErr } = await admin.rpc(
          "create_user_minimal",
          { p_email: contactEmail, p_name: name, p_role: "customer" }
        );
        if (!rpcErr && rpcId) return rpcId;
      } catch {}
      console.error("[confirm] create user failed (final)", ins.error);
      return null;
    }

    return ins.data?.id ?? null;
  }

  const pc = await getUserById(pcId);
  return pc?.id ?? null;
}

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

  const htmlLines = [
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
    ids.bookingCode
      ? `<p style="margin:0 0 12px"><strong>Booking #</strong> ${escapeHtml(
          ids.bookingCode
        )}</p>`
      : "",
    amountEur
      ? `<p style="margin:0 0 12px"><strong>Total paid:</strong> €${amountEur} ${currency}</p>`
      : "",
    `<p style="margin:12px 0 0">We look forward to seeing you!</p>`,
  ].filter(Boolean);

  const textLines = [
    "Booking confirmed",
    exp?.name ? `Experience: ${exp.name}` : "",
    exp?.location ? `Location: ${exp.location}` : "",
    when ? `When: ${dateLabel} at ${timeLabel}` : "",
    ids.bookingCode ? `Booking #: ${ids.bookingCode}` : "",
    amountEur ? `Total paid: €${amountEur} ${currency}` : "",
    "",
    "We look forward to seeing you!",
  ].filter(Boolean);

  return {
    to,
    subject,
    html: `<div>${htmlLines.join("")}</div>`,
    text: textLines.join("\n"),
  };
}

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
