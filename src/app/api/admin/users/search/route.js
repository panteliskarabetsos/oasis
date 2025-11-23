export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function GET(req) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (!q || q.length < 2) return ok({ items: [] });

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  const numericId = /^\d+$/.test(q) ? Number(q) : null;
  const like = `%${q}%`;

  // Query by id OR ilike on name/surname/email/phone
  let query = admin
    .from("User")
    .select("id, email, name, surname, phone")
    .limit(8);

  if (numericId) {
    query = query.or(
      `id.eq.${numericId},email.ilike.${like},name.ilike.${like},surname.ilike.${like},phone.ilike.${like}`
    );
  } else {
    query = query.or(
      `email.ilike.${like},name.ilike.${like},surname.ilike.${like},phone.ilike.${like}`
    );
  }

  const { data, error } = await query;
  if (error) return bad(error.message, 500);
  return ok({ items: data || [] });
}
