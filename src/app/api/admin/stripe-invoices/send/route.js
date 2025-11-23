// app/api/admin/stripe-invoices/send/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import "server-only";
import { NextResponse } from "next/server";
import Stripe from "stripe";

/* --------------------------- shared helpers --------------------------- */

function brandName() {
  return process.env.NEXT_PUBLIC_SITE_NAME || "Oasis";
}

async function fetchPdfBuffer(url) {
  const res = await fetch(url, { cache: "no-store", redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function sendMail({ to, subject, html, attachments }) {
  const apiKey = process.env.RESEND_API_KEY;

  let from = process.env.EMAIL_FROM;
  if (!from) {
    if (process.env.NODE_ENV !== "production") {
      from = "Oasis Bookings <onboarding@resend.dev>";
    } else {
      throw new Error("EMAIL_FROM is not set. Use a verified domain address.");
    }
  }
  if (/@(gmail|googlemail|outlook|hotmail|live|yahoo|icloud)\.com\s*>?$/.test(from)) {
    throw new Error(
      `EMAIL_FROM cannot be a mailbox-provider domain (${from}). Use onboarding@resend.dev in dev or a verified domain in production.`
    );
  }

  if (!apiKey) {
    console.log("[DEV] sendMail dry-run (missing RESEND_API_KEY):", { to, subject });
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const res = await resend.emails.send({
    from,
    to,
    subject,
    html,
    attachments: attachments && attachments.length ? attachments : undefined,
  });
  if (res && res.error) throw new Error(res.error.message || "Mail provider error");
}

function isResendRestrictedError(err) {
  const msg = String(err?.message || "");
  return /verify a domain|only send testing emails/i.test(msg);
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

/* ------------------------------- route -------------------------------- */

export async function POST(req) {
  const fd = await req.formData();
  const invoiceId = String(fd.get("invoice_id") || "").trim();

  const base = "/admin/invoices?source=stripe";
  const seeOther = (qs) => NextResponse.redirect(new URL(`${base}${qs}`, req.url), 303);

  if (!invoiceId) return seeOther("&err=bad_id");

  try {
    const stripe = await getStripe();

    // 1) Load invoice + customer email
    let inv = await stripe.invoices.retrieve(invoiceId, { expand: ["customer"] });
    const email = inv.customer_email || inv.customer?.email || "";
    if (!email) return seeOther("&err=no_email");

    // 2) Finalize drafts so they can be sent
    if (inv.status === "draft") {
      inv = await stripe.invoices.finalizeInvoice(inv.id);
    }

    // 3) Primary path: Stripe sends the email for open, "send_invoice" invoices
    const canStripeSend = inv.collection_method === "send_invoice" && inv.status === "open";
    if (canStripeSend) {
      await stripe.invoices.sendInvoice(inv.id);
      return seeOther(`&sent=${encodeURIComponent(inv.number || inv.id)}`);
    }

    // 4) Fallback: already paid (or not "send_invoice") → email the PDF ourselves
    if (inv.status === "paid" && inv.invoice_pdf) {
      // Dev/ops guard: if Resend isn't configured, don't attempt to send
      if (!process.env.RESEND_API_KEY) {
        console.warn("[stripe-invoices/send] RESEND_API_KEY missing; skipping mail");
        return seeOther("&err=mail_restricted");
      }

const pdfBuffer = await fetchPdfBuffer(inv.invoice_pdf);
const attachments = [
  {
    filename: `${inv.number || inv.id}.pdf`,
    content: pdfBuffer,              // ✅ Buffer
    // Optional (harmless but explicit):
    // contentType: "application/pdf",
  },
];

      const subject = `Invoice ${inv.number || inv.id} · ${brandName()}`;
    const invoiceNo = inv.number || inv.id;
const amount = (() => {
  try {
    const cur = (inv.currency || "eur").toUpperCase();
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: cur }).format((inv.total || 0) / 100);
  } catch {
    return `€${(((inv.total || 0) / 100) || 0).toFixed(2)}`;
  }
})();
const issued = inv.created ? new Date(inv.created * 1000).toLocaleDateString("en-GB", { year:"numeric", month:"short", day:"numeric" }) : "";
const due = inv.due_date ? new Date(inv.due_date * 1000).toLocaleDateString("en-GB", { year:"numeric", month:"short", day:"numeric" }) : "";
const status = (inv.status || "").replace("_", " ");
const hosted = inv.hosted_invoice_url || hosted; // keep your existing var if set

const statusColors = (() => {
  switch ((inv.status || "").toLowerCase()) {
    case "open": return { bg:"#e6f4ea", fg:"#0f5132", br:"#c6e9d1" };           // green-ish
    case "paid": return { bg:"#eef2ff", fg:"#3730a3", br:"#e0e7ff" };           // indigo-ish
    case "draft": return { bg:"#fff7ed", fg:"#9a3412", br:"#ffedd5" };          // amber-ish
    case "void": return { bg:"#fef2f2", fg:"#991b1b", br:"#fee2e2" };           // red-ish
    case "uncollectible": return { bg:"#f1f5f9", fg:"#334155", br:"#e2e8f0" };  // slate-ish
    default: return { bg:"#f3f4f6", fg:"#374151", br:"#e5e7eb" };
  }
})();
const brand = brandName();

const html = `
<!-- Preheader for inbox preview -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
  Your ${brand} invoice ${invoiceNo}${amount ? ` · ${amount}` : ""}.
</div>

<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f6f5f2" style="background:#f6f5f2;margin:0;padding:24px 0;">
  <tr>
    <td align="center" style="padding:0 12px;">
      <table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #ece7df;">
        <!-- Header -->
        <tr>
          <td align="left" style="padding:20px 24px;border-bottom:1px solid #f0ebe3;">
            <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;font-size:14px;line-height:20px;color:#6b5a48;">
              <strong style="font-size:16px;color:#3f382f;">${brand}</strong>
              <div style="margin-top:4px;color:#7a6a58;">Invoice notification</div>
            </div>
          </td>
        </tr>

        <!-- Title -->
        <tr>
          <td style="padding:24px;">
            <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
              <h1 style="margin:0;font-size:22px;line-height:28px;color:#3f382f;">Invoice ${invoiceNo}</h1>
              <p style="margin:8px 0 0;color:#7a6a58;font-size:14px;line-height:20px;">
                Thank you for your business. ${amount ? `Total: <strong style="color:#3f382f;">${amount}</strong>.` : ""}
              </p>
            </div>
          </td>
        </tr>

        <!-- Summary card -->
        <tr>
          <td style="padding:0 24px 8px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #efeae1;border-radius:10px;overflow:hidden;">
              <tr>
                <td style="background:#fcfbf8;padding:10px 12px;width:150px;border-bottom:1px solid #efeae1;font-family:ui-sans-serif,system-ui; font-size:12px;color:#7a6a58;">Status</td>
                <td style="padding:10px 12px;border-bottom:1px solid #efeae1;">
                  <span style="display:inline-block;padding:4px 10px;border:1px solid ${statusColors.br};background:${statusColors.bg};color:${statusColors.fg};border-radius:999px;font-family:ui-sans-serif,system-ui;font-size:12px;line-height:16px;text-transform:capitalize;">
                    ${status || "—"}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="background:#fcfbf8;padding:10px 12px;width:150px;border-bottom:1px solid #efeae1;font-family:ui-sans-serif,system-ui; font-size:12px;color:#7a6a58;">Amount</td>
                <td style="padding:10px 12px;border-bottom:1px solid #efeae1;font-family:ui-sans-serif,system-ui; font-size:14px;color:#3f382f;">
                  ${amount || "—"}
                </td>
              </tr>
              <tr>
                <td style="background:#fcfbf8;padding:10px 12px;width:150px;border-bottom:1px solid #efeae1;font-family:ui-sans-serif,system-ui; font-size:12px;color:#7a6a58;">Issued</td>
                <td style="padding:10px 12px;border-bottom:1px solid #efeae1;font-family:ui-sans-serif,system-ui; font-size:14px;color:#3f382f;">
                  ${issued || "—"}
                </td>
              </tr>
              <tr>
                <td style="background:#fcfbf8;padding:10px 12px;width:150px;font-family:ui-sans-serif,system-ui; font-size:12px;color:#7a6a58;">Due</td>
                <td style="padding:10px 12px;font-family:ui-sans-serif,system-ui; font-size:14px;color:#3f382f;">
                  ${due || (status === "paid" ? "Paid" : "—")}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        ${hosted ? `
        <tr>
          <td align="left" style="padding:8px 24px 20px;">
            <a href="${hosted}" target="_blank"
               style="display:inline-block;background:#8b6f47;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-family:ui-sans-serif,system-ui;font-size:14px;line-height:20px;">
              View invoice
            </a>
            <div style="font-family:ui-sans-serif,system-ui;font-size:12px;color:#7a6a58;margin-top:8px;">
              A PDF copy is attached to this email for your records.
            </div>
          </td>
        </tr>` : `
        <tr>
          <td style="padding:8px 24px 20px;">
            <div style="font-family:ui-sans-serif,system-ui;font-size:14px;line-height:20px;color:#3f382f;">
              A PDF copy of your invoice is attached to this email.
            </div>
          </td>
        </tr>`}

        <!-- Footer -->
        <tr>
          <td style="padding:16px 24px 20px;border-top:1px solid #f0ebe3;">
            <div style="font-family:ui-sans-serif,system-ui; font-size:12px; line-height:18px; color:#7a6a58;">
              Need help? Reply to this email or contact billing at <a href="mailto:billing@${brand.toLowerCase().replace(/\\s+/g,'')}.com" style="color:#6b5a48;text-decoration:underline;">billing@${brand.toLowerCase().replace(/\\s+/g,'')}.com</a>.
              <br/>© ${new Date().getFullYear()} ${brand}. All rights reserved.
            </div>
          </td>
        </tr>
      </table>

      <!-- Legal line -->
      <div style="max-width:600px;margin:12px auto 0;font-family:ui-sans-serif,system-ui; font-size:11px; line-height:16px; color:#a08f7c;">
        You’re receiving this because an invoice was issued for your account.
      </div>
    </td>
  </tr>
</table>
`;


      try {
        await sendMail({ to: email, subject, html, attachments });
        return seeOther(`&sent=${encodeURIComponent(inv.number || inv.id)}&via=mail`);
      } catch (e) {
        console.error("[stripe-invoices/send] mail fallback failed:", e);
        return seeOther(isResendRestrictedError(e) ? "&err=mail_restricted" : "&err=send_fail");
      }
    }

    // 5) Not sendable and no PDF fallback -> tell the UI
    return seeOther("&err=not_sendable");
  } catch (e) {
    console.error("[stripe-invoices/send] error:", e);
    return seeOther("&err=send_fail");
  }
}
