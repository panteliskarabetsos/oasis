// src/app/api/my-bookings/[id]/route.js
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // avoid caching

// Helper to JSON with no-store
function json(data, init = {}) {
  const res = NextResponse.json(data, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

// Normalize to keep the client happy (valid dates, unified fields)
function normalizeBooking(b) {
  if (!b || typeof b !== "object") return b;

  const rawStart =
    b?.scheduleSlot?.date ?? b?.startTime ?? b?.createdAt ?? null;

  let startISO = null;
  if (rawStart) {
    const d = new Date(rawStart);
    if (!Number.isNaN(d.getTime())) startISO = d.toISOString();
  }

  const durationMinutes = Number(
    b?.durationMinutes ?? b?.duration_minutes ?? b?.duration ?? 60
  );
  const safeDuration = Number.isFinite(durationMinutes) ? durationMinutes : 60;

  const counts = b?.counts ?? {
    adults: b?.adults ?? b?.adultsCount,
    kids: b?.kids ?? b?.kidsCount,
  };

  const experience =
    b?.scheduleSlot?.experience ??
    b?.experience ??
    (b?.experienceName ? { name: b.experienceName, location: "" } : undefined);

  const qrValue =
    b?.qrValue ??
    b?.checkInCode ??
    b?.code ??
    (b?.id ? `BOOKING-CHECKIN:${b.id}` : undefined);

  const scheduleSlot = b?.scheduleSlot
    ? {
        ...b.scheduleSlot,
        date: startISO ?? b?.scheduleSlot?.date ?? null,
        ...(experience ? { experience } : {}),
      }
    : undefined;

  return {
    ...b,
    startTime: startISO ?? b?.startTime ?? null,
    durationMinutes: safeDuration,
    ...(counts ? { counts } : {}),
    ...(experience ? { experience } : {}),
    ...(scheduleSlot ? { scheduleSlot } : {}),
    ...(qrValue ? { qrValue } : {}),
  };
}

export async function GET(request, context) {
  try {
    // ⬇️ params is a Promise in dynamic API routes; await it.
    const { id } = await context.params;
    if (!id) return json({ error: "Missing id" }, { status: 400 });

    const origin = request.nextUrl.origin;

    // Forward credentials to keep the same auth context as /api/my-bookings
    const headers = new Headers();
    const cookie = request.headers.get("cookie");
    if (cookie) headers.set("cookie", cookie);
    const auth = request.headers.get("authorization");
    if (auth) headers.set("authorization", auth);
    headers.set("accept", "application/json");

    // Reuse the existing list endpoint to inherit auth/tenant scoping logic
    const listRes = await fetch(new URL("/api/my-bookings", origin), {
      headers,
      cache: "no-store",
    });

    if (!listRes.ok) {
      return json(
        { error: `Upstream error ${listRes.status}` },
        { status: listRes.status }
      );
    }

    const bookings = await listRes.json();
    const booking = Array.isArray(bookings)
      ? bookings.find((b) => String(b?.id) === String(id))
      : null;

    if (!booking) {
      return json({ error: "Booking not found" }, { status: 404 });
    }

    return json(normalizeBooking(booking), { status: 200 });
  } catch (err) {
    console.error("/api/my-bookings/[id] error", err);
    return json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function HEAD(request, context) {
  const res = await GET(request, context);
  return new NextResponse(null, { status: res.status, headers: res.headers });
}
