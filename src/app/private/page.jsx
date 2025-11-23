"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Users,
  HeartHandshake,
  GlassWater,
  Sparkles,
  MapPin,
  CalendarDays,
  MessageCircle,
  MoonStar,
  SunMedium,
  Anchor,
} from "lucide-react";

export default function PrivateGatheringsPage() {
  return (
    <main className="relative overflow-hidden bg-[#f4f1ec] text-[#2f2f2f]">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-32 h-72 w-72 rounded-full bg-[#e3d3bc]/70 blur-3xl" />
        <div className="absolute bottom-[-6rem] right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-[#d2c3aa]/60 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.05] [background:radial-gradient(circle_at_center,rgba(90,74,63,0.35)_1px,transparent_1px)] [background-size:22px_22px]" />
      </div>

      <section className="relative z-10 py-20 md:py-24">
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
              Private gatherings
            </div>

            <h1 className="mt-4 font-serif text-3xl leading-tight text-[#3e3128] md:text-4xl lg:text-5xl">
              Intimate moments,{" "}
              <span className="text-[#8b6f47]">quietly celebrated</span>
            </h1>

            <p className="mt-4 text-[15px] leading-relaxed text-[#4a4a4a] md:text-[16px]">
              From anniversaries and birthdays to team offsites and creative
              residencies, we shape private gatherings in and around Chania that
              feel spacious, considered and genuinely personal — never generic,
              never rushed.
            </p>

            <div className="mt-6 flex flex-wrap gap-3 text-xs text-[#6a5a49]">
              <HeroPill icon={<HeartHandshake className="h-3 w-3" />}>
                Tailor-made around you
              </HeroPill>
              <HeroPill icon={<Users className="h-3 w-3" />}>
                2–18 guests
              </HeroPill>
              <HeroPill icon={<MapPin className="h-3 w-3" />}>
                Chania & nearby villages
              </HeroPill>
            </div>
          </motion.div>

          {/* Types of gatherings */}
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
                  What kind of gathering are you imagining?
                </h2>
                <p className="mt-1 text-sm text-[#6b625a]">
                  A few examples of the kinds of moments we love designing. Your
                  idea may already be here — or we can create something entirely
                  new together.
                </p>
              </div>
              <Link
                href="/contact"
                className="mt-2 inline-flex items-center justify-center rounded-full border border-[#d3c2aa] bg-white/80 px-4 py-2 text-xs font-medium text-[#4d3d33] shadow-sm transition hover:border-[#c2ae95] hover:bg-[#fbf7ef]"
              >
                Share your idea with us
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <Card
                icon={<HeartHandshake className="h-5 w-5" />}
                label="Celebrations"
                title="Softly held milestones"
                bullets={[
                  "Anniversaries and birthdays by the sea.",
                  "Vow renewals and elopement-style ceremonies.",
                  "Long-table dinners with seasonal Cretan food.",
                ]}
                footnote="For couples or small groups who want something meaningful, not flashy."
              />
              <Card
                icon={<Users className="h-5 w-5" />}
                label="Friends & family"
                title="Time together that actually feels spacious"
                bullets={[
                  "Slow days built around rest, not a packed agenda.",
                  "Gentle guided experiences woven into free time.",
                  "Support with logistics, bookings and local tips.",
                ]}
                footnote="Perfect for 4–12 guests staying in or near Chania."
              />
              <Card
                icon={<GlassWater className="h-5 w-5" />}
                label="Teams & circles"
                title="Retreats for teams & communities"
                bullets={[
                  "Offsites for small teams who want depth, not slides.",
                  "Creative residencies and circle gatherings.",
                  "Facilitation support or collaboration on request.",
                ]}
                footnote="We can co-design the arc with your leader or facilitator."
              />
            </div>
          </motion.div>

          {/* Example scenarios */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="mt-14 space-y-6 md:mt-16"
          >
            <div className="max-w-3xl">
              <h2 className="font-serif text-xl text-[#3e3128] md:text-2xl">
                A few ways this could look
              </h2>
              <p className="mt-1 text-sm text-[#6b625a]">
                Every gathering is different, but these examples give a sense of
                the pace, ingredients and feeling we tend to work with.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <ScenarioCard
                label="Seaside anniversary"
                title="Golden-hour dinner for two (or a few)"
                length="1 evening"
                guests="2–6 guests"
                vibe="Quiet, romantic, unhurried"
                details={[
                  "Private seaside terrace with soft styling.",
                  "Local chef cooking a seasonal Cretan menu.",
                  "Simple ritual or vow renewal woven into the evening.",
                ]}
              />
              <ScenarioCard
                label="Friends in Crete"
                title="A slow, shared day together"
                length="1 full day"
                guests="4–10 guests"
                vibe="Playful, light, connected"
                details={[
                  "Morning sea swim and long breakfast.",
                  "Late-morning experience (e.g. boat, gentle hike or tasting).",
                  "Afternoon rest time, then sunset drinks & dinner.",
                ]}
              />
              <ScenarioCard
                label="Small team offsite"
                title="Soft structure, deep conversations"
                length="2–3 days"
                guests="6–12 guests"
                vibe="Thoughtful, grounded, honest"
                details={[
                  "Lightly facilitated check-in circles.",
                  "Plenty of unscheduled time for rest and informal talks.",
                  "One simple shared experience (like a boat day or village walk).",
                ]}
              />
            </div>
          </motion.div>

          {/* What we can shape */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="mt-14 grid gap-10 md:mt-16 md:grid-cols-[1.1fr,0.9fr]"
          >
            <div className="rounded-3xl border border-[#e0d6c6] bg-white/80 p-6 md:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b6f47]">
                What we can shape for you
              </p>
              <h2 className="mt-2 font-serif text-xl text-[#3e3128] md:text-2xl">
                You bring the people. We help with the rest.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#6b625a]">
                Some guests come with a clear picture; others just know they
                want “something special, but not over the top”. Either way, we
                can meet you where you are.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-[#4d3d33] md:grid-cols-2">
                <ShapeItem
                  title="Venues"
                  items={[
                    "Villas and guesthouses you’ve booked",
                    "Seaside terraces, rooftops and village courtyards",
                  ]}
                />
                <ShapeItem
                  title="Food & drink"
                  items={[
                    "Seasonal Cretan menus (family-style or plated)",
                    "Wine, herbal infusions and simple cocktails",
                  ]}
                />
                <ShapeItem
                  title="Experiences"
                  items={[
                    "Boat days, gentle hikes, village visits",
                    "Tastings, workshops and creative moments",
                  ]}
                />
                <ShapeItem
                  title="Atmosphere"
                  items={[
                    "Styling, candles, flowers and details",
                    "Simple rituals woven into the flow",
                  ]}
                />
                <ShapeItem
                  title="Support"
                  items={[
                    "Logistics and timing so the day feels smooth",
                    "On-the-day coordination so you can be present",
                  ]}
                />
                <ShapeItem
                  title="Collaborators"
                  items={[
                    "Local chefs, photographers, musicians",
                    "Facilitators or space-holders (on request)",
                  ]}
                />
              </div>

              <p className="mt-4 text-xs text-[#8b7a6b]">
                We keep numbers intentionally small so we can stay close to the
                details and the feeling of the day.
              </p>
            </div>

            {/* How it works / practical */}
            <div className="space-y-4 rounded-3xl border border-[#e0d6c6] bg-white/80 p-6 md:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b6f47]">
                How it works
              </p>

              <ol className="space-y-4 text-sm text-[#4d3d33]">
                <Step
                  number="01"
                  title="You send a first note"
                  body="Dates (or season), approximate guest count and the kind of atmosphere you’re imagining are more than enough to begin."
                />
                <Step
                  number="02"
                  title="We respond with possibilities"
                  body="We’ll share a few ways the day could look, plus a rough budget range so you can feel into what fits."
                />
                <Step
                  number="03"
                  title="We refine and confirm"
                  body="Together we adjust timings, menus and details until it feels like a true match for your people."
                />
                <Step
                  number="04"
                  title="You arrive — and exhale"
                  body="We hold the flow and practicalities so you can actually be part of your own gathering."
                />
              </ol>

              <div className="mt-3 space-y-3 text-sm text-[#4d3d33]">
                <InfoRow
                  icon={<CalendarDays className="h-4 w-4" />}
                  title="How early should we reach out?"
                  body="For spring and autumn, 3–6 months is ideal. For simpler one-evening gatherings, we sometimes can work with less."
                />
                <InfoRow
                  icon={<Anchor className="h-4 w-4" />}
                  title="Budget"
                  body="We don’t do packages; we build around what matters most to you. Once we know your dates and guest count, we’ll share a clear range."
                />
                <InfoRow
                  icon={<Sparkles className="h-4 w-4" />}
                  title="Who this is for"
                  body="People who care more about how it feels than how it looks on social media. If that’s you, we’ll probably get along."
                />
              </div>

              <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-dashed border-[#e0d6c6] bg-white/60 px-4 py-3 text-xs text-[#6a5a49]">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-[#8b6f47]" />
                  <span className="font-semibold text-[#4d3d33]">
                    Ready to start a conversation?
                  </span>
                </div>
                <p>
                  A short message like{" "}
                  <em>
                    “We&apos;re two families, in Crete in July, and want one
                    unhurried day together”
                  </em>{" "}
                  is the perfect place to begin.
                </p>
                <div>
                  <Link
                    href="/contact"
                    className="inline-flex items-center justify-center rounded-full bg-[#8b6f47] px-4 py-2 text-xs font-medium text-white shadow-sm shadow-[#8b6f47]/25 transition hover:-translate-y-0.5 hover:bg-[#a78b62]"
                  >
                    Start a private gathering enquiry
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Gentle closing strip */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-14 md:mt-16"
          >
            <div className="flex flex-col gap-3 rounded-3xl border border-[#e3d7c6] bg-white/70 px-5 py-4 text-sm text-[#4a4a4a] shadow-sm md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f4ebdf] text-[#8b6f47]">
                  <MoonStar className="h-4 w-4" />
                </div>
                <p className="max-w-xl text-[13px] leading-relaxed">
                  We keep our calendar intentionally light so we can stay close
                  to each gathering. If your dates are flexible, let us know —
                  it often opens up more beautiful options.
                </p>
              </div>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-full border border-[#d3c2aa] bg-white px-4 py-2 text-xs font-medium text-[#4d3d33] shadow-sm transition hover:border-[#c2ae95] hover:bg-[#fbf7ef]"
              >
                Ask about dates & availability
              </Link>
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

function Card({ icon, label, title, bullets, footnote }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-[#e0d6c6] bg-white/80 p-4 shadow-sm backdrop-blur-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-[#8b7a6b]">
        <span>{label}</span>
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f4ebdf] text-[#8b6f47]">
          {icon}
        </div>
      </div>
      <h3 className="font-serif text-lg text-[#3e3128]">{title}</h3>
      <ul className="mt-3 space-y-1.5 text-[13px] text-[#4d3d33]">
        {bullets.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
      {footnote && (
        <p className="mt-3 text-[11px] text-[#8b7a6b]">{footnote}</p>
      )}
    </article>
  );
}

function ScenarioCard({ label, title, length, guests, vibe, details }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-[#e0d6c6] bg-white/80 p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-[0.16em] text-[#8b7a6b]">
        {label}
      </div>
      <h3 className="mt-1 font-serif text-lg text-[#3e3128]">{title}</h3>

      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[#6a5a49]">
        <Tag>{length}</Tag>
        <Tag>{guests}</Tag>
        <Tag>{vibe}</Tag>
      </div>

      <ul className="mt-3 space-y-1.5 text-[13px] text-[#4d3d33]">
        {details.map((d) => (
          <li key={d}>• {d}</li>
        ))}
      </ul>
    </article>
  );
}

function Tag({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#f9f3ea] px-2.5 py-1">
      {children}
    </span>
  );
}

function ShapeItem({ title, items }) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-[#3e3128]">{title}</p>
      <ul className="mt-1 space-y-0.5 text-[13px] text-[#6b625a]">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function Step({ number, title, body }) {
  return (
    <li className="flex gap-3">
      <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#f4ebdf] text-[11px] font-semibold text-[#8b6f47]">
        {number}
      </div>
      <div>
        <p className="text-[13px] font-semibold text-[#3e3128]">{title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-[#6b625a]">
          {body}
        </p>
      </div>
    </li>
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
