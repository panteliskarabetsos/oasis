"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Heart, ArrowRight } from "lucide-react";

export default function GoodbyePage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/");
    }, 8000); // redirect after ~8 seconds

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f6f1] via-[#f4f1ec] to-[#fdfaf5] flex items-center justify-center px-4 py-10">
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 -left-10 h-52 w-52 rounded-full bg-[#f0e4d4] opacity-50 blur-3xl" />
        <div className="absolute -bottom-32 right-[-5%] h-64 w-64 rounded-full bg-[#e3d4bf] opacity-40 blur-3xl" />
      </div>

      <div className="w-full max-w-lg rounded-3xl border border-[#e5ddd1] bg-white/90 px-8 py-10 text-center shadow-[0_18px_45px_rgba(15,23,42,0.18)] backdrop-blur-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f3e3cf] text-[#8b6f47]">
          <Heart className="h-6 w-6" />
        </div>

        <h1 className="text-3xl font-serif text-[#5a4a3f] mb-3">
          Goodbye for now
        </h1>

        <p className="text-sm sm:text-base text-[#5a4a3f] mb-3">
          Your account has been successfully deleted.
        </p>

        <p className="text-xs sm:text-sm text-[#7a6a5f] mb-4">
          Thank you for spending time with us. If you decide to return in the
          future, our door will always be open.
        </p>

        {/* Redirect info + subtle “progress” */}
        <div className="mt-4 mb-2">
          <p className="text-xs text-[#9a8a7e]">
            You&apos;ll be redirected to the homepage shortly.
          </p>
          <div className="mt-3 flex justify-center">
            <div className="h-1.5 w-32 rounded-full bg-[#efe3d2] overflow-hidden">
              <div className="h-full w-full bg-[#8b6f47] animate-pulse" />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center justify-center rounded-full bg-[#8b6f47] px-6 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#7a5f3a]"
          >
            Go to homepage
            <ArrowRight className="ml-2 h-4 w-4" />
          </button>
        </div>

        {/* Support copy */}
        <div className="mt-6 border-t border-[#efe6da] pt-4">
          <p className="text-xs text-[#7a6a5f]">
            If you changed your mind or need help with anything, you can always
            reach out to us.
          </p>
          <a
            href="/support"
            className="mt-2 inline-block text-xs font-medium text-[#8b6f47] underline-offset-2 hover:underline hover:text-[#7a5f3a]"
          >
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}
