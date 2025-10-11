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
  const teen = toNum(pj.teen ?? exp?.priceTeen, adult);
  const kid = toNum(pj.kid ?? exp?.priceKid, adult);
  return { adult, teen, kid };
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
  const fromPrice = minDefined(prices.adult, prices.teen, prices.kid);

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
    <main className="bg-[#f4f1ec] text-[#2f2f2f]">
      {/* JSON-LD for rich results */}
      <Script
        id="experience-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Decorative ambient background */}
      <div aria-hidden className="fixed inset-0 -z-10">
        <div
          className="pointer-events-none absolute -top-32 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full blur-3xl opacity-40"
          style={{
            background:
              "radial-gradient(closest-side, #e8dfcf, transparent 70%)",
          }}
        />
      </div>

      {/* Back button overlay + Hero section */}
      <div className="absolute inset-x-0 top-16 sm:top-24 z-10">
        <div className="mx-auto w-full max-w-6xl px-6">
          <LinkWithLoader href="/experiences" aria-label="Back to Experiences">
            <button className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/60 backdrop-blur px-4 py-2 text-sm text-[#5a4a3f] hover:bg-white/80 transition">
              <ArrowLeft size={18} aria-hidden="true" />
              Back to Experiences
            </button>
          </LinkWithLoader>
        </div>
      </div>

      <div className="relative -mx-6 -mt-16 sm:-mt-24 h-[320px] sm:h-[420px] overflow-hidden">
        {parsedImages?.[0] ? (
          <>
            <Image
              src={parsedImages[0]}
              alt={`${name} banner`}
              fill
              priority
              className="object-cover blur-md scale-110"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-[#f4f1ec]" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#d8cbb5] to-[#f4f1ec]" />
        )}

        {/* Header content overlay */}
        <div className="absolute inset-0 flex items-end justify-center">
          <div className="mx-auto w-full max-w-6xl px-6 pb-6">
            <div className="backdrop-blur-sm bg-white/50 border border-white/50 rounded-2xl shadow-lg p-5 sm:p-7">
              <h1 className="text-3xl sm:text-5xl font-serif text-[#5a4a3f]">
                {name}
              </h1>
              {(duration || fromPrice !== null || location) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[#4a4a4a]">
                  {duration && <span className="italic">{duration}</span>}
                  {fromPrice !== null && (
                    <span className="font-medium text-[#5a4a3f]">
                      From {eur(fromPrice)} / person
                    </span>
                  )}
                  {location && (
                    <span className="text-[#8b6f47]">Location: {location}</span>
                  )}
                </div>
              )}
              <div className="mt-4">
                <LinkWithLoader href={`/check-availability/${slug}`}>
                  <button className="bg-[#8b6f47] text-white px-6 py-3 rounded-full font-medium hover:bg-[#a78b62] transition-all">
                    Check Availability
                  </button>
                </LinkWithLoader>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Description */}
        {description && (
          <section className="py-12 sm:py-16">
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-lg sm:text-xl leading-relaxed text-[#4a4a4a] whitespace-pre-line">
                {description}
              </p>
            </div>
          </section>
        )}

        {/* Highlights & What’s Included */}
        {(whatsIncluded || whatToBring || whyYoullLove) && (
          <section className="pb-12 sm:pb-16">
            <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-3">
              {whatsIncluded && (
                <div className="col-span-1 md:col-span-2 rounded-3xl border-2 border-[#e0dcd4] bg-white/80 p-6 sm:p-8 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
                  <h3 className="text-2xl sm:text-3xl font-serif text-[#5a4a3f] mb-6">
                    What’s Included
                  </h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
                    {splitItems(whatsIncluded).map((item, i) => (
                      <li
                        key={i}
                        className="inline-flex items-start gap-2 text-[17px] text-[#4a4a4a]"
                      >
                        <CheckCircle2
                          className="mt-0.5 shrink-0"
                          size={20}
                          aria-hidden
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {whatToBring && (
                <div className="rounded-3xl border-2 border-[#e0dcd4] bg-white/80 p-6 sm:p-8 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
                  <h3 className="text-2xl sm:text-3xl font-serif text-[#5a4a3f] mb-4 inline-flex items-center gap-2">
                    <AlertCircle size={22} aria-hidden /> What to Bring
                  </h3>
                  <p className="text-[#4a4a4a] whitespace-pre-line">
                    {whatToBring}
                  </p>
                </div>
              )}
            </div>

            {whyYoullLove && (
              <div className="mt-8 rounded-3xl border-2 border-[#e0dcd4] bg-[#fffdf9] p-6 sm:p-10 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
                <h3 className="text-2xl sm:text-3xl font-serif text-[#5a4a3f] mb-4 text-center">
                  Why You’ll Love It
                </h3>
                <blockquote className="mx-auto max-w-3xl text-center text-xl sm:text-2xl leading-relaxed text-[#5a4a3f]">
                  “{whyYoullLove}”
                </blockquote>
              </div>
            )}
          </section>
        )}

        {/* Optional: Pricing table */}
        <section className="pb-12">
          <div className="mx-auto max-w-3xl rounded-3xl border-2 border-[#e0dcd4] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
            <h3 className="text-2xl sm:text-3xl font-serif text-[#5a4a3f] mb-4 text-center">
              Pricing
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 text-center gap-4">
              <div className="rounded-xl border border-[#e0dcd4] p-4">
                <div className="text-sm text-[#7a6a58] mb-1">Adult</div>
                <div className="text-xl font-semibold text-[#5a4a3f]">
                  {prices.adult ? eur(prices.adult) : "—"}
                </div>
              </div>
              <div className="rounded-xl border border-[#e0dcd4] p-4">
                <div className="text-sm text-[#7a6a58] mb-1">Teen (13–17)</div>
                <div className="text-xl font-semibold text-[#5a4a3f]">
                  {prices.teen ? eur(prices.teen) : eur(prices.adult)}
                </div>
              </div>
              <div className="rounded-xl border border-[#e0dcd4] p-4">
                <div className="text-sm text-[#7a6a58] mb-1">Kid (3–12)</div>
                <div className="text-xl font-semibold text-[#5a4a3f]">
                  {prices.kid ? eur(prices.kid) : eur(prices.adult)}
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-[#7a6a58]">
              Final total is calculated at checkout based on your group.
            </p>
          </div>
        </section>

        {/* Image Gallery */}
        {parsedImages.length > 1 && (
          <section className="pb-16">
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
                    className="group relative aspect-[4/3] overflow-hidden rounded-2xl border-2 border-[#e0dcd4] shadow-lg"
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

            {(() => {
              const n = parsedImages.length - 1; // number of slides excluding hero
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
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow hover:bg-white"
                      aria-label="Previous slide"
                    >
                      <ChevronLeft size={24} />
                    </a>
                    <a
                      href={`#lb-${next}`}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow hover:bg-white"
                      aria-label="Next slide"
                    >
                      <ChevronRight size={24} />
                    </a>
                    <a
                      href="#_"
                      className="absolute right-4 top-4 rounded-full bg-white/80 p-2 shadow hover:bg-white"
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
              .no-scrollbar::-webkit-scrollbar { display: none; }
              .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
          </section>
        )}

        {/* Map Section */}
        {mapPin && (
          <section className="pb-20">
            <h3 className="text-2xl sm:text-3xl font-serif text-[#5a4a3f] mb-6 text-center">
              Where You'll Be
            </h3>
            <div className="overflow-hidden rounded-2xl border-2 border-[#e0dcd4] shadow-lg">
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

        {/* Guest Reviews */}
        {parsedReviews.length > 0 && (
          <section className="pb-24">
            <h3 className="text-2xl sm:text-3xl font-serif text-[#5a4a3f] mb-6 text-center">
              Guest Reviews
            </h3>
            <div className="grid gap-6 sm:grid-cols-2">
              {parsedReviews.map((review, i) => (
                <article
                  key={(review?.name || "guest") + i}
                  className="rounded-2xl border-2 border-[#e0dcd4] bg-white p-6 shadow-xl"
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
      </div>
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
  const low = minDefined(prices?.kid, prices?.teen, prices?.adult);
  const high = maxDefined(prices?.kid, prices?.teen, prices?.adult);

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
          Browse Experiences
        </Link>
      </div>
    </main>
  );
}
