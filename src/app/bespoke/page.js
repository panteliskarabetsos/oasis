// src/app/bespoke/page.js
"use client";

import Image from "next/image";
import LinkWithLoader from "@/app/components/LinkWithLoader";
import {
  Sparkles,
  Users,
  Calendar,
  MapPin,
  MessageSquare,
  Gift,
  Utensils,
  Compass,
  ArrowRight,
  ShieldCheck,
  Music,
  Waves,
  Heart,
  PartyPopper,
  Info,
  CheckCircle2 as CheckIcon,
} from "lucide-react";
import { motion } from "framer-motion";

export default function DetailedBespokeEventsPage() {
  const eventScenarios = [
    {
      title: "The Grand Proposal",
      subtitle: "Clandestine & Cinematic",

      description:
        "Secure a 'Yes' that echoes forever. We specialize in high-stakes, secret logistics. While you 'stumble' upon a candlelit path on a deserted clifftop, a hidden violinist begins your song. Our team manages everything from the ring's safe-keeping to a private fireworks display over the Aegean.",
      signatureTouch:
        "Private clifftop access • 5-course seafood tasting • Hidden photography team",
      image: "/proposal.jpeg",
    },
    {
      title: "Milestone Birthdays",
      subtitle: "A Secret in the Olive Groves",

      description:
        "Move beyond the restaurant dinner. Imagine walking into a 200-year-old private olive grove transformed with thousands of fairy lights and a long wooden banquet table. A surprise 'Antikristo' wood-fire feast awaits, accompanied by traditional Lyra players that only appear as the sun sets.",
      signatureTouch:
        "Custom mixology bar • Traditional Cretan Lyra band • Bespoke local-flavor cake",
      image: "/bespoke-event.jpeg",
    },
    {
      title: "Family Reunions",
      subtitle: "Reconnecting Across Generations",

      description:
        "Multi-generational travel made effortless. We design a 'Villa Takeover' day where grandchildren learn to make traditional pasta with a local 'Yiayia,' while parents enjoy a sommelier-led vineyard tour on-site. We bridge the gap between adventure for the young and comfort for the elders.",
      signatureTouch:
        "Kid-friendly farm activities • Professional family portraits • Private host concierge",
      image: "/reunion.jpeg",
    },
    {
      title: "Wellness Retreats",
      subtitle: "A Sanctuary for the Senses",

      description:
        "Escape the noise of the world with a day dedicated to restoration. We coordinate private sunrise yoga on hidden mountain plateaus, guided meditation sessions in ancient olive groves, and organic farm-to-table lunch experiences. Architect a day of 'Slow Travel' designed to reset your pulse.",
      signatureTouch:
        "Sound bath therapy • Organic herbalist workshop • Private mountain transfers",
      image: "/outdoor-yoga.jpeg",
    },
  ];

  const customCapabilities = [
    {
      icon: MapPin,
      title: "Exclusive Venues",
      desc: "Beyond restaurants. Hidden beaches reachable only by boat, ancient olive groves, private clifftops, restored Venetian villas, or secret mountain plateaus.",
    },
    {
      icon: Utensils,
      title: "Cretan Gastronomy",
      desc: "Private chefs executing wood-fire 'Antikristo' lamb, multi-course seafood tasting menus, or interactive masterclasses paired with sommelier-led wine flights.",
    },
    {
      icon: ShieldCheck,
      title: "Discreet Logistics",
      desc: "Luxury 4x4 transfers, private helicopter island hops, and exclusive full-day yacht excursions managed with absolute discretion.",
    },
    {
      icon: Music,
      title: "Atmospheric Decor",
      desc: "Curated floral arrangements using local flora, clifftop violin serenades, traditional lyra players, or subtle atmospheric lighting under the stars.",
    },
  ];

  return (
    <main className="min-h-screen bg-[#fdf8f0] text-[#2b1c11] selection:bg-[#b5893e] selection:text-white">
      {/* Hero Section */}
      <section className="relative h-[85vh] flex items-center justify-center overflow-hidden">
        <Image
          src="/bespoke-hero.jpeg"
          alt="Bespoke Beach Events Crete at Sunset"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[#2b1c11]/40" />

        <div className="relative z-10 text-center px-6 max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-[10px] font-bold uppercase tracking-[0.3em] mb-6">
              Privately Curated Memories
            </span>
            <h1 className="text-5xl md:text-7xl font-serif text-white mb-6 leading-tight">
              Crafting Memories <br />{" "}
              <span className="italic text-[#f1dca7]">
                Tailored to Your Vision
              </span>
            </h1>
            <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto leading-relaxed mb-10">
              Beyond the scheduled paths lies a world created exclusively for
              your moment. We architect olfactive, visual, and cultural
              experiences that belong only to your timeline.
            </p>
            <LinkWithLoader href="/contact">
              <button className="bg-white text-[#2b1c11] px-10 py-4 rounded-full font-bold uppercase text-xs tracking-widest hover:bg-[#b5893e] hover:text-white transition-all duration-500 shadow-xl flex items-center gap-2 mx-auto">
                Consult With Our Planners <ArrowRight size={16} />
              </button>
            </LinkWithLoader>
          </motion.div>
        </div>
      </section>

      {/* Trust Pillars */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-12">
          {[
            {
              icon: Calendar,
              t: "Any Day, Any Time",
              d: "Your schedule dictates the timeline. Morning olive grove yoga or midnight seaside dinners, our hosts adapt to your pulse.",
            },
            {
              icon: Compass,
              t: "100% Fully Customizable",
              d: "Every stop, every flavor, and every texture is hand-picked. From the olive oil vintage to the musician's repertoire.",
            },
            {
              icon: ShieldCheck,
              t: "Total Discretion",
              d: "We manage exclusive buyouts of venues and hidden locations, ensuring zero public intrusion for your group.",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="flex flex-col items-center text-center group"
            >
              <div className="w-16 h-16 rounded-full bg-white border border-[#f1dca7] flex items-center justify-center text-[#b5893e] mb-6 shadow-sm group-hover:bg-[#b5893e] group-hover:text-white transition-all duration-500">
                <item.icon size={28} strokeWidth={1.5} />
              </div>
              <h3 className="font-serif text-xl text-[#2b1c11] mb-2">
                {item.t}
              </h3>
              <p className="text-sm text-[#6b513c] leading-relaxed">{item.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Signature Scenarios Showcase */}
      <section className="py-32 px-6 overflow-hidden bg-white border-y border-[#f1dca7]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-24">
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              className="text-[10px] font-bold text-[#b5893e] uppercase tracking-[0.4em] mb-4 block"
            >
              Inspiration for your moment
            </motion.span>
            <h2 className="text-4xl md:text-6xl font-serif text-[#2b1c11] mb-8 leading-tight">
              Signature Event Scenarios
            </h2>
            <div className="w-24 h-px bg-[#f1dca7] mx-auto mb-8" />
            <p className="text-[#6b513c] max-w-2xl mx-auto text-lg leading-relaxed italic">
              "Every event starts as a blank canvas. These concepts are simply
              the first brushstrokes of what we can create together."
            </p>
          </div>

          <div className="space-y-32">
            {eventScenarios.map((scenario, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: i * 0.1 }}
                className={`flex flex-col ${i % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"} items-center gap-12 lg:gap-20`}
              >
                <div className="w-full lg:w-1/2">
                  <div className="relative group">
                    <div className="absolute -inset-4 border border-[#f1dca7] rounded-[3rem] -z-10 translate-x-2 translate-y-2 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-700" />
                    <div className="relative h-[400px] md:h-[500px] w-full rounded-[2.5rem] overflow-hidden shadow-2xl">
                      <Image
                        src={scenario.image}
                        alt={scenario.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-[#2b1c11]/10 group-hover:bg-transparent transition-colors duration-500" />
                    </div>
                    <div className="absolute top-8 left-8 z-20"></div>
                  </div>
                </div>

                <div className="w-full lg:w-1/2 space-y-6">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-[#b5893e] uppercase tracking-[0.2em]">
                      {scenario.subtitle}
                    </span>
                    <h3 className="text-3xl md:text-4xl font-serif text-[#2b1c11]">
                      {scenario.title}
                    </h3>
                  </div>
                  <p className="text-[#6b513c] text-lg leading-relaxed">
                    {scenario.description}
                  </p>
                  <div className="py-6 border-y border-[#f1dca7]/50">
                    <span className="text-[10px] font-bold text-[#2b1c11] uppercase tracking-widest block mb-3">
                      The Signature Touch:
                    </span>
                    <p className="text-sm font-medium text-[#b5893e]">
                      {scenario.signatureTouch}
                    </p>
                  </div>
                  <div className="pt-4">
                    <LinkWithLoader href="/contact">
                      <button className="group flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-[#2b1c11] hover:text-[#b5893e] transition-colors">
                        Inquire about this concept
                        <div className="w-10 h-10 rounded-full border border-[#f1dca7] flex items-center justify-center group-hover:bg-[#b5893e] group-hover:border-[#b5893e] group-hover:text-white transition-all">
                          <ArrowRight size={16} />
                        </div>
                      </button>
                    </LinkWithLoader>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* NEW: The "Private Edition" Section */}
      <section className="py-24 px-6 bg-[#fdf8f0]">
        <div className="max-w-4xl mx-auto rounded-[3rem] bg-[#361e12] p-8 md:p-16 text-center shadow-2xl relative overflow-hidden">
          {/* Subtle Background Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#b5893e]/10 blur-[100px]" />

          <div className="relative z-10 space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-[#f1dca7] text-[10px] font-bold uppercase tracking-[0.2em]">
              <ShieldCheck size={14} /> Exclusive Buy-Outs
            </div>

            <h2 className="text-3xl md:text-5xl font-serif text-white leading-tight">
              Love our experiences? <br />
              <span className="italic text-[#f1dca7]">
                Make them entirely yours.
              </span>
            </h2>

            <p className="text-white/80 text-lg leading-relaxed max-w-2xl mx-auto">
              Any journey you see in our public catalog—from the Ancient Olive
              Harvest to our Gastronomic Treks—can be booked as a 100% private
              experience.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 text-left">
              {[
                {
                  t: "Custom Timing",
                  d: "Choose a start time that suits your group's natural rhythm.",
                },
                {
                  t: "Personal Pace",
                  d: "Linger longer at your favorite spots; there's no public schedule to follow.",
                },
                {
                  t: "Dedicated Host",
                  d: "Our expert guides focus exclusively on your party's curiosities.",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="space-y-2 border-l border-white/20 pl-6"
                >
                  <h4 className="text-[#f1dca7] text-xs font-bold uppercase tracking-widest">
                    {item.t}
                  </h4>
                  <p className="text-white/60 text-xs leading-relaxed">
                    {item.d}
                  </p>
                </div>
              ))}
            </div>

            <div className="pt-8">
              <LinkWithLoader href="/experiences">
                <button className="bg-[#b5893e] text-white px-10 py-4 rounded-full font-bold uppercase text-xs tracking-widest hover:bg-white hover:text-[#361e12] transition-all duration-500 shadow-xl">
                  Browse Catalog for Inspiration
                </button>
              </LinkWithLoader>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars of Customization */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <Sparkles className="h-10 w-10 text-[#b5893e]/50 mx-auto mb-4" />
            <h2 className="text-4xl font-serif text-[#2b1c11] mb-4">
              The Pillars of Customization
            </h2>
            <p className="text-[#6b513c] leading-relaxed">
              We manipulate every component of the experience to craft
              olfactory, visual, and cultural memories that are distinctly
              yours.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {customCapabilities.map((cap, i) => (
              <div
                key={i}
                className="bg-white border border-[#f1dca7] rounded-3xl p-8 shadow-sm group hover:border-[#b5893e] transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-full bg-[#fdf8f0] border border-[#f1dca7] flex items-center justify-center text-[#b5893e] mb-5 group-hover:scale-110 transition-transform">
                  <cap.icon size={22} strokeWidth={1.5} />
                </div>
                <h4 className="text-lg font-serif text-[#2b1c11] mb-2">
                  {cap.title}
                </h4>
                <p className="text-xs text-[#6b513c] leading-relaxed">
                  {cap.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Journey/Process */}
      <section className="py-24 px-6 bg-[#f5ebe0] border-y border-[#f1dca7]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-serif text-[#2b1c11] mb-4">
              Your Journey, Step-by-Step
            </h2>
            <p className="text-[#6b513c]">
              A discreet, structured process from initial vision to reality.
            </p>
          </div>

          <div className="space-y-12 relative before:absolute before:left-8 before:top-0 before:h-full before:w-[1px] before:bg-[#f1dca7]">
            {[
              {
                t: "1. The Initial Vision",
                d: "You share your group size, timeframe, and core desire—is it romance, wellness, or celebration? We listen first.",
              },
              {
                t: "2. Custom Design Proposal",
                d: "Our local Cretan experts draft a unique itinerary incorporating secret locations and gastronomy aligned with your vision.",
              },
              {
                t: "3. Collaborative Refinement",
                d: "We work with you to tweak the details until the plan is perfect. We can source specific decorators, musicians, or wellness practitioners.",
              },
              {
                t: "4. Execution with Heart",
                d: "Your private host manages every element on the day, leaving you free to be fully present in the moment.",
              },
            ].map((step, i) => (
              <div key={i} className="relative pl-24 group">
                <div className="absolute left-0 top-0 w-16 h-16 rounded-full bg-white border-2 border-[#f1dca7] flex items-center justify-center text-xl font-serif text-[#b5893e] group-hover:border-[#b5893e] transition-colors z-10 shadow-sm">
                  {i + 1}
                </div>
                <h3 className="text-xl font-serif text-[#2b1c11] mb-2">
                  {step.t}
                </h3>
                <p className="text-sm text-[#6b513c] leading-relaxed">
                  {step.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 text-center bg-white">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#fdfaf5] border border-[#f1dca7] text-[#b5893e] mb-4">
            <Sparkles size={32} strokeWidth={1} />
          </div>
          <h2 className="text-4xl font-serif text-[#2b1c11]">
            Ready to Architect Your <br /> Private Moment?
          </h2>
          <p className="text-[#6b513c] leading-relaxed">
            Every great memory begins with a simple inquiry. Tell us what you're
            dreaming of, and our specialized planners will respond within 24
            hours.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <LinkWithLoader href="/contact">
              <button className="bg-[#361e12] text-[#fdfaf5] px-10 py-4 rounded-full font-bold uppercase text-xs tracking-widest hover:bg-[#b5893e] transition-all duration-300 shadow-xl flex items-center gap-2">
                Begin Initial Inquiry <ArrowRight size={16} />
              </button>
            </LinkWithLoader>
            <a
              href="mailto:info@youroasis.gr?subject=Bespoke%20Event%20Inquiry"
              className="text-sm font-bold uppercase tracking-widest text-[#2b1c11] hover:text-[#b5893e] transition-colors"
            >
              info@youroasis.gr
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
