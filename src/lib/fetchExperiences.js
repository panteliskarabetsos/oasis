// src/lib/fetchExperiences.js
import prisma from './prisma';

export async function getExperienceBySlug(slug) {
  if (!slug) return null;
  return prisma.experience.findFirst({
    where: { slug, visibility: true },
  });
}
