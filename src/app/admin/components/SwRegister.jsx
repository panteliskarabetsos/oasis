"use client";

import { useEffect } from "react";

export default function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Scope must match the file path (/public/admin/sw.js)
    navigator.serviceWorker
      .register("/admin/sw.js", { scope: "/admin/" })
      .catch(console.warn);
  }, []);

  return null;
}
