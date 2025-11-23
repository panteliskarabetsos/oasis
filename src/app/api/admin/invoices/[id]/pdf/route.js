// ==============================================
// /app/api/admin/invoices/[id]/pdf/route.js — returns PDF for preview
// ==============================================
import { NextResponse as NextResponse5 } from "next/server";
import { getSupabaseAdmin as getSupabaseAdmin5 } from "@/lib/supabaseAdmin";
import { buildInvoicePdfBuffer as buildInvoicePdfBuffer2 } from "@/lib/pdf/buildInvoicePdf";

export async function GET(_req, { params }) {
  const supabase = getSupabaseAdmin5();
  const id = Number(params.id);
  const { data: inv, error } = await supabase
    .from("invoices")
    .select("*, invoice_items(*), Booking:bookingId(id, startTime)")
    .eq("id", id)
    .single();
  if (error || !inv)
    return NextResponse5.json(
      { error: error?.message || "Not found" },
      { status: 404 }
    );
  const pdf = await buildInvoicePdfBuffer2({ invoice: inv });
  return new NextResponse5(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=${
        inv.number || `invoice-${inv.id}`
      }.pdf`,
    },
  });
}
