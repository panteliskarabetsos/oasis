"use client";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import LinkWithLoader from "./components/LinkWithLoader";

export default function Home() {
  // --- Hero parallax (unchanged) ---
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);

  // --- Featured experiences data ---
  const [experiences, setExperiences] = useState([]);
  const [loadingExp, setLoadingExp] = useState(true);

  useEffect(() => {
    const fetchExperiences = async () => {
      try {
        const res = await fetch("/api/experiences", { cache: "no-store" });
        const data = await res.json();
        setExperiences(Array.isArray(data) ? data.slice(0, 6) : []);
      } catch (error) {
        console.error("Failed to load experiences", error);
      } finally {
        setLoadingExp(false);
      }
    };
    fetchExperiences();
  }, []);

  // Small helpers
  const SectionHeading = ({ eyebrow, title, subtitle, center = false }) => (
    <div
      className={`max-w-3xl ${center ? "mx-auto text-center" : ""} space-y-3`}
    >
      {eyebrow && (
        <p className="text-xs tracking-[0.2em] uppercase text-[#8b6f47]/80">
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl md:text-5xl font-serif text-[#5a4a3f] leading-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="text-lg md:text-xl text-[#4a4a4a] leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );

  const ExperienceCard = ({ exp }) => {
    const cover =
      Array.isArray(exp.images) &&
      typeof exp.images[0] === "string" &&
      (exp.images[0].startsWith("http") || exp.images[0].startsWith("/"))
        ? exp.images[0]
        : null;

    return (
      <motion.article
        layout
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="group relative rounded-3xl border border-[#e8e2d8] bg-white overflow-hidden shadow-[0_6px_24px_rgba(60,50,39,0.06)] hover:shadow-[0_10px_30px_rgba(60,50,39,0.10)] transition-all"
      >
        <div className="relative h-52 w-full overflow-hidden">
          {cover ? (
            <Image
              src={cover}
              alt={exp.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              priority={false}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-[#f1ede7] text-[#8b6f47] italic">
              No image
            </div>
          )}
          <span className="absolute top-4 left-4 rounded-full bg-white/90 backdrop-blur px-3 py-1 text-xs font-medium text-[#5a4a3f] shadow">
            {exp.duration}
          </span>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div>
            <h3 className="text-xl font-serif text-[#5a4a3f]">{exp.name}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-[#6b625a]">
              {exp.description}
            </p>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex flex-col">
              <span className="text-[#8b6f47] font-medium">€{exp.price}</span>
              <span className="text-[#7a6a5f]">{exp.location}</span>
            </div>
            {Array.isArray(exp.frequency) && exp.frequency.length > 0 && (
              <span className="rounded-full bg-[#f5efe7] border border-[#eadfce] px-3 py-1 text-[11px] text-[#5a4a3f]">
                {exp.frequency.join(" • ")}
              </span>
            )}
          </div>

          <div className="mt-1 flex gap-2">
            <LinkWithLoader
              href={`/check-availability/${exp.slug}`}
              className="flex-1"
            >
              <button className="w-full rounded-full bg-[#8b6f47] text-white py-2.5 text-sm font-medium hover:bg-[#a78b62] transition-colors">
                Check Availability
              </button>
            </LinkWithLoader>
            <LinkWithLoader href={`/experiences/${exp.slug}`}>
              <button className="rounded-full border border-[#e0dcd4] bg-white px-4 py-2.5 text-sm text-[#5a4a3f] hover:bg-[#faf7f1]">
                Details
              </button>
            </LinkWithLoader>
          </div>
        </div>
      </motion.article>
    );
  };

  const SkeletonCard = () => (
    <div className="animate-pulse rounded-3xl border border-[#ede6da] bg-white overflow-hidden">
      <div className="h-52 w-full bg-[#f0ece5]" />
      <div className="p-6 space-y-4">
        <div className="h-6 bg-[#f0ece5] rounded w-2/3" />
        <div className="h-4 bg-[#f0ece5] rounded w-full" />
        <div className="h-4 bg-[#f0ece5] rounded w-5/6" />
        <div className="h-10 bg-[#f0ece5] rounded w-full" />
      </div>
    </div>
  );

  return (
    <main className="font-light text-[#2f2f2f] bg-[#f4f1ec]">
      {/* ================== HERO (unchanged) ================== */}
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
            className="object-cover object-center brightness-[.5]"
          />
        </motion.div>
        <div className="relative z-10 px-6 max-w-3xl space-y-8">
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
            className="text-white text-lg md:text-xl max-w-xl mx-auto drop-shadow"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 1 }}
          >
            Curated rituals and nature-immersive journeys for your inner peace.
          </motion.p>

          <LinkWithLoader href="/experiences">
            <motion.button
              className="mt-6 bg-[#8b6f47] text-white px-8 py-4 rounded-full text-lg font-medium shadow-md hover:bg-[#a78b62] transition-all"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
            >
              Discover Experiences
            </motion.button>
          </LinkWithLoader>
        </div>
      </section>

      {/* ================== Featured Experiences ================== */}
      <section className="relative py-24 px-6 bg-gradient-to-b from-[#faf9f7] to-[#f4f1ec]">
        <div
          className="absolute inset-x-0 -top-10 mx-auto h-20 w-[90%] blur-2xl opacity-50 pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 50%, #e6dccf 0%, transparent 70%)",
          }}
        />
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            eyebrow="Featured"
            title="Our Signature Experiences"
            subtitle="Handpicked journeys that honor the rhythm of Cretan land and life."
            center
          />

          <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {loadingExp ? (
              Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
            ) : experiences.length > 0 ? (
              experiences
                .slice(0, 3)
                .map((exp) => <ExperienceCard key={exp.id} exp={exp} />)
            ) : (
              <div className="col-span-full text-center text-[#5a4a3f]">
                No experiences available right now.
              </div>
            )}
          </div>

          <div className="mt-10 text-center">
            <Link href="/experiences" className="inline-block">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-[#5a4a3f] border border-[#e0dcd4] hover:bg-[#faf7f1]">
                Browse all experiences →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ================== Essence Section (polished) ================== */}
      <section className="py-24 px-6 bg-[#faf9f7]">
        <motion.div
          className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          {/* Text */}
          <div className="space-y-8">
            <SectionHeading
              title="The Essence of Slow Living"
              subtitle="In the heart of Crete, time flows differently. Wander through olive groves, gather mountain herbs, and rediscover the art of simply being."
            />
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[#4a4a4a]">
              {[
                "Guided herb walks",
                "Olive oil rituals",
                "Forest bathing",
                "Local cooking & tastings",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="inline-grid place-items-center w-6 h-6 rounded-full bg-[#e9e3d9] text-[#8b6f47] text-xs">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/experiences">
              <button className="mt-2 inline-flex items-center gap-2 bg-[#8b6f47] text-white px-6 py-3 rounded-full text-base font-medium hover:bg-[#7a5f3a] transition shadow-md">
                Explore Experiences
              </button>
            </Link>
          </div>

          {/* Image */}
          <motion.div
            className="relative rounded-3xl overflow-hidden shadow-2xl"
            initial={{ scale: 0.96, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <Image
              src="/gorge.jpg"
              alt="Slow Living Crete"
              width={900}
              height={600}
              className="w-full h-auto object-cover"
              priority={false}
            />
            <div className="absolute bottom-4 right-4 rounded-2xl bg-white/85 backdrop-blur px-4 py-2 text-sm text-[#5a4a3f] border border-[#eadfce] shadow">
              Small groups • Eco-friendly
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ================== Sustainability Cards (refined) ================== */}
      <section className="bg-[#faf9f7] py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            eyebrow="Our Approach"
            title="Rooted in Sustainability"
            subtitle="Every journey we offer respects the land, supports local communities, and celebrates tradition."
            center
          />

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Local Partnerships",
                text: "We collaborate with farmers, artisans, and healers to keep traditions alive.",
                icon: "🌾",
              },
              {
                title: "Eco-conscious",
                text: "Low-impact, nature-first experiences designed with care.",
                icon: "🌱",
              },
              {
                title: "Heritage & Culture",
                text: "We honor Crete’s cultural legacy in every experience.",
                icon: "🏺",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                className="relative rounded-3xl bg-white border border-[#e8e2d8] p-8 shadow hover:shadow-lg transition-all"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#efeae2] text-2xl">
                  {item.icon}
                </div>
                <h4 className="text-xl font-serif text-[#5a4a3f]">
                  {item.title}
                </h4>
                <p className="mt-2 text-[#4a4a4a] leading-relaxed">
                  {item.text}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================== Motto ================== */}
      <section className="py-24 px-6 text-center">
        <motion.div
          className="max-w-3xl mx-auto space-y-6"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h4 className="text-2xl md:text-3xl italic font-serif text-[#5a4a3f]">
            “We don’t offer tours. We offer rooted experiences that breathe.”
          </h4>
          <p className="text-md md:text-lg text-[#4a4a4a]">
            Guests leave not only relaxed — but transformed.
          </p>
        </motion.div>
      </section>

      {/* ================== CTA ================== */}
      <section className="relative bg-[#8b6f47] text-white text-center py-20 px-6 overflow-hidden">
        <div
          className="absolute inset-x-0 -top-16 h-32 opacity-30 blur-3xl"
          style={{
            background:
              "radial-gradient(50% 50% at 50% 0%, #ffffff 0%, transparent 70%)",
          }}
        />
        <motion.div
          className="relative max-w-3xl mx-auto space-y-6"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h5 className="text-3xl md:text-4xl font-serif leading-snug">
            Ready to reconnect with yourself and the land?
          </h5>
          <LinkWithLoader href="/experiences">
            <button className="mt-10 bg-white text-[#5a4a3f] px-8 py-4 rounded-full font-medium hover:bg-[#f4f1ec] transition-all">
              Book a Journey
            </button>
          </LinkWithLoader>
        </motion.div>
      </section>

      {/* ================== Testimonials (polished) ================== */}
      <section className="py-24 px-6 bg-[#f9f9f9]">
        <div className="max-w-6xl mx-auto text-center">
          <motion.h3
            className="text-3xl md:text-4xl font-serif text-[#5a4a3f]"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            What Our Guests Say
          </motion.h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 mt-12 max-w-6xl mx-auto">
          {[
            {
              name: "Sophia",
              feedback:
                "An unforgettable experience that allowed me to truly connect with the land and the local community.",
              image: "/guest1.jpeg",
            },
            {
              name: "Oliver",
              feedback:
                "A peaceful retreat surrounded by nature. The wellness sessions were truly transformative.",
              image: "/guest2.jpeg",
            },
            {
              name: "Emily",
              feedback:
                "Everything felt so authentic and rooted in tradition. A truly enriching journey.",
              image: "/guest3.jpeg",
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15, duration: 0.6 }}
              viewport={{ once: true }}
              className="bg-white p-6 rounded-2xl border border-[#e8e2d8] shadow hover:shadow-lg transition-transform hover:-translate-y-1 text-center"
            >
              <Image
                src={item.image}
                alt={item.name}
                width={96}
                height={96}
                className="rounded-full mx-auto mb-3 border-4 border-[#ede7de] shadow"
              />
              <p className="text-[#4a4a4a] italic text-base md:text-lg">
                “{item.feedback}”
              </p>
              <h5 className="mt-3 text-[#5a4a3f] font-semibold">{item.name}</h5>
            </motion.div>
          ))}
        </div>
      </section>
    </main>
  );
}
