// ==============================================
// /app/api/admin/invoices/booking/[id]/route.js
// — Prefill data for a booking (server-authoritative)
// ==============================================
import { NextResponse as NextResponse3 } from "next/server";
import { getSupabaseAdmin as getSupabaseAdmin3 } from "@/lib/supabaseAdmin";

export async function GET(req, { params }) {
  const supabase = getSupabaseAdmin3();
  const id = Number(params.id);
  const { data: b, error } = await supabase
    .from("Booking")
    .select(
      "id, primary_contact, experienceId, currency, totalPaidAmount, startTime, Experience:experienceId(name)"
    )
    .eq("id", id)
    .single();
  if (error || !b)
    return NextResponse3.json(
      { error: error?.message || "Not found" },
      { status: 404 }
    );

  const item = {
    description: `Experience: ${b.Experience?.name || "Booking"} — ${new Date(
      b.startTime
    ).toLocaleDateString("el-GR")}`,
    quantity: 1,
    unitPrice: b.totalPaidAmount,
    taxRate: 0,
  };
  const prefill = {
    customerName: b.primary_contact?.name || b.primary_contact?.email || "",
    customerEmail: b.primary_contact?.email || "",
    currency: b.currency?.toUpperCase?.() || "EUR",
    items: [item],
  };
  return NextResponse3.json({ prefill });
}
