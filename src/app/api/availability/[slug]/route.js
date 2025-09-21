import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(req) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { slotId, numberOfPeople } = await req.json();

    // Get current slot info
    const slot = await prisma.scheduleSlot.findUnique({
      where: { id: slotId },
    });

    if (!slot || slot.isCancelled) {
      return NextResponse.json({ error: 'Slot not found or is cancelled' }, { status: 400 });
    }

    const available = slot.totalSlots - slot.bookedSlots;

    if (available < numberOfPeople) {
      return NextResponse.json({ error: `Only ${available} spots left` }, { status: 400 });
    }

    // Create reservation
    const booking = await prisma.booking.create({
      data: {
        userId: session.user.id,
        scheduleSlotId: slotId,
        numberOfPeople,
        status: 'CONFIRMED',
      },
    });

    // Update bookedSlots
    await prisma.scheduleSlot.update({
      where: { id: slotId },
      data: {
        bookedSlots: {
          increment: numberOfPeople,
        },
      },
    });

    return NextResponse.json(booking);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
