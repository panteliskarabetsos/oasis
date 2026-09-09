// Folder: src/app/api/admin/shop/orders/[id]/resend/route.js
// Send one of the order emails again by hand — a customer lost it, an address
// was corrected, or an automation was switched off when it should have fired.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { AUTOMATIONS, notifyOrder } from "@/lib/shop/notify";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function POST(req, { params }) {
  const auth = await requireAdmin("eshop");
  if (!auth.ok) return auth.response;
  const admin = createSupabaseAdmin();
  const id = Number(params?.id);
  if (!Number.isFinite(id) || id <= 0) return bad("Invalid id");

  let body = {};
  try {
    body = (await req.json()) || {};
  } catch {
    // an empty body means the order confirmation
  }
  const kind = String(body.kind || "paid");
  if (!AUTOMATIONS[kind]) return bad("Unknown email");

  const result = await notifyOrder(admin, id, kind, {
    force: true, // a manual resend ignores both the switch and the "already sent" guard
    actorEmail: auth.user?.email,
    extra: body.extra && typeof body.extra === "object" ? body.extra : {},
  });

  if (!result.sent) {
    const reason =
      result.reason === "no-customer-email"
        ? "This order has no customer email address"
        : result.reason === "no-staff-address"
          ? "No staff address is set for order alerts"
          : result.error || "The email could not be sent";
    return bad(reason, 502);
  }
  return ok({ ok: true, to: result.to, kind });
}
