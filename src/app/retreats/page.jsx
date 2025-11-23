"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  CalendarDays,
  MapPin,
  SunMedium,
  Waves,
  Leaf,
  Users,
} from "lucide-react";

const retreats = [
  {
    id: "spring-softness",
    title: "Spring Softness Retreat",
    tagline: "A gentle reset as Crete blooms into colour.",
    dates: "18–22 April 2025",
    location: "Near Chania, Crete",
    spots: "Limited to 10 guests",
    focus: "Nervous system reset, soft movement, local food.",
    highlight: "Sunset circles by the sea and long, quiet mornings.",
    status: "Bookings open",
  },
  {
    id: "slow-summer",
    title: "Slow Summer by the Sea",
    tagline: "Unhurried days, shaded siestas, barefoot evenings.",
    dates: "5–9 June 2025",
    location: "West coast of Crete",
    spots: "Small group of 12",
    focus: "Restorative practices, sea swims, deep rest.",
    highlight: "Private cove swims and chef-prepared Cretan dinners.",
    status: "Early interest list",
  },
  {
    id: "autumn-gathering",
    title: "Autumn Grounding Gathering",
    tagline: "Landing softly after a full year.",
    dates: "October 2025",
    location: "Mountain village above Chania",
    spots: "Intimate circle of 8",
    focus: "Journaling, fire-side conversations, local walks.",
    highlight: "Village taverna evenings and mountain sunrises.",
    status: "Dates announced soon",
  },
];

