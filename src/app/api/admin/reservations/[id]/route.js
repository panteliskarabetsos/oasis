export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import Stripe from "stripe";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

async function requireAdmin() {
  const supa = await createSupabaseServer();
  if (!supa)
    return { error: true, response: bad("Server not configured", 500) };

  const { data, error } = await supa.auth.getUser();
  const user = data?.user;
  if (error || !user)
    return { error: true, response: bad("Unauthorized", 401) };

  const admin = createSupabaseAdmin();
  if (!admin)
    return { error: true, response: bad("Server not configured", 500) };

  const { data: profile } = await admin
    .from("User")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single();

  const role =
    profile?.role ||
    user?.app_metadata?.role ||
    user?.user_metadata?.role ||
    "user";

  if (!["admin", "superadmin"].includes(role))
    return { error: true, response: bad("Forbidden", 403) };

  return { error: false, admin };
}

// GET
export async function GET(req, ctx) {
  const auth = await requireAdmin();
  if (auth.error) return auth.response;
  const supa = auth.admin;

  try {
    const { id } = await ctx.params;
    const rid = Number(Array.isArray(id) ? id[0] : id);
    if (!Number.isFinite(rid) || rid <= 0) return bad("Invalid id", 400);

    // ---------- Try finalized Booking ----------
    const { data: b, error: bErr } = await supa
      .from("booking")
      .select(
        `*,
         ScheduleSlot:ScheduleSlot(*, Experience:Experience(*)),
         Experience:Experience!Booking_experienceId_fkey(id, name, location),
         User:User(id, email, name, surname, phone),
         selected_meetup_point`,
      )
      .eq("id", rid)
      .maybeSingle();
    if (bErr) throw bErr;

    if (b) {
      const slot = b?.ScheduleSlot || null;
      const exFromSlot = slot?.Experience || null;
      const exDirect = b?.Experience || null;
      const u = b?.User || {};

      const countsRaw = parseJSON(b?.counts, null) || {};
      const attendees = parseJSON(b?.attendees, []) || [];
      const pc = parseJSON(b?.primary_contact, null);
      // 🔑 ADDED: Parse pickup point
      const selected_meetup_point = parseJSON(b?.selected_meetup_point, null);

      const adults =
        (isNum(b?.adultsCount) && b.adultsCount) ||
        (isNum(countsRaw?.adults) && countsRaw.adults) ||
        (isNum(b?.numberOfPeople) && b.numberOfPeople) ||
        0;
      const kids =
        (isNum(b?.kidsCount) && b.kidsCount) ||
        (isNum(countsRaw?.kids) && countsRaw.kids) ||
        0;
      const teens = isNum(countsRaw?.teens) ? countsRaw.teens : null;

      const counts = {
        adults,
        kids,
        teens,
        total: isNum(countsRaw?.total)
          ? countsRaw.total
          : Math.max(0, adults + kids),
      };

      const totalPaidAmount = isNum(b?.totalPaidAmount)
        ? b.totalPaidAmount
        : null;
      const currency = (b?.currency || "EUR").toString().toUpperCase();
      const scheduleSlotId = b?.scheduleSlotId ?? slot?.id ?? null;
      const startTime = slot?.date ?? b?.startTime ?? null;
      const experienceId =
        slot?.experienceId ?? b?.experienceId ?? exDirect?.id ?? null;
      const experienceName =
        exFromSlot?.name || exDirect?.name || b?.customExperienceName || null;
      const experienceLocation =
        exFromSlot?.location ?? exDirect?.location ?? null;

      const guestName =
        [u?.name, u?.surname].filter(Boolean).join(" ").trim() ||
        pc?.name ||
        [pc?.firstName, pc?.lastName].filter(Boolean).join(" ").trim() ||
        null;

      const unitPrices = {
        adult: isNum(b?.unitPriceAdult) ? b.unitPriceAdult : null,
        kid: isNum(b?.unitPriceKid) ? b.unitPriceKid : null,
        teen: isNum(b?.unitPriceTeen) ? b.unitPriceTeen : null,
      };

      const promoExtract = extractPromoFromRow(b, unitPrices, counts);
      const promoPayload = buildPromoPayload(promoExtract);

      const item = {
        id: b.id,
        source: "booking",
        code: deriveCode(b),
        status: String(b.status || "").trim() || "confirmed",
        createdAt: b.createdAt ?? null,
        updatedAt: b.updatedAt ?? null,
        notes: b.notes ?? null,

        counts,
        attendees,
        selected_meetup_point, // 🔑 ADDED: Include in returned object

        unitPrices,
        money: {
          totalPaidAmount,
          totalAmount: totalPaidAmount,
          currency,
        },

        payments: {
          stripeSessionId: b?.stripeSessionId ?? null,
          stripeSessionUrl: b?.stripeSessionUrl ?? null,
          stripePaymentIntentId: b?.stripePaymentIntentId ?? null,
          paymentMethod: null,
        },

        scheduleSlotId,
        startTime,
        duration: isNum(b?.duration) ? b.duration : null,
        experience: {
          id: experienceId,
          name: experienceName,
          location: experienceLocation,
          slug: exFromSlot?.slug ?? exDirect?.slug ?? null,
          images: exFromSlot?.images ?? exDirect?.images ?? null,
        },

        guest: {
          id: b?.userId ?? u?.id ?? null,
          name: guestName,
          email: u?.email ?? pc?.email ?? null,
          phone: u?.phone ?? pc?.phone ?? null,
        },
        guestSnapshot: cleanEmpty(pc || null),

        ...promoPayload,

        currency: b?.currency ?? null,
        unitPriceAdult: isNum(b?.unitPriceAdult) ? b.unitPriceAdult : null,
        unitPriceKid: isNum(b?.unitPriceKid) ? b.unitPriceKid : null,
        totalPaidAmount: totalPaidAmount,
        customExperienceName: b?.customExperienceName ?? null,
      };

      // -------------------------------------------------------------
      // LIVE STRIPE ENRICHMENT (The "Safety Net")
      // -------------------------------------------------------------
      if (
        (b?.stripeSessionId || b?.stripePaymentIntentId) &&
        process.env.STRIPE_SECRET_KEY
      ) {
        try {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: "2024-06-20",
          });

          let isPaid = false;
          let amountReceived = 0;
          let latestCharge = null;
          let finalPiId = b?.stripePaymentIntentId;

          // 1. Check the Checkout Session First (Web Links)
          if (b?.stripeSessionId) {
            const session = await stripe.checkout.sessions.retrieve(
              b.stripeSessionId,
              {
                expand: ["payment_intent", "payment_intent.latest_charge"],
              },
            );

            if (session.payment_status === "paid") {
              isPaid = true;
              amountReceived = session.amount_total / 100;
              if (session.payment_intent) {
                finalPiId = session.payment_intent.id || session.payment_intent;
                latestCharge = session.payment_intent.latest_charge;
              }
            }
          }

          // 2. Fallback: Check Payment Intent (For Physical Terminals / MOTO)
          if (!isPaid && finalPiId) {
            const pi = await stripe.paymentIntents.retrieve(finalPiId, {
              expand: ["latest_charge"],
            });
            if (pi && pi.status === "succeeded") {
              isPaid = true;
              amountReceived = pi.amount_received / 100;
              latestCharge = pi.latest_charge;
            }
          }

          // 3. Apply Live Sync if Stripe confirms payment
          if (isPaid) {
            // Force the API response to show the paid amount
            item.money.totalPaidAmount = amountReceived;
            item.totalPaidAmount = amountReceived;

            // Hide the active link since it's already paid
            item.payments.stripeSessionUrl = null;
            item.payments.stripePaymentIntentId = finalPiId;

            // Self-heal the database silently in the background
            if ((b.totalPaidAmount || 0) < amountReceived) {
              supa
                .from("booking")
                .update({
                  totalPaidAmount: amountReceived,
                  status: "confirmed",
                  stripePaymentIntentId: finalPiId, // Save the missing ID back to DB!
                  stripeSessionUrl: null,
                })
                .eq("id", b.id)
                .then(); // Fire and forget
            }
          }

          // 4. Extract the card details (Visa ending in 4242, etc.)
          if (latestCharge && typeof latestCharge !== "string") {
            item.payments.paymentMethod =
              extractPaymentMethodSummaryFromCharge(latestCharge);
          }
        } catch (err) {
          console.error("[reservations/:id GET] Live Stripe fetch error:", err);
        }
      }
      // -------------------------------------------------------------

      return ok({ item });
    }

    // ---------- Otherwise, BookingDraft ----------
    const { data: d, error: dErr } = await supa
      .from("BookingDraft")
      .select(
        `*, ScheduleSlot:ScheduleSlot(*, Experience:Experience(*)), selected_meetup_point`,
      ) // 🔑 ADDED: Fetch pickup point from draft
      .eq("id", rid)
      .maybeSingle();
    if (dErr) throw dErr;
    if (!d) return bad("Reservation not found", 404);

    const slot = d?.ScheduleSlot || {};
    const ex = slot?.Experience || {};
    const cnt = parseJSON(d?.counts, {}) || {};
    const pc = parseJSON(d?.primary_contact, {}) || {};
    const attendees = parseJSON(d?.attendees, []) || [];
    // 🔑 ADDED: Parse pickup point
    const selectedMeetupPointDraft = parseJSON(d?.selected_meetup_point, null);

    const counts = {
      adults: pickFirstNumber(cnt, ["adults", "adult", "A", "people"]) || 0,
      kids: pickFirstNumber(cnt, ["kids", "children", "K"]) || 0,
      teens: pickFirstNumber(cnt, ["teens", "teen", "T"]),
    };

    const unitPrices = {
      adult: isNum(d?.unitPriceAdult) ? d.unitPriceAdult : null,
      kid: isNum(d?.unitPriceKid) ? d.unitPriceKid : null,
      teen: isNum(d?.unitPriceTeen) ? d.unitPriceTeen : null,
    };

    const promoExtractDraft = extractPromoFromRow(d, unitPrices, counts);
    const promoPayloadDraft = buildPromoPayload(promoExtractDraft);
    const notesClean = stripPromoFromNotes(d?.notes ?? null);

    const item = {
      id: d.id,
      source: "draft",
      code: `D-${String(d.id).padStart(6, "0")}`,
      status: d.status,
      createdAt: d.createdAt ?? null,
      updatedAt: d.updatedAt ?? null,
      notes: notesClean,

      counts,
      attendees,
      selected_meetup_point: selected_meetup_point,
      unitPrices,
      money: {
        totalAmount: isNum(d?.totalAmount) ? d.totalAmount : null,
        currency: (d?.currency || "EUR").toString().toUpperCase(),
      },

      payments: {
        stripeSessionId: d?.stripeSessionId ?? null,
        stripeSessionUrl: d?.stripeSessionUrl ?? null, // 👈 ADDED HERE
        stripePaymentIntentId: d?.stripePaymentIntentId ?? null,
      },

      scheduleSlotId: d.scheduleSlotId ?? null,
      startTime: slot?.date ?? null,
      experience: {
        id: slot?.experienceId ?? null,
        name: ex?.name ?? null,
        location: ex?.location ?? null,
        slug: ex?.slug ?? null,
        images: ex?.images ?? null,
      },

      guest: {
        id: isNum(pc?.userId) ? Number(pc.userId) : null,
        name:
          (pc?.name ??
            pc?.fullName ??
            [pc?.firstName, pc?.lastName].filter(Boolean).join(" ")) ||
          null,
        email: pc?.email ?? null,
        phone: pc?.phone ?? null,
      },

      ...promoPayloadDraft,

      convertedBookingId: d?.convertedBookingId ?? null,
      expiresAt: d?.expiresAt ?? null,
    };

    return ok({ item });
  } catch (e) {
    console.error("/api/admin/reservations/[id] GET error", e);
    return bad(e?.message || "Failed to load reservation", 500);
  }
}

