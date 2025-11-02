// =============================================
// API: src/app/api/admin/giftcards/route.js
// =============================================
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export async function GET(req) {
  const r = await requireAdmin();
  if (!r.ok) return r.response;
  const admin = r.admin;

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") || "all").toLowerCase();
  const q = (url.searchParams.get("q") || "").toLowerCase();

  let query = admin
    .from("GiftCard")
    .select(
      "id, code, status, initial_amount_cents, remaining_amount_cents, currency, recipient_email, recipient_name, issued_at, expires_at"
    )
    .order("issued_at", { ascending: false });

  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || [])
    .filter((x) => {
      if (!q) return true;
      const hay = `${x.code} ${x.status} ${x.currency} ${
        x.recipient_email || ""
      } ${x.recipient_name || ""}`.toLowerCase();
      return hay.includes(q);
    })
    .map((x) => ({
      id: x.id,
      code: x.code,
      status: x.status,
      initialAmountCents: x.initial_amount_cents,
      remainingAmountCents: x.remaining_amount_cents,
      currency: x.currency,
      recipientEmail: x.recipient_email,
      recipientName: x.recipient_name,
      issuedAt: x.issued_at,
      expiresAt: x.expires_at,
    }));

  return NextResponse.json(rows);
}

export async function POST(req) {
  const r = await requireAdmin();
  if (!r.ok) return r.response;
  const admin = r.admin;

  let body = {};
  try {
    body = await req.json();
  } catch {}
  const code = (body.code || "").trim().toUpperCase();
  const currency = (body.currency || "EUR").toUpperCase();
  const initial = Number.isFinite(body.initialAmountCents)
    ? Math.max(0, body.initialAmountCents)
    : 0;
  if (!code)
    return NextResponse.json({ error: "code is required" }, { status: 422 });
  if (initial <= 0)
    return NextResponse.json(
      { error: "initialAmountCents must be > 0" },
      { status: 422 }
    );

  const payload = {
    code,
    currency,
    initial_amount_cents: initial,
    remaining_amount_cents: initial,
    recipient_email: body.recipientEmail || null,
    recipient_name: body.recipientName || null,
    message: body.message || null,
    expires_at: body.expiresAt || null,
    status: "active",
    source: body.source || "admin",
  };

  const { data, error } = await admin
    .from("GiftCard")
    .insert(payload)
    .select("id")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
