// src/app/api/me/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) console.error("[api/me] supabase auth error", authError);

    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "Server not configured: missing Supabase admin env vars" },
        { status: 500 }
      );
    }

    const email = (user.email || "").trim().toLowerCase();

    const { data, error } = await admin
      .from("User")
      .select("id,email,name,surname,phone,role,dateOfBirth,createdAt")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    console.log("[/api/me] raw row:", data, "error:", error);

    if (error) {
      console.error("[api/me] supabase select error", error);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    const payload = data
      ? {
          id: data.id,
          email: data.email,
          name: data.name ?? "",
          surname: data.surname ?? "",
          phone: data.phone ?? "",
          role: data.role ?? "user",
          dateOfBirth: data.dateOfBirth ?? null,
          createdAt: data.createdAt ?? null,
        }
      : {
          id: null,
          email,
          name: "",
          surname: "",
          phone: "",
          role: "user",
          dateOfBirth: null,
          createdAt: null,
        };

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("[api/me] error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
