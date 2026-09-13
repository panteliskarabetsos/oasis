export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import {
  ACCESS_DENIED,
  authorizeBookingAccess,
} from "@/lib/bookings/bookingAccess";
import { issuePortalToken } from "@/lib/bookings/portalToken";

/**
 * GET /api/bookings/[id]/ticket-token
 *
 * A short-lived token for the ticket PDF and wallet passes.
 *
 * Those are opened as plain URLs — an external browser from the app, a new tab
 * for printing — where the caller's session cookie does not travel. A client
 * that can prove itself here (signed in, or already holding a portal token)
 * trades that proof for one that survives the trip into a URL.
 */
export async function GET(req, ctx) {
  const { id } = await ctx.params;
  const bookingId = Number(Array.isArray(id) ? id[0] : id);
  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
  }

  const access = await authorizeBookingAccess(req, bookingId);
  if (!access.ok) {
    return NextResponse.json({ error: ACCESS_DENIED }, { status: 401 });
  }

  return NextResponse.json({ token: issuePortalToken(bookingId) });
}
