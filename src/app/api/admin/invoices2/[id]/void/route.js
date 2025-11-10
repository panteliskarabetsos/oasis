export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

const ok = (d, s = 200, headers = {}) =>
  new NextResponse(JSON.stringify(d), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
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

export async function POST(_req, ctx) {
  const gate = await requireAdmin();
  if (gate?.error) return gate.response;

  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) return bad("Invalid invoice id", 400);

  const admin = createSupabaseAdmin();

  // Load invoice + payments count
  const [{ data: inv, error: e1 }, { count: payCount, error: e2 }] =
    await Promise.all([
      admin
        .from("invoice")
        .select("id, status, paid_at")
        .eq("id", id)
        .maybeSingle(),
      admin
        .from("payment")
        .select("id", { count: "exact", head: true })
        .eq("invoice_id", id),
    ]);

  if (e1) return bad(e1.message || "Failed to load invoice", 500);
  if (!inv) return bad("Invoice not found", 404);
  if (e2) return bad(e2.message || "Failed to check payments", 500);

  const status = String(inv.status || "").toLowerCase();
  if (status === "paid") return bad("Paid invoice cannot be voided.", 409);
  if (payCount && payCount > 0)
    return bad(
      "Invoice with payments cannot be voided. Refund/remove payments first.",
      409
    );
  if (status === "void") return ok({ message: "Already void." });

  const { error: updErr } = await admin
    .from("invoice")
    .update({
      status: "void",
      paid_at: null,
      payment_method: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updErr) return bad(updErr.message || "Failed to void invoice", 500);
  return ok({ message: "Invoice voided.", invoiceId: id, status: "void" });
}
