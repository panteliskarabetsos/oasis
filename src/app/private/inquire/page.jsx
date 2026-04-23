"use client";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  ChefHat,
  Map,
  Mic,
  Sparkles,
  ArrowRight,
  Loader2,
  Check,
} from "lucide-react";

const eventTypes = [
  { id: "chef", name: "In-Villa Chef's Table", icon: ChefHat },
  { id: "privatize", name: "Privatize a Tour", icon: Map },
  { id: "bespoke", name: "Fully Bespoke", icon: Sparkles },
  { id: "celebration", name: "Celebration", icon: Mic },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
  },
};

const FloatingInput = ({ label, id, type = "text", ...props }) => (
  <motion.div
    variants={itemVariants}
    className="relative z-0 w-full group pt-4"
  >
    <input
      type={type}
      name={id}
      id={id}
      className="block py-3.5 px-0 w-full text-lg font-light text-white bg-transparent border-0 border-b border-white/20 appearance-none focus:outline-none focus:ring-0 focus:border-[#c5a059] peer transition-colors duration-500"
      placeholder=" "
      {...props}
    />
    <label
      htmlFor={id}
      className="absolute text-[11px] uppercase tracking-[0.25em] text-white/40 duration-500 transform -translate-y-8 scale-75 top-8 -z-10 origin-[0] peer-focus:left-0 peer-focus:text-[#c5a059] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-8 pointer-events-none"
    >
      {label}
    </label>
  </motion.div>
);

