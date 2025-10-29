// src/app/admin/components/SwRegister.tsx
"use client";
import { useEffect } from "react";

export default function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Root-scoped SW that still only handles /admin/* in its fetch handler
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
