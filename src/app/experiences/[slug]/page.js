// src/app/experiences/[slug]/page.js
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import Image from "next/image";
import Script from "next/script";
import Link from "next/link";
import { cache } from "react";
import { Playfair_Display, DM_Sans } from "next/font/google";
import {
  ArrowLeft,
  Check,
  MapPin,
  Clock,
  Info,
  Star,
  Quote,
  Users,
  ChevronDown,
  Heart,
  Sparkles,
  Sun,
  Leaf,
  Utensils,
} from "lucide-react";
import LinkWithLoader from "@/app/components/LinkWithLoader";
import { getExperienceBySlug } from "@/lib/fetchExperiences";
import ShareButton from "@/app/components/ShareButton";
import FavoriteButton from "@/app/components/FavoriteButton";
import { createSupabaseServer } from "@/lib/supabase/server";
import ExperienceGallery from "@/app/components/ExperienceGallery";
import InteractiveMeetingPoints from "@/app/components/InteractiveMeetingPoints";

// ---- Fonts Configuration ----
const fontSerif = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const fontSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "700"],
  display: "swap",
});

// ---- Data fetch ----
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
    (v) => typeof v === "number" && Number.isFinite(v) && v > 0,
  );
  return nums.length ? Math.min(...nums) : null;
}
function maxDefined(...vals) {
  const nums = vals.filter(
    (v) => typeof v === "number" && Number.isFinite(v) && v > 0,
  );
  return nums.length ? Math.max(...nums) : null;
}

// ---- Metadata ----
export async function generateMetadata({ params }) {
  const { slug } = await params;
  if (!slug) return { robots: { index: false } };

  const experience = await getExperience(slug);
  if (!experience) return { title: "Not Found", robots: { index: false } };

  const { name, description, images } = experience;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://youroasis.gr";

  const ogImages = (Array.isArray(images) ? images : [])
    .slice(0, 4)
    .map((src) => ({ url: src }));

  return {
    title: name,
    description: description?.slice(0, 160),
    alternates: { canonical: `${siteUrl}/experiences/${slug}` },
    openGraph: {
      title: name,
      description: description?.slice(0, 160),
      images: ogImages,
    },
  };
}

