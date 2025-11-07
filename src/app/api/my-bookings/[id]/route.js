// src/app/api/my-bookings/[id]/route.js
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // avoid caching

// Helper to JSON with no-store
function json(data, init = {}) {
  const res = NextResponse.json(data, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(request, { params }) {
  try {
    const id = params?.id;
    if (!id) return json({ error: "Missing id" }, { status: 400 });

    // Reuse the existing list endpoint so we inherit the same auth logic
    // and only search within the caller's own bookings.
    const origin = request.nextUrl.origin;

    const listRes = await fetch(new URL("/api/my-bookings", origin), {
      // pass through cookies so auth/session is preserved
      headers: { cookie: request.headers.get("cookie") || "" },
      cache: "no-store",
    });

    if (!listRes.ok) {
      // propagate auth errors, etc.
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

    return json(booking, { status: 200 });
  } catch (err) {
    console.error("/api/my-bookings/[id] error", err);
    return json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function HEAD(request, ctx) {
  const res = await GET(request, ctx);
  return new NextResponse(null, { status: res.status, headers: res.headers });
}
