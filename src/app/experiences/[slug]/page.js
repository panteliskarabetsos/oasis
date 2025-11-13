// app/experiences/[slug]/page.js
export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // Prisma-safe runtime

import Image from "next/image";
import Script from "next/script";
import Link from "next/link";
import { cache } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import LinkWithLoader from "@/app/components/LinkWithLoader";
import { getExperienceBySlug } from "@/lib/fetchExperiences";

// ---- Data fetch (deduped between metadata + page) ----
const getExperience = cache((slug) => getExperienceBySlug(slug));

// ---- Helpers (pricing) ----
function normalizePricing(exp) {
  const pj = exp?.pricing || {};
  const adult = toNum(pj.adult ?? exp?.priceAdult);
  const kid = toNum(pj.kid ?? exp?.priceKid, adult);
  return { adult, kid };
}
function toNum(x, fallback = null) {
  if (x === null || x === undefined) return fallback;
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}
function eur(n) {
  return `€${(Number(n) || 0).toFixed(2)}`;
}
function minDefined(...vals) {
  const nums = vals.filter(
    (v) => typeof v === "number" && Number.isFinite(v) && v > 0
  );
  return nums.length ? Math.min(...nums) : null;
}
function maxDefined(...vals) {
  const nums = vals.filter(
    (v) => typeof v === "number" && Number.isFinite(v) && v > 0
  );
  return nums.length ? Math.max(...nums) : null;
}

// ---- Metadata ----
export async function generateMetadata({ params }) {
  const { slug } = await params;
  if (!slug) {
    return {
      title: "Experience not available",
      robots: { index: false, follow: false },
    };
  }

  const experience = await getExperience(slug);
  if (!experience) {
    return {
      title: "Experience not available",
      description: "This experience is private or has been removed.",
      robots: { index: false, follow: false },
    };
  }

  const { name, description, images } = experience;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const url = `${siteUrl}/experiences/${slug}`;
  const ogImages = (Array.isArray(images) ? images : [])
    .slice(0, 4)
    .map((src) => ({ url: src }));
  const desc = description?.slice(0, 160);

  return {
    title: name,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title: name,
      description: desc,
      url,
      type: "website",
      images: ogImages.length ? ogImages : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: name,
      description: description?.slice(0, 200),
      images: ogImages?.[0]?.url ? [ogImages[0].url] : undefined,
    },
  };
}

