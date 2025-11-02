export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (json, s = 200) =>
  new NextResponse(JSON.stringify(json), {
    status: s,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

const err = (s, message, extra = {}) => ok({ error: message, ...extra }, s);

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const codeRaw = (url.searchParams.get("code") || "").trim();
    const draftId = url.searchParams.get("draftId"); // optional

    if (!codeRaw) return err(400, "Missing `code` parameter.");

    const admin = createSupabaseAdmin?.();
    if (!admin) return err(500, "Server not configured.");

    // Optional: load draft context (email/currency/experience/etc.)
    let draft = null;
    if (draftId) {
      const { data } = await admin
        .from("BookingDraft")
        .select("id, primary_contact, currency, experienceId, totalAmount")
        .eq("id", Number(draftId))
        .maybeSingle();
      draft = data || null;
    }

    const draftEmail =
      draft?.primary_contact?.email &&
      String(draft.primary_contact.email).trim().toLowerCase();
    const draftCurrency = (draft?.currency || "eur").toUpperCase();
    const draftTotalCents = Number.isFinite(Number(draft?.totalAmount))
      ? Math.round(Number(draft.totalAmount) * 100)
      : null;

    const codeUpper = codeRaw.toUpperCase();

    // Helper: fetch discount/voucher
    const fetchOne = async (table) => {
      const { data, error } = await admin
        .from(table)
        .select(
          table === "DiscountCode"
            ? "id, code, discountType, discountValue, currency, active, startsAt, endsAt, maxRedemptions, redemptionCount"
            : "id, code, discountType, discountValue, currency, active, startsAt, endsAt, maxRedemptions, redemptionCount, assignedToEmail, assignedToUserId"
        )
        .ilike("code", codeUpper)
        .maybeSingle();
      if (error) return null;
      return data || null;
    };

    /* ---------- Path A: DiscountCode / Voucher ---------- */
    let src = null;
    let row = await fetchOne("DiscountCode");
    if (row) src = "discount";
    if (!row) {
      row = await fetchOne("Voucher");
      if (row) src = "voucher";
    }

    if (row && src) {
      // Validations
      const now = new Date();
      const active = row.active !== false;
      const startsAt = row.startsAt ? new Date(row.startsAt) : null;
      const endsAt = row.endsAt ? new Date(row.endsAt) : null;

      if (!active)
        return err(403, "This code is inactive.", {
          code: codeUpper,
          source: src,
        });

      if (startsAt && startsAt > now) {
        return err(403, "This code is not active yet.", {
          code: codeUpper,
          source: src,
          startsAt: startsAt.toISOString(),
        });
      }
      if (endsAt && endsAt < now) {
        return err(410, "This code has expired.", {
          code: codeUpper,
          source: src,
          endsAt: endsAt.toISOString(),
        });
      }

      const max =
        row.maxRedemptions == null ? null : Number(row.maxRedemptions);
      const used = Number(row.redemptionCount || 0);
      if (max != null && used >= max) {
        return err(409, "This code has reached its maximum redemptions.", {
          code: codeUpper,
          source: src,
          redemptionCount: used,
          maxRedemptions: max,
        });
      }

      // Voucher assignment enforcement
      if (src === "voucher") {
        const assignedEmail = row.assignedToEmail
          ? String(row.assignedToEmail).trim().toLowerCase()
          : null;
        if (assignedEmail && draftEmail && assignedEmail !== draftEmail) {
          return err(403, "This voucher is assigned to a different email.", {
            code: codeUpper,
            source: src,
            assignedToEmail: row.assignedToEmail,
          });
        }
      }

      // Normalize output
      const discountType = String(row.discountType || "percent").toLowerCase(); // 'percent' | 'amount'
      const discountValueRaw = Number(row.discountValue ?? 0);
      const currency = (row.currency || draftCurrency || "EUR").toUpperCase();

      const normalizedValue =
        discountType === "percent"
          ? Math.min(Math.max(discountValueRaw, 0), 100)
          : Math.max(discountValueRaw, 0);

      const remaining = max == null ? null : Math.max(max - used, 0);

      return ok({
        code: codeUpper,
        source: src, // 'discount' | 'voucher'
        discountType,
        discountValue: normalizedValue, // currency units if 'amount'
        currency,
        startsAt: startsAt ? startsAt.toISOString() : null,
        endsAt: endsAt ? endsAt.toISOString() : null,
        maxRedemptions: max,
        redemptionCount: used,
        remaining,
        assignedToEmail: src === "voucher" ? row.assignedToEmail || null : null,
      });
    }

    /* ---------- Path B: GiftCard ---------- */
    // Not found as discount/voucher — try a GiftCard code
    const { data: gc, error: gcErr } = await admin
      .from("GiftCard")
      .select(
        "id, code, currency, status, expires_at, remaining_amount_cents, initial_amount_cents"
      )
      .ilike("code", codeUpper)
      .maybeSingle();

    if (gcErr) {
      // if DB says "not found", fall through as invalid code
      if (gcErr.code !== "PGRST116" && gcErr.code !== "PGRST103") {
        return err(500, gcErr.message || "Database error.");
      }
    }

    if (!gc) {
      // nothing matched at all
      return err(404, "Invalid code.");
    }

    // Validate gift card
    const now = new Date();
    if (gc.status !== "active") {
      return err(403, "Gift card is not active.", {
        code: codeUpper,
        source: "giftcard",
      });
    }
    if (gc.expires_at && new Date(gc.expires_at) < now) {
      return err(410, "Gift card has expired.", {
        code: codeUpper,
        source: "giftcard",
        endsAt: new Date(gc.expires_at).toISOString(),
      });
    }
    const remainingCents = Math.max(Number(gc.remaining_amount_cents || 0), 0);
    if (remainingCents <= 0) {
      return err(409, "Gift card has no remaining balance.", {
        code: codeUpper,
        source: "giftcard",
      });
    }

    const cardCurrency = (gc.currency || "EUR").toUpperCase();
    if (draft && draftCurrency && cardCurrency !== draftCurrency) {
      return err(409, "Gift card currency does not match booking currency.", {
        code: codeUpper,
        source: "giftcard",
        cardCurrency,
        draftCurrency,
      });
    }

    // How much can we apply right now (depends on draft total if we have it)
    const applyAmountCents =
      draftTotalCents == null
        ? 0
        : Math.max(0, Math.min(remainingCents, draftTotalCents));

    // For compatibility with existing client code, we also surface
    // discountType='amount' + discountValue in currency units.
    return ok({
      code: codeUpper,
      source: "giftcard",
      currency: cardCurrency,
      // Compatibility fields:
      discountType: "amount",
      discountValue: applyAmountCents / 100, // currency units the UI may subtract
      // Gift card details:
      giftcard: {
        id: gc.id,
        remainingAmountCents: remainingCents,
        initialAmountCents: Number(gc.initial_amount_cents || 0),
        expiresAt: gc.expires_at ? new Date(gc.expires_at).toISOString() : null,
        status: gc.status,
        // echo what we computed relative to this draft (if any)
        applyAmountCents,
      },
    });
  } catch (e) {
    console.error("[promotions/validate] error", e);
    return err(500, "Unexpected error validating code.");
  }
}
