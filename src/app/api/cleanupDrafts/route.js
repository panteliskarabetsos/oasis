// src/app/api/cleanupDrafts/route.js
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ok = (data, status = 200) => NextResponse.json(data, { status });
const bad = (msg, status = 400) =>
  NextResponse.json({ error: msg }, { status });

export async function POST(req) {
  const supa = createSupabaseAdmin();
  if (!supa) return bad("Server not configured", 500);

  try {
    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1";

    // Use JS Date in UTC – this is fine for timestamptz
    const now = new Date();
    const nowIso = now.toISOString();

    // 1) Find ALL expired drafts (any status) where expiresAt < now
    const {
      data: candidates,
      error: selErr,
      count,
    } = await supa
      .from("BookingDraft")
      .select("id, status, expiresAt, convertedBookingId", {
        count: "exact",
      })
      .not("expiresAt", "is", null)
      .lt("expiresAt", nowIso);

    if (selErr) throw selErr;

    let deleted = 0;

    if (candidates && candidates.length) {
      const ids = candidates.map((r) => r.id);

      const { error: delErr, count: delCount } = await supa
        .from("BookingDraft")
        .delete({ count: "exact" })
        .in("id", ids);

      if (delErr) throw delErr;
      deleted = delCount ?? ids.length;
    }

    console.log("[cleanupDrafts] expired candidates count:", count || 0);
    console.log("[cleanupDrafts] deleted expired drafts:", deleted);

    return ok(
      {
        at: nowIso,
        foundExpired: count || 0,
        deleted,
        ...(debug && { candidates }), // helpful when calling ?debug=1
      },
      200
    );
  } catch (e) {
    console.error("/api/cleanupDrafts POST error", e);
    return bad(e?.message || "Failed to cleanup drafts", 500);
  }
}
