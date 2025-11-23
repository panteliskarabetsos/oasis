// src/app/api/admin/invoices2/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import Stripe from "stripe";

/* -------------------- Stripe -------------------- */
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

/* -------------------- Small utils -------------------- */
const asArr = (x) => (Array.isArray(x) ? x : []);
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const moneyFromCharge = (ch) => {
  const cents =
    typeof ch.amount_captured === "number" && ch.amount_captured > 0
      ? ch.amount_captured
      : ch.amount;
  return Number(cents || 0) / 100;
};

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
    .from("User") // if table renamed, use the correct name
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (error || (row?.role ?? "user") !== "admin")
    return { error: true, response: bad("Forbidden", 403) };
  return { error: false };
}

/* -------------------- Invoicing helpers -------------------- */
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
      acc.subtotal = r2(acc.subtotal + Number(l.line_subtotal || 0));
      acc.tax_total = r2(acc.tax_total + Number(l.line_tax || 0));
      acc.total = r2(acc.total + Number(l.line_total || 0));
      return acc;
    },
    { subtotal: 0, tax_total: 0, total: 0 }
  );
}

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
    type: (src.type || "").trim() || undefined, // individual | business
    name: (src.name || "").trim() || undefined,
    business_name: (src.business_name || "").trim() || undefined,
    email: (src.email || "").trim() || undefined,
    phone: (src.phone || "").trim() || undefined,
    vat: (src.vat || src.tax_id || "").trim() || undefined,
    address: sanitizeAddress(src.address),
  };
  if (!out.type) delete out.type;
  if (!out.business_name) delete out.business_name;
  if (!out.phone) delete out.phone;
  if (!out.vat) delete out.vat;
  if (!out.address) delete out.address;
  return out;
};

/* ============================================================
   POST — Create invoice + lines
   ============================================================ */
