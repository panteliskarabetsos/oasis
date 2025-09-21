export const runtime = 'nodejs';

import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(_req, ctx) {
  const { slug } = await ctx.params; 

  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }

  try {
    const experience = await prisma.experience.findUnique({ where: { slug } });
    if (!experience) {
      return NextResponse.json({ error: 'Experience not found' }, { status: 404 });
    }
    return NextResponse.json(experience);
  } catch (err) {
    console.error('Error fetching experience:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
