"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import ReCAPTCHA from "react-google-recaptcha";
import {
  Loader2,
  Eye,
  EyeOff,
  Lock,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", tone: "neutral" }); // neutral | success | error

  const pwChecks = useMemo(() => {
    const len = password.length >= 8;
    const letter = /[A-Za-z]/.test(password);
    const digit = /\d/.test(password);
    const upper = /[A-Z]/.test(password);
    const symbol = /[^A-Za-z0-9]/.test(password);
    const score =
      (len ? 1 : 0) +
      (letter ? 1 : 0) +
      (digit ? 1 : 0) +
      (upper ? 1 : 0) +
      (symbol ? 1 : 0);
    // Required rule for submit: at least 8 chars + letters + numbers
    const meetsRequired = len && letter && digit;
    return { len, letter, digit, upper, symbol, score, meetsRequired };
  }, [password]);

  const strengthLabel = useMemo(() => {
    if (!password) return "—";
    if (pwChecks.score <= 2) return "Weak";
    if (pwChecks.score === 3) return "Okay";
    if (pwChecks.score === 4) return "Good";
    return "Strong";
  }, [password, pwChecks.score]);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg({ text: "", tone: "neutral" });

    if (!token) {
      setMsg({ text: "Your reset link is invalid or expired.", tone: "error" });
      return;
    }
    if (!recaptchaToken) {
      setMsg({
        text: "Please complete the reCAPTCHA verification.",
        tone: "error",
      });
      return;
    }
    if (!pwChecks.meetsRequired) {
      setMsg({
        text: "Password must be at least 8 characters and include letters and numbers.",
        tone: "error",
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Support both your earlier API shapes
        body: JSON.stringify({ token, newPassword: password, recaptchaToken }),
      });

      if (res.ok) {
        setMsg({
          text: "Password updated! Redirecting to login…",
          tone: "success",
        });
        setTimeout(() => router.push("/login"), 1600);
      } else {
        const data = await res.json().catch(() => ({}));
        setMsg({
          text:
            data?.message ||
            data?.error ||
            "Something went wrong. Please try again.",
          tone: "error",
        });
      }
    } catch {
      setMsg({ text: "Network error. Please try again.", tone: "error" });
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-[#f4f1ec] grid place-items-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-[#e0dcd4] bg-white p-8 text-center shadow-xl">
          <p className="text-[#b14545] font-semibold mb-2">
            Invalid or expired link
          </p>
          <p className="text-[#5a4a3f]">Please request a new reset email.</p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-full border border-[#d8cfc3] bg-white px-4 py-2 text-[#5a4a3f] hover:bg-[#faf7f1]"
            >
              <ArrowLeft size={16} /> Go Back
            </button>
            <button
              onClick={() => router.push("/forgot-password")}
              className="rounded-full bg-[#8b6f47] px-4 py-2 text-white hover:bg-[#7a5f3a]"
            >
              Request New Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  const disabled = isLoading || !recaptchaToken || !pwChecks.meetsRequired;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f0ece6] to-[#f4f1ec] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-3xl border border-[#e0dcd4] bg-white/90 backdrop-blur p-8 shadow-2xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#efeae2]">
            <Lock className="h-5 w-5 text-[#8b6f47]" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-[#5a4a3f]">
            Reset your password
          </h1>
          <p className="mt-1 text-sm text-[#6b5e53]">
            Choose a strong password to secure your account.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Password */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[#7a6a5f]">
              New password
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters with letters & numbers"
                required
                className="w-full rounded-lg border border-[#d8cfc3] bg-white px-4 py-3 text-[#2f2f2f] focus:outline-none focus:ring-2 focus:ring-[#cbb89e]"
              />
              <button
                type="button"
                aria-label={showPw ? "Hide password" : "Show password"}
                onClick={() => setShowPw((s) => !s)}
                className="absolute inset-y-0 right-2 grid place-items-center px-2 text-[#7a6a58] hover:text-[#5a4a3f]"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Strength meter */}
            <div className="mt-2">
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded ${
                      password
                        ? i < Math.min(4, pwChecks.score)
                          ? "bg-[#8b6f47]"
                          : "bg-[#e7e1d7]"
                        : "bg-[#e7e1d7]"
                    }`}
                  />
                ))}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs">
                <ShieldCheck size={14} className="text-[#8b6f47]" />
                <span className="text-[#7a6a5f]">
                  Strength: {strengthLabel}
                </span>
              </div>
            </div>

            {/* Requirements */}
            <ul className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#6b5e53]">
              <Req ok={pwChecks.len}>8+ characters</Req>
              <Req ok={pwChecks.letter}>Contains a letter</Req>
              <Req ok={pwChecks.digit}>Contains a number</Req>
              <Req ok={pwChecks.upper}>Uppercase (optional)</Req>
              <Req ok={pwChecks.symbol}>Symbol (optional)</Req>
            </ul>
          </div>

          {/* reCAPTCHA */}
          <div className="flex justify-center">
            <ReCAPTCHA
              sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}
              onChange={(t) => {
                setRecaptchaToken(t);
                setMsg({ text: "", tone: "neutral" });
              }}
              onExpired={() => setRecaptchaToken(null)}
              onErrored={() =>
                setMsg({
                  text: "reCAPTCHA error. Please retry.",
                  tone: "error",
                })
              }
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={disabled}
            className={`w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-white transition ${
              disabled
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[#8b6f47] hover:bg-[#7a5f3a]"
            }`}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isLoading ? "Updating…" : "Reset Password"}
          </button>
        </form>

        {/* Message */}
        {msg.text ? (
          <p
            className={`mt-4 text-center text-sm ${
              msg.tone === "success"
                ? "text-green-700"
                : msg.tone === "error"
                ? "text-red-600"
                : "text-[#5a4a3f]"
            }`}
          >
            {msg.text}
          </p>
        ) : null}

        {/* Footer links */}
        <div className="mt-6 flex items-center justify-center gap-3 text-xs text-[#7a6a58]">
          <button
            onClick={() => router.push("/login")}
            className="underline decoration-[#d8cfc3] underline-offset-2 hover:text-[#5a4a3f]"
          >
            Back to login
          </button>
          <span aria-hidden>•</span>
          <button
            onClick={() => router.push("/forgot-password")}
            className="underline decoration-[#d8cfc3] underline-offset-2 hover:text-[#5a4a3f]"
          >
            Resend reset email
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------ Small UI helpers ------ */

function Req({ ok, children }) {
  return (
    <li
      className={`rounded-md border px-2 py-1 ${
        ok
          ? "border-[#d4e9d6] bg-[#f3fbf4] text-[#256D1B]"
          : "border-[#eee7dc] bg-[#fffdf9]"
      }`}
    >
      {children}
    </li>
  );
}
