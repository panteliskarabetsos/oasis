// Always compute fresh and avoid caching
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

// Small helper so health endpoints never hang
async function timeboxed(promiseFactory, timeoutMs = 2500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  try {
    const result = await promiseFactory({ signal: controller.signal });
    return { ok: true, ms: Date.now() - started, result };
  } catch (err) {
    return {
      ok: false,
      ms: Date.now() - started,
      error: err?.message || err?.name || "ERR",
    };
  } finally {
    clearTimeout(timer);
  }
}

// Read a light row to prove DB connectivity (and pick up app state)
async function supabaseCheck() {
  try {
    const supabase = createSupabaseAdmin?.();
    if (!supabase) {
      return { ok: false, ms: 0, error: "Supabase admin not configured" };
    }

    const run = async () => {
      // ultra-light query; works even if table is empty
      const { data, error } = await supabase
        .from("AppSetting")
        .select(
          "key, bookingsPaused, bookingsPausedUntil, bookingsPausedMessage"
        )
        .eq("key", "global")
        .maybeSingle();

      if (error) throw error;
      return data || { bookingsPaused: false };
    };

    return await timeboxed(async () => await run());
  } catch (e) {
    return { ok: false, ms: 0, error: e?.message || "Supabase init failed" };
  }
}

function meta() {
  const mem = process.memoryUsage();
  const toMB = (b) => Math.round((b / 1024 / 1024) * 10) / 10;

  return {
    time: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    region: process.env.VERCEL_REGION || null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    branch: process.env.VERCEL_GIT_COMMIT_REF || null,
    version: process.env.NEXT_PUBLIC_APP_VERSION || null,
    memoryMB: {
      rss: toMB(mem.rss),
      heapUsed: toMB(mem.heapUsed),
    },
  };
}

function json(data, status = 200) {
  return new NextResponse(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
    },
  });
}

// GET returns full JSON detail
export async function GET() {
  const m = meta();

  const supa = await supabaseCheck();

  const overallOk = supa.ok; // add more checks and AND them here if needed
  const status = overallOk ? "ok" : "degraded";

  // Extract app-specific state if available
  const app = supa.result || {};
  const bookings = {
    paused: !!app.bookingsPaused,
    pausedUntil: app.bookingsPausedUntil || null,
    message: app.bookingsPausedMessage || null,
  };

  const body = {
    status,
    checks: {
      supabase: { ok: supa.ok, latencyMs: supa.ms, error: supa.error || null },
      bookings,
    },
    meta: m,
  };

  return json(body, overallOk ? 200 : 200); // keep 200 so monitors can read payload; change to 503 if you prefer hard fail
}

// HEAD returns only an up/down signal (tiny & fast)
export async function HEAD() {
  const supa = await supabaseCheck();
  const status = supa.ok ? 200 : 503;
  return new NextResponse(null, {
    status,
    headers: { "cache-control": "no-store" },
  });
}
