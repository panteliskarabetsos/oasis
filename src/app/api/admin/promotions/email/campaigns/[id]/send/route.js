// src/app/api/admin/promotions/email/campaigns/[id]/send/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function POST(req, { params }) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum) || idNum <= 0) return bad("Invalid id");
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  // ensure campaign exists
  const { data: camp, error: cErr } = await admin
    .from("email_campaigns")
    .select("id,status")
    .eq("id", idNum)
    .maybeSingle();
  if (cErr) return bad(cErr.message, 500);
  if (!camp) return bad("Not found", 404);

  // enqueue recipients on DB side
  const { data: enq, error: eErr } = await admin.rpc("enqueue_campaign_jobs", {
    p_campaign_id: idNum,
  });
  if (eErr) return bad(eErr.message, 500);

  // mark campaign as "sending" (idempotent)
  await admin
    .from("email_campaigns")
    .update({ status: "sending", updated_at: new Date().toISOString() })
    .eq("id", idNum);

  // kick a small batch immediately (optional)
  const url = new URL(req.url);
  const base = `${url.protocol}//${url.host}`;
  // fire-and-forget; the worker route will send a batch
  fetch(`${base}/api/admin/promotions/email/worker`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campaignId: idNum, batchSize: 200 }),
  }).catch(() => {});

  return ok({ enqueued: enq || 0, status: "sending" });
}
