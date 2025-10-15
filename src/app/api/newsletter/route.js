// src/app/api/newsletter/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createHmac } from "crypto";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400, extra = {}) =>
  NextResponse.json({ error: m, ...extra }, { status: s });

const isEmail = (x = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);

// --- Unsubscribe link helpers (stateless HMAC) ---
const UNSUB_SECRET = process.env.NEWSLETTER_UNSUB_SECRET || "";
const b64url = (buf) =>
  Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
function buildUnsubLink(email, origin) {
  if (!UNSUB_SECRET) return `${origin}/contact`;
  const canonical = String(email).trim().toLowerCase();
  const sig = createHmac("sha256", UNSUB_SECRET).update(canonical).digest();
  const url = new URL("/api/newsletter/unsubscribe", origin);
  url.searchParams.set("email", canonical);
  url.searchParams.set("sig", b64url(sig));
  return url.toString();
}

export async function POST(req) {
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500, { code: "NO_ADMIN" });

  let body = {};
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON");
  }

  const rawEmail = (body.email || "").trim();
  if (!isEmail(rawEmail)) return bad("Invalid email", 422);

  // single opt‑in: subscribe immediately
  const email = rawEmail.toLowerCase(); // CITEXT column handles case-insensitive uniqueness
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  // probe table (clearer error on first run)
  const { error: probeErr } = await admin
    .from("newsletter_subscribers")
    .select("email")
    .limit(1);
  if (probeErr)
    return bad("Table not found", 500, {
      code: "NO_TABLE",
      detail: probeErr.message,
    });

  // read existing to decide if we should send welcome
  const { data: existing, error: selErr } = await admin
    .from("newsletter_subscribers")
    .select("unsubscribed_at")
    .eq("email", email)
    .maybeSingle();
  if (selErr)
    return bad("Database error", 500, {
      code: "SELECT_ERR",
      detail: selErr.message,
    });

  const isNew = !existing;
  const isResub = !!existing?.unsubscribed_at;

  // upsert & mark confirmed now; clear any previous unsubscribe flag
  const { error: upsertErr } = await admin
    .from("newsletter_subscribers")
    .upsert(
      { email, confirmed_at: new Date().toISOString(), unsubscribed_at: null },
      { onConflict: "email" }
    );
  if (upsertErr)
    return bad("Upsert failed", 500, {
      code: "UPSERT_ERR",
      detail: upsertErr.message,
    });

  // send welcome only for first-time or re-subscribe
  let welcomeSent = false;
  if (isNew || isResub) {
    try {
      const unsubUrl = buildUnsubLink(email, origin);
      await sendWelcomeEmail({ to: email, unsubUrl, origin });
      welcomeSent = true;
    } catch (e) {
      console.warn("sendWelcomeEmail failed:", e?.message || e);
    }
  }

  return ok({ ok: true, subscribed: true, welcomeSent });
}

// --- Welcome email sender (no SDK deps; uses fetch) ---
async function sendWelcomeEmail({ to, unsubUrl, origin }) {
  const subject = "Welcome to Oasis — thanks for subscribing";
  const from = process.env.NEWSLETTER_FROM || "Oasis <hello@yourdomain>";
  const html = `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;color:#2f2f2f;background:#f7f4ef;padding:24px">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #eee;overflow:hidden">
      <div style="padding:28px 28px 8px">
        <h1 style="margin:0;font-size:22px;line-height:1.3;color:#5a4a3f;">
          Welcome to <span style="color:#a3845b">Oasis</span>
        </h1>
        <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#444">
          Thanks for joining our newsletter. We'll share gentle stories from Crete, opening updates, and early-bird dates.
        </p>
      </div>
      <div style="padding:16px 28px 28px">
        <a href="${origin}" style="display:inline-block;background:#a3845b;color:#fff;text-decoration:none;padding:10px 16px;border-radius:999px;font-weight:600">Visit Oasis</a>
      </div>
      <div style="padding:16px 28px 24px;font-size:12px;color:#666;border-top:1px solid #f0ece6">
        <p style="margin:0 0 8px">If you prefer not to receive these emails, you can <a href="${unsubUrl}">unsubscribe instantly</a>.</p>
        <p style="margin:0;color:#888">© ${new Date().getFullYear()} Oasis</p>
      </div>
    </div>
  </div>`;

  // Prefer RESEND, then SENDGRID; fall back to dev log. No SDK installs required.
  if (process.env.RESEND_API_KEY) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        headers: {
          "List-Unsubscribe": `<${unsubUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
    return;
  }

  if (process.env.SENDGRID_API_KEY) {
    const fromObj = parseFrom(from);
    const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }], subject }],
        from: fromObj,
        content: [{ type: "text/html", value: html }],
        headers: {
          "List-Unsubscribe": `<${unsubUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });
    if (!r.ok) throw new Error(`SendGrid ${r.status}: ${await r.text()}`);
    return;
  }

  // Dev fallback
  console.log("[DEV] Welcome email →", to, "unsubscribe:", unsubUrl);
}

function parseFrom(fromStr) {
  const m = /^(.*)<(.+)>$/.exec(fromStr);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { email: fromStr };
}
