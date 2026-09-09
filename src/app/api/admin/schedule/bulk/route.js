// src/app/api/admin/schedule/bulk/route.js
// Create many schedule slots in one request — the recurring-availability case
// the planner needs ("Tue/Fri at 10:00 for the next eight weeks").
//
// The caller supplies fully-resolved ISO instants rather than a rule, because
// only the browser knows the operator's timezone; the server would otherwise
// generate 10:00 in whatever zone it happens to run in.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

const MAX_SLOTS = 400;

export async function POST(req) {
  // Writing availability is an "experiences" action, matching the single POST —
  // a partner with read-only schedule access must not be able to bulk-create.
  const auth = await requireAdmin("experiences");
  if (!auth.ok) return auth.response;

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  let body;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON");
  }

  const experienceId = Number(body?.experienceId);
  if (!Number.isInteger(experienceId) || experienceId <= 0) {
    return bad("Choose an experience first");
  }

  const raw = Array.isArray(body?.slots) ? body.slots : [];
  if (!raw.length) return bad("Nothing to create");
  if (raw.length > MAX_SLOTS) {
    return bad(`That is ${raw.length} slots — ${MAX_SLOTS} is the most in one go`);
  }

  const defaultTotal = Number(body?.totalSlots);
  const nowMs = Date.now();

  const wanted = [];
  const skipped = [];
  const seen = new Set();

  for (const entry of raw) {
    const iso = new Date(entry?.date ?? entry).toISOString?.() ?? null;
    if (!iso || Number.isNaN(new Date(iso).getTime())) {
      skipped.push({ date: String(entry?.date ?? entry), reason: "invalid date" });
      continue;
    }
    if (new Date(iso).getTime() <= nowMs) {
      skipped.push({ date: iso, reason: "in the past" });
      continue;
    }
    if (seen.has(iso)) {
      skipped.push({ date: iso, reason: "listed twice" });
      continue;
    }
    const total = Number(entry?.totalSlots ?? defaultTotal);
    if (!Number.isInteger(total) || total <= 0) {
      skipped.push({ date: iso, reason: "invalid capacity" });
      continue;
    }
    seen.add(iso);
    wanted.push({ date: iso, totalSlots: total });
  }

  if (!wanted.length) {
    return ok({ created: [], skipped, summary: { created: 0, skipped: skipped.length } });
  }

  try {
    // One query for every clash, rather than a round trip per slot.
    const { data: existing, error: exErr } = await admin
      .from("ScheduleSlot")
      .select("date")
      .eq("experienceId", experienceId)
      .in("date", wanted.map((w) => w.date));
    if (exErr) throw exErr;

    const taken = new Set((existing || []).map((r) => new Date(r.date).toISOString()));
    const fresh = [];
    for (const w of wanted) {
      if (taken.has(w.date)) {
        skipped.push({ date: w.date, reason: "already scheduled" });
        continue;
      }
      fresh.push(w);
    }

    if (!fresh.length) {
      return ok({ created: [], skipped, summary: { created: 0, skipped: skipped.length } });
    }

    const nowIso = new Date().toISOString();
    const { data, error } = await admin
      .from("ScheduleSlot")
      .insert(
        fresh.map((w) => ({
          experienceId,
          date: w.date,
          totalSlots: w.totalSlots,
          isCancelled: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        }))
      )
      .select();
    if (error) throw error;

    return ok(
      {
        created: data || [],
        skipped,
        summary: { created: (data || []).length, skipped: skipped.length },
      },
      201
    );
  } catch (e) {
    console.error("[schedule bulk]", e);
    return bad(String(e?.message || e), 500);
  }
}
