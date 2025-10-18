// src/app/api/admin/promotions/email/worker/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createTransport } from "@/lib/email/sender";
import { makeUnsubToken } from "@/lib/newsletter/signing";
import { computeOrigin } from "@/lib/url/origin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

// naive single-run worker; for large lists, trigger it repeatedly (cron)
// POST { campaignId, batchSize?: number }
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const campaignId = Number(body.campaignId || 0);
  const batchSize = Math.max(1, Math.min(500, Number(body.batchSize || 200)));
  if (!Number.isFinite(campaignId) || campaignId <= 0)
    return bad("Invalid campaignId");

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  // load campaign content
  const { data: camp, error: cErr } = await admin
    .from("email_campaigns")
    .select("id,subject,preheader,from_name,from_email,html,text,status")
    .eq("id", campaignId)
    .maybeSingle();
  if (cErr) return bad(cErr.message, 500);
  if (!camp) return bad("Campaign not found", 404);
  if (camp.status === "canceled") return bad("Campaign canceled", 409);

  // load a batch of pending jobs
  const { data: jobs, error: jErr } = await admin
    .from("email_campaign_jobs")
    .select("id,email")
    .eq("campaign_id", campaignId)
    .eq("status", "pending")
    .order("id", { ascending: true })
    .limit(batchSize);
  if (jErr) return bad(jErr.message, 500);

  if (!jobs || jobs.length === 0) {
    // if no pending left, mark campaign as sent
    await admin
      .from("email_campaigns")
      .update({ status: "sent", updated_at: new Date().toISOString() })
      .eq("id", campaignId);
    return ok({ processed: 0, done: true });
  }

  const transport = createTransport();
  const origin = computeOrigin(req);

  let sent = 0,
    failed = 0;
  for (const job of jobs) {
    const unsubToken = makeUnsubToken(job.email);
    const unsubUrl = `${origin}/api/newsletter/unsubscribe?e=${encodeURIComponent(
      job.email
    )}&t=${unsubToken}`;
    const footer = `<p style="margin-top:24px;color:#666;font-size:12px;">If you no longer wish to receive these emails, <a href="${unsubUrl}">unsubscribe here</a>.</p>`;

    const html = camp.html.includes("</body>")
      ? camp.html.replace("</body>", `${footer}</body>`)
      : camp.html + footer;

    const text = (camp.text || "") + `\n\nUnsubscribe: ${unsubUrl}`;

    try {
      await transport.sendMail({
        from: `"${camp.from_name}" <${camp.from_email}>`,
        to: job.email,
        subject: camp.subject,
        headers: camp.preheader ? { "X-Preheader": camp.preheader } : undefined,
        text,
        html,
      });

      await admin
        .from("email_campaign_jobs")
        .update({
          status: "sent",
          attempts: 1,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", job.id);
      sent++;
    } catch (e) {
      await admin
        .from("email_campaign_jobs")
        .update({
          status: "failed",
          attempts: 1,
          last_error: String(e?.message || "send failed"),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      failed++;
    }
  }

  return ok({
    processed: jobs.length,
    sent,
    failed,
    nextHint: "call again to process next batch",
  });
}
