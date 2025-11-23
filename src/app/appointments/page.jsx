"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  PhoneCall,
  CalendarClock,
  Globe2,
  SunMedium,
  MoonStar,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
} from "lucide-react";

const MAX_MESSAGE_CHARS = 600;

const TIMEZONES = [
  { value: "Europe/Athens", label: "Europe / Athens (EET / EEST)" },
  { value: "Europe/London", label: "Europe / London" },
  { value: "Europe/Paris", label: "Europe / Central Europe" },
  { value: "America/New_York", label: "America / New York (EST / EDT)" },
  { value: "America/Chicago", label: "America / Chicago (CST / CDT)" },
  { value: "America/Los_Angeles", label: "America / Los Angeles (PST / PDT)" },
  { value: "America/Toronto", label: "America / Toronto" },
  { value: "Asia/Dubai", label: "Asia / Dubai" },
  { value: "Asia/Singapore", label: "Asia / Singapore" },
  { value: "Australia/Sydney", label: "Australia / Sydney" },
  { value: "not-sure", label: "I’m not sure / Other" },
];

const COUNTRIES = [
  // Southern Europe
  { value: "GR", label: "Greece (+30)", dialCode: "+30" },
  { value: "IT", label: "Italy (+39)", dialCode: "+39" },
  { value: "ES", label: "Spain (+34)", dialCode: "+34" },
  { value: "PT", label: "Portugal (+351)", dialCode: "+351" },

  // Central & Western Europe
  { value: "FR", label: "France (+33)", dialCode: "+33" },
  { value: "DE", label: "Germany (+49)", dialCode: "+49" },
  { value: "CH", label: "Switzerland (+41)", dialCode: "+41" },
  { value: "AT", label: "Austria (+43)", dialCode: "+43" },
  { value: "BE", label: "Belgium (+32)", dialCode: "+32" },
  { value: "NL", label: "Netherlands (+31)", dialCode: "+31" },
  { value: "LU", label: "Luxembourg (+352)", dialCode: "+352" },

  // Nordics + UK & Ireland
  { value: "GB", label: "United Kingdom (+44)", dialCode: "+44" },
  { value: "IE", label: "Ireland (+353)", dialCode: "+353" },
  { value: "SE", label: "Sweden (+46)", dialCode: "+46" },
  { value: "NO", label: "Norway (+47)", dialCode: "+47" },
  { value: "DK", label: "Denmark (+45)", dialCode: "+45" },
  { value: "FI", label: "Finland (+358)", dialCode: "+358" },

  // North America
  { value: "US", label: "United States (+1)", dialCode: "+1" },
  { value: "CA", label: "Canada (+1)", dialCode: "+1" },

  // Middle East / Near
  { value: "AE", label: "United Arab Emirates (+971)", dialCode: "+971" },
  { value: "IL", label: "Israel (+972)", dialCode: "+972" },
  { value: "SA", label: "Saudi Arabia (+966)", dialCode: "+966" },

  // Oceania
  { value: "AU", label: "Australia (+61)", dialCode: "+61" },
  { value: "NZ", label: "New Zealand (+64)", dialCode: "+64" },

  // Asia hubs
  { value: "SG", label: "Singapore (+65)", dialCode: "+65" },
  { value: "HK", label: "Hong Kong (+852)", dialCode: "+852" },

  // Fallback
  { value: "OTHER", label: "Other / not listed", dialCode: "" },
];

