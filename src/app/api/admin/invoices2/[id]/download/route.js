// src/app/api/admin/invoices2/[id]/download/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { accessCan, resolveStaffAccess } from "@/lib/auth/requireAdmin";
import { buildInvoicePdf, formatInv } from "@/lib/pdf/invoice-pdf-v2";
import { loadInvoiceForPdf } from "@/lib/pdf/load-invoice-for-pdf";

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
  // Resolve the role with the service client — the user client is RLS-bound
  // and was silently downgrading real admins to "user".
  const { role, permissions } = await resolveStaffAccess(user);
  if (!accessCan(permissions, "invoices"))
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

  // loadInvoiceForPdf throws (rather than returning null) for a missing id
  let buf;
  let filename;
  try {
    const { inv, items, taxesArr, seller } = await loadInvoiceForPdf(admin, id);
    const pdfBytes = await buildInvoicePdf({ inv, items, seller, taxesArr });
    buf = Buffer.from(pdfBytes);
    filename = `${formatInv(inv.series, inv.number)}.pdf`;
  } catch (e) {
    const msg = e?.message || "Failed to build the invoice PDF";
    return bad(msg, /not found/i.test(msg) ? 404 : 500);
  }

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
