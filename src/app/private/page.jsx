"use client";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import {
  ChefHat,
  Sparkles,
  Wine,
  Users,
  CalendarHeart,
  MapPin,
  Map,
  Heart,
  Compass,
  Anchor,
} from "lucide-react";

export default function PrivateInVilla() {
  // --- Hero parallax ---
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);

  // --- UI Helpers ---
  const SectionHeading = ({ eyebrow, title, subtitle, center = false }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className={`max-w-3xl ${center ? "mx-auto text-center" : ""} space-y-4`}
    >
      {eyebrow && (
        <p className="text-xs tracking-[0.25em] uppercase text-[#8b6f47] font-semibold">
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl md:text-5xl font-serif text-[#4d3d33] leading-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="text-base md:text-lg text-[#6b625a] leading-relaxed">
          {subtitle}
        </p>
      )}
    </motion.div>
  );

  return (
    <main className="font-light text-[#2f2f2f] bg-[#f4f1ec] overflow-x-hidden">
      {/* ================== HERO ================== */}
      <section
        ref={heroRef}
        className="relative min-h-[90vh] w-full flex items-center justify-center text-center overflow-hidden"
      >
        <motion.div
          style={{ y }}
          className="absolute inset-0 z-0 pointer-events-none"
        >
          <Image
            src="/bespoke-hero.jpeg"
            alt="Private dining and experiences in Crete"
            fill
            priority
            className="object-cover object-center brightness-[.60]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        </motion.div>

        <div className="relative z-10 px-6 max-w-3xl space-y-8 mt-20">
          <motion.p
            className="text-xs tracking-[0.35em] uppercase text-[#eddcb9]"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9 }}
          >
            BESPOKE & EXCLUSIVE
          </motion.p>
          <motion.h1
            className="text-4xl sm:text-5xl md:text-7xl font-serif text-white leading-tight tracking-tight drop-shadow-xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
          >
            Private &<br />
            <span className="text-[#e8d2b2] font-normal italic">In-Villa</span>
          </motion.h1>
          <motion.p
            className="text-white/95 text-lg md:text-xl max-w-2xl mx-auto drop-shadow"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 1 }}
          >
            Whether you wish to privatize one of our signature journeys, host a
            chef in your villa, or build an entirely custom itinerary from
            scratch—your vision is our canvas.
          </motion.p>
        </div>

        {/* --- BLURRY FADE TRANSITION --- */}
        <div className="absolute bottom-0 inset-x-0 h-48 z-10 pointer-events-none select-none">
          <div className="absolute inset-0 backdrop-blur-[12px] [-webkit-mask-image:linear-gradient(to_top,black_10%,transparent_100%)] [mask-image:linear-gradient(to_top,black_10%,transparent_100%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#f4f1ec] via-[#f4f1ec]/60 to-transparent" />
        </div>
      </section>

      {/* ================== IN-VILLA CHEF'S TABLE ================== */}
      <section className="relative z-10 pt-16 pb-32 px-6 bg-[#f4f1ec]">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="relative h-[600px] rounded-3xl overflow-hidden shadow-2xl border border-[#eadfce] order-2 lg:order-1"
            >
              <Image
                src="/proposal.jpeg"
                alt="In-villa chef preparing food"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/10" />
            </motion.div>

            <div className="space-y-8 order-1 lg:order-2">
              <SectionHeading
                eyebrow="We Come To You"
                title="The In-Villa Chef's Table"
                subtitle="The ultimate customized cooking class and dining experience that comes directly to you. Your villa’s kitchen transforms into a private culinary workshop, blending total comfort with premium local ingredients."
              />

              <div className="space-y-6 pt-4">
                {[
                  {
                    icon: <ChefHat className="w-5 h-5 text-[#8b6f47]" />,
                    title: "Bespoke Menus",
                    desc: "You set the tone. Choose a theme that suits your palate—whether that's Seafood Lovers, a Traditional Cretan Meat Feast, or a Vegan Botanical Garden menu.",
                  },
                  {
                    icon: <Sparkles className="w-5 h-5 text-[#8b6f47]" />,
                    title: "Hands-on Masterclass",
                    desc: "Join us at the counter. Learn cutting techniques, food styling, and the storytelling behind authentic Cretan dishes before sitting down to eat.",
                  },
                  {
                    icon: <Wine className="w-5 h-5 text-[#8b6f47]" />,
                    title: "Full Service & Clean-up",
                    desc: "Enjoy a welcome drink and curated local wine pairing while we take care of the entire service—and leave your kitchen spotless when we depart.",
                  },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.15 }}
                    className="flex gap-4"
                  >
                    <div className="mt-1">{item.icon}</div>
                    <div>
                      <h4 className="text-base font-semibold text-[#4d3d33]">
                        {item.title}
                      </h4>
                      <p className="text-sm text-[#6b625a] mt-1 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================== PRIVATE SIGNATURE TOURS ================== */}
      <section className="relative z-20 py-32 px-6 bg-[#faf9f7] rounded-t-[3rem] lg:rounded-t-[5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.03)] -mt-12">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            eyebrow="Our Portfolio, Privatized"
            title="Make Any Signature Tour Yours"
            subtitle="Fell in love with our Cooking with Yiayia or Zourva Foraging experience? You can book ANY of our existing signature journeys as a 100% private event. No strangers, no rigid schedules."
            center
          />

          <div className="grid md:grid-cols-3 gap-8 mt-16">
            {[
              {
                icon: <Users className="w-6 h-6" />,
                title: "Just Your People",
                desc: "Share the experience solely with your family, friends, or colleagues. The dynamic of the group dictates the flow of the day.",
              },
              {
                icon: <CalendarHeart className="w-6 h-6" />,
                title: "Your Rhythm",
                desc: "We adapt the pace to you. Linger longer over the wine, start a little later in the morning, or adjust the physical intensity of a hike.",
              },
              {
                icon: <MapPin className="w-6 h-6" />,
                title: "Door-to-Door",
                desc: "Forget logistics. Our private, premium vans offer direct pick-up and drop-off from your exact hotel or villa location.",
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="bg-white p-8 rounded-3xl border border-[#e8e2d8] shadow-sm flex flex-col text-center items-center group hover:shadow-xl transition-all"
              >
                <div className="w-14 h-14 bg-[#f7f2ea] rounded-full flex items-center justify-center mb-6 text-[#8b6f47] group-hover:scale-110 group-hover:bg-[#8b6f47] group-hover:text-white transition-all duration-500">
                  {feature.icon}
                </div>
                <h4 className="text-xl font-serif text-[#4d3d33]">
                  {feature.title}
                </h4>
                <p className="mt-3 text-sm text-[#6b625a] leading-relaxed">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================== THE BLANK CANVAS (FULLY CUSTOM) ================== */}
      <section className="relative z-30 py-32 px-6 bg-[#f4f1ec] rounded-t-[3rem] lg:rounded-t-[5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.03)] -mt-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <SectionHeading
                eyebrow="The Blank Canvas"
                title="If You Can Dream It, We Can Curate It"
                subtitle="Don't see exactly what you're looking for on our menu? Tell us what you envision. We specialize in crafting entirely custom, ground-up itineraries utilizing our extensive network of local artisans, farmers, captains, and chefs."
              />

              <div className="grid sm:grid-cols-2 gap-6 pt-2">
                {[
                  {
                    icon: <Heart className="w-4 h-4 text-[#8b6f47]" />,
                    title: "Milestones & Anniversaries",
                    desc: "Private dinners hidden deep in a gorge, or a sunset vow renewal on a secluded beach.",
                  },
                  {
                    icon: <Map className="w-4 h-4 text-[#8b6f47]" />,
                    title: "Multi-Day Retreats",
                    desc: "Designing a full 3 to 7-day holistic itinerary for your wellness group or family reunion.",
                  },
                  {
                    icon: <Compass className="w-4 h-4 text-[#8b6f47]" />,
                    title: "Hyper-Specific Interests",
                    desc: "Want to focus purely on ancestral beekeeping? Or a deep-dive into high-altitude viticulture? We know the experts.",
                  },
                  {
                    icon: <Anchor className="w-4 h-4 text-[#8b6f47]" />,
                    title: "Sea & Land Fusions",
                    desc: "Combining private sailing charters with remote beach foraging and onboard private chefs.",
                  },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className="bg-white/60 p-5 rounded-2xl border border-[#eadfce]"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-[#f7f2ea] p-2 rounded-full">
                        {item.icon}
                      </div>
                      <h4 className="text-sm font-bold tracking-widest uppercase text-[#5a4a3f]">
                        {item.title}
                      </h4>
                    </div>
                    <p className="text-sm text-[#6b625a] leading-relaxed pl-11">
                      {item.desc}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="relative h-[650px] rounded-3xl overflow-hidden shadow-2xl border border-[#eadfce]"
            >
              <Image
                src="/reunion.jpeg" // Using an image from your logs
                alt="Custom private event in Crete"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-8 left-8 right-8">
                <p className="text-white/90 italic font-serif text-xl leading-snug">
                  "They took a few vague ideas we had about loving wine and the
                  sea, and built a three-day private journey that our family
                  will talk about for the rest of our lives."
                </p>
                <p className="text-[#e8d2b2] text-sm mt-3 uppercase tracking-widest">
                  — Private bespoke booking
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ================== CTA / REQUEST FORM ================== */}
      <section className="relative z-40 bg-[#8b6f47] py-32 px-6 overflow-hidden rounded-t-[3rem] lg:rounded-t-[5rem] -mt-10">
        <div className="absolute inset-0 opacity-10 bg-[url('/pattern.png')] bg-repeat" />

        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <h2 className="text-4xl md:text-6xl font-serif text-white leading-tight">
              Let's shape your gathering
            </h2>
            <p className="text-white/85 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto font-light">
              Whether you want a private Chef's Table, a privatized signature
              tour, or a completely blank canvas—tell us your vision. We will
              curate a proposal tailored perfectly to you.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-8">
              <Link href="/contact">
                <button className="w-full sm:w-auto bg-white text-[#4d3d33] px-10 py-4 rounded-full font-medium hover:bg-[#f4f1ec] hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                  Request Private Experience
                </button>
              </Link>
              <Link href="/appointments">
                <button className="w-full sm:w-auto border border-white/60 bg-transparent text-white px-10 py-4 rounded-full font-medium hover:bg-white/10 transition-all duration-300">
                  Schedule a Clarity Call
                </button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
