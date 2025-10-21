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

    const codeUpper = codeRaw.toUpperCase();

    // Try DiscountCode first, then Voucher
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

    let src = null;
    let row = await fetchOne("DiscountCode");
    if (row) src = "discount";
    if (!row) {
      row = await fetchOne("Voucher");
      if (row) src = "voucher";
    }

    if (!row || !src) return err(404, "Invalid code.");

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

    const max = row.maxRedemptions == null ? null : Number(row.maxRedemptions);
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
      // If you also want to enforce assignedToUserId, you can load draft.userId and compare here.
    }

    // Normalize output
    const discountType = String(row.discountType || "percent").toLowerCase(); // 'percent' | 'amount'
    const discountValueRaw = Number(row.discountValue ?? 0);
    const currency = (row.currency || draft?.currency || "EUR").toUpperCase();

    const normalizedValue =
      discountType === "percent"
        ? Math.min(Math.max(discountValueRaw, 0), 100)
        : Math.max(discountValueRaw, 0);

    const remaining = max == null ? null : Math.max(max - used, 0);

    return ok({
      code: codeUpper,
      source: src, // 'discount' | 'voucher'
      discountType,
      discountValue: normalizedValue,
      currency,
      startsAt: startsAt ? startsAt.toISOString() : null,
      endsAt: endsAt ? endsAt.toISOString() : null,
      maxRedemptions: max,
      redemptionCount: used,
      remaining,
      // Optional echoes for the client to decide UI
      assignedToEmail: src === "voucher" ? row.assignedToEmail || null : null,
    });
  } catch (e) {
    console.error("[validate] error", e);
    return err(500, "Unexpected error validating code.");
  }
}
