"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Check,
  Calendar,
  Mail,
  MapPin,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    // Call the verification API we created earlier
    fetch(`/api/booking/verify-session?session_id=${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Verification failed");
        return res.json();
      })
      .then((json) => {
        setData(json);
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fdfcfb]">
        <Loader2 className="animate-spin text-[#8b6f47] mb-4" size={32} />
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#a09084]">
          Securing your reservation...
        </p>
      </div>
    );
  }

  if (error || !sessionId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fdfcfb] px-6 text-center">
        <h1 className="text-2xl font-serif mb-4">Something went wrong</h1>
        <p className="text-sm text-[#7a6a5f] mb-8">
          We couldn't verify your session, but your booking might still be safe.
        </p>
        <Link
          href="/"
          className="px-8 py-3 rounded-full bg-[#1a1a1a] text-white text-[11px] font-bold uppercase tracking-widest"
        >
          Return Home
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#fdfcfb] text-[#3f3127] px-6 py-20 flex flex-col items-center relative overflow-hidden">
      {/* Background Polish */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(139,111,71,0.03)_0%,transparent_70%)] pointer-events-none" />

      <div className="max-w-2xl w-full relative z-10">
        {/* Animated Checkmark */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 15, stiffness: 100 }}
          className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm border border-[#e3ddd2] mx-auto mb-10"
        >
          <Check className="text-[#8b6f47]" size={32} strokeWidth={1.5} />
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-serif mb-6 leading-tight">
            Your space is <span className="italic text-[#8b6f47]">secured</span>
            .
          </h1>
          <p className="text-lg font-light text-[#7a6a5f] leading-relaxed">
            Thank you, {data?.customerName || "Guest"}. Your reservation is
            confirmed. Prepare to experience Crete at a slower pace.
          </p>
        </motion.div>

        {/* The Receipt / Info Card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="bg-white rounded-[2.5rem] border border-[#e3ddd2] p-8 md:p-12 shadow-sm mb-12"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a09084] block mb-2">
                  Experience
                </span>
                <p className="text-xl font-serif">
                  {data?.experienceName || "Custom Oasis Experience"}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a09084] block mb-2">
                  Date
                </span>
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-[#8b6f47]" />
                  <span className="text-sm font-medium">
                    {data?.date
                      ? format(new Date(data.date), "MMMM do, yyyy")
                      : "Date as per request"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-6 md:border-l md:border-[#f4f1ec] md:pl-10">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a09084] block mb-2">
                  Reference
                </span>
                <p className="font-mono text-sm font-bold text-[#8b6f47]">
                  {data?.bookingCode}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a09084] block mb-2">
                  Payment
                </span>
                <p className="text-sm font-medium">
                  {new Intl.NumberFormat("en-GB", {
                    style: "currency",
                    currency: data?.currency || "EUR",
                  }).format(data?.amount || 0)}{" "}
                  Received
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Footer Actions */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/"
            className="w-full sm:w-auto px-10 py-4 rounded-full bg-[#1a1a1a] text-white text-[11px] font-bold uppercase tracking-widest hover:bg-black transition-all text-center"
          >
            Return Home
          </Link>
          <Link
            href="/experiences"
            className="w-full sm:w-auto px-10 py-4 rounded-full border border-black/10 text-[11px] font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all text-center flex items-center justify-center gap-2"
          >
            Explore More <ArrowRight size={14} />
          </Link>
        </motion.div>
      </div>
    </main>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fdfcfb]">
          <Loader2 className="animate-spin text-[#8b6f47]" size={32} />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
