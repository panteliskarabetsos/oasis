import { headers } from "next/headers";
import PromoBannerClient from "./PromoBannerClient";

export default async function PromoBannerServer() {
  // Build absolute origin from headers (works on Vercel and locally)
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL /* e.g. https://oasis.example */ ||
    (host ? `${proto}://${host}` : "http://localhost:3000");

  const res = await fetch(`${origin}/api/promotions/active`, {
    next: { revalidate: 120 },
  });
  if (!res.ok) return null; // ← remove the stray "{"
  const data = await res.json();

  const codes = Array.isArray(data?.codes) ? data.codes : [];
  const campaigns = Array.isArray(data?.campaigns) ? data.campaigns : [];
  if (codes.length === 0 && campaigns.length === 0) return null;

  return <PromoBannerClient codes={codes} campaigns={campaigns} />;
}
