export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import buildInvoicePdf from "@/lib/pdf/buildInvoicePdf";
// Replace with your mailer
import { sendMail } from "@/lib/email/send"; // implement this in your project

const ok = (d, s = 200) =>
  new NextResponse(JSON.stringify(d), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
const bad = (m, s = 400) => ok({ error: m }, s);

export async function POST(_req, { params }) {
  const admin = createSupabaseAdmin();
  const id = Number(params?.id);
  if (!Number.isFinite(id)) return bad("Bad id");

  const { data: inv } = await admin
    .from("invoice")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!inv) return bad("Not found", 404);
  const { data: lines } = await admin
    .from("invoice_line")
    .select("*")
    .eq("invoice_id", id)
    .order("id");

  const buf = await buildInvoicePdf({ invoice: inv, lines });

  const to = inv.buyer?.email;
  if (!to) return bad("Buyer email missing");

  await sendMail({
    to,
    subject: `Invoice ${inv.series}-${String(inv.number).padStart(5, "0")}`,
    text: "Please find your invoice attached.",
    attachments: [
      { filename: "invoice.pdf", content: buf, contentType: "application/pdf" },
    ],
  }).catch((err) => {
    console.error(err);
    throw new Error("Email send failed");
  });

  // optional: mark as 'sent'
  await admin
    .from("invoice")
    .update({ status: inv.status === "draft" ? "sent" : inv.status })
    .eq("id", id);

  return ok({ message: "Invoice email queued." });
}
