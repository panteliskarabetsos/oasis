"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const RouteLoaderContext = createContext({
  triggerRouteChange: () => {},
  isLoading: false,
});

const LOADER_TIPS = [
  "Steeping mountain herbs and warming the kettle…",
  "Checking small-group availability with our local hosts…",
  "Aligning dates with the slow rhythm of the island…",
  "Preparing land, table and time for your arrival…",
];

/* ----------------------- Olive branch logo (drawn) ---------------------- */

const draw = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: (i = 1) => ({
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 0.9, delay: 0.12 * i, ease: "easeInOut" },
      opacity: { duration: 0.3, delay: 0.12 * i },
    },
  }),
};

function OliveBranchIcon() {
  return (
    <motion.svg
      viewBox="0 0 64 64"
      className="h-9 w-9 text-[#e8d2b2]"
      initial="hidden"
      animate="visible"
      aria-hidden="true"
    >
      {/* Outer circle */}
      <motion.circle
        cx="32"
        cy="32"
        r="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={draw}
        custom={0}
      />

      <motion.g
        initial={{ rotate: 0 }}
        animate={{ rotate: [-1.2, 1.2, -1.2] }}
        transition={{ repeat: Infinity, duration: 3.4, ease: "easeInOut" }}
      >
        {/* Main stem */}
        <motion.path
          d="M30 44 C 31 39, 32.5 34, 34.5 28 C 36 24, 37.8 21.5, 39.5 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          variants={draw}
          custom={1}
        />

        {/* Left leaf */}
        <motion.path
          d="M28 34 C 24 31.5, 22.5 28.5, 24 26.5 C 25.7 24.5, 29 24.8, 31.5 27"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          variants={draw}
          custom={2}
        />

        {/* Lower right leaf */}
        <motion.path
          d="M32 34 C 35 31.5, 38.2 30.5, 40.5 31.5 C 42.8 32.6, 43.7 35.2, 42 37"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          variants={draw}
          custom={3}
        />

        {/* Upper right leaf */}
        <motion.path
          d="M34 26 C 37 23.5, 40 21.5, 42.2 21 C 44.4 20.6, 46.5 21.6, 47.7 23.6 
             C 48.9 25.6, 48.4 27.9, 46.9 29.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          variants={draw}
          custom={4}
        />

        {/* Olive */}
        <motion.ellipse
          cx="28"
          cy="42"
          rx="3.4"
          ry="5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ opacity: 0, pathLength: 0 }}
          animate={{ opacity: 1, pathLength: 1 }}
          transition={{ duration: 0.7, delay: 0.7, ease: "easeInOut" }}
        />
      </motion.g>
    </motion.svg>
  );
}

/* -------------------------- Loader overlay UI --------------------------- */

function RouteLoaderOverlay({ tip }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      role="status"
      aria-live="polite"
    >
      {/* Background: image + subtle radial glow + vignette */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center bg-fixed brightness-[.55]"
          style={{ backgroundImage: "url(/background.jpeg)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/55 to-black/80" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(248,237,214,0.22),_transparent_60%)]" />
      </div>

      {/* Foreground card */}
      <motion.div
        className="relative z-10 w-full px-6 sm:px-8"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="mx-auto max-w-xl rounded-3xl border border-white/15 bg-black/35 px-6 py-7 sm:px-9 sm:py-9 backdrop-blur-xl shadow-[0_22px_80px_rgba(0,0,0,0.85)]">
          {/* Logo + eyebrow */}
          <div className="flex flex-col items-center gap-3 sm:gap-4">
            <motion.div
              className="relative flex items-center justify-center rounded-full bg-white/5 p-3 sm:p-3.5"
              initial={{ opacity: 0, scale: 0.9, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              {/* Ambient ring */}
              <motion.div
                className="absolute inset-0 rounded-full border border-white/35"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.2, 0.5, 0.2] }}
                transition={{
                  repeat: Infinity,
                  duration: 2.8,
                  ease: "easeInOut",
                }}
              />
              <motion.div
                className="relative"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{
                  repeat: Infinity,
                  duration: 3,
                  ease: "easeInOut",
                }}
              >
                <OliveBranchIcon />
              </motion.div>
            </motion.div>

            <motion.p
              className="text-[0.62rem] sm:text-[0.7rem] tracking-[0.3em] uppercase text-[#eddcb9]/90"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
            >
              Crete · Agrotourism · Wellness
            </motion.p>
          </div>

          {/* OASIS wordmark-style heading */}
          <motion.div
            className="mt-5 space-y-3 text-center sm:mt-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h1
              className="
                font-serif 
                uppercase
                text-[#c8a467]
                text-[2rem] sm:text-[2.4rem] md:text-[2.8rem]
                tracking-[0.55em]
                leading-[1.2]
                drop-shadow-[0_0_18px_rgba(0,0,0,0.65)]
              "
            >
              <span className="inline-block">OASIS</span>
            </h1>

            <p className="text-[0.8rem] sm:text-[0.9rem] md:text-base text-white/90 max-w-md mx-auto leading-relaxed">
              Agrotourism &amp; wellness rooted in Crete. We&apos;re gently
              preparing your next page so your journey stays as smooth and
              unhurried as your time on the island.
            </p>
          </motion.div>

          {/* Progress bar + label – refined to match wordmark */}
          <motion.div
            className="mt-6 space-y-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <div className="flex flex-col items-center gap-1 text-[0.65rem] sm:text-[0.7rem] uppercase tracking-[0.2em] text-white/60">
              <span className="font-medium">Preparing your oasis</span>
            </div>

            {/* Slim, centered bar */}
            <div className="relative mt-1 h-[2px] w-40 sm:w-52 mx-auto overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="absolute inset-y-0 left-0 w-1/2 origin-left rounded-full bg-gradient-to-r from-[#947747] via-[#d4b276] to-transparent"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: [0, 1.1, 0.5, 1.05] }}
                transition={{
                  repeat: Infinity,
                  duration: 1.8,
                  ease: "easeInOut",
                }}
              />
            </div>
          </motion.div>

          {/* Tip */}
          <motion.div
            className="mt-5"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.35, delay: 0.1 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-white/7 px-3 py-1 text-[0.7rem] sm:text-[0.75rem] text-[#f2e3c7]">
              <span className="rounded-full bg-[#f6dcb0]/15 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[#f6dcb0]">
                Tip
              </span>
              <span className="leading-relaxed">{tip}</span>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ----------------------------- Route loader ----------------------------- */

export function useRouteLoader() {
  return useContext(RouteLoaderContext);
}

export function RouteLoader({ children }) {
  const [isLoading, setIsLoading] = useState(false);
  const [nextPath, setNextPath] = useState(null);
  const [tipIndex, setTipIndex] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (!nextPath) return;

    setIsLoading(true);
    setTipIndex((prev) => (prev + 1) % LOADER_TIPS.length);

    const timeout = setTimeout(() => {
      router.push(nextPath);
      setIsLoading(false);
      setNextPath(null);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [nextPath, router]);

  const triggerRouteChange = (to) => {
    if (!to) return;
    setNextPath(to);
  };

  return (
    <RouteLoaderContext.Provider value={{ triggerRouteChange, isLoading }}>
      <AnimatePresence mode="wait">
        {isLoading && <RouteLoaderOverlay tip={LOADER_TIPS[tipIndex]} />}
      </AnimatePresence>

      {children}
    </RouteLoaderContext.Provider>
  );
}
