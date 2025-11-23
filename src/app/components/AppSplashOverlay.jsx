"use client";
import { useEffect, useState } from "react";

export default function AppSplashOverlay() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onBooted = () => setHidden(true);
    window.addEventListener("admin:booted", onBooted);
    const t = setTimeout(() => setHidden(true), 800); // safety fadeout
    return () => {
      window.removeEventListener("admin:booted", onBooted);
      clearTimeout(t);
    };
  }, []);

  if (hidden) return null;

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-[#f4f1ec]">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#8b6f47] text-white font-semibold">
          O
        </span>
        <span className="font-serif text-lg tracking-tight text-[#5a4a3f]">
          Oasis Admin
        </span>
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-[#8b6f47] border-t-transparent"
          aria-label="Loading"
        />
      </div>
    </div>
  );
}
