export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import Image from "next/image";
import Script from "next/script";
import Link from "next/link";
import { cache } from "react";
// 1. New Font Imports for Premium Feel
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
  Share2,
  Heart,
  ShieldCheck,
  Sparkles,
  Sun,
  Camera,
  Utensils,
  Maximize2,
} from "lucide-react";
import LinkWithLoader from "@/app/components/LinkWithLoader";
import { getExperienceBySlug } from "@/lib/fetchExperiences";
import ShareButton from "@/app/components/ShareButton";
import FavoriteButton from "@/app/components/FavoriteButton";
import { createSupabaseServer } from "@/lib/supabase/server";
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
    mapPin,
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  // 1. Define the variable here so it can be used in both JSON-LD and JSX
  const pageUrl = `${siteUrl}/experiences/${slug}`;

  const jsonLd = buildJsonLd({
    name,
    description,
    prices,
    location,
    images: parsedImages,
    pageUrl: pageUrl, // 2. Pass the variable
  });
  const { isFavorite, isLoggedIn } = await getFavoriteStatus(experience.id);
  return (
    <main
      className={`${fontSerif.variable} ${fontSans.variable} font-sans bg-[#FDFCF8] text-[#1A1A1A] min-h-screen selection:bg-[#C8AA86] selection:text-white pb-32 lg:pb-0`}
    >
      <Script
        id="json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ---- HERO SECTION ---- */}
      <section className="relative w-full h-[85vh] min-h-[600px] flex flex-col justify-end overflow-hidden">
        {/* Background Layer */}
        <div className="absolute inset-0 z-0 select-none">
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
              {/* Cinematic Gradient: Darker at bottom for text contrast */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/30" />
              {/* Grain Texture for premium feel */}
              <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
            </div>
          ) : (
            <div className="w-full h-full bg-[#C8AA86]" />
          )}
        </div>

        {/* Top Nav Overlay */}
        <div className="absolute top-0 left-0 right-0 p-6 md:p-8 z-30 flex justify-between items-start">
          <LinkWithLoader href="/experiences">
            <button className="group flex items-center gap-2 pr-4 pl-2 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-all duration-300">
              <div className="bg-white/20 rounded-full p-1.5 group-hover:-translate-x-1 transition-transform">
                <ArrowLeft size={16} />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest">
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

        {/* Hero Content */}
        <div className="relative z-20 w-full max-w-7xl mx-auto px-6 md:px-12 pb-16 lg:pb-20">
          <div className="animate-fade-in-up space-y-6 max-w-5xl">
            {/* Badges */}
            <div className="flex gap-3 flex-wrap">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 bg-black/20 backdrop-blur-md text-[#F4EFE9]">
                <Sparkles size={12} className="text-[#C8AA86]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em]">
                  Premium Collection
                </span>
              </div>
              {location && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 bg-white/10 backdrop-blur-md text-white">
                  <MapPin size={12} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em]">
                    {location}
                  </span>
                </div>
              )}
            </div>

            {/* Title */}
            <h1 className="font-serif text-5xl sm:text-7xl lg:text-8xl text-white leading-[0.9] tracking-tight text-balance shadow-black drop-shadow-2xl">
              {name}
            </h1>

            {/* Quick Stats */}
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4 text-white/90 pt-4 border-t border-white/10 mt-6">
              {duration && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-full backdrop-blur-sm">
                    <Clock size={16} />
                  </div>
                  <span className="text-base font-light tracking-wide">
                    {duration}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-full backdrop-blur-sm">
                  <Users size={16} />
                </div>
                <span className="text-base font-light tracking-wide">
                  Small Groups Available
                </span>
              </div>
              <div className="flex items-center gap-3 ml-auto">
                <div className="flex -space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      className="fill-[#C8AA86] text-[#C8AA86]"
                    />
                  ))}
                </div>
                <span className="text-sm font-medium border-b border-white/30 pb-0.5">
                  4.9 (120 Reviews)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 animate-bounce hidden md:block">
          <ChevronDown size={28} strokeWidth={1.5} />
        </div>
      </section>

      {/* ---- STICKY NAV ---- */}
      <div className="sticky top-4 z-40 flex justify-center pointer-events-none mb-12 px-4">
        <nav className="pointer-events-auto bg-white/70 backdrop-blur-xl border border-white/60 shadow-xl shadow-black/5 rounded-full px-2 py-1.5 flex items-center gap-1 overflow-x-auto max-w-full no-scrollbar ring-1 ring-black/5">
          <NavLink href="#overview" label="Overview" active />
          <NavLink href="#details" label="Details" />
          <NavLink href="#gallery" label="Gallery" />
          <NavLink href="#location" label="Location" />
          <NavLink href="#reviews" label="Reviews" />
          <div className="w-px h-4 bg-gray-300 mx-2 hidden sm:block"></div>
          <span className="hidden sm:block text-xs font-bold text-[#1A1A1A] px-3">
            {fromPrice ? eur(fromPrice) : ""}
          </span>
        </nav>
      </div>

      {/* ---- MAIN LAYOUT ---- */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12">
        <div className="grid lg:grid-cols-[1fr_380px] gap-16 lg:gap-20 items-start">
          {/* LEFT COLUMN */}
          <div className="space-y-24">
            {/* Overview Section */}
            <section id="overview" className="scroll-mt-32">
              <SectionHeader title="The Experience" />
              <div className="prose prose-stone prose-lg max-w-none text-[#4A4A4A] leading-relaxed font-light prose-headings:font-serif prose-p:mb-6">
                <p className="whitespace-pre-line first-letter:text-6xl first-letter:font-serif first-letter:text-[#C8AA86] first-letter:float-left first-letter:mr-3 first-letter:mt-[-8px]">
                  {description}
                </p>
              </div>

              {whyYoullLove && (
                <div className="mt-12 bg-[#F6F4F0] rounded-3xl p-8 md:p-10 relative overflow-hidden group">
                  <Quote
                    size={80}
                    className="text-[#C8AA86]/10 absolute -top-4 -right-4 rotate-12 group-hover:rotate-0 transition-transform duration-700"
                  />
                  <div className="relative z-10">
                    <h3 className="font-serif text-2xl text-[#1A1A1A] mb-4 flex items-center gap-3">
                      <Heart
                        size={20}
                        className="text-[#C8AA86] fill-[#C8AA86]"
                      />
                      Why you'll love this
                    </h3>
                    <p className="text-[#555] text-lg leading-relaxed">
                      {whyYoullLove}
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* Gallery (Visual Journey) */}
            {parsedImages.length > 1 && (
              <section id="gallery" className="scroll-mt-32">
                <div className="flex items-end justify-between mb-8">
                  <SectionHeader title="Visual Journey" className="mb-0" />
                  <button className="hidden sm:flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1A1A1A] border border-gray-200 px-4 py-2 rounded-full hover:bg-[#1A1A1A] hover:text-white transition-colors">
                    <Camera size={14} /> View All {parsedImages.length} Photos
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 grid-rows-2 gap-4 h-[600px] md:h-[500px]">
                  {/* Main Large Image */}
                  <div className="md:col-span-2 md:row-span-2 relative group rounded-2xl overflow-hidden cursor-pointer">
                    <Image
                      src={parsedImages[1] || parsedImages[0]}
                      alt="Gallery Highlight"
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 66vw"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                      <Maximize2 size={18} />
                    </div>
                  </div>

                  {/* Secondary Images */}
                  {parsedImages.slice(2, 4).map((img, idx) => (
                    <div
                      key={idx}
                      className="relative group rounded-2xl overflow-hidden cursor-pointer hidden md:block"
                    >
                      <Image
                        src={img}
                        alt={`Gallery ${idx}`}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        sizes="33vw"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Details Bento Grid */}
            <section id="details" className="scroll-mt-32">
              <SectionHeader title="Essential Details" />
              <div className="grid md:grid-cols-2 gap-6">
                {/* Included Card */}
                {whatsIncluded && (
                  <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-10 h-10 bg-[#E8F5E9] rounded-full flex items-center justify-center text-[#2E7D32]">
                        <Check size={20} />
                      </div>
                      <h3 className="font-serif text-xl text-[#1A1A1A]">
                        What's Included
                      </h3>
                    </div>
                    <ul className="space-y-3">
                      {splitItems(whatsIncluded).map((item, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-3 text-sm text-[#555] group"
                        >
                          <Check
                            size={16}
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

                {/* Bring Card */}
                {whatToBring && (
                  <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-10 h-10 bg-[#FFF3E0] rounded-full flex items-center justify-center text-[#EF6C00]">
                        <Sun size={20} />
                      </div>
                      <h3 className="font-serif text-xl text-[#1A1A1A]">
                        What to Bring
                      </h3>
                    </div>
                    <div className="text-sm text-[#555] leading-relaxed whitespace-pre-line">
                      {whatToBring}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Location */}
            {mapPin && (
              <section id="location" className="scroll-mt-32">
                <SectionHeader title="Meeting Point" />
                <div className="relative rounded-3xl overflow-hidden border border-gray-200 h-[400px] bg-gray-100 group">
                  <iframe
                    title="Location Map"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(
                      mapPin
                    )}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                    width="100%"
                    height="100%"
                    className="grayscale-[0.5] group-hover:grayscale-0 transition-all duration-700"
                    style={{ border: 0 }}
                    loading="lazy"
                  />
                  {/* Floating Location Card */}
                  <div className="absolute top-4 left-4 right-4 sm:left-auto sm:w-72 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-white/50">
                    <div className="flex items-start gap-3">
                      <MapPin
                        size={20}
                        className="text-[#C8AA86] mt-1 shrink-0"
                      />
                      <div>
                        <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1">
                          Address
                        </p>
                        <p className="text-sm font-medium text-[#1A1A1A] leading-snug">
                          {mapPin}
                        </p>
                      </div>
                    </div>
                    <a
                      href={`https://maps.google.com/maps?q=${encodeURIComponent(
                        mapPin
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 w-full flex items-center justify-center gap-2 py-2 bg-[#1A1A1A] text-white text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-[#C8AA86] transition-colors"
                    >
                      Get Directions{" "}
                      <ArrowLeft size={12} className="rotate-[135deg]" />
                    </a>
                  </div>
                </div>
              </section>
            )}

            {/* Reviews */}
            {parsedReviews.length > 0 && (
              <section
                id="reviews"
                className="scroll-mt-32 pb-10 border-b border-gray-100"
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="font-serif text-3xl text-[#1A1A1A]">
                    Guest Reviews
                  </h2>
                  <div className="flex items-center gap-2">
                    <Star size={18} className="fill-[#C8AA86] text-[#C8AA86]" />
                    <span className="font-bold text-lg">4.9</span>
                    <span className="text-gray-400 text-sm">/ 5.0</span>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {parsedReviews.slice(0, 4).map((review, i) => (
                    <div
                      key={i}
                      className="bg-white p-6 rounded-2xl border border-gray-100 hover:border-[#C8AA86]/30 transition-colors"
                    >
                      <div className="flex gap-1 mb-3">
                        {[...Array(5)].map((_, j) => (
                          <Star
                            key={j}
                            size={12}
                            className="fill-[#C8AA86] text-[#C8AA86]"
                          />
                        ))}
                      </div>
                      <p className="text-[#4A4A4A] text-sm leading-relaxed italic mb-4">
                        "{review.comment}"
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#F0F0F0] flex items-center justify-center text-xs font-bold text-gray-500">
                          {initials(review.name || "G")}
                        </div>
                        <span className="text-xs font-bold uppercase text-[#1A1A1A]">
                          {review.name || "Guest"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* RIGHT COLUMN: Sticky Sidebar */}
          <aside className="hidden lg:block h-full">
            <div className="sticky top-28 w-full">
              <div className="bg-white rounded-[2rem] p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.08)] border border-gray-100 relative overflow-hidden ring-1 ring-black/5">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      Starting from
                    </span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-4xl font-serif text-[#1A1A1A]">
                        {fromPrice !== null ? eur(fromPrice) : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Date Picker Placeholder */}
                <div className="border rounded-xl p-4 mb-6 cursor-not-allowed bg-gray-50 flex justify-between items-center group hover:border-[#C8AA86] transition-colors">
                  <span className="text-sm text-gray-500">
                    Select Date & Travelers
                  </span>
                  <ChevronDown
                    size={16}
                    className="text-gray-400 group-hover:text-[#C8AA86]"
                  />
                </div>

                <div className="space-y-3 mb-8">
                  <PricingRow label="Adults" price={prices.adult} />
                  {prices.kid && (
                    <PricingRow label="Children (3-12)" price={prices.kid} />
                  )}
                </div>

                <LinkWithLoader href={`/check-availability/${slug}`}>
                  <button className="w-full bg-[#1A1A1A] hover:bg-[#C8AA86] text-white py-4 rounded-xl font-bold text-xs tracking-[0.15em] uppercase transition-all duration-300 shadow-xl shadow-black/5 hover:shadow-[#C8AA86]/20 transform active:scale-[0.98]">
                    Check Availability
                  </button>
                </LinkWithLoader>

                <div className="mt-6 pt-6 border-t border-gray-50 grid grid-cols-2 gap-y-3">
                  <Feature text="Free Cancellation" />
                  <Feature text="Instant Book" />
                  <Feature text="Mobile Ticket" />
                  <Feature text="English Guide" />
                </div>
              </div>

              <div className="mt-6 text-center">
                <p className="text-xs text-gray-400">
                  Product Code: {slug.slice(0, 8).toUpperCase()}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ---- MOBILE BOTTOM BAR ---- */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 p-4 pb-6 bg-white/80 backdrop-blur-lg border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <div className="flex items-center justify-between gap-4 max-w-md mx-auto">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-gray-500">
              Total Price
            </span>
            <span className="font-serif text-2xl text-[#1A1A1A] leading-none">
              {fromPrice !== null ? eur(fromPrice) : "—"}
            </span>
          </div>
          <LinkWithLoader href={`/check-availability/${slug}`}>
            <button className="bg-[#1A1A1A] text-white px-8 py-3.5 rounded-full font-bold text-xs uppercase tracking-wider hover:bg-[#C8AA86] transition-colors shadow-lg shadow-black/20">
              Check Availability
            </button>
          </LinkWithLoader>
        </div>
      </div>
    </main>
  );
}

// ---- Sub-Components for Cleanliness ----

function SectionHeader({ title, className = "mb-8" }) {
  return (
    <div className={className}>
      <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#C8AA86] mb-3">
        Discover
      </h2>
      <h3 className="font-serif text-3xl md:text-4xl text-[#1A1A1A]">
        {title}
      </h3>
    </div>
  );
}

function NavLink({ href, label, active }) {
  return (
    <a
      href={href}
      className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
        active
          ? "bg-[#1A1A1A] text-white shadow-md"
          : "text-[#555] hover:bg-white hover:text-[#1A1A1A]"
      }`}
    >
      {label}
    </a>
  );
}

function ActionButton({ icon }) {
  return (
    <button className="p-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white hover:bg-white hover:text-black hover:scale-105 transition-all duration-300">
      {icon}
    </button>
  );
}

function PricingRow({ label, price }) {
  if (typeof price !== "number") return null;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[#555]">{label}</span>
      <span className="font-medium text-[#1A1A1A]">{eur(price)}</span>
    </div>
  );
}

function Feature({ text }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-[#C8AA86]" />
      <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
        {text}
      </span>
    </div>
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
    <main className="min-h-screen flex items-center justify-center bg-[#FDFCF8]">
      <div className="text-center p-8 max-w-md">
        <div className="w-20 h-20 bg-[#F0F0F0] rounded-full flex items-center justify-center mx-auto mb-6 text-gray-400">
          <Info size={32} />
        </div>
        <h1 className="text-3xl font-serif text-[#1A1A1A] mb-4">
          Experience Not Found
        </h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          The experience you are looking for is currently unavailable or has
          been moved.
        </p>
        <Link
          href="/experiences"
          className="inline-flex items-center gap-2 bg-[#1A1A1A] text-white px-8 py-3 rounded-full hover:bg-[#C8AA86] transition font-bold text-xs uppercase tracking-wider"
        >
          <ArrowLeft size={14} /> Back to Experiences
        </Link>
      </div>
    </main>
  );
}
async function getFavoriteStatus(experienceId) {
  // 1. CALL THE CORRECT FUNCTION
  // 2. ADD 'await' (Crucial because your server config is async)
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
