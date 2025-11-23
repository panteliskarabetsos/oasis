"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
    contactType: "planning", // "planning" | "support" | "info"
    idealDates: "",
    groupSize: "",
    bookingRef: "",
  });

  const [status, setStatus] = useState(null); // "loading" | "success" | "error" | null
  const [errors, setErrors] = useState({}); // { field: message }

  const maxMessageLength = 2000;
  const messageLength = formData.message?.length || 0;

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));

    // clear field error on change
    if (errors[id]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const validate = () => {
    const nextErrors = {};
    if (!formData.name.trim()) {
      nextErrors.name = "Please tell us your name.";
    }

    if (!formData.email.trim()) {
      nextErrors.email = "An email helps us write back to you.";
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      nextErrors.email = "Please enter a valid email address.";
    }

    if (!formData.message.trim()) {
      nextErrors.message =
        "Share a few words so we can understand how to help.";
    }

    return nextErrors;
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
      const res = await fetch("/api/contact", {
        method: "POST",
        body: JSON.stringify(formData),
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        setStatus("success");
        setFormData({
          name: "",
          email: "",
          message: "",
          contactType: "planning",
          idealDates: "",
          groupSize: "",
          bookingRef: "",
        });
      } else {
        setStatus("error");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#f4f1ec] text-[#2f2f2f]">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* soft top glow */}
        <div className="absolute -left-24 -top-32 h-72 w-72 rounded-full bg-[#e3d3bc]/70 blur-3xl" />
        {/* bottom glow */}
        <div className="absolute bottom-[-6rem] right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-[#d2c3aa]/60 blur-3xl" />
        {/* subtle grid */}
        <div className="absolute inset-0 opacity-[0.06] [background:radial-gradient(circle_at_center,rgba(90,74,63,0.4)_1px,transparent_1px)] [background-size:22px_22px]" />
      </div>

      <section className="relative z-10 py-20 md:py-24">
        {/* Section header / breadcrumb vibe */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-10 flex max-w-6xl flex-col gap-2 px-6 md:px-10"
        >
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-[#d3c2aa] bg-white/80 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[#8b6f47]">
            Get in touch
          </div>
          <p className="text-xs text-[#7c6b5c]">
            Questions, ideas, special moments - we&apos;d love to hear from you.
          </p>
        </motion.div>

        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 md:px-10 lg:grid-cols-[0.95fr,1.05fr]">
          {/* Left: Intro + contacts */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col justify-center"
          >
            <h1 className="font-serif text-3xl leading-tight text-[#3e3128] md:text-4xl lg:text-5xl">
              Let&apos;s start{" "}
              <span className="text-[#8b6f47]">your Cretan journey</span>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#4a4a4a] md:text-[16px]">
              Curious about an experience, planning a retreat, or simply drawn
              to the island? Share a few words and we&apos;ll guide you to the
              right next step.
            </p>

            {/* Small “stats” strip */}
            <div className="mt-6 flex flex-wrap gap-3 text-xs text-[#6a5a49]">
              <InfoPill>Replies within ~24 hours</InfoPill>
              <InfoPill>Based in Chania, Crete</InfoPill>
              <InfoPill>Languages: EN • GR</InfoPill>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ContactCard
                icon={<Mail className="h-5 w-5" aria-hidden />}
                label="Email"
                value="info@youroasis.gr"
                href="mailto:info@youroasis.gr"
                hint="Best for detailed questions"
              />
              <ContactCard
                icon={<Phone className="h-5 w-5" aria-hidden />}
                label="Phone"
                value="+30 210 000 0000"
                href="tel:+302100000000"
                hint="Weekdays, 09:00–17:00 (EET)"
              />
              <ContactCard
                icon={<MapPin className="h-5 w-5" aria-hidden />}
                label="Location"
                value="Chania, Crete"
                hint="In the heart of the island"
              />
              <ContactCard
                icon={<Clock className="h-5 w-5" aria-hidden />}
                label="Hours"
                value="Mon–Fri, 09:00–17:00 (EET)"
                hint="We read every message"
              />
            </div>

            {/* Mini reassurance block */}
            <div className="mt-7 rounded-2xl border border-[#e2d6c7] bg-white/70 p-4 text-[12px] text-[#5a4a3f] shadow-sm">
              <p className="font-medium tracking-[0.14em] text-[#8b6f47]">
                HOW IT WORKS
              </p>
              <ul className="mt-2 space-y-1.5">
                <li>
                  • You send us a note with whatever you&apos;re dreaming of.
                </li>
                <li>
                  • We reply within one working day with ideas or next steps.
                </li>
                <li>
                  • If it feels right, we&apos;ll shape something tailor-made
                  together.
                </li>
              </ul>
            </div>

            <p className="mt-5 text-[11px] uppercase tracking-[0.22em] text-[#8b7a6b]">
              Small team • Thoughtful replies • No spam
            </p>
          </motion.div>

          {/* Right: Form */}
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
              {/* Header */}
              <div className="mb-6 flex flex-col gap-3 md:mb-7">
                <div className="inline-flex items-center gap-2 self-start rounded-full border border-[#d3c2aa]/80 bg-[#f8f4ee]/90 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[#8b6f47]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#8b6f47]" />
                  Contact Oasis
                </div>
                <div>
                  <h2 className="font-serif text-2xl text-[#4d3d33] md:text-[26px]">
                    Tell us what you&apos;re dreaming of
                  </h2>
                  <p className="mt-1.5 text-sm text-[#6b625a]">
                    Whether you&apos;re planning an experience, need a hand with
                    a booking, or just have a question about Crete, we&apos;re
                    here.
                  </p>
                </div>
              </div>

              {/* What can we help with? */}
              <div className="mb-6 space-y-3">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#8b6f47]">
                  What can we help with?
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    {
                      id: "planning",
                      label: "Plan an experience",
                      desc: "Retreats, slow days, tailor-made moments.",
                    },
                    {
                      id: "support",
                      label: "Support",
                      desc: "Help with an existing booking.",
                    },
                    {
                      id: "info",
                      label: "More information",
                      desc: "Ask us anything about Crete or Oasis.",
                    },
                  ].map((option) => {
                    const isActive = formData.contactType === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            contactType: option.id,
                          }))
                        }
                        className={[
                          "flex h-full flex-col items-start gap-1 rounded-xl border px-3.5 py-3 text-left text-xs transition",
                          "focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40",
                          isActive
                            ? "border-[#8b6f47] bg-[#f5eee2] shadow-sm"
                            : "border-[#e0d6c6] bg-white/80 hover:bg-[#f7f1e8]",
                        ].join(" ")}
                      >
                        <span className="text-[13px] font-medium text-[#4d3d33]">
                          {option.label}
                        </span>
                        <span className="text-[11px] text-[#7a6a5f]">
                          {option.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Main fields */}
              <div className="grid grid-cols-1 gap-5 md:gap-6">
                {/* Name + Email side by side on larger screens */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field
                    id="name"
                    label="Name"
                    type="text"
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
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    error={errors.email}
                  />
                </div>

                {/* Conditional extras */}
                {formData.contactType === "planning" && (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field
                      id="idealDates"
                      label="Ideal dates or timeframe"
                      type="text"
                      value={formData.idealDates}
                      onChange={handleChange}
                      placeholder="e.g. late June, flexible by a week"
                    />
                    <Field
                      id="groupSize"
                      label="Number of guests"
                      type="text"
                      value={formData.groupSize}
                      onChange={handleChange}
                      placeholder="e.g. 4 adults, 2 children"
                    />
                  </div>
                )}

                {formData.contactType === "support" && (
                  <Field
                    id="bookingRef"
                    label="Booking reference (if you have one)"
                    type="text"
                    value={formData.bookingRef}
                    onChange={handleChange}
                    placeholder="e.g. BK-12345678"
                  />
                )}

                <div>
                  <FieldTextArea
                    id="message"
                    label="Message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder={
                      formData.contactType === "planning"
                        ? "Share a little about your plans, dates, and the feeling you’d like this experience to have…"
                        : formData.contactType === "support"
                        ? "Tell us what’s happening and how we can help. Any details (dates, names, references) are welcome."
                        : "Ask us anything about our experiences, Crete, or how Oasis might fit into your journey."
                    }
                    rows={6}
                    required
                    error={errors.message}
                    maxLength={maxMessageLength}
                    helper={
                      <span className="text-[11px] text-[#9a8b7b]">
                        {messageLength}/{maxMessageLength} characters
                      </span>
                    }
                  />
                </div>

                {/* Footer row */}
                <div className="mt-1 flex flex-col gap-3 border-t border-[#eee1cf] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[11px] leading-relaxed text-[#7a6a5f]">
                    We&apos;ll only use your details to reply to this enquiry.
                    No newsletters or surprises — unless you ask for them.
                  </p>
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#8b6f47] px-6 py-3 text-sm font-medium text-white shadow-lg shadow-[#8b6f47]/22 transition-transform hover:-translate-y-0.5 hover:bg-[#a78b62] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {status === "loading" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending…
                      </>
                    ) : status === "success" ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Sent
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        Send message
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
                      Your message has been sent. We’ll get back to you soon.
                    </motion.div>
                  )}

                  {status === "error" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-700"
                    >
                      <AlertCircle className="h-4 w-4" />
                      Something went wrong while sending your message. Please
                      try again.
                    </motion.div>
                  )}
                </div>
              </div>
            </form>
          </motion.div>
        </div>

        {/* Footer note */}
        <motion.div
          className="mx-auto mt-16 max-w-3xl px-6"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="rounded-2xl border border-[#e3d7c6] bg-white/60 px-6 py-4 text-center text-sm text-[#4a4a4a] shadow-sm">
            If you don&apos;t hear from us within a couple of days, feel free to
            check your spam folder or reach out again — sometimes even island
            emails wander off.
          </div>
        </motion.div>
      </section>
    </main>
  );
}

