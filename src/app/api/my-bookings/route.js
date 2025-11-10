// src/app/api/my-bookings/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supa = await createSupabaseServer();
    const {
      data: { user: authUser },
    } = await supa.auth.getUser();

    if (!authUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await createSupabaseAdmin();

    // App profile (public."User")
    const { data: appUser, error: upErr } = await admin
      .from("User")
      .select("id, name, email")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();

    if (upErr) {
      console.error("[my-bookings] user lookup error", upErr);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    const authEmail = (appUser?.email || authUser.email || "").trim();
    if (!appUser && !authEmail) return NextResponse.json([]);

    // Explicit relation to avoid PGRST201 ambiguity:
    // If your DB prefers the other FK name, swap the line with the commented alternative below.
    const SELECT_BOOKING = `
      id,
      status,
      createdAt,
      updatedAt,
      startTime,
      duration,
      counts,
      adultsCount,
      kidsCount,
      totalPaidAmount,
      currency,
      stripePaymentIntentId,
      appliedPromoCode,
      discountAmount,
      promoJson,
      customExperienceName,
      attendees,
      scheduleSlot:ScheduleSlot (
        id,
        date,
        totalSlots,
        isCancelled,
        experienceId,
        experience:Experience ( id, name, location, slug, images, duration )
      ),
      directExp:Experience!Booking_experienceId_fkey ( id, name, location, slug, images, duration )
      -- directExp:Experience!booking_experienceid_fkey ( id, name, location, slug, images, duration )
    `;

    // Query by userId (if profile exists)
    let rowsByUserId = [];
    if (appUser?.id) {
      const { data, error } = await admin
        .from("booking")
        .select(SELECT_BOOKING)
        .eq("userId", appUser.id)
        .order("createdAt", { ascending: false });
      if (error) {
        console.error("[my-bookings] select by userId error", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
      }
      rowsByUserId = data || [];
    }

    // Query by email captured in primary_contact (for POS/checkouts)
    let rowsByEmail = [];
    if (authEmail) {
      const { data, error } = await admin
        .from("booking")
        .select(SELECT_BOOKING)
        .ilike("primary_contact->>email", authEmail)
        .order("createdAt", { ascending: false });
      if (error) {
        console.error("[my-bookings] select by email error", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
      }
      rowsByEmail = data || [];
    }

    // Merge / dedupe
    const mergedMap = new Map();
    for (const r of [...rowsByUserId, ...rowsByEmail]) mergedMap.set(r.id, r);
    const merged = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const userInfo = {
      name: appUser?.name || null,
      email: appUser?.email || authEmail || null,
    };

    const data = merged.map((b) => {
      const exp = b.directExp || b.scheduleSlot?.experience || null;
      const experienceName = b.customExperienceName || exp?.name || null;
      const whenISO = b.startTime || b.scheduleSlot?.date || b.createdAt;

      const counts = b.counts || {
        adults: Number.isFinite(b.adultsCount) ? b.adultsCount : null,
        kids: Number.isFinite(b.kidsCount) ? b.kidsCount : null,
      };

      const posItems =
        b?.attendees?.posItems && Array.isArray(b.attendees.posItems)
          ? b.attendees.posItems
          : null;

      return {
        id: b.id,
        status: b.status,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        startTime: whenISO,
        duration: b.duration ?? exp?.duration ?? null,
        counts,
        totalPaidAmount: b.totalPaidAmount ?? 0,
        currency: (b.currency || "eur").toLowerCase(),
        stripePaymentIntentId: b.stripePaymentIntentId || null,
        experience: exp
          ? {
              id: exp.id,
              name: exp.name,
              location: exp.location,
              slug: exp.slug,
              images: exp.images,
              duration: exp.duration ?? null,
            }
          : null,
        experienceName,
        scheduleSlot: b.scheduleSlot
          ? {
              id: b.scheduleSlot.id,
              date: b.scheduleSlot.date,
              totalSlots: b.scheduleSlot.totalSlots,
              isCancelled: b.scheduleSlot.isCancelled,
            }
          : null,
        appliedPromoCode: b.appliedPromoCode || null,
        discountAmount: b.discountAmount || 0,
        promoJson: b.promoJson || null,
        posItems,
        user: userInfo,
      };
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("[my-bookings] error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
