// src/app/api/admin/giftcards/[id]/redemptions/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

function clampInt(v, { min = 0, max = 1000, def = 0 } = {}) {
  const n = Number.parseInt(v ?? "", 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export async function GET(req, ctx) {
  // Auth gate
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!id) return bad("Missing gift card id", 422);

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  // pagination & sort
  const url = new URL(req.url);
  const limit = clampInt(url.searchParams.get("limit"), {
    min: 1,
    max: 200,
    def: 50,
  });
  const offset = clampInt(url.searchParams.get("offset"), {
    min: 0,
    max: 1000000,
    def: 0,
  });
  const order = (url.searchParams.get("order") || "desc").toLowerCase(); // 'asc' | 'desc'
  const ascending = order === "asc";

  // Ensure card exists (return 404 if not)
  {
    const { data: card, error: cardErr } = await admin
      .from("GiftCard")
      .select("id")
      .eq("id", id)
      .single();

    if (cardErr) {
      // not found
      if (cardErr.code === "PGRST116" || cardErr.code === "PGRST103") {
        return bad("Gift card not found", 404);
      }
      return bad(cardErr.message || "Database error", 500);
    }
  }

  // Fetch redemptions
  const { data: rows, error } = await admin
    .from("GiftCardRedemption")
    .select(
      "id, gift_card_id, amount_cents, currency, booking_id, notes, created_at"
    )
    .eq("gift_card_id", id)
    .order("created_at", { ascending })
    .range(offset, offset + limit - 1);

  if (error) {
    return bad(error.message || "Database error", 500);
  }

  return ok({
    items: rows ?? [],
    limit,
    offset,
    order: ascending ? "asc" : "desc",
    count: rows?.length ?? 0,
  });
}
