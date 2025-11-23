// ==============================================
// /app/api/admin/invoices/eligible-bookings/route.js
// — Paid bookings without an invoice yet
// ==============================================
import { NextResponse as NextResponse2 } from "next/server";
import { getSupabaseAdmin as getSupabaseAdmin2 } from "@/lib/supabaseAdmin";

export async function GET() {
  const supabase = getSupabaseAdmin2();
  // Assuming Booking has totalPaidAmount and currency; and invoices have bookingId FK
  const { data: bookings, error } = await supabase.rpc(
    "get_paid_bookings_without_invoice"
  );

  // If RPC not present, fallback to a simple (less efficient) way
  let result = bookings;
  if (error || !bookings) {
    const { data: paid, error: e1 } = await supabase
      .from("Booking")
      .select(
        "id, experienceId, startTime, currency, totalPaidAmount, primary_contact"
      )
      .gt("totalPaidAmount", 0);
    if (e1) return NextResponse2.json({ error: e1.message }, { status: 400 });

    const { data: already, error: e2 } = await supabase
      .from("invoices")
      .select("bookingId")
      .not("bookingId", "is", null);
    if (e2) return NextResponse2.json({ error: e2.message }, { status: 400 });
    const invoiced = new Set((already || []).map((x) => x.bookingId));

    // Fetch experience names
    const expIds = Array.from(
      new Set((paid || []).map((p) => p.experienceId))
    ).filter(Boolean);
    const { data: exps } = await supabase
      .from("Experience")
      .select("id, name")
      .in("id", expIds);
    const expMap = new Map((exps || []).map((e) => [e.id, e.name]));

    result = (paid || [])
      .filter((b) => !invoiced.has(b.id))
      .map((b) => ({
        ...b,
        experienceName: expMap.get(b.experienceId) || "",
      }));
  }

  return NextResponse2.json({ bookings: result || [] });
}
