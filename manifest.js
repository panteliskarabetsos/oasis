// app/manifest.js
import { type MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Oasis Admin",
    short_name: "Oasis Admin",
    description: "Admin console for Oasis",
    start_url: "/admin/",
    scope: "/admin/",
    display: "standalone",
    background_color: "#f4f1ec",
    theme_color: "#8b6f47",
    icons: [
      { src: "/icons/admin-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/admin-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/admin-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable any",
      },
    ],
  };
}
