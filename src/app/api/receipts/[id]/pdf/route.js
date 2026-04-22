import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import buildReceiptPdfBuffer from "@/lib/pdf/buildReceipt";

export async function GET(req, { params }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const { id } = await params;

  const { data: receipt } = await supabase
    .from("Receipt")
    .select("*")
    .eq("id", id)
    .single();

  if (!receipt)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Generate the PDF Buffer
  const pdfBuffer = await buildReceiptPdfBuffer({
    receipt,
    store: {
      name: "Oasis",
      address: "123 Artisan Lane\nChania, Crete 73100",
      taxId: "EL123456789",
    },
  });

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${id}.pdf"`,
    },
  });
}
