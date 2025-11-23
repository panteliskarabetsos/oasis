// Folder: src/app/api/admin/shop/orders/[id]/status/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok8 = (d, s = 200) => NextResponse.json(d, { status: s });
const bad8 = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

const ALLOWED = new Set(["pending", "paid", "fulfilled", "cancelled"]);

export async function POST(req, { params }) {
  const supabase = createSupabaseAdmin();
  const id = Number(params?.id);
  if (!Number.isFinite(id) || id <= 0) return bad8("Invalid id");
  try {
    const { status } = await req.json();
    if (!ALLOWED.has(status)) return bad8("Invalid status");

    const patch = { status };
    if (status === "paid") patch.placed_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("shop_order")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return ok8({ order: data });
  } catch (e) {
    return bad8(String(e.message || e), 500);
  }
}
