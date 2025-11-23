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
    <main className="bg-gradient-to-b from-[#f4f1ec] via-[#faf9f7] to-[#f4f1ec] text-[#2f2f2f] min-h-screen pb-24 sm:pb-0">
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
        <div className="relative h-[260px] sm:h-[380px] lg:h-[460px] overflow-hidden">
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
              {/* Darken top a bit for legibility */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/35 to-black/10" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-[#d8cbb5] to-[#f4f1ec]" />
          )}

          {/* Light bottom fade so the title card is always visible */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-40 sm:h-56 bg-gradient-to-t from-[#f4f1ec] via-[#f4f1ec]/90 to-transparent"
          />

          {/* Back button + content */}
          <div className="absolute inset-0 flex flex-col justify-between pt-14 sm:pt-20 z-10">
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 flex justify-between items-start">
              <LinkWithLoader
                href="/experiences"
                aria-label="Back to Experiences"
              >
                <button className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 backdrop-blur px-3 py-1.5 text-xs sm:text-sm text-[#5a4a3f] hover:bg-white transition">
                  <ArrowLeft size={14} aria-hidden="true" />
                  Back to experiences
                </button>
              </LinkWithLoader>
            </div>

            {/* Title card */}
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 pb-4 sm:pb-10">
              <div className="max-w-3xl rounded-3xl bg-white shadow-[0_14px_40px_rgba(0,0,0,0.26)] border border-white/90 px-4 py-4 sm:px-7 sm:py-7">
                <p className="text-[10px] sm:text-[11px] tracking-[0.28em] uppercase text-[#c0aa8c] mb-1.5 sm:mb-2">
                  Signature experience
                </p>
                <h1 className="text-xl sm:text-4xl lg:text-5xl font-serif text-[#5a4a3f] leading-snug sm:leading-tight">
                  {name}
                </h1>

                {(duration || fromPrice !== null || location) && (
                  <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] sm:text-sm">
                    {duration && (
                      <span className="inline-flex items-center rounded-full bg-[#f4ede2] px-3 py-1 text-[#5a4a3f]">
                        {duration}
                      </span>
                    )}
                    {location && (
                      <span className="inline-flex items-center rounded-full bg-white/95 px-3 py-1 text-[#8b6f47] border border-[#e2d7c7]">
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

                <div className="mt-2 sm:mt-3 flex flex-wrap gap-2 text-[10px] sm:text-[11px] tracking-[0.22em] uppercase text-[#8b7a6b]">
                  <span>Small groups</span>
                  <span className="opacity-50">•</span>
                  <span>Slow-paced</span>
                  <span className="opacity-50">•</span>
                  <span>Nature-first</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION NAV */}
      <section className="border-b border-[#e3ddd2] bg-[#f8f5f1]/90 sm:bg-[#f8f5f1]/70 sm:backdrop-blur sm:sticky sm:top-0 z-30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <nav className="flex gap-3 sm:gap-6 overflow-x-auto py-2.5 sm:py-3 text-[11px] sm:text-sm text-[#7a6a5f]">
            <a
              href="#overview"
              className="whitespace-nowrap pb-1 border-b-2 border-transparent hover:border-[#8b6f47] hover:text-[#5a4a3f]"
            >
              Overview
            </a>
            {(whatsIncluded || whatToBring || whyYoullLove) && (
              <a
                href="#details"
                className="whitespace-nowrap pb-1 border-b-2 border-transparent hover:border-[#8b6f47] hover:text-[#5a4a3f]"
              >
                Details
              </a>
            )}
            {parsedImages.length > 1 && (
              <a
                href="#gallery"
                className="whitespace-nowrap pb-1 border-b-2 border-transparent hover:border-[#8b6f47] hover:text-[#5a4a3f]"
              >
                Gallery
              </a>
            )}
            {mapPin && (
              <a
                href="#location"
                className="whitespace-nowrap pb-1 border-b-2 border-transparent hover:border-[#8b6f47] hover:text-[#5a4a3f]"
              >
                Location
              </a>
            )}
            {parsedReviews.length > 0 && (
              <a
                href="#reviews"
                className="whitespace-nowrap pb-1 border-b-2 border-transparent hover:border-[#8b6f47] hover:text-[#5a4a3f]"
              >
                Reviews
              </a>
            )}
          </nav>
        </div>
      </section>

      {/* MAIN CONTENT LAYOUT */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-14 lg:py-16">
        <div className="grid gap-8 sm:gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.05fr)] lg:items-start">
          {/* RIGHT COLUMN – Booking / pricing card (first on mobile) */}
          <aside className="order-1 lg:order-2 lg:sticky lg:top-24 mb-4 sm:mb-0">
            <div className="rounded-3xl border border-[#e0dcd4] bg-white/95 shadow-[0_14px_36px_rgba(90,74,63,0.18)] p-5 sm:p-7 space-y-5">
              {/* Price header */}
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-lg sm:text-xl font-serif text-[#5a4a3f]">
                  Plan your visit
                </h2>
                {/* Show price here only on sm+ (mobile uses bottom bar) */}
                {fromPrice !== null && (
                  <div className="text-right hidden sm:block">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#7a6a5f]">
                      From
                    </p>
                    <p className="text-2xl font-semibold text-[#8b6f47] leading-none">
                      {eur(fromPrice)}
                    </p>
                    <p className="text-[11px] text-[#7a6a5f] mt-0.5">
                      per person
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 text-sm text-[#4a4a4a]">
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

              <div className="border-t border-[#e6dfd4] pt-4 space-y-3">
                <p className="text-xs tracking-[0.24em] uppercase text-[#8b7a6b]">
                  Pricing
                </p>
                <div className="grid grid-cols-2 gap-3 text-center text-sm">
                  <div className="rounded-2xl border border-[#e0dcd4] bg-[#fbf7f1] p-3">
                    <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-[#7a6a5f] mb-1">
                      Adult
                    </div>
                    <div className="text-base sm:text-lg font-semibold text-[#5a4a3f]">
                      {typeof prices.adult === "number"
                        ? eur(prices.adult)
                        : "—"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#e0dcd4] bg-[#fbf7f1] p-3">
                    <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-[#7a6a5f] mb-1">
                      Kid (3–12)
                    </div>
                    <div className="text-base sm:text-lg font-semibold text-[#5a4a3f]">
                      {typeof prices.kid === "number"
                        ? eur(prices.kid)
                        : typeof prices.adult === "number"
                        ? eur(prices.adult)
                        : "—"}
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-[#7a6a5f]">
                  Final total is calculated at checkout based on your group size
                  and date.
                </p>
              </div>

              <LinkWithLoader href={`/check-availability/${slug}`}>
                <button className="mt-1 w-full bg-[#8b6f47] text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-[#a78b62] transition-all shadow-[0_10px_26px_rgba(139,111,71,0.45)]">
                  Check availability
                </button>
              </LinkWithLoader>

              <ul className="text-[11px] text-[#7a6a5f] space-y-1.5">
                <li>• No payment is taken at this step.</li>
                <li>
                  • You&apos;ll receive a confirmation email once approved.
                </li>
              </ul>
            </div>
          </aside>

          {/* LEFT COLUMN – Story & details (second on mobile) */}
          <div className="space-y-8 sm:space-y-10 order-2 lg:order-1">
            {/* Description */}
            {description && (
              <section id="overview">
                <h2 className="text-xs sm:text-sm tracking-[0.3em] uppercase text-[#8b6f47] mb-2.5 sm:mb-3">
                  Overview
                </h2>
                <p className="text-[15px] sm:text-[17px] leading-relaxed text-[#4a4a4a] whitespace-pre-line">
                  {description}
                </p>
              </section>
            )}

            {/* What’s included / to bring / why you'll love */}
            {(whatsIncluded || whatToBring || whyYoullLove) && (
              <section id="details" className="space-y-6">
                {whatsIncluded && (
                  <div className="rounded-3xl border border-[#e0dcd4] bg-white/90 p-5 sm:p-7 shadow-[0_10px_28px_rgba(0,0,0,0.06)]">
                    <h3 className="text-lg sm:text-2xl font-serif text-[#5a4a3f] mb-3 sm:mb-4">
                      What’s included
                    </h3>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 sm:gap-y-3 gap-x-6">
                      {splitItems(whatsIncluded).map((item, i) => (
                        <li
                          key={i}
                          className="inline-flex items-start gap-2 text-[14px] sm:text-[15px] text-[#4a4a4a]"
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
                  <div className="rounded-3xl border border-[#e0dcd4] bg-[#fffdf9] p-5 sm:p-7 shadow-[0_10px_24px_rgba(0,0,0,0.04)]">
                    <h3 className="text-lg sm:text-2xl font-serif text-[#5a4a3f] mb-3 inline-flex items-center gap-2">
                      <AlertCircle size={20} aria-hidden />
                      What to bring
                    </h3>
                    <p className="text-[14px] sm:text-[15px] leading-relaxed text-[#4a4a4a] whitespace-pre-line">
                      {whatToBring}
                    </p>
                  </div>
                )}

                {whyYoullLove && (
                  <div className="rounded-3xl border border-[#e0dcd4] bg-white/90 p-5 sm:p-8 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
                    <h3 className="text-lg sm:text-2xl font-serif text-[#5a4a3f] mb-3 text-center">
                      Why you’ll love it
                    </h3>
                    <blockquote className="mx-auto max-w-3xl text-center text-base sm:text-xl leading-relaxed text-[#5a4a3f]">
                      “{whyYoullLove}”
                    </blockquote>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </section>

      {/* GALLERY */}
      {parsedImages.length > 1 && (
        <section
          id="gallery"
          className="mx-auto max-w-6xl px-4 sm:px-6 pb-12 sm:pb-16 scroll-mt-24"
        >
          <h3 className="text-2xl sm:text-3xl font-serif text-[#5a4a3f] mb-4 sm:mb-6 text-center">
            Gallery
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
            {parsedImages.slice(1).map((img, idx) => {
              const j = idx + 1; // slides start at 1 to skip hero image
              return (
                <a
                  key={img + j}
                  href={`#lb-${j}`}
                  className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-[#e0dcd4] bg-[#f4ede2] shadow-[0_8px_20px_rgba(0,0,0,0.08)]"
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
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              );
            })}
          </div>
          {/* Lightbox overlays (CSS-only) */}
          {() => {
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
          }}
          )()
          <style>{`
            .lightbox:target { display: block; }
          `}</style>
        </section>
      )}
      {/* MAP */}
      {mapPin && (
        <section
          id="location"
          className="mx-auto max-w-6xl px-4 sm:px-6 pb-14 lg:pb-20 scroll-mt-24"
        >
          <h3 className="text-2xl sm:text-3xl font-serif text-[#5a4a3f] mb-4 sm:mb-6 text-center">
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
        <section
          id="reviews"
          className="mx-auto max-w-6xl px-4 sm:px-6 pb-24 scroll-mt-24"
        >
          <h3 className="text-2xl sm:text-3xl font-serif text-[#5a4a3f] mb-4 sm:mb-6 text-center">
            Guest reviews
          </h3>
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
            {parsedReviews.map((review, i) => (
              <article
                key={(review?.name || "guest") + i}
                className="rounded-2xl border border-[#e0dcd4] bg-white/95 p-5 sm:p-6 shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8dfcf] font-semibold text-[#5a4a3f]">
                    {initials(review?.name || "Guest")}
                  </div>
                  <p className="font-semibold text-base sm:text-lg text-[#5a4a3f]">
                    {review?.name || "Guest"}
                  </p>
                </div>
                {review?.comment && (
                  <p className="mt-3 italic text-[14px] sm:text-[15px] text-[#4a4a4a]">
                    “{review.comment}”
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* MOBILE BOTTOM CTA */}
      {fromPrice !== null && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e0dcd4] bg-white/95 shadow-[0_-6px_18px_rgba(0,0,0,0.14)] px-4 py-2.5 flex items-center justify-between sm:hidden"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.4rem)",
          }}
        >
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#7a6a5f]">
              From
            </p>
            <p className="text-lg font-semibold text-[#8b6f47] leading-none">
              {eur(fromPrice)}
            </p>
            <p className="text-[10px] text-[#7a6a5f] mt-0.5">per person</p>
          </div>
          <LinkWithLoader href={`/check-availability/${slug}`}>
            <button className="bg-[#8b6f47] text-white rounded-full px-4 py-2 text-xs font-medium hover:bg-[#a78b62] transition-all">
              Check availability
            </button>
          </LinkWithLoader>
        </div>
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
