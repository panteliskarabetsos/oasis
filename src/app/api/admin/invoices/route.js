// src/app/api/admin/invoices/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import Stripe from "stripe";

const ok = (d, s = 200, headers = {}) =>
  new NextResponse(JSON.stringify(d), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
const bad = (m, s = 400) => ok({ error: m }, s);

/**
 * GET /api/admin/invoices
 * Query params:
 *  - q: string (search by booking id, email, name, stripe ids)
 *  - status: one of Booking.status (default: "paid"; use "all" for no filter)
 *  - from: ISO or yyyy-mm-dd (createdAt >=)
 *  - to: ISO or yyyy-mm-dd   (createdAt <=)
 *  - p: page number (1-based)
 *  - per: page size (default 25, max 200)
 *  - format: "csv" to export CSV (otherwise JSON)
 *  - ids: comma-separated booking ids (overrides other filters if present)
 */
export async function GET(req) {
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const url = new URL(req.url);
  const sp = url.searchParams;

  const q = (sp.get("q") || "").trim();
  const status = (sp.get("status") || "paid").trim();
  const from = (sp.get("from") || "").trim();
  const to = (sp.get("to") || "").trim();
  const page = Math.max(1, Number(sp.get("p") || 1));
  const perPage = clamp(Number(sp.get("per") || 25), 5, 200);
  const format = (sp.get("format") || "json").toLowerCase();
  const idsCsv = (sp.get("ids") || "").trim();

  const baseSelect = [
    "id",
    "createdAt",
    "startTime",
    "status",
    "numberOfPeople",
    "totalPaidAmount",
    "currency",
    "primary_contact",
    "stripePaymentIntentId",
    "stripeSessionId",
    "notes",
  ].join(",");

  let listQ = admin
    .from("Booking")
    .select(baseSelect)
    .order("createdAt", { ascending: false });

  let countQ = admin
    .from("Booking")
    .select("id", { count: "exact", head: true });

  // Explicit IDs override all other filters
  if (idsCsv) {
    const ids = idsCsv
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (ids.length === 0) return ok({ data: [], page: 1, perPage, total: 0 });
    listQ = listQ.in("id", ids);
    countQ = countQ.in("id", ids);
  } else {
    // status filter
    if (status && status !== "all") {
      listQ = listQ.eq("status", status);
      countQ = countQ.eq("status", status);
    }

    // date window on createdAt
    if (from) {
      const fromIso = normalizeDateStart(from);
      if (fromIso) {
        listQ = listQ.gte("createdAt", fromIso);
        countQ = countQ.gte("createdAt", fromIso);
      }
    }
    if (to) {
      const toIso = normalizeDateEnd(to);
      if (toIso) {
        listQ = listQ.lte("createdAt", toIso);
        countQ = countQ.lte("createdAt", toIso);
      }
    }

    // search across id / customer / stripe ids
    if (q) {
      const like = `%${q}%`;
      const ors = [
        `stripePaymentIntentId.ilike.${like}`,
        `stripeSessionId.ilike.${like}`,
        `primary_contact->>email.ilike.${like}`,
        `primary_contact->>fullName.ilike.${like}`,
        `primary_contact->>firstName.ilike.${like}`,
        `primary_contact->>lastName.ilike.${like}`,
      ];
      const asNum = Number(q);
      if (Number.isFinite(asNum)) ors.push(`id.eq.${asNum}`);
      listQ = listQ.or(ors.join(","));
      countQ = countQ.or(ors.join(","));
    }
  }

  // pagination
  const fromIdx = (page - 1) * perPage;
  const toIdx = fromIdx + perPage - 1;
  listQ = listQ.range(fromIdx, toIdx);

  // run queries
  const [{ data: rows, error: listErr }, { count, error: countErr }] =
    await Promise.all([listQ, countQ]);
  if (listErr) return bad(listErr.message || "Failed to load invoices", 500);

  const total = countErr ? null : Number(count || 0);
  const pageTotal = (rows || []).reduce(
    (s, r) => s + (Number(r?.totalPaidAmount || 0) || 0),
    0
  );

  if (format === "csv") {
    const csv = toCsv(rows || []);
    const filename = `invoices_${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename=\"${filename}\"`,
      },
    });
  }

  return ok({
    data: (rows || []).map(shapeInvoice),
    page,
    perPage,
    total,
    pageTotal,
    currency: guessCurrency(rows),
  });
}

