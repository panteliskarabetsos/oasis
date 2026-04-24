"use client";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Users, PhoneCall, Sparkles, Clock, MapPin } from "lucide-react";
import LinkWithLoader from "./components/LinkWithLoader";

export default function Home() {
  // --- Hero parallax ---
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);

  // --- Dynamic Experiences Fetching ---
  const [experiences, setExperiences] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchExperiences = async () => {
      try {
        const res = await fetch("/api/experiences", { cache: "no-store" });
        const data = await res.json();
        setExperiences(Array.isArray(data) ? data.slice(0, 4) : []);
      } catch (error) {
        console.error("Failed to load experiences", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchExperiences();
  }, []);

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

  const SkeletonCard = ({ index }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="animate-pulse flex flex-col rounded-3xl border border-[#ede6da] bg-white/80 overflow-hidden shadow-sm h-full"
    >
      <div className="h-64 w-full bg-[#f0ece5]" />
      <div className="p-6 flex flex-col flex-grow gap-4">
        <div className="h-7 bg-[#f0ece5] rounded w-3/4" />
        <div className="space-y-2 mt-2">
          <div className="h-4 bg-[#f0ece5] rounded w-full" />
          <div className="h-4 bg-[#f0ece5] rounded w-5/6" />
          <div className="h-4 bg-[#f0ece5] rounded w-4/6" />
        </div>
        <div className="mt-auto h-11 bg-[#f0ece5] rounded-full w-full" />
      </div>
    </motion.div>
  );

  const ExperienceCard = ({ exp, index }) => {
    const coverImage =
      Array.isArray(exp.images) && exp.images.length > 0
        ? exp.images[0]
        : "/placeholder-experience.jpg";

    return (
      <motion.article
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.7, delay: index * 0.1, ease: "easeOut" }}
        whileHover={{ y: -8 }}
        className="group flex flex-col rounded-3xl border border-[#e8e2d8] bg-white/95 backdrop-blur-sm overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500"
      >
        <div className="relative h-64 w-full overflow-hidden bg-[#f1ede7]">
          <Image
            src={coverImage}
            alt={exp.name}
            fill
            className="object-cover transition-transform duration-1000 group-hover:scale-105"
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Top Badges */}
          <div className="absolute top-4 left-4 flex gap-2">
            {exp.duration && (
              <span className="flex items-center gap-1 rounded-full bg-white/90 backdrop-blur px-3 py-1 text-xs font-medium text-[#5a4a3f] shadow-sm transform transition-transform group-hover:-translate-y-1 duration-500">
                <Clock className="w-3 h-3" /> {exp.duration}
              </span>
            )}
          </div>

          {/* Bottom Info */}
          <div className="absolute bottom-4 left-4 right-4 text-white transform transition-transform group-hover:translate-y-[-4px] duration-500">
            <p className="text-[10px] tracking-[0.2em] uppercase text-white/80 mb-1">
              Oasis Signature
            </p>
            <div className="flex items-center gap-1 text-sm font-medium">
              <MapPin className="w-4 h-4 text-[#e8d2b2]" />
              {exp.location}
            </div>
          </div>
        </div>

        <div className="p-6 flex flex-col flex-grow bg-white">
          <h3 className="text-2xl font-serif text-[#4d3d33]">{exp.name}</h3>
          <p className="mt-3 text-sm text-[#6b625a] leading-relaxed flex-grow line-clamp-3">
            {exp.description}
          </p>

          <div className="mt-6 pt-5 border-t border-[#f4f1ec] flex items-center text-sm">
            <div className="flex items-center gap-1.5 text-[#7a6a5f]">
              <Users className="w-4 h-4" />
              <span>Small Groups</span>
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <LinkWithLoader
              href={`/experiences/${exp.slug}`}
              className="flex-1"
            >
              <button className="w-full rounded-full bg-[#8b6f47] text-white py-3 text-sm font-medium hover:bg-[#7a5f3a] transition-colors shadow-md">
                View Details
              </button>
            </LinkWithLoader>
          </div>
        </div>
      </motion.article>
    );
  };

  return (
    <main className="font-light text-[#2f2f2f] bg-[#f4f1ec] overflow-x-hidden">
      {/* ================== HERO ================== */}
      <section
        ref={heroRef}
        className="relative min-h-screen w-full flex items-center justify-center text-center overflow-hidden"
      >
        <motion.div
          style={{ y }}
          className="absolute inset-0 z-0 pointer-events-none"
        >
          <Image
            src="/background.jpeg"
            alt="Crete landscape"
            fill
            priority
            className="object-cover object-center brightness-[.55]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/25 to-transparent" />
        </motion.div>

        <div className="relative z-10 px-6 max-w-3xl space-y-8">
          <motion.p
            className="text-xs tracking-[0.35em] uppercase text-[#eddcb9]"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9 }}
          >
            CRETE • AGROTOURISM • WELLNESS
          </motion.p>
          <motion.h1
            className="text-4xl sm:text-5xl md:text-6xl font-serif text-white leading-tight tracking-tight drop-shadow-xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
          >
            Agrotourism & Wellness
            <br />
            <span className="text-[#e8d2b2] font-normal">Rooted in Crete</span>
          </motion.h1>
          <motion.p
            className="text-white/95 text-lg md:text-xl max-w-xl mx-auto drop-shadow"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 1 }}
          >
            Curated rituals and nature-immersive journeys to slow down, soften,
            and reconnect with what truly matters.
          </motion.p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-4">
            <LinkWithLoader href="/experiences">
              <motion.button
                className="bg-[#e8d2b2] text-[#4d3d33] px-8 py-3.5 rounded-full text-base sm:text-lg font-medium shadow-md hover:bg-[#f2dfc5] transition-all"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.8 }}
              >
                Discover Experiences
              </motion.button>
            </LinkWithLoader>
            <LinkWithLoader href="/about">
              <motion.button
                className="border border-white/65 bg-white/10 text-white px-6 py-3 rounded-full text-sm sm:text-base hover:bg-white/20 transition-all"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.8 }}
              >
                Our Story
              </motion.button>
            </LinkWithLoader>
          </div>

          <motion.div
            className="mt-10 flex flex-col items-center gap-2 text-white/70 text-xs uppercase tracking-[0.25em]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
          >
            <span>Scroll to begin</span>
            <div className="h-9 w-[1px] bg-white/40 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-9 bg-gradient-to-b from-white via-transparent to-transparent animate-pulse" />
            </div>
          </motion.div>
        </div>

        {/* --- BLURRY FADE TRANSITION --- */}
        <div className="absolute bottom-0 inset-x-0 h-56 z-10 pointer-events-none select-none">
          {/* Progressive blur mask */}
          <div className="absolute inset-0 backdrop-blur-[12px] [-webkit-mask-image:linear-gradient(to_top,black_10%,transparent_100%)] [mask-image:linear-gradient(to_top,black_10%,transparent_100%)]" />
          {/* Color gradient matching the next section's background (#f4f1ec) */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#f4f1ec] via-[#f4f1ec]/60 to-transparent" />
        </div>
      </section>

      {/* ================== SIGNATURE EXPERIENCES (DYNAMIC) ================== */}
      <section className="relative z-10 pt-16 pb-32 px-6 bg-[#f4f1ec]">
        <div className="max-w-7xl mx-auto relative">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-16">
            <SectionHeading
              eyebrow="The Portfolio"
              title="Signature Experiences"
              subtitle="Handpicked journeys that honor the rhythm of Cretan life. From private heritage kitchens to botanical alchemy in the White Mountains."
            />
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex gap-4"
            >
              <LinkWithLoader
                href="/experiences"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#8b6f47] hover:text-[#5a4a3f] transition-colors border-b border-transparent hover:border-[#5a4a3f] pb-1"
              >
                View all experiences →
              </LinkWithLoader>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <SkeletonCard key={idx} index={idx} />
              ))
            ) : experiences.length > 0 ? (
              experiences.map((exp, idx) => (
                <ExperienceCard key={exp.id} exp={exp} index={idx} />
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full text-center text-[#6b625a] py-10"
              >
                Experiences are currently being updated. Please check back
                shortly.
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* ================== THE OASIS PHILOSOPHY ================== */}
      <section className="relative z-20 py-32 px-6 bg-[#faf9f7] rounded-t-[3rem] lg:rounded-t-[5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.03)] -mt-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <SectionHeading
                eyebrow="Our Promise"
                title="The Art of Cretan Filoxenia"
                subtitle="We don’t offer tours. We offer rooted experiences that breathe. Every detail of your journey is orchestrated with intention, safety, and a deep respect for the local community."
              />

              <div className="grid sm:grid-cols-2 gap-8 pt-6">
                {[
                  {
                    title: "Intentionally Small",
                    desc: "Groups are capped at 8 guests to ensure the land and conversations can breathe.",
                  },
                  {
                    title: "Bespoke & Seamless",
                    desc: "From dietary customization to premium door-to-door transport in our private vans.",
                  },
                  {
                    title: "Leave No Trace",
                    desc: "Strict environmental ethos. We forage gently and leave our landscapes exactly as we found them.",
                  },
                  {
                    title: "Safety First",
                    desc: "Trained guides equipped with first-aid, adapting to the weather and your physical rhythm.",
                  },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.6, delay: i * 0.15 }}
                    className="space-y-2 border-l-2 border-[#eadfce] pl-4"
                  >
                    <h4 className="text-sm font-bold tracking-widest uppercase text-[#8b6f47]">
                      {item.title}
                    </h4>
                    <p className="text-sm text-[#6b625a] leading-relaxed">
                      {item.desc}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="relative h-[600px] rounded-3xl overflow-hidden shadow-2xl border border-[#eadfce]"
            >
              <Image
                src="/olives.jpeg"
                alt="A long table lunch in Crete"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/20" />
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="absolute bottom-8 left-8 right-8 bg-white/95 backdrop-blur p-6 rounded-2xl shadow-lg"
              >
                <p className="text-[#4d3d33] italic font-serif text-lg leading-snug">
                  "Mornings begin with soft light over the hills, the smell of
                  mountain herbs, and fresh bread. Days are spent between olive
                  groves, the kitchen, the sea, and stillness."
                </p>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ================== WAYS TO EXPERIENCE ================== */}
      <section className="relative z-10 py-32 px-6 bg-gradient-to-b from-[#faf9f7] to-[#f4f1ec]">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            eyebrow="Ways to arrive"
            title="How will you join us?"
            subtitle="Whether you're seeking a private gathering in your villa or wish to join a curated retreat."
            center
          />

          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Curated */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="bg-white p-10 rounded-3xl border border-[#e8e2d8] shadow-sm hover:shadow-2xl transition-all duration-500 group flex flex-col"
            >
              <div className="w-14 h-14 bg-[#f7f2ea] rounded-full flex items-center justify-center mb-8 text-[#8b6f47] group-hover:scale-110 group-hover:bg-[#8b6f47] group-hover:text-white transition-all duration-500">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-serif text-[#4d3d33]">
                Signature Journeys
              </h3>
              <p className="mt-4 text-[#6b625a] text-sm leading-relaxed flex-grow">
                Join our small-group experiences. Ideal for solo travelers and
                couples looking to share a table and stories.
              </p>
              <LinkWithLoader
                href="/experiences"
                className="mt-8 text-sm font-medium text-[#8b6f47] uppercase tracking-wider flex items-center gap-2 group-hover:text-[#5a4a3f] transition-colors w-fit"
              >
                Explore{" "}
                <span className="text-lg transform group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </LinkWithLoader>
            </motion.div>

            {/* Private */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
              className="bg-[#4d3d33] text-white p-10 rounded-3xl shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group flex flex-col relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full pointer-events-none" />
              <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center mb-8 text-[#e8d2b2] group-hover:scale-110 group-hover:bg-[#e8d2b2] group-hover:text-[#4d3d33] transition-all duration-500">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-serif text-white">
                Private & In-Villa
              </h3>
              <p className="mt-4 text-white/80 text-sm leading-relaxed flex-grow relative z-10">
                From our "In-Villa Chef's Table" to private bookings of our
                signature tours. Tailored exclusively to your group.
              </p>
              <LinkWithLoader
                href="/private"
                className="mt-8 text-sm font-medium text-[#e8d2b2] uppercase tracking-wider flex items-center gap-2 group-hover:text-white transition-colors relative z-10 w-fit"
              >
                Request Private{" "}
                <span className="text-lg transform group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </LinkWithLoader>
            </motion.div>

            {/* Clarity Call */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
              className="bg-white p-10 rounded-3xl border border-[#e8e2d8] shadow-sm hover:shadow-2xl transition-all duration-500 group flex flex-col"
            >
              <div className="w-14 h-14 bg-[#f7f2ea] rounded-full flex items-center justify-center mb-8 text-[#8b6f47] group-hover:scale-110 group-hover:bg-[#8b6f47] group-hover:text-white transition-all duration-500">
                <PhoneCall className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-serif text-[#4d3d33]">
                Clarity Call
              </h3>
              <p className="mt-4 text-[#6b625a] text-sm leading-relaxed flex-grow">
                Not sure what fits yet? Let's talk through ideas, timing, and
                what you're hoping this will feel like.
              </p>
              <LinkWithLoader
                href="/contact"
                className="mt-8 text-sm font-medium text-[#8b6f47] uppercase tracking-wider flex items-center gap-2 group-hover:text-[#5a4a3f] transition-colors w-fit"
              >
                Schedule{" "}
                <span className="text-lg transform group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </LinkWithLoader>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ================== CTA ================== */}
      <section className="relative z-20 bg-[#8b6f47] py-32 px-6 text-center overflow-hidden rounded-t-[3rem] lg:rounded-t-[5rem] -mt-10">
        <div className="absolute inset-0 opacity-10 bg-[url('/pattern.png')] bg-repeat" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="max-w-2xl mx-auto relative z-10 text-white space-y-8"
        >
          <h2 className="text-4xl md:text-5xl font-serif leading-tight">
            Ready to slow down?
          </h2>
          <p className="text-white/85 text-lg leading-relaxed">
            Secure your spot in one of our upcoming small-group experiences, or
            reach out to craft your private journey through the heart of Crete.
          </p>
          <div className="flex justify-center gap-4 pt-4">
            <LinkWithLoader href="/experiences">
              <button className="bg-white text-[#4d3d33] px-10 py-4 rounded-full font-medium hover:bg-[#f4f1ec] hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                Book Your Experience
              </button>
            </LinkWithLoader>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
