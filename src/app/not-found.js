"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home, Mail } from "lucide-react";

export default function NotFound() {
  const router = useRouter();

  return (
    <main className="min-h-screen w-full bg-[#fcf9f4] relative overflow-hidden">
      {/* soft ambient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(60%_40%_at_20%_10%,#f7efe3_0%,transparent_60%),radial-gradient(50%_30%_at_80%_0%,#f0e7da_0%,transparent_55%),radial-gradient(40%_30%_at_50%_100%,#efe6d9_0%,transparent_60%)]"
      />

      <section className="relative mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#e8e5df] bg-white/60 px-3 py-1 text-xs text-[#7a6a58] shadow-sm backdrop-blur">
          <span className="inline-block h-2 w-2 rounded-full bg-[#b44d4d]" />
          404 — Page not found
        </span>

        <h1 className="mt-6 text-6xl font-extrabold tracking-tight text-[#5a4a3f] sm:text-7xl">
          Lost in the dunes
        </h1>
        <p className="mt-4 max-w-prose text-base leading-relaxed text-[#7a6a58]">
          The page you’re looking for doesn’t exist or may have moved. Let’s
          guide you back to familiar ground.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-[#e8e5df] bg-white px-4 py-2 text-sm font-medium text-[#5a4a3f] shadow-sm transition hover:shadow"
          >
            <Home className="h-4 w-4" />
            Go home
          </Link>

          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-2xl border border-[#e8e5df] bg-[#fcf9f4] px-4 py-2 text-sm font-medium text-[#5a4a3f] shadow-sm transition hover:bg-white/70"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </button>

          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-2xl border border-[#e8e5df] bg-white px-4 py-2 text-sm font-medium text-[#5a4a3f] shadow-sm transition hover:shadow"
          >
            <Mail className="h-4 w-4" />
            Contact us
          </Link>
        </div>

        {/* Helpful tips */}
        <ul className="mt-10 grid w-full gap-3 text-left sm:grid-cols-2">
          <li className="rounded-2xl border border-[#e8e5df] bg-white/70 p-4 text-sm text-[#5a4a3f] shadow-sm">
            • Check the URL for typos
          </li>
          <li className="rounded-2xl border border-[#e8e5df] bg-white/70 p-4 text-sm text-[#5a4a3f] shadow-sm">
            • Use the navigation to find what you need
          </li>
        </ul>
      </section>
    </main>
  );
}
