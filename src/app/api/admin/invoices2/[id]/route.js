export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

const ok = (d, s = 200) =>
  new NextResponse(JSON.stringify(d), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
const bad = (m, s = 400) => ok({ error: m }, s);

async function requireAdmin() {
  const supa = await createSupabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return { error: true, response: bad("Unauthorized", 401) };
  const { data: row, error } = await supa
    .from("User")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (error || (row?.role ?? "user") !== "admin")
    return { error: true, response: bad("Forbidden", 403) };
  return { error: false };
}

export async function GET(_req, { params }) {
  const gate = await requireAdmin();
  if (gate?.error) return gate.response;

  const admin = createSupabaseAdmin();
  const id = Number(params?.id);
  if (!Number.isFinite(id)) return bad("Invalid id");

  const { data: inv, error } = await admin
    .from("invoice")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return bad(error.message || "Load failed", 500);
  if (!inv) return bad("Not found", 404);

  const { data: lines, error: e2 } = await admin
    .from("invoice_line")
    .select("*")
    .eq("invoice_id", id)
    .order("id");
  if (e2) return bad(e2.message || "Load lines failed", 500);

  return ok({ invoice: inv, lines });
}
