import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const experiences = await prisma.experience.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(experiences);
  } catch (error) {
    console.error('Error fetching experiences:', error);
    return NextResponse.json(
      { error: 'Failed to load experiences.' },
      { status: 500 }
    );
  }
}
