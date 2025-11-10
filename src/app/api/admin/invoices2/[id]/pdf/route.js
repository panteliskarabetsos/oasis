export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { buildInvoicePdf, formatInv } from "@/lib/pdf/invoice-pdf-v2";
import { loadInvoiceForPdf } from "@/lib/pdf/load-invoice-for-pdf";

const ok = (d, s = 200, headers = {}) =>
  new NextResponse(d, { status: s, headers });
const bad = (m, s = 400) =>
  ok(JSON.stringify({ error: m }), s, {
    "content-type": "application/json; charset=utf-8",
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
  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) return bad("Invalid invoice id", 400);

  const gate = await requireAdmin();
  if (gate?.error) return gate.response;

  const admin = createSupabaseAdmin();
  const { inv, items, taxesArr, seller } = await loadInvoiceForPdf(admin, id);

  const pdfBytes = await buildInvoicePdf({ inv, items, seller, taxesArr });
  const filename = `${formatInv(inv.series, inv.number)}.pdf`;

  const url = new URL(req.url);
  const dl = url.searchParams.get("dl") ?? url.searchParams.get("download");
  const attachment =
    typeof dl === "string" && /^(1|true|yes|y|attachment|download)$/i.test(dl);

  return ok(Buffer.from(pdfBytes), 200, {
    "content-type": "application/pdf",
    "content-disposition": `${
      attachment ? "attachment" : "inline"
    }; filename="${filename}"`,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
}
