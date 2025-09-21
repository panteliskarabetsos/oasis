import { prisma } from '@/lib/prisma';

export async function GET(req, { params }) {
  const { id } = params;

  try {
    const experience = await prisma.experience.findUnique({
      where: { id: parseInt(id) },
    });

    if (!experience) {
      return new Response(JSON.stringify({ error: 'Experience not found' }), { status: 404 });
    }

    return new Response(JSON.stringify(experience), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch experience' }), { status: 500 });
  }
}
