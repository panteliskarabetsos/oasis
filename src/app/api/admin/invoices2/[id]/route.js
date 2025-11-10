// src/app/api/admin/invoices2/route.js
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
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

async function requireAdmin() {
  const supa = await createSupabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return { error: true, response: bad("Unauthorized", 401) };
  const { data: row, error } = await supa
    .from("User") // ⬅ if you renamed to lowercase, change to .from("user")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (error || (row?.role ?? "user") !== "admin")
    return { error: true, response: bad("Forbidden", 403) };
  return { error: false };
}

const parseJSON = (v) => {
  if (!v) return null;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};

function toCanonicalItems(rows = []) {
  return rows.map((l) => ({
    description: String(l.description || ""),
    quantity: Number(l.quantity || 1),
    unit_price: Number(l.unit_price || 0),
    vat_rate: Number(l.vat_rate || 0),
    discount_percent: Number(l.discount_percent || 0),
    line_subtotal: Number(l.line_subtotal || 0),
    line_tax: Number(l.line_tax || 0),
    line_total: Number(l.line_total || 0),
  }));
}

function normalizeLines(rawLines = []) {
  return rawLines.map((l, i) => {
    const description =
      String(
        l?.description ??
          l?.desc ??
          l?.label ??
          l?.name ??
          l?.title ??
          l?.itemName ??
          l?.productName ??
          l?.product_name ??
          l?.item_name ??
          l?.price?.nickname ??
          l?.price?.product?.name ??
          l?.price?.id ??
          ""
      )
        .trim()
        .slice(0, 2000) || `Item ${i + 1}`;

    const quantity = Number(l?.quantity ?? l?.qty ?? 1) || 1;
    const unit_price =
      Number(
        l?.unit_price ??
          l?.unitPrice ??
          l?.unit ??
          l?.price ??
          l?.amount ??
          l?.unit_amount
      ) || 0;

    const vat_rate =
      Number(l?.vat_rate ?? l?.vatPercent ?? l?.vat_pct ?? l?.vat) || 0;

    const discount_percent = Number(l?.discount_percent ?? l?.discount) || 0;

    const unitAfterDiscount = unit_price * (1 - discount_percent / 100);
    const line_subtotal = r2(quantity * unitAfterDiscount);
    const line_tax = r2(line_subtotal * (vat_rate / 100));
    const line_total = r2(line_subtotal + line_tax);

    return {
      description,
      quantity,
      unit_price,
      vat_rate,
      discount_percent,
      line_subtotal,
      line_tax,
      line_total,
    };
  });
}

function summarize(lines = []) {
  return lines.reduce(
    (acc, l) => {
      acc.subtotal += Number(l.line_subtotal || 0);
      acc.tax += Number(l.line_tax || 0);
      acc.total += Number(l.line_total || 0);
      return acc;
    },
    { subtotal: 0, tax: 0, total: 0 }
  );
}

