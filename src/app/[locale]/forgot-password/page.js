// app/forgot-password/page.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Loader2,
  Mail,
  Shield,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";

// SSR-safe reCAPTCHA (avoids hydration warnings)
const ReCAPTCHA = dynamic(() => import("react-google-recaptcha"), {
  ssr: false,
});

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [token, setToken] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [cooldownSec, setCooldownSec] = useState(0);

  const recaptchaRef = useRef(null);

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";
  const siteKeyMissing = !siteKey && process.env.NODE_ENV !== "production";

  const emailValid = useMemo(() => {
    const v = email.trim();
    // Simple but effective validation
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }, [email]);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = setInterval(() => setCooldownSec((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [cooldownSec]);

  function resetCaptcha() {
    try {
      recaptchaRef.current?.reset();
    } catch {}
    setToken(null);
  }

  async function handleSubmit(e) {
    e?.preventDefault?.();
    setErrorMsg("");

    if (!emailValid) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    if (!token) {
      setErrorMsg("Please complete the reCAPTCHA challenge.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), recaptchaToken: token }),
      });

      if (res.ok) {
        setSubmitted(true);
        setCooldownSec(60); // cooldown before allowing another resend
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(
          err?.message || "Failed to send reset link. Please try again."
        );
        resetCaptcha();
      }
    } catch (err) {
      console.error("Forgot password error:", err);
      setErrorMsg("Something went wrong. Please try again.");
      resetCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (cooldownSec > 0 || isSubmitting) return;
    await handleSubmit();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f4f1ec] via-[#faf9f7] to-[#f4f1ec] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-[#e0dcd4] bg-white shadow-2xl">
        {/* Header */}
        <div className="px-8 pt-7 pb-6 border-b border-[#eee7dd]">
          <div className="flex items-center justify-center gap-2 text-[#8b6f47]">
            <Shield size={18} />
            <span className="text-xs font-medium tracking-wide">
              Account Security
            </span>
          </div>
          <h1 className="mt-3 text-center text-3xl font-serif font-bold text-[#5a4a3f]">
            Forgot Password
          </h1>
          <p className="mt-2 text-center text-sm text-[#6b5e53]">
            Enter your email and we’ll send you a secure reset link.
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-7">
          {submitted ? (
            <div className="space-y-5 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#e0dcd4] bg-[#fff9f0] px-4 py-2 text-[#5a4a3f]">
                <CheckCircle2 className="h-4 w-4 text-[#8b6f47]" />
                <span className="text-sm">
                  If that email exists, we’ve sent a reset link.
                </span>
              </div>

              <div className="rounded-xl border border-[#eee7dd] bg-[#fffdf9] p-4 text-left">
                <p className="text-sm text-[#5a4a3f]">
                  Please check your inbox (and spam folder) for a message with
                  instructions to reset your password.
                </p>
                <p className="mt-2 text-xs text-[#7a6a5f]">
                  Didn’t receive it? You can request another link after the
                  cooldown.
                </p>
              </div>

              <button
                onClick={handleResend}
                disabled={isSubmitting || cooldownSec > 0}
                className={`w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-white transition ${
                  isSubmitting || cooldownSec > 0
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[#8b6f47] hover:bg-[#7a5f3a]"
                }`}
                title={
                  cooldownSec > 0
                    ? `Try again in ${cooldownSec}s`
                    : "Resend reset link"
                }
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Mail className="h-5 w-5" />
                )}
                {cooldownSec > 0
                  ? `Resend in ${cooldownSec}s`
                  : "Resend Reset Link"}
              </button>

              <div className="flex items-center justify-center gap-3 pt-2">
                <a
                  href="/login"
                  className="text-sm text-[#8b6f47] hover:underline"
                >
                  Back to login
                </a>
                <span className="text-[#d8cfc3]">•</span>
                <a
                  href="/register"
                  className="text-sm text-[#8b6f47] hover:underline"
                >
                  Create account
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {errorMsg && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">
                  <AlertCircle className="h-5 w-5 mt-0.5" />
                  <p className="text-sm">{errorMsg}</p>
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-[#5a4a3f]"
                >
                  Email address
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-lg border border-[#d8cfc3] bg-white p-4 pr-11 text-[#5a4a3f] outline-none ring-0 transition focus:border-[#b9ad9b] focus:ring-2 focus:ring-[#c9b79c]"
                    aria-invalid={!emailValid && email.length > 0}
                    aria-describedby="email-help"
                  />
                  <Mail className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#b9ad9b]" />
                </div>
                <p id="email-help" className="mt-2 text-xs text-[#7a6a5f]">
                  We’ll only use this to send your reset link.
                </p>
              </div>

              <div className="flex justify-center">
                {siteKeyMissing ? (
                  <div className="rounded-lg border border-[#e0dcd4] bg-[#fffaf4] px-3 py-2 text-xs text-[#8b6f47]">
                    reCAPTCHA site key missing (dev only). Set{" "}
                    <code className="rounded bg-[#f4f1ec] px-1 py-0.5">
                      NEXT_PUBLIC_RECAPTCHA_SITE_KEY
                    </code>
                    .
                  </div>
                ) : (
                  <ReCAPTCHA
                    ref={recaptchaRef}
                    sitekey={siteKey}
                    onChange={(t) => setToken(t)}
                    theme="light"
                  />
                )}
              </div>

              <button
                type="submit"
                disabled={
                  isSubmitting || !emailValid || !token || siteKeyMissing
                }
                className={`w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-white transition ${
                  isSubmitting || !emailValid || !token || siteKeyMissing
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[#8b6f47] hover:bg-[#7a5f3a]"
                }`}
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Shield className="h-5 w-5" />
                )}
                Send Reset Link
              </button>

              <div className="flex items-center justify-center gap-3">
                <a
                  href="/login"
                  className="text-sm text-[#8b6f47] hover:underline"
                >
                  Back to login
                </a>
                <span className="text-[#d8cfc3]">•</span>
                <a
                  href="/sign-up"
                  className="text-sm text-[#8b6f47] hover:underline"
                >
                  Create account
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