export default function ScheduleCallPage() {
  const [todayISO, setTodayISO] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    country: "",
    phone: "",
    timezone: "",
    preferredDate: "",
    preferredTimeOfDay: "morning", // morning | afternoon | evening
    focusArea: "not-sure", // retreats | private | experiences | not-sure
    meetingType: "video", // video | audio
    message: "",
    contactType: "call",
  });

  const [status, setStatus] = useState(null); // null | loading | success | error
  const [errors, setErrors] = useState({});

  // Set today's date on client to avoid hydration issues
  useEffect(() => {
    const now = new Date();
    const iso = now.toISOString().split("T")[0];
    setTodayISO(iso);
  }, []);

  const validate = () => {
    const nextErrors = {};

    if (!formData.name.trim()) {
      nextErrors.name = "Please tell us your name.";
    }
    if (!formData.email.trim()) {
      nextErrors.email = "We’ll need an email to send you details.";
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      nextErrors.email = "Please enter a valid email address.";
    }
    if (!formData.country.trim()) {
      nextErrors.country = "Choose your country.";
    }
    if (!formData.phone.trim()) {
      nextErrors.phone = "A phone number helps us actually call you.";
    }
    if (!formData.timezone.trim()) {
      nextErrors.timezone = "Your time zone helps us suggest a good slot.";
    }
    if (!formData.preferredDate.trim()) {
      nextErrors.preferredDate = "Choose a day that could work for you.";
    }
    if (!formData.message.trim()) {
      nextErrors.message =
        "Share a little context so we can make the most of our time together.";
    }

    return nextErrors;
  };

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));

    if (errors[id]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setStatus(null);
      return;
    }

    setStatus("loading");
    setErrors({});

    try {
      const res = await fetch("/api/schedule-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setStatus("success");
        setFormData({
          name: "",
          email: "",
          country: "",
          phone: "",
          timezone: "",
          preferredDate: "",
          preferredTimeOfDay: "morning",
          focusArea: "not-sure",
          meetingType: "video",
          message: "",
          contactType: "call",
        });
      } else {
        setStatus("error");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  const selectedCountry = COUNTRIES.find((c) => c.value === formData.country);
  const dialCode = selectedCountry?.dialCode || "";

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#f4f1ec] text-[#2f2f2f]">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-32 h-72 w-72 rounded-full bg-[#e3d3bc]/70 blur-3xl" />
        <div className="absolute bottom-[-6rem] right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-[#d2c3aa]/60 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.05] [background:radial-gradient(circle_at_center,rgba(90,74,63,0.35)_1px,transparent_1px)] [background-size:22px_22px]" />
      </div>

      <section className="relative z-10 py-20 md:py-24">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          {/* Header strip */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5 }}
            className="mb-10 flex flex-col gap-2"
          >
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-[#d3c2aa] bg-white/80 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[#8b6f47]">
              Schedule a call
            </div>
            <p className="text-xs text-[#7c6b5c]">
              A short, human conversation to help you decide what&apos;s next.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.05fr,0.95fr]">
            {/* Left – copy & expectations */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col justify-center"
            >
              <h1 className="font-serif text-3xl leading-tight text-[#3e3128] md:text-4xl lg:text-[2.6rem]">
                Let&apos;s talk about{" "}
                <span className="text-[#8b6f47]">
                  what you&apos;re dreaming of
                </span>
              </h1>

              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#4a4a4a] md:text-[16px]">
                A short, 20–30 minute call to explore what you&apos;re thinking
                about — a retreat, a private gathering, or a slower experience
                in Crete — and see what might be possible together.
              </p>

              <div className="mt-6 flex flex-wrap gap-3 text-xs text-[#6a5a49]">
                <InfoPill icon={<PhoneCall className="h-3 w-3" />}>
                  20–30 minutes
                </InfoPill>
                <InfoPill icon={<Globe2 className="h-3 w-3" />}>
                  Zoom or audio-only
                </InfoPill>
                <InfoPill icon={<CalendarClock className="h-3 w-3" />}>
                  We suggest 2–3 options that fit your time zone
                </InfoPill>
              </div>

              {/* What we can use the call for */}
              <div className="mt-8 grid gap-4 rounded-3xl border border-[#e2d6c7] bg-white/70 p-5 text-[13px] text-[#4d3d33] md:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b6f47]">
                    This call is perfect if…
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    <li>• You&apos;re deciding between a few ideas.</li>
                    <li>
                      • You&apos;re not sure which retreat or format fits.
                    </li>
                    <li>• You want a sense of budget and timing.</li>
                    <li>• You simply prefer talking to a real human.</li>
                  </ul>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b6f47]">
                    We&apos;ll use our time to…
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    <li>
                      • Listen to what you&apos;re hoping this will feel like.
                    </li>
                    <li>• Share a few ways we could shape it together.</li>
                    <li>
                      • Answer practical questions about travel & logistics.
                    </li>
                    <li>
                      • Suggest clear, gentle next steps — or no pressure at
                      all.
                    </li>
                  </ul>
                </div>
              </div>

              <p className="mt-5 text-[11px] text-[#8b7a6b]">
                No obligation, no hard sell. If it doesn&apos;t feel like the
                right fit, that&apos;s useful information too.
              </p>
            </motion.div>

            {/* Right – form */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="relative"
            >
              <div
                className="absolute -inset-1 rounded-[1.75rem] bg-gradient-to-br from-[#8b6f47]/35 via-transparent to-[#e8d2b2]/45 blur-2xl"
                aria-hidden
              />

              <form
                onSubmit={handleSubmit}
                className={[
                  "relative rounded-[1.5rem] border bg-white/85 p-6 shadow-xl backdrop-blur-md supports-[backdrop-filter]:backdrop-blur md:p-8",
                  status === "success"
                    ? "border-emerald-400/70"
                    : status === "error"
                    ? "border-red-300/80"
                    : "border-[#e0d6c6]",
                ].join(" ")}
                aria-describedby="form-status"
              >
                <div className="mb-6 flex flex-col gap-3 md:mb-7">
                  <div className="inline-flex items-center gap-2 self-start rounded-full border border-[#d3c2aa]/80 bg-[#f8f4ee]/90 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[#8b6f47]">
                    <PhoneCall className="h-3.5 w-3.5" />
                    Clarity call
                  </div>
                  <div>
                    <h2 className="font-serif text-2xl text-[#4d3d33] md:text-[26px]">
                      Share a few details and we&apos;ll suggest times
                    </h2>
                    <p className="mt-1.5 text-sm text-[#6b625a]">
                      We&apos;ll email you with 2–3 options that work in your
                      time zone, plus a quick outline of what we could talk
                      about.
                    </p>
                  </div>
                </div>

                {/* Focus area */}
                <div className="mb-5 space-y-3">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#8b6f47]">
                    What would you like to talk about?
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      {
                        id: "retreats",
                        label: "Retreats",
                        desc: "Joining or creating a retreat.",
                      },
                      {
                        id: "private",
                        label: "Private gathering",
                        desc: "Celebrations, teams, friends & family.",
                      },
                      {
                        id: "experiences",
                        label: "Slow experiences",
                        desc: "Single days, add-ons to your trip.",
                      },
                      {
                        id: "not-sure",
                        label: "Not quite sure yet",
                        desc: "You just have a feeling. That’s enough.",
                      },
                    ].map((opt) => {
                      const active = formData.focusArea === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              focusArea: opt.id,
                            }))
                          }
                          className={[
                            "flex h-full flex-col items-start gap-1 rounded-xl border px-3.5 py-3 text-left text-xs transition",
                            "focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40",
                            active
                              ? "border-[#8b6f47] bg-[#f5eee2] shadow-sm"
                              : "border-[#e0d6c6] bg-white/80 hover:bg-[#f7f1e8]",
                          ].join(" ")}
                        >
                          <span className="text-[13px] font-medium text-[#4d3d33]">
                            {opt.label}
                          </span>
                          <span className="text-[11px] text-[#7a6a5f]">
                            {opt.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Core fields */}
                <div className="grid grid-cols-1 gap-5 md:gap-6">
                  {/* Name + Email */}
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field
                      id="name"
                      label="Name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Your full name"
                      required
                      autoComplete="name"
                      error={errors.name}
                    />
                    <Field
                      id="email"
                      label="Email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="you@example.com"
                      required
                      autoComplete="email"
                      error={errors.email}
                    />
                  </div>

                  {/* Country + Phone */}
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-[0.9fr,1.1fr]">
                    <SelectField
                      id="country"
                      label="Country"
                      value={formData.country}
                      onChange={handleChange}
                      required
                      error={errors.country}
                      options={COUNTRIES}
                      placeholder="Where should we call you?"
                    />
                    <Field
                      id="phone"
                      label="Phone number"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder={
                        dialCode ? "Rest of your number" : "Your phone number"
                      }
                      required
                      error={errors.phone}
                      iconLeft={
                        dialCode ? (
                          <span className="text-[11px] font-medium text-[#6b625a]">
                            {dialCode}
                          </span>
                        ) : null
                      }
                    />
                  </div>

                  {/* Timezone + date */}
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1.1fr,0.9fr]">
                    <SelectField
                      id="timezone"
                      label="Your time zone"
                      value={formData.timezone}
                      onChange={handleChange}
                      required
                      error={errors.timezone}
                      iconLeft={<Globe2 className="h-4 w-4 text-[#9a8b7b]" />}
                      options={TIMEZONES}
                      placeholder="Select your time zone"
                    />

                    <Field
                      id="preferredDate"
                      label="Preferred day"
                      type="date"
                      value={formData.preferredDate}
                      onChange={handleChange}
                      required
                      error={errors.preferredDate}
                      iconLeft={
                        <CalendarClock className="h-4 w-4 text-[#9a8b7b]" />
                      }
                      min={todayISO || undefined}
                    />
                  </div>

                  {/* Time of day & meeting type */}
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm font-medium text-[#3c3c3c]">
                        <span>Preferred time of day</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        {[
                          {
                            id: "morning",
                            label: "Morning",
                            icon: <SunMedium className="h-3.5 w-3.5" />,
                          },
                          {
                            id: "afternoon",
                            label: "Afternoon",
                            icon: <SunMedium className="h-3.5 w-3.5" />,
                          },
                          {
                            id: "evening",
                            label: "Evening",
                            icon: <MoonStar className="h-3.5 w-3.5" />,
                          },
                        ].map((opt) => {
                          const active = formData.preferredTimeOfDay === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  preferredTimeOfDay: opt.id,
                                }))
                              }
                              className={[
                                "flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 transition",
                                "focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40",
                                active
                                  ? "border-[#8b6f47] bg-[#f5eee2]"
                                  : "border-[#e0d6c6] bg-white/80 hover:bg-[#f7f1e8]",
                              ].join(" ")}
                            >
                              <span className="text-[#8b6f47]">{opt.icon}</span>
                              <span className="text-[11px] text-[#4d3d33]">
                                {opt.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm font-medium text-[#3c3c3c]">
                        <span>Call style</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        {[
                          { id: "video", label: "Video call" },
                          { id: "audio", label: "Audio only" },
                        ].map((opt) => {
                          const active = formData.meetingType === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  meetingType: opt.id,
                                }))
                              }
                              className={[
                                "flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 transition",
                                "focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40",
                                active
                                  ? "border-[#8b6f47] bg-[#f5eee2]"
                                  : "border-[#e0d6c6] bg-white/80 hover:bg-[#f7f1e8]",
                              ].join(" ")}
                            >
                              <span className="text-[11px] text-[#4d3d33]">
                                {opt.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Message with character limit */}
                  <FieldTextArea
                    id="message"
                    label="Anything you’d like us to know before we talk?"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="For example: who’s coming, approximate dates, budget range, what you hope this will feel like…"
                    rows={5}
                    required
                    error={errors.message}
                    maxLength={MAX_MESSAGE_CHARS}
                  />

                  {/* Footer row */}
                  <div className="mt-1 flex flex-col gap-3 border-t border-[#eee1cf] pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] leading-relaxed text-[#7a6a5f]">
                      We&apos;ll only use your details for this conversation. No
                      automatic scheduling links, no mailing list — unless you
                      explicitly ask for it.
                    </p>
                    <button
                      type="submit"
                      disabled={status === "loading"}
                      className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#8b6f47] px-6 py-3 text-sm font-medium text-white shadow-lg shadow-[#8b6f47]/22 transition-transform hover:-translate-y-0.5 hover:bg-[#a78b62] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {status === "loading" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending request…
                        </>
                      ) : status === "success" ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Request sent
                        </>
                      ) : (
                        <>
                          <PhoneCall className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                          Request a call
                        </>
                      )}
                    </button>
                  </div>

                  {/* Status messages */}
                  <div
                    id="form-status"
                    aria-live="polite"
                    className="min-h-[28px]"
                  >
                    {status === "success" && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Thank you — we&apos;ve received your request. We&apos;ll
                        email you soon with a few suggested times.
                      </motion.div>
                    )}

                    {status === "error" && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-700"
                      >
                        <AlertCircle className="h-4 w-4" />
                        Something went wrong while sending your request. Please
                        try again or contact us directly at{" "}
                        <a
                          href="mailto:info@youroasis.gr"
                          className="font-medium underline underline-offset-2"
                        >
                          info@youroasis.gr
                        </a>
                        .
                      </motion.div>
                    )}
                  </div>
                </div>
              </form>

              {/* Tiny reassurance chip */}
              <div className="mt-3 flex items-center gap-2 text-[11px] text-[#8b7a6b]">
                <MessageCircle className="h-3.5 w-3.5 text-[#8b6f47]" />
                <span>
                  If forms aren&apos;t your thing, you can always just email{" "}
                  <a
                    href="mailto:info@youroasis.gr"
                    className="underline-offset-2 hover:underline"
                  >
                    info@youroasis.gr
                  </a>
                  .
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </main>
  );
}

