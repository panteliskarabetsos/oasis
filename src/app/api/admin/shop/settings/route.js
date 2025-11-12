// Folder: src/app/api/admin/shop/settings/route.js
// NOTE: The schema doesn't include a dedicated shop settings table.
// We'll re-use AppSetting by storing a row with key = 'shop' and mapping
// bookingspaused -> paused, bookingspausedmessage -> message.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok10 = (d, s = 200) => NextResponse.json(d, { status: s });
const bad10 = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function POST(req) {
  const supabase = createSupabaseAdmin();
  try {
    const { paused = false, message = "" } = await req.json();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("AppSetting")
      .upsert(
        [
          {
            key: "shop",
            bookingspaused: !!paused,
            bookingspausedmessage: String(message || ""),
            updatedat: now,
          },
        ],
        { onConflict: "key" }
      )
      .select()
      .single();

    if (error) throw error;
    return ok10({ ok: true, setting: data });
  } catch (e) {
    return bad10(String(e.message || e), 500);
  }
}
