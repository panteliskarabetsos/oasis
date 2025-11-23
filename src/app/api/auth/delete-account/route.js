export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

// Bookings with these statuses are considered "not active"
const CANCELLED_LIST = '("cancelled","refunded","void","failed","no_show")';

export async function DELETE(req) {
  try {
    // 1. Get current auth user from Supabase (session)
    const supa = await createSupabaseServer();
    const {
      data: { user: authUser },
      error: authErr,
    } = await supa.auth.getUser();

    if (authErr) {
      console.error("[delete-account] auth.getUser error", authErr);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    if (!authUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await createSupabaseAdmin();
    if (!admin) {
      console.error("[delete-account] admin client not configured");
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    // 2. Parse body (optional hints from client)
    let body = {};
    try {
      body = await req.json();
    } catch (_) {
      body = {};
    }
    const bodyUserId = body?.userId;
    const bodyEmail = (body?.email || "").trim().toLowerCase();

    // 3. Resolve app user from public."User"
    let { data: appUser, error: userErr } = await admin
      .from("User")
      .select("id, email, auth_user_id")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();

    if (userErr) {
      console.error(
        "[delete-account] user lookup by auth_user_id error",
        userErr
      );
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    // Fallback: lookup by email if auth_user_id not linked yet
    if (!appUser && authUser.email) {
      const { data: userByEmail, error: userByEmailErr } = await admin
        .from("User")
        .select("id, email, auth_user_id")
        .eq("email", authUser.email)
        .maybeSingle();

      if (userByEmailErr) {
        console.error(
          "[delete-account] user lookup by email error",
          userByEmailErr
        );
        return NextResponse.json({ error: "Server error" }, { status: 500 });
      }

      appUser = userByEmail || null;
    }

    const authEmailNorm = (authUser.email || appUser?.email || "")
      .trim()
      .toLowerCase();

    // Optional safety checks vs body hints
    if (bodyUserId && appUser && Number(bodyUserId) !== appUser.id) {
      return NextResponse.json(
        {
          error:
            "Account mismatch detected. Please refresh the page and try again.",
        },
        { status: 403 }
      );
    }

    if (bodyEmail && authEmailNorm && bodyEmail !== authEmailNorm) {
      return NextResponse.json(
        {
          error:
            "Email mismatch detected. Please refresh the page and try again.",
        },
        { status: 403 }
      );
    }

    // 4. Block deletion if there are upcoming (future) bookings
    const nowIso = new Date().toISOString();
    let activeCount = 0;

    // a) Bookings tied by userId
    if (appUser?.id) {
      const { count, error: activeByUserErr } = await admin
        .from("booking")
        .select("id", { head: true, count: "exact" })
        .eq("userId", appUser.id)
        .gte("startTime", nowIso)
        .not("status", "in", CANCELLED_LIST); // any non-cancelled, future booking

      if (activeByUserErr) {
        console.error(
          "[delete-account] active bookings by userId error",
          activeByUserErr
        );
        return NextResponse.json({ error: "Server error" }, { status: 500 });
      }

      activeCount += count || 0;
    }

    // b) Bookings tied by primary_contact.email (guest / POS bookings)
    const emailForBookings = authEmailNorm || null;
    if (emailForBookings) {
      const { count, error: activeByEmailErr } = await admin
        .from("booking")
        .select("id", { head: true, count: "exact" })
        .gte("startTime", nowIso)
        .not("status", "in", CANCELLED_LIST)
        .ilike("primary_contact->>email", emailForBookings);

      if (activeByEmailErr) {
        console.error(
          "[delete-account] active bookings by email error",
          activeByEmailErr
        );
        return NextResponse.json({ error: "Server error" }, { status: 500 });
      }

      activeCount += count || 0;
    }

    if (activeCount > 0) {
      return NextResponse.json(
        {
          error:
            "You still have upcoming bookings. Please cancel or complete them before deleting your account.",
        },
        { status: 400 }
      );
    }

    // 5. Detach bookings from the app user (keep bookings, drop FK)
    if (appUser?.id) {
      const { error: detachErr } = await admin
        .from("booking")
        .update({ userId: null })
        .eq("userId", appUser.id);

      if (detachErr) {
        console.error("[delete-account] detach bookings error", detachErr);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
      }

      // 6. Delete app user row
      const { error: deleteAppUserErr } = await admin
        .from("User")
        .delete()
        .eq("id", appUser.id);

      if (deleteAppUserErr) {
        console.error(
          "[delete-account] delete app user error",
          deleteAppUserErr
        );
        return NextResponse.json({ error: "Server error" }, { status: 500 });
      }
    }

    // 7. Delete Supabase auth user
    // 7. Delete Supabase auth user
    const { error: authDeleteErr } = await admin.auth.admin.deleteUser(
      authUser.id
    );

    if (authDeleteErr) {
      console.error("[delete-account] delete auth user error", authDeleteErr);
      return NextResponse.json(
        {
          error:
            "We couldn’t fully close your account. Please contact support so we can help manually.",
        },
        { status: 500 }
      );
    }

    // 8. Done
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("[delete-account] unexpected error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
