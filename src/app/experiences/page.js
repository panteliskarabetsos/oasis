// src/app/experiences/page.js
import Image from "next/image";
import LinkWithLoader from "@/app/components/LinkWithLoader";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import ExperiencesFilterBar from "./ExperiencesFilterBar";

export const dynamic = "force-dynamic";

export default async function Experiences({ searchParams }) {
  const supa = createSupabaseAdmin();

  // 🔧 IMPORTANT: unwrap the async searchParams first
  const sp = await searchParams;

  const rawFrom = sp?.from || null;
  const rawTo = sp?.to || null;
  const rawParty = sp?.party || null;

  const partySize =
    rawParty && !Number.isNaN(Number(rawParty)) && Number(rawParty) > 0
      ? Number(rawParty)
      : null;

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
    `,
    )
    .eq("visibility", true)
    .order("createdAt", { ascending: false });

  if (error) {
    console.error("Error fetching experiences:", error);
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6 bg-[#f4f1ec] text-[#5a4a3f]">
        <div className="max-w-md space-y-6">
          <div className="mx-auto w-12 h-12 rounded-full bg-[#e2d7c7]/50 flex items-center justify-center mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-3xl font-serif">Something went wrong</h1>
          <p className="text-[#6b625a] leading-relaxed">
            We couldn&apos;t load the experiences right now. Please try again a
            bit later.
          </p>
          <LinkWithLoader href="/">
            <button className="bg-[#8b6f47] text-white px-8 py-3.5 rounded-full font-medium tracking-wide hover:bg-[#a78b62] hover:shadow-lg transition-all duration-300">
              Return Home
            </button>
          </LinkWithLoader>
        </div>
      </div>
    );
  }

  let filteredExperiences = publicExperiences || [];
  const hasValidDateRange = rawFrom && rawTo;

  if (filteredExperiences.length > 0 && hasValidDateRange && partySize) {
    const experienceIds = filteredExperiences.map((e) => e.id);

    // Interpret incoming date inputs as whole days (local) and convert to ISO.
    const fromDate = new Date(`${rawFrom}T00:00:00.000Z`);
    const toDate = new Date(`${rawTo}T23:59:59.999Z`);

    const fromIso = fromDate.toISOString();
    const toIso = toDate.toISOString();

    const { data: slots, error: slotsError } = await supa
      .from("ScheduleSlot")
      .select(
        `
        id,
        experienceId,
        date,
        totalSlots,
        isCancelled,
        bookings:booking (
          id,
          status,
          "numberOfPeople"
        )
      `,
      )
      .in("experienceId", experienceIds)
      .gte("date", fromIso)
      .lte("date", toIso)
      .eq("isCancelled", false);

    if (slotsError) {
      console.error("Error fetching schedule slots:", slotsError);
    } else if (slots) {
      const availableExperienceIds = new Set();

      for (const slot of slots) {
        const bookings = Array.isArray(slot.bookings) ? slot.bookings : [];
        const activeBookings = bookings.filter((b) => b.status !== "cancelled");

        const usedSeats = activeBookings.reduce(
          (sum, b) => sum + (b.numberOfPeople ?? 0),
          0,
        );

        const remaining = (slot.totalSlots || 0) - usedSeats;

        if (remaining >= partySize) {
          availableExperienceIds.add(slot.experienceId);
        }
      }

      filteredExperiences = filteredExperiences.filter((exp) =>
        availableExperienceIds.has(exp.id),
      );
    }
  }

  const count = filteredExperiences?.length || 0;
  const filtersApplied = hasValidDateRange && !!partySize;

  return (
    <main className="min-h-screen bg-[#f4f1ec] text-[#2f2f2f] pt-16 md:pt-24 pb-24 px-6 selection:bg-[#8b6f47] selection:text-white">
      {/* Hero */}
      <section className="relative max-w-6xl mx-auto text-center mb-12 md:mb-16">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#e2d7c7]/30 via-transparent to-transparent rounded-[3rem]" />

        <p className="text-xs font-semibold tracking-[0.35em] uppercase text-[#8b6f47] mb-4">
          Experiences
        </p>
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif text-[#5a4a3f] mb-6 leading-[1.1]">
          Our Signature Journeys
        </h1>
        <p className="text-lg md:text-xl text-[#6b625a] max-w-2xl mx-auto leading-relaxed">
          Curated paths of agrotourism &amp; wellness deeply rooted in Cretan
          tradition, pristine nature, and local life.
        </p>
        {count > 0 && (
          <div className="mt-8 inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-white/50 border border-[#e2d7c7] backdrop-blur-sm">
            <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-[#7a6a5f]">
              {count} experience{count !== 1 ? "s" : ""} available
            </p>
          </div>
        )}
      </section>

      {/* Filter bar */}
      <section className="max-w-5xl mx-auto mb-14 relative z-20">
        <div className="rounded-[2rem] border border-[#e2d7c7]/80 bg-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl px-4 py-4 md:px-8 md:py-6 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
          <ExperiencesFilterBar
            initialFrom={rawFrom}
            initialTo={rawTo}
            initialParty={partySize}
          />
        </div>
      </section>

      {/* Experiences grid */}
      <section className="max-w-6xl mx-auto grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
        {count > 0 ? (
          filteredExperiences.map((exp) => {
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
            const freqLabel = getFrequencyLabel(freqArray);

            const shortDescription =
              (exp.description || "").length > 130
                ? `${exp.description.slice(0, 130)}…`
                : exp.description || "";

            return (
              <article
                key={exp.id}
                className="group relative flex flex-col rounded-[2rem] bg-white ring-1 ring-black/5 shadow-sm overflow-hidden transition-all duration-500 hover:-translate-y-1.5 hover:shadow-xl hover:ring-black/10"
              >
                {/* Image Area */}
                <div className="relative h-64 w-full overflow-hidden bg-[#f1ede7]">
                  {hasImg ? (
                    <Image
                      src={exp.images[0]}
                      alt={exp.name}
                      width={600}
                      height={400}
                      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#c9b9a5] font-serif italic text-lg">
                      Visualizing shortly...
                    </div>
                  )}

                  {/* Subtle Image Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#2f2f2f]/60 via-transparent to-[#2f2f2f]/10" />

                  {/* Top Badges */}
                  <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                    {exp.duration && (
                      <span className="rounded-full bg-white/70 backdrop-blur-md text-xs font-medium text-[#5a4a3f] px-3 py-1.5 shadow-sm border border-white/20">
                        {exp.duration}
                      </span>
                    )}
                    {fromPrice !== null && (
                      <span className="rounded-full bg-[#5a4a3f]/90 backdrop-blur-md text-xs font-medium text-white px-3 py-1.5 shadow-sm border border-white/10">
                        From {eur(fromPrice)}
                      </span>
                    )}
                  </div>

                  {/* Bottom Badges */}
                  {exp.location && (
                    <span className="absolute bottom-4 left-4 rounded-full bg-black/40 backdrop-blur-md text-[11px] tracking-wide text-white px-3 py-1.5 border border-white/10 flex items-center gap-1.5">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      {exp.location}
                    </span>
                  )}
                </div>

                {/* Body Area */}
                <div className="p-7 flex flex-col flex-1">
                  <div className="flex-1 flex flex-col gap-3">
                    <h3 className="text-2xl font-serif text-[#3a2f28] leading-snug group-hover:text-[#8b6f47] transition-colors">
                      {exp.name}
                    </h3>

                    {shortDescription && (
                      <p className="text-sm text-[#6b625a] leading-relaxed">
                        {shortDescription}
                      </p>
                    )}

                    <div className="mt-2 flex flex-col gap-1.5 border-l-2 border-[#e2d7c7] pl-3">
                      {freqLabel && (
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8b7a6b]">
                          {freqLabel}
                        </p>
                      )}
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8b7a6b]">
                        Small groups • Slow-paced
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-8 flex flex-col gap-4">
                    <LinkWithLoader
                      className="w-full"
                      href={`/check-availability/${exp.slug}`}
                    >
                      <button className="w-full bg-[#8b6f47] text-white px-6 py-3.5 rounded-full text-sm font-medium hover:bg-[#735b38] hover:shadow-md transition-all duration-300">
                        Check Availability
                      </button>
                    </LinkWithLoader>

                    <LinkWithLoader
                      className="w-full group/btn"
                      href={`/experiences/${exp.slug}`}
                    >
                      <button className="w-full flex items-center justify-center gap-2 text-sm font-medium text-[#5a4a3f] hover:text-[#8b6f47] transition-colors">
                        View more details
                        <span className="transition-transform duration-300 group-hover/btn:translate-x-1">
                          →
                        </span>
                      </button>
                    </LinkWithLoader>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="col-span-full py-10">
            <div className="max-w-xl mx-auto text-center rounded-[2.5rem] border border-[#e2d7c7] bg-white/60 backdrop-blur-sm px-8 py-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="mx-auto w-16 h-16 bg-[#f4ede4] text-[#8b6f47] rounded-full flex items-center justify-center mb-6">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#8b6f47] mb-3">
                {filtersApplied ? "No matching dates" : "Currently unavailable"}
              </p>
              <h2 className="text-3xl font-serif text-[#3a2f28] mb-4">
                {filtersApplied
                  ? "We’re fully booked for these dates"
                  : "Our public calendar is being updated"}
              </h2>
              <p className="text-base text-[#6b625a] mb-8 leading-relaxed max-w-md mx-auto">
                {filtersApplied ? (
                  <>
                    We don&apos;t have any public availability for your selected
                    dates and group size. Try adjusting your search, or{" "}
                    <span className="text-[#5a4a3f] font-medium border-b border-[#d1c3b1]">
                      reach out for a private journey.
                    </span>
                  </>
                ) : (
                  <>
                    We&apos;re currently updating our experiences. In the
                    meantime, you can{" "}
                    <span className="text-[#5a4a3f] font-medium border-b border-[#d1c3b1]">
                      contact us for a private booking
                    </span>{" "}
                    tailored exactly to your group.
                  </>
                )}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {filtersApplied && (
                  <LinkWithLoader href="/experiences">
                    <button className="px-6 py-3 rounded-full bg-white border border-[#e2d7c7] text-sm font-medium text-[#5a4a3f] hover:bg-[#fcfbf9] hover:border-[#c9b9a5] transition-all">
                      Clear filters
                    </button>
                  </LinkWithLoader>
                )}

                <LinkWithLoader href="/contact">
                  <button className="px-6 py-3 rounded-full bg-[#8b6f47] text-sm text-white font-medium hover:bg-[#735b38] hover:shadow-md transition-all">
                    Inquire about a private booking
                  </button>
                </LinkWithLoader>
              </div>
            </div>
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
    (v) => Number.isFinite(v) && v > 0,
  );

  if (vals.length === 0) return null;
  return Math.min(...vals);
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

const ALL_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const WEEKDAYS = ALL_DAYS.slice(0, 5); // Mon–Fri
const WEEKENDS = ALL_DAYS.slice(5); // Sat–Sun

function normalizeToken(label) {
  return String(label)
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function getFrequencyLabel(freqArray) {
  if (!Array.isArray(freqArray) || freqArray.length === 0) return null;

  const normalizedTokens = freqArray.map(normalizeToken);

  if (normalizedTokens.includes("everyday")) return "Every day";
  if (normalizedTokens.includes("weekdays")) return "Weekdays";
  if (
    normalizedTokens.includes("weekend") ||
    normalizedTokens.includes("weekends")
  ) {
    return "Weekends";
  }

  const normalizedDays = freqArray.map((d) => String(d).trim().toLowerCase());

  const hasAllDays = ALL_DAYS.every((day) => normalizedDays.includes(day));
  const hasWeekdaysOnly =
    WEEKDAYS.every((day) => normalizedDays.includes(day)) &&
    WEEKENDS.every((day) => !normalizedDays.includes(day));
  const hasWeekendsOnly =
    WEEKENDS.every((day) => normalizedDays.includes(day)) &&
    WEEKDAYS.every((day) => !normalizedDays.includes(day));

  if (hasAllDays) return "Every day";
  if (hasWeekdaysOnly) return "Weekdays";
  if (hasWeekendsOnly) return "Weekends";

  return freqArray.join(" • ");
}