// ---- Page ----
export default async function ExperienceDetailPage({ params }) {
  const { slug } = await params;
  if (!slug) return <NotAvailable />;

  const experience = await getExperience(slug);
  if (!experience) return <NotAvailable />;

  const {
    name = "Untitled Experience",
    description = "",
    location,
    duration,
    whatsIncluded,
    whatToBring,
    whyYoullLove,
    images,
    mapPin,
    guestReviews,
  } = experience;

  const prices = normalizePricing(experience);
  const fromPrice = minDefined(prices.adult, prices.kid);

  const parsedImages = (Array.isArray(images) ? images : []).filter(Boolean);
  const parsedReviews = Array.isArray(guestReviews)
    ? guestReviews
        .map((r) => (typeof r === "string" ? { name: "Guest", comment: r } : r))
        .filter(Boolean)
    : [];

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const pageUrl = `${siteUrl}/experiences/${slug}`;

  const jsonLd = buildJsonLd({
    name,
    description,
    prices,
    location,
    images: parsedImages,
    pageUrl,
  });

  return (
    <main className="bg-gradient-to-b from-[#f4f1ec] via-[#faf9f7] to-[#f4f1ec] text-[#2f2f2f] min-h-screen">
      {/* JSON-LD for rich results */}
      <Script
        id="experience-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Ambient background blob */}
      <div aria-hidden className="fixed inset-0 -z-10">
        <div
          className="pointer-events-none absolute -top-32 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full blur-3xl opacity-40"
          style={{
            background:
              "radial-gradient(closest-side, #e8dfcf, transparent 70%)",
          }}
        />
      </div>

      {/* HERO */}
      <section className="relative">
        {/* Background image */}
        <div className="relative h-[320px] sm:h-[420px] lg:h-[460px] overflow-hidden">
          {parsedImages?.[0] ? (
            <>
              <Image
                src={parsedImages[0]}
                alt={`${name} banner`}
                fill
                priority
                className="object-cover scale-105"
                sizes="100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-[#d8cbb5] to-[#f4f1ec]" />
          )}

          {/* Back button + content */}
          <div className="absolute inset-0 flex flex-col justify-between pt-20 sm:pt-24">
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 flex justify-between items-start">
              <LinkWithLoader
                href="/experiences"
                aria-label="Back to Experiences"
              >
                <button className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 backdrop-blur px-4 py-2 text-xs sm:text-sm text-[#5a4a3f] hover:bg-white transition">
                  <ArrowLeft size={16} aria-hidden="true" />
                  Back to experiences
                </button>
              </LinkWithLoader>
            </div>

            {/* Title card */}
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 pb-6 sm:pb-10">
              <div className="max-w-3xl rounded-3xl bg-white/90 backdrop-blur border border-white/80 shadow-[0_18px_55px_rgba(0,0,0,0.22)] px-5 py-5 sm:px-7 sm:py-7">
                <h1 className="text-2xl sm:text-4xl lg:text-5xl font-serif text-[#5a4a3f] leading-tight">
                  {name}
                </h1>

                {(duration || fromPrice !== null || location) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                    {duration && (
                      <span className="inline-flex items-center rounded-full bg-[#f4ede2] px-3 py-1 text-[#5a4a3f]">
                        {duration}
                      </span>
                    )}
                    {location && (
                      <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[#8b6f47] border border-[#e2d7c7]">
                        {location}
                      </span>
                    )}
                    {fromPrice !== null && (
                      <span className="inline-flex items-center rounded-full bg-[#8b6f47] px-3 py-1 text-white font-medium">
                        From {eur(fromPrice)} / person
                      </span>
                    )}
                  </div>
                )}
                <p className="mt-3 text-xs tracking-[0.22em] uppercase text-[#8b7a6b]">
                  Small groups • Slow-paced • Nature-first
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT LAYOUT */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)] lg:items-start">
          {/* LEFT COLUMN – Story & details */}
          <div className="space-y-10">
            {/* Description */}
            {description && (
              <section>
                <h2 className="text-sm tracking-[0.3em] uppercase text-[#8b6f47] mb-3">
                  Overview
                </h2>
                <p className="text-[16px] sm:text-[17px] leading-relaxed text-[#4a4a4a] whitespace-pre-line">
                  {description}
                </p>
              </section>
            )}

            {/* What’s included / to bring / why you'll love */}
            {(whatsIncluded || whatToBring || whyYoullLove) && (
              <section className="space-y-6">
                {whatsIncluded && (
                  <div className="rounded-3xl border border-[#e0dcd4] bg-white/90 p-6 sm:p-7 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
                    <h3 className="text-xl sm:text-2xl font-serif text-[#5a4a3f] mb-4">
                      What’s included
                    </h3>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
                      {splitItems(whatsIncluded).map((item, i) => (
                        <li
                          key={i}
                          className="inline-flex items-start gap-2 text-[15px] text-[#4a4a4a]"
                        >
                          <CheckCircle2
                            className="mt-0.5 shrink-0 text-[#8b6f47]"
                            size={18}
                            aria-hidden
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {whatToBring && (
                  <div className="rounded-3xl border border-[#e0dcd4] bg-[#fffdf9] p-6 sm:p-7 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
                    <h3 className="text-xl sm:text-2xl font-serif text-[#5a4a3f] mb-3 inline-flex items-center gap-2">
                      <AlertCircle size={20} aria-hidden />
                      What to bring
                    </h3>
                    <p className="text-[15px] leading-relaxed text-[#4a4a4a] whitespace-pre-line">
                      {whatToBring}
                    </p>
                  </div>
                )}

                {whyYoullLove && (
                  <div className="rounded-3xl border border-[#e0dcd4] bg-white/90 p-6 sm:p-8 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
                    <h3 className="text-xl sm:text-2xl font-serif text-[#5a4a3f] mb-3 text-center">
                      Why you’ll love it
                    </h3>
                    <blockquote className="mx-auto max-w-3xl text-center text-lg sm:text-xl leading-relaxed text-[#5a4a3f]">
                      “{whyYoullLove}”
                    </blockquote>
                  </div>
                )}
              </section>
            )}
          </div>

          {/* RIGHT COLUMN – Booking / pricing card */}
          <aside className="lg:sticky lg:top-28">
            <div className="rounded-3xl border border-[#e0dcd4] bg-white/95 shadow-[0_18px_45px_rgba(90,74,63,0.18)] p-6 sm:p-7 space-y-5">
              <h2 className="text-xl font-serif text-[#5a4a3f]">
                Plan your visit
              </h2>

              <div className="space-y-2 text-sm text-[#4a4a4a]">
                {location && (
                  <p>
                    <span className="font-semibold text-[#5a4a3f]">
                      Location:
                    </span>{" "}
                    {location}
                  </p>
                )}
                {duration && (
                  <p>
                    <span className="font-semibold text-[#5a4a3f]">
                      Duration:
                    </span>{" "}
                    {duration}
                  </p>
                )}
              </div>

              <div className="border-t border-[#e6dfd4] pt-4">
                <p className="text-xs tracking-[0.24em] uppercase text-[#8b7a6b] mb-2">
                  Pricing
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-center text-sm">
                  <div className="rounded-2xl border border-[#e0dcd4] bg-[#fbf7f1] p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#7a6a5f] mb-1">
                      Adult
                    </div>
                    <div className="text-lg font-semibold text-[#5a4a3f]">
                      {typeof prices.adult === "number"
                        ? eur(prices.adult)
                        : "—"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#e0dcd4] bg-[#fbf7f1] p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#7a6a5f] mb-1">
                      Kid (3–12)
                    </div>
                    <div className="text-lg font-semibold text-[#5a4a3f]">
                      {typeof prices.kid === "number"
                        ? eur(prices.kid)
                        : typeof prices.adult === "number"
                        ? eur(prices.adult)
                        : "—"}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-[#7a6a5f] text-center">
                  Final total is calculated at checkout based on your group.
                </p>
              </div>

              <LinkWithLoader href={`/check-availability/${slug}`}>
                <button className="mt-2 w-full bg-[#8b6f47] text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-[#a78b62] transition-all">
                  Check availability
                </button>
              </LinkWithLoader>

              <p className="text-[11px] text-center text-[#7a6a5f]">
                No payment is taken at this step. You&apos;ll receive a
                confirmation email once your booking is approved.
              </p>
            </div>
          </aside>
        </div>
      </section>

      {/* GALLERY */}
      {parsedImages.length > 1 && (
        <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-16">
          <h3 className="text-2xl sm:text-3xl font-serif text-[#5a4a3f] mb-6 text-center">
            Gallery
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {parsedImages.slice(1).map((img, idx) => {
              const j = idx + 1; // slides start at 1 to skip hero image
              return (
                <a
                  key={img + j}
                  href={`#lb-${j}`}
                  className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-[#e0dcd4] bg-[#f4ede2] shadow-[0_10px_30px_rgba(0,0,0,0.08)]"
                  aria-label={`Open slide ${j + 1}`}
                >
                  <Image
                    src={img}
                    alt={`${name} photo ${j + 1}`}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                </a>
              );
            })}
          </div>

          {/* Lightbox overlays (CSS-only) */}
          {(() => {
            const n = parsedImages.length - 1; // slides excluding hero
            return parsedImages.slice(1).map((img, idx) => {
              const j = idx + 1;
              const prev = j - 1 >= 1 ? j - 1 : n;
              const next = j + 1 <= n ? j + 1 : 1;
              return (
                <div
                  key={`overlay-${j}`}
                  id={`lb-${j}`}
                  className="lightbox fixed inset-0 z-[60] hidden"
                >
                  <a
                    href="#_"
                    className="absolute inset-0 bg-black/80"
                    aria-label="Close"
                  />

                  <div className="absolute inset-0 flex items-center justify-center p-4">
                    <div className="relative w-[min(92vw,1200px)] h-[80vh]">
                      <Image
                        src={img}
                        alt={`${name} photo ${j + 1}`}
                        fill
                        sizes="(max-width: 1400px) 92vw, 1200px"
                        className="object-contain"
                      />
                    </div>
                  </div>

                  <a
                    href={`#lb-${prev}`}
                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
                    aria-label="Previous slide"
                  >
                    <ChevronLeft size={24} />
                  </a>
                  <a
                    href={`#lb-${next}`}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
                    aria-label="Next slide"
                  >
                    <ChevronRight size={24} />
                  </a>
                  <a
                    href="#_"
                    className="absolute right-5 top-5 rounded-full bg-white/90 p-2 shadow hover:bg-white"
                    aria-label="Close slideshow"
                  >
                    <X size={20} />
                  </a>
                </div>
              );
            });
          })()}

          <style>{`
            .lightbox:target { display: block; }
          `}</style>
        </section>
      )}

      {/* MAP */}
      {mapPin && (
        <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-18 lg:pb-20">
          <h3 className="text-2xl sm:text-3xl font-serif text-[#5a4a3f] mb-6 text-center">
            Where you&apos;ll be
          </h3>
          <div className="overflow-hidden rounded-2xl border border-[#e0dcd4] shadow-[0_16px_40px_rgba(0,0,0,0.14)]">
            <div className="w-full aspect-[16/9]">
              <iframe
                title={`Map location for ${name}`}
                src={`https://www.google.com/maps?q=${encodeURIComponent(
                  mapPin
                )}&z=14&output=embed`}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
          <p className="mt-2 text-center text-sm text-[#4a4a4a]">
            Having trouble viewing the map?{" "}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                mapPin
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-[#8b6f47] hover:text-[#5a4a3f]"
            >
              Open in Google Maps
            </a>
          </p>
        </section>
      )}

      {/* REVIEWS */}
      {parsedReviews.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-24">
          <h3 className="text-2xl sm:text-3xl font-serif text-[#5a4a3f] mb-6 text-center">
            Guest reviews
          </h3>
          <div className="grid gap-6 sm:grid-cols-2">
            {parsedReviews.map((review, i) => (
              <article
                key={(review?.name || "guest") + i}
                className="rounded-2xl border border-[#e0dcd4] bg-white/95 p-6 shadow-[0_12px_32px_rgba(0,0,0,0.08)]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8dfcf] font-semibold text-[#5a4a3f]">
                    {initials(review?.name || "Guest")}
                  </div>
                  <p className="font-semibold text-lg text-[#5a4a3f]">
                    {review?.name || "Guest"}
                  </p>
                </div>
                {review?.comment && (
                  <p className="mt-3 italic text-[#4a4a4a]">
                    “{review.comment}”
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

// ---- Helpers ----
function splitItems(text) {
  if (!text) return [];
  return text
    .split(/\r?\n|•/g)
    .map((s) => s.replace(/^[−–-\s]+/, "").trim())
    .filter(Boolean);
}

function initials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

// Use AggregateOffer so Google understands min/max tier pricing
function buildJsonLd({ name, description, prices, location, images, pageUrl }) {
  const low = minDefined(prices?.kid, prices?.adult);
  const high = maxDefined(prices?.kid, prices?.adult);

  const offers =
    low !== null
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "EUR",
          lowPrice: Number(low),
          ...(high !== null ? { highPrice: Number(high) } : {}),
          offerCount: 1,
          url: pageUrl,
        }
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    image: images?.length ? images : undefined,
    url: pageUrl,
    areaServed: location || undefined,
    offers,
  };
}

// ---- Fallback ----
function NotAvailable() {
  return (
    <main className="min-h-screen flex items-center justify-center text-center px-6 bg-[#f4f1ec] text-[#5a4a3f]">
      <div className="max-w-md">
        <h1 className="text-3xl font-serif mb-4">
          This experience is not available
        </h1>
        <p className="text-lg mb-6">
          It might be private or has been removed. Please explore our other
          unique offerings.
        </p>
        <Link
          href="/experiences"
          className="inline-block rounded-full bg-[#8b6f47] px-6 py-3 text-white font-medium hover:bg-[#a78b62] transition-all"
        >
          Browse experiences
        </Link>
      </div>
    </main>
  );
}