export default function RetreatsPage() {
  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#f4f1ec] text-[#2f2f2f]">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-32 h-72 w-72 rounded-full bg-[#e3d3bc]/70 blur-3xl" />
        <div className="absolute bottom-[-6rem] right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-[#d2c3aa]/60 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.05] [background:radial-gradient(circle_at_center,rgba(90,74,63,0.35)_1px,transparent_1px)] [background-size:22px_22px]" />
      </div>

      <section className="relative z-10 py-18 md:py-24">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d3c2aa] bg-white/80 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[#8b6f47]">
              Retreats • Crete
            </div>

            <h1 className="mt-4 font-serif text-3xl leading-tight text-[#3e3128] md:text-4xl lg:text-5xl">
              Slow retreats on{" "}
              <span className="text-[#8b6f47]">the Cretan coastline</span>
            </h1>

            <p className="mt-4 text-[15px] leading-relaxed text-[#4a4a4a] md:text-[16px]">
              Oasis retreats are small, carefully held gatherings in and around
              Chania. Think sea-salt mornings, shaded afternoons, candle-lit
              dinners and plenty of quiet in-between. Each retreat is an
              invitation to soften, land and remember your own pace.
            </p>

            <div className="mt-6 flex flex-wrap gap-3 text-xs text-[#6a5a49]">
              <HeroPill icon={<Users className="h-3 w-3" />}>
                Small, intimate groups
              </HeroPill>
              <HeroPill icon={<SunMedium className="h-3 w-3" />}>
                Gentle schedule, no rush
              </HeroPill>
              <HeroPill icon={<Leaf className="h-3 w-3" />}>
                Seasonal, locally rooted
              </HeroPill>
            </div>
          </motion.div>

          {/* Upcoming retreats */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-12 space-y-6 md:mt-14"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="font-serif text-xl text-[#3e3128] md:text-2xl">
                  Upcoming retreats
                </h2>
                <p className="mt-1 text-sm text-[#6b625a]">
                  Dates, locations and a sense of each gathering. If something
                  speaks to you, you can reach out to hold a spot or join the
                  interest list.
                </p>
              </div>
              <Link
                href="/contact"
                className="mt-2 inline-flex items-center justify-center rounded-full border border-[#d3c2aa] bg-white/80 px-4 py-2 text-xs font-medium text-[#4d3d33] shadow-sm transition hover:border-[#c2ae95] hover:bg-[#fbf7ef]"
              >
                Not sure which retreat fits?{" "}
                <span className="ml-1 text-[#8b6f47]">Ask us.</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {retreats.map((retreat, index) => (
                <motion.article
                  key={retreat.id}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.55, delay: 0.05 * index }}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-[#e0d6c6] bg-white/80 p-4 shadow-sm backdrop-blur-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.16em]">
                    <span className="text-[#8b7a6b]">Retreat</span>
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        retreat.status === "Bookings open"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-[#fbf7ef] text-[#8b6f47] border border-[#e5d7c5]"
                      }`}
                    >
                      {retreat.status}
                    </span>
                  </div>

                  <h3 className="font-serif text-lg text-[#3e3128]">
                    {retreat.title}
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#6a5a49]">
                    {retreat.tagline}
                  </p>

                  <div className="mt-4 space-y-1.5 text-[13px] text-[#4d3d33]">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-[#8b6f47]" />
                      <span>{retreat.dates}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#8b6f47]" />
                      <span>{retreat.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-[#8b6f47]" />
                      <span>{retreat.spots}</span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5 rounded-2xl bg-[#f9f3ea] px-3 py-3 text-[12px] text-[#5a4a3f]">
                    <p>
                      <span className="font-semibold uppercase tracking-[0.16em] text-[11px] text-[#8b6f47]">
                        Focus
                      </span>
                      <br />
                      {retreat.focus}
                    </p>
                    <p>
                      <span className="font-semibold uppercase tracking-[0.16em] text-[11px] text-[#8b6f47]">
                        Highlight
                      </span>
                      <br />
                      {retreat.highlight}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-1 items-end justify-between text-[12px]">
                    <Link
                      href="/contact"
                      className="inline-flex items-center justify-center rounded-full bg-[#8b6f47] px-4 py-2 text-xs font-medium text-white shadow-sm shadow-[#8b6f47]/25 transition group-hover:-translate-y-0.5 group-hover:bg-[#a78b62]"
                    >
                      Express interest
                    </Link>
                    <span className="text-[11px] text-[#8b7a6b]">
                      We&apos;ll reply personally with details.
                    </span>
                  </div>
                </motion.article>
              ))}
            </div>
          </motion.div>

          {/* What to expect */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-14 grid gap-10 md:mt-16 md:grid-cols-[1.1fr,0.9fr]"
          >
            <div className="rounded-3xl border border-[#e0d6c6] bg-white/80 p-6 md:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b6f47]">
                A day at an Oasis retreat
              </p>
              <h2 className="mt-2 font-serif text-xl text-[#3e3128] md:text-2xl">
                Spacious days, softly structured.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#6b625a]">
                Every retreat has its own rhythm, but most days flow with a
                gentle, predictable structure. Enough holding to feel safe;
                enough space to truly rest.
              </p>

              <ul className="mt-4 space-y-3 text-sm text-[#4d3d33]">
                <li>
                  • Slow mornings, optional movement and unhurried breakfast.
                </li>
                <li>
                  • Late-morning circles, practices or local explorations.
                </li>
                <li>
                  • Long, shaded breaks for rest, journaling or sea swims.
                </li>
                <li>• Late-afternoon gatherings, gentle workshops or walks.</li>
                <li>
                  • Shared dinners with seasonal Cretan food and candlelight.
                </li>
              </ul>

              <p className="mt-4 text-xs text-[#8b7a6b]">
                Everything is optional. You can move closer to the group or
                further away, depending on what your body and heart are asking
                for that day.
              </p>
            </div>

            <div className="space-y-4 rounded-3xl border border-[#e0d6c6] bg-white/80 p-6 md:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b6f47]">
                Practical notes
              </p>
              <div className="space-y-3 text-sm text-[#4d3d33]">
                <InfoRow
                  icon={<Waves className="h-4 w-4" />}
                  title="Location & venues"
                  body="We work with a small handful of homes and guesthouses we know personally — always with plenty of light, quiet corners and outdoor space."
                />
                <InfoRow
                  icon={<Leaf className="h-4 w-4" />}
                  title="Food"
                  body="Seasonal, mostly Cretan and largely plant-forward. We can usually accommodate common dietary needs if you tell us in advance."
                />
                <InfoRow
                  icon={<CalendarDays className="h-4 w-4" />}
                  title="Booking & deposits"
                  body="To keep things small, we confirm spaces with a deposit. If you’re curious but not quite ready, you can join the interest list instead."
                />
              </div>

              <div className="mt-3 rounded-2xl bg-[#f9f3ea] px-4 py-3 text-xs text-[#6a5a49]">
                Not seeing dates that work for you? We occasionally host{" "}
                <span className="font-semibold">private or team retreats</span>{" "}
                on request.
                <Link
                  href="/contact"
                  className="ml-1 text-[#8b6f47] underline-offset-2 hover:underline"
                >
                  Reach out to explore options.
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}

/* --------------------------- UI subcomponents --------------------------- */

function HeroPill({ children, icon }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#e0d6c6] bg-white/80 px-3 py-1 text-[11px]">
      {icon && <span className="text-[#8b6f47]">{icon}</span>}
      {children}
    </span>
  );
}

function InfoRow({ icon, title, body }) {
  return (
    <div className="flex gap-3">
      <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#f4ebdf] text-[#8b6f47]">
        {icon}
      </div>
      <div>
        <p className="text-[13px] font-semibold text-[#3e3128]">{title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-[#6b625a]">
          {body}
        </p>
      </div>
    </div>
  );
}
