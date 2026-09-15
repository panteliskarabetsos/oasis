// src/app/api/bookings/drafts/[id]/extend/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  HOLD_MINUTES,
  MAX_HOLD_MINUTES,
  draftPartySize,
  parseDbTime,
  remainingForSlot,
} from "@/lib/bookings/slotCapacity";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400, extra = {}) =>
  NextResponse.json({ error: m, ...extra }, { status: s });

/**
 * Renew the hold on a checkout in progress.
 *
 * The payment page has called this on every load since it was written, and
 * the route did not exist — a 404, which fetch does not throw on, inside a
 * try/catch that therefore never fired. So nothing extended anything and
 * nothing said so: a guest arriving at the payment page got whatever was
 * left of the original fifteen minutes and no more.
 *
 * What it will not do:
 *
 *  - Revive an expired hold. Once it lapses the places go back on sale and
 *    someone else may have taken them; quietly re-holding is how a slot ends
 *    up oversold.
 *  - Take the duration from the caller. The page asks for ten minutes, but a
 *    request is a request — the server decides, or a hand-made one holds a
 *    seat for a year.
 *  - Extend forever. Each renewal is capped against the draft's creation, so
 *    reloading the page in a loop cannot sit on a place indefinitely.
 */
export async function POST(req, ctx) {
  const { id } = await ctx.params;
  const draftId = Number(id);
  if (!Number.isFinite(draftId) || draftId <= 0) return bad("Invalid id");

  const url = new URL(req.url);
  const token = (url.searchParams.get("token") || "").trim();
  if (!token) return bad("Unauthorized: Missing access token", 401);

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const { data: draft, error: dErr } = await admin
    .from("BookingDraft")
    .select(
      'id, status, counts, "expiresAt", "createdAt", "scheduleSlotId", "convertedBookingId"',
    )
    .eq("id", draftId)
    .eq("clientToken", token)
    .maybeSingle();

  // Same answer for "no such draft" and "wrong token", so this cannot be used
  // to find out which draft ids exist.
  if (dErr || !draft) return bad("Draft not found or unauthorized", 404);

  const status = String(draft.status || "").toLowerCase();
  if (draft.convertedBookingId || status === "converted") {
    return bad("This booking is already confirmed.", 409, {
      reason: "converted",
    });
  }
  if (status === "paid") {
    // Paid but not yet converted holds its places regardless of the clock.
    return ok({
      extended: false,
      reason: "paid",
      expiresAt: draft.expiresAt ?? null,
    });
  }

  const nowMs = Date.now();
  const expMs = parseDbTime(draft.expiresAt);
  if (Number.isFinite(expMs) && expMs <= nowMs) {
    return bad("This hold has expired. Please choose a time again.", 409, {
      reason: "expired",
      expiresAt: draft.expiresAt,
    });
  }

  // The places have to still be there. Another guest may have taken the last
  // one while this checkout sat open, and renewing without looking would
  // promise a seat twice.
  const party = draftPartySize(draft);
  if (draft.scheduleSlotId) {
    const cap = await remainingForSlot(admin, draft.scheduleSlotId, {
      excludeDraftId: draft.id,
      nowMs,
    });
    if (!cap.ok) return bad(cap.error, 409, { reason: "slot" });
    if (party > cap.remaining) {
      return bad(
        `Only ${Math.max(cap.remaining, 0)} place${cap.remaining === 1 ? "" : "s"} left for this time.`,
        409,
        { reason: "capacity", remaining: Math.max(cap.remaining, 0) },
      );
    }
  }

  const createdMs = parseDbTime(draft.createdAt);
  const ceilingMs =
    (Number.isFinite(createdMs) ? createdMs : nowMs) +
    MAX_HOLD_MINUTES * 60 * 1000;
  const wantedMs = nowMs + HOLD_MINUTES * 60 * 1000;
  const newExpiryMs = Math.min(wantedMs, ceilingMs);

  // Never shorten a hold: at the ceiling the guest keeps what is left rather
  // than having time taken away by asking for more.
  if (Number.isFinite(expMs) && newExpiryMs <= expMs) {
    return ok({
      extended: false,
      reason: "at-maximum",
      expiresAt: draft.expiresAt,
      maxHoldMinutes: MAX_HOLD_MINUTES,
    });
  }

  const expiresAt = new Date(newExpiryMs).toISOString();
  const { error: upErr } = await admin
    .from("BookingDraft")
    .update({ expiresAt, updatedAt: new Date(nowMs).toISOString() })
    .eq("id", draft.id)
    .eq("clientToken", token);

  if (upErr) {
    console.error("[extend] update error", upErr);
    return bad("Could not extend the hold", 500);
  }

  return ok({ extended: true, expiresAt, maxHoldMinutes: MAX_HOLD_MINUTES });
}