export async function POST(req) {
  const gate = await requireAdmin();
  if (gate?.error) return gate.response;

  const admin = createSupabaseAdmin();
  const body = await req.json().catch(() => ({}));
  const invIn = body?.invoice || {}; // allow legacy payloads

  // Buyer
  const buyerIn = body?.buyer ?? invIn?.buyer ?? {};
  const buyer = sanitizeBuyer(buyerIn);

  // Lines
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

  // Header fields
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

  // Insert invoice (number assigned by DB trigger)
  const { data: created, error: eInsInv } = await admin
    .from("invoice")
    .insert({
      series,
      status,
      currency,
      issue_date,
      due_date,
      buyer,
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

  // Insert lines
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

/* ============================================================
   GET — List invoices (with optional lines & payments expansion)
   + Stripe enrichment for payments
   ============================================================ */
export async function GET(req) {
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
  const asArr = (x) => (Array.isArray(x) ? x : []);

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
  const overdueParam = (sp.get("overdue") || "").toLowerCase();
  // IMPORTANT: when includeStripe=1|true -> return Stripe dataset (not DB)
  const includeStripe = ["1", "true", "yes"].includes(
    (sp.get("includeStripe") || "").toLowerCase()
  );

  /* ──────────────────────────────────────────────────────────────
     STRIPE-ONLY DATASET (triggered by ?includeStripe=1)
     ────────────────────────────────────────────────────────────── */
  if (includeStripe) {
    if (!stripe) return bad("Stripe is not configured", 500);

    // Build Stripe list params
    const params = {
      limit: perPage,
      expand: ["data.customer", "data.payment_intent", "data.charge"],
    };

    // Status mapping (Stripe invoice statuses)
    // DB statuses like 'paid','draft','void','open','uncollectible' map directly when possible
    const stripeStatuses = new Set([
      "draft",
      "open",
      "paid",
      "void",
      "uncollectible",
    ]);
    if (stripeStatuses.has(status)) params.status = status;

    // Date filter -> Stripe uses unix seconds in `created`
    const fromIso = normalizeStart(from);
    const toIso = normalizeEnd(to);
    if (fromIso || toIso) {
      params.created = {};
      if (fromIso) params.created.gte = Math.floor(Date.parse(fromIso) / 1000);
      if (toIso) params.created.lte = Math.floor(Date.parse(toIso) / 1000);
    }

    // Simple pagination for page>1 by walking pages with starting_after
    let data = [];
    let lastId = undefined;
    for (let i = 1; i <= page; i++) {
      const resp = await stripe.invoices.list(
        lastId ? { ...params, starting_after: lastId } : params
      );
      if (i === page) data = resp.data || [];
      // prepare cursor for next loop
      lastId = resp.data?.[resp.data.length - 1]?.id;
      if (!resp.has_more && i < page) {
        // requested page beyond available; return empty for this page
        data = [];
        break;
      }
    }

    // Shape Stripe invoices to your table row schema
    const rows = data.map((inv) => {
      const amount = Number(inv.total || 0) / 100;
      const amountPaid = Number(inv.amount_paid || 0) / 100;
      const balanceRaw = amount - amountPaid;
      const balance = balanceRaw > 0.005 ? balanceRaw : 0;
      const paid =
        inv.status === "paid" ||
        Boolean(inv.status_transitions?.paid_at) ||
        balance === 0;

      // customer display
      const cust =
        (inv.customer && typeof inv.customer === "object" && inv.customer) ||
        null;
      const customerName =
        inv.customer_name || cust?.name || cust?.description || "";
      const customerEmail = inv.customer_email || cust?.email || "";
      const currency = UC(inv.currency || "EUR");

      // minimal payments (from invoice)
      let payments = [];
      if (expand === "payments" || expand === "all") {
        if ((inv.amount_paid || 0) > 0) {
          payments.push({
            source: "stripe",
            method: inv.collection_method || "invoice",
            reference: inv.id,
            amount: amountPaid,
            currency,
            processed_at: new Date(
              (inv.status_transitions?.paid_at || inv.created) * 1000
            ).toISOString(),
            notes: "Stripe invoice",
          });
        }
      }

      return {
        id: inv.id, // keep Stripe id; your row click routes to /admin/invoices/[id]? you may branch by mode on UI
        invoiceNo: inv.number || `STR-${inv.id}`,
        createdAt: new Date(inv.created * 1000).toISOString(),
        startTime: null,
        guests: null,

        amount,
        amountPaid,
        balance,
        paid,

        currency,
        status: inv.status, // 'draft'|'open'|'paid'|'void'|'uncollectible'

        customer: {
          name: customerName,
          email: customerEmail,
          phone: cust?.phone || "",
          vat: "", // Stripe invoice doesn't expose VAT here unless you store it in metadata/tax_ids
          address:
            cust?.address ||
            inv.customer_address || // sometimes present on invoice
            {},
        },

        meta: {
          series: "STR", // synthetic
          number: inv.number || null,
          issue_date: new Date(inv.created * 1000).toISOString(),
          due_date: inv.due_date
            ? new Date(inv.due_date * 1000).toISOString()
            : null,
          created_at: new Date(inv.created * 1000).toISOString(),
          updated_at: inv.status_transitions?.finalized_at
            ? new Date(inv.status_transitions.finalized_at * 1000).toISOString()
            : new Date(inv.created * 1000).toISOString(),
          paid_at: inv.status_transitions?.paid_at
            ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
            : null,
          payment_method: inv.collection_method || null,
          booking_id: null,
          pdf_path: null,
          mark: null,
          stripe_payment_intent_id:
            typeof inv.payment_intent === "string"
              ? inv.payment_intent
              : inv.payment_intent?.id || null,
          stripe_invoice_id: inv.id,
          notes: inv.description || null,
          taxes: null,
          subtotal: inv.subtotal != null ? inv.subtotal / 100 : amount,
          tax_total:
            inv.tax != null
              ? Number(inv.tax) / 100
              : inv.total != null && inv.subtotal != null
              ? (inv.total - inv.subtotal) / 100
              : 0,
          total: amount,
          buyer: null,
          seller: null,
          overdue:
            inv.status === "open" && inv.due_date
              ? Date.now() > inv.due_date * 1000
              : false,
        },

        // only when expand asks for it
        ...(expand === "payments" || expand === "all" ? { payments } : {}),
      };
    });

    const pageTotal = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const currency =
      rows.find((r) => r?.currency)?.currency ||
      UC(sp.get("currency") || "EUR");

    // CSV path
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
      for (const r of rows) {
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
      const filename = `stripe_invoices_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // Stripe list API doesn't return a total count. We return the current page size.
    return ok({
      data: rows,
      page,
      perPage,
      total: rows.length, // unknown total — UI will show 1 page
      pageTotal,
      currency,
    });
  }

  /* ──────────────────────────────────────────────────────────────
     DB DATASET (original behavior; can still enrich with Stripe)
     ────────────────────────────────────────────────────────────── */

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

  const fromIdx = (page - 1) * perPage;
  const toIdx = fromIdx + perPage - 1;
  list = list.range(fromIdx, toIdx);

  const [{ data: invoices, error: e1 }, { count: total, error: e2 }] =
    await Promise.all([list, count]);
  if (e1) return bad(e1.message || "List failed", 500);

  const rowsRaw = invoices || [];
  const pageTotal = rowsRaw.reduce((s, r) => s + Number(r.total || 0), 0);
  const currency = UC(rowsRaw.find((r) => r?.currency)?.currency || "EUR");

  // optional expansions from DB
  let linesByInvoice = {};
  if (expand === "lines" || expand === "all") {
    const invIds = rowsRaw.map((r) => r.id);
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
    const invIds = rowsRaw.map((r) => r.id);
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

  // shape DB rows
  const data = rowsRaw.map((r) => {
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
      base.lines = asArr(linesByInvoice[r.id]);
    if (expand === "payments" || expand === "all")
      base.payments = asArr(paymentsByInvoice[r.id]);

    return base;
  });

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
