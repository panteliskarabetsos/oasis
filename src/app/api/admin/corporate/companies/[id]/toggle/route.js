export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export async function POST(req, { params }) {
  const r = await requireAdmin();
  if (!r.ok) return r.response;

  const id = params?.id;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 422 });

  const { isActive } = await req.json().catch(() => ({}));
  if (typeof isActive !== "boolean") {
    return NextResponse.json(
      { error: "'isActive' boolean is required" },
      { status: 422 }
    );
  }

  const { admin } = r;
  const { error } = await admin
    .from("corporate_companies")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
