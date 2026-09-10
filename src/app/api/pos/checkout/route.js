// src/app/api/pos/checkout/route.js
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { recordPosSale } from "@/lib/pos/recordSale";

/**
 * Take a sale at the till.
 *
 * The recording itself lives in @/lib/pos/recordSale so the Stripe webhook can
 * settle a QR payment through the identical path.
 */
export async function POST(req) {
  const auth = await requireAdmin("pos");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const result = await recordPosSale(body, { permissions: auth.permissions });
  return NextResponse.json(result.body, { status: result.status });
}