/* --------------------------- UI subcomponents --------------------------- */

function InfoPill({ children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#e0d6c6] bg-white/70 px-3 py-1 text-[11px]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#c3a985]" />
      {children}
    </span>
  );
}

function ContactCard({ icon, label, value, hint, href }) {
  const content = (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2e6d6] text-[#8b6f47] ring-1 ring-[#e0d6c6]">
        {icon}
      </div>
      <div>
        <div className="text-xs uppercase tracking-[0.16em] text-[#7a6a58]">
          {label}
        </div>
        <div className="text-sm font-medium text-[#4d3d33]">{value}</div>
        {hint && (
          <div className="mt-0.5 text-[11px] text-[#8b7a6b]">{hint}</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#e0d6c6] bg-white/80 p-4 shadow-sm backdrop-blur transition">
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-br from-[#e8d2b2]/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      />
      {href ? (
        <a
          href={href}
          className="block focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40 focus:ring-offset-2 focus:ring-offset-[#f4f1ec]"
        >
          {content}
        </a>
      ) : (
        content
      )}
    </div>
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
          className={[
            "peer w-full rounded-xl border bg-[#f8f4ee] px-4 py-3 text-[15px] outline-none transition placeholder:text-[#9a9388]",
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
        {error && (
          <p id={errorId} className="mt-1 text-[11px] text-[#b44d4d]">
            {error}
          </p>
        )}
      </div>
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
  helper,
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
      <div className="space-y-1">
        <textarea
          id={id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows}
          required={required}
          maxLength={maxLength}
          aria-invalid={!!error}
          aria-describedby={errorId}
          className={[
            "w-full rounded-xl border bg-[#f8f4ee] px-4 py-3 text-[15px] outline-none transition placeholder:text-[#9a9388]",
            error
              ? "border-[#b44d4d] focus:border-[#b44d4d] focus:ring-4 focus:ring-[#b44d4d]/18"
              : "border-[#d3c2aa] focus:border-[#8b6f47] focus:ring-4 focus:ring-[#8b6f47]/16",
          ].join(" ")}
        />
        <div className="flex items-center justify-between">
          {error && (
            <p id={errorId} className="text-[11px] text-[#b44d4d]">
              {error}
            </p>
          )}
          {helper && !error && <div>{helper}</div>}
        </div>
      </div>
    </label>
  );
}
