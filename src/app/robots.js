// src/app/robots.js
import { MetadataRoute } from "next";

export default function robots() /** @returns {MetadataRoute.Robots} */ {
  // Set this in .env: NEXT_PUBLIC_SITE_URL=https://your-domain.com
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://youroasis.gr";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Auth / account
          "/login",
          "/sign-up",
          "/forgot-password",
          "/reset-password",
          "/account/",
          "/dashboard/",

          // Internal / admin
          "/admin/",
          "/api/",

          // Booking flow that shouldn't be indexed
          "/booking",
          "/booking/",
          "/booking-confirmed",
          "/booking-confirmed/",
          "/bookings",
          "/bookings/",
          "/favourites",
          "/favourites/",
          "/goodbye",
          "/goodbye/",
          "/under-construction",
          "/under-construction/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
