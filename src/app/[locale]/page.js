"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
// ⬇️ use i18n-aware Link, NOT next/link
import { Link } from "@/i18n/routing";
import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import LinkWithLoader from "../components/LinkWithLoader";

export default function Home() {
  const t = useTranslations("Home");

  // --- Hero parallax ---
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
        <p className="text-xs tracking-[0.25em] uppercase text-[#8b6f47]/80">
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl md:text-5xl font-serif text-[#4d3d33] leading-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="text-lg md:text-xl text-[#4a4a4a] leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );

  const formatFrequency = (frequencyArray = []) => {
    if (!Array.isArray(frequencyArray) || frequencyArray.length === 0)
      return "";

    const normalize = (s) => s.toString().trim().toLowerCase();

    const weekdayNames = new Set([
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "mon",
      "tue",
      "tues",
      "wed",
      "thu",
      "thur",
      "fri",
    ]);

    const weekendNames = new Set(["saturday", "sunday", "sat", "sun"]);

    const normalized = frequencyArray.map(normalize);

    const allWeekdays =
      normalized.length > 0 && normalized.every((d) => weekdayNames.has(d));

    const allWeekends =
      normalized.length > 0 && normalized.every((d) => weekendNames.has(d));

    if (allWeekdays) return t("experience.frequency.weekdays");
    if (allWeekends) return t("experience.frequency.weekends");

    // fallback: show original labels joined
    return frequencyArray.join(" • ");
  };

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
        whileHover={{ y: -6 }}
        className="group relative rounded-3xl border border-[#e8e2d8] bg-white/95 backdrop-blur-sm overflow-hidden shadow-[0_6px_24px_rgba(60,50,39,0.06)] hover:shadow-[0_14px_36px_rgba(60,50,39,0.14)] transition-all"
      >
        <div className="relative h-56 w-full overflow-hidden">
          {cover ? (
            <Image
              src={cover}
              alt={exp.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105 group-hover:brightness-[1.02]"
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              priority={false}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-[#f1ede7] text-[#8b6f47] italic">
              {t("experience.noImage")}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
          <span className="absolute top-4 left-4 rounded-full bg-white/90 backdrop-blur px-3 py-1 text-xs font-medium text-[#5a4a3f] shadow">
            {exp.duration}
          </span>

          {exp.location && (
            <span className="absolute bottom-4 left-4 rounded-full bg-black/55 text-xs text-white px-3 py-1 shadow-sm">
              {exp.location}
            </span>
          )}
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div>
            <h3 className="text-xl font-serif text-[#4d3d33]">{exp.name}</h3>
            <p className="mt-2 line-clamp-3 text-sm text-[#6b625a]">
              {exp.description}
            </p>
          </div>

          <div className="flex items-center justify-between text-xs mt-1">
            <div className="flex flex-col gap-1 text-[#7a6a5f]">
              <span className="uppercase tracking-[0.2em] text-[10px]">
                {t("experience.badge")}
              </span>
              {Array.isArray(exp.frequency) && exp.frequency.length > 0 && (
                <span className="rounded-full bg-[#f7f2ea] border border-[#eadfce] px-3 py-1 text-[11px] text-[#5a4a3f]">
                  {formatFrequency(exp.frequency)}
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <LinkWithLoader href={`/check-availability/${exp.slug}`}>
              <button className="w-full rounded-full bg-[#8b6f47] text-white py-2.5 text-sm font-medium hover:bg-[#a78b62] transition-colors">
                {t("experience.checkAvailability")}
              </button>
            </LinkWithLoader>
            <LinkWithLoader href={`/experiences/${exp.slug}`}>
              <button className="rounded-full border border-[#e0dcd4] bg-white px-4 py-2.5 text-sm text-[#5a4a3f] hover:bg-[#faf7f1]">
                {t("experience.details")}
              </button>
            </LinkWithLoader>
          </div>
        </div>
      </motion.article>
    );
  };

  const SkeletonCard = () => (
    <div className="animate-pulse rounded-3xl border border-[#ede6da] bg-white/80 overflow-hidden shadow-sm">
      <div className="h-56 w-full bg-[#f0ece5]" />
      <div className="p-6 space-y-4">
        <div className="h-6 bg-[#f0ece5] rounded w-2/3" />
        <div className="h-4 bg-[#f0ece5] rounded w-full" />
        <div className="h-4 bg-[#f0ece5] rounded w-5/6" />
        <div className="h-9 bg-[#f0ece5] rounded w-full" />
      </div>
    </div>
  );

  const steps = [
    {
      step: "01",
      titleKey: "how.steps.1.title",
      textKey: "how.steps.1.text",
    },
    {
      step: "02",
      titleKey: "how.steps.2.title",
      textKey: "how.steps.2.text",
    },
    {
      step: "03",
      titleKey: "how.steps.3.title",
      textKey: "how.steps.3.text",
    },
    {
      step: "04",
      titleKey: "how.steps.4.title",
      textKey: "how.steps.4.text",
    },
  ];

  const testimonials = [
    {
      nameKey: "testimonials.items.1.name",
      textKey: "testimonials.items.1.text",
      image: "/guest1.jpeg",
    },
    {
      nameKey: "testimonials.items.2.name",
      textKey: "testimonials.items.2.text",
      image: "/guest2.jpeg",
    },
    {
      nameKey: "testimonials.items.3.name",
      textKey: "testimonials.items.3.text",
      image: "/guest3.jpeg",
    },
  ];

  return (
    <main className="font-light text-[#2f2f2f] bg-[#f4f1ec]">
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
            {t("hero.eyebrow")}
          </motion.p>
          <motion.h1
            className="text-4xl sm:text-5xl md:text-6xl font-serif text:white text-white leading-tight tracking-tight drop-shadow-xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
          >
            {t("hero.title.line1")}
            <br />
            <span className="text-[#e8d2b2] font-normal">
              {t("hero.title.line2")}
            </span>
          </motion.h1>
          <motion.p
            className="text-white/95 text-lg md:text-xl max-w-xl mx-auto drop-shadow"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 1 }}
          >
            {t("hero.subtitle")}
          </motion.p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-4">
            <LinkWithLoader href="/experiences">
              <motion.button
                className="bg-[#e8d2b2] text-[#4d3d33] px-8 py-3.5 rounded-full text-base sm:text-lg font-medium shadow-md hover:bg-[#f2dfc5] transition-all"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.8 }}
              >
                {t("hero.cta.primary")}
              </motion.button>
            </LinkWithLoader>
            <LinkWithLoader href="/about">
              <motion.button
                className="border border-white/65 bg-white/10 text-white px-6 py-3 rounded-full text-sm sm:text-base hover:bg-white/20 transition-all"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.8 }}
              >
                {t("hero.cta.secondary")}
              </motion.button>
            </LinkWithLoader>
          </div>

          <motion.div
            className="mt-10 flex flex-col items-center gap-2 text-white/70 text-xs uppercase tracking-[0.25em]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
          >
            <span>{t("hero.scrollHint")}</span>
            <div className="h-9 w-[1px] bg-white/40 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-9 bg-gradient-to-b from-white via-transparent to-transparent animate-pulse" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================== Featured Experiences ================== */}
      <section className="relative py-24 px-6 bg-gradient-to-b from-[#faf9f7] via-[#f6f2ec] to-[#f4f1ec]">
        <div
          className="absolute inset-x-0 -top-10 mx-auto h-24 w-[85%] blur-2xl opacity-60 pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 50%, #e6dccf 0%, transparent 70%)",
          }}
        />
        <div className="max-w-7xl mx-auto relative">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <SectionHeading
              eyebrow={t("featured.eyebrow")}
              title={t("featured.title")}
              subtitle={t("featured.subtitle")}
            />
            <p className="max-w-md text-sm text-[#6b625a] md:text-right">
              {t("featured.description")}
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {loadingExp ? (
              Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
            ) : experiences.length > 0 ? (
              experiences
                .slice(0, 3)
                .map((exp) => <ExperienceCard key={exp.id} exp={exp} />)
            ) : (
              <div className="col-span-full text-center text-[#5a4a3f]">
                {t("experience.none")}
              </div>
            )}
          </div>

          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            {/* ⬇️ locale-aware Link */}
            <Link href="/experiences">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-[#5a4a3f] border border-[#e0dcd4] hover:bg-[#faf7f1]">
                {t("featured.browseAll")}
              </span>
            </Link>
            <p className="text-xs text-[#8b7a6b] uppercase tracking-[0.25em]">
              {t("featured.tagline")}
            </p>
          </div>
        </div>
      </section>

      {/* ================== ABOUT / SLOW STAYS ================== */}
      <section className="py-24 px-6 bg-[#faf9f7]">
        <motion.div
          className="max-w-7xl mx-auto grid md:grid-cols-[1.15fr,0.85fr] gap-16 items-center"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          {/* Text */}
          <div className="space-y-7">
            <SectionHeading
              eyebrow={t("about.eyebrow")}
              title={t("about.title")}
              subtitle={t("about.subtitle")}
            />

            <p className="text-sm md:text-base text-[#6b625a] leading-relaxed">
              {t("about.body")}
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-[#eadfce] bg:white/80 bg-white/80 p-4">
                <h4 className="text-sm font-semibold tracking-[0.18em] uppercase text-[#8b6f47]">
                  {t("about.whoWeHost.title")}
                </h4>
                <ul className="mt-3 space-y-1.5 text-sm text-[#4a4a4a]">
                  <li>• {t("about.whoWeHost.item1")}</li>
                  <li>• {t("about.whoWeHost.item2")}</li>
                  <li>• {t("about.whoWeHost.item3")}</li>
                  <li>• {t("about.whoWeHost.item4")}</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-[#eadfce] bg-white/80 p-4">
                <h4 className="text-sm font-semibold tracking-[0.18em] uppercase text-[#8b6f47]">
                  {t("about.whatExpect.title")}
                </h4>
                <ul className="mt-3 space-y-1.5 text-sm text-[#4a4a4a]">
                  <li>• {t("about.whatExpect.item1")}</li>
                  <li>• {t("about.whatExpect.item2")}</li>
                  <li>• {t("about.whatExpect.item3")}</li>
                  <li>• {t("about.whatExpect.item4")}</li>
                </ul>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {[
                "tagSlowTravel",
                "tagSeasonalFood",
                "tagHandsOn",
                "tagIntimateGroups",
              ].map((key) => (
                <span
                  key={key}
                  className="rounded-full border border-[#eadfce] bg-[#f7f2ea] px-3 py-1 text-[11px] tracking-wide uppercase text-[#5a4a3f]"
                >
                  {t(`about.${key}`)}
                </span>
              ))}
            </div>

            {/* ⬇️ locale-aware Link */}
            <Link href="/about">
              <button className="mt-4 inline-flex items-center gap-2 bg-[#8b6f47] text-white px-6 py-3 rounded-full text-sm md:text-base font-medium hover:bg-[#7a5f3a] transition shadow-md">
                {t("about.cta")}
              </button>
            </Link>
          </div>

          {/* Collage Image */}
          <motion.div
            className="relative h-full"
            initial={{ scale: 0.96, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="relative h-full max-h-[520px]">
              <div className="absolute -top-4 -left-4 h-32 w-32 rounded-full bg-[#e6dccf] opacity-40 blur-2xl" />
              <div className="absolute bottom-0 -right-2 h-24 w-24 rounded-full bg-[#d7c7af] opacity-40 blur-2xl" />

              <div className="grid grid-rows-2 gap-4 h-full">
                <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-[#eadfce] min-h-[220px]">
                  <Image
                    src="/gorge.jpg"
                    alt="Walking in Cretan nature"
                    fill
                    className="object-cover"
                    priority={false}
                  />
                </div>
                <div className="grid grid-cols-[1.1fr,0.9fr] gap-4">
                  <div className="relative rounded-3xl overflow-hidden shadow-xl border border-[#eadfce] min-h-[160px]">
                    <Image
                      src="/background.jpeg"
                      alt="Cretan landscape and olive trees"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="rounded-3xl border border-dashed border-[#d6c6b2] bg-[#f7f2ea]/80 p-4 flex flex-col justify-between">
                    <p className="text-xs uppercase tracking-[0.22em] text-[#8b6f47]">
                      {t("about.smallTitle")}
                    </p>
                    <p className="mt-3 text-sm text-[#4a4a4a]">
                      {t("about.smallBody")}
                    </p>
                    <p className="mt-3 text-[11px] text-[#8b7a6b] uppercase tracking-[0.18em]">
                      {t("hero.eyebrow")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ================== HOW YOUR JOURNEY UNFOLDS ================== */}
      <section className="bg-[#f4f1ec] py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            eyebrow={t("how.eyebrow")}
            title={t("how.title")}
            subtitle={t("how.subtitle")}
            center
          />

          <div className="mt-14 grid grid-cols-1 md:grid-cols-4 gap-8">
            {steps.map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                className="relative rounded-3xl bg-white/90 border border-[#e8e2d8] p-6 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs tracking-[0.25em] uppercase text-[#8b6f47]/80">
                    {t("how.stepLabel", { step: index + 1 })}
                  </span>
                  <span className="text-lg font-serif text-[#d0b894]">
                    {item.step}
                  </span>
                </div>
                <h4 className="text-lg font-serif text-[#5a4a3f]">
                  {t(item.titleKey)}
                </h4>
                <p className="mt-2 text-sm text-[#4a4a4a] leading-relaxed">
                  {t(item.textKey)}
                </p>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <LinkWithLoader href="/check-availability">
              <button className="rounded-full bg-[#8b6f47] text:white text-white px-7 py-3 text-sm md:text-base font-medium hover:bg-[#7a5f3a] transition shadow-md">
                {t("how.cta")}
              </button>
            </LinkWithLoader>
            <p className="text-xs text-[#8b7a6b] uppercase tracking-[0.22em]">
              {t("how.tagline")}
            </p>
          </div>
        </div>
      </section>

      {/* ================== Motto ================== */}
      <section className="py-24 px-6 text-center bg-gradient-to-b from-[#faf9f7] to-[#f4f1ec]">
        <motion.div
          className="max-w-3xl mx-auto space-y-6"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h4 className="text-2xl md:text-3xl italic font-serif text-[#5a4a3f]">
            {t("motto.title")}
          </h4>
          <p className="text-md md:text-lg text-[#4a4a4a]">{t("motto.text")}</p>
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
            {t("cta.title")}
          </h5>
          <p className="text-sm md:text-base text-white/85 max-w-xl mx-auto">
            {t("cta.text")}
          </p>
          <LinkWithLoader href="/experiences">
            <button className="mt-8 bg-white text-[#5a4a3f] px-8 py-4 rounded-full font-medium hover:bg-[#f4f1ec] transition-all shadow-md">
              {t("cta.button")}
            </button>
          </LinkWithLoader>
        </motion.div>
      </section>

      {/* ================== Testimonials ================== */}
      <section className="py-24 px-6 bg-[#f9f9f9]">
        <div className="max-w-6xl mx-auto text-center">
          <motion.h3
            className="text-3xl md:text-4xl font-serif text-[#5a4a3f]"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            {t("testimonials.title")}
          </motion.h3>
          <p className="mt-3 text-sm text-[#6b625a] max-w-2xl mx-auto">
            {t("testimonials.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 mt-12 max-w-6xl mx-auto">
          {testimonials.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15, duration: 0.6 }}
              viewport={{ once: true }}
              className="bg-white/95 p-6 rounded-2xl border border-[#e8e2d8] shadow-sm hover:shadow-lg transition-transform hover:-translate-y-1 text-center"
            >
              <Image
                src={item.image}
                alt={t(item.nameKey)}
                width={96}
                height={96}
                className="rounded-full mx-auto mb-3 border-4 border-[#ede7de] shadow"
              />
              <p className="text-[#4a4a4a] italic text-base md:text-lg">
                “{t(item.textKey)}”
              </p>
              <h5 className="mt-3 text-[#5a4a3f] font-semibold">
                {t(item.nameKey)}
              </h5>
            </motion.div>
          ))}
        </div>
      </section>
    </main>
  );
}
