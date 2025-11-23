// src/app/sitemap.js

export default function sitemap() {
  // Set this in .env.local, e.g.:

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://youroasis.gr";

  const staticRoutes = [
    "/", // Home
    "/about",
    "/experiences", // listing page
    "/contact",
    "/check-availability",
    "/legal",
    "/privacy",
    "/terms",
  ];

  const now = new Date();

  return staticRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
