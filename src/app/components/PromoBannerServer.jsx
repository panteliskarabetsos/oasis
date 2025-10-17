import { headers } from "next/headers";
import PromoBannerClient from "./PromoBannerClient";

export default async function PromoBannerServer() {
  // Always call dynamic APIs first (avoids hook count mismatches)
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";

  const origin = process.env.NEXT_PUBLIC_SITE_URL
    ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
    : host
    ? `${proto}://${host}`
    : "http://localhost:3000";

  // Fetch promos safely; never early-return from this server component
  let codes = [];
  let campaigns = [];
  try {
    const url = `${origin}/api/promotions/active`;
    const res = await fetch(url, { next: { revalidate: 120 } });
    if (res.ok) {
      const data = await res.json();
      codes = Array.isArray(data?.codes) ? data.codes : [];
      campaigns = Array.isArray(data?.campaigns) ? data.campaigns : [];
    }
  } catch {
    // swallow and let client render nothing
  }

  // Always render the client; it will return null if there is nothing to show
  return <PromoBannerClient codes={codes} campaigns={campaigns} />;
}
