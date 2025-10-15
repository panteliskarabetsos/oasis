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
    <main className="relative min-h-[100svh] overflow-hidden bg-[#f4f1ec] text-[#2f2f2f] transition-colors duration-500 dark:bg-[#0e0e0e] dark:text-[#e9e4da]">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#a3845b]/20 blur-3xl" />
        <div className="absolute bottom-[-6rem] right-[-6rem] h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl dark:bg-emerald-500/10" />
        <div className="absolute inset-0 opacity-[0.08] [background:radial-gradient(circle_at_center,rgba(0,0,0,0.3)_1px,transparent_1px)] [background-size:20px_20px] dark:opacity-[0.12]" />
      </div>

      <section className="relative z-10 py-24 md:py-28">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 md:px-10 lg:grid-cols-2 lg:gap-14">
          {/* Left: Intro + contacts */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col justify-center"
          >
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-[#c7b8a6]/50 bg-white/60 px-3 py-1 text-xs text-[#6a5a49] backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-[#d8cdbf]">
              <span className="inline-block h-2 w-2 rounded-full bg-[#a3845b]" />
              We usually reply within 24 hours
            </div>
            <h1 className="mt-5 font-serif text-4xl leading-tight md:text-5xl lg:text-6xl">
              Get in <span className="text-[#a3845b]">Touch</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-[#4a4a4a] dark:text-[#cfc9be] md:text-lg">
              Curious about our experiences or ready to start your journey with
              Oasis? Drop us a line and we’ll get back to you.
            </p>

            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ContactCard
                icon={<Mail className="h-5 w-5" aria-hidden />}
                label="Email"
                value="hello@youroasis.gr"
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
                value="Mon–Fri, 09:00–17:00"
              />
            </div>
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
              className="absolute -inset-0.5 rounded-[1.75rem] bg-gradient-to-br from-[#a3845b]/40 via-transparent to-emerald-400/30 blur-2xl"
              aria-hidden
            />
            <form
              onSubmit={handleSubmit}
              className="relative rounded-[1.5rem] border border-black/5 bg-white/70 p-6 shadow-xl backdrop-blur-md supports-[backdrop-filter]:backdrop-blur md:p-8 dark:border-white/10 dark:bg-neutral-900/60"
              aria-describedby="form-status"
            >
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
                  placeholder="Tell us a bit about what you’re looking for…"
                  rows={6}
                  required
                />

                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs text-[#6a6a6a] dark:text-[#a8a39a]">
                    This form is protected by simple spam checks.
                  </p>
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="group inline-flex items-center gap-2 rounded-full bg-[#a3845b] px-6 py-3 font-medium text-white shadow-lg shadow-[#a3845b]/20 transition-transform hover:translate-y-[-1px] hover:bg-[#b79266] active:translate-y-[0px] disabled:opacity-70"
                  >
                    {status === "loading" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        Send Message
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
                      className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-900/20 dark:text-emerald-200"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Your message has been sent. We’ll get back to you soon!
                    </motion.div>
                  )}

                  {status === "error" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-900/20 dark:text-red-200"
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
          className="mx-auto mt-16 max-w-3xl px-6 text-center text-sm text-[#4a4a4a] dark:text-[#aaa]"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          We’ll get back to you as soon as possible. Thank you for reaching out
          ✨
        </motion.p>
      </section>
    </main>
  );
}

/* --------------------------- UI subcomponents --------------------------- */

function ContactCard({ icon, label, value }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-black/5 bg-white/70 p-4 shadow-sm backdrop-blur transition dark:border-white/10 dark:bg-white/5">
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-br from-[#a3845b]/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      />
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#a3845b]/10 text-[#a3845b] ring-1 ring-[#a3845b]/20">
          {icon}
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-[#7a6a58] dark:text-[#c9baa7]">
            {label}
          </div>
          <div className="text-base font-medium">{value}</div>
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
      <div className="mb-2 text-sm font-medium text-[#3c3c3c] dark:text-[#ddd]">
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
          className="peer w-full rounded-xl border border-[#d3cec7] bg-[#fafafa] px-4 py-3 text-[15px] outline-none transition placeholder:text-[#9a9388] focus:border-[#a3845b] focus:ring-4 focus:ring-[#a3845b]/20 dark:border-[#3b3b3b] dark:bg-[#1f1f1f] dark:placeholder:text-[#7f7a72]"
        />
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center opacity-60">
          <span className="h-2 w-2 rounded-full bg-[#a3845b]" />
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
      <div className="mb-2 text-sm font-medium text-[#3c3c3c] dark:text-[#ddd]">
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
        className="w-full rounded-xl border border-[#d3cec7] bg-[#fafafa] px-4 py-3 text-[15px] outline-none transition placeholder:text-[#9a9388] focus:border-[#a3845b] focus:ring-4 focus:ring-[#a3845b]/20 dark:border-[#3b3b3b] dark:bg-[#1f1f1f] dark:placeholder:text-[#7f7a72]"
      />
    </label>
  );
}
