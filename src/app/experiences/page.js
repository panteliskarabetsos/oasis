// src/app/experiences/page.js
import Image from "next/image";
import LinkWithLoader from "@/app/components/LinkWithLoader";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function Experiences() {
  const supa = createSupabaseAdmin();

  const { data: publicExperiences, error } = await supa
    .from("Experience")
    .select(
      `
      id,
      name,
      slug,
      description,
      location,
      duration,
      images,
      frequency,
      visibility,
      "createdAt",
      "priceAdult",
      "priceKid"
    `
    )
    .eq("visibility", true)
    .order("createdAt", { ascending: false });

  if (error) {
    console.error("Error fetching experiences:", error);
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6 bg-[#f4f1ec] text-[#5a4a3f]">
        <div className="max-w-md">
          <h1 className="text-3xl font-serif mb-3">Something went wrong</h1>
          <p className="text-base mb-6 text-[#6b625a]">
            We couldn&apos;t load the experiences right now. Please try again a
            bit later.
          </p>
          <LinkWithLoader href="/">
            <button className="bg-[#8b6f47] text-white px-6 py-3 rounded-full font-medium hover:bg-[#a78b62] transition-all">
              Go home
            </button>
          </LinkWithLoader>
        </div>
      </div>
    );
  }

  const count = publicExperiences?.length || 0;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f4f1ec] via-[#faf9f7] to-[#f4f1ec] text-[#2f2f2f] pt-28 pb-24 px-6">
      {/* Hero */}
      <section className="max-w-6xl mx-auto text-center mb-16">
        <p className="text-xs tracking-[0.3em] uppercase text-[#8b6f47] mb-3">
          Experiences
        </p>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif text-[#5a4a3f] mb-4 leading-tight">
          Our Signature Experiences
        </h1>
        <p className="text-lg md:text-xl text-[#4a4a4a] max-w-3xl mx-auto">
          Curated journeys of agrotourism &amp; wellness rooted in Cretan
          tradition, nature, and local life.
        </p>
        {count > 0 && (
          <p className="mt-4 text-xs tracking-[0.25em] uppercase text-[#8b7a6b]">
            {count} experience{count !== 1 ? "s" : ""} currently available
          </p>
        )}
      </section>

      {/* Experiences grid */}
      <section className="max-w-6xl mx-auto grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 md:gap-12">
        {count > 0 ? (
          publicExperiences.map((exp) => {
            const hasImg =
              Array.isArray(exp.images) &&
              exp.images.length > 0 &&
              typeof exp.images[0] === "string" &&
              (exp.images[0].startsWith("http") ||
                exp.images[0].startsWith("/"));

            const fromPrice = getFromPrice(exp);
            const freqArray = Array.isArray(exp.frequency)
              ? exp.frequency.filter(Boolean)
              : [];
            const freqLabel =
              freqArray.length > 0 ? freqArray.join(" • ") : null;

            const shortDescription =
              (exp.description || "").length > 150
                ? `${exp.description.slice(0, 150)}…`
                : exp.description || "";

            return (
              <article
                key={exp.id}
                className="group relative flex flex-col rounded-[2rem] border border-[#e2d7c7] bg-white/95 shadow-[0_10px_30px_rgba(90,74,63,0.08)] overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(90,74,63,0.16)]"
              >
                {/* Image */}
                <div className="relative h-56 w-full overflow-hidden">
                  {hasImg ? (
                    <Image
                      src={exp.images[0]}
                      alt={exp.name}
                      width={600}
                      height={400}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#f1ede7] flex items-center justify-center text-[#8b6f47] font-medium italic">
                      No image available
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />

                  {exp.location && (
                    <span className="absolute bottom-4 left-4 rounded-full bg-black/60 text-xs text-white px-3 py-1">
                      {exp.location}
                    </span>
                  )}

                  {exp.duration && (
                    <span className="absolute top-4 left-4 rounded-full bg-white/90 text-xs text-[#5a4a3f] px-3 py-1 shadow">
                      {exp.duration}
                    </span>
                  )}

                  {fromPrice !== null && (
                    <span className="absolute top-4 right-4 rounded-full bg-[#f4ede2]/95 text-xs text-[#5a4a3f] px-3 py-1 shadow-sm">
                      From {eur(fromPrice)} / person
                    </span>
                  )}
                </div>

                {/* Body */}
                <div className="p-7 flex flex-col flex-1">
                  <div className="flex-1 flex flex-col gap-3">
                    <h3 className="text-xl font-serif text-[#5a4a3f]">
                      {exp.name}
                    </h3>

                    {shortDescription && (
                      <p className="text-sm text-[#4a4a4a] leading-relaxed">
                        {shortDescription}
                      </p>
                    )}

                    <div className="mt-1 flex flex-col gap-1 text-xs text-[#7a6a5f]">
                      {freqLabel && (
                        <p className="text-[11px] uppercase tracking-[0.18em]">
                          {freqLabel}
                        </p>
                      )}
                      {exp.location && (
                        <p className="text-[11px] uppercase tracking-[0.18em]">
                          Small groups • Slow-paced
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-6 flex flex-col gap-3">
                    <LinkWithLoader
                      className="w-full"
                      href={`/check-availability/${exp.slug}`}
                    >
                      <button className="w-full bg-[#8b6f47] text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-[#a78b62] transition-all">
                        Check availability
                      </button>
                    </LinkWithLoader>

                    <LinkWithLoader
                      className="w-full text-center"
                      href={`/experiences/${exp.slug}`}
                    >
                      <button className="w-full text-sm text-[#5a4a3f] underline underline-offset-4 decoration-[#d1c3b1] hover:text-[#8b6f47] transition-colors">
                        View more details →
                      </button>
                    </LinkWithLoader>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="col-span-full text-center text-[#5a4a3f]">
            <p className="text-base">
              No experiences are available at the moment.
            </p>
            <p className="text-sm mt-2 text-[#7a6a5f]">
              We&apos;re curating new journeys — check back soon or contact us
              for bespoke options.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

/* ---------- helpers ---------- */

function eur(n) {
  return `€${(Number(n) || 0).toFixed(2)}`;
}

function getFromPrice(exp) {
  const vals = [toNum(exp?.priceAdult), toNum(exp?.priceKid)].filter(
    (v) => Number.isFinite(v) && v > 0
  );

  if (vals.length === 0) return null;
  return Math.min(...vals);
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