/* ============================== POST: Create Stripe Invoice ============================== */
/**
 * POST /api/admin/invoices
 * Body:
 * {
 *   customer: { email: string, name?: string },
 *   items: [{ description: string, amount: number, quantity?: number }],
 *   currency?: "eur"|"usd"|... (default "eur"),
 *   memo?: string,
 *   collection_method?: "send_invoice" | "charge_automatically" (default "send_invoice"),
 *   days_until_due?: number (used only when send_invoice)
 * }
 *
 * Response: { id, number, status, hosted_invoice_url, invoice_pdf, customer_id, collection_method }
 */
export async function POST(req) {
  // Gate with user session + role=admin
  const gate = await requireAdmin();
  if (gate?.error) return gate.response;

  const secret = process.env.STRIPE_SECRET_KEY || "";
  if (!secret) return bad("Stripe is not configured", 500);
  const stripe = new Stripe(secret, { apiVersion: "2024-06-20" });

  // zero-decimal currencies (no cents)
  const ZERO_DECIMAL = new Set([
    "bif",
    "clp",
    "djf",
    "gnf",
    "jpy",
    "kmf",
    "krw",
    "mga",
    "pyg",
    "rwf",
    "ugx",
    "vnd",
    "vuv",
    "xaf",
    "xof",
    "xpf",
  ]);
  const toMinor = (amountMajor, ccy) =>
    ZERO_DECIMAL.has(String(ccy || "").toLowerCase())
      ? Math.round(Number(amountMajor || 0))
      : Math.round(Number(amountMajor || 0) * 100);

  let draftId;

  try {
    const body = await req.json();
    const {
      customer,
      items = [],
      currency = "eur",
      memo,
      collection_method = "send_invoice",
      days_until_due,
    } = body || {};

    if (!customer?.email) return bad("Customer email is required");

    // normalize items: require > 0 amount and qty
    const lineItems = items
      .map((it) => ({
        description: (it?.description || "Item").trim(),
        qty: Math.max(1, Number(it?.quantity || 1)),
        unitMinor: toMinor(it?.amount, currency),
      }))
      .filter((it) => it.unitMinor > 0 && it.qty > 0);

    if (lineItems.length === 0) {
      return bad("At least one valid line item (amount > 0) is required");
    }

    // Extended customer details from the form
    const details = {
      business_name: customer.business_name,
      contact_name: customer.type === "business" ? customer.name : undefined,
      phone: customer.phone,
      address: customer.address,
      tax_id: customer.tax_id,
      tax_id_type: customer.tax_id_type, // e.g. "eu_vat"
    };

    // Create or update Stripe Customer with full details
    const cust = await findOrCreateCustomer(
      stripe,
      customer.email,
      customer.name,
      details
    );

    // Optional extra info to show on PDF
    const custom_fields = [];
    if (details.business_name)
      custom_fields.push({ name: "Business", value: details.business_name });
    if (details.tax_id)
      custom_fields.push({ name: "Tax ID", value: details.tax_id });
    if (details.phone)
      custom_fields.push({ name: "Phone", value: details.phone });

    // 1) Create DRAFT invoice first
    const draft = await stripe.invoices.create({
      customer: cust.id,
      collection_method,
      ...(collection_method === "send_invoice"
        ? {
            days_until_due:
              typeof days_until_due === "number" ? days_until_due : 7,
          }
        : {}),
      description: memo || undefined,
      ...(custom_fields.length ? { custom_fields } : {}),
      metadata: {
        customer_type: customer.type || "individual",
        contact_name: details.contact_name || "",
        business_name: details.business_name || "",
      },
      auto_advance: false,
    });
    draftId = draft.id;

    // 2) Attach each item directly to THIS invoice
    for (const it of lineItems) {
      const totalMinor = it.unitMinor * it.qty;
      await stripe.invoiceItems.create({
        invoice: draft.id, // tie to the draft invoice
        customer: cust.id,
        amount: totalMinor, // total line amount (unit * qty)
        currency,
        description:
          it.qty > 1
            ? `${it.description} — ${it.qty} × ${(
                it.unitMinor / (ZERO_DECIMAL.has(currency) ? 1 : 100)
              ).toFixed(2)} ${currency.toUpperCase()}`
            : it.description,
      });
    }

    // 3) Finalize to compute totals and generate links
    const finalized = await stripe.invoices.finalizeInvoice(draft.id);

    return ok({
      id: finalized.id,
      number: finalized.number,
      status: finalized.status,
      hosted_invoice_url: finalized.hosted_invoice_url,
      invoice_pdf: finalized.invoice_pdf,
      customer_id: cust.id,
      collection_method,
    });
  } catch (e) {
    // clean up draft if something failed after creation
    if (draftId) {
      try {
        await stripe.invoices.voidInvoice(draftId);
      } catch {}
    }
    console.error(e);
    return bad(e?.message || "Invoice create failed", 500);
  }
}

