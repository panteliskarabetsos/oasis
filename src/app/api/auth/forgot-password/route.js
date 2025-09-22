export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { transporter } from "@/lib/email/nodemailer";
import { generatePasswordResetEmail } from "@/lib/email/passwordResetEmail";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ message: m }, { status: s });

export async function POST(req) {
  const supa = await createSupabaseServer();
  const admin = createSupabaseAdmin();
  if (!supa || !admin) return bad("Server not configured", 500);

  const { email, recaptchaToken } = await req.json().catch(() => ({}));
  if (!email) return bad("Email is required");
  if (!recaptchaToken) return bad("reCAPTCHA token missing");

  // Verify reCAPTCHA (v2/v3)
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return bad("Server not configured", 500);
  try {
    const params = new URLSearchParams();
    params.append("secret", secret);
    params.append("response", recaptchaToken);
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      undefined;
    if (ip) params.append("remoteip", ip);

    const vr = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      cache: "no-store",
    }).then((r) => r.json());

    if (!vr?.success) return bad("reCAPTCHA verification failed", 400);
  } catch (e) {
    console.error("[forgot-password] recaptcha error", e);
    return bad("reCAPTCHA verification failed", 400);
  }

  // Build origin & reset URL
  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const origin = envOrigin || (host ? `${proto}://${host}` : "");
  const expiresInMinutes = 60;

  try {
    // Lookup user in your public."User" table to get auth_user_id
    const emailLc = String(email).toLowerCase().trim();
    const { data: profile } = await admin
      .from("User")
      .select("id, name, email, auth_user_id")
      .eq("email", emailLc)
      .maybeSingle();

    // Always return generic success (no enumeration)
    if (!profile?.auth_user_id) {
      return ok({
        message:
          "If the email exists, a reset link has been sent. Please check your inbox.",
      });
    }

    // Generate token & hash
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const expiresAt = new Date(
      Date.now() + expiresInMinutes * 60 * 1000
    ).toISOString();

    // Store token
    const { error: insErr } = await admin.from("PasswordReset").insert({
      auth_user_id: profile.auth_user_id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      requested_ip:
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      user_agent: req.headers.get("user-agent") || null,
    });
    if (insErr) {
      console.error("[forgot-password] insert token error", insErr);
      // Still generic success
      return ok({
        message:
          "If the email exists, a reset link has been sent. Please check your inbox.",
      });
    }

    const resetUrl = `${origin}/reset-password?token=${token}`;

    // Send your custom email
    try {
      const { subject, html } = generatePasswordResetEmail({
        name: profile.name,
        email: profile.email,
        resetUrl,
      });
      await transporter.sendMail({
        to: profile.email,
        from: `"Oasis" <${process.env.EMAIL_USER}>`,
        subject,
        html,
      });
    } catch (mailErr) {
      console.warn("[forgot-password] email send failed", mailErr);
    }

    return ok({
      message:
        "If the email exists, a reset link has been sent. Please check your inbox.",
    });
  } catch (e) {
    console.error("[forgot-password] unexpected", e);
    return ok({
      message:
        "If the email exists, a reset link has been sent. Please check your inbox.",
    });
  }
}
