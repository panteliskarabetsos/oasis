// src/app/api/admin/invoices/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

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
