"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReCAPTCHA from "react-google-recaptcha";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import {
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldAlert,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

const FAIL_KEY = "login_fail_meta"; // { count: number, ts: number }
const FAIL_WINDOW_HOURS = 12; // attempts window
const CAPTCHA_AFTER = 3; // threshold

export default function LoginPage() {
  const supabase = createSupabaseBrowser();
  const router = useRouter();

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const [needCaptcha, setNeedCaptcha] = useState(false);
  const recaptchaRef = useRef(null);

  // On mount: if already authed → dashboard
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (data.user) router.replace("/dashboard");
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      if (session?.user) router.replace("/dashboard");
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [router, supabase]);

  // Track failures in localStorage (12h window)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAIL_KEY);
      if (!raw) return;
      const meta = JSON.parse(raw);
      if (!meta?.ts || typeof meta.count !== "number") return;
      const expired = Date.now() - meta.ts > FAIL_WINDOW_HOURS * 3600 * 1000;
      if (expired) {
        localStorage.removeItem(FAIL_KEY);
        setNeedCaptcha(false);
      } else {
        setNeedCaptcha(meta.count >= CAPTCHA_AFTER);
      }
    } catch {
      // ignore
    }
  }, []);

  const failMeta = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(FAIL_KEY) || '{"count":0,"ts":0}');
    } catch {
      return { count: 0, ts: 0 };
    }
  }, [needCaptcha]); // refresh when flag flips

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleRecaptchaChange = (token) => setRecaptchaToken(token);
  const handleRecaptchaExpired = () => setRecaptchaToken(null);

  function bumpFailures() {
    try {
      const now = Date.now();
      let next = { count: 1, ts: now };
      const raw = localStorage.getItem(FAIL_KEY);
      if (raw) {
        const prev = JSON.parse(raw);
        const withinWindow = now - prev.ts <= FAIL_WINDOW_HOURS * 3600 * 1000;
        next = withinWindow
          ? { count: (prev.count || 0) + 1, ts: prev.ts }
          : { count: 1, ts: now };
      }
      localStorage.setItem(FAIL_KEY, JSON.stringify(next));
      if (next.count >= CAPTCHA_AFTER) setNeedCaptcha(true);
    } catch {
      // ignore
    }
  }

  function resetFailures() {
    try {
      localStorage.removeItem(FAIL_KEY);
      setNeedCaptcha(false);
    } catch {}
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    // Only require captcha after threshold
    if (needCaptcha) {
      if (!recaptchaToken) {
        setSubmitting(false);
        return setError("Please complete the reCAPTCHA.");
      }
      try {
        const verify = await fetch("/api/recaptcha/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: recaptchaToken }),
        }).then((r) => r.json());
        if (!verify?.ok) {
          setSubmitting(false);
          recaptchaRef.current?.reset();
          return setError("reCAPTCHA verification failed. Please try again.");
        }
      } catch {
        setSubmitting(false);
        recaptchaRef.current?.reset();
        return setError("Could not verify reCAPTCHA. Please try again.");
      }
    }

    const email = form.email.trim().toLowerCase();
    const password = form.password;

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setSubmitting(false);

    if (signInError) {
      setError(signInError.message || "Invalid email or password.");
      recaptchaRef.current?.reset();
      bumpFailures();
      return;
    }

    // success
    resetFailures();
    router.replace("/dashboard");
  }

  if (authLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f4f1ec]">
        <div className="flex items-center gap-2 text-[#5a4a3f]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Checking session…
        </div>
      </div>
    );
  }

  const disabled =
    submitting ||
    !form.email ||
    !form.password ||
    (needCaptcha && !recaptchaToken);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f4f1ec]">
      {/* Ambient wash, matching the sign-up page */}
      <div className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-[#e9e4dc] opacity-60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-[#fff4e1] opacity-70 blur-3xl" />

      <div className="mx-auto max-w-6xl px-6 py-10 md:py-16">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d8cfc3] px-4 py-2 text-sm text-[#8b6f47] shadow-sm transition-all hover:bg-[#f4f1ec] hover:text-[#5a4a3f]"
        >
          <ArrowLeft size={16} /> Back to home
        </Link>

        <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-2">
          {/* Left: why you have an account at all */}
          <div className="hidden flex-col justify-between rounded-3xl border border-[#e0dcd4] bg-gradient-to-b from-[#fdf9f3] to-[#f7f2ea] p-10 shadow-xl lg:flex">
            <div>
              <h1 className="font-serif text-4xl leading-tight text-[#5a4a3f]">
                Welcome back to{" "}
                <span className="bg-gradient-to-r from-[#8b6f47] to-[#a78b62] bg-clip-text text-transparent">
                  Oasis
                </span>
              </h1>
              <p className="mt-3 text-[#7a6a5f]">
                Sign in to see your upcoming experiences, tickets and meeting
                points — all in one place.
              </p>
            </div>

            <ul className="mt-8 space-y-4 text-[#5a4a3f]">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-1" size={18} />
                <div>
                  <p className="font-medium">Your bookings</p>
                  <p className="text-sm text-[#7a6a5f]">
                    Dates, meeting points and tickets, ready when you need them.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-1" size={18} />
                <div>
                  <p className="font-medium">Faster checkout</p>
                  <p className="text-sm text-[#7a6a5f]">
                    Your details are remembered, so booking takes a moment.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-1" size={18} />
                <div>
                  <p className="font-medium">Changes and cancellations</p>
                  <p className="text-sm text-[#7a6a5f]">
                    Request a new date or update a meeting point yourself.
                  </p>
                </div>
              </li>
            </ul>

            <div className="mt-10 rounded-2xl border border-[#eee8df] bg-[#fffdf9] p-6">
              <p className="text-xs text-[#7a6a5f]">
                Booked without an account? You can still find a reservation from
                the{" "}
                <Link href="/manage-booking" className="text-[#8b6f47] underline">
                  guest portal
                </Link>{" "}
                using your reference and last name.
              </p>
            </div>
          </div>

          {/* Right: the form */}
          <div className="relative">
            <div className="rounded-3xl border border-[#e0dcd4] bg-white/90 p-8 shadow-2xl backdrop-blur md:p-10">
              <div className="mb-6 text-center">
                <h2 className="font-serif text-2xl text-[#5a4a3f] md:text-3xl">
                  Welcome back
                </h2>
                <p className="mt-1 text-sm text-[#7a6a5f]">
                  Sign in to continue your journey.
                </p>
              </div>

          {/* “Captcha armed” hint */}
          {needCaptcha && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-[#6b5e53]">
              <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5" />
              For your security, we’ve enabled reCAPTCHA after multiple failed
              attempts.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email */}
            <label className="block text-sm text-[#5a4a3f]">
              Email
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-[#e0dcd4] bg-white px-3">
                <Mail className="h-4 w-4 text-[#8b6f47]" />
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full bg-transparent py-2 focus:outline-none text-[#2f2f2f]"
                  placeholder="you@example.com"
                />
              </div>
            </label>

            {/* Password */}
            <label className="block text-sm text-[#5a4a3f]">
              Password
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-[#e0dcd4] bg-white px-3">
                <Lock className="h-4 w-4 text-[#8b6f47]" />
                <input
                  type={showPw ? "text" : "password"}
                  name="password"
                  required
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                  className="w-full bg-transparent py-2 focus:outline-none text-[#2f2f2f]"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="p-1 text-[#7a6a5f] hover:text-[#5a4a3f]"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </label>

            {/* reCAPTCHA appears only after threshold */}
            {needCaptcha && (
              <div className="flex justify-center pt-1">
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}
                  onChange={handleRecaptchaChange}
                  onExpired={handleRecaptchaExpired}
                />
              </div>
            )}

            {error && (
              <p className="text-center text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={disabled}
              className={`w-full rounded-full py-2.5 font-medium transition-all ${
                disabled
                  ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                  : "bg-[#8b6f47] text-white hover:bg-[#7a5f3a]"
              }`}
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Links */}
          <div className="mt-6 text-center text-sm">
            <button
              type="button"
              onClick={() => router.push("/forgot-password")}
              className="text-[#8b6f47] hover:underline"
            >
              Forgot your password?
            </button>
          </div>

          <div className="mt-2 text-center text-sm text-[#5a4a3f]">
            Don’t have an account?{" "}
            <button
              onClick={() => router.push("/sign-up")}
              className="text-[#8b6f47] underline"
            >
              Register
            </button>
          </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
