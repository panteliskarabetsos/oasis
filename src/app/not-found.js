"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home, Compass } from "lucide-react";
import { motion } from "framer-motion";

export default function NotFound() {
  const router = useRouter();

  return (
    <main className="min-h-screen w-full bg-[#f4f1ec] relative flex items-center justify-center overflow-hidden selection:bg-[#8b6f47] selection:text-white">
      {/* Massive, ultra-subtle 404 watermark in the background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.03]">
        <span className="text-[15rem] md:text-[25rem] font-serif font-bold text-[#4d3d33] tracking-tighter">
          404
        </span>
      </div>

      <section className="relative z-10 mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="space-y-6 flex flex-col items-center"
        >
          {/* Elegant Icon Badge */}
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#f7f2ea] border border-[#eadfce] text-[#8b6f47] mb-2 shadow-sm">
            <Compass className="w-6 h-6" strokeWidth={1.5} />
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif text-[#4d3d33] leading-tight">
            A quiet detour.
          </h1>

          <p className="max-w-md text-base md:text-lg leading-relaxed text-[#6b625a] font-light">
            It seems you've wandered off the path. The page you are looking for
            has moved or no longer exists.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => router.back()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-[#d6c6b2] bg-transparent px-8 py-3.5 text-sm font-medium text-[#5a4a3f] transition-all duration-300 hover:bg-[#eadfce]/50 hover:border-[#8b6f47]"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
              Go Back
            </button>

            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#8b6f47] px-8 py-3.5 text-sm font-medium text-white shadow-md transition-all duration-300 hover:bg-[#7a5f3a] hover:shadow-xl hover:-translate-y-0.5"
            >
              <Home className="h-4 w-4" strokeWidth={1.5} />
              Return Home
            </Link>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
