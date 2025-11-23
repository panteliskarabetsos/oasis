// Folder: src/app/api/admin/shop/images/[id]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok5 = (d, s = 200) => NextResponse.json(d, { status: s });
const bad5 = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function PATCH(req, { params }) {
  const supabase = createSupabaseAdmin();
  const id = Number(params?.id);
  if (!Number.isFinite(id) || id <= 0) return bad5("Invalid id");
  try {
    const body = await req.json();
    const patch = {};
    if (body.alt !== undefined) patch.alt = String(body.alt || "");
    if (body.sort !== undefined) patch.sort = Number(body.sort) || 0;
    const { data, error } = await supabase
      .from("shop_image")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return ok5(data);
  } catch (e) {
    return bad5(String(e.message || e), 500);
  }
}

export async function DELETE(_req, { params }) {
  const supabase = createSupabaseAdmin();
  const id = Number(params?.id);
  if (!Number.isFinite(id) || id <= 0) return bad5("Invalid id");
  try {
    const { error } = await supabase.from("shop_image").delete().eq("id", id);
    if (error) throw error;
    return ok5({ ok: true });
  } catch (e) {
    return bad5(String(e.message || e), 500);
  }
}
