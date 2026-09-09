// Folder: src/app/api/admin/shop/orders/[id]/events/route.js
// Notes staff add to an order's timeline.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { MIGRATION_HINT, actorFor, isMissingSchema } from "@/lib/shop/orders";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function POST(req, { params }) {
  const auth = await requireAdmin("eshop");
  if (!auth.ok) return auth.response;
  const admin = createSupabaseAdmin();
  const id = Number(params?.id);
  if (!Number.isFinite(id) || id <= 0) return bad("Invalid id");

  try {
    const body = await req.json();
    const message = String(body?.message || "").trim();
    if (!message) return bad("Write something first");
    if (message.length > 2000) return bad("That note is too long");

    const { data: order } = await admin
      .from("shop_order")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (!order) return bad("Order not found", 404);

    const actor = await actorFor(admin, auth.user);
    const { data, error } = await admin
      .from("shop_order_event")
      .insert([{ order_id: id, type: "note", message, meta: {}, ...actor }])
      .select("id, type, message, meta, created_by_email, created_by_name, created_at")
      .single();
    if (error) {
      if (isMissingSchema(error)) return bad(MIGRATION_HINT, 409);
      throw error;
    }
    return ok({ event: data }, 201);
  } catch (e) {
    return bad(String(e?.message || e), 500);
  }
}