/* -------- POST (create) -------- */
export async function POST(req) {
  const gate = await requireAdmin();
  if (gate?.error) return gate.response;

  const admin = createSupabaseAdmin();

  const body = await req.json().catch(() => ({}));
  const invIn = body?.invoice || {};

  // Accept items from body.items, body.lines, body.info, or invoice.{items|info}
  const providedItems =
    (Array.isArray(body?.items) && body.items) ||
    (Array.isArray(body?.lines) && body.lines) ||
    (Array.isArray(body?.info) && body.info) ||
    (Array.isArray(invIn?.items) && invIn.items) ||
    (Array.isArray(invIn?.info) && invIn.info) ||
    [];

  if (!providedItems.length)
    return bad("No line items provided (expected items | lines | info).", 400);

  // Normalize + totals
  const norm = normalizeLines(providedItems);
  const totals = summarize(norm);

  // JSON normalization for buyer/seller
  const buyerObj = parseJSON(invIn.buyer) ?? invIn.buyer ?? {};
  const sellerObj = parseJSON(invIn.seller) ?? invIn.seller ?? {};

  // Series / number
  const series =
    (invIn.series ? String(invIn.series) : "A").trim().toUpperCase() || "A";
  const { data: nextNumber, error: numErr } = await admin.rpc(
    "next_invoice_number",
    { p_series: series }
  );
  if (numErr) return bad(numErr.message || "Failed to allocate number", 500);

  // Build insert row
  const row = {
    series,
    number: Number(nextNumber),
    status: invIn.status || "draft",
    currency: (invIn.currency || "EUR").toUpperCase(),
    issue_date: invIn.issue_date || new Date().toISOString(),
    due_date: invIn.due_date ?? null,
    seller: sellerObj,
    buyer: buyerObj,
    notes: invIn.notes ?? null,
    mark: invIn.mark ?? null,
    paid_at: invIn.paid_at ?? null,
    payment_method: invIn.payment_method ?? null,
    booking_id: invIn.booking_id ?? null,
    stripe_payment_intent_id:
      invIn.stripe_payment_int_id ?? invIn.stripe_payment_intent_id ?? null,
    stripe_invoice_id: invIn.stripe_invoice_id ?? null,

    // persist canonical items + totals on the invoice row too
    items: toCanonicalItems(norm),
    subtotal: r2(totals.subtotal),
    tax_total: r2(totals.tax),
    total: r2(totals.total),
  };

  // Insert invoice
  const { data: created, error: eInsInv } = await admin
    .from("invoice")
    .insert(row)
    .select("*")
    .maybeSingle();

  if (eInsInv || !created)
    return bad(eInsInv?.message || "Invoice insert failed", 500);

  // Insert lines (attach invoice_id); rollback invoice if this fails
  let linesSaved = 0;
  if (norm.length) {
    const lines = norm.map((l) => ({ ...l, invoice_id: created.id }));
    const { error: eInsLines, count } = await admin
      .from("invoice_line")
      .insert(lines)
      .select("id", { head: false, count: "exact" });

    if (eInsLines) {
      // keep db consistent if lines fail
      await admin.from("invoice").delete().eq("id", created.id);
      return bad(eInsLines.message || "Line insert failed", 500);
    }
    linesSaved = Number(count || lines.length);
  }

  // Response
  return ok(
    {
      id: created.id,
      number: created.number,
      series: created.series,
      status: created.status,
      totals: {
        subtotal: created.subtotal,
        tax_total: created.tax_total,
        total: created.total,
      },
      linesSaved,
    },
    201,
    { Location: `/api/admin/invoices2/${created.id}` }
  );
}

export async function DELETE(_req, ctx) {
  const gate = await requireAdmin();
  if (gate?.error) return gate.response;

  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) return bad("Invalid invoice id", 400);

  const admin = createSupabaseAdmin();

  // Load invoice and payments count
  const [{ data: inv, error: e1 }, { count: payCount, error: e2 }] =
    await Promise.all([
      admin.from("invoice").select("id, status").eq("id", id).maybeSingle(),
      admin
        .from("payment")
        .select("id", { count: "exact", head: true })
        .eq("invoice_id", id),
    ]);

  if (e1) return bad(e1.message || "Failed to load invoice", 500);
  if (!inv) return bad("Invoice not found", 404);
  if (e2) return bad(e2.message || "Failed to check payments", 500);

  const status = String(inv.status || "").toLowerCase();

  // Only allow hard delete for 'draft' or 'void' with NO payments
  if (!["draft", "void"].includes(status))
    return bad("Only draft or void invoices can be deleted.", 409);
  if (payCount && payCount > 0)
    return bad("Cannot delete invoice that has payments.", 409);

  // Delete child lines, then invoice
  const { error: delLinesErr } = await admin
    .from("invoice_line")
    .delete()
    .eq("invoice_id", id);
  if (delLinesErr)
    return bad(delLinesErr.message || "Failed to delete lines", 500);

  const { error: delInvErr } = await admin
    .from("invoice")
    .delete()
    .eq("id", id);
  if (delInvErr)
    return bad(delInvErr.message || "Failed to delete invoice", 500);

  return ok({ message: "Invoice deleted.", invoiceId: id });
}
