// src/app/api/cleanupDrafts/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

function assertAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    const err = new Error("unauthorized");
    err.statusCode = 401;
    throw err;
  }
}

export async function GET(req) {
  try {
    assertAuthorized(req);
    const admin = createSupabaseAdmin();
    if (!admin)
      return NextResponse.json(
        { ok: false, error: "Server not configured" },
        { status: 500 }
      );

    const { searchParams } = new URL(req.url);
    const qpSlot = searchParams.get("scheduleSlotId");
    const run = searchParams.get("run") === "1";
    const scheduleSlotId = Number.isFinite(Number(qpSlot))
      ? Number(qpSlot)
      : null;

    if (!run) {
      const { data: count, error } = await admin.rpc("count_expired_drafts", {
        p_schedule_slot_id: scheduleSlotId,
        p_include_null_exp: true,
      });
      if (error) throw error;
      return NextResponse.json({
        ok: true,
        dryRun: true,
        expired: count || 0,
        nullExp: 0,
        total: count || 0,
      });
    }

    const { data: deleted, error } = await admin.rpc("cleanup_expired_drafts", {
      p_schedule_slot_id: scheduleSlotId,
      p_include_null_exp: true,
    });
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      deletedExpired: deleted || 0,
      deletedNull: null,
      totalDeleted: deleted || 0,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || "unknown error" },
      { status: e?.statusCode || 500 }
    );
  }
}

export async function POST(req) {
  try {
    assertAuthorized(req);
    const admin = createSupabaseAdmin();
    if (!admin)
      return NextResponse.json(
        { ok: false, error: "Server not configured" },
        { status: 500 }
      );

    const { searchParams } = new URL(req.url);
    const qpSlot = searchParams.get("scheduleSlotId");
    const body = await req.json().catch(() => ({}));
    const maybeSlotId = Number(qpSlot ?? body?.scheduleSlotId);
    const scheduleSlotId = Number.isFinite(maybeSlotId) ? maybeSlotId : null;

    const { data: deleted, error } = await admin.rpc("cleanup_expired_drafts", {
      p_schedule_slot_id: scheduleSlotId,
      p_include_null_exp: true,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true, totalDeleted: deleted || 0 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || "unknown error" },
      { status: e?.statusCode || 500 }
    );
  }
}
