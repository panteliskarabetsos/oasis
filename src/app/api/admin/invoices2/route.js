export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

/* ─────────── helpers ─────────── */
const ok = (d, s = 200, headers = {}) =>
  new NextResponse(JSON.stringify(d), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
const bad = (m, s = 400) => ok({ error: m }, s);

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const clamp = (n, min, max) =>
  Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
const UC = (s, d = "") => String(s ?? d).toUpperCase();

function formatInv(series, number) {
  return `${UC(series)}-${String(number).padStart(5, "0")}`;
}
function normalizeStart(v) {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v))
    return new Date(`${v}T00:00:00`).toISOString();
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString();
}
function normalizeEnd(v) {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v))
    return new Date(`${v}T23:59:59`).toISOString();
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString();
}

function toCsv(rows) {
  const header = [
    "invoice_no",
    "issue_date",
    "status",
    "buyer_name",
    "buyer_email",
    "amount",
    "currency",
  ];
  const escape = (v) => {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const lines = [header.join(",")];
  for (const r of rows || []) {
    const inv = formatInv(r.series, r.number);
    const name = r.buyer?.name || r.buyer?.business_name || "";
    const email = r.buyer?.email || "";
    lines.push(
      [
        inv,
        r.issue_date,
        r.status,
        name,
        email,
        Number(r.total || 0).toFixed(2),
        (r.currency || "EUR").toUpperCase(),
      ]
        .map(escape)
        .join(",")
    );
  }
  return lines.join("\n");
}

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
function sanitizeBuyer(b) {
  const out = {
    name: (b?.name || "").trim() || undefined,
    business_name: (b?.business_name || "").trim() || undefined,
    email: (b?.email || "").trim() || undefined,
    phone: (b?.phone || "").trim() || undefined,
    vat: (b?.vat || b?.tax_id || "").trim() || undefined,
    address: sanitizeAddress(b?.address),
  };
  if (!out.business_name) delete out.business_name;
  if (!out.phone) delete out.phone;
  if (!out.vat) delete out.vat;
  if (!out.address) delete out.address;
  return out;
}

function computeTotals(lines) {
  let subtotal = 0,
    tax_total = 0,
    total = 0;
  const computed = lines.map((l) => {
    const base = r2(l.unit_price * l.quantity);
    const tax = r2(base * (l.vat_rate / 100));
    const line_total = r2(base + tax);
    subtotal = r2(subtotal + base);
    tax_total = r2(tax_total + tax);
    total = r2(total + line_total);
    return { ...l, base, tax, line_total };
  });
  return { subtotal, tax_total, total, computed };
}

async function nextInvoiceNumber(admin, series) {
  try {
    const { data, error } = await admin.rpc("invoice_next_number", {
      p_series: series,
    });
    if (!error && (typeof data === "number" || (data && data.number))) {
      return typeof data === "number" ? data : data.number;
    }
  } catch {}
  const { data: lastRows } = await admin
    .from("invoice")
    .select("number")
    .eq("series", series)
    .order("number", { ascending: false })
    .limit(1);
  return Number(lastRows?.[0]?.number || 0) + 1;
}

function toClientRow(r) {
  return {
    id: r.id,
    invoiceNo: formatInv(r.series, r.number),
    createdAt: r.issue_date,
    startTime: null,
    status: r.status,
    numberOfPeople: null,
    totalPaidAmount: Number(r.total || 0),
    currency: UC(r.currency || "EUR"),
    customer: {
      name: r.buyer?.name || r.buyer?.business_name || "",
      email: r.buyer?.email || "",
    },
  };
}

/* ─────────── GET /api/admin/invoices2 ─────────── */
export async function GET(req) {
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const url = new URL(req.url);
  const sp = url.searchParams;
  const q = (sp.get("q") || "").trim();
  const status = (sp.get("status") || "all").trim();
  const from = (sp.get("from") || "").trim();
  const to = (sp.get("to") || "").trim();
  const page = Math.max(1, Number(sp.get("p") || 1));
  const perPage = clamp(Number(sp.get("per") || 25), 5, 200);
  const format = (sp.get("format") || "json").toLowerCase();
  const idsCsv = (sp.get("ids") || "").trim();

  let list = admin
    .from("invoice")
    .select(
      "id, series, number, status, currency, issue_date, due_date, buyer, subtotal, tax_total, total"
    )
    .order("issue_date", { ascending: false });

  let count = admin
    .from("invoice")
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
        `buyer->>name.ilike.${like}`,
        `buyer->>business_name.ilike.${like}`,
        `buyer->>email.ilike.${like}`,
        `buyer->>vat.ilike.${like}`,
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

  const [{ data: rows, error: e1 }, { count: total, error: e2 }] =
    await Promise.all([list, count]);
  if (e1) return bad(e1.message || "List failed", 500);

  const pageTotal = (rows || []).reduce((s, r) => s + Number(r.total || 0), 0);
  const currency = rows?.find((r) => r?.currency)?.currency || "EUR";

  if (format === "csv") {
    const csv = toCsv(rows || []);
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
    data: (rows || []).map(toClientRow),
    page,
    perPage,
    total: Number(e2 ? 0 : total || 0),
    pageTotal,
    currency: UC(currency || "EUR"),
  });
}

