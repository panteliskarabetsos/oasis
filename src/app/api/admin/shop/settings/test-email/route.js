// src/app/api/admin/shop/settings/test-email/route.js
// Send one of the shop's emails to yourself, filled with a worked example.
// Lets staff check the wording and prove SMTP works without placing an order.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import sendShopOrderEmail from "@/lib/email/sendShopOrderEmail";
import { AUTOMATIONS, getEmailSettings } from "@/lib/shop/notify";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A believable order so the template shows real spacing and totals. */
function sampleOrder(to) {
  return {
    order: {
      id: 0,
      status: "paid",
      currency: "EUR",
      total_cents: 4548,
      shipping_cents: 350,
      shipping_method: "courier",
      refunded_cents: 0,
      placed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      tracking_number: "EL123456789GR",
      tracking_url: "https://www.acscourier.net/en/track-and-trace",
      billing_address: { name: "Maria Papadaki", email: to, phone: "+30 691 234 5678" },
      shipping_address: {
        name: "Maria Papadaki",
        line1: "12 Odos Chalidon",
        city: "Chania",
        postalCode: "73100",
        country: "Greece",
        notes: "Second floor, ring twice.",
      },
    },
    items: [
      {
        id: 1,
        quantity: 2,
        unit_price_cents: 1999,
        currency: "EUR",
        title_snapshot: "Oasis Olive Oil 500ml",
      },
      {
        id: 2,
        quantity: 1,
        unit_price_cents: 200,
        currency: "EUR",
        title_snapshot: "Linen Apron — M",
      },
    ],
  };
}

export async function POST(req) {
  const auth = await requireAdmin("eshop");
  if (!auth.ok) return auth.response;

  let body = {};
  try {
    body = (await req.json()) || {};
  } catch {
    // defaults below
  }

  const kind = String(body.kind || "paid");
  if (!AUTOMATIONS[kind]) return bad("Unknown email");

  const admin = createSupabaseAdmin();
  const settings = await getEmailSettings(admin);
  const to = String(body.to || auth.user?.email || settings.staffTo || "").trim();
  if (!EMAIL_RE.test(to)) {
    return bad("No address to send the test to — set one on your staff account or type one here");
  }

  const { order, items } = sampleOrder(to);
  const result = await sendShopOrderEmail({
    kind,
    order,
    items,
    to,
    extra: { amountCents: 1999, refundedCents: 1999, trackingNumber: order.tracking_number },
  });

  if (!result.sent) return bad(result.error || "The test could not be sent", 502);
  return ok({ ok: true, to, kind, subject: result.subject });
}