// ---- Page Component ----
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
    meetupPoints,
    guestReviews,
  } = experience;

  const prices = normalizePricing(experience);
  const fromPrice = minDefined(prices.adult, prices.kid);

  // Clean data
  const parsedImages = (Array.isArray(images) ? images : []).filter(Boolean);
  const parsedReviews = Array.isArray(guestReviews)
    ? guestReviews
        .map((r) => (typeof r === "string" ? { name: "Guest", comment: r } : r))
        .filter(Boolean)
    : [];

  // Parse Meetup Points
  const parsedMeetupPoints = Array.isArray(meetupPoints) ? meetupPoints : [];

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const pageUrl = `${siteUrl}/experiences/${slug}`;

  const jsonLd = buildJsonLd({
    name,
    description,
    prices,
    location,
    images: parsedImages,
    pageUrl: pageUrl,
  });

  const { isFavorite, isLoggedIn } = await getFavoriteStatus(experience.id);

  return (
    <main
      className={`${fontSerif.variable} ${fontSans.variable} font-sans bg-[#FDFCF8] text-[#1A1A1A] min-h-screen selection:bg-[#C8AA86] selection:text-white pb-36 lg:pb-40 overflow-x-hidden`}
    >
      <Script
        id="json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ---- HERO SECTION ---- */}
      <section className="relative w-full h-[80svh] lg:h-[85vh] min-h-[500px] flex flex-col justify-end overflow-hidden">
        <div className="absolute inset-0 z-0 select-none bg-[#EAE6DF]">
          {parsedImages?.[0] ? (
            <div className="relative w-full h-full">
              <Image
                src={parsedImages[0]}
                alt={name}
                fill
                priority
                quality={90}
                className="object-cover animate-slow-zoom"
                sizes="100vw"
                style={{ objectPosition: "center" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A]/95 via-[#1A1A1A]/40 to-transparent" />
              <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
            </div>
          ) : (
            <div className="w-full h-full bg-[#C8AA86]" />
          )}
        </div>

        <div className="absolute top-0 left-0 right-0 p-5 md:p-8 z-30 flex justify-between items-start">
          <LinkWithLoader href="/experiences">
            <button className="group flex items-center gap-2 pr-5 pl-2.5 py-2.5 rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white hover:bg-black/40 transition-all duration-300 shadow-sm">
              <div className="bg-white/20 rounded-full p-1.5 group-hover:-translate-x-1 transition-transform">
                <ArrowLeft size={16} />
              </div>
              <span className="hidden sm:inline text-[11px] font-bold uppercase tracking-widest">
                Back
              </span>
            </button>
          </LinkWithLoader>

          <div className="flex gap-3">
            <ShareButton
              title={name}
              text={`Check out this experience: ${name}`}
              url={pageUrl}
            />
            <FavoriteButton
              experienceId={experience.id}
              initialIsFavorite={isFavorite}
              isLoggedIn={isLoggedIn}
            />
          </div>
        </div>

        <div className="relative z-20 w-full max-w-5xl mx-auto px-6 md:px-12 pb-14 lg:pb-24 text-center sm:text-left">
          <div className="animate-fade-in-up space-y-5 sm:space-y-6">
            <div className="flex gap-3 flex-wrap justify-center sm:justify-start">
              <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/15 bg-white/10 backdrop-blur-md text-white shadow-sm">
                <Sparkles size={12} className="text-[#C8AA86]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
                  Premium
                </span>
              </div>
              {location && (
                <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/15 bg-white/10 backdrop-blur-md text-white shadow-sm">
                  <MapPin size={12} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
                    {location}
                  </span>
                </div>
              )}
            </div>

            <h1 className="font-serif text-4xl sm:text-6xl lg:text-[5.5rem] text-white leading-[1.05] sm:leading-[0.95] tracking-tight text-balance drop-shadow-md">
              {name}
            </h1>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-8 gap-y-4 text-white/90 pt-6 border-t border-white/15 mt-6 sm:mt-8">
              {duration && (
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-white/10 rounded-full backdrop-blur-sm">
                    <Clock size={16} />
                  </div>
                  <span className="text-sm sm:text-base font-medium tracking-wide">
                    {duration}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-full backdrop-blur-sm">
                  <Users size={16} />
                </div>
                <span className="text-sm sm:text-base font-medium tracking-wide">
                  Small Groups
                </span>
              </div>
              <div className="flex items-center gap-2.5 mt-2 sm:mt-0">
                <div className="flex -space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      className="fill-[#C8AA86] text-[#C8AA86]"
                    />
                  ))}
                </div>
                <span className="text-sm font-medium border-b border-white/30 pb-0.5 hover:border-white transition-colors cursor-pointer">
                  4.9 (120)
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 animate-bounce hidden md:block">
          <ChevronDown size={28} strokeWidth={1.5} />
        </div>
      </section>

      {/* ---- STICKY NAV ---- */}
      <div className="sticky top-6 z-40 flex justify-center pointer-events-none mb-10 sm:mb-16 px-4">
        <nav className="pointer-events-auto bg-white/80 backdrop-blur-xl border border-[#EAE6DF] shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-full px-2 py-2 flex items-center gap-1 overflow-x-auto max-w-full no-scrollbar">
          <NavLink href="#overview" label="Overview" active />
          <NavLink href="#details" label="Details" />
          <NavLink href="#philosophy" label="Philosophy" />
          <NavLink href="#meeting-points" label="Location" />
          <NavLink href="#reviews" label="Reviews" />
        </nav>
      </div>

      {/* ---- MAIN LAYOUT (Single Column) ---- */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 md:px-12 space-y-20 sm:space-y-28">
        {/* Overview Section */}
        <section id="overview" className="scroll-mt-40">
          <SectionHeader title="The Experience" />
          <div className="prose prose-stone prose-lg max-w-none text-[#555] leading-loose font-normal prose-headings:font-serif prose-p:mb-8">
            <p className="whitespace-pre-line first-letter:text-6xl sm:first-letter:text-7xl first-letter:font-serif first-letter:text-[#C8AA86] first-letter:float-left first-letter:mr-4 first-letter:mt-[-8px] first-letter:leading-none">
              {description}
            </p>
          </div>

          {whyYoullLove && (
            <div className="mt-10 sm:mt-16 bg-[#F6F4F0]/80 rounded-[2rem] p-8 sm:p-12 relative overflow-hidden group border border-[#EAE6DF]">
              <Quote
                size={80}
                className="text-[#C8AA86]/10 absolute -top-4 -right-4 rotate-12 group-hover:-rotate-6 transition-transform duration-700"
              />
              <div className="relative z-10">
                <h3 className="font-serif text-2xl sm:text-3xl text-[#1A1A1A] mb-5 flex items-center gap-3">
                  <Heart size={24} className="text-[#C8AA86] fill-[#C8AA86]" />
                  Why you'll love this
                </h3>
                <p className="text-[#4A4A4A] text-lg leading-relaxed">
                  {whyYoullLove}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Gallery (Visual Journey) */}
        {parsedImages.length > 1 && (
          <section id="gallery" className="scroll-mt-40">
            {/* Break out of max-w-4xl for the gallery to be wider */}
            <div className="-mx-6 md:-mx-12 lg:-mx-24">
              <ExperienceGallery images={parsedImages} title={name} />
            </div>
          </section>
        )}

        {/* Details Bento Grid */}
        <section id="details" className="scroll-mt-40">
          <SectionHeader title="Essential Details" />
          <div className="grid md:grid-cols-2 gap-5 sm:gap-6">
            {whatsIncluded && (
              <div className="bg-white p-8 rounded-[2rem] border border-[#EAE6DF] shadow-[0_4px_20px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-[#F4F8F4] rounded-full flex items-center justify-center text-[#4A7854]">
                    <Check size={22} />
                  </div>
                  <h3 className="font-serif text-2xl text-[#1A1A1A]">
                    What's Included
                  </h3>
                </div>
                <ul className="space-y-4">
                  {splitItems(whatsIncluded).map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-base text-[#555] group"
                    >
                      <Check
                        size={18}
                        className="text-[#C8AA86] mt-0.5 shrink-0"
                      />
                      <span className="group-hover:text-[#1A1A1A] transition-colors">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {whatToBring && (
              <div className="bg-white p-8 rounded-[2rem] border border-[#EAE6DF] shadow-[0_4px_20px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-[#FFF8F0] rounded-full flex items-center justify-center text-[#D88A4A]">
                    <Sun size={22} />
                  </div>
                  <h3 className="font-serif text-2xl text-[#1A1A1A]">
                    What to Bring
                  </h3>
                </div>
                <div className="text-base text-[#555] leading-relaxed whitespace-pre-line">
                  {whatToBring}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Our Philosophy: Eco & Dietary */}
        <section id="philosophy" className="scroll-mt-40">
          <div className="bg-[#F6F8F6] p-8 sm:p-12 rounded-[2rem] border border-[#E6EBE6] shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
            <SectionHeader title="Our Philosophy" className="mb-10" />

            <div className="grid sm:grid-cols-2 gap-10 sm:gap-12">
              <div className="flex flex-col gap-4">
                <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-[#4A7854] shadow-sm border border-[#E6EBE6] transition-transform hover:scale-105 duration-300">
                  <Leaf size={24} strokeWidth={1.5} />
                </div>
                <h4 className="font-serif text-2xl text-[#1A1A1A]">
                  100% Eco-Friendly
                </h4>
                <p className="text-[#555] text-base leading-relaxed">
                  We are deeply committed to sustainable agrotourism. Our estate
                  operates in complete harmony with nature, utilizing organic
                  farming methods, responsible water usage, and zero-waste
                  practices to protect the pristine Cretan landscape.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-[#D88A4A] shadow-sm border border-[#EAE6DF] transition-transform hover:scale-105 duration-300">
                  <Utensils size={24} strokeWidth={1.5} />
                </div>
                <h4 className="font-serif text-2xl text-[#1A1A1A]">
                  Vegetarian & Vegan Friendly
                </h4>
                <p className="text-[#555] text-base leading-relaxed">
                  The true magic of the Cretan diet stems from the soil. Our
                  farm-to-table culinary experiences celebrate organic
                  vegetables, wild herbs, and our own olive oil. We happily and
                  creatively accommodate vegetarian, vegan, and gluten-free
                  diets.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Meeting Points */}
        {parsedMeetupPoints.length > 0 && (
          <section id="meeting-points" className="scroll-mt-40">
            <SectionHeader title="Meeting Points" className="mb-4" />
            <p className="text-[#555] mb-10 text-lg font-light max-w-2xl leading-relaxed">
              Select a location below to view it on the map. You will be able to
              choose your preferred starting point during the final checkout.
            </p>

            <InteractiveMeetingPoints points={parsedMeetupPoints} />
          </section>
        )}

        {/* Reviews */}
        {parsedReviews.length > 0 && (
          <section id="reviews" className="scroll-mt-40">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
              <SectionHeader title="Guest Reviews" className="mb-0" />
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-[#EAE6DF] shadow-sm">
                <Star size={18} className="fill-[#C8AA86] text-[#C8AA86]" />
                <span className="font-bold text-lg text-[#1A1A1A]">4.9</span>
                <span className="text-[#A1A1A1] text-sm">/ 5.0</span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5 sm:gap-6">
              {parsedReviews.slice(0, 4).map((review, i) => (
                <div
                  key={i}
                  className="bg-white p-8 rounded-[2rem] border border-[#EAE6DF] hover:border-[#C8AA86]/40 hover:shadow-md transition-all duration-300"
                >
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <Star
                        key={j}
                        size={14}
                        className="fill-[#C8AA86] text-[#C8AA86]"
                      />
                    ))}
                  </div>
                  <p className="text-[#4A4A4A] text-base leading-relaxed italic mb-6">
                    "{review.comment}"
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#F6F4F0] border border-[#EAE6DF] flex items-center justify-center text-sm font-bold text-[#8b7a6b]">
                      {initials(review.name || "G")}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">
                      {review.name || "Guest"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---- BOTTOM CTA BOOKING SECTION ---- */}
        <section className="pt-8 text-center pb-8">
          <h2 className="font-serif text-4xl sm:text-5xl text-[#1A1A1A] mb-4">
            Join the Journey
          </h2>
          <p className="text-lg text-[#555] mb-10 max-w-lg mx-auto">
            Check our live calendar for availability and secure your spot for an
            unforgettable Cretan experience.
          </p>

          <div className="bg-white p-8 sm:p-10 rounded-[2.5rem] shadow-[0_10px_30px_rgb(0,0,0,0.04)] border border-[#EAE6DF] flex flex-col sm:flex-row items-center justify-between gap-8">
            <div className="text-left space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8b7a6b]">
                Starting from
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-4xl font-serif text-[#1A1A1A]">
                  {fromPrice !== null ? eur(fromPrice) : "N/A"}
                </span>
                <span className="text-sm text-[#A1A1A1]">/ person</span>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-[11px] font-medium text-[#7a6a5f] flex items-center gap-1.5">
                  <Clock size={12} /> {duration}
                </span>
                <span className="text-[11px] font-medium text-[#7a6a5f] flex items-center gap-1.5">
                  <Check size={12} /> Free Cancellation
                </span>
              </div>
            </div>

            <LinkWithLoader
              href={`/check-availability/${slug}`}
              className="w-full sm:w-auto shrink-0"
            >
              <button className="w-full sm:w-auto bg-[#1A1A1A] hover:bg-[#C8AA86] text-white px-10 py-5 rounded-2xl font-bold text-xs tracking-[0.2em] uppercase transition-all duration-300 shadow-[0_8px_20px_rgb(26,26,26,0.2)] hover:shadow-[0_8px_25px_rgb(200,170,134,0.4)] transform hover:-translate-y-0.5 active:scale-[0.98]">
                Check Availability
              </button>
            </LinkWithLoader>
          </div>
        </section>
      </div>

      {/* ---- STICKY BOTTOM BOOKING BAR (Visible on all screens) ---- */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-2xl border-t border-[#EAE6DF] shadow-[0_-10px_40px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom)] transition-all duration-300">
        <div className="py-4 px-6 md:px-12 flex items-center justify-between gap-4 max-w-4xl mx-auto">
          <div className="flex flex-col">
            <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] text-[#8b7a6b]">
              Starting from
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-serif text-2xl md:text-3xl text-[#1A1A1A] leading-none">
                {fromPrice !== null ? eur(fromPrice) : "—"}
              </span>
              <span className="text-sm text-[#A1A1A1] hidden sm:inline-block">
                / person
              </span>
            </div>
          </div>
          <LinkWithLoader href={`/check-availability/${slug}`}>
            <button className="bg-[#1A1A1A] text-white px-8 md:px-10 py-3.5 md:py-4 rounded-full font-bold text-xs uppercase tracking-[0.15em] hover:bg-[#C8AA86] transition-colors shadow-lg shadow-black/20 w-full sm:w-auto active:scale-95 transform duration-150">
              Check Availability
            </button>
          </LinkWithLoader>
        </div>
      </div>
    </main>
  );
}

// ---- Sub-Components ----

function SectionHeader({ title, className = "mb-8 sm:mb-10" }) {
  return (
    <div className={className}>
      <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#C8AA86] mb-3">
        Discover
      </h2>
      <h3 className="font-serif text-3xl md:text-5xl text-[#1A1A1A] tracking-tight">
        {title}
      </h3>
    </div>
  );
}

function NavLink({ href, label, active }) {
  return (
    <a
      href={href}
      className={`px-5 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-[0.15em] transition-all whitespace-nowrap snap-center ${
        active
          ? "bg-[#1A1A1A] text-white shadow-md shadow-black/10"
          : "text-[#555] hover:bg-[#F6F4F0] hover:text-[#1A1A1A]"
      }`}
    >
      {label}
    </a>
  );
}

// ---- Helper Functions ----
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
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

function buildJsonLd({ name, description, prices, location, images, pageUrl }) {
  const low = minDefined(prices?.kid, prices?.adult);
  const high = maxDefined(prices?.kid, prices?.adult);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    image: images,
    url: pageUrl,
    areaServed: location,
    offers:
      low !== null
        ? {
            "@type": "AggregateOffer",
            priceCurrency: "EUR",
            lowPrice: Number(low),
            ...(high !== null ? { highPrice: Number(high) } : {}),
            offerCount: 1,
            url: pageUrl,
          }
        : undefined,
  };
}

function NotAvailable() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#FDFCF8] selection:bg-[#C8AA86] selection:text-white">
      <div className="text-center p-8 max-w-md">
        <div className="w-24 h-24 bg-[#F6F4F0] border border-[#EAE6DF] rounded-full flex items-center justify-center mx-auto mb-8 text-[#C8AA86]">
          <Info size={36} strokeWidth={1.5} />
        </div>
        <h1 className="text-4xl font-serif text-[#1A1A1A] mb-4">
          Experience Unavailable
        </h1>
        <p className="text-[#555] mb-10 leading-relaxed text-lg">
          The journey you are looking for is currently not available or has been
          moved.
        </p>
        <Link
          href="/experiences"
          className="inline-flex items-center gap-3 bg-[#1A1A1A] text-white px-8 py-4 rounded-full hover:bg-[#C8AA86] transition-all duration-300 font-bold text-xs uppercase tracking-[0.2em] shadow-lg shadow-black/10 hover:-translate-y-0.5"
        >
          <ArrowLeft size={16} /> Back to Experiences
        </Link>
      </div>
    </main>
  );
}

async function getFavoriteStatus(experienceId) {
  const supabase = await createSupabaseServer();
  if (!supabase) return { isFavorite: false, isLoggedIn: false };

  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  if (!user) return { isFavorite: false, isLoggedIn: false };

  const { data: publicUser } = await supabase
    .from("User")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!publicUser) return { isFavorite: false, isLoggedIn: true };

  const { count } = await supabase
    .from("UserFavorite")
    .select("*", { count: "exact", head: true })
    .eq("user_id", publicUser.id)
    .eq("experience_id", experienceId);

  return { isFavorite: count > 0, isLoggedIn: true };
}
