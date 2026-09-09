export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { accessCan, resolveStaffAccess } from "@/lib/auth/requireAdmin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

async function requireAdmin() {
  const supa = await createSupabaseServer();
  if (!supa) {
    return { error: true, response: bad("Server not configured", 500) };
  }

  const { data, error } = await supa.auth.getUser();
  const user = data?.user;

  if (error || !user) {
    return { error: true, response: bad("Unauthorized", 401) };
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return { error: true, response: bad("Server not configured", 500) };
  }

  const { data: profile } = await admin
    .from("User")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single();

  const { role, permissions } = await resolveStaffAccess(user);

  if (!accessCan(permissions, "zreport")) {
    return { error: true, response: bad("Forbidden", 403) };
  }

  return {
    error: false,
    admin,
    user,
    profile,
  };
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

  if (method === "cash") {
    summary.cash += amt;
  } else if (
    method === "card" ||
    method === "stripe" ||
    method === "terminal" ||
    method === "credit_card" ||
    method === "debit_card"
  ) {
    summary.card += amt;
  } else if (method === "bank_transfer" || method === "bank") {
    summary.bank_transfer += amt;
  } else {
    summary.other += amt;
  }

  summary.gross_total += amt;
  summary.net_total += amt;
}

function cleanSummary(summary) {
  return {
    cash: round2(summary.cash),
    card: round2(summary.card),
    bank_transfer: round2(summary.bank_transfer),
    other: round2(summary.other),
    refunds: round2(summary.refunds),
    gross_total: round2(summary.gross_total),
    net_total: round2(summary.net_total),
  };
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

    payments?.forEach((p) => {
      addTender(summary, p.method, p.amount);
    });

    receipts?.forEach((r) => {
      addTender(summary, r.paymentMethod, r.totalPaidAmount);
    });

    refunds?.forEach((r) => {
      const amount = round2((Number(r.amount_cents) || 0) / 100);
      summary.refunds += amount;
      summary.net_total -= amount;
    });

    const paymentRows = (payments || []).map((p) => ({
      id: p.id,
      source: "payment",
      type: "incoming",
      method: normalizeMethod(p.method) || "other",
      amount: round2(p.amount),
      currency: p.currency || "EUR",
      created_at: p.processed_at,
      reference: p.stripe_payment_intent_id || p.reference || null,
      booking_id: p.booking_id || null,
      invoice_id: p.invoice_id || null,
      customer_name: null,
      customer_email: null,
      notes: p.notes || null,
    }));

    const receiptRows = (receipts || []).map((r) => ({
      id: r.id,
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
      source: "refund",
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

    const allTransactions = [
      ...paymentRows,
      ...receiptRows,
      ...refundRows,
    ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    return ok({
      date: reportDate,
      period: {
        start: isoStart,
        end: isoEnd,
      },
      locked: existingReport?.status === "locked",
      report: existingReport || null,
      summary: cleanSummary(summary),

      raw_payments: paymentRows.length + receiptRows.length,
      raw_refunds: refundRows.length,

      payments: [...paymentRows, ...receiptRows].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at),
      ),
      refunds: refundRows,
      transactions: allTransactions,
    });
  } catch (error) {
    console.error("Daily Report Error:", error);
    return bad("Failed to generate daily report", 500);
  }
}
