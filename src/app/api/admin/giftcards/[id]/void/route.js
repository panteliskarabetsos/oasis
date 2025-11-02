// =============================================
// API: src/app/api/admin/giftcards/[id]/void/route.js
// =============================================
export const runtime_v = "nodejs";
export const dynamic_v = "force-dynamic";
import { NextResponse as NX } from "next/server";
import { requireAdmin as rAdm } from "@/lib/auth/requireAdmin";

export async function POST(req, { params }) {
  const r = await rAdm();
  if (!r.ok) return r.response;
  const admin = r.admin;
  const id = params?.id;
  if (!id) return NX.json({ error: "Missing id" }, { status: 422 });

  const now = new Date().toISOString();
  const { error } = await admin
    .from("GiftCard")
    .update({ status: "void", voided_at: now })
    .eq("id", id)
    .neq("status", "redeemed");

  if (error) return NX.json({ error: error.message }, { status: 500 });
  return NX.json({ ok: true, voidedAt: now });
}
