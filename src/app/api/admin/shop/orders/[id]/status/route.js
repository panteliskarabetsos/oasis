// Folder: src/app/api/admin/shop/orders/[id]/status/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { ORDER_STATUSES, actorFor, logEvent } from "@/lib/shop/orders";
import { notifyOrder } from "@/lib/shop/notify";

const ok8 = (d, s = 200) => NextResponse.json(d, { status: s });
const bad8 = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

const ALLOWED = new Set(ORDER_STATUSES);

export async function POST(req, { params }) {
  const auth = await requireAdmin("eshop");
  if (!auth.ok) return auth.response;
  const supabase = createSupabaseAdmin();
  const id = Number(params?.id);
  if (!Number.isFinite(id) || id <= 0) return bad8("Invalid id");
  try {
    const { status } = await req.json();
    if (!ALLOWED.has(status)) return bad8("Invalid status");

    const { data: before } = await supabase
      .from("shop_order")
      .select("status")
      .eq("id", id)
      .maybeSingle();

    const patch = { status };
    if (status === "paid") patch.placed_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("shop_order")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    if (before?.status !== status) {
      const actor = await actorFor(supabase, auth.user);
      await logEvent(supabase, id, {
        type: "status",
        message: `Status changed from ${before?.status || "—"} to ${status}`,
        meta: { from: before?.status || null, to: status },
        ...actor,
      });

      // Automations that hang off a real transition.
      if (status === "fulfilled") {
        await notifyOrder(supabase, id, "shipped", { actorEmail: auth.user?.email });
      } else if (status === "cancelled") {
        await notifyOrder(supabase, id, "cancelled", { actorEmail: auth.user?.email });
      }
    }

    return ok8({ order: data });
  } catch (e) {
    return bad8(String(e.message || e), 500);
  }
}
