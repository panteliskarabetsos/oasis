// Newsletter subscriber list for the e-Shop console's Subscribers tab.
// Returns a bare array: [{ email, created_at, confirmed_at, unsubscribed_at }]
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export async function GET(req) {
  const auth = await requireAdmin("eshop");
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 1000, 5000);
  const includeUnsubscribed =
    url.searchParams.get("includeUnsubscribed") === "1";

  let q = auth.admin
    .from("newsletter_subscribers")
    .select("email, created_at, confirmed_at, unsubscribed_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!includeUnsubscribed) q = q.is("unsubscribed_at", null);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data || []);
}
