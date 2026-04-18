"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Instagram,
  Sparkles,
  LifeBuoy,
  MessageCircle,
  Calendar,
  Users,
  Ticket,
  ArrowRight,
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
  const [errors, setErrors] = useState({});

  const maxMessageLength = 2000;
  const messageLength = formData.message?.length || 0;

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));

    // Clear field error on change
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
        // Don't reset form data immediately so they can see what they sent if they want,
        // or clear it if you prefer.
      } else {
        setStatus("error");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  // Framer motion variants
  const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  };

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#f4f1ec] text-[#2f2f2f] selection:bg-[#8b6f47] selection:text-white pb-20">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-32 h-96 w-96 rounded-full bg-[#e3d3bc]/60 blur-3xl" />
        <div className="absolute bottom-[-10rem] right-[-10rem] h-[35rem] w-[35rem] rounded-full bg-[#d2c3aa]/40 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.05] [background:radial-gradient(circle_at_center,rgba(90,74,63,0.5)_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      <section className="relative z-10 pt-24 md:pt-32 px-6 md:px-10 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-[1fr,1.1fr]">
          {/* LEFT COLUMN: Info & Contact Cards */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="flex flex-col justify-start"
          >
            <motion.div variants={fadeUp} className="mb-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d3c2aa] bg-white/60 backdrop-blur-sm px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8b6f47] mb-6 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8b6f47] opacity-40"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#8b6f47]"></span>
                </span>
                Get in touch
              </div>
              <h1 className="font-serif text-4xl leading-[1.1] text-[#3a2f28] md:text-5xl lg:text-6xl mb-6">
                Let&apos;s craft your{" "}
                <span className="text-[#8b6f47] italic">Cretan journey</span>
              </h1>
              <p className="max-w-md text-lg leading-relaxed text-[#6b625a]">
                Curious about an experience, planning a private retreat, or
                simply drawn to the island? Share a few words and we&apos;ll
                guide you to the right next step.
              </p>
            </motion.div>

            {/* Quick Stats */}
            <motion.div
              variants={fadeUp}
              className="flex flex-wrap gap-3 mb-10"
            >
              <InfoPill>Replies within 24h</InfoPill>
              <InfoPill>Based in Chania, Crete</InfoPill>
              <InfoPill>Languages: EN • GR</InfoPill>
            </motion.div>

            {/* Contact Bento Grid */}
            <motion.div
              variants={fadeUp}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <ContactCard
                icon={<Mail className="h-5 w-5" />}
                label="Email Us"
                value="info@youroasis.gr"
                href="mailto:info@youroasis.gr"
                hint="Best for detailed plans"
              />
              <ContactCard
                icon={<Phone className="h-5 w-5" />}
                label="WhatsApp & Phone"
                value="+30 210 000 0000"
                href="tel:+302100000000"
                hint="Weekdays, 09:00–17:00"
              />
              <ContactCard
                icon={<Instagram className="h-5 w-5" />}
                label="Instagram"
                value="@youroasis"
                href="https://instagram.com"
                hint="Follow our daily moments"
              />
              <ContactCard
                icon={<MapPin className="h-5 w-5" />}
                label="Headquarters"
                value="Chania, Crete"
                hint="Heart of the island"
              />
            </motion.div>

            {/* How it works Mini Block */}
            <motion.div
              variants={fadeUp}
              className="mt-8 rounded-[1.5rem] border border-[#e2d6c7] bg-white/40 backdrop-blur-md p-6 text-sm text-[#5a4a3f] shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
            >
              <p className="font-bold text-[11px] uppercase tracking-[0.2em] text-[#8b6f47] mb-3 flex items-center gap-2">
                <Sparkles size={14} /> How it works
              </p>
              <ul className="space-y-2 text-[#6b625a]">
                <li className="flex items-start gap-2">
                  <span className="text-[#8b6f47] mt-0.5">•</span>
                  Send us a note with whatever you&apos;re dreaming of.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#8b6f47] mt-0.5">•</span>
                  We reply within one working day with ideas or next steps.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#8b6f47] mt-0.5">•</span>
                  If it feels right, we&apos;ll shape something tailor-made
                  together.
                </li>
              </ul>
            </motion.div>
          </motion.div>

          {/* RIGHT COLUMN: Interactive Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="relative"
          >
            {/* Soft backdrop glow behind the form */}
            <div
              className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-br from-[#8b6f47]/10 via-transparent to-[#e8d2b2]/20 blur-2xl"
              aria-hidden
            />

            <div className="relative overflow-hidden rounded-[2rem] border border-[#e2d7c7] bg-white/80 p-8 sm:p-10 shadow-[0_8px_40px_rgb(0,0,0,0.06)] backdrop-blur-xl">
              <AnimatePresence mode="wait">
                {status === "success" ? (
                  /* SUCCESS STATE */
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.5 }}
                    className="flex flex-col items-center justify-center text-center py-10"
                  >
                    <div className="w-20 h-20 bg-[#f4f1ec] text-[#8b6f47] rounded-full flex items-center justify-center mb-6 shadow-inner">
                      <CheckCircle2 size={40} strokeWidth={1.5} />
                    </div>
                    <h2 className="font-serif text-3xl text-[#3a2f28] mb-4">
                      Message Received
                    </h2>
                    <p className="text-[#6b625a] mb-8 leading-relaxed max-w-sm mx-auto">
                      Thank you for reaching out,{" "}
                      {formData.name.split(" ")[0] || "friend"}. We have
                      received your message and will be in touch within the next
                      24 hours.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                      <Link href="/experiences">
                        <button className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-[#1A1A1A] text-white text-xs font-bold uppercase tracking-[0.15em] hover:bg-[#8b6f47] hover:shadow-lg transition-all duration-300">
                          Explore Experiences
                        </button>
                      </Link>
                      <button
                        onClick={() => {
                          setStatus(null);
                          setFormData({ ...formData, message: "" }); // Keep name/email, clear message
                        }}
                        className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-transparent border border-[#d3c2aa] text-[#5a4a3f] text-xs font-bold uppercase tracking-[0.15em] hover:bg-[#f4f1ec] transition-all duration-300"
                      >
                        Send Another
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  /* FORM STATE */
                  <motion.form
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onSubmit={handleSubmit}
                    className="flex flex-col gap-8"
                  >
                    {/* Header */}
                    <div>
                      <h2 className="font-serif text-2xl md:text-3xl text-[#3a2f28] mb-2">
                        Send us a note
                      </h2>
                      <p className="text-sm text-[#6b625a]">
                        We read every message and usually reply within a day.
                      </p>
                    </div>

                    {/* What can we help with? */}
                    <div className="space-y-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8b6f47]">
                        What is this regarding?
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <TypeSelector
                          id="planning"
                          icon={<Sparkles size={18} />}
                          label="Plan a journey"
                          current={formData.contactType}
                          setFormData={setFormData}
                        />
                        <TypeSelector
                          id="support"
                          icon={<LifeBuoy size={18} />}
                          label="Booking support"
                          current={formData.contactType}
                          setFormData={setFormData}
                        />
                        <TypeSelector
                          id="info"
                          icon={<MessageCircle size={18} />}
                          label="General question"
                          current={formData.contactType}
                          setFormData={setFormData}
                        />
                      </div>
                    </div>

                    {/* Main fields */}
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <Field
                          id="name"
                          label="Full Name"
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="Jane Doe"
                          error={errors.name}
                        />
                        <Field
                          id="email"
                          label="Email Address"
                          type="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="jane@example.com"
                          error={errors.email}
                        />
                      </div>

                      {/* Conditional Extras with Animation */}
                      <AnimatePresence mode="popLayout">
                        {formData.contactType === "planning" && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="grid grid-cols-1 sm:grid-cols-2 gap-5"
                          >
                            <Field
                              id="idealDates"
                              icon={<Calendar size={16} />}
                              label="Ideal Dates"
                              value={formData.idealDates}
                              onChange={handleChange}
                              placeholder="e.g. Late June"
                            />
                            <Field
                              id="groupSize"
                              icon={<Users size={16} />}
                              label="Group Size"
                              value={formData.groupSize}
                              onChange={handleChange}
                              placeholder="e.g. 2 adults"
                            />
                          </motion.div>
                        )}

                        {formData.contactType === "support" && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                          >
                            <Field
                              id="bookingRef"
                              icon={<Ticket size={16} />}
                              label="Booking Reference"
                              value={formData.bookingRef}
                              onChange={handleChange}
                              placeholder="e.g. BK-12345"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <FieldTextArea
                        id="message"
                        label="Your Message"
                        value={formData.message}
                        onChange={handleChange}
                        placeholder={
                          formData.contactType === "planning"
                            ? "Tell us about your dream experience, special requests, or dietary needs..."
                            : formData.contactType === "support"
                              ? "How can we assist you with your upcoming booking?"
                              : "Ask us anything..."
                        }
                        rows={5}
                        error={errors.message}
                        maxLength={maxMessageLength}
                        length={messageLength}
                      />
                    </div>

                    {status === "error" && (
                      <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        Something went wrong. Please try sending your message
                        again.
                      </div>
                    )}

                    {/* Footer / Submit */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-4 border-t border-[#e2d7c7]">
                      <p className="text-[11px] leading-relaxed text-[#7a6a5f] max-w-[250px]">
                        Your details are completely safe with us. We don't do
                        spam.
                      </p>

                      <button
                        type="submit"
                        disabled={status === "loading"}
                        className="w-full sm:w-auto group inline-flex items-center justify-center gap-2 rounded-full bg-[#1A1A1A] px-8 py-4 text-xs font-bold uppercase tracking-[0.15em] text-white shadow-lg shadow-black/10 transition-all hover:bg-[#8b6f47] hover:shadow-xl hover:-translate-y-1 active:translate-y-0 disabled:opacity-70 disabled:pointer-events-none"
                      >
                        {status === "loading" ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            Send Message
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                          </>
                        )}
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}

/* --------------------------- UI subcomponents --------------------------- */

function InfoPill({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d3c2aa] bg-white/50 backdrop-blur-sm px-3.5 py-1.5 text-[11px] font-medium text-[#5a4a3f] shadow-sm">
      <span className="h-1.5 w-1.5 rounded-full bg-[#8b6f47]" />
      {children}
    </span>
  );
}

function ContactCard({ icon, label, value, hint, href }) {
  const content = (
    <div className="flex items-start gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f4ede4] text-[#8b6f47] transition-transform duration-300 group-hover:scale-110">
        {icon}
      </div>
      <div className="flex flex-col justify-center pt-0.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a7988a] mb-1">
          {label}
        </span>
        <span className="text-sm font-medium text-[#3a2f28] group-hover:text-[#8b6f47] transition-colors">
          {value}
        </span>
        {hint && (
          <span className="text-[11px] text-[#6b625a] mt-0.5">{hint}</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#e2d7c7] bg-white/60 p-5 shadow-sm backdrop-blur-md transition-all hover:shadow-md hover:border-[#8b6f47]/30 hover:bg-white/90">
      {href ? (
        <a
          href={href}
          className="block outline-none"
          target={href.startsWith("http") ? "_blank" : undefined}
          rel="noreferrer"
        >
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  );
}

function TypeSelector({ id, icon, label, current, setFormData }) {
  const isActive = current === id;

  return (
    <button
      type="button"
      onClick={() => setFormData((prev) => ({ ...prev, contactType: id }))}
      className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center transition-all duration-300 outline-none ${
        isActive
          ? "border-[#8b6f47] bg-[#f4ede4] shadow-sm text-[#8b6f47]"
          : "border-[#e2d7c7] bg-white/50 text-[#6b625a] hover:bg-[#f4ede4]/50 hover:border-[#d3c2aa]"
      }`}
    >
      <div
        className={`${isActive ? "scale-110" : "scale-100"} transition-transform duration-300`}
      >
        {icon}
      </div>
      <span className="text-xs font-bold tracking-wide">{label}</span>
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 border-2 border-[#8b6f47] rounded-xl pointer-events-none"
          initial={false}
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
    </button>
  );
}

function Field({
  id,
  label,
  icon,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
}) {
  return (
    <label htmlFor={id} className="block w-full group">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#6b625a] group-focus-within:text-[#8b6f47] transition-colors">
          {label}
        </span>
        {error && <span className="text-[10px] text-red-500">{error}</span>}
      </div>
      <div className="relative">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a7988a] group-focus-within:text-[#8b6f47] transition-colors">
            {icon}
          </div>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full rounded-xl border bg-white/50 py-3.5 outline-none transition-all duration-300 text-sm text-[#3a2f28] placeholder:text-[#bbaea0] ${
            icon ? "pl-11 pr-4" : "px-4"
          } ${
            error
              ? "border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-400/10"
              : "border-[#d3c2aa] focus:border-[#8b6f47] focus:ring-4 focus:ring-[#8b6f47]/10"
          }`}
        />
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
  error,
  maxLength,
  length,
}) {
  return (
    <label htmlFor={id} className="block w-full group">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#6b625a] group-focus-within:text-[#8b6f47] transition-colors">
          {label}
        </span>
        {error && <span className="text-[10px] text-red-500">{error}</span>}
      </div>
      <div className="relative">
        <textarea
          id={id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          className={`w-full resize-none rounded-xl border bg-white/50 px-4 py-3.5 outline-none transition-all duration-300 text-sm text-[#3a2f28] placeholder:text-[#bbaea0] ${
            error
              ? "border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-400/10"
              : "border-[#d3c2aa] focus:border-[#8b6f47] focus:ring-4 focus:ring-[#8b6f47]/10"
          }`}
        />
        <div className="absolute bottom-3 right-4 text-[10px] font-medium text-[#a7988a] pointer-events-none">
          {length} / {maxLength}
        </div>
      </div>
    </label>
  );
}
