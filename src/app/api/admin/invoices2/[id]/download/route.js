export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import buildInvoicePdf from "@/lib/pdf/buildInvoicePdf";

export async function GET(_req, { params }) {
  const admin = createSupabaseAdmin();
  const id = Number(params?.id);
  if (!Number.isFinite(id)) return new NextResponse("Bad id", { status: 400 });

  const { data: inv } = await admin
    .from("invoice")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!inv) return new NextResponse("Not found", { status: 404 });
  const { data: lines } = await admin
    .from("invoice_line")
    .select("*")
    .eq("invoice_id", id)
    .order("id");

  const buf = await buildInvoicePdf({ invoice: inv, lines });
  const filename = `${inv.series}-${String(inv.number).padStart(5, "0")}.pdf`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