/* ─────────── POST /api/admin/invoices2 ───────────
   Body: {
     series, currency, issue_date?, due_date?, buyer,
     lines:[{ description, unit_price, quantity, vat_rate }],
     notes?, finalize?
   }
   Returns: { id, invoiceNo, status, currency, subtotal, tax_total, total }
──────────────────────────────────────────────────── */
export async function POST(req) {
  // auth
  const gate = await requireAdmin();
  if (gate?.error) return gate.response;

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  // parse body FIRST (this was your ReferenceError)
  let body;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body");
  }

  const series = UC(body.series || "A");
  const currency = UC(body.currency || "EUR");
  const issue_date = body.issue_date
    ? new Date(body.issue_date).toISOString()
    : new Date().toISOString();
  const due_date = body.due_date ? new Date(body.due_date).toISOString() : null;
  const buyer = sanitizeBuyer(body.buyer || {});
  const notes = (body.notes || "").trim() || null;
  const finalize = !!body.finalize;

  // normalize lines
  const rawLines = Array.isArray(body.lines) ? body.lines : [];
  const lines = rawLines
    .map((l) => ({
      description: String(l?.description || "").trim(),
      unit_price: Number(l?.unit_price ?? l?.amount ?? 0),
      quantity: Math.max(1, Number(l?.quantity || 1)),
      vat_rate: Math.max(0, Number(l?.vat_rate ?? 0)),
    }))
    .filter((l) => l.description && isFinite(l.unit_price) && l.unit_price > 0);

  if (!buyer?.email) return bad("Customer email is required");
  if (lines.length === 0)
    return bad("At least one line item with amount > 0 is required");

  const { subtotal, tax_total, total, computed } = computeTotals(lines);

  // numbering + insert with retry on unique conflicts
  let number = await nextInvoiceNumber(admin, series);
  let invRow = null;
  let lastErr = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const toInsert = {
      series,
      number,
      status: finalize ? "finalized" : "draft",
      currency,
      issue_date,
      due_date,
      buyer,
      notes,
      subtotal,
      tax_total,
      total,
    };

    const { data, error } = await admin
      .from("invoice")
      .insert(toInsert)
      .select("id, series, number, status")
      .single();

    if (!error && data) {
      invRow = data;
      break;
    }

    lastErr = error;
    const msg = String(error?.message || "");
    if (/duplicate key value|unique constraint/i.test(msg)) {
      number = Number(number || 0) + 1;
      continue; // try next number
    }
    break; // other error
  }

  if (!invRow) return bad(lastErr?.message || "Failed to create invoice", 500);

  // optional: insert lines into invoice_line (if table exists)
  try {
    if (computed.length) {
      const rows = computed.map((l) => ({
        invoice_id: invRow.id,
        description: l.description,
        unit_price: l.unit_price,
        quantity: l.quantity,
        vat_rate: l.vat_rate,
        base_amount: l.base,
        tax_amount: l.tax,
        total_amount: l.line_total,
      }));
      await admin.from("invoice_line").insert(rows);
    }
  } catch {
    // ignore
  }

  return ok(
    {
      id: invRow.id,
      invoiceNo: formatInv(invRow.series, invRow.number),
      status: invRow.status,
      currency,
      subtotal,
      tax_total,
      total,
    },
    201
  );
}
