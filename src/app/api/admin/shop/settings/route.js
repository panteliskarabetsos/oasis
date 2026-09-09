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
import { getShippingSettings } from "@/lib/shop/server";

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
    const shipping = await getShippingSettings(supabase);
    return ok10({
      paused: Boolean(data?.bookingspaused),
      message: data?.bookingspausedmessage || "",
      emails,
      automations: AUTOMATIONS,
      shipping,
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

    // Courier rates. Validated here so a typo cannot make every delivery free
    // or, worse, price one at a number nobody intended.
    let shippingPatch = null;
    if (body?.shipping && typeof body.shipping === "object") {
      const sh = body.shipping;
      const int = (v, fallback = 0) => {
        const n = Math.round(Number(v));
        return Number.isFinite(n) && n >= 0 ? n : fallback;
      };
      shippingPatch = {
        enabled: sh.enabled !== false,
        freeOverCents: int(sh.freeOverCents),
        handlingCents: int(sh.handlingCents),
        volumetricDivisor: int(sh.volumetricDivisor, 5000) || 5000,
        pickup: {
          enabled: sh.pickup?.enabled !== false,
          label: String(sh.pickup?.label || "Collect from us").slice(0, 120),
          cents: int(sh.pickup?.cents),
        },
        zones: (Array.isArray(sh.zones) ? sh.zones : []).slice(0, 12).map((z, i) => ({
          id: String(z.id || `zone${i + 1}`).slice(0, 32),
          label: String(z.label || "Zone").slice(0, 80),
          countries: (Array.isArray(z.countries) ? z.countries : [])
            .map((c) => String(c).trim().toUpperCase())
            .filter(Boolean)
            .slice(0, 60),
          baseCents: int(z.baseCents),
          baseGrams: int(z.baseGrams),
          extraCentsPerKg: int(z.extraCentsPerKg),
          maxGrams: int(z.maxGrams),
        })),
      };
      if (shippingPatch.enabled && !shippingPatch.zones.length) {
        return bad10("Add at least one delivery zone, or switch shipping off");
      }
    }

    if (emailsPatch || shippingPatch) {
      const { data: existing } = await supabase
        .from("AppSetting")
        .select("settings")
        .eq("key", "shop")
        .maybeSingle();
      const current = existing?.settings && typeof existing.settings === "object" ? existing.settings : {};
      row.settings = {
        ...current,
        ...(emailsPatch ? { emails: { ...(current.emails || {}), ...emailsPatch } } : {}),
        ...(shippingPatch ? { shipping: shippingPatch } : {}),
      };
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
          "Email and shipping settings need dump_sql/20260909_shop_emails.sql to be run first.",
      });
    }
    if (error) throw error;
    return ok10({ ok: true, setting: data });
  } catch (e) {
    return bad10(String(e.message || e), 500);
  }
}
