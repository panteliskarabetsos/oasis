"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import ReCAPTCHA from "react-google-recaptcha";
import { useAuth } from "@/app/components/SessionWrapper";
import {
  Mail,
  Lock,
  Phone,
  Calendar as CalendarIcon,
  User as UserIcon,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";

export default function Register() {
  const { user, loading, supabase } = useAuth();
  const router = useRouter();
  const recaptchaRef = useRef();

  // form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const [recaptchaCompleted, setRecaptchaCompleted] = useState(false);

  // ui state
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // redirect if already logged in
  useEffect(() => {
    if (!loading && user) router.push("/dashboard");
  }, [loading, user, router]);

  const handleRecaptchaChange = (token) => {
    setRecaptchaToken(token);
    setRecaptchaCompleted(!!token);
  };

  const isLegalAge = (dob) => {
    const today = new Date();
    const birthDate = new Date(dob);
    const age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    return age > 18 || (age === 18 && m >= 0);
  };

  const passScore = useMemo(() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[a-z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s; // 0..5
  }, [password]);

  const passMeterWidth = ["w-0", "w-1/5", "w-2/5", "w-3/5", "w-4/5", "w-full"][
    passScore
  ];
  const passMeterTone =
    passScore <= 2
      ? "bg-red-300"
      : passScore === 3
      ? "bg-yellow-300"
      : passScore === 4
      ? "bg-lime-300"
      : "bg-green-400";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!recaptchaToken) {
      setError("Please complete the reCAPTCHA challenge.");
      setIsLoading(false);
      return;
    }
    if (!isLegalAge(dateOfBirth)) {
      setError("You must be at least 18 years old to register.");
      setIsLoading(false);
      return;
    }

    try {
      // create user via your API (server: verify captcha, create auth user, upsert profile)
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          name,
          surname,
          phone,
          dateOfBirth,
          recaptchaToken,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Failed to register. Please try again.");
        recaptchaRef.current?.reset();
        setRecaptchaCompleted(false);
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      setError("");

      // auto-login with Supabase
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      setIsLoading(false);

      if (loginError) {
        console.error("Auto-login failed:", loginError.message);
        router.push("/login");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f4f1ec]">
        <div className="animate-pulse text-[#5a4a3f]">Loading…</div>
      </div>
    );
  }
  if (user) return null; // redirecting

  return (
    <div className="relative min-h-screen bg-[#f4f1ec] overflow-hidden">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-[#e9e4dc] blur-3xl opacity-60" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-[#fff4e1] blur-3xl opacity-70" />

      <div className="max-w-6xl mx-auto px-6 py-10 md:py-16">
        {/* Header actions */}
        <button
          onClick={() => router.push("/")}
          className="mb-6 inline-flex items-center gap-2 text-[#8b6f47] text-sm border border-[#d8cfc3] px-4 py-2 rounded-full hover:bg-[#f4f1ec] hover:text-[#5a4a3f] transition-all shadow-sm"
        >
          <ArrowLeft size={16} /> Home
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Left: Brand hero / benefits */}
          <div className="hidden lg:flex flex-col justify-between rounded-3xl border border-[#e0dcd4] bg-gradient-to-b from-[#fdf9f3] to-[#f7f2ea] p-10 shadow-xl">
            <div>
              <h1 className="text-4xl font-serif text-[#5a4a3f] leading-tight">
                Join{" "}
                <span className="bg-gradient-to-r from-[#8b6f47] to-[#a78b62] bg-clip-text text-transparent">
                  Oasis
                </span>
              </h1>
              <p className="mt-3 text-[#7a6a5f]">
                Create an account to book experiences, manage your reservations,
                and save your preferences.
              </p>
            </div>

            <ul className="mt-8 space-y-4 text-[#5a4a3f]">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-1" size={18} />
                <div>
                  <p className="font-medium">Fast checkout</p>
                  <p className="text-sm text-[#7a6a5f]">
                    Your details are stored securely for quick bookings.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-1" size={18} />
                <div>
                  <p className="font-medium">Personalized experience</p>
                  <p className="text-sm text-[#7a6a5f]">
                    We tailor recommendations to your preferences.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-1" size={18} />
                <div>
                  <p className="font-medium">Privacy first</p>
                  <p className="text-sm text-[#7a6a5f]">
                    We never share your data without consent.
                  </p>
                </div>
              </li>
            </ul>

            <div className="mt-10 rounded-2xl bg-[#fffdf9] border border-[#eee8df] p-6">
              <p className="text-xs text-[#7a6a5f]">
                By creating an account you agree to our Terms and acknowledge
                our Privacy Policy.
              </p>
            </div>
          </div>

          {/* Right: Form card */}
          <div className="relative">
            <div className="bg-white/90 backdrop-blur rounded-3xl border border-[#e0dcd4] shadow-2xl p-8 md:p-10">
              <h2 className="text-2xl md:text-3xl font-serif text-[#5a4a3f] text-center">
                Create an Account
              </h2>

              {/* Success banner */}
              {isSuccess && (
                <div
                  className="mt-6 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-800"
                  role="status"
                >
                  <CheckCircle2 size={20} />
                  <span>Account created successfully. Signing you in…</span>
                </div>
              )}

              {/* Error banner */}
              {error && !isSuccess && (
                <div
                  className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                autoComplete="off"
                className="mt-8 space-y-6"
              >
                {/* Name grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="First Name*"
                    value={name}
                    onChange={setName}
                    placeholder="Enter your first name"
                    icon={UserIcon}
                    required
                  />
                  <Input
                    label="Surname*"
                    value={surname}
                    onChange={setSurname}
                    placeholder="Enter your surname"
                    icon={UserIcon}
                    required
                  />
                </div>

                <Input
                  label="Email*"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@example.com"
                  icon={Mail}
                  required
                />

                {/* Password with toggle + meter */}
                <div>
                  <div className="relative">
                    <Input
                      label="Password*"
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={setPassword}
                      placeholder="Minimum 8 characters"
                      icon={Lock}
                      required
                      className="pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3 top-[42px] text-[#7a6a5f] hover:text-[#5a4a3f]"
                      aria-label={showPass ? "Hide password" : "Show password"}
                    >
                      {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>

                  {/* Meter */}
                  <div className="mt-2 h-1.5 w-full rounded-full bg-[#eee8df] overflow-hidden">
                    <div
                      className={`h-full ${passMeterWidth} ${passMeterTone} transition-all rounded-full`}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[#7a6a5f]">
                    Use at least 8 characters, mixing letters, numbers and
                    symbols.
                  </p>
                </div>

                <Input
                  label="Phone"
                  type="tel"
                  value={phone}
                  onChange={setPhone}
                  placeholder="(optional)"
                  icon={Phone}
                />

                <Input
                  label="Date of Birth*"
                  type="date"
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                  icon={CalendarIcon}
                  required
                />

                {/* reCAPTCHA */}
                <div className="flex justify-center pt-2">
                  <ReCAPTCHA
                    ref={recaptchaRef}
                    sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}
                    onChange={handleRecaptchaChange}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-full text-base font-medium text-white bg-gradient-to-r from-[#8b6f47] to-[#a78b62] hover:opacity-90 transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={isLoading || !recaptchaCompleted}
                >
                  {isLoading ? "Creating Account…" : "Register"}
                </button>

                <p className="text-center text-sm text-[#5a4a3f]">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => router.push("/login")}
                    className="text-[#8b6f47] underline underline-offset-2 hover:text-[#5a4a3f]"
                  >
                    Sign In
                  </button>
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Reusable input with icon ---------- */
function Input({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  icon: Icon,
  required = false,
  className = "",
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-[#5a4a3f] mb-2">
        {label}
      </span>
      <div className={`relative`}>
        {Icon && (
          <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#7a6a5f]">
            <Icon size={18} />
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={`w-full rounded-xl bg-white border border-[#e0dcd4] px-5 py-3 ${
            Icon ? "pl-11" : ""
          } 
            focus:outline-none focus:ring-2 focus:ring-[#8b6f47] shadow-sm transition-all ${className}`}
        />
      </div>
    </label>
  );
}
