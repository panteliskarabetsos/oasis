// src/app/api/me/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supa = await createSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supa.auth.getUser();
    if (authError) console.error("[api/me] auth error:", authError);

    if (!user) {
      // Always 200 to avoid noisy client errors; role falls back to "user"
      return NextResponse.json(
        {
          id: null,
          email: "",
          name: "",
          surname: "",
          phone: "",
          role: "user",
          dateOfBirth: null,
          createdAt: null,
        },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const { data: row, error: dbErr } = await supa
      .from("User") // quoted table name in PostgREST is fine
      .select("id,email,name,surname,phone,role,dateOfBirth,createdAt")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (dbErr) {
      console.error("[api/me] select error:", dbErr);
      // Soft-fallback, don’t break the UI
      return NextResponse.json(
        {
          id: null,
          email: user.email ?? "",
          name: "",
          surname: "",
          phone: "",
          role: "user",
          dateOfBirth: null,
          createdAt: null,
        },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const payload = row
      ? {
          id: row.id,
          email: row.email,
          name: row.name ?? "",
          surname: row.surname ?? "",
          phone: row.phone ?? "",
          role: row.role ?? "user",
          dateOfBirth: row.dateOfBirth ?? null,
          createdAt: row.createdAt ?? null,
        }
      : {
          id: null,
          email: user.email ?? "",
          name: "",
          surname: "",
          phone: "",
          role: "user",
          dateOfBirth: null,
          createdAt: null,
        };

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    console.error("[api/me] unexpected error:", e);
    return NextResponse.json(
      {
        id: null,
        email: "",
        name: "",
        surname: "",
        phone: "",
        role: "user",
        dateOfBirth: null,
        createdAt: null,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
