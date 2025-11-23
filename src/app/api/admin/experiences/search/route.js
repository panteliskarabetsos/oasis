// src/app/api/admin/experiences/search/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function GET(req) {
  // AuthZ guard (cookie-bound user + admin DB client)
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { admin } = guard;
  const { searchParams } = new URL(req.url);

  // q: search string, limit: optional page size (default 20, max 50)
  const q = (searchParams.get("q") || "").trim();
  const limit = Math.min(
    50,
    Math.max(1, Number(searchParams.get("limit")) || 20)
  );

  // Base query
  let query = admin
    .from("Experience")
    .select("id,name")
    .order("name", { ascending: true });

  // Apply filter if provided
  if (q) query = query.ilike("name", `%${q}%`);

  const { data, error } = await query.limit(limit);

  if (error) return bad(error.message, 500);
  return ok({ items: data ?? [] });
}
