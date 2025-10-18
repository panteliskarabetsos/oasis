"use client";

import { usePathname } from "next/navigation";

export default function FooterGate({ children }) {
  const pathname = usePathname() || "";
  // Hide footer for /admin and all subroutes
  if (pathname.startsWith("/admin")) return null;
  return children;
}