/* ============================== helpers ============================== */
function clamp(n, min, max) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function normalizeDateStart(v) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v))
    return new Date(`${v}T00:00:00`).toISOString();
  const d = new Date(v);
  return isNaN(d) ? undefined : d.toISOString();
}
function normalizeDateEnd(v) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v))
    return new Date(`${v}T23:59:59`).toISOString();
  const d = new Date(v);
  return isNaN(d) ? undefined : d.toISOString();
}

function shapeInvoice(r) {
  const pc = r?.primary_contact || {};
  const name =
    pc.fullName ||
    pc.full_name ||
    [pc.firstName, pc.lastName].filter(Boolean).join(" ") ||
    [pc.first_name, pc.last_name].filter(Boolean).join(" ") ||
    pc.name ||
    "";
  const email = pc.email || pc.contactEmail || pc.customer_email || "";
  return {
    id: r.id,
    invoiceNo: formatInv(r.id),
    createdAt: r.createdAt,
    startTime: r.startTime,
    status: r.status,
    numberOfPeople: r.numberOfPeople,
    totalPaidAmount: Number(r.totalPaidAmount || 0),
    currency: (r.currency || "EUR").toUpperCase(),
    customer: { name, email },
    stripePaymentIntentId: r.stripePaymentIntentId || null,
    stripeSessionId: r.stripeSessionId || null,
    notes: r.notes || null,
  };
}

function formatInv(id) {
  return `INV-${String(id).padStart(6, "0")}`;
}

function guessCurrency(rows) {
  const first = rows?.find((r) => r?.currency);
  return (first?.currency || "EUR").toUpperCase();
}

function toCsv(rows) {
  const header = [
    "invoice_no",
    "booking_id",
    "created_at",
    "start_time",
    "status",
    "customer_name",
    "customer_email",
    "guests",
    "amount",
    "currency",
    "stripe_payment_intent",
    "stripe_session",
  ];

  const escape = (v) => {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };

  const lines = [header.join(",")];
  for (const r of rows || []) {
    const pc = r?.primary_contact || {};
    const name =
      pc.fullName ||
      pc.full_name ||
      [pc.firstName, pc.lastName].filter(Boolean).join(" ") ||
      [pc.first_name, pc.last_name].filter(Boolean).join(" ") ||
      pc.name ||
      "";
    const email = pc.email || pc.contactEmail || pc.customer_email || "";
    const line = [
      formatInv(r.id),
      r.id,
      r.createdAt,
      r.startTime || "",
      r.status,
      name,
      email,
      r.numberOfPeople || 1,
      Number(r.totalPaidAmount || 0).toFixed(2),
      (r.currency || "EUR").toUpperCase(),
      r.stripePaymentIntentId || "",
      r.stripeSessionId || "",
    ]
      .map(escape)
      .join(",");
    lines.push(line);
  }
  return lines.join("\n");
}

/* ---- admin gating + stripe helpers for POST ---- */
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

async function findOrCreateCustomer(stripe, email, name, details = {}) {
  // Try to find existing customer by email
  const list = await stripe.customers.list({ email, limit: 1 });
  let cust = list.data?.[0] || null;

  const base = {
    email,
    // Prefer the provided name; if “business” we’ve already passed business name into name from the UI
    name: name || details.business_name || undefined,
    phone: details.phone || undefined,
    address: sanitizeAddress(details.address),
  };

  if (cust) {
    await stripe.customers.update(cust.id, base);
  } else {
    cust = await stripe.customers.create(base);
  }

  // Attach tax ID if provided (and not already present)
  if (details.tax_id) {
    try {
      const existing = await stripe.customers.listTaxIds(cust.id, {
        limit: 20,
      });
      const hasSame = existing.data?.some((t) => t.value === details.tax_id);
      if (!hasSame) {
        await stripe.customers.createTaxId(cust.id, {
          type: details.tax_id_type || "eu_vat",
          value: details.tax_id,
        });
      }
    } catch {
      // don’t block invoice creation on tax id errors
    }
  }

  return cust;
}

function sanitizeAddress(addr) {
  if (!addr) return undefined;
  const out = {
    line1: addr.line1 || undefined,
    line2: addr.line2 || undefined,
    city: addr.city || undefined,
    state: addr.state || undefined,
    postal_code: addr.postal_code || undefined,
    country: addr.country || undefined,
  };
  return Object.values(out).every((v) => !v) ? undefined : out;
}
