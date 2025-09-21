// app/api/admin/reservations/[id]/route.js
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  const { id } = params;

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: Number(id) },
      include: {
        user: true,
        scheduleSlot: {
          include: {
            experience: true,
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    return NextResponse.json(booking);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