// PATCH (unchanged behavior)
export async function PATCH(req, ctx) {
  const auth = await requireAdmin();
  if (auth.error) return auth.response;
  const supa = auth.admin;

  const { id } = await ctx.params;
  const rid = Number(Array.isArray(id) ? id[0] : id);
  if (!Number.isFinite(rid) || rid <= 0) return bad("Invalid id", 400);

  let body;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON", 400);
  }

  // accept flat or nested payloads
  const pickFirst = (...vals) =>
    vals.find((v) => v !== undefined && v !== null);

  const unitPriceAdult = pickFirst(
    body.unitPriceAdult,
    body?.unitPrices?.adult,
  );
  const unitPriceKid = pickFirst(body.unitPriceKid, body?.unitPrices?.kid);

  const totalPaidAmount = pickFirst(
    body.totalPaidAmount,
    body?.money?.totalPaidAmount,
  );
  const totalAmount = pickFirst(body.totalAmount, body?.money?.totalAmount); // for drafts
  const currency = pickFirst(body.currency, body?.money?.currency);
  const statusRaw = pickFirst(body.status);
  const status = typeof statusRaw === "string" ? statusRaw.trim() : undefined;

  const numOrNull = (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // ---- Is it a finalized Booking? ----
  const { data: existsBooking, error: bExistsErr } = await supa
    .from("booking")
    .select("id")
    .eq("id", rid)
    .maybeSingle();
  if (bExistsErr) return bad("Failed to check booking", 500);

  if (existsBooking?.id) {
    const patch = {};
    if (status) patch.status = status;
    if (currency) patch.currency = String(currency).toUpperCase();
    if (unitPriceAdult !== undefined)
      patch.unitPriceAdult = numOrNull(unitPriceAdult);
    if (unitPriceKid !== undefined)
      patch.unitPriceKid = numOrNull(unitPriceKid);
    if (totalPaidAmount !== undefined)
      patch.totalPaidAmount = numOrNull(totalPaidAmount);

    const { data, error } = await supa
      .from("booking")
      .update(patch)
      .eq("id", rid)
      .select(
        "id, unitPriceAdult, unitPriceKid, totalPaidAmount, currency, status, updatedAt",
      )
      .maybeSingle();

    if (error) {
      console.error("[reservations/:id PATCH] booking update error:", error);
      return bad("Failed to update booking", 500);
    }
    return ok({ id: data.id, updated: data });
  }

  // ---- Otherwise it's a BookingDraft ----
  const { data: draft, error: dExistsErr } = await supa
    .from("BookingDraft")
    .select("id, counts")
    .eq("id", rid)
    .maybeSingle();
  if (dExistsErr) return bad("Failed to check draft", 500);
  if (!draft?.id) return bad("Reservation not found", 404);

  const dUpdate = {};
  if (status) dUpdate.status = status;
  if (unitPriceAdult !== undefined)
    dUpdate.unitPriceAdult = numOrNull(unitPriceAdult);
  if (unitPriceKid !== undefined)
    dUpdate.unitPriceKid = numOrNull(unitPriceKid);

  // drafts: compute totalAmount if prices change and not provided
  if (totalAmount !== undefined) {
    dUpdate.totalAmount = numOrNull(totalAmount);
  } else if (dUpdate.unitPriceAdult != null || dUpdate.unitPriceKid != null) {
    const cnt = draft.counts || {};
    const A = Number.isFinite(Number(cnt.adults)) ? Number(cnt.adults) : 0;
    const K = Number.isFinite(Number(cnt.kids)) ? Number(cnt.kids) : 0;
    const ua = dUpdate.unitPriceAdult ?? 0;
    const uk = dUpdate.unitPriceKid ?? 0;
    dUpdate.totalAmount = +(A * ua + K * uk).toFixed(2);
  }

  const { data: dUpdated, error: dErr } = await supa
    .from("BookingDraft")
    .update(dUpdate)
    .eq("id", rid)
    .select("id, unitPriceAdult, unitPriceKid, totalAmount, status, updatedAt")
    .maybeSingle();

  if (dErr) {
    console.error("[reservations/:id PATCH] draft update error:", dErr);
    return bad("Failed to update draft", 500);
  }
  return ok({ id: dUpdated.id, updated: dUpdated });
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

export async function DELETE(req, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.response;
  const supa = auth.admin;

  const { id } = await params; // params is async
  const rid = Number(Array.isArray(id) ? id[0] : id);
  if (!Number.isInteger(rid) || rid <= 0) return bad("Invalid id", 400);

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  try {
    // 1) Try Booking
    const { data: b, error: bErr } = await supa
      .from("booking")
      .select("id, status")
      .eq("id", rid)
      .maybeSingle(); // ← don't auto-404

    if (bErr) throw bErr;

    if (b?.id) {
      if (!force && String(b.status).toLowerCase() !== "cancelled") {
        return bad(
          "Only cancelled bookings can be deleted. Cancel first or pass ?force=1.",
          409,
        );
      }

      const { error: delErr } = await supa
        .from("booking")
        .delete()
        .eq("id", rid)
        .single();
      if (delErr) throw delErr;

      return ok({ id: rid, deleted: true, source: "booking" });
    }

    // 2) Try BookingDraft (allow delete regardless of status)
    const { data: d, error: dErr } = await supa
      .from("BookingDraft")
      .select("id")
      .eq("id", rid)
      .maybeSingle();

    if (dErr) throw dErr;

    if (d?.id) {
      const { error: delDErr } = await supa
        .from("BookingDraft")
        .delete()
        .eq("id", rid)
        .single();
      if (delDErr) throw delDErr;

      return ok({ id: rid, deleted: true, source: "draft" });
    }

    // 3) Not found anywhere
    return bad("Not found", 404);
  } catch (e) {
    console.error(`/api/admin/reservations/${rid} DELETE error`, e);
    return bad(e?.message || "Failed to delete booking", 500);
  }
}

/* ---------------------------- helpers ---------------------------- */
function isNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}
function pickFirstNumber(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (isNum(v)) return v;
  }
  return null;
}
function cleanEmpty(v) {
  if (v == null) return null;
  if (typeof v !== "object") return v;
  const out = {};
  let any = false;
  for (const k of Object.keys(v)) {
    const val = v[k];
    if (val == null) continue;
    if (typeof val === "string" && val.trim() === "") continue;
    out[k] = val;
    any = true;
  }
  return any ? out : null;
}
function deriveCode(row) {
  const cands = [
    row?.code,
    row?.reference,
    row?.bookingCode,
    row?.shortCode,
    row?.refCode,
    row?.ref,
  ].filter(Boolean);
  if (cands.length) return String(cands[0]);
  if (row?.id) return `B-${String(row.id).padStart(6, "0")}`;
  return null;
}
function parseJSON(v, fallback = null) {
  if (v == null) return fallback;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

/** Parse promo hints from freeform notes (legacy) */
function parsePromoFromNotes(notes) {
  if (!notes) return null;
  const s = String(notes);

  const code =
    s.match(/\bcode\s*=\s*([A-Z0-9_-]+)/i)?.[1] ||
    s.match(/\bpromo(?:\s*code)?[:\s-]+([A-Z0-9_-]+)/i)?.[1] ||
    null;

  const type =
    s.match(/\btype\s*=\s*([a-z_]+)/i)?.[1] ||
    (/\bpercent/.test(s) ? "percent" : /\bamount/.test(s) ? "amount" : null);

  const valueStr =
    s.match(/\bvalue\s*=\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1] ||
    s.match(/\bdiscount\s*=\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1] ||
    null;

  const value = valueStr != null ? Number(valueStr) : null;
  const out = {};
  if (code) out.code = code;
  if (type) out.discountType = type;
  if (Number.isFinite(value)) {
    out.discountValue = value;
    if (/discount\s*=/.test(s)) out.discountAmount = value;
  }
  return Object.keys(out).length ? out : null;
}

/** Remove promo lines from notes so UI doesn't show raw code twice */
function stripPromoFromNotes(notes) {
  if (!notes) return notes;
  const s = String(notes);
  return (
    s
      // full “[PROMO] …” lines
      .replace(/^\s*\[PROMO\][^\n]*\n?/gim, "")
      // generic “Promo code …” lines
      .replace(/^\s*(promo(?:\s*code)?|discount)\b[^\n]*\n?/gim, "")
      .trim() || null
  );
}

/** Compute discount amount from promo json when explicit amount isn't stored */
function computeDiscountFromPromoJson(pj, unitPrices, counts) {
  if (!pj || typeof pj !== "object") return null;
  const type = pj.discountType || pj.type || null;
  const value = Number(pj.discountValue ?? pj.value);
  if (!type || !Number.isFinite(value)) return null;

  // base total from snapshot unit prices × counts
  const A = Number(counts?.adults || 0);
  const K = Number(counts?.kids || 0);
  const ua = Number(unitPrices?.adult || 0);
  const uk = Number(unitPrices?.kid || 0);
  const base = A * ua + K * uk;
  if (!Number.isFinite(base) || base <= 0) return null;

  if (String(type).includes("percent")) {
    return +(base * (value / 100)).toFixed(2);
  }
  if (String(type).includes("amount")) {
    return +Math.min(base, value).toFixed(2);
  }
  return null;
}

/** Extract promo bits from a DB row (Booking or BookingDraft) */
function extractPromoFromRow(row, unitPrices, counts) {
  try {
    const pj =
      parseJSON(row?.promoJson, null) ||
      parseJSON(row?.promo_json, null) ||
      null;

    // code: prefer explicit column, then json
    let code =
      (row?.appliedPromoCode && String(row.appliedPromoCode).trim()) ||
      (pj?.code && String(pj.code).trim()) ||
      null;

    // amounts
    let discountAmount = Number(row?.discountAmount);
    if (!Number.isFinite(discountAmount) || discountAmount <= 0) {
      const calc = computeDiscountFromPromoJson(pj, unitPrices, counts);
      if (Number.isFinite(calc)) discountAmount = calc;
    }
    if (!Number.isFinite(discountAmount)) discountAmount = 0;

    // metadata
    let discountType = pj?.discountType ?? pj?.type ?? null;
    let discountValue = Number(pj?.discountValue ?? pj?.value);
    if (!Number.isFinite(discountValue)) discountValue = null;

    // fallback parse from legacy notes
    if ((!code || (!discountAmount && discountValue == null)) && row?.notes) {
      const parsed = parsePromoFromNotes(row.notes);
      if (parsed) {
        if (!code && parsed.code) code = parsed.code;
        if (!discountType && parsed.discountType)
          discountType = parsed.discountType;
        if (discountValue == null && parsed.discountValue != null) {
          discountValue = parsed.discountValue;
        }
        if (
          (!discountAmount || discountAmount <= 0) &&
          parsed.discountAmount != null
        ) {
          discountAmount = parsed.discountAmount;
        }
      }
    }

    if (!code && !discountAmount && discountValue == null) return null;

    return { code: code || null, discountAmount, discountType, discountValue };
  } catch {
    return null;
  }
}

/** Build the normalized promo payload the UI expects */
function buildPromoPayload(extracted) {
  if (!extracted) {
    return {
      promo: null,
      appliedPromoCode: null,
      discountAmount: null,
      promoJson: null,
    };
  }
  const { code, discountAmount, discountType, discountValue } = extracted;

  const pj = cleanEmpty({
    code: code || null,
    discountType: discountType || null,
    type: discountType || null, // alias
    discountValue: Number.isFinite(discountValue) ? discountValue : null,
    value: Number.isFinite(discountValue) ? discountValue : null, // alias
  });

  return {
    promo: code || pj ? { code: code || null, json: pj || null } : null,
    appliedPromoCode: code || null,
    discountAmount: Number.isFinite(discountAmount) ? discountAmount : null,
    promoJson: pj || null,
  };
}
function extractPaymentMethodSummaryFromPI(pi) {
  const empty = { type: null, label: null, card: null };
  if (!pi || typeof pi !== "object") return empty;

  const charges = Array.isArray(pi?.charges?.data) ? pi.charges.data : [];
  const charge = charges[0] || null;

  // Stripe usually exposes details on the charge
  const pmd =
    charge?.payment_method_details ||
    (charge?.payment_method && charge.payment_method.card
      ? { type: "card", card: charge.payment_method.card }
      : null) ||
    pi?.payment_method_details ||
    null;

  if (!pmd) return empty;

  let type = pmd.type;
  if (!type) {
    if (pmd.card) type = "card";
    else {
      const keys = Object.keys(pmd).filter((k) => k !== "type");
      type = keys[0] || null;
    }
  }

  let card = null;
  if (type === "card") {
    const cardObj =
      pmd.card ||
      charge?.payment_method_details?.card ||
      charge?.payment_method?.card ||
      null;

    if (cardObj) {
      card = {
        brand: cardObj.brand || null,
        last4: cardObj.last4 || null,
        expMonth: cardObj.exp_month || null,
        expYear: cardObj.exp_year || null,
        country: cardObj.country || null,
        funding: cardObj.funding || null,
      };
    }
  }

  const labelParts = [];
  if (type === "card") {
    if (card?.brand) labelParts.push(card.brand.toUpperCase());
    if (card?.last4) labelParts.push(`•••• ${card.last4}`);
  } else if (type) {
    labelParts.push(type);
  }

  return {
    type,
    label: labelParts.join(" · ") || null,
    card,
  };
}
function extractPaymentMethodSummaryFromCharge(charge) {
  const empty = { type: null, label: null, card: null };
  if (!charge || typeof charge !== "object") return empty;

  const pmd = charge.payment_method_details || {};
  let type = pmd.type || null;

  // Handle card
  let card = null;
  if (pmd.card && typeof pmd.card === "object") {
    type = type || "card";
    const cardObj = pmd.card;
    card = {
      brand: cardObj.brand || null,
      last4: cardObj.last4 || null,
      expMonth: cardObj.exp_month || null,
      expYear: cardObj.exp_year || null,
      country: cardObj.country || null,
      funding: cardObj.funding || null,
    };
  }

  if (!type) {
    const keys = Object.keys(pmd).filter((k) => k !== "type");
    type = keys[0] || null;
  }

  const labelParts = [];
  if (type === "card" && card) {
    if (card.brand) labelParts.push(card.brand.toUpperCase());
    if (card.last4) labelParts.push(`•••• ${card.last4}`);
  } else if (type) {
    labelParts.push(type);
  }

  return {
    type,
    label: labelParts.join(" · ") || null,
    card,
  };
}
