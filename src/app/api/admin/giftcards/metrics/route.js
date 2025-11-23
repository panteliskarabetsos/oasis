// =============================================
// API: src/app/api/admin/giftcards/metrics/route.js
// =============================================
export const runtime_m = "nodejs";
export const dynamic_m = "force-dynamic";
import { NextResponse as NR } from "next/server";
import { requireAdmin as reqAdmin } from "@/lib/auth/requireAdmin";

export async function GET() {
  const r = await reqAdmin();
  if (!r.ok) return r.response;
  const admin = r.admin;

  const nowIso = new Date().toISOString();
  const dt30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const [outRes, soldRes, redRes, avgRes] = await Promise.all([
    admin.rpc("giftcard_outstanding_cents", {}), // optional RPC if you add, else fallback below
    admin
      .from("GiftCard")
      .select("id", { count: "exact", head: true })
      .gte("issued_at", dt30),
    admin
      .from("GiftCardRedemption")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dt30),
    admin
      .from("GiftCard")
      .select("initial_amount_cents")
      .gte("issued_at", dt30),
  ]);

  let outstandingCents = 0;
  if (!outRes?.data && !outRes?.error) {
    // fallback aggregate
    const { data } = await admin
      .from("GiftCard")
      .select("remaining_amount_cents, status, expires_at");
    outstandingCents = (data || [])
      .filter(
        (x) => x.status === "active" && (!x.expires_at || x.expires_at > nowIso)
      )
      .reduce((acc, x) => acc + (x.remaining_amount_cents || 0), 0);
  } else if (outRes?.data) {
    outstandingCents = outRes.data; // if RPC provided
  }

  const sold30d = soldRes?.count || 0;
  const redemptions30d = redRes?.count || 0;
  const avgValue30dCents = (() => {
    const arr = avgRes?.data || [];
    if (!arr.length) return 0;
    const sum = arr.reduce((a, b) => a + (b.initial_amount_cents || 0), 0);
    return Math.round(sum / arr.length);
  })();

  return NR.json({
    outstandingCents,
    sold30d,
    redemptions30d,
    avgValue30dCents,
    currency: "EUR",
  });
}
