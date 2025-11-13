"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Leaf,
  Shield,
  Users,
  Heart,
  Sparkles,
  Mail,
  Loader2,
  CheckCircle2,
  MapPin,
} from "lucide-react";
import React from "react";

export default function About() {
  const features = [
    {
      title: "Sustainability",
      icon: <Leaf className="h-5 w-5" aria-hidden />,
      text: "Low-impact activities, local sourcing, and responsible operations to protect the island we love.",
    },
    {
      title: "Authenticity",
      icon: <Shield className="h-5 w-5" aria-hidden />,
      text: "Every experience is co-created with Cretan hosts, artisans, and growers — nothing generic.",
    },
    {
      title: "Community",
      icon: <Users className="h-5 w-5" aria-hidden />,
      text: "We connect guests and locals through shared meals, workshops, and slow adventures.",
    },
    {
      title: "Wellbeing",
      icon: <Heart className="h-5 w-5" aria-hidden />,
      text: "Mindful practices and nature-first design to help you reconnect with yourself.",
    },
  ];

  const quickFacts = [
    {
      label: "Base",
      value: "Chania, Crete",
      icon: <MapPin className="h-4 w-4" aria-hidden />,
    },
    {
      label: "Focus",
      value: "Slow travel & wellness",
      icon: <Heart className="h-4 w-4" aria-hidden />,
    },
    {
      label: "Approach",
      value: "Small groups",
      icon: <Users className="h-4 w-4" aria-hidden />,
    },
  ];

  const team = [
    {
      name: "Stavroula",
      role: "Founder & Host",
      image: "/team1.jpeg",
      bio: "Founded Oasis to share the serenity and wisdom of Crete through intimate, rooted stays.",
    },
    {
      name: "Christos",
      role: "Wellness Facilitator",
      image: "/team2.jpeg",
      bio: "Guides mindfulness and holistic practices inspired by the rhythms of nature.",
    },
    {
      name: "Maria",
      role: "Community Curator",
      image: "/team3.jpeg",
      bio: "Nurtures a sense of belonging and meaningful connection between guests and locals.",
    },
  ];

  const faqs = [
    {
      q: "Who are your experiences for?",
      a: "For travellers who prefer depth over speed — solo guests, couples, and small groups who want to connect with nature, food, and local culture.",
    },
    {
      q: "How big are the groups?",
      a: "Most experiences run with very small groups to keep things intimate and respectful to our hosts and the land.",
    },
    {
      q: "Can you customize an experience?",
      a: "Yes. For private stays or special occasions, we can co-create a tailored itinerary around your needs.",
    },
  ];

  return (
    <main className="relative min-h-[100svh] overflow-x-clip bg-[#f4f1ec] text-[#2f2f2f]">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#e3d3bc]/70 blur-3xl" />
        <div className="absolute bottom-[-6rem] right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-[#d2c3aa]/60 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.07] [background:radial-gradient(circle_at_center,rgba(90,74,63,0.5)_1px,transparent_1px)] [background-size:26px_26px]" />
      </div>

      {/* Hero */}
      <section className="relative z-10 px-6 pb-12 pt-24 md:px-10 md:pt-28 lg:pt-32">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Text column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d3c2aa] bg-white/70 px-3 py-1 text-xs text-[#6a5a49] backdrop-blur">
              <span className="inline-block h-2 w-2 rounded-full bg-[#8b6f47]" />
              Chania • Crete
            </div>

            <h1 className="mt-5 font-serif text-4xl leading-[1.08] text-[#4d3d33] md:text-5xl lg:text-6xl">
              Slow travel, rooted in{" "}
              <span className="text-[#8b6f47]">Cretan land</span>
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[#4a4a4a]">
              Oasis is a collection of nature-immersive, small-group experiences
              where local life, craft, and wellbeing meet. Designed with Cretan
              hosts and guided by a gentle pace.
            </p>

            {/* Quick facts */}
            <div className="mt-6 grid max-w-xl grid-cols-3 gap-3">
              {quickFacts.map((f) => (
                <div
                  key={f.label}
                  className="flex items-center gap-2 rounded-xl border border-[#e2d7c7] bg-white/80 px-3 py-2 text-sm shadow-sm"
                >
                  <span className="text-[#8b6f47]">{f.icon}</span>
                  <span className="font-medium text-[#4d3d33]">{f.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/experiences"
                className="group inline-flex items-center gap-2 rounded-full bg-[#8b6f47] px-6 py-3 font-medium text-white shadow-lg shadow-[#8b6f47]/25 transition-transform hover:-translate-y-0.5 hover:bg-[#a78b62]"
              >
                Explore experiences
                <Sparkles className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center rounded-full border border-[#cbb9a2] bg-white/80 px-6 py-3 text-sm font-medium text-[#5a4a3f] backdrop-blur hover:border-[#8b6f47]"
              >
                Contact us
              </Link>
            </div>
          </motion.div>

          {/* Image mosaic */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="relative"
          >
            <div className="relative mx-auto w-full max-w-xl">
              <div
                className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[#8b6f47]/30 via-transparent to-[#e8d2b2]/40 blur-2xl"
                aria-hidden
              />
              <div className="relative grid grid-cols-2 gap-4 rounded-3xl border border-[#e2d7c7] bg-white/80 p-4 backdrop-blur">
                <MosaicImage src="/village-3.jpg" alt="Cretan village" />
                <MosaicImage src="/olive-rituals.jpg" alt="Olive rituals" />
                <MosaicImage src="/pottery.png" alt="Pottery workshop" />
                <MosaicImage src="/village-1.jpg" alt="Mountain paths" />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Ethos */}
      <section className="relative z-10 border-y border-[#e2d7c7] bg-[#efe8de] px-6 py-20 md:px-10">
        <motion.div
          className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-12 lg:grid-cols-2"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
        >
          <div>
            <p className="text-xs tracking-[0.28em] uppercase text-[#8b6f47]">
              Our ethos
            </p>
            <h2 className="mt-3 font-serif text-3xl text-[#4d3d33] md:text-4xl">
              Gentle travel, deep connection
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[#4a4a4a]">
              An oasis is a quiet place in the middle of movement — a pause, a
              breath, a home away from home. Through olive harvests, herb walks,
              slow food, and creative workshops, we invite you to feel part of
              Cretan life rather than just visiting it.
            </p>
            <ul className="mt-6 grid gap-3 text-sm text-[#5a4a3f] sm:grid-cols-2">
              {features.map((f) => (
                <li
                  key={f.title}
                  className="flex items-center gap-2 rounded-lg bg-white/80 px-3 py-2 ring-1 ring-[#dac9b5]"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f2e6d6] text-[#8b6f47]">
                    {f.icon}
                  </span>
                  <span className="font-medium">{f.title}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className="rounded-2xl border border-[#e2d7c7] bg-white/80 p-6 shadow-sm"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8b6f47]/10 text-[#8b6f47]">
                  {f.icon}
                </div>
                <div className="mt-2 text-lg font-semibold text-[#4d3d33]">
                  {f.title}
                </div>
                <div className="mt-1 text-sm text-[#6b5a49]">{f.text}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Story */}
      <section className="relative z-10 px-6 py-20 md:px-10">
        <motion.div
          className="mx-auto max-w-6xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
        >
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="relative rounded-3xl border border-[#e2d7c7] bg-white/80 p-4">
              <Image
                src="/olive-1.jpg"
                alt="Cretan landscape"
                width={1200}
                height={800}
                sizes="(max-width: 1024px) 100vw, 600px"
                className="h-auto w-full rounded-2xl object-cover shadow-sm"
                priority
              />
            </div>
            <div className="space-y-4">
              <p className="text-xs tracking-[0.28em] uppercase text-[#8b6f47]">
                Our story
              </p>
              <h3 className="font-serif text-3xl text-[#4d3d33] md:text-4xl">
                Born from the rhythms of local life
              </h3>
              <p className="text-[15px] leading-relaxed text-[#4a4a4a]">
                Oasis began with a simple idea: travel can be gentler, slower,
                and more connected to the people who call this place home.
                Rather than ticking off sights, we wanted guests to feel the
                everyday magic of Cretan life — the early-morning olive groves,
                the long conversations over food, the sea at dusk.
              </p>
              <p className="text-[15px] leading-relaxed text-[#4a4a4a]">
                We collaborate with growers, cooks, artisans, and guides to
                create experiences that respect their work and stories. Each
                gathering is intimate, unhurried, and thoughtfully curated so
                you can arrive as a guest and leave as a friend.
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Team */}
      <section className="relative z-10 px-6 py-20 md:px-10">
        <motion.div
          className="mx-auto max-w-6xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
        >
          <h3 className="text-center font-serif text-3xl text-[#4d3d33] md:text-4xl">
            Meet the team
          </h3>
          <p className="mt-3 text-center text-sm text-[#6b625a] max-w-2xl mx-auto">
            A small, hands-on team working closely with a wider circle of Cretan
            hosts, farmers, and artisans.
          </p>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.6, delay: i * 0.08 }}
                className="group relative overflow-hidden rounded-3xl border border-[#e2d7c7] bg-white/85 p-6 text-center shadow-sm transition-transform hover:-translate-y-0.5"
              >
                <div
                  className="absolute inset-0 -z-10 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#e8d2b2]/50 to-transparent" />
                </div>
                <Image
                  src={t.image}
                  alt={t.name}
                  width={160}
                  height={160}
                  className="mx-auto mb-4 h-32 w-32 rounded-full border-2 border-[#e1d3c2] object-cover shadow-sm"
                />
                <div className="text-lg font-semibold text-[#4d3d33]">
                  {t.name}
                </div>
                <div className="text-sm text-[#7a6a5f]">{t.role}</div>
                <p className="mt-3 text-[15px] leading-relaxed text-[#4a4a4a]">
                  {t.bio}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 border-t border-[#e2d7c7] bg-[#fbfaf7] px-6 py-20 md:px-10">
        <motion.div
          className="mx-auto max-w-5xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
        >
          <h3 className="text-center font-serif text-3xl text-[#4d3d33] md:text-4xl">
            Practical questions
          </h3>
          <p className="mt-3 text-center text-sm text-[#6b625a]">
            A few common things guests ask before booking.
          </p>
          <div className="mt-10 divide-y divide-[#eee0cf] overflow-hidden rounded-2xl border border-[#e2d7c7] bg-white/85 backdrop-blur">
            {faqs.map((item, idx) => (
              <details key={idx} className="group p-4 open:bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-[15px] font-medium text-[#4d3d33]">
                  {item.q}
                  <span className="text-xs text-[#8b6f47] transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-[#4a4a4a]">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </motion.div>
      </section>

      {/* CTA + Newsletter */}
      <section className="relative z-10 overflow-hidden">
        <div className="relative mx-auto max-w-6xl px-6 py-20 md:px-10">
          <div
            className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_100%,rgba(139,111,71,0.25),transparent)]"
            aria-hidden
          />
          <div className="relative flex flex-col items-center rounded-3xl border border-[#d3c2aa] bg-white/80 px-6 py-14 text-center shadow-sm backdrop-blur md:px-12">
            <h4 className="font-serif text-3xl text-[#4d3d33] md:text-4xl">
              Stories from Crete, in your inbox
            </h4>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#4a4a4a]">
              Occasional notes about seasonal rituals, new experiences, and life
              on the island. No noise, no daily spam — just when there’s
              something worth sharing.
            </p>
            <div className="mt-6 w-full max-w-lg">
              <NewsletterForm compact />
            </div>
          </div>
        </div>
      </section>

      {/* Sticky newsletter bar */}
      <StickyNewsletter />
    </main>
  );
}

/* --------------------------- Subcomponents --------------------------- */

function MosaicImage({ src, alt }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, 50vw"
        className="object-cover transition-transform duration-500 hover:scale-[1.04]"
        priority={false}
      />
    </div>
  );
}

function NewsletterForm({ compact = false }) {
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("invalid");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          source: compact ? "about_cta_compact" : "about_hero",
        }),
      });
      if (res.ok) setStatus("success");
      else setStatus("error");
    } catch (e) {
      setStatus("error");
    }
  };

  return (
    <form
      onSubmit={submit}
      className={compact ? "w-full" : "mt-2 w-full max-w-lg"}
    >
      <div className="flex items-stretch overflow-hidden rounded-full border border-[#d3c2aa] bg-white/80 shadow-sm backdrop-blur focus-within:border-[#8b6f47] focus-within:ring-4 focus-within:ring-[#8b6f47]/15">
        <div className="hidden items-center pl-4 text-[#8b6f47] sm:flex">
          <Mail className="h-4 w-4" />
        </div>
        <input
          type="email"
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-[#8f8578]"
          aria-label="Email address"
          required
        />
        <button
          type="submit"
          disabled={status === "loading" || status === "success"}
          className="group inline-flex items-center gap-2 rounded-none bg-[#8b6f47] px-5 py-3 font-medium text-white transition hover:bg-[#a78b62] disabled:opacity-70"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Subscribing…
            </>
          ) : status === "success" ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Check your email
            </>
          ) : (
            <>Subscribe</>
          )}
        </button>
      </div>
      <div className="min-h-[22px] pt-1 text-xs">
        {status === "invalid" && (
          <p className="text-[#b44d4d]">Please enter a valid email address.</p>
        )}
        {status === "error" && (
          <p className="text-[#b44d4d]">
            Something went wrong — please try again.
          </p>
        )}
        {status === "success" && (
          <p className="text-[#207b55]">We&apos;ve sent a confirmation link.</p>
        )}
      </div>
    </form>
  );
}

function StickyNewsletter() {
  const [dismissed, setDismissed] = React.useState(false);
  if (dismissed) return null;

  return (
    <div className="sticky bottom-4 z-20 mx-auto max-w-3xl px-4">
      <div className="rounded-2xl border border-[#d3c2aa] bg-white/90 p-3 shadow-lg backdrop-blur">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className="text-center text-sm text-[#5a4a3f] sm:text-left">
            Seasonal notes from Crete — subscribe if you&apos;d like to stay in
            touch.
          </p>
          <div className="w-full max-w-sm">
            <NewsletterForm compact />
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="mt-2 block w-full text-center text-xs text-[#7a6a5f] opacity-70 hover:opacity-100"
        >
          Hide
        </button>
      </div>
    </div>
  );
}
