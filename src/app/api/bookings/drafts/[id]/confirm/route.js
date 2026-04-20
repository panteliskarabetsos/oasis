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

  // Read identifiers from query OR JSON body
  const url = new URL(req.url);
  const qsSessionId = url.searchParams.get("session_id") || "";
  const qsPI = url.searchParams.get("payment_intent") || "";
  const body = (await req.json().catch(() => ({}))) || {};
  const sessionId = body.session_id || qsSessionId;
  const payment_intent = body.payment_intent || qsPI;
  const origin = originFromReq(req);

  // DB
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  // Load draft (include promo columns so we can merge)
  const { data: draft, error: dErr } = await admin
    .from("BookingDraft")
    .select(
      `
      id, status, counts, attendees, experienceId, scheduleSlotId,
      primary_contact, "unitPriceAdult", "unitPriceKid",
      "totalAmount", "stripeSessionId", "stripePaymentIntentId",
      "convertedBookingId", currency,
      promoJson, "appliedPromoCode", "discountAmount"
    `,
    )
    .eq("id", draftId)
    .maybeSingle();

  if (dErr || !draft) {
    console.warn("[confirm] Draft not found", { draftId, dErr });
    return bad("Draft not found", 404);
  }

  // If we already converted, short-circuit
  if (draft.convertedBookingId) {
    return ok({
      converted: true,
      bookingId: draft.convertedBookingId,
      already: true,
    });
  }

  // ===== Stripe verification (supports three paths) =====
  // A) Checkout success (session_id)
  // B) Elements (payment_intent)
  // C) Zero-total path: draft already marked "paid" with total 0 (no Stripe ids)
  let paid = false;
  let paidCents = 0;
  let currency = (draft.currency || "eur").toLowerCase();
  let stripeSessionId = draft.stripeSessionId || null;
  let stripePaymentIntentId = draft.stripePaymentIntentId || null;
  let emailForReceipt = draft?.primary_contact?.email || null;

  let checkoutSession = null;
  let intent = null;

  // C) FREE path (no session/PI, but draft is already "paid")
  if (!sessionId && !payment_intent) {
    if (String(draft.status || "").toLowerCase() === "paid") {
      paid = true;
      paidCents = Math.round(Number(draft.totalAmount || 0) * 100) || 0;
    } else {
      return NextResponse.json(
        {
          error: "Payment not found",
          redirectUrl: `${origin}/booking/${draftId}/payment?failed=1&reason=no_identifiers`,
        },
        { status: 409 },
      );
    }
  }

  // Only initialize Stripe if we actually need to talk to it
  let stripe = null;
  const needStripe = !!(sessionId || payment_intent);
  if (needStripe) {
    const key = process.env.STRIPE_SECRET_KEY || "";
    if (!key) return bad("Stripe not configured", 500);
    stripe = new Stripe(key, { apiVersion: "2024-06-20" });
  }

  if (stripe && sessionId) {
    const s = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent", "customer_details"],
    });
    if (
      s.client_reference_id !== String(draftId) &&
      s.metadata?.draft_id !== String(draftId)
    ) {
      console.error(
        `[SECURITY] Session ${sessionId} does not belong to draft ${draftId}`,
      );
      return bad("Unauthorized payment session mismatch", 403);
    }

    checkoutSession = s;

    const piObj =
      typeof s.payment_intent === "object" ? s.payment_intent : null;
    const piStatus = piObj?.status || "";
    const isFailure =
      s?.status === "expired" ||
      s?.payment_status === "unpaid" ||
      ["requires_payment_method", "canceled"].includes(piStatus);

    if (isFailure) {
      const reason =
        s?.status === "expired"
          ? "expired"
          : s?.payment_status === "unpaid"
            ? "unpaid"
            : piStatus || "failed";
      return NextResponse.json(
        {
          error: "Payment failed",
          reason,
          redirectUrl: `${origin}/booking/${draftId}/payment?failed=1&reason=${encodeURIComponent(
            reason,
          )}`,
        },
        { status: 409 },
      );
    }

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
  } else if (stripe && payment_intent) {
    const pi = await stripe.paymentIntents.retrieve(payment_intent);
    if (pi.metadata?.draft_id !== String(draftId)) {
      console.error(
        `[SECURITY] PI ${payment_intent} does not belong to draft ${draftId}`,
      );
      return bad("Unauthorized payment intent mismatch", 403);
    }
    intent = pi;
    if (["requires_payment_method", "canceled"].includes(pi.status)) {
      return NextResponse.json(
        {
          error: "Payment failed",
          reason: pi.status,
          redirectUrl: `${origin}/booking/${draftId}/payment?failed=1&reason=${pi.status}`,
        },
        { status: 409 },
      );
    }
    if (pi.status === "requires_action") {
      return NextResponse.json(
        {
          error: "Action required",
          reason: "requires_action",
          redirectUrl: `${origin}/booking/${draftId}/payment?action_required=1&pi=${encodeURIComponent(
            pi.id,
          )}`,
        },
        { status: 409 },
      );
    }

    stripePaymentIntentId = pi.id;
    emailForReceipt = emailForReceipt || pi?.receipt_email || null;
    paid = pi.status === "succeeded" || pi.status === "processing";
    if (!paid) return ok({ status: "pending" }, 202);

    paidCents =
      typeof pi.amount_received === "number"
        ? pi.amount_received
        : typeof pi.amount === "number"
          ? pi.amount
          : 0;
    currency = (pi.currency || currency).toLowerCase();
  }

  // Normalize promo metadata from Stripe (if any)
  const meta =
    (checkoutSession?.payment_intent &&
      typeof checkoutSession.payment_intent === "object" &&
      checkoutSession.payment_intent.metadata) ||
    intent?.metadata ||
    {};

  const promoCode = (meta.promo_code || "").trim();
  const discountCents = Number(meta.discount_cents || 0) || 0;
  const promoCurrency = (
    meta.promo_currency ||
    draft.currency ||
    "eur"
  ).toUpperCase();
  const promoType = (meta.promo_type || "").toLowerCase(); // "percent" | "amount" | ""
  const promoValue = meta.promo_value != null ? String(meta.promo_value) : null;

  // Final-success indicator (for post-payment side effects)
  const isFinalPaid =
    (!sessionId && !payment_intent) /* free */ ||
    (checkoutSession && checkoutSession.payment_status === "paid") ||
    (intent && intent.status === "succeeded");

  // Build promoFromPI (if metadata present)
  const promoFromPI = promoCode
    ? {
        code: promoCode,
        discountType: promoType || undefined,
        discountValue: promoValue != null ? Number(promoValue) : undefined,
        currency: promoCurrency,
        discountCents,
        source: meta.source || undefined,
      }
    : null;

  // Merge Stripe promo w/ what we already stamped on the draft
  const mergedPromo =
    promoFromPI ||
    (draft?.promoJson
      ? {
          ...draft.promoJson,
          code: draft.appliedPromoCode || draft.promoJson.code,
        }
      : null);

  const mergedDiscountAmount =
    promoFromPI?.discountCents != null
      ? promoFromPI.discountCents / 100
      : Number(draft?.discountAmount || 0);

  // Gift card hints
  const giftMeta =
    mergedPromo && String(mergedPromo.source || "").toLowerCase() === "giftcard"
      ? mergedPromo
      : null;
  const giftCardId = giftMeta?.giftcard?.id ?? (meta.giftcard_id || null);
  const giftCardCode = giftMeta?.code || meta.giftcard_code || null;
  const giftApplyCentsRaw =
    Number(
      (giftMeta && giftMeta.discountCents) ??
        giftMeta?.giftcard?.applyAmountCents ??
        meta.giftcard_apply_cents ??
        0,
    ) || 0;
  const giftCurrency = (
    giftMeta?.currency ||
    promoCurrency ||
    draft.currency ||
    "EUR"
  ).toUpperCase();

  // Persist promo snapshot onto the draft (best effort)
  try {
    await admin
      .from("BookingDraft")
      .update({
        appliedPromoCode: mergedPromo?.code ?? null,
        discountAmount: mergedDiscountAmount || 0,
        promoJson: mergedPromo ?? null,
      })
      .eq("id", draftId);
  } catch {}

  // Stamp draft as paid + store Stripe ids (idempotent)
  const nowIso = new Date().toISOString();
  await admin
    .from("BookingDraft")
    .update({
      status: "paid",
      updatedAt: nowIso,
      stripeSessionId: stripeSessionId || null,
      stripePaymentIntentId: stripePaymentIntentId || null,
      totalAmount: paidCents / 100, // 0 for free path is fine
    })
    .eq("id", draftId);

  // ===== Idempotent booking creation =====
  let bookingId = null;

  if (stripePaymentIntentId) {
    const { data: bByPI } = await admin
      .from("booking")
      .select("id")
      .eq("stripePaymentIntentId", stripePaymentIntentId)
      .maybeSingle();
    bookingId = bByPI?.id || bookingId;
  }
  if (!bookingId && stripeSessionId) {
    const { data: bByCS } = await admin
      .from("booking")
      .select("id")
      .eq("stripeSessionId", stripeSessionId)
      .maybeSingle();
    bookingId = bByCS?.id || bookingId;
  }

  const A = Number(draft.counts?.adults || 0);
  const K = Number(draft.counts?.kids || 0);
  const numberOfPeople = A + K;
  const unitKid = draft.unitPriceKid ?? draft.unitPriceAdult;

  const { data: slot } = await admin
    .from("ScheduleSlot")
    .select("date")
    .eq("id", draft.scheduleSlotId)
    .maybeSingle();

  // Resolve/attach userId (email-first)
  const ensuredUserId = await ensureDraftUserId(
    admin,
    draft,
    checkoutSession || intent,
  );

  // Insert booking if missing (race-safe)
  if (!bookingId) {
    const ins = await admin
      .from("booking")
      .insert({
        userId: ensuredUserId ?? null,
        scheduleSlotId: draft.scheduleSlotId,
        experienceId: draft.experienceId,
        status: "paid",
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
        notes: [
          draft?.notes || null,
          mergedPromo
            ? `[PROMO] code=${mergedPromo.code}; type=${mergedPromo.discountType}; value=${mergedPromo.discountValue}; discount=${mergedDiscountAmount}`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
        appliedPromoCode: mergedPromo?.code ?? null,
        discountAmount: mergedDiscountAmount || 0,
        promoJson: mergedPromo ?? null,
      })
      .select("id")
      .single();

    if (ins.error) {
      // Likely a race: try to recover by refetching by known Stripe keys
      const ref = stripePaymentIntentId
        ? await admin
            .from("booking")
            .select("id")
            .eq("stripePaymentIntentId", stripePaymentIntentId)
            .maybeSingle()
        : stripeSessionId
          ? await admin
              .from("booking")
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
    // Backfill user on existing booking
    await admin
      .from("booking")
      .update({ userId: ensuredUserId })
      .eq("id", bookingId);
  }

  // Gift card redeem (once) then merge into booking’s discount fields
  try {
    let giftAppliedCents = 0;

    if (isFinalPaid && (giftCardId || giftCardCode)) {
      const fallbackFromPromo =
        String(mergedPromo?.source || "").toLowerCase() === "giftcard"
          ? (promoFromPI?.discountCents ??
            Math.round(Number(mergedDiscountAmount || 0) * 100))
          : 0;

      const expectedGiftCents =
        Number.isInteger(giftApplyCentsRaw) && giftApplyCentsRaw > 0
          ? giftApplyCentsRaw
          : fallbackFromPromo;

      if (expectedGiftCents > 0) {
        giftAppliedCents = await redeemGiftCardOnce({
          admin,
          bookingId,
          draftId,
          cardId: giftCardId || null,
          code: giftCardCode || null,
          amountCents: expectedGiftCents,
          currency: giftCurrency,
          notes: `Auto-redeem on booking ${bookingId} (draft ${draftId}) via confirm`,
          tryRpc: true,
        });

        if (giftAppliedCents > 0) {
          const { data: cur } = await admin
            .from("booking")
            .select("discountAmount, appliedPromoCode, promoJson")
            .eq("id", bookingId)
            .maybeSingle();

          const existingDiscount = Number(cur?.discountAmount || 0);
          const giftAmount = giftAppliedCents / 100;
          const newDiscountAmount =
            String(mergedPromo?.source || "").toLowerCase() === "giftcard"
              ? giftAmount
              : existingDiscount + giftAmount;

          const giftTag = giftCardCode ? `GIFT:${giftCardCode}` : "GIFT";
          const appliedCodes = new Set(
            [cur?.appliedPromoCode, mergedPromo?.code, giftTag].filter(Boolean),
          );

          const prevJson =
            cur?.promoJson && typeof cur.promoJson === "object"
              ? cur.promoJson
              : mergedPromo && typeof mergedPromo === "object"
                ? mergedPromo
                : {};

          const promoJson = {
            ...prevJson,
            giftcard: {
              ...(prevJson?.giftcard || {}),
              id: giftCardId || prevJson?.giftcard?.id || null,
              code: giftCardCode || prevJson?.giftcard?.code || null,
              currency: giftCurrency,
              appliedCents: giftAppliedCents,
            },
          };

          await admin
            .from("booking")
            .update({
              discountAmount: newDiscountAmount,
              appliedPromoCode: Array.from(appliedCodes).join(" + "),
              promoJson,
            })
            .eq("id", bookingId);
        }
      }
    }
  } catch (e) {
    console.warn("[confirm] gift card redeem/persist failed:", e?.message || e);
  }

  // Flip draft → converted and link booking
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

  // Build a human-friendly booking code
  const bookingRow = await getBookingRow(admin, bookingId);
  const bookingCode =
    deriveBookingCode(bookingRow) || `BK-${String(bookingId).padStart(6, "0")}`;

  // Load Experience + Slot (for email)
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

  // Increment promo usage ONCE on final success
  try {
    if (isFinalPaid && promoCode) {
      await incrementPromoUsageOnce(admin, {
        draftId,
        bookingId,
        promoCode,
        nowIso,
      });
    }
  } catch (e) {
    console.warn("[confirm] promo usage increment failed:", e?.message || e);
  }

  // Send confirmation email (idempotent)
  try {
    const { data: b } = await admin
      .from("booking")
      .select('id, "confirmationEmailSentAt"')
      .eq("id", bookingId)
      .maybeSingle();

    if (!b?.confirmationEmailSentAt) {
      const toEmail =
        emailForReceipt ||
        checkoutSession?.customer_details?.email ||
        checkoutSession?.customer_email ||
        intent?.receipt_email ||
        null;

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
        session: sessionLike, // minimal shape for totals/currency
        experience: expRow || null,
        slot: slotRow || null,
        bookingCode,
        bookingId,
      });
      console.log("[confirm] email result:", sendRes);

      if (sendRes?.sent) {
        const stamp = await admin
          .from("booking")
          .update({ confirmationEmailSentAt: new Date().toISOString() })
          .eq("id", bookingId);

        if (stamp.error && String(stamp.error.code) === "42703") {
          console.warn(
            "[confirm] confirmationEmailSentAt column missing; skipping timestamp",
          );
        }
      }
    }
  } catch (e) {
    console.error("[confirm] confirmation email failed:", e?.message);
  }

  // Log a redemption row (if you keep one) — idempotent-ish
  try {
    if (isFinalPaid && promoCode) {
      await redeemPromoOnce(admin, {
        promoCode,
        bookingId,
        draftId,
        amountOffCents: discountCents,
        currency: promoCurrency,
        promoType,
        promoValue,
        customerEmail: emailForReceipt,
        stripePaymentIntentId,
      });
    }
  } catch (e) {
    console.warn("[confirm] redeem promo failed:", e?.message || e);
  }

  return ok({ converted: true, bookingId, bookingCode });
}

