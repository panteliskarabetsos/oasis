export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createHash } from "crypto";

export async function GET(req) {
  const admin = createSupabaseAdmin();
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  if (!admin || !token)
    return NextResponse.redirect(new URL("/about?newsletter=0", req.url));

  // Compute base64 of SHA-256 to match how we store bytea via JSON
  const tokenHashBase64 = createHash("sha256").update(token).digest("base64");

  const { data: row, error } = await admin
    .from("newsletter_subscribers")
    .select("email")
    .eq("token_hash", tokenHashBase64)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.redirect(new URL("/about?newsletter=0", req.url));
  }

  await admin
    .from("newsletter_subscribers")
    .update({ confirmed_at: new Date().toISOString(), token_hash: null })
    .eq("email", row.email);

  return NextResponse.redirect(new URL("/about?newsletter=1", req.url));
}
