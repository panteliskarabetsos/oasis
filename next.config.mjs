/** @type {import('next').NextConfig} */

// Pull hostname from your Supabase URL (fallback to wildcard if env not set)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
let supabaseHost = "";
try {
  supabaseHost = SUPABASE_URL ? new URL(SUPABASE_URL).hostname : "";
} catch {}

const nextConfig = {
  // Fix: allow bigger formData/file payloads for Server Actions & route handlers
  serverActions: {
    // raise as needed: '10mb', '20mb', '50mb'
    bodySizeLimit: "20mb",
  },

  images: {
    remotePatterns: [
      // Unsplash
      { protocol: "https", hostname: "images.unsplash.com", pathname: "**" },

      // Supabase Storage (public bucket images)
      supabaseHost
        ? {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          }
        : {
            protocol: "https",
            hostname: "**.supabase.co",
            pathname: "/storage/v1/object/public/**",
          },
    ],
    // nice-to-have: smaller, modern formats
    formats: ["image/avif", "image/webp"],
  },
};

module.exports = nextConfig;