export default function InquirePrivateEvent() {
  const [selectedType, setSelectedType] = useState(null);
  const [dateValue, setDateValue] = useState("");
  const [formStatus, setFormStatus] = useState("idle"); // idle, submitting, success, error

  const handleDateChange = (e) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length > 8) val = val.slice(0, 8);
    if (val.length > 4) {
      val = `${val.slice(0, 2)}/${val.slice(2, 4)}/${val.slice(4)}`;
    } else if (val.length > 2) {
      val = `${val.slice(0, 2)}/${val.slice(2)}`;
    }
    setDateValue(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormStatus("submitting");

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    // Attach the selected concept manually since it's a state, not an input
    const conceptName = selectedType
      ? eventTypes.find((t) => t.id === selectedType)?.name
      : "Not selected";

    data.concept = conceptName;

    try {
      const response = await fetch("/api/private-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setFormStatus("success");
      } else {
        setFormStatus("error");
      }
    } catch (error) {
      console.error("Submission error:", error);
      setFormStatus("error");
    }
  };

  return (
    <main className="font-light text-white bg-[#030303] overflow-x-hidden min-h-screen selection:bg-[#c5a059] selection:text-black">
      {/* ================== EDITORIAL HERO ================== */}
      <section className="relative pt-40 pb-32 px-6 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120vw] h-[80vh] bg-[radial-gradient(ellipse_at_top,rgba(197,160,89,0.12)_0%,transparent_60%)] pointer-events-none" />

        <motion.div
          className="relative z-10 max-w-4xl mx-auto text-center space-y-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        >
          <motion.div
            className="flex items-center justify-center gap-6 text-[10px] tracking-[0.4em] uppercase text-[#c5a059] font-medium"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            <span className="w-12 h-[1px] bg-[#c5a059]/40" />
            Private Inquiries
            <span className="w-12 h-[1px] bg-[#c5a059]/40" />
          </motion.div>

          <motion.h1
            className="text-5xl sm:text-7xl md:text-[5.5rem] font-serif text-white leading-[1.05] tracking-tight drop-shadow-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 1 }}
          >
            Bespoke{" "}
            <span className="text-[#e8d2b2] italic font-normal">Visions</span>
          </motion.h1>

          <motion.p
            className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto pt-4 font-extralight leading-relaxed"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            Submit your vision below. From intimate dinners to sweeping
            multi-day retreats, we curate every detail with absolute discretion
            and care.
          </motion.p>
        </motion.div>

        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
        >
          <span className="text-[9px] uppercase tracking-[0.3em] text-white/30">
            Scroll
          </span>
          <div className="w-[1px] h-12 bg-gradient-to-b from-white/30 to-transparent" />
        </motion.div>
      </section>

      {/* ================== BESPOKE FORM SECTION ================== */}
      <section className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-[1fr,400px] gap-24 items-start">
          {/* --- DYNAMIC FORM AREA --- */}
          <div className="relative z-10 min-h-[800px]">
            <AnimatePresence mode="wait">
              {formStatus === "success" ? (
                // SUCCESS STATE UI
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="flex flex-col items-center justify-center text-center h-full space-y-8 py-20 border border-[#c5a059]/20 bg-[#0a0a0a]/50 rounded-[2.5rem] backdrop-blur-md"
                >
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#d4af37] to-[#8b6f47] flex items-center justify-center shadow-[0_0_60px_rgba(212,175,55,0.3)] mb-4">
                    <Check className="w-8 h-8 text-black" strokeWidth={2} />
                  </div>
                  <h3 className="text-4xl md:text-5xl font-serif text-[#e8d2b2]">
                    Inquiry Received
                  </h3>
                  <p className="text-white/60 text-lg max-w-md mx-auto font-light leading-relaxed">
                    Thank you for sharing your vision with Oasis. Our concierge
                    team is reviewing your request and will contact you within
                    24 hours.
                  </p>
                  <button
                    onClick={() => {
                      setFormStatus("idle");
                      setSelectedType(null);
                      setDateValue("");
                    }}
                    className="mt-8 text-[10px] uppercase tracking-[0.2em] text-[#c5a059] hover:text-white transition-colors border-b border-[#c5a059]/30 hover:border-white pb-1"
                  >
                    Submit another request
                  </button>
                </motion.div>
              ) : (
                // MAIN FORM UI
                <motion.form
                  key="form"
                  onSubmit={handleSubmit}
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
                  className="space-y-20"
                >
                  {/* Form Error Alert */}
                  {formStatus === "error" && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-6 py-4 rounded-xl text-sm font-light">
                      Something went wrong sending your request. Please try
                      again or contact us directly at info@youroasis.gr.
                    </div>
                  )}

                  {/* Part 1: Contact Info */}
                  <div className="space-y-12">
                    <motion.div
                      variants={itemVariants}
                      className="flex items-end justify-between border-b border-white/10 pb-6"
                    >
                      <h3 className="text-3xl font-serif text-[#e8d2b2]">
                        I. The Host
                      </h3>
                      <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">
                        01 / 04
                      </span>
                    </motion.div>
                    <div className="grid sm:grid-cols-2 gap-x-12 gap-y-10">
                      <FloatingInput label="Full Name" id="name" required />
                      <FloatingInput
                        label="Email Address"
                        id="email"
                        type="email"
                        required
                      />
                      <FloatingInput
                        label="Phone Number"
                        id="phone"
                        type="tel"
                      />
                      <FloatingInput
                        label="Company / Group Name"
                        id="company"
                      />
                    </div>
                  </div>

                  {/* Part 2: Gathering Details */}
                  <div className="space-y-12">
                    <motion.div
                      variants={itemVariants}
                      className="flex items-end justify-between border-b border-white/10 pb-6"
                    >
                      <h3 className="text-3xl font-serif text-[#e8d2b2]">
                        II. The Details
                      </h3>
                      <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">
                        02 / 04
                      </span>
                    </motion.div>
                    <div className="grid sm:grid-cols-2 gap-x-12 gap-y-10">
                      <FloatingInput
                        label="Preferred Date (DD/MM/YYYY)"
                        id="date"
                        type="text"
                        value={dateValue}
                        onChange={handleDateChange}
                        maxLength={10}
                        required
                      />
                      <FloatingInput
                        label="Estimated Guest Count"
                        id="guests"
                        type="number"
                        required
                        min="1"
                        max="50"
                      />
                      <div className="sm:col-span-2">
                        <FloatingInput
                          label="Villa / Accommodation Name (If known)"
                          id="location"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Part 3: Type of Experience */}
                  <div className="space-y-12">
                    <motion.div
                      variants={itemVariants}
                      className="flex items-end justify-between border-b border-white/10 pb-6"
                    >
                      <h3 className="text-3xl font-serif text-[#e8d2b2]">
                        III. The Concept
                      </h3>
                      <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">
                        03 / 04
                      </span>
                    </motion.div>
                    <motion.div
                      variants={itemVariants}
                      className="grid grid-cols-2 md:grid-cols-4 gap-4"
                    >
                      {eventTypes.map((type) => {
                        const Icon = type.icon;
                        const isSelected = selectedType === type.id;
                        return (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => setSelectedType(type.id)}
                            className={`relative flex flex-col items-center justify-center text-center p-8 rounded-2xl transition-all duration-700 gap-5 group h-full overflow-hidden ${
                              isSelected
                                ? "bg-[#c5a059] shadow-[0_0_40px_rgba(197,160,89,0.2)] scale-[1.02]"
                                : "bg-white/[0.02] border border-white/5 hover:bg-white/[0.06]"
                            }`}
                          >
                            <Icon
                              strokeWidth={1}
                              className={`w-8 h-8 transition-colors duration-700 relative z-10 ${isSelected ? "text-black" : "text-[#c5a059] group-hover:text-[#e8d2b2]"}`}
                            />
                            <span
                              className={`text-[9px] uppercase tracking-[0.25em] font-medium leading-relaxed relative z-10 ${isSelected ? "text-black" : "text-white/50 group-hover:text-white"}`}
                            >
                              {type.name}
                            </span>
                          </button>
                        );
                      })}
                    </motion.div>
                  </div>

                  {/* Part 4: Desires & Notes */}
                  <div className="space-y-12">
                    <motion.div
                      variants={itemVariants}
                      className="flex items-end justify-between border-b border-white/10 pb-6"
                    >
                      <h3 className="text-3xl font-serif text-[#e8d2b2]">
                        IV. The Vision
                      </h3>
                      <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">
                        04 / 04
                      </span>
                    </motion.div>
                    <motion.div
                      variants={itemVariants}
                      className="relative group pt-4"
                    >
                      <textarea
                        id="notes"
                        name="notes"
                        rows="4"
                        className="block py-4 px-0 w-full text-lg font-light text-white bg-transparent border-0 border-b border-white/20 appearance-none focus:outline-none focus:ring-0 focus:border-[#c5a059] peer transition-colors duration-500 resize-none"
                        placeholder=" "
                      />
                      <label
                        htmlFor="notes"
                        className="absolute text-[11px] uppercase tracking-[0.25em] text-white/40 duration-500 transform -translate-y-8 scale-75 top-8 -z-10 origin-[0] peer-focus:left-0 peer-focus:text-[#c5a059] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-8 pointer-events-none"
                      >
                        Tell us about your desires, dietary needs, or specific
                        interests
                      </label>
                    </motion.div>
                  </div>

                  {/* Submit */}
                  <motion.div
                    variants={itemVariants}
                    className="pt-8 flex flex-col items-start gap-6"
                  >
                    <button
                      type="submit"
                      disabled={formStatus === "submitting"}
                      className="group relative overflow-hidden flex items-center justify-between gap-6 border border-[#c5a059]/50 bg-transparent text-[#e8d2b2] pl-10 pr-4 py-3 rounded-full font-medium tracking-[0.15em] uppercase text-xs hover:border-[#c5a059] transition-all duration-700 hover:shadow-[0_0_40px_rgba(197,160,89,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="relative z-10 transition-colors duration-700 group-hover:text-white">
                        {formStatus === "submitting"
                          ? "Sending..."
                          : "Submit Request"}
                      </span>
                      <div className="w-10 h-10 rounded-full bg-[#c5a059] flex items-center justify-center relative z-10 group-hover:scale-110 transition-transform duration-700">
                        {formStatus === "submitting" ? (
                          <Loader2 className="w-4 h-4 text-black animate-spin" />
                        ) : (
                          <ArrowRight
                            className="w-4 h-4 text-black transform group-hover:translate-x-0.5 transition-transform duration-500"
                            strokeWidth={1.5}
                          />
                        )}
                      </div>
                    </button>
                    <p className="text-[10px] text-white/30 font-light uppercase tracking-[0.2em] pl-4">
                      Strict confidentiality observed.
                    </p>
                  </motion.div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          {/* --- CONCIERGE SIDEBAR --- */}
          <aside className="lg:sticky lg:top-32 h-fit">
            <motion.div
              className="relative rounded-[2.5rem] bg-[#070707] border border-white/5 p-12 overflow-hidden group"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-[radial-gradient(ellipse_at_top,rgba(197,160,89,0.1)_0%,transparent_70%)] pointer-events-none" />

              <div className="relative z-10">
                <Sparkles
                  className="w-8 h-8 text-[#c5a059] mb-8"
                  strokeWidth={1}
                />
                <h4 className="text-3xl font-serif text-white leading-snug tracking-wide">
                  The Concierge <br />
                  <span className="italic text-[#e8d2b2] font-light">
                    Promise
                  </span>
                </h4>
                <p className="text-sm text-white/50 leading-relaxed font-light mt-6">
                  Private events at Oasis are not merely privatized tours. They
                  are completely re-imagined journeys crafted to match the exact
                  tempo and desires of your guests.
                </p>

                <div className="w-full h-[1px] bg-gradient-to-r from-white/10 to-transparent my-10" />

                <h5 className="text-[9px] uppercase tracking-[0.4em] text-[#c5a059] font-medium mb-8">
                  The Process
                </h5>
                <div className="space-y-8 relative">
                  <div className="absolute left-[7px] top-2 bottom-4 w-[1px] bg-gradient-to-b from-[#c5a059]/30 to-transparent" />

                  {[
                    {
                      step: "I",
                      title: "Acknowledgment",
                      desc: "A personal response within 24 hours.",
                    },
                    {
                      step: "II",
                      title: "Clarity Call",
                      desc: "Refining the exact details of your vision.",
                    },
                    {
                      step: "III",
                      title: "The Proposal",
                      desc: "A custom itinerary and transparent pricing.",
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="relative flex gap-6 items-start group pl-8"
                    >
                      <div className="absolute left-0 top-1.5 w-4 h-4 bg-[#070707] flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#c5a059] group-hover:scale-150 transition-transform duration-500 shadow-[0_0_10px_rgba(197,160,89,0.5)]" />
                      </div>
                      <div>
                        <h6 className="text-[11px] font-medium text-[#e8d2b2] uppercase tracking-[0.2em] mb-2">
                          {item.title}
                        </h6>
                        <p className="text-[13px] text-white/40 font-light leading-relaxed">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </aside>
        </div>
      </section>
    </main>
  );
}