/* --------------------------- UI subcomponents --------------------------- */

function InfoPill({ children, icon }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#e0d6c6] bg-white/80 px-3 py-1 text-[11px]">
      {icon && <span className="text-[#8b6f47]">{icon}</span>}
      {children}
    </span>
  );
}

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  autoComplete,
  error,
  iconLeft,
  min,
}) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <label htmlFor={id} className="block">
      <div className="mb-2 flex items-center justify-between text-sm font-medium text-[#3c3c3c]">
        <span>
          {label}
          {required && <span className="ml-1 text-[#b44d4d]">*</span>}
        </span>
        {error && (
          <span className="text-[11px] font-normal text-[#b44d4d]">
            {error}
          </span>
        )}
      </div>
      <div className="relative">
        {iconLeft && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            {iconLeft}
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={errorId}
          min={min}
          className={[
            "peer w-full rounded-xl border bg-[#f8f4ee] px-4 py-3 text-[15px] outline-none transition placeholder:text-[#9a9388]",
            iconLeft ? "pl-9" : "",
            error
              ? "border-[#b44d4d] focus:border-[#b44d4d] focus:ring-4 focus:ring-[#b44d4d]/18"
              : "border-[#d3c2aa] focus:border-[#8b6f47] focus:ring-4 focus:ring-[#8b6f47]/16",
          ].join(" ")}
        />
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center opacity-60">
          <span
            className={[
              "h-2 w-2 rounded-full",
              error ? "bg-[#b44d4d]" : "bg-[#d3c2aa]",
            ].join(" ")}
          />
        </div>
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-[11px] text-[#b44d4d]">
          {error}
        </p>
      )}
    </label>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  required = false,
  error,
  iconLeft,
  options,
  placeholder,
}) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <label htmlFor={id} className="block">
      <div className="mb-2 flex items-center justify-between text-sm font-medium text-[#3c3c3c]">
        <span>
          {label}
          {required && <span className="ml-1 text-[#b44d4d]">*</span>}
        </span>
        {error && (
          <span className="text-[11px] font-normal text-[#b44d4d]">
            {error}
          </span>
        )}
      </div>
      <div className="relative">
        {iconLeft && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            {iconLeft}
          </span>
        )}
        <select
          id={id}
          value={value}
          onChange={onChange}
          required={required}
          aria-invalid={!!error}
          aria-describedby={errorId}
          className={[
            "w-full rounded-xl border bg-[#f8f4ee] px-4 py-3 text-[15px] outline-none transition",
            iconLeft ? "pl-9" : "",
            !value ? "text-[#9a9388]" : "text-[#2f2f2f]",
            error
              ? "border-[#b44d4d] focus:border-[#b44d4d] focus:ring-4 focus:ring-[#b44d4d]/18"
              : "border-[#d3c2aa] focus:border-[#8b6f47] focus:ring-4 focus:ring-[#8b6f47]/16",
          ].join(" ")}
        >
          <option value="" disabled>
            {placeholder || "Select an option"}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center opacity-60">
          <span className="h-2 w-2 rounded-full bg-[#d3c2aa]" />
        </div>
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-[11px] text-[#b44d4d]">
          {error}
        </p>
      )}
    </label>
  );
}

