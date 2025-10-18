// src/app/api/bookings/drafts/[id]/confirm/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { randomBytes } from "node:crypto";
import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import Stripe from "stripe";
import { format } from "date-fns";
import sendBookingConfirmation from "@/lib/email/sendBookingConfirmation";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function POST(req, ctx) {
  const { id } = await ctx.params;
  const draftId = Number(id);
  if (!Number.isFinite(draftId) || draftId <= 0) return bad("Invalid draft id");

  // Accept both querystring AND JSON body
  const url = new URL(req.url);
  const qsSessionId = url.searchParams.get("session_id") || "";
  const qsPI = url.searchParams.get("payment_intent") || "";
  const body = (await req.json().catch(() => ({}))) || {};
  const sessionId = body.session_id || qsSessionId;
  const payment_intent = body.payment_intent || qsPI;

  if (!sessionId && !payment_intent) {
    return bad("Missing session_id or payment_intent");
  }

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  // Load draft
  const { data: draft, error: dErr } = await admin
    .from("BookingDraft")
    .select(
      `
      id, status, counts, attendees, experienceId, scheduleSlotId,
      primary_contact, "unitPriceAdult", "unitPriceKid",
      "totalAmount", "stripeSessionId", "stripePaymentIntentId",
      "convertedBookingId", currency
    `
    )
    .eq("id", draftId)
    .maybeSingle();

  if (dErr || !draft) return bad("Draft not found", 404);

  // Already converted?
  if (draft.convertedBookingId) {
    return ok({
      converted: true,
      bookingId: draft.convertedBookingId,
      already: true,
    });
  }

  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key) return bad("Stripe not configured", 500);
  const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

  // ----- Verify payment (handle both flows) -----
  let paid = false;
  let paidCents = 0;
  let currency = (draft.currency || "eur").toLowerCase();
  let stripeSessionId = draft.stripeSessionId || null;
  let stripePaymentIntentId = draft.stripePaymentIntentId || null;
  let emailForReceipt = draft?.primary_contact?.email || null;

  // Keep references for later (email rendering)
  let checkoutSession = null;
  let intent = null;

  if (sessionId) {
    const s = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent", "customer_details"],
    });
    checkoutSession = s;

    stripeSessionId = s.id;
    emailForReceipt =
      emailForReceipt ||
      s?.customer_details?.email ||
      s?.customer_email ||
      null;

    paid =
      s?.payment_status === "paid" ||
      (s?.status === "complete" && s?.payment_intent?.status === "succeeded");
    if (!paid) return ok({ status: "pending" }, 202);

    paidCents = typeof s.amount_total === "number" ? s.amount_total : 0;
    currency = (s.currency || currency).toLowerCase();
    stripePaymentIntentId =
      typeof s.payment_intent === "string"
        ? s.payment_intent
        : s.payment_intent?.id || stripePaymentIntentId;
  } else if (payment_intent) {
    const pi = await stripe.paymentIntents.retrieve(payment_intent);
    intent = pi;

    stripePaymentIntentId = pi.id;
    emailForReceipt = emailForReceipt || pi?.receipt_email || null;
    paid = pi.status === "succeeded" || pi.status === "processing";
    if (!paid) return ok({ status: "pending" }, 202);

    paidCents =
      typeof pi.amount_received === "number"
        ? pi.amount_received
        : pi.amount || 0;
    currency = (pi.currency || currency).toLowerCase();
  }

  // Mark draft as paid (intermediate), store Stripe ids
  const nowIso = new Date().toISOString();
  await admin
    .from("BookingDraft")
    .update({
      status: "paid",
      updatedAt: nowIso,
      stripeSessionId: stripeSessionId || null,
      stripePaymentIntentId: stripePaymentIntentId || null,
      totalAmount: paidCents / 100,
    })
    .eq("id", draftId);

  // ----- Idempotency: reuse existing Booking if already created for these Stripe ids -----
  let bookingId = null;
  if (stripePaymentIntentId) {
    const { data: bByPI } = await admin
      .from("Booking")
      .select("id")
      .eq("stripePaymentIntentId", stripePaymentIntentId)
      .maybeSingle();
    bookingId = bByPI?.id || bookingId;
  }
  if (!bookingId && stripeSessionId) {
    const { data: bByCS } = await admin
      .from("Booking")
      .select("id")
      .eq("stripeSessionId", stripeSessionId)
      .maybeSingle();
    bookingId = bByCS?.id || bookingId;
  }

  // Compute booking snapshot
  const A = Number(draft.counts?.adults || 0);
  const K = Number(draft.counts?.kids || 0);
  const numberOfPeople = A + K;
  const unitKid = draft.unitPriceKid ?? draft.unitPriceAdult;

  const { data: slot } = await admin
    .from("ScheduleSlot")
    .select("date")
    .eq("id", draft.scheduleSlotId)
    .maybeSingle();

  // (Optional) resolve/attach a user to the booking
  const ensuredUserId = await ensureDraftUserId(
    admin,
    draft,
    checkoutSession || intent
  );

  // ----- Insert booking if missing -----
  if (!bookingId) {
    const ins = await admin
      .from("Booking")
      .insert({
        userId: ensuredUserId ?? null, // optional
        scheduleSlotId: draft.scheduleSlotId,
        experienceId: draft.experienceId,
        status: "paid", // <- you wanted "paid"
        numberOfPeople,
        counts: draft.counts,
        attendees: Array.isArray(draft.attendees) ? draft.attendees : [],
        adultsCount: A || null,
        kidsCount: K || null,
        unitPriceAdult: draft.unitPriceAdult ?? null,
        unitPriceKid: unitKid ?? null,
        totalPaidAmount: (paidCents || 0) / 100,
        currency: currency,
        primary_contact: draft.primary_contact ?? null,
        stripeSessionId: stripeSessionId || null,
        stripePaymentIntentId: stripePaymentIntentId || null,
        startTime: slot?.date || null,
      })
      .select("id")
      .single();

    if (ins.error) {
      // race: try fetch by stripe ids again
      const ref = stripePaymentIntentId
        ? await admin
            .from("Booking")
            .select("id")
            .eq("stripePaymentIntentId", stripePaymentIntentId)
            .maybeSingle()
        : stripeSessionId
        ? await admin
            .from("Booking")
            .select("id")
            .eq("stripeSessionId", stripeSessionId)
            .maybeSingle()
        : { data: null };
      bookingId = ref?.data?.id || null;
      if (!bookingId) {
        console.error("[confirm] insert Booking failed", ins.error);
        return ok({ status: "Paid", pending: true }, 202);
      }
    } else {
      bookingId = ins.data.id;
    }
  } else if (ensuredUserId) {
    // If we found an existing booking, we can still backfill userId once.
    await admin
      .from("Booking")
      .update({ userId: ensuredUserId })
      .eq("id", bookingId);
  }

  // ----- Flip draft → converted and link booking -----
  const upd2 = await admin
    .from("BookingDraft")
    .update({
      status: "converted",
      convertedBookingId: bookingId,
      updatedAt: nowIso,
      stripeSessionId,
      stripePaymentIntentId,
      totalAmount: (paidCents || 0) / 100,
    })
    .eq("id", draftId);

  if (upd2.error) {
    console.error("[confirm] failed to set converted", upd2.error);
  }

  // Fetch booking row to derive a human code (if your schema has one)
  const bookingRow = await getBookingRow(admin, bookingId);
  const bookingCode =
    deriveBookingCode(bookingRow) || `BK-${String(bookingId).padStart(6, "0")}`;

  // Fetch Experience + Slot for email contents
  const [{ data: expRow }, { data: slotRow }] = await Promise.all([
    admin
      .from("Experience")
      .select("name,location")
      .eq("id", draft.experienceId)
      .maybeSingle(),
    admin
      .from("ScheduleSlot")
      .select("date")
      .eq("id", draft.scheduleSlotId)
      .maybeSingle(),
  ]);

  // ----- Send confirmation email (idempotent) -----
  try {
    const { data: b } = await admin
      .from("Booking")
      .select('id, "confirmationEmailSentAt"')
      .eq("id", bookingId)
      .maybeSingle();

    if (!b?.confirmationEmailSentAt) {
      // Choose best recipient
      const toEmail =
        emailForReceipt ||
        checkoutSession?.customer_details?.email ||
        checkoutSession?.customer_email ||
        intent?.receipt_email ||
        null;

      // Provide a "session-like" object if we don't have checkoutSession
      const sessionLike =
        checkoutSession &&
        checkoutSession.amount_total != null &&
        checkoutSession.currency
          ? checkoutSession
          : {
              amount_total: paidCents,
              currency: (currency || "EUR").toLowerCase(),
            };

      const sendRes = await sendBookingConfirmation({
        to: toEmail,
        draft, // BookingDraft row
        session: sessionLike, // used only to format totals/currency
        experience: expRow || null,
        slot: slotRow || null,
        bookingCode,
        bookingId,
      });
      console.log("[confirm] email result:", sendRes);

      if (sendRes?.sent) {
        const stamp = await admin
          .from("Booking")
          .update({ confirmationEmailSentAt: new Date().toISOString() })
          .eq("id", bookingId);

        if (stamp.error && String(stamp.error.code) === "42703") {
          console.warn(
            "[confirm] confirmationEmailSentAt column missing; skipping timestamp"
          );
        }
      }
    }
  } catch (e) {
    console.error("[confirm] confirmation email failed:", e?.message);
  }

  return ok({ converted: true, bookingId, bookingCode });
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
