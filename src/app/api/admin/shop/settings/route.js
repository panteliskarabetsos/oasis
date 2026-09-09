// Folder: src/app/api/admin/shop/settings/route.js
// NOTE: The schema doesn't include a dedicated shop settings table.
// We'll re-use AppSetting by storing a row with key = 'shop' and mapping
// bookingspaused -> paused, bookingspausedmessage -> message.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { AUTOMATIONS, getEmailSettings } from "@/lib/shop/notify";
import { isMissingSchema } from "@/lib/shop/schema";

const ok10 = (d, s = 200) => NextResponse.json(d, { status: s });
const bad10 = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function GET() {
  const auth = await requireAdmin("eshop");
  if (!auth.ok) return auth.response;
  const supabase = createSupabaseAdmin();
  try {
    const { data, error } = await supabase
      .from("AppSetting")
      .select("bookingspaused, bookingspausedmessage")
      .eq("key", "shop")
      .maybeSingle();
    if (error) throw error;
    const emails = await getEmailSettings(supabase);
    return ok10({
      paused: Boolean(data?.bookingspaused),
      message: data?.bookingspausedmessage || "",
      emails,
      automations: AUTOMATIONS,
    });
  } catch (e) {
    return bad10(String(e.message || e), 500);
  }
}

export async function POST(req) {
  const auth = await requireAdmin("eshop");
  if (!auth.ok) return auth.response;
  const supabase = createSupabaseAdmin();
  try {
    const body = await req.json();
    const { paused = false, message = "" } = body || {};
    const now = new Date().toISOString();

    const row = {
      key: "shop",
      bookingspaused: !!paused,
      bookingspausedmessage: String(message || ""),
      updatedat: now,
    };

    // The automation switches live in a jsonb bag; merge rather than replace so
    // a future setting added elsewhere is not wiped by saving this form.
    let emailsPatch = null;
    if (body?.emails && typeof body.emails === "object") {
      emailsPatch = {};
      for (const key of Object.keys(AUTOMATIONS)) {
        if (body.emails[key] !== undefined) emailsPatch[key] = body.emails[key] !== false;
      }
      if (body.emails.staffTo !== undefined) {
        emailsPatch.staffTo = String(body.emails.staffTo || "").trim();
      }
    }

    if (emailsPatch) {
      const { data: existing } = await supabase
        .from("AppSetting")
        .select("settings")
        .eq("key", "shop")
        .maybeSingle();
      const current = existing?.settings && typeof existing.settings === "object" ? existing.settings : {};
      row.settings = { ...current, emails: { ...(current.emails || {}), ...emailsPatch } };
    }

    let { data, error } = await supabase
      .from("AppSetting")
      .upsert([row], { onConflict: "key" })
      .select()
      .single();

    if (error && isMissingSchema(error) && row.settings) {
      // The settings column has not been migrated yet — save the rest.
      const { settings: _dropped, ...withoutSettings } = row;
      ({ data, error } = await supabase
        .from("AppSetting")
        .upsert([withoutSettings], { onConflict: "key" })
        .select()
        .single());
      if (error) throw error;
      return ok10({
        ok: true,
        setting: data,
        warning:
          "Email automation settings need dump_sql/20260909_shop_emails.sql to be run first.",
      });
    }
    if (error) throw error;
    return ok10({ ok: true, setting: data });
  } catch (e) {
    return bad10(String(e.message || e), 500);
  }
}
