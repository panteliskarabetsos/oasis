// src/app/api/admin/invoices2/[id]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
// add near the top with your other imports:
import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

const asArr = (x) => (Array.isArray(x) ? x : []);
const moneyFromCharge = (ch) => {
  const cents =
    typeof ch.amount_captured === "number" && ch.amount_captured > 0
      ? ch.amount_captured
      : ch.amount;
  return Number(cents || 0) / 100;
};
const UC = (s, d = "") => String(s ?? d).toUpperCase();

/* -------- GET (single by id) -------- */
export async function GET(req, ctx) {
  const gate = await requireAdmin();
  if (gate?.error) return gate.response;

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) return bad("Invalid invoice id", 400);

  // params
  const url = new URL(req.url);
  const sp = url.searchParams;
  const expand = (sp.get("expand") || "none").toLowerCase(); // none|lines|payments|all
  const includeStripeParam = (sp.get("includeStripe") || "").toLowerCase();
  const includeStripe = includeStripeParam
    ? ["1", "true", "yes"].includes(includeStripeParam)
    : expand === "payments" || expand === "all";

  // base columns from the view
  const cols = [
    "id",
    "series",
    "number",
    "invoice_no",
    "status",
    "currency",
    "issue_date",
    "due_date",
    "buyer",
    "seller",
    "notes",
    "subtotal",
    "tax_total",
    "total",
    "taxes",
    "mark",
    "paid_at",
    "payment_method",
    "booking_id",
    "pdf_path",
    "stripe_payment_intent_id",
    "stripe_invoice_id",
    "created_at",
    "updated_at",
    "startTime",
    "guests",
    "amount_paid",
    "balance",
    "paid",
    "overdue",
    "buyer_name",
    "buyer_business_name",
    "buyer_email",
    "buyer_phone",
    "buyer_vat",
  ].join(", ");

  const { data: row, error: e0 } = await admin
    .from("admin_invoice_money")
    .select(cols)
    .eq("id", id)
    .maybeSingle();

  if (e0) return bad(e0.message || "Failed to load invoice", 500);
  if (!row) return bad("Invoice not found", 404);

  /* --- optional expansions (DB) --- */
  let lines = [];
  if (expand === "lines" || expand === "all") {
    const { data: lineRows, error: le } = await admin
      .from("invoice_line")
      .select(
        "id, invoice_id, description, quantity, unit_price, vat_rate, discount_percent, line_subtotal, line_tax, line_total"
      )
      .eq("invoice_id", id)
      .order("id");
    if (le) return bad(le.message || "Failed to load lines", 500);
    lines = lineRows || [];
  }

  let payments = [];
  if (expand === "payments" || expand === "all") {
    const { data: pays, error: pe } = await admin
      .from("payment")
      .select(
        "id, invoice_id, booking_id, method, amount, currency, reference, processed_at, notes"
      )
      .eq("invoice_id", id)
      .order("processed_at", { ascending: true });
    if (pe) return bad(pe.message || "Failed to load payments", 500);
    payments = pays || [];
  }

  /* --- Stripe enrichment (optional) --- */
  let stripePayments = [];
  if (
    stripe &&
    (expand === "payments" || expand === "all") &&
    includeStripe &&
    (row.stripe_payment_intent_id || row.stripe_invoice_id)
  ) {
    const piId = row.stripe_payment_intent_id;
    const siId = row.stripe_invoice_id;
    let stripePaid = 0;

    // PaymentIntent charges
    if (piId) {
      try {
        const pi = await stripe.paymentIntents.retrieve(piId, {
          expand: ["charges.data"],
        });
        const charges = asArr(pi?.charges?.data);
        for (const ch of charges) {
          if (ch?.status === "succeeded" && ch?.paid) {
            const amt = moneyFromCharge(ch);
            stripePayments.push({
              source: "stripe",
              method: ch.payment_method_details?.type || "card",
              reference: ch.id,
              amount: amt,
              currency: UC(ch.currency || ""),
              processed_at: new Date(
                (ch.created || pi.created) * 1000
              ).toISOString(),
              notes: "Stripe charge",
            });
            stripePaid += amt;
          }
        }
      } catch {
        /* ignore */
      }
    }

    // Stripe Invoice fallback
    if (siId && stripePaid === 0) {
      try {
        const si = await stripe.invoices.retrieve(siId, {
          expand: ["payment_intent", "charge"],
        });
        if (si?.amount_paid > 0) {
          const amt = Number(si.amount_paid) / 100;
          stripePayments.push({
            source: "stripe",
            method: "invoice",
            reference: si.id,
            amount: amt,
            currency: UC(si.currency || ""),
            processed_at: new Date(
              (si.status_transitions?.paid_at || si.created) * 1000
            ).toISOString(),
            notes: "Stripe invoice",
          });
        }
      } catch {
        /* ignore */
      }
    }
  }

  // Merge payments & recompute money
  const EPS = 0.005;
  const mergedPayments = (() => {
    if (!payments.length && !stripePayments.length) return [];
    const seen = new Set(payments.map((p) => p.reference).filter(Boolean));
    const all = payments.concat(
      stripePayments.filter((p) =>
        p.reference ? !seen.has(p.reference) : true
      )
    );
    all.sort((a, b) =>
      String(a.processed_at || "").localeCompare(String(b.processed_at || ""))
    );
    return all;
  })();

  const amount = Number(row.total || 0);
  const alreadyPaid = Number(row.amount_paid || 0);
  const stripeExtra = stripePayments.reduce(
    (s, p) => s + (Number(p.amount) || 0),
    0
  );
  const amountPaid = alreadyPaid + stripeExtra;
  const balanceRaw = amount - amountPaid;
  const balance = balanceRaw > EPS ? balanceRaw : 0;
  const paidByStatus = String(row.status || "").toLowerCase() === "paid";
  const paidByTs = Boolean(row.paid_at);
  const paid = row.paid === true || paidByStatus || paidByTs || balance === 0;

  // “items” for details page (use canonical lines if present; else try invoice.items JSON)
  let items = [];
  if (lines.length) {
    items = lines.map((l) => ({
      description: String(l.description || ""),
      amount: Number(l.unit_price || 0),
      quantity: Number(l.quantity || 1),
    }));
  } else if (row?.buyer || row?.seller) {
    // if your invoice table stores items JSON on the row, try to read it via a direct fetch
    const { data: invRow } = await admin
      .from("invoice")
      .select("items")
      .eq("id", id)
      .maybeSingle();
    if (invRow?.items && Array.isArray(invRow.items)) {
      items = invRow.items.map((it) => ({
        description: String(it.description || ""),
        amount: Number(it.unit_price ?? it.amount ?? 0),
        quantity: Number(it.quantity || 1),
      }));
    }
  }

  // shape single record
  const address =
    row.buyer && typeof row.buyer === "object" && row.buyer.address
      ? row.buyer.address
      : {};

  const data = {
    source: "db",
    id: row.id,
    number: row.number,
    series: row.series,
    invoiceNo: row.invoice_no,
    status: row.status,
    currency: UC(row.currency || "EUR"),
    createdAt: row.issue_date,
    startTime: row.startTime ?? null,
    guests: row.guests ?? null,

    amount,
    amountPaid,
    balance,
    paid,

    customer: {
      name: row.buyer_name || row.buyer_business_name || "",
      email: row.buyer_email || "",
      phone: row.buyer_phone || "",
      vat: row.buyer_vat || "",
      address,
    },

    items, // for the details page

    meta: {
      series: row.series,
      number: row.number,
      issue_date: row.issue_date,
      due_date: row.due_date,
      created_at: row.created_at,
      updated_at: row.updated_at,
      paid_at: row.paid_at,
      payment_method: row.payment_method,
      booking_id: row.booking_id,
      pdf_path: row.pdf_path,
      mark: row.mark,
      stripe_payment_intent_id: row.stripe_payment_intent_id,
      stripe_invoice_id: row.stripe_invoice_id,
      notes: row.notes,
      taxes: row.taxes,
      subtotal: row.subtotal,
      tax_total: row.tax_total,
      total: row.total,
      buyer: row.buyer,
      seller: row.seller,
      overdue: !!row.overdue,
    },
  };

  if (expand === "lines" || expand === "all") data.lines = lines;
  if (expand === "payments" || expand === "all") data.payments = mergedPayments;

  return ok({ data });
}

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