function FieldTextArea({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
  required = false,
  error,
  maxLength,
}) {
  const errorId = error ? `${id}-error` : undefined;
  const currentLength = (value || "").length;

  return (
    <label htmlFor={id} className="block">
      <div className="mb-2 flex items-center justify-between text-sm font-medium text-[#3c3c3c]">
        <span>
          {label}
          {required && <span className="ml-1 text-[#b44d4d]">*</span>}
        </span>
        {error && (
          <span className="text-[11px] font-normal text-[#b44d4d]">
            {error}
          </span>
        )}
      </div>
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        required={required}
        aria-invalid={!!error}
        aria-describedby={errorId}
        maxLength={maxLength}
        className={[
          "w-full rounded-xl border bg-[#f8f4ee] px-4 py-3 text-[15px] outline-none transition placeholder:text-[#9a9388]",
          error
            ? "border-[#b44d4d] focus:border-[#b44d4d] focus:ring-4 focus:ring-[#b44d4d]/18"
            : "border-[#d3c2aa] focus:border-[#8b6f47] focus:ring-4 focus:ring-[#8b6f47]/16",
        ].join(" ")}
      />
      <div className="mt-1 flex items-center justify-between text-[11px] text-[#8b7a6b]">
        {error ? (
          <p id={errorId} className="text-[#b44d4d]">
            {error}
          </p>
        ) : (
          <span>
            Up to {maxLength} characters — just enough to give us a sense of
            things.
          </span>
        )}
        {typeof maxLength === "number" && (
          <span>
            {currentLength}/{maxLength}
          </span>
        )}
      </div>
    </label>
  );
}
