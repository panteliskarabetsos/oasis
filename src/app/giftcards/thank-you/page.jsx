"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Gift, Mail, XCircle } from "lucide-react";

/**
 * Where a gift card buyer lands after paying.
 *
 * They followed a payment link from an email, so they are not signed in and
 * are not an admin — Stripe cannot return them to the admin list the way it
 * does when a member of staff pays at the desk.
 *
 * It deliberately promises nothing about the card itself beyond "it is on its
 * way": the card is created by the Stripe webhook, which may land a moment
 * after this page does.
 */
function ThankYou() {
  const qs = useSearchParams();
  const cancelled = qs?.get("cancelled") === "1";

  return (
    <main className="min-h-screen bg-[#f4f1ec] font-sans">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 py-20 text-center">
        <div
          className={`mb-6 flex h-16 w-16 items-center justify-center rounded-full border ${
            cancelled
              ? "border-[#f2dada] bg-[#fffafa] text-[#b14545]"
              : "border-emerald-200 bg-emerald-50 text-emerald-600"
          }`}
        >
          {cancelled ? <XCircle size={30} /> : <CheckCircle2 size={30} />}
        </div>

        <h1 className="font-serif text-3xl leading-tight text-[#3a2f28] sm:text-4xl">
          {cancelled ? "Payment cancelled" : "Thank you"}
        </h1>

        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[#7a6a5f]">
          {cancelled ? (
            <>
              Nothing has been charged. The payment link in your email still
              works if you would like to try again.
            </>
          ) : (
            <>
              Your payment went through. The gift card is on its way to your
              inbox — it usually arrives within a minute.
            </>
          )}
        </p>

        {!cancelled && (
          <div className="mt-8 w-full rounded-2xl border border-[#e2d7c7] bg-white p-5 text-left">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#a7988a]">
              <Gift size={13} /> What happens next
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[#5a4a3f]">
              <li className="flex items-start gap-2">
                <Mail size={15} className="mt-0.5 shrink-0 text-[#8b6f47]" />
                An email with the gift card code, to the address you paid with.
              </li>
              <li className="flex items-start gap-2">
                <Gift size={15} className="mt-0.5 shrink-0 text-[#8b6f47]" />
                The code can be used against any booking, in one go or across
                several.
              </li>
            </ul>
          </div>
        )}

        <Link
          href="/experiences"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-[#1A1A1A] px-6 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-white transition-colors hover:bg-[#8b6f47]"
        >
          Browse experiences
        </Link>
      </div>
    </main>
  );
}

export default function Page() {
  // useSearchParams needs a boundary, or the whole route opts out of static
  // rendering and Next complains at build time.
  return (
    <Suspense fallback={null}>
      <ThankYou />
    </Suspense>
  );
}
