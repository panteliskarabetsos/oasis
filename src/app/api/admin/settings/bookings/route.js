// src/app/api/admin/settings/bookings/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const err = (m, s = 500, extra = null) =>
  NextResponse.json({ error: m, details: extra }, { status: s });

async function requireAdmin() {
  const supa = await createSupabaseServer().catch(() => null);
  if (!supa?.auth?.getUser) return { error: err("Auth not available", 500) };

  const { data, error } = await supa.auth.getUser();
  if (error || !data?.user) return { error: err("Unauthorized", 401) };

  const user = data.user;
  const metaRole = user.app_metadata?.role || user.user_metadata?.role;
  if (metaRole === "admin") return { user };

  const admin = createSupabaseAdmin();
  const { data: dbUser, error: dbErr } = await admin
    .from("User")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (dbErr) return { error: err("Role lookup failed", 500, dbErr) };
  if (dbUser?.role === "admin") return { user };

  return { error: err("Forbidden", 403) };
}

/* ------------ GET ------------ */
export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const admin = createSupabaseAdmin();
  try {
    const { data, error } = await admin
      .from("AppSetting")
      .select(
        `
        bookingsPaused:bookingspaused,
        bookingsPausedUntil:bookingspauseduntil,
        bookingsPausedMessage:bookingspausedmessage
      `
      )
      .eq("key", "global")
      .maybeSingle();

    if (error) {
      console.error("[bookings GET] error", error);
      return err("Failed to load settings", 500, error);
    }

    return ok(
      data ?? {
        bookingsPaused: false,
        bookingsPausedUntil: null,
        bookingsPausedMessage: "",
      }
    );
  } catch (e) {
    console.error("[bookings GET] exception", e);
    return err("Server error", 500, String(e?.message || e));
  }
}

/* ------------ PUT ------------ */
export async function PUT(req) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const admin = createSupabaseAdmin();
  if (!admin) return err("Server not configured", 500);

  let body;
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON", 400);
  }

  const {
    bookingsPaused = false,
    bookingsPausedUntil = null,
    bookingsPausedMessage = "",
  } = body ?? {};

  let untilISO = null;
  if (bookingsPausedUntil) {
    const d = new Date(bookingsPausedUntil);
    if (!Number.isNaN(d.getTime())) untilISO = d.toISOString();
  }

  // ⬇️ use LOWERCASE column names that exist in your table
  const payload = {
    key: "global",
    bookingspaused: !!bookingsPaused,
    bookingspauseduntil: untilISO,
    bookingspausedmessage: String(bookingsPausedMessage || ""),
    updatedat: new Date().toISOString(),
  };

  try {
    const { data, error } = await admin
      .from("AppSetting")
      .upsert(payload, { onConflict: "key" })
      .select(
        `
        bookingsPaused:bookingspaused,
        bookingsPausedUntil:bookingspauseduntil,
        bookingsPausedMessage:bookingspausedmessage
      `
      )
      .single();

    if (error) {
      console.error("[bookings PUT] error", error);
      return err("Failed to save settings", 500, error);
    }
    return ok(data);
  } catch (e) {
    console.error("[bookings PUT] exception", e);
    return err("Server error", 500, String(e?.message || e));
  }
}
