// app/api/admin/invoices/update/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ALLOWED = new Set([
  "fullName",
  "firstName",
  "lastName",
  "email",
  "phone",
  "businessName",
  "taxNumber",
  "addressLine1",
  "addressLine2",
  "city",
  "postalCode",
  "country",
]);

function normalize(input) {
  const out = {};
  for (const [k, v] of Object.entries(input || {})) {
    if (!ALLOWED.has(k)) continue;
    if (v === undefined || v === null) continue;
    const s = typeof v === "string" ? v.trim() : v;
    if (s === "") continue;
    out[k] = s;
  }
  return out;
}

export async function POST(req) {
  try {
    const ctype = req.headers.get("content-type") || "";
    let body;
    if (ctype.includes("application/json")) body = await req.json();
    else {
      const fd = await req.formData();
      body = Object.fromEntries(fd.entries());
    }

    const id = Number(body.id);
    if (!Number.isFinite(id)) {
      return NextResponse.redirect(
        new URL("/admin/invoices?err=bad_id", req.url)
      );
    }

    const updates = normalize(body);
    const admin = createSupabaseAdmin();
    if (!admin) {
      return NextResponse.redirect(
        new URL("/admin/invoices?err=no_admin", req.url)
      );
    }

    const { data: row, error } = await admin
      .from("Booking")
      .select("id, primary_contact")
      .eq("id", id)
      .single();

    if (error || !row) {
      return NextResponse.redirect(
        new URL(`/admin/invoices?err=not_found&id=${id}`, req.url)
      );
    }

    const pc = row.primary_contact || {};
    const nextPc = {
      ...pc,
      // top-level customer fields
      fullName: updates.fullName ?? pc.fullName ?? pc.full_name,
      firstName: updates.firstName ?? pc.firstName ?? pc.first_name,
      lastName: updates.lastName ?? pc.lastName ?? pc.last_name,
      email: updates.email ?? pc.email,
      phone: updates.phone ?? pc.phone,
      // invoice details
      businessName: updates.businessName ?? pc.businessName,
      taxNumber: updates.taxNumber ?? pc.taxNumber,
      // address (nested)
      address: {
        ...(pc.address || {}),
        line1: updates.addressLine1 ?? pc.address?.line1,
        line2: updates.addressLine2 ?? pc.address?.line2,
        city: updates.city ?? pc.address?.city,
        postalCode: updates.postalCode ?? pc.address?.postalCode,
        country: updates.country ?? pc.address?.country ?? "GR",
      },
    };

    await admin
      .from("Booking")
      .update({ primary_contact: nextPc })
      .eq("id", id);

    return NextResponse.redirect(
      new URL(`/admin/invoices?updated=${id}`, req.url)
    );
  } catch (e) {
    console.error("[/api/admin/invoices/update] error", e);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
