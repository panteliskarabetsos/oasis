// src/app/api/admin/invoices2/[id]/download/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import buildInvoicePdf from "@/lib/pdf/buildInvoicePdf";

const bad = (m, s = 400) =>
  new NextResponse(JSON.stringify({ error: m }), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

async function requireAdmin() {
  const supa = await createSupabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return { error: true, response: bad("Unauthorized", 401) };
  const { data: row, error } = await supa
    .from("User")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (error || (row?.role ?? "user") !== "admin")
    return { error: true, response: bad("Forbidden", 403) };
  return { error: false };
}

export async function GET(req, ctx) {
  // Next 15: params must be awaited
  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) return bad("Invalid id", 400);

  const gate = await requireAdmin();
  if (gate?.error) return gate.response;

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  // Load invoice
  const { data: inv, error: e1 } = await admin
    .from("invoice")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (e1) return bad(e1.message || "Load failed", 500);
  if (!inv) return bad("Not found", 404);

  // Load lines using schema field names; map aliases for builder compatibility
  const { data: lines, error: e2 } = await admin
    .from("invoice_line")
    .select(
      "id, description, quantity, unit_price, vat_rate, discount_percent, line_subtotal, line_tax, line_total"
    )
    .eq("invoice_id", id)
    .order("id");
  if (e2) return bad(e2.message || "Load lines failed", 500);

  const mappedLines = (lines || []).map((l) => ({
    ...l,
    // Aliases some builders expect
    base_amount: Number(l.line_subtotal ?? 0),
    tax_amount: Number(l.line_tax ?? 0),
    total_amount: Number(l.line_total ?? 0),
  }));

  const buf = await buildInvoicePdf({ invoice: inv, lines: mappedLines });

  const filename = `${String(inv.series || "A").toUpperCase()}-${String(
    inv.number
  ).padStart(5, "0")}.pdf`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
