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
    .from("User") // if you renamed to lowercase, use .from("user")
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

/* -------- POST (create) -------- */
export async function POST(req) {
  const gate = await requireAdmin();
  if (gate?.error) return gate.response;

  const admin = createSupabaseAdmin();
  const body = await req.json().catch(() => ({}));
  const invIn = body?.invoice || {}; // allow legacy payloads too

  // ---------- helpers (inline for clarity) ----------
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const normalizeLines = (raw = []) =>
    raw.map((l, i) => {
      const description =
        String(
          l?.description ??
            l?.desc ??
            l?.label ??
            l?.name ??
            l?.title ??
            l?.itemName ??
            l?.productName ??
            l?.price?.product?.name ??
            l?.price?.nickname ??
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

  const summarize = (lines = []) =>
    lines.reduce(
      (acc, l) => {
        acc.subtotal = r2(acc.subtotal + Number(l.line_subtotal || 0));
        acc.tax_total = r2(acc.tax_total + Number(l.line_tax || 0));
        acc.total = r2(acc.total + Number(l.line_total || 0));
        return acc;
      },
      { subtotal: 0, tax_total: 0, total: 0 }
    );

  const sanitizeAddress = (addr) => {
    if (!addr) return undefined;
    const out = {
      line1: addr.line1 || undefined,
      line2: addr.line2 || undefined,
      city: addr.city || undefined,
      state: addr.state || undefined,
      postal_code: addr.postal_code || undefined,
      country:
        (addr.country || "").toString().slice(0, 2).toUpperCase() || undefined,
    };
    return Object.values(out).every((v) => !v) ? undefined : out;
  };

  const sanitizeBuyer = (b) => {
    const src = b || {};
    const out = {
      // keep a “type” if provided (individual|business) – useful for reports
      type: (src.type || "").trim() || undefined,
      name: (src.name || "").trim() || undefined, // contact or full name
      business_name: (src.business_name || "").trim() || undefined,
      email: (src.email || "").trim() || undefined,
      phone: (src.phone || "").trim() || undefined,
      vat: (src.vat || src.tax_id || "").trim() || undefined,
      address: sanitizeAddress(src.address),
    };
    // remove empties so JSON stays clean
    if (!out.type) delete out.type;
    if (!out.business_name) delete out.business_name;
    if (!out.phone) delete out.phone;
    if (!out.vat) delete out.vat;
    if (!out.address) delete out.address;
    return out;
  };
  // --------------------------------------------------

  // Read from top-level first, then legacy `invoice.*`
  const buyerIn = body?.buyer ?? invIn?.buyer ?? {};
  const buyer = sanitizeBuyer(buyerIn);

  const rawLines =
    (Array.isArray(body?.lines) && body.lines) ||
    (Array.isArray(invIn?.lines) && invIn.lines) ||
    (Array.isArray(body?.items) && body.items) ||
    (Array.isArray(invIn?.items) && invIn.items) ||
    [];

  if (!buyer.email) return bad("Customer email is required", 422);
  if (!rawLines.length) return bad("At least one line item is required", 422);

  const norm = normalizeLines(rawLines).filter(
    (l) => l.description && l.unit_price > 0
  );
  if (!norm.length) return bad("All line items have zero/invalid amount", 422);

  const { subtotal, tax_total, total } = summarize(norm);

  const series = String(body.series ?? invIn.series ?? "A").toUpperCase();
  const currency = String(
    body.currency ?? invIn.currency ?? "EUR"
  ).toUpperCase();
  const issue_date =
    body.issue_date ?? invIn.issue_date ?? new Date().toISOString();
  const due_date = body.due_date ?? invIn.due_date ?? null;
  const notes = body.notes ?? invIn.notes ?? null;
  const status =
    body.finalize ?? invIn.finalize
      ? "finalized"
      : body.status ?? invIn.status ?? "draft";

  // Insert invoice — your DB trigger assigns 'number'
  const { data: created, error: eInsInv } = await admin
    .from("invoice")
    .insert({
      series,
      status,
      currency,
      issue_date,
      due_date,
      buyer, // <<<<<< STORE ALL CUSTOMER DATA HERE
      // optional: add seller if you ever pass it
      notes,
      subtotal,
      tax_total,
      total,
      booking_id: body.booking_id ?? invIn.booking_id ?? null,
      stripe_payment_intent_id:
        invIn.stripe_payment_int_id ??
        invIn.stripe_payment_intent_id ??
        body.stripe_payment_intent_id ??
        null,
      stripe_invoice_id:
        body.stripe_invoice_id ?? invIn.stripe_invoice_id ?? null,
      paid_at: body.paid_at ?? invIn.paid_at ?? null,
      payment_method: body.payment_method ?? invIn.payment_method ?? null,
      mark: body.mark ?? invIn.mark ?? null,
    })
    .select("id, series, number, status, currency, subtotal, tax_total, total")
    .maybeSingle();

  if (eInsInv || !created)
    return bad(eInsInv?.message || "Invoice insert failed", 500);

  // Insert line items and link them
  const lineRows = norm.map((l) => ({ ...l, invoice_id: created.id }));
  const { error: eInsLines, count } = await admin
    .from("invoice_line")
    .insert(lineRows)
    .select("id", { head: false, count: "exact" });

  if (eInsLines) {
    await admin.from("invoice").delete().eq("id", created.id);
    return bad(eInsLines.message || "Line insert failed", 500);
  }

  const invoiceNo = `${series}-${String(created.number).padStart(5, "0")}`;
  return ok(
    {
      id: created.id,
      invoiceNo,
      series: created.series,
      number: created.number,
      status: created.status,
      currency: created.currency,
      totals: {
        subtotal: created.subtotal,
        tax_total: created.tax_total,
        total: created.total,
      },
      linesSaved: Number(count || lineRows.length),
    },
    201,
    { Location: `/api/admin/invoices2/${created.id}` }
  );
}

// src/app/api/admin/invoices2/route.js (GET only)
// src/app/api/admin/invoices2/route.js (GET using the view)
export async function GET(req) {
  // auth
  const gate = await requireAdmin();
  if (gate?.error) return gate.response;

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  // helpers
  const UC = (s, d = "") => String(s ?? d).toUpperCase();
  const clamp = (n, min, max) =>
    Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
  const normalizeStart = (v) => {
    if (!v) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v))
      return new Date(`${v}T00:00:00Z`).toISOString();
    const d = new Date(v);
    return isNaN(d) ? null : d.toISOString();
  };
  const normalizeEnd = (v) => {
    if (!v) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v))
      return new Date(`${v}T23:59:59.999Z`).toISOString();
    const d = new Date(v);
    return isNaN(d) ? null : d.toISOString();
  };

  // params
  const url = new URL(req.url);
  const sp = url.searchParams;
  const q = (sp.get("q") || "").trim();
  const status = (sp.get("status") || "all").trim().toLowerCase();
  const from = (sp.get("from") || "").trim();
  const to = (sp.get("to") || "").trim();
  const page = Math.max(1, Number(sp.get("p") || 1));
  const perPage = clamp(Number(sp.get("per") || 25), 5, 200);
  const format = (sp.get("format") || "json").toLowerCase();
  const idsCsv = (sp.get("ids") || "").trim();
  const expand = (sp.get("expand") || "none").toLowerCase(); // none|lines|payments|all
  const overdueParam = (sp.get("overdue") || "").toLowerCase(); // "1" | "true" to filter overdue

  // base selections from the view
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
    // flattened buyer fields (handy for shaping/search)
    "buyer_name",
    "buyer_business_name",
    "buyer_email",
    "buyer_phone",
    "buyer_vat",
  ].join(", ");

  let list = admin
    .from("admin_invoice_money")
    .select(cols)
    .order("issue_date", { ascending: false });
  let count = admin
    .from("admin_invoice_money")
    .select("id", { count: "exact", head: true });

  if (idsCsv) {
    const ids = idsCsv
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!ids.length)
      return ok({
        data: [],
        page: 1,
        perPage,
        total: 0,
        pageTotal: 0,
        currency: "EUR",
      });
    list = list.in("id", ids);
    count = count.in("id", ids);
  } else {
    if (status && status !== "all") {
      list = list.eq("status", status);
      count = count.eq("status", status);
    }

    // Overdue filter (optional)
    if (overdueParam === "1" || overdueParam === "true") {
      list = list.eq("overdue", true);
      count = count.eq("overdue", true);
    }

    const fromIso = normalizeStart(from);
    const toIso = normalizeEnd(to);
    if (fromIso) {
      list = list.gte("issue_date", fromIso);
      count = count.gte("issue_date", fromIso);
    }
    if (toIso) {
      list = list.lte("issue_date", toIso);
      count = count.lte("issue_date", toIso);
    }

    if (q) {
      const like = `%${q}%`;
      const ors = [
        `series.ilike.${like}`,
        `status.ilike.${like}`,
        `invoice_no.ilike.${like}`,
        `buyer_name.ilike.${like}`,
        `buyer_business_name.ilike.${like}`,
        `buyer_email.ilike.${like}`,
        `buyer_vat.ilike.${like}`,
      ];
      const asNum = Number(q);
      if (Number.isFinite(asNum))
        ors.push(`number.eq.${asNum}`, `id.eq.${asNum}`);
      list = list.or(ors.join(","));
      count = count.or(ors.join(","));
    }
  }

  // pagination
  const fromIdx = (page - 1) * perPage;
  const toIdx = fromIdx + perPage - 1;
  list = list.range(fromIdx, toIdx);

  // run base queries
  const [{ data: invoices, error: e1 }, { count: total, error: e2 }] =
    await Promise.all([list, count]);
  if (e1) return bad(e1.message || "List failed", 500);

  const rows = invoices || [];
  const pageTotal = rows.reduce((s, r) => s + Number(r.total || 0), 0);
  const currency = UC(rows.find((r) => r?.currency)?.currency || "EUR");

  // Optional expansions
  let linesByInvoice = {};
  if (expand === "lines" || expand === "all") {
    const invIds = rows.map((r) => r.id);
    if (invIds.length) {
      const { data: lines, error: le } = await admin
        .from("invoice_line")
        .select(
          "id, invoice_id, description, quantity, unit_price, vat_rate, discount_percent, line_subtotal, line_tax, line_total"
        )
        .in("invoice_id", invIds)
        .order("id");
      if (le) return bad(le.message || "Fetch lines failed", 500);
      for (const l of lines || [])
        (linesByInvoice[l.invoice_id] ||= []).push(l);
    }
  }

  let paymentsByInvoice = {};
  if (expand === "payments" || expand === "all") {
    const invIds = rows.map((r) => r.id);
    if (invIds.length) {
      const { data: pays, error: pe } = await admin
        .from("payment")
        .select(
          "id, invoice_id, booking_id, method, amount, currency, reference, processed_at, notes"
        )
        .in("invoice_id", invIds)
        .order("processed_at", { ascending: true });
      if (pe) return bad(pe.message || "Fetch payments failed", 500);
      for (const p of pays || [])
        (paymentsByInvoice[p.invoice_id] ||= []).push(p);
    }
  }

  // shape rows (view already gives most fields)
  const data = rows.map((r) => {
    const customerName = r.buyer_name || r.buyer_business_name || "";
    const address =
      r.buyer && typeof r.buyer === "object" && r.buyer.address
        ? r.buyer.address
        : {};

    const base = {
      id: r.id,
      invoiceNo: r.invoice_no,
      createdAt: r.issue_date,
      startTime: r.startTime ?? null,
      guests: r.guests ?? null,

      amount: Number(r.total || 0),
      amountPaid: Number(r.amount_paid || 0),
      balance: Number(r.balance || 0),
      paid: !!r.paid,

      currency: UC(r.currency || "EUR"),
      status: r.status,

      customer: {
        name: customerName,
        email: r.buyer_email || "",
        phone: r.buyer_phone || "",
        vat: r.buyer_vat || "",
        address,
      },

      meta: {
        series: r.series,
        number: r.number,
        issue_date: r.issue_date,
        due_date: r.due_date,
        created_at: r.created_at,
        updated_at: r.updated_at,
        paid_at: r.paid_at,
        payment_method: r.payment_method,
        booking_id: r.booking_id,
        pdf_path: r.pdf_path,
        mark: r.mark,
        stripe_payment_intent_id: r.stripe_payment_intent_id,
        stripe_invoice_id: r.stripe_invoice_id,
        notes: r.notes,
        taxes: r.taxes,
        subtotal: r.subtotal,
        tax_total: r.tax_total,
        total: r.total,
        buyer: r.buyer,
        seller: r.seller,
        overdue: !!r.overdue,
      },
    };

    if (expand === "lines" || expand === "all")
      base.lines = linesByInvoice[r.id] || [];
    if (expand === "payments" || expand === "all")
      base.payments = paymentsByInvoice[r.id] || [];

    return base;
  });

  // CSV export (minimal)
  if (format === "csv") {
    const header = [
      "invoice_no",
      "created_at",
      "status",
      "customer_name",
      "customer_email",
      "amount",
      "currency",
    ];
    const escape = (v) => {
      if (v == null) return "";
      const s = String(v);
      return /[\",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(",")];
    for (const r of data) {
      lines.push(
        [
          r.invoiceNo,
          r.createdAt,
          r.status,
          r.customer?.name || "",
          r.customer?.email || "",
          Number(r.amount || 0).toFixed(2),
          r.currency,
        ]
          .map(escape)
          .join(",")
      );
    }
    const csv = lines.join("\n");
    const filename = `invoices_${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return ok({
    data,
    page,
    perPage,
    total: Number(e2 ? 0 : total || 0),
    pageTotal,
    currency,
  });
}
