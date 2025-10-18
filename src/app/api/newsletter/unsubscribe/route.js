// src/app/api/newsletter/unsubscribe/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyUnsubToken } from "@/lib/newsletter/signing";

export async function GET(req) {
  const u = new URL(req.url);
  const email = u.searchParams.get("e") || "";
  const token = u.searchParams.get("t") || "";
  if (!email || !token) {
    return new NextResponse("Missing parameters", { status: 400 });
  }
  if (!verifyUnsubToken(email, token)) {
    return new NextResponse("Invalid token", { status: 400 });
  }

  const admin = createSupabaseAdmin();
  if (!admin) return new NextResponse("Server not configured", { status: 500 });

  await admin
    .from("newsletter_subscribers")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("email", email);

  // Simple confirmation page
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>Unsubscribed</title>
     <div style="font-family:system-ui;padding:32px;max-width:640px;margin:auto">
       <h1>You're unsubscribed</h1>
       <p>${email} has been removed from our newsletter.</p>
     </div>`,
    { status: 200, headers: { "content-type": "text/html" } }
  );
}
