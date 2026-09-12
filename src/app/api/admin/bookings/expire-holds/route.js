export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { expireStaleHolds } from "@/lib/bookings/holds";

/**
 * Release seats held by unpaid bookings whose window has closed.
 *
 * The sweep also runs on every admin bookings read, so holds always lapse
 * eventually. Point a scheduler here (hourly is plenty) to make it prompt
 * instead, which matters when a lapsed hold is the only thing keeping a slot
 * from being sold.
 *
 * Authenticated as staff: it changes booking statuses. A cron should call it
 * with a staff session, or CRON_SECRET as a bearer token.
 */
export async function POST(req) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization") || "";
  const viaSecret = Boolean(secret) && bearer === `Bearer ${secret}`;

  let admin;
  if (viaSecret) {
    const { createSupabaseAdmin } = await import("@/lib/supabase/admin");
    admin = createSupabaseAdmin();
  } else {
    const auth = await requireAdmin("bookings");
    if (!auth.ok) return auth.response;
    admin = auth.admin;
  }

  const result = await expireStaleHolds(admin);
  return NextResponse.json({ ok: true, ...result, via: viaSecret ? "cron" : "staff" });
}
