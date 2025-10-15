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
  Calendar,
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MapPin,
} from "lucide-react";

import React, { useState } from "react";

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
      text: "Every experience is co-created with Cretan hosts, artisans, and growers—nothing generic.",
    },
    {
      title: "Community",
      icon: <Users className="h-5 w-5" aria-hidden />,
      text: "We connect guests and locals through shared meals, workshops, and slow adventures.",
    },
  ];

  const badges = [
    {
      label: "Launching",
      value: "2025",
      icon: <Calendar className="h-4 w-4" aria-hidden />,
    },
    {
      label: "Base",
      value: "Chania, Crete",
      icon: <MapPin className="h-4 w-4" aria-hidden />,
    },
    {
      label: "Focus",
      value: "Slow Travel",
      icon: <Heart className="h-4 w-4" aria-hidden />,
    },
  ];

  const team = [
    {
      name: "Stavroula",
      role: "Founder",
      image: "/team1.jpeg",
      bio: "Founded Oasis to share the serenity and wisdom of Crete through transformative stays.",
    },
    {
      name: "Christos",
      role: "Wellness Expert",
      image: "/team2.jpeg",
      bio: "Mindfulness and holistic practices that help you reconnect with your inner self.",
    },
    {
      name: "Maria",
      role: "Community Manager",
      image: "/team3.jpeg",
      bio: "Nurtures a sense of belonging and facilitates meaningful connections.",
    },
  ];

  return (
    <main className="relative min-h-[100svh] overflow-x-clip bg-[#f4f1ec] text-[#2f2f2f] transition-colors duration-500 dark:bg-[#0f0f0f] dark:text-[#e9e4da]">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#a3845b]/25 blur-3xl" />
        <div className="absolute bottom-[-6rem] right-[-6rem] h-[28rem] w-[28rem] rounded-full bg-emerald-400/10 blur-3xl dark:bg-emerald-500/10" />
        <div className="absolute inset-0 opacity-[0.06] [background:radial-gradient(circle_at_center,rgba(0,0,0,0.35)_1px,transparent_1px)] [background-size:20px_20px] dark:opacity-[0.12]" />
      </div>

      {/* Launch banner */}
      <div className="relative z-10 border-b border-black/5 bg-white/70 py-2 text-center text-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
        <span className="inline-flex items-center gap-2 px-3 py-1">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#a3845b]" />
          <span className="font-medium">We’re opening this year</span>
          <span className="opacity-70">
            — subscribe to our newsletter for early access
          </span>
        </span>
      </div>

      {/* Hero */}
      <section className="relative z-10 px-6 pb-10 pt-24 md:px-10 md:pt-28 lg:pt-32">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-[#c7b8a6]/60 bg-white/60 px-3 py-1 text-xs text-[#6a5a49] backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-[#d8cdbf]">
              <span className="inline-block h-2 w-2 rounded-full bg-[#a3845b]" />
              Opening in 2025 • Chania, Crete
            </div>
            <h1 className="mt-5 font-serif text-4xl leading-[1.08] md:text-5xl lg:text-6xl">
              A new kind of <span className="text-[#a3845b]">Oasis</span> for
              slow travel
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[#4a4a4a] dark:text-[#cfc9be]">
              We’re launching immersive, small-group experiences rooted in the
              rhythms of Crete—where nature, craft, and community meet.
            </p>

            {/* Badge strip */}
            <div className="mt-6 grid max-w-xl grid-cols-3 gap-3">
              {badges.map((b) => (
                <div
                  key={b.label}
                  className="flex items-center gap-2 rounded-xl border border-black/5 bg-white/70 px-3 py-2 text-sm shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
                >
                  <span className="text-[#a3845b]">{b.icon}</span>
                  <span className="font-medium">{b.value}</span>
                </div>
              ))}
            </div>

            {/* Newsletter */}
            <div className="mt-7">
              <NewsletterForm />
              <p className="mt-2 text-xs text-[#6b5a49] opacity-80 dark:text-[#cbbca8]">
                Join our newsletter for exclusive updates and insights.
                Unsubscribe Anytime.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/experiences"
                className="group inline-flex items-center gap-2 rounded-full bg-[#a3845b] px-6 py-3 font-medium text-white shadow-lg shadow-[#a3845b]/20 transition-transform hover:-translate-y-0.5 hover:bg-[#b79266]"
              >
                Preview experiences
                <Sparkles className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center rounded-full border border-[#a3845b]/50 bg-white/60 px-6 py-3 font-medium text-[#5a4a3f] backdrop-blur hover:border-[#a3845b] dark:border-white/15 dark:bg-white/5 dark:text-[#e9e4da]"
              >
                Get in touch
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
                className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[#a3845b]/30 via-transparent to-emerald-400/30 blur-2xl"
                aria-hidden
              />
              <div className="relative grid grid-cols-2 gap-4 rounded-3xl border border-black/5 bg-white/60 p-4 backdrop-blur dark:border-white/10 dark:bg-neutral-900/40">
                <MosaicImage src="/village-3.jpg" alt="Olive grove" />
                <MosaicImage src="/olive-rituals.jpg" alt="Cretan sea" />
                <MosaicImage src="/pottery.png" alt="Harvest moment" />
                <MosaicImage src="/village-1.jpg" alt="Sunrise yoga" />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* What Oasis Means */}
      <section className="relative z-10 border-y border-black/5 bg-[#efe8de] px-6 py-20 dark:border-white/10 dark:bg-[#161616] md:px-10">
        <motion.div
          className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-10 lg:grid-cols-2"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
        >
          <div>
            <h2 className="font-serif text-3xl md:text-4xl">
              What “Oasis” Means
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed text-[#4a4a4a] dark:text-[#cfc9be]">
              An oasis is a peaceful retreat at the heart of nature — a place to
              pause, replenish, and return to yourself. Through sunrise yoga,
              olive harvesting, slow food, and creative workshops, we offer a
              sanctuary where you can breathe and belong.
            </p>
            <ul className="mt-6 grid gap-3 text-sm text-[#5a4a3f] dark:text-[#e8dccd] sm:grid-cols-2">
              <li className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 ring-1 ring-[#a3845b]/20 backdrop-blur dark:bg-white/5">
                <Heart className="h-4 w-4" /> Mindful practices
              </li>
              <li className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 ring-1 ring-[#a3845b]/20 backdrop-blur dark:bg-white/5">
                <Leaf className="h-4 w-4" /> Nature-first design
              </li>
              <li className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 ring-1 ring-[#a3845b]/20 backdrop-blur dark:bg-white/5">
                <Users className="h-4 w-4" /> Community-led
              </li>
              <li className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 ring-1 ring-[#a3845b]/20 backdrop-blur dark:bg-white/5">
                <Shield className="h-4 w-4" /> Locally crafted
              </li>
            </ul>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {badges.map((b, i) => (
              <motion.div
                key={b.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="rounded-2xl border border-black/5 bg-white/70 p-6 text-center shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
              >
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#a3845b]/10 text-[#a3845b]">
                  {b.icon}
                </div>
                <div className="mt-2 text-2xl font-semibold text-[#a3845b] md:text-3xl">
                  {b.value}
                </div>
                <div className="mt-1 text-xs uppercase tracking-wide text-[#6b5a49] opacity-80 dark:text-[#cbbca8]">
                  {b.label}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Roadmap to Opening */}
      <section className="relative z-10 px-6 py-20 md:px-10">
        <motion.div
          className="mx-auto max-w-6xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
        >
          <h3 className="text-center font-serif text-3xl md:text-4xl">
            Roadmap to Opening
          </h3>
          <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="relative space-y-10 border-l border-[#a3845b]/30 pl-6">
              <TimelineItem
                title="Space & partner curation"
                text="Selecting venues and local partners across Chania & countryside."
              />
              <TimelineItem
                title="Pilot experiences"
                text="Small test groups for fine-tuning flow, safety, and storytelling."
              />
              <TimelineItem
                title="Soft opening"
                text="Limited launches with early-bird guests from the newsletter."
              />
              <TimelineItem
                title="Grand opening"
                text="Full program rollout with seasonal calendar."
                last
              />
            </div>
            <div className="relative rounded-3xl border border-black/5 bg-white/70 p-6 backdrop-blur dark:border-white/10 dark:bg-white/5">
              <Image
                src="/about-landscape.jpg"
                alt="Cretan landscape"
                width={1200}
                height={800}
                sizes="(max-width: 1024px) 100vw, 600px"
                className="h-auto w-full rounded-2xl object-cover shadow-sm"
                priority
              />
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
          <h3 className="text-center font-serif text-3xl md:text-4xl">
            Meet the Team
          </h3>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.6, delay: i * 0.08 }}
                className="group relative overflow-hidden rounded-3xl border border-black/5 bg-white/70 p-6 text-center shadow-sm backdrop-blur transition-transform hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/5"
              >
                <div
                  className="absolute inset-0 -z-10 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#a3845b]/20 to-transparent" />
                </div>
                <Image
                  src={t.image}
                  alt={t.name}
                  width={160}
                  height={160}
                  className="mx-auto mb-4 h-32 w-32 rounded-full border-2 border-[#e1d3c2] object-cover shadow-sm dark:border-[#3b332b]"
                />
                <div className="text-lg font-semibold">{t.name}</div>
                <div className="text-sm text-[#6a5a49] dark:text-[#cbbca8]">
                  {t.role}
                </div>
                <p className="mt-3 text-[15px] leading-relaxed text-[#4a4a4a] dark:text-[#cfc9be]">
                  {t.bio}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 border-t border-black/5 bg-[#fbfaf7] px-6 py-20 dark:border-white/10 dark:bg-[#151515] md:px-10">
        <motion.div
          className="mx-auto max-w-5xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
        >
          <h3 className="text-center font-serif text-3xl md:text-4xl">FAQs</h3>
          <div className="mt-10 divide-y divide-black/5 overflow-hidden rounded-2xl border border-black/5 bg-white/70 backdrop-blur dark:divide-white/10 dark:border-white/10 dark:bg-white/5">
            {[
              {
                q: "How often do you email?",
                a: "About once a month. We’ll share stories from Crete, opening dates, and member perks.",
              },
              {
                q: "Can I unsubscribe?",
                a: "Anytime with one click—every email includes an unsubscribe link.",
              },
              {
                q: "Do you share my data?",
                a: "Never. We store minimal info securely and only use it to send the newsletter.",
              },
            ].map((item, idx) => (
              <details key={idx} className="group p-4 open:bg-white/80">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-[15px] font-medium">
                  {item.q}
                  <span className="transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-[#4a4a4a] dark:text-[#cfc9be]">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="relative z-10 overflow-hidden">
        <div className="relative mx-auto max-w-6xl px-6 py-20 md:px-10">
          <div
            className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_100%,rgba(163,132,91,0.25),transparent)]"
            aria-hidden
          />
          <div className="relative flex flex-col items-center rounded-3xl border border-[#a3845b]/30 bg-white/70 px-6 py-14 text-center shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 md:px-12">
            <h4 className="font-serif text-3xl md:text-4xl">
              Join the Oasis Newsletter
            </h4>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#4a4a4a] dark:text-[#cfc9be]">
              join our newsletter for exclusive updates and insights.
              Unsubscribe Anytime.
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

function TimelineItem({ title, text, last }) {
  return (
    <div className="relative pl-6">
      <span className="absolute -left-[9px] top-1 block h-4 w-4 rounded-full border-2 border-white bg-[#a3845b] shadow ring-2 ring-[#a3845b]/30 dark:border-[#0f0f0f]" />
      <h4 className="text-lg font-semibold">{title}</h4>
      <p className="mt-1 text-[15px] leading-relaxed text-[#4a4a4a] dark:text-[#cfc9be]">
        {text}
      </p>
      {!last && <div className="mt-6 h-8 w-px bg-[#a3845b]/30" />}
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
      <div className="flex items-stretch overflow-hidden rounded-full border border-[#a3845b]/30 bg-white/70 shadow-sm backdrop-blur focus-within:border-[#a3845b] focus-within:ring-4 focus-within:ring-[#a3845b]/20 dark:border-white/10 dark:bg-white/5">
        <div className="hidden items-center pl-4 text-[#a3845b] sm:flex">
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
          className="group inline-flex items-center gap-2 rounded-none bg-[#a3845b] px-5 py-3 font-medium text-white transition hover:bg-[#b79266] disabled:opacity-70"
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
            Something went wrong—please try again.
          </p>
        )}
        {status === "success" && (
          <p className="text-emerald-600">We’ve sent a confirmation link.</p>
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
      <div className="rounded-2xl border border-[#a3845b]/30 bg-white/80 p-3 shadow-lg backdrop-blur dark:border-white/10 dark:bg-white/10">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className="text-center text-sm text-[#5a4a3f] sm:text-left dark:text-[#e9e4da]">
            Opening this year in Chania — subscribe for early access & stories.
          </p>
          <div className="w-full max-w-sm">
            <NewsletterForm compact />
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="mt-2 block w-full text-center text-xs text-[#6b5a49] opacity-70 hover:opacity-100"
        >
          Hide
        </button>
      </div>
    </div>
  );
}
