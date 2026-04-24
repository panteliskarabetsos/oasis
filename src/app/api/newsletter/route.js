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
const UNSUB_SECRET =
  process.env.NEWSLETTER_UNSUB_SECRET || "fallback-secret-key-change-me";
const b64url = (buf) =>
  Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

function buildUnsubLink(email, origin) {
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

  const email = rawEmail.toLowerCase();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  // 1. Check if user already exists
  const { data: existing, error: selErr } = await admin
    .from("newsletter_subscribers")
    .select("unsubscribed_at")
    .eq("email", email)
    .maybeSingle();

  if (selErr) return bad("Database error", 500, { code: "SELECT_ERR" });

  const isNew = !existing;
  const isResub = !!existing?.unsubscribed_at;

  // 2. Upsert subscriber
  const { error: upsertErr } = await admin
    .from("newsletter_subscribers")
    .upsert(
      { email, confirmed_at: new Date().toISOString(), unsubscribed_at: null },
      { onConflict: "email" },
    );

  if (upsertErr) return bad("Upsert failed", 500, { code: "UPSERT_ERR" });

  // 3. Send Welcome Email (ONLY if they are new or re-subscribing)
  let welcomeSent = false;
  if (isNew || isResub) {
    try {
      const unsubUrl = buildUnsubLink(email, origin);
      await sendWelcomeEmail({ to: email, unsubUrl, origin });
      welcomeSent = true;
    } catch (e) {
      console.error("Welcome Email Failed:", e.message);
      // We still return 200 OK because they ARE subscribed, but we warn the frontend that the email failed.
      return ok({
        ok: true,
        subscribed: true,
        welcomeSent: false,
        error: e.message,
      });
    }
  }

  return ok({ ok: true, subscribed: true, welcomeSent });
}

// --- Email Sender (Forced to use real API) ---
// --- Email Sender (Ultra-Luxury Editorial Design) ---
async function sendWelcomeEmail({ to, unsubUrl, origin }) {
  const subject = "Welcome to Oasis — A return to the rhythm of Crete";

  // Note: For Resend/SendGrid, this MUST be a verified domain (e.g., hello@oasis-retreats.com)
  const from = process.env.NEWSLETTER_FROM || "Oasis <hello@yourdomain.com>";

  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Oasis</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f7f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f7f5f0;padding:40px 20px;">
      <tr>
        <td align="center">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border:1px solid #e5dfd5;">
            
            <tr>
              <td align="center" style="padding:40px 0 30px;">
                <a href="${origin}" style="text-decoration:none;">
                  <span style="font-family:Georgia, serif;font-size:16px;letter-spacing:0.4em;color:#2a201a;text-transform:uppercase;">
                    Oasis
                  </span>
                </a>
              </td>
            </tr>

            <tr>
              <td align="center">
                <a href="${origin}">
                  <img src="https://images.unsplash.com/photo-1777034320699-cdc2ac546e62?q=80&w=1861&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Cretan Landscape" width="600" style="width:100%;max-width:600px;height:auto;display:block;border:none;" />
                </a>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:50px 40px;">
                <h4 style="margin:0 0 16px;font-size:10px;font-weight:bold;letter-spacing:0.3em;text-transform:uppercase;color:#8b6f47;">
                  Welcome to our circle
                </h4>
                <h1 style="margin:0 0 24px;font-family:Georgia, serif;font-size:28px;font-weight:normal;color:#2a201a;line-height:1.3;">
                  A return to the rhythm <br/>
                  <i style="color:#8b6f47;">of the Cretan land.</i>
                </h1>
                
                <p style="margin:0 0 24px;font-size:15px;line-height:1.8;color:#5c4e43;font-weight:300;max-width:400px;">
                  Thank you for joining our inner circle. We will periodically share gentle stories from the island, seasonal recipes from our grandmothers, and early access to our private experiences.
                </p>
                
                <p style="margin:0 0 40px;font-size:15px;line-height:1.8;color:#5c4e43;font-weight:300;">
                  Take a deep breath. You are officially on island time.
                </p>

                <a href="${origin}/experiences" style="display:inline-block;background-color:#8b6f47;color:#ffffff;text-decoration:none;padding:16px 32px;font-size:10px;font-weight:bold;letter-spacing:0.2em;text-transform:uppercase;">
                  Discover Experiences
                </a>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:0 40px;">
                <div style="border-top:1px solid #e5dfd5;width:100%;"></div>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:30px 40px;font-size:11px;line-height:1.6;color:#a89f91;">
                <p style="margin:0 0 10px;">
                  Oasis Cretan Retreats &bull; Chania, Crete, Greece
                </p>
                <p style="margin:0;">
                  If you'd prefer not to receive these dispatches, you can <a href="${unsubUrl}" style="color:#8b6f47;text-decoration:none;border-bottom:1px solid #8b6f47;">unsubscribe here</a> at any time.
                </p>
              </td>
            </tr>
            
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;

  // 1. Throw error if keys are missing
  if (!process.env.RESEND_API_KEY && !process.env.SENDGRID_API_KEY) {
    throw new Error(
      "Missing Email Provider API Key. Add RESEND_API_KEY to your .env file.",
    );
  }

  // 2. Send via Resend
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
    if (!r.ok) throw new Error(`Resend Error ${r.status}: ${await r.text()}`);
    return;
  }

  // 3. Send via SendGrid
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
    if (!r.ok) throw new Error(`SendGrid Error ${r.status}: ${await r.text()}`);
    return;
  }
}

function parseFrom(fromStr) {
  const m = /^(.*)<(.+)>$/.exec(fromStr);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { email: fromStr };
}
