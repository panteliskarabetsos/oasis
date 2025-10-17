"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import PromoBannerClient from "./PromoBannerClient";

/**
 * Hides the promo banner on /admin/* and fetches promos client-side.
 * Hook-safe: we call hooks unconditionally, then early-return.
 */
export default function PromoBannerGate() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");
  const [data, setData] = useState({ codes: [], campaigns: [] });

  useEffect(() => {
    if (isAdmin) return; // don't fetch on admin routes
    const ac = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/promotions/active", {
          signal: ac.signal,
          // or 'force-cache' if you prefer; client fetches don't support `revalidate`
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        setData({
          codes: Array.isArray(json?.codes) ? json.codes : [],
          campaigns: Array.isArray(json?.campaigns) ? json.campaigns : [],
        });
      } catch (e) {
        /* ignore (likely aborted on nav) */
      }
    })();

    return () => ac.abort();
  }, [isAdmin]);

  // Early returns happen AFTER hooks have been called → hook-safe.
  if (isAdmin) return null;
  if (data.codes.length === 0 && data.campaigns.length === 0) return null;

  return <PromoBannerClient codes={data.codes} campaigns={data.campaigns} />;
}
