// src/app/api/admin/invoices2/[id]/send/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { Resend } from "resend";
import { buildInvoicePdf, formatInv } from "@/lib/pdf/invoice-pdf-v2";
import { loadInvoiceForPdf } from "@/lib/pdf/load-invoice-for-pdf";

const ok = (d, s = 200, h = {}) =>
  new NextResponse(JSON.stringify(d), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8", ...h },
  });
const bad = (m, s = 400) => ok({ error: m }, s);

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

export async function GET() {
  return ok({ ok: true });
}

export async function POST(_req, ctx) {
  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) return bad("Bad id");

  const gate = await requireAdmin();
  if (gate?.error) return gate.response;

  const admin = createSupabaseAdmin();
  const { inv, items, taxesArr, seller } = await loadInvoiceForPdf(admin, id);

  const buyer =
    (typeof inv.buyer === "object"
      ? inv.buyer
      : (() => {
          try {
            return JSON.parse(inv.buyer || "{}");
          } catch {
            return {};
          }
        })()) || {};
  const to = buyer.email;
  if (!to) return bad("Invoice has no recipient email");

  const pdfBytes = await buildInvoicePdf({ inv, items, seller, taxesArr });
  const invNo = formatInv(inv.series, inv.number);

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM || "invoices@yourdomain.com";
  const subject = `Invoice ${invNo} from ${seller.name || "Oasis"}`;
  const html = `
    <p>Hello ${buyer.name || buyer.business_name || ""},</p>
    <p>Please find your invoice <strong>${invNo}</strong> attached.</p>
    <p>Thank you,<br/>${seller.name || "Oasis"}</p>
  `;

  const { error: sendErr } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    attachments: [
      {
        filename: `${invNo}.pdf`,
        content: Buffer.from(pdfBytes).toString("base64"),
      },
    ],
  });

  if (sendErr) return bad(sendErr.message || "Send failed", 500);

  // IMPORTANT: Do NOT change status (e.g., finalized → sent). Leave as-is.
  // If you later want telemetry, add a separate column (e.g., emailed_at) and set it here.

  return ok({ ok: true, message: `Invoice ${invNo} emailed to ${to}` });
}