/* ---------------------------- helpers ---------------------------- */

async function getBookingRow(admin, id) {
  const { data, error } = await admin
    .from("booking")
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

function originFromReq(req) {
  let envUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    ""
  ).trim();
  if (envUrl) {
    if (!/^https?:\/\//i.test(envUrl)) envUrl = `https://${envUrl}`;
    const u = new URL(envUrl);
    return `${u.protocol}//${u.host}`.replace(/\/$/, "");
  }
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`.replace(/\/$/, "");
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

  /**
   * Stamp BookingDraft.promoJson so we don't increment twice.
   */
  async function stampDraftRedeemed(admin, draftId, payload) {
    const { data: prev } = await admin
      .from("BookingDraft")
      .select("promoJson")
      .eq("id", draftId)
      .maybeSingle();

    const merged = {
      ...(prev?.promoJson && typeof prev.promoJson === "object"
        ? prev.promoJson
        : {}),
      redeemedAt: payload.at,
      redeemedOnTable: payload.table,
      redeemedCode: payload.code,
      redeemedBookingId: payload.bookingId ?? null,
      skipped: !!payload.skipped,
      reason: payload.reason || null,
      newCount: payload.newCount ?? null,
    };

    await admin
      .from("BookingDraft")
      .update({ promoJson: merged })
      .eq("id", draftId);
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
          { p_email: contactEmail, p_name: name, p_role: "customer" },
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
/**
 * Increment redemptionCount for a promo code in DiscountCode or Voucher
 * exactly once per draft/payment. Idempotent via BookingDraft.promoJson.redeemedAt.
 */
async function incrementPromoUsageOnce(
  admin,
  { draftId, bookingId, promoCode, nowIso },
) {
  const code = String(promoCode || "").trim();
  if (!code) return;

  // Idempotency: bail if we've already stamped
  const { data: draftRow, error: draftErr } = await admin
    .from("BookingDraft")
    .select("promoJson, appliedPromoCode")
    .eq("id", draftId)
    .maybeSingle();

  if (draftErr || !draftRow) return;
  if (draftRow?.promoJson?.redeemedAt) return;

  // Prefer DiscountCode, then Voucher
  const where = (tbl) =>
    admin
      .from(tbl)
      .select(
        "id, code, active, startsAt, endsAt, maxRedemptions, redemptionCount",
      )
      .ilike("code", code)
      .maybeSingle();

  let found = null;
  let table = null;

  {
    const { data } = await where("DiscountCode");
    if (data) {
      found = data;
      table = "DiscountCode";
    }
  }
  if (!found) {
    const { data } = await where("Voucher");
    if (data) {
      found = data;
      table = "Voucher";
    }
  }
  if (!found || !table) {
    await stampDraftRedeemed(admin, draftId, {
      code,
      table: null,
      skipped: true,
      reason: "code_not_found",
      at: nowIso,
      bookingId,
    });
    return;
  }

  // Basic validity checks (soft)
  const now = new Date();
  const active = found.active !== false;
  const withinWindow =
    (!found.startsAt || new Date(found.startsAt) <= now) &&
    (!found.endsAt || new Date(found.endsAt) >= now);
  const underCap =
    found.maxRedemptions == null ||
    (Number(found.redemptionCount) || 0) < Number(found.maxRedemptions);

  if (!active || !withinWindow || !underCap) {
    await stampDraftRedeemed(admin, draftId, {
      code,
      table,
      skipped: true,
      reason: !active
        ? "inactive"
        : !withinWindow
          ? "outside_window"
          : "over_cap",
      at: nowIso,
      bookingId,
    });
    return;
  }

  // Increment redemptionCount (optimistic; low race risk in this flow)
  const nextCount = (Number(found.redemptionCount) || 0) + 1;

  const upd = await admin
    .from(table)
    .update({ redemptionCount: nextCount, updatedAt: nowIso })
    .eq("id", found.id)
    .select("id, redemptionCount")
    .maybeSingle();

  if (upd.error) {
    console.warn(`[promo] increment ${table} failed`, upd.error);
    await stampDraftRedeemed(admin, draftId, {
      code,
      table,
      skipped: true,
      reason: "increment_failed",
      at: nowIso,
      bookingId,
    });
    return;
  }

  await stampDraftRedeemed(admin, draftId, {
    code,
    table,
    skipped: false,
    at: nowIso,
    bookingId,
    newCount: upd.data?.redemptionCount ?? nextCount,
  });
}
async function redeemPromoOnce(
  admin,
  {
    promoCode,
    bookingId,
    draftId,
    amountOffCents,
    currency,
    promoType,
    promoValue,
    customerEmail,
    stripePaymentIntentId,
  },
) {
  // 0) Normalize code
  const code = String(promoCode).trim();
  if (!code) return;

  // 1) If you already logged a redemption for this booking/draft, bail (idempotency)
  // Try common redemption tables
  const redemptionTables = [
    "DiscountRedemption",
    "VoucherRedemption",
    "PromoRedemption",
  ];
  for (const tbl of redemptionTables) {
    const { data, error } = await admin
      .from(tbl)
      .select("id")
      .or(
        [
          bookingId ? `bookingId.eq.${bookingId}` : null,
          draftId ? `draftId.eq.${draftId}` : null,
          stripePaymentIntentId
            ? `stripePaymentIntentId.eq.${stripePaymentIntentId}`
            : null,
        ]
          .filter(Boolean)
          .join(","),
      )
      .limit(1)
      .maybeSingle();

    // If table doesn't exist, Postgres code 42P01 (undefined table) will surface later on insert.
    if (!error && data?.id) {
      // already redeemed for this booking/draft
      return;
    }
  }

  // 2) Find the code row in any of the likely tables
  const codeTables = ["DiscountCode", "Voucher", "PromoCode"];
  let found = null;
  let foundTable = null;

  for (const tbl of codeTables) {
    const { data, error } = await admin
      .from(tbl)
      .select("*")
      .ilike("code", code) // case-insensitive match; adjust to eq if required
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      found = data;
      foundTable = tbl;
      break;
    }
  }

  if (!found || !foundTable) {
    // No table / row found; nothing to update
    return;
  }

  // 3) Optional: check basic constraints if columns exist
  // We won't fail if columns don't exist; just best-effort checks.
  try {
    const tooMany =
      typeof found.maxRedemptions === "number" &&
      typeof found.redeemedCount === "number" &&
      found.maxRedemptions > 0 &&
      found.redeemedCount >= found.maxRedemptions;

    if (tooMany) {
      console.warn("[promo] max redemptions reached; skipping update");
      return;
    }

    if (found.expiresAt && new Date(found.expiresAt) < new Date()) {
      console.warn("[promo] code expired; skipping update");
      return;
    }

    if (
      found.isActive === false ||
      found.active === false ||
      found.status === "inactive"
    ) {
      console.warn("[promo] code inactive; skipping update");
      // still log redemption? usually no; choose to skip.
      return;
    }
  } catch {
    // columns may not exist; ignore
  }

  // 4) Try to insert a redemption log if a redemption table exists
  let redemptionLogged = false;
  for (const tbl of redemptionTables) {
    try {
      const ins = await admin
        .from(tbl)
        .insert({
          code, // keep the raw code for audit
          codeId: found.id || null,
          bookingId: bookingId || null,
          draftId: draftId || null,
          amountOff: (amountOffCents || 0) / 100,
          amountOffCents: amountOffCents || 0,
          currency: currency || null,
          promoType: promoType || null,
          promoValue: promoValue || null,
          customerEmail: customerEmail || null,
          stripePaymentIntentId: stripePaymentIntentId || null,
          redeemedAt: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (!ins.error && ins.data?.id) {
        redemptionLogged = true;
        break;
      }
    } catch (e) {
      // Table may not exist (42P01) or column mismatch (42703); try next one
      if (String(e?.code) !== "42P01") {
        // Console for visibility, but non-fatal
        console.warn(`[promo] insert into ${tbl} failed`, e?.message || e);
      }
    }
  }

  // 5) If no redemption table, fall back to incrementing a counter on the code row
  if (!redemptionLogged) {
    try {
      // Try common counter column names
      const counters = ["redeemedCount", "redemptions", "timesUsed"];
      let next = null;
      for (const c of counters) {
        if (typeof found[c] === "number") {
          next = { col: c, val: found[c] + 1 };
          break;
        }
      }

      const patch = {
        lastRedeemedAt: new Date().toISOString(),
        ...(next ? { [next.col]: next.val } : {}),
        // If you track lastBookingId/lastDraftId, set them conditionally:
        ...(bookingId ? { lastBookingId: bookingId } : {}),
        ...(draftId ? { lastDraftId: draftId } : {}),
      };

      // Update by id if present, else by code
      let q = admin.from(foundTable).update(patch);
      if (found.id) q = q.eq("id", found.id);
      else q = q.ilike("code", code);
      const res = await q.limit(1);

      if (res.error && String(res.error.code) === "42703") {
        // Some columns missing; try minimal patch
        await admin
          .from(foundTable)
          .update(next ? { [next.col]: next.val } : {})
          .eq(found.id ? "id" : "code", found.id || code)
          .limit(1);
      }
    } catch (e) {
      console.warn(
        `[promo] update ${foundTable} counter failed`,
        e?.message || e,
      );
    }
  }
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
          exp.name,
        )}</p>`
      : "",
    exp?.location
      ? `<p style="margin:0"><strong>Location:</strong> ${escapeHtml(
          exp.location,
        )}</p>`
      : "",
    when
      ? `<p style="margin:0"><strong>When:</strong> ${escapeHtml(
          dateLabel,
        )} at ${escapeHtml(timeLabel)}</p>`
      : "",
    ids.bookingCode
      ? `<p style="margin:0 0 12px"><strong>Booking #</strong> ${escapeHtml(
          ids.bookingCode,
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

async function redeemGiftCardOnce({
  admin,
  bookingId,
  draftId = null,
  cardId = null,
  code = null,
  amountCents,
  currency = "EUR",
  notes = "",
  tryRpc = true,
}) {
  if (
    !bookingId ||
    !(cardId || code) ||
    !Number.isInteger(amountCents) ||
    amountCents <= 0
  ) {
    return 0;
  }

  // 0) Locate card by id or code
  let card = null;
  if (cardId) {
    const { data } = await admin
      .from("GiftCard")
      .select("id, code, currency, status, expires_at, remaining_amount_cents")
      .eq("id", cardId)
      .maybeSingle();
    card = data || null;
  } else if (code) {
    const { data } = await admin
      .from("GiftCard")
      .select("id, code, currency, status, expires_at, remaining_amount_cents")
      .ilike("code", code)
      .maybeSingle();
    card = data || null;
  }
  if (!card) return 0;

  // 1) If we already recorded a redemption for (this card, this booking), bail
  {
    const { data: existing } = await admin
      .from("GiftCardRedemption")
      .select("id, amount_cents")
      .eq("gift_card_id", card.id)
      .eq("booking_id", bookingId)
      .maybeSingle();

    if (existing?.id) {
      return Number(existing.amount_cents || 0) || 0;
    }
  }

  // 2) Cap by remaining balance
  const remain = Math.max(Number(card.remaining_amount_cents || 0), 0);
  if (remain <= 0) return 0;

  const toApply = Math.min(remain, amountCents);

  // 3) Optional basic checks
  const now = new Date();
  if (card.status !== "active") return 0;
  if (card.expires_at && new Date(card.expires_at) < now) return 0;
  if (
    String(card.currency || "EUR").toUpperCase() !==
    String(currency || "EUR").toUpperCase()
  ) {
    // currency mismatch — skip to avoid corrupting the balance
    return 0;
  }

  // 4) Try server-side atomic RPC first (if you created it)
  if (tryRpc) {
    try {
      const { data, error } = await admin.rpc("redeem_giftcard", {
        p_card_id: card.id,
        p_amount_cents: toApply,
        p_booking_id: bookingId,
        p_notes: notes || null,
      });

      if (!error && data && data.id) {
        return toApply;
      }
      if (error && String(error.code) !== "42883") {
        console.warn("[giftcard] RPC failed:", error.message || error);
      }
    } catch (e) {
      if (String(e?.code) !== "42883") {
        console.warn("[giftcard] RPC exception:", e?.message || e);
      }
    }
  }

  // 5) Fallback (best effort): update card, then insert redemption
  // Update remaining & status conditionally (only if still active)
  const newRemaining = remain - toApply;
  const newStatus = newRemaining === 0 ? "redeemed" : "active";

  const { data: updated, error: upErr } = await admin
    .from("GiftCard")
    .update({
      remaining_amount_cents: newRemaining,
      last_redeemed_at: new Date().toISOString(),
      status: newStatus,
    })
    .eq("id", card.id)
    .eq("status", "active")
    .select("id, remaining_amount_cents, status")
    .maybeSingle();

  if (upErr || !updated?.id) {
    console.warn("[giftcard] balance update failed:", upErr?.message || upErr);
    return 0;
  }

  // Insert redemption log (non-fatal if this fails after balance updated)
  const ins = await admin
    .from("GiftCardRedemption")
    .insert({
      gift_card_id: card.id,
      amount_cents: toApply,
      currency: currency,
      booking_id: bookingId,
      notes: notes || null,
    })
    .select("id")
    .maybeSingle();

  if (ins?.error) {
    console.warn(
      "[giftcard] redemption insert failed:",
      ins.error?.message || ins.error,
    );
  }

  return toApply;
}
