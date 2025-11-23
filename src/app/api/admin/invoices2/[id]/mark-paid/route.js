export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

const ok = (d, s = 200, headers = {}) =>
  new NextResponse(JSON.stringify(d), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
const bad = (m, s = 400) => ok({ error: m }, s);

async function requireAdmin() {
  const supa = await createSupabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return { error: true, response: bad("Unauthorized", 401) };
  const { data: row, error } = await supa
    .from("User")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (error || (row?.role ?? "user") !== "admin")
    return { error: true, response: bad("Forbidden", 403) };
  return { error: false };
}

export async function POST(req, ctx) {
  const gate = await requireAdmin();
  if (gate?.error) return gate.response;

  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) return bad("Invalid invoice id", 400);

  const body = await req.json().catch(() => ({}));
  const method = String(body?.method || "cash").toLowerCase(); // 'cash' | 'bank_transfer' | 'card' | 'gift_card' | 'voucher' | 'other'
  const reference = body?.reference ? String(body.reference) : null;
  const processedAtISO =
    body?.processed_at && new Date(body.processed_at).toISOString();

  const admin = createSupabaseAdmin();

  // Load invoice
  const { data: inv, error: e1 } = await admin
    .from("invoice")
    .select("id, status, currency, total, paid_at")
    .eq("id", id)
    .maybeSingle();
  if (e1) return bad(e1.message || "Failed to load invoice", 500);
  if (!inv) return bad("Invoice not found", 404);

  // Already paid?
  if ((inv.status || "").toLowerCase() === "paid" && inv.paid_at) {
    return ok({ message: "Invoice already marked as paid." });
  }

  // Fetch existing payments to compute outstanding
  const { data: pays, error: e2 } = await admin
    .from("payment")
    .select("amount")
    .eq("invoice_id", id);
  if (e2) return bad(e2.message || "Failed to load payments", 500);

  const paidSoFar = (pays || []).reduce(
    (s, p) => s + Number(p?.amount || 0),
    0
  );
  const total = Number(inv.total || 0);
  const outstanding = Math.max(0, total - paidSoFar);

  // If caller gives amount, clamp it to outstanding; else use outstanding
  let amount =
    typeof body?.amount === "number" ? Number(body.amount) : outstanding;
  if (!Number.isFinite(amount) || amount <= 0) {
    // no need to insert payment if nothing outstanding — just mark paid
    amount = 0;
  }

  // Insert payment if needed
  let paymentId = null;
  if (amount > 0) {
    const { data: payRow, error: e3 } = await admin
      .from("payment")
      .insert({
        invoice_id: id,
        method: [
          "card",
          "cash",
          "bank_transfer",
          "gift_card",
          "voucher",
          "other",
        ].includes(method)
          ? method
          : "other",
        amount,
        currency: (inv.currency || "EUR").toUpperCase(),
        reference: reference || null,
        processed_at: processedAtISO || new Date().toISOString(),
        notes: "Marked as paid via admin UI",
      })
      .select("id")
      .maybeSingle();
    if (e3) return bad(e3.message || "Failed to insert payment", 500);
    paymentId = payRow?.id ?? null;
  }

  // Update invoice status + paid_at + payment_method
  const { error: e4 } = await admin
    .from("invoice")
    .update({
      status: "paid",
      paid_at: processedAtISO || new Date().toISOString(),
      payment_method: method,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (e4) return bad(e4.message || "Failed to update invoice", 500);

  return ok({
    message: "Invoice marked as paid.",
    paymentId,
    invoiceId: id,
    status: "paid",
  });
}
