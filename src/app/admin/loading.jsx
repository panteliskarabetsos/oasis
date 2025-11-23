"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

// Put your logo file at /public/logo/oasis-logo.svg (or update the path below)
const LOGO_SRC = "/brand/oasis.svg";

export default function Loading() {
  const [phase, setPhase] = useState(0); // 0..n timed hints
  const prefersReduced = useReducedMotion();

  // Gentle timed status messages so the screen feels alive on slow networks
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1200);
    const t2 = setTimeout(() => setPhase(2), 3500);
    const t3 = setTimeout(() => setPhase(3), 7000);
    const t4 = setTimeout(() => setPhase(4), 10000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  const hint = useMemo(() => {
    switch (phase) {
      case 1:
        return "Preparing dashboard…";
      case 2:
        return "Checking your session…";
      case 3:
        return "Optimizing layout for your device…";
      case 4:
        return "Still loading — almost there…";
      default:
        return "Loading";
    }
  }, [phase]);

  // Map phase to a smooth indeterminate progress value
  const progress = useMemo(() => {
    switch (phase) {
      case 0:
        return 0.18;
      case 1:
        return 0.42;
      case 2:
        return 0.68;
      case 3:
        return 0.86;
      case 4:
        return 0.95;
      default:
        return 0.98;
    }
  }, [phase]);

  return (
    <div
      className="relative min-h-screen grid place-items-center bg-[#f4f1ec] text-[#5a4a3f] overflow-hidden"
      aria-busy
      aria-live="polite"
    >
      {/* Ambient gradients */}
      {!prefersReduced && (
        <>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -top-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-[#e9e4dc] blur-3xl opacity-70"
            animate={{ y: [0, 20, -10, 0], scale: [1, 1.05, 1.02, 1] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -bottom-40 -right-24 h-[32rem] w-[32rem] rounded-full bg-[#fff4e1] blur-3xl opacity-80"
            animate={{ y: [0, -16, 6, 0], scale: [1, 1.04, 1.01, 1] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      )}

      {/* Subtle grain for depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at top left, #e8e2d9 0%, transparent 60%), radial-gradient(ellipse at bottom right, #fff4e1 0%, transparent 55%)",
        }}
      />

      <div className="relative w-[min(92vw,38rem)]">
        {/* Glass card */}
        <div className="relative rounded-3xl border border-[#e8e2d9]/80 bg-white/70 backdrop-blur-xl shadow-[0_10px_40px_rgba(90,74,63,0.12)] p-7 sm:p-8">
          {/* Glow ring */}
          {!prefersReduced && (
            <motion.div
              aria-hidden
              className="absolute -inset-[2px] rounded-3xl"
              style={{
                background:
                  "conic-gradient(from 180deg at 50% 50%, #ffe9c6, #e8e2d9, #ffe0b0, #e8e2d9, #ffe9c6)",
              }}
              initial={{ opacity: 0.25 }}
              animate={{ opacity: [0.25, 0.45, 0.25] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />
          )}

          <div className="relative flex flex-col items-center gap-5">
            <LogoMark prefersReduced={prefersReduced} />

            <div className="flex items-center gap-3" role="status">
              <Spinner reduced={prefersReduced} />
              <span className="text-sm opacity-80">{hint}</span>
            </div>

            {/* Progress bar */}
            <div className="mt-1 w-full">
              <div
                className="h-2 w-full rounded-full bg-[#e8e2d9] overflow-hidden"
                aria-hidden
              >
                {prefersReduced ? (
                  <div
                    style={{ width: `${Math.round(progress * 100)}%` }}
                    className="h-full bg-[#8b6f47]/80"
                  />
                ) : (
                  <motion.div
                    className="h-full bg-[#8b6f47]"
                    initial={{ width: "10%" }}
                    animate={{ width: `${Math.round(progress * 100)}%` }}
                    transition={{ type: "spring", stiffness: 70, damping: 18 }}
                  />
                )}
              </div>
              <p className="sr-only">
                Loading progress approximately {Math.round(progress * 100)}{" "}
                percent
              </p>
            </div>

            {/* Skeleton preview of UI */}
            <div className="mt-4 grid w-full grid-cols-12 gap-3" aria-hidden>
              <div className="col-span-12 h-10 rounded-xl bg-[#eee7dd] animate-pulse" />
              <div className="col-span-7 h-24 rounded-xl bg-[#eee7dd] animate-pulse" />
              <div className="col-span-5 h-24 rounded-xl bg-[#eee7dd] animate-pulse" />
              <div className="col-span-4 h-20 rounded-xl bg-[#eee7dd] animate-pulse" />
              <div className="col-span-4 h-20 rounded-xl bg-[#eee7dd] animate-pulse" />
              <div className="col-span-4 h-20 rounded-xl bg-[#eee7dd] animate-pulse" />
            </div>

            {/* Slow network helper */}
            {phase >= 4 && (
              <div className="mt-3 text-xs text-[#5a4a3f]/70 text-center">
                Taking longer than usual? You can refresh the page or check your
                connection.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LogoMark({ prefersReduced }) {
  return (
    <div className="flex items-center gap-3 select-none">
      <div className="relative h-12 w-12 rounded-2xl shadow-sm overflow-hidden">
        {/* subtle pulse halo */}
        {!prefersReduced && (
          <motion.div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(80% 80% at 50% 50%, rgba(255,228,189,0.8) 0%, rgba(255,228,189,0) 70%)",
            }}
            animate={{ opacity: [0.25, 0.6, 0.25] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <Image
          src={LOGO_SRC}
          alt="Oasis Admin logo"
          fill
          priority
          className="object-contain p-2"
        />
      </div>
      <span className="font-serif text-2xl tracking-tight text-[#5a4a3f]">
        Oasis Admin
      </span>
    </div>
  );
}

function Spinner({ reduced }) {
  if (reduced) {
    return (
      <span
        aria-label="Loading"
        className="h-5 w-5 rounded-full border-2 border-[#8b6f47]"
        style={{ borderRightColor: "transparent", opacity: 0.7 }}
      />
    );
  }
  return (
    <motion.span
      aria-label="Loading"
      className="h-5 w-5 rounded-full border-2 border-[#8b6f47] border-t-transparent"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.85, ease: "linear" }}
    />
  );
}
