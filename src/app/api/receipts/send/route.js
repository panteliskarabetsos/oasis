// src/app/api/receipts/send/route.js
import { NextResponse } from "next/server";

import { accessCan, requireAdmin } from "@/lib/auth/requireAdmin";
import sendReceiptEmail, { markReceiptEmailed } from "@/lib/email/sendReceiptEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Resend a receipt to a customer.
 *
 * The receipt is always loaded from the database by id. It used to be taken
 * from the request body, which — on an unauthenticated route — let anyone
 * have arbitrary content emailed as a PDF from the Oasis address.
 */
export async function POST(req) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  if (!accessCan(auth.permissions, "pos") && !accessCan(auth.permissions, "zreport")) {
    return bad("Forbidden", 403);
  }

  try {
    const body = await req.json().catch(() => ({}));

    const receiptId = Number(body?.receiptId ?? body?.receipt?.id);
    if (!Number.isFinite(receiptId) || receiptId <= 0) {
      return bad("A receipt id is required", 400);
    }

    const { data: receipt, error } = await auth.admin
      .from("Receipt")
      .select("*")
      .eq("id", receiptId)
      .maybeSingle();

    if (error) return bad(error.message, 500);
    if (!receipt) return bad("Receipt not found", 404);

    // The cashier may correct a mistyped address; anything else comes off the
    // stored receipt.
    const to = String(body?.email || receipt.customerEmail || "").trim();

    const result = await sendReceiptEmail({ receipt, to });

    if (!result.sent) {
      const status = result.reason === "send-failed" ? 502 : 400;
      return NextResponse.json(
        { error: EXPLAIN[result.reason] || result.error || "Could not send the receipt" },
        { status },
      );
    }

    await markReceiptEmailed(auth.admin, receipt.id);

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      sentTo: result.to,
      receiptId: receipt.id,
    });
  } catch (error) {
    console.error("Receipt email API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send receipt email" },
      { status: 500 },
    );
  }
}

const EXPLAIN = {
  "no-email": "This receipt has no customer email address.",
  "invalid-email": "That email address doesn't look valid.",
};
