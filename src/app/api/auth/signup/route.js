// src/app/api/auth/signup/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const send = (body, status = 200) => NextResponse.json(body, { status });

// DEBUGGING: set EXPOSE_ERRORS=1 to surface _debug details to the client
const dev = process.env.NODE_ENV !== "production";
const expose = dev || process.env.EXPOSE_ERRORS === "1";

// Optional: set DISABLE_CAPTCHA=1 to bypass captcha temporarily (only for debugging!)
const disableCaptcha = process.env.DISABLE_CAPTCHA === "1";

const normalizeEmail = (v) =>
  String(v || "")
    .trim()
    .toLowerCase();
const clean = (v) => {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
};
const isStrongPw = (p) => typeof p === "string" && p.length >= 8;

function errOut(step, message, detail, status = 500) {
  const base = { error: message || "Server error" };
  if (expose) base._debug = { step, detail };
  // Also log to server for good measure
  console.error(`[signup] ${step}:`, detail || message);
  return send(base, status);
}

export async function POST(req) {
  // --- ensure admin client really exists (service role) ---
  const admin = createSupabaseAdmin();
  if (!admin) return errOut("boot", "Server not configured", "no admin client");

  // quick sanity check the client is privileged enough
  // (will be undefined/forbidden if anon key is accidentally used)
  try {
    // harmless request that requires service key privileges
    await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  } catch (e) {
    return errOut(
      "admin_client",
      "Supabase admin client is not using a service role key",
      String(e),
      500
    );
  }

  // --- parse & validate body ---
  let body;
  try {
    body = await req.json();
  } catch {
    return errOut("parse", "Invalid JSON", null, 400);
  }

  let { email, password, name, surname, phone, dateOfBirth, recaptchaToken } =
    body || {};

  email = normalizeEmail(email);
  name = clean(name);
  surname = clean(surname);
  phone = clean(phone);

  // YYYY-MM-DD → timestamp
  const dobISO =
    clean(dateOfBirth) && /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)
      ? `${dateOfBirth}T00:00:00`
      : null;

  if (!email || !isStrongPw(password) || !name || !surname || !dobISO) {
    return errOut(
      "validate",
      "Missing or invalid fields",
      {
        email: !!email,
        pwLen: (password || "").length,
        name: !!name,
        surname: !!surname,
        dateOfBirth,
      },
      400
    );
  }

  // --- reCAPTCHA (skippable for debug) ---
  const secret =
    process.env.RECAPTCHA_SECRET || process.env.RECAPTCHA_SECRET_KEY || "";

  if (!disableCaptcha) {
    const isProd = process.env.NODE_ENV === "production";
    if (secret) {
      if (!recaptchaToken) {
        return errOut("captcha", "Missing reCAPTCHA token", null, 400);
      }
      try {
        const form = new URLSearchParams();
        form.set("secret", secret);
        form.set("response", recaptchaToken);
        const res = await fetch(
          "https://www.google.com/recaptcha/api/siteverify",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: form.toString(),
          }
        );
        if (!res.ok) {
          const text = await res.text();
          return errOut(
            "captcha_http",
            "reCAPTCHA verify failed",
            { status: res.status, text },
            400
          );
        }
        const vj = await res.json().catch(() => ({}));
        if (!vj?.success) {
          return errOut(
            "captcha_fail",
            "reCAPTCHA verification failed",
            vj,
            400
          );
        }
      } catch (e) {
        return errOut("captcha_req", "reCAPTCHA request error", String(e), 400);
      }
    } else if (isProd) {
      return errOut(
        "captcha_conf",
        "Server misconfigured (captcha)",
        "missing secret",
        500
      );
    }
  } else {
    console.warn("[signup] DISABLE_CAPTCHA=1 — skipping captcha verification");
  }

  // --- create Supabase Auth user (tolerate duplicates) ---
  let authUserId = null;
  let createdNow = false;

  try {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, surname, phone, dateOfBirth: dobISO },
      app_metadata: { role: "user" },
    });

    if (error) {
      const msg = (error.message || "").toLowerCase();
      const isDup =
        msg.includes("already registered") ||
        msg.includes("duplicate") ||
        msg.includes("user already exists");
      if (!isDup) {
        return errOut(
          "auth.createUser",
          "Failed to create user",
          { code: error.code, message: error.message },
          500
        );
      }
      // duplicate → proceed; we'll upsert profile by email
    } else {
      authUserId = data?.user?.id || null;
      createdNow = !!authUserId;
    }
  } catch (e) {
    return errOut(
      "auth.createUser.throw",
      "Failed to create user",
      String(e),
      500
    );
  }

  // --- upsert profile in public."User" (by EMAIL), then link auth_user_id if empty ---
  const profile = {
    auth_user_id: authUserId || null, // fine if null on first pass
    email, // citext unique
    password: "[supabase-auth]", // placeholder (schema requires not null)
    name,
    surname,
    phone,
    dateOfBirth: dobISO, // matches "dateOfBirth"
    updatedAt: new Date().toISOString(),
    role: "user",
  };

  try {
    // 1) Upsert by email → idempotent with citext unique
    const { error: upByEmailErr } = await admin
      .from("User")
      .upsert(profile, { onConflict: "email" });

    if (upByEmailErr) {
      return errOut(
        "profile.upsert.email",
        "Failed to save profile",
        upByEmailErr,
        500
      );
    }

    // 2) Link auth_user_id if we have it AND it's still null (avoid unique collision)
    if (authUserId) {
      const { error: linkErr } = await admin
        .from("User")
        .update({
          auth_user_id: authUserId,
          updatedAt: new Date().toISOString(),
        })
        .is("auth_user_id", null)
        .eq("email", email);

      if (linkErr) {
        console.warn("[signup] linking auth_user_id skipped", linkErr);
      }
    }

    return send(
      { ok: true, authUserId: authUserId || null, created: createdNow },
      createdNow ? 201 : 200
    );
  } catch (e) {
    return errOut("profile.throw", "Failed to save profile", String(e), 500);
  }
}
