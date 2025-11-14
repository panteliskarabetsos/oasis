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
  });
  const [status, setStatus] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        body: JSON.stringify(formData),
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        setStatus("success");
        setFormData({ name: "", email: "", message: "" });
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
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#e3d3bc]/70 blur-3xl" />
        <div className="absolute bottom-[-6rem] right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-[#d2c3aa]/60 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.06] [background:radial-gradient(circle_at_center,rgba(90,74,63,0.5)_1px,transparent_1px)] [background-size:26px_26px]" />
      </div>

      <section className="relative z-10 py-24 md:py-28">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 md:px-10 lg:grid-cols-[0.9fr,1.1fr]">
          {/* Left: Intro + contacts */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col justify-center"
          >
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-[#d3c2aa] bg-white/70 px-3 py-1 text-xs text-[#6a5a49] backdrop-blur">
              <span className="inline-block h-2 w-2 rounded-full bg-[#8b6f47]" />
              We usually reply within 24 hours
            </div>

            <h1 className="mt-5 font-serif text-4xl leading-tight text-[#4d3d33] md:text-5xl lg:text-6xl">
              Let&apos;s start{" "}
              <span className="text-[#8b6f47]">your Cretan journey</span>
            </h1>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[#4a4a4a] md:text-[17px]">
              Curious about an experience, planning a retreat, or just feeling a
              pull towards Crete? Share a few words and we&apos;ll help you find
              the right next step.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ContactCard
                icon={<Mail className="h-5 w-5" aria-hidden />}
                label="Email"
                value="info@youroasis.gr"
              />
              <ContactCard
                icon={<Phone className="h-5 w-5" aria-hidden />}
                label="Phone"
                value="+30 210 000 0000"
              />
              <ContactCard
                icon={<MapPin className="h-5 w-5" aria-hidden />}
                label="Location"
                value="Chania, Crete"
              />
              <ContactCard
                icon={<Clock className="h-5 w-5" aria-hidden />}
                label="Hours"
                value="Mon–Fri, 09:00–17:00 (EET)"
              />
            </div>

            <p className="mt-6 text-xs uppercase tracking-[0.22em] text-[#8b7a6b]">
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
              className="relative rounded-[1.5rem] border border-[#e0d6c6] bg-white/80 p-6 shadow-xl backdrop-blur-md supports-[backdrop-filter]:backdrop-blur md:p-8"
              aria-describedby="form-status"
            >
              <div className="mb-6">
                <p className="text-xs uppercase tracking-[0.26em] text-[#8b6f47]">
                  Contact
                </p>
                <h2 className="mt-2 font-serif text-2xl text-[#4d3d33]">
                  Tell us what you&apos;re dreaming of
                </h2>
                <p className="mt-2 text-sm text-[#6b625a]">
                  Share as much or as little as you like — we&apos;ll gently
                  guide you from there.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 md:gap-6">
                <Field
                  id="name"
                  label="Name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your full name"
                  required
                />

                <Field
                  id="email"
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  required
                />

                <FieldTextArea
                  id="message"
                  label="Message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Tell us a bit about your plans, preferred dates, or the kind of experience you’re seeking…"
                  rows={6}
                  required
                />

                <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-[#7a6a5f]">
                    We&apos;ll only use your details to reply to this enquiry.
                  </p>
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#8b6f47] px-6 py-3 text-sm font-medium text-white shadow-lg shadow-[#8b6f47]/20 transition-transform hover:-translate-y-0.5 hover:bg-[#a78b62] active:translate-y-0 disabled:opacity-70"
                  >
                    {status === "loading" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending…
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
                      Something went wrong. Please try again.
                    </motion.div>
                  )}
                </div>
              </div>
            </form>
          </motion.div>
        </div>

        {/* Footer note */}
        <motion.p
          className="mx-auto mt-16 max-w-3xl px-6 text-center text-sm text-[#4a4a4a]"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          If you don&apos;t hear from us within a couple of days, feel free to
          check your spam folder or reach out again — sometimes even island
          emails wander off.
        </motion.p>
      </section>
    </main>
  );
}

/* --------------------------- UI subcomponents --------------------------- */

function ContactCard({ icon, label, value }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#e0d6c6] bg-white/80 p-4 shadow-sm backdrop-blur transition">
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-br from-[#e8d2b2]/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      />
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2e6d6] text-[#8b6f47] ring-1 ring-[#e0d6c6]">
          {icon}
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-[#7a6a58]">
            {label}
          </div>
          <div className="text-sm font-medium text-[#4d3d33]">{value}</div>
        </div>
      </div>
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
}) {
  return (
    <label htmlFor={id} className="block">
      <div className="mb-2 text-sm font-medium text-[#3c3c3c]">
        {label}
        {required && <span className="ml-1 text-[#b44d4d]">*</span>}
      </div>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className="peer w-full rounded-xl border border-[#d3c2aa] bg-[#f8f4ee] px-4 py-3 text-[15px] outline-none transition placeholder:text-[#9a9388] focus:border-[#8b6f47] focus:ring-4 focus:ring-[#8b6f47]/16"
        />
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center opacity-60">
          <span className="h-2 w-2 rounded-full bg-[#d3c2aa]" />
        </div>
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
}) {
  return (
    <label htmlFor={id} className="block">
      <div className="mb-2 text-sm font-medium text-[#3c3c3c]">
        {label}
        {required && <span className="ml-1 text-[#b44d4d]">*</span>}
      </div>
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        required={required}
        className="w-full rounded-xl border border-[#d3c2aa] bg-[#f8f4ee] px-4 py-3 text-[15px] outline-none transition placeholder:text-[#9a9388] focus:border-[#8b6f47] focus:ring-4 focus:ring-[#8b6f47]/16"
      />
    </label>
  );
}
