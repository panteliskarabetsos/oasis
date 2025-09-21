import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const experienceId = parseInt(searchParams.get('experienceId'), 10);

  if (!experienceId) {
    return NextResponse.json({ error: "Experience ID required" }, { status: 400 });
  }

  try {
    const slots = await prisma.scheduleSlot.findMany({
      where: { experienceId },
      orderBy: { date: 'asc' },
      select: {
        id: true,
        date: true,
        totalSlots: true,
        bookedSlots: true,
      },
    });

    return NextResponse.json(slots);
  } catch (error) {
    console.error("GET /public/schedule error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
