// ==============================================
// /app/api/admin/invoices/[id]/send/route.js  — send email with PDF
// ==============================================
import { NextResponse as NextResponse4 } from "next/server";
import { getSupabaseAdmin as getSupabaseAdmin4 } from "@/lib/supabaseAdmin";
import { buildInvoicePdfBuffer } from "@/lib/pdf/buildInvoicePdf";
import { sendTransactionalEmail } from "@/lib/email/sendTransactionalEmail";

export async function POST(_req, { params }) {
  const supabase = getSupabaseAdmin4();
  const id = Number(params.id);

  const { data: inv, error } = await supabase
    .from("invoices")
    .select(
      "*, invoice_items(*), Booking:bookingId(id, startTime), Experience:Booking(experienceId) !inner"
    )
    .eq("id", id)
    .single();
  if (error || !inv)
    return NextResponse4.json(
      { error: error?.message || "Not found" },
      { status: 404 }
    );

  if (!inv.customerEmail)
    return NextResponse4.json(
      { error: "Invoice has no customer email" },
      { status: 400 }
    );

  // Generate PDF
  const pdf = await buildInvoicePdfBuffer({ invoice: inv });

  // Send email (implement inside lib/email)
  await sendTransactionalEmail({
    to: inv.customerEmail,
    subject: `Invoice ${inv.number || `#${inv.id}`}`,
    html: `<p>Hello ${
      inv.customerName || ""
    },</p><p>Please find attached your invoice ${
      inv.number || `#${inv.id}`
    }.</p>`,
    attachments: [
      {
        filename: `${inv.number || `invoice-${inv.id}`}.pdf`,
        content: pdf,
      },
    ],
  });

  // Mark as sent if it was draft; leave as paid if already paid
  if (inv.status === "draft") {
    await supabase.from("invoices").update({ status: "sent" }).eq("id", id);
  }

  return NextResponse4.json({ ok: true });
}
