// src/app/api/auth/signup/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const badRequest = (msg) => NextResponse.json({ error: msg }, { status: 400 });
const serverError = (msg = "Server error") =>
  NextResponse.json({ error: msg }, { status: 500 });

export async function POST(req) {
  try {
    const admin = createSupabaseAdmin();
    if (!admin) return serverError("Server not configured");

    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON");

    let { email, password, name, surname, phone, dateOfBirth, recaptchaToken } =
      body;

    if (!email || !password || !name || !surname || !dateOfBirth) {
      return badRequest("Missing required fields");
    }
    email = String(email).trim().toLowerCase();

    // --- reCAPTCHA verification ---
    const secret =
      process.env.RECAPTCHA_SECRET || process.env.RECAPTCHA_SECRET_KEY;
    const isProd = process.env.NODE_ENV === "production";

    if (!secret) {
      console.warn("[signup] Missing RECAPTCHA_SECRET/RECAPTCHA_SECRET_KEY");
      if (isProd) return serverError("Server misconfigured (captcha)");
    } else {
      if (!recaptchaToken) return badRequest("Missing reCAPTCHA token");
      const form = new URLSearchParams();
      form.set("secret", secret);
      form.set("response", recaptchaToken);
      const verifyRes = await fetch(
        "https://www.google.com/recaptcha/api/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form.toString(),
        }
      );
      const verifyJson = await verifyRes.json().catch(() => ({}));
      if (!verifyJson.success) {
        return NextResponse.json(
          { error: "reCAPTCHA verification failed" },
          { status: 400 }
        );
      }
    }

    // --- Create Auth user (or tolerate duplicate) ---
    let authUserId = null;
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, surname, phone, dateOfBirth },
        app_metadata: { role: "user" },
      });

    if (createErr) {
      const msg = (createErr.message || "").toLowerCase();
      const isDup =
        msg.includes("already registered") || msg.includes("duplicate");
      if (!isDup) {
        return NextResponse.json(
          { error: createErr.message || "Failed to create user" },
          { status: 500 }
        );
      }
      // Duplicate: continue without authUserId; we'll upsert by email
      authUserId = null;
    } else {
      authUserId = created?.user?.id || null;
    }

    // --- Prepare profile upsert payload ---
    const dobTs = dateOfBirth ? `${dateOfBirth}T00:00:00` : null;

    const upsertPayload = {
      // Keep this even if it's not the conflict target; harmless if column exists
      auth_user_id: authUserId,
      email,
      // Your table requires a non-null password — this is just a placeholder
      password: "[supabase-auth]",
      name: name?.trim() || null,
      surname: surname?.trim() || null,
      phone: phone?.trim() || null,
      dateOfBirth: dobTs,
      updatedAt: new Date().toISOString(),
      role: "user",
    };

    // --- Try upsert with graceful fallbacks ---
    let upsertErr = null;

    // 1) Prefer auth_user_id if we actually have it
    if (authUserId) {
      ({ error: upsertErr } = await admin
        .from("User")
        .upsert(upsertPayload, { onConflict: "auth_user_id" }));
    }

    // 2) If step 1 failed with 42P10 (no unique constraint) or we had no authUserId, try email
    if (!authUserId || upsertErr?.code === "42P10") {
      ({ error: upsertErr } = await admin
        .from("User")
        .upsert(upsertPayload, { onConflict: "email" }));
    }

    // 3) If still 42P10 (no unique constraint on email either), do manual insert→update
    if (upsertErr?.code === "42P10") {
      // insert
      const { error: insertErr } = await admin
        .from("User")
        .insert(upsertPayload);
      if (insertErr?.code === "23505") {
        // duplicate → update by email
        const { error: updateErr } = await admin
          .from("User")
          .update(upsertPayload)
          .eq("email", email);
        if (updateErr) {
          console.error("[signup] manual update error", updateErr);
          return serverError("Failed to save profile");
        }
      } else if (insertErr) {
        console.error("[signup] manual insert error", insertErr);
        return serverError("Failed to save profile");
      } else {
        // insert succeeded
        upsertErr = null;
      }
    }

    if (upsertErr) {
      console.error("[signup] profile upsert error", upsertErr);
      return serverError("Failed to save profile");
    }

    return NextResponse.json({ ok: true, authUserId }, { status: 200 });
  } catch (e) {
    console.error("[signup] unexpected", e);
    return serverError();
  }
}
