export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import buildZReportPdfBuffer from "@/lib/pdf/buildZReport";

const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

async function requireAdmin() {
  const supa = await createSupabaseServer();
  if (!supa)
    return { error: true, response: bad("Server not configured", 500) };

  const { data, error } = await supa.auth.getUser();
  const user = data?.user;

  if (error || !user)
    return { error: true, response: bad("Unauthorized", 401) };

  const admin = createSupabaseAdmin();
  if (!admin)
    return { error: true, response: bad("Server not configured", 500) };

  const { data: profile } = await admin
    .from("User")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single();

  const role =
    profile?.role ||
    user?.app_metadata?.role ||
    user?.user_metadata?.role ||
    "user";

  if (!["admin", "superadmin", "manager", "finance"].includes(role)) {
    return { error: true, response: bad("Forbidden", 403) };
  }

  return { error: false, admin, user, profile };
}

function getDateRange(dateParam) {
  let startDate;
  let endDate;

  if (dateParam) {
    startDate = new Date(`${dateParam}T00:00:00`);
    endDate = new Date(`${dateParam}T23:59:59.999`);
  } else {
    const now = new Date();
    startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
  }

  return {
    reportDate: dateParam || startDate.toISOString().split("T")[0],
    isoStart: startDate.toISOString(),
    isoEnd: endDate.toISOString(),
  };
}

function normalizeMethod(rawMethod) {
  return String(rawMethod || "")
    .toLowerCase()
    .trim()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");
}

function round2(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

function addTender(summary, rawMethod, amount) {
  const method = normalizeMethod(rawMethod);
  const amt = round2(amount);

  if (method === "cash") summary.cash += amt;
  else if (
    method === "card" ||
    method === "stripe" ||
    method === "terminal" ||
    method === "credit_card" ||
    method === "debit_card"
  )
    summary.card += amt;
  else if (method === "bank_transfer" || method === "bank")
    summary.bank_transfer += amt;
  else summary.other += amt;

  summary.gross_total += amt;
  summary.net_total += amt;
}

export async function GET(req) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.response;

    const admin = auth.admin;
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");

    const { reportDate, isoStart, isoEnd } = getDateRange(dateParam);

    const { data: existingReport, error: reportErr } = await admin
      .from("z_report")
      .select("*")
      .eq("report_date", reportDate)
      .maybeSingle();

    if (reportErr) throw reportErr;

    const { data: payments, error: pErr } = await admin
      .from("payment")
      .select(
        `
        id,
        amount,
        method,
        currency,
        reference,
        processed_at,
        stripe_payment_intent_id,
        booking_id,
        invoice_id,
        notes
      `,
      )
      .gte("processed_at", isoStart)
      .lte("processed_at", isoEnd)
      .order("processed_at", { ascending: true });

    if (pErr) throw pErr;

    const { data: receipts, error: rcpErr } = await admin
      .from("Receipt")
      .select(
        `
        id,
        totalPaidAmount,
        paymentMethod,
        currency,
        paymentReference,
        stripePaymentIntentId,
        relatedBookingRef,
        transactionType,
        customerName,
        customerEmail,
        created_at,
        notes
      `,
      )
      .gte("created_at", isoStart)
      .lte("created_at", isoEnd)
      .order("created_at", { ascending: true });

    if (rcpErr) throw rcpErr;

    const { data: refunds, error: rErr } = await admin
      .from("payment_refund")
      .select(
        `
        id,
        amount_cents,
        currency,
        created_at,
        stripe_refund_id,
        stripe_payment_intent_id,
        booking_id,
        invoice_id,
        reason,
        notes,
        performed_by_email,
        performed_by_name
      `,
      )
      .gte("created_at", isoStart)
      .lte("created_at", isoEnd)
      .order("created_at", { ascending: true });

    if (rErr) throw rErr;

    const summary = {
      cash: 0,
      card: 0,
      bank_transfer: 0,
      other: 0,
      refunds: 0,
      gross_total: 0,
      net_total: 0,
    };

    payments?.forEach((p) => addTender(summary, p.method, p.amount));
    receipts?.forEach((r) =>
      addTender(summary, r.paymentMethod, r.totalPaidAmount),
    );

    refunds?.forEach((r) => {
      const amount = round2((Number(r.amount_cents) || 0) / 100);
      summary.refunds += amount;
      summary.net_total -= amount;
    });

    Object.keys(summary).forEach((k) => {
      summary[k] = round2(summary[k]);
    });

    const paymentRows = (payments || []).map((p) => ({
      id: p.id,
      document_no: `PAY-${String(p.id).padStart(6, "0")}`,
      source: "payment",
      type: "incoming",
      method: normalizeMethod(p.method) || "other",
      amount: round2(p.amount),
      currency: p.currency || "EUR",
      created_at: p.processed_at,
      reference: p.stripe_payment_intent_id || p.reference || null,
      booking_id: p.booking_id || null,
      invoice_id: p.invoice_id || null,
      notes: p.notes || null,
    }));

    const receiptRows = (receipts || []).map((r) => ({
      id: r.id,
      document_no: `REC-${String(r.id).padStart(6, "0")}`,
      source: "receipt",
      type: "incoming",
      method: normalizeMethod(r.paymentMethod) || "other",
      amount: round2(r.totalPaidAmount),
      currency: r.currency || "EUR",
      created_at: r.created_at,
      reference:
        r.stripePaymentIntentId ||
        r.paymentReference ||
        r.relatedBookingRef ||
        null,
      booking_id: null,
      invoice_id: null,
      customer_name: r.customerName || null,
      customer_email: r.customerEmail || null,
      transaction_type: r.transactionType || null,
      notes: r.notes || null,
    }));

    const refundRows = (refunds || []).map((r) => ({
      id: r.id,
      document_no: `REF-${String(r.id).padStart(6, "0")}`,
      source: "payment",
      type: "outgoing",
      method: "refund",
      amount: round2((Number(r.amount_cents) || 0) / 100),
      currency: r.currency || "EUR",
      created_at: r.created_at,
      reference: r.stripe_refund_id || r.stripe_payment_intent_id || null,
      booking_id: r.booking_id || null,
      invoice_id: r.invoice_id || null,
      reason: r.reason || null,
      notes: r.notes || null,
      performed_by_email: r.performed_by_email || null,
      performed_by_name: r.performed_by_name || null,
    }));

    const transactions = [...paymentRows, ...receiptRows, ...refundRows].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at),
    );

    const reconciliation = {
      opening_float: Number(existingReport?.opening_float || 0),
      cash_revenue: Number(existingReport?.cash_revenue ?? summary.cash ?? 0),
      cash_drops: Number(existingReport?.cash_drops || 0),
      expected_drawer: Number(existingReport?.expected_drawer || 0),
      counted_cash: Number(existingReport?.counted_cash || 0),
      discrepancy: Number(existingReport?.discrepancy || 0),
      notes: existingReport?.notes || "",
    };

    const pdf = await buildZReportPdfBuffer({
      report: {
        id: existingReport?.id || null,
        date: reportDate,
        status:
          existingReport?.status === "locked"
            ? "VERIFIED & LOCKED"
            : "UNVERIFIED",
      },
      summary,
      reconciliation,
      transactions,
      currency: "EUR",
      store: {
        name: "Oasis",
        address: "Chania, Crete 73100",
        taxId: "EL123456789",
      },
    });

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="z-report-${reportDate}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Z-Report PDF Error:", error);
    return bad("Failed to generate Z-Report PDF", 500);
  }
}
