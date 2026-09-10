import { NextResponse } from "next/server";

import { accessCan, requireAdmin } from "@/lib/auth/requireAdmin";
import buildReceiptPdfBuffer from "@/lib/pdf/buildReceipt";
import { storeIdentity } from "@/lib/storeIdentity";

// A receipt carries a customer's name, email and what they bought, so this
// is staff-only. It was open to anyone who could guess a row id.
export async function GET(req, { params }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  if (!accessCan(auth.permissions, "pos") && !accessCan(auth.permissions, "zreport")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const { data: receipt } = await auth.admin
    .from("Receipt")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!receipt)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Generate the PDF Buffer
  const pdfBuffer = await buildReceiptPdfBuffer({
    receipt,
    store: storeIdentity(),
  });

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${id}.pdf"`,
    },
  });
}
