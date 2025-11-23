export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { transporter } from "@/lib/email/nodemailer";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

async function requireAdmin() {
  const supa = await createSupabaseServer();
  const { data: userData, error } = await supa.auth.getUser();
  if (error || !userData?.user) return { err: bad("Unauthorized", 401) };

  const user = userData.user;
  // quick metadata role check
  const metaRole =
    user.app_metadata?.role || user.user_metadata?.role || "user";
  if (metaRole === "admin") return { user };

  // fallback to DB role
  const admin = createSupabaseAdmin();
  if (!admin) return { err: bad("Server not configured", 500) };

  const { data: row, error: rerr } = await admin
    .from("User")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (rerr) return { err: bad("Server error", 500) };
  if (row?.role === "admin") return { user };

  return { err: bad("Unauthorized", 401) };
}

export async function POST(req) {
  const gate = await requireAdmin();
  if (gate.err) return gate.err;

  const { subject, category, priority, message, diagnostics } =
    await req.json();

  if (!subject || !message) {
    return bad("Subject and message are required.", 422);
  }

  const supportTo = process.env.SUPPORT_EMAIL || process.env.EMAIL_TO || "";
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || "";
  if (!supportTo || !from) return bad("Support email not configured.", 500);

  const safeCategory = String(category || "question").toUpperCase();
  const safePriority = String(priority || "normal").toUpperCase();

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#222">
      <h2 style="margin:0 0 8px">New Admin Support Message</h2>
      <p style="margin:0 0 12px">
        <strong>Category:</strong> ${safeCategory}<br/>
        <strong>Priority:</strong> ${safePriority}
      </p>

      <h3 style="margin:16px 0 8px">From</h3>
      <p style="margin:0 0 12px">
        <strong>Email:</strong> ${gate.user.email || "(unknown)"}<br/>
        <strong>User ID:</strong> ${gate.user.id}
      </p>

      <h3 style="margin:16px 0 8px">Subject</h3>
      <p style="white-space:pre-wrap;margin:0 0 12px">${escapeHtml(subject)}</p>

      <h3 style="margin:16px 0 8px">Message</h3>
      <pre style="white-space:pre-wrap;background:#fafafa;border:1px solid #eee;border-radius:8px;padding:12px">${escapeHtml(
        message
      )}</pre>

      ${
        diagnostics
          ? `
      <h3 style="margin:16px 0 8px">Diagnostics</h3>
      <pre style="white-space:pre-wrap;background:#f6f6f6;border:1px solid #eee;border-radius:8px;padding:12px">${escapeHtml(
        JSON.stringify(diagnostics, null, 2)
      )}</pre>`
          : ""
      }
    </div>
  `;

  try {
    await transporter.sendMail({
      to: supportTo,
      from,
      subject: `[ADMIN ${safePriority}] ${subject}`,
      html,
    });
    return ok({ sent: true });
  } catch (e) {
    console.error("[admin/help/contact] send error", e);
    return bad("Failed to send email.", 500);
  }
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
