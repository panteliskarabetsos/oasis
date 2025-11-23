export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ message: m }, { status: s });

function isStrong(pw) {
  return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(String(pw));
}

export async function POST(req) {
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const { token, newPassword } = await req.json().catch(() => ({}));
  if (!token || !newPassword) return bad("Missing fields");
  if (!isStrong(newPassword))
    return bad(
      "Password must be at least 8 characters and include letters and numbers."
    );

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Look up token
    const { data: row, error: selErr } = await admin
      .from("PasswordReset")
      .select("id, auth_user_id, expires_at, used")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (selErr) {
      console.error("[reset-password] select error", selErr);
      return bad("Invalid or expired token", 400);
    }
    if (!row || row.used) return bad("Invalid or expired token", 400);
    if (new Date(row.expires_at) < new Date())
      return bad("Invalid or expired token", 400);

    // Update password in Supabase Auth (service role)
    const supaAdmin = createSupabaseAdmin().auth.admin;
    const { error: updErr } = await supaAdmin.updateUserById(row.auth_user_id, {
      password: newPassword,
    });
    if (updErr) {
      console.error("[reset-password] update user error", updErr);
      return bad("Failed to reset password", 500);
    }

    // Mark token used
    const { error: useErr } = await admin
      .from("PasswordReset")
      .update({ used: true, used_at: new Date().toISOString() })
      .eq("id", row.id);
    if (useErr) console.warn("[reset-password] mark used warning", useErr);

    return ok({ message: "Password has been reset successfully." });
  } catch (e) {
    console.error("[reset-password] unexpected", e);
    return bad("Failed to reset password", 500);
  }
}
