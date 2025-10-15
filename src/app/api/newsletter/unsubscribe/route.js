export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.NEWSLETTER_UNSUB_SECRET;

function b64urlToBuf(s) {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}
function expectedSig(email, exp) {
  const canonical = String(email).trim().toLowerCase();
  const payload = exp ? `${canonical}|${exp}` : canonical;
  return createHmac("sha256", SECRET).update(payload).digest();
}

export async function GET(req) {
  const admin = createSupabaseAdmin();
  const url = new URL(req.url);
  const emailParam = url.searchParams.get("email") || "";
  const sigParam = url.searchParams.get("sig") || "";
  const expParam = url.searchParams.get("exp"); // optional

  // basic guards
  if (!admin || !SECRET || !emailParam || !sigParam) {
    return NextResponse.redirect(new URL("/about?unsub=0", req.url));
  }

  const email = emailParam.trim().toLowerCase();

  // optional expiry (if you set one in links)
  if (expParam) {
    const now = Math.floor(Date.now() / 1000);
    const exp = parseInt(expParam, 10);
    if (!Number.isFinite(exp) || now > exp) {
      return NextResponse.redirect(new URL("/about?unsub=0", req.url));
    }
  }

  // verify HMAC (constant-time)
  try {
    const provided = b64urlToBuf(sigParam);
    const expected = expectedSig(email, expParam);
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      return NextResponse.redirect(new URL("/about?unsub=0", req.url));
    }
  } catch {
    return NextResponse.redirect(new URL("/about?unsub=0", req.url));
  }

  // mark unsubscribed
  await admin
    .from("newsletter_subscribers")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("email", email);

  return NextResponse.redirect(new URL("/about?unsub=1", req.url));
}
