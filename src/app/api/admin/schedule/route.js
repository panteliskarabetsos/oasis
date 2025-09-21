// src/app/api/admin/schedule/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = createSupabaseServer();

  if (!supabase) {
    console.error("[admin/schedule] Supabase env missing");
    return {
      error: true,
      response: NextResponse.json(
        {
          error:
            "Server misconfiguration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        },
        { status: 500 }
      ),
    };
  }

  // Prefer getSession (works the same for this purpose)
  if (!supabase.auth || !supabase.auth.getSession) {
    console.error("[admin/schedule] Supabase client not initialized correctly");
    return {
      error: true,
      response: NextResponse.json(
        { error: "Auth not available on Supabase client." },
        { status: 500 }
      ),
    };
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.user) {
    return {
      error: true,
      response: NextResponse.json(
        { error: "Unauthorized – No active session" },
        { status: 401 }
      ),
    };
  }

  const user = session.user;
  const role = user.app_metadata?.role || user.user_metadata?.role || "user";

  if (role !== "admin") {
    return {
      error: true,
      response: NextResponse.json(
        { error: "Unauthorized – Admin access required" },
        { status: 403 }
      ),
    };
  }

  return { error: false, user };
}

// GET: Get all slots for a given experience
export async function GET(req) {
  const auth = await requireAdmin();
  if (auth.error) return auth.response;

  const { searchParams } = new URL(req.url);
  const experienceId = Number(searchParams.get("experienceId"));

  if (!experienceId) {
    return NextResponse.json(
      { error: "Experience ID required" },
      { status: 400 }
    );
  }

  try {
    const slots = await prisma.scheduleSlot.findMany({
      where: { experienceId },
      orderBy: { date: "asc" },
    });
    return NextResponse.json(slots);
  } catch (error) {
    console.error("GET /admin/schedule error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST: Create a new schedule slot
export async function POST(req) {
  const auth = await requireAdmin();
  if (auth.error) return auth.response;

  const { experienceId, date, totalSlots } = await req.json();

  if (!experienceId || !date || totalSlots == null) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  try {
    const newSlot = await prisma.scheduleSlot.create({
      data: {
        experienceId: Number(experienceId),
        date: new Date(date),
        totalSlots: Number(totalSlots),
        bookedSlots: 0,
      },
    });
    return NextResponse.json(newSlot, { status: 201 });
  } catch (error) {
    console.error("POST /admin/schedule error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT: Update totalSlots
export async function PUT(req) {
  const auth = await requireAdmin();
  if (auth.error) return auth.response;

  try {
    const { id, totalSlots } = await req.json();

    if (!id || totalSlots == null) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    if (typeof totalSlots !== "number" || totalSlots < 0) {
      return NextResponse.json(
        { error: "Invalid totalSlots" },
        { status: 400 }
      );
    }

    const existing = await prisma.scheduleSlot.findUnique({
      where: { id: Number(id) },
    });
    if (!existing) {
      return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    }
    if (existing.bookedSlots > totalSlots) {
      return NextResponse.json(
        {
          error: `Cannot set total slots below currently booked (${existing.bookedSlots}).`,
        },
        { status: 400 }
      );
    }

    const updatedSlot = await prisma.scheduleSlot.update({
      where: { id: Number(id) },
      data: { totalSlots },
    });
    return NextResponse.json(updatedSlot);
  } catch (error) {
    console.error("PUT /admin/schedule error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE: Remove a slot
export async function DELETE(req) {
  const auth = await requireAdmin();
  if (auth.error) return auth.response;

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));

  if (!id) {
    return NextResponse.json({ error: "Missing ID" }, { status: 400 });
  }

  try {
    await prisma.scheduleSlot.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted slot successfully" });
  } catch (error) {
    console.error("DELETE /admin/schedule error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
