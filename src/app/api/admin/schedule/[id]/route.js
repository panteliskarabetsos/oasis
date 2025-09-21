import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function PUT(req, { params }) {
  const session = await getServerSession({ req, ...authOptions });

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = parseInt(params.id, 10);

  if (!id || isNaN(id)) {
    return NextResponse.json({ error: 'Missing or invalid ID' }, { status: 400 });
  }

  const { totalSlots } = await req.json();

  if (typeof totalSlots !== 'number' || totalSlots < 0) {
    return NextResponse.json({ error: 'Invalid totalSlots' }, { status: 400 });
  }

  try {
    const existing = await prisma.scheduleSlot.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }

    if (existing.bookedSlots > totalSlots) {
      return NextResponse.json({
        error: `Cannot set total slots below currently booked (${existing.bookedSlots}).`,
      }, { status: 400 });
    }

    const updated = await prisma.scheduleSlot.update({
      where: { id },
      data: { totalSlots },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /schedule/[id] error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
