export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

function toMinutes(text) {
  if (text == null) return 60;
  if (typeof text === "number" && Number.isFinite(text)) return text;
  const s = String(text).trim().toLowerCase();
  const m = s.match(/(\d+)\s*(min|minutes|m)?/);
  if (m) return Number(m[1]);
  const h = s.match(/(\d+(\.\d+)?)\s*h/); // e.g. "1.5h"
  if (h) return Math.round(Number(h[1]) * 60);
  const n = Number(s);
  return Number.isFinite(n) ? n : 60;
}

export async function GET() {
  try {
    const supa = await createSupabaseAdmin();

    const { data, error } = await supa
      .from("Experience") // your table name is capitalized in schema
      .select("id,name,slug,duration,priceAdult,priceKid,visibility")
      .eq("visibility", true)
      .order("name", { ascending: true });

    if (error) return bad(error.message, 500);

    const rows = (data || []).map((x) => ({
      id: x.id,
      name: x.name,
      slug: x.slug,
      duration: toMinutes(x.duration), // normalize to number of minutes
      pricing: {
        priceAdult: Number(x.priceAdult || 0),
        priceKid: Number(x.priceKid || 0),
      },
    }));

    return ok(rows);
  } catch (e) {
    return bad(e.message || "Server error", 500);
  }
}
