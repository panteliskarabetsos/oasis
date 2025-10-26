// src/app/api/admin/invoices/[id]/mark-paid/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServer } from "@/lib/supabase/server";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
});

async function requireAdmin() {
  const supa = await createSupabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return { error: true, response: bad("Unauthorized", 401) };

  const { data: row } = await supa
    .from("User")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if ((row?.role ?? "user") !== "admin")
    return { error: true, response: bad("Forbidden", 403) };

  return { error: false };
}

/**
 * POST /api/admin/invoices/:id/mark-paid
 * Body (optional): { note?: string }  // stored as invoice metadata.note
 * Marks a finalized open invoice as paid out-of-band (cash/bank transfer).
 */
export async function POST(req, ctx) {
  const gate = await requireAdmin();
  if (gate.error) return gate.response;

  if (!process.env.STRIPE_SECRET_KEY)
    return bad("Stripe is not configured", 500);

  try {
    const { id } = await ctx.params;
    if (!id) return bad("Missing invoice id");

    const { note } = (await req.json().catch(() => ({}))) || {};

    // Optional: persist a small note for audit
    if (note) {
      await stripe.invoices.update(id, {
        metadata: { note: String(note).slice(0, 500) },
      });
    }

    // Record an offline payment
    const paid = await stripe.invoices.pay(id, { paid_out_of_band: true });

    return ok({
      id: paid.id,
      number: paid.number,
      status: paid.status, // should be "paid"
      hosted_invoice_url: paid.hosted_invoice_url,
      invoice_pdf: paid.invoice_pdf,
    });
  } catch (e) {
    // Common causes: invoice not finalized/open, already paid/void/uncollectible
    return bad(e?.message || "Failed to mark invoice as paid", 400);
  }
}
