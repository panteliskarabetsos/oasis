// src/app/booking/[id]/attendees/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Loader2,
  MapPin,
  Users,
  Phone,
  Mail,
  Info,
  User,
  CheckCircle2,
  Star,
  CreditCard,
  Edit3,
  ShieldCheck,
  AlertCircle,
  Leaf,
  Wheat,
  MilkOff,
  NutOff,
  Heart,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const DIETARY_OPTIONS = [
  { id: "Vegetarian", label: "Vegetarian", icon: Leaf },
  { id: "Vegan", label: "Vegan", icon: Heart },
  { id: "Gluten-Free", label: "Gluten-Free", icon: Wheat },
  { id: "Dairy-Free", label: "Dairy-Free", icon: MilkOff },
  { id: "Nut Allergy", label: "Nut Allergy", icon: NutOff },
];

export default function AttendeesPage() {
  const router = useRouter();
  const { id } = useParams();
  const draftId = Number(id);
  const searchParams = useSearchParams();
  const initialExpiresAtFromQuery = searchParams.get("expiresAt") || null;

  // 🔑 SECURITY: Grab token from the URL
  const token = searchParams.get("token") || "";

  // Draft expiry
  const [expiresAt, setExpiresAt] = useState(initialExpiresAtFromQuery);
  const {
    remainingMs,
    formatted: timeLeft,
    expired,
    progress: holdProgress,
  } = useDraftCountdown(expiresAt);
  const isUrgent = remainingMs > 0 && remainingMs < 5 * 60 * 1000; // Less than 5 mins

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Draft data
  const [counts, setCounts] = useState({ adults: 0, kids: 0 });
  const [unitPrices, setUnitPrices] = useState({ adult: 0, kid: 0 });
  const [totalAmount, setTotalAmount] = useState(0);
  const [experience, setExperience] = useState(null);
  const [slot, setSlot] = useState(null);

  // Primary contact
  const [pcName, setPcName] = useState("");
  const [pcEmail, setPcEmail] = useState("");
  const [pcPhone, setPcPhone] = useState("");

  // Auto-link primary contact name to first adult
  const [autoPcFromFirstAdult, setAutoPcFromFirstAdult] = useState(true);

  // Attendees array
  const expectedTotal = useMemo(
    () => Number(counts.adults || 0) + Number(counts.kids || 0),
    [counts],
  );
  const [attendees, setAttendees] = useState([]);

  const completedCount = useMemo(
    () =>
      attendees.filter(
        (a) => a.firstName?.trim() && a.lastName?.trim() && a.age !== "",
      ).length,
    [attendees],
  );
  const progressPct = expectedTotal
    ? Math.round((completedCount / expectedTotal) * 100)
    : 0;

  // Figure out the first adult
  const firstAdultIndex = useMemo(
    () => attendees.findIndex((a) => a.category === "adult"),
    [attendees],
  );
  const firstAdultFullName = useMemo(() => {
    if (firstAdultIndex === -1) return "";
    const a = attendees[firstAdultIndex] || {};
    const fn = (a.firstName || "").trim();
    const ln = (a.lastName || "").trim();
    return [fn, ln].filter(Boolean).join(" ");
  }, [firstAdultIndex, attendees]);

  // Keep pcName in sync with first adult while toggle is ON
  useEffect(() => {
    if (autoPcFromFirstAdult) setPcName(firstAdultFullName);
  }, [firstAdultFullName, autoPcFromFirstAdult]);

  useEffect(() => {
    if (expired) {
      toast.error(
        "Your reservation hold has expired. Please go back and select a new time.",
        { duration: 6000 },
      );
    }
  }, [expired]);

  // Fetch draft
  useEffect(() => {
    if (!Number.isFinite(draftId) || draftId <= 0) {
      setError("Invalid booking id.");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        // 🔑 SECURITY: Pass the token to the GET request
        const res = await fetch(
          `/api/bookings/drafts/${draftId}?token=${token}`,
          {
            cache: "no-store",
          },
        );
        if (!res.ok) {
          const msg =
            (await res.json().catch(() => ({})))?.error ||
            "Failed to load draft.";
          throw new Error(msg);
        }
        const data = await res.json();
        const d = data?.draft || data;

        if (d?.expiresAt) setExpiresAt(d.expiresAt);

        const st = String(d?.status || "").toLowerCase();
        if (st === "paid" || st === "converted" || data?.bookingId) {
          router.replace(`/booking/${draftId}/confirmation`);
          return;
        }

        setCounts({
          adults: Number(d?.counts?.adults || 0),
          kids: Number(d?.counts?.kids || 0),
        });

        const up = d?.unitPrices || {
          adult: Number(d?.unitPriceAdult || 0),
          kid: Number(
            d?.unitPriceKid != null ? d.unitPriceKid : d?.unitPriceAdult || 0,
          ),
        };
        setUnitPrices({
          adult: Number(up.adult || 0),
          kid: Number(up.kid || 0),
        });
        setTotalAmount(Number(d?.totalAmount || 0));
        setExperience(data?.experience || d?.experience || null);
        setSlot(data?.slot || d?.slot || null);

        const pc = d?.primary_contact || d?.primaryContact || null;
        if (pc) {
          setPcName(pc.name || "");
          setPcEmail(pc.email || "");
          setPcPhone(pc.phone || "");
          if (pc.name) setAutoPcFromFirstAdult(false);
        }

        const catList = makeCategoryList(
          Number(d?.counts?.adults || 0),
          Number(d?.counts?.kids || 0),
        );
        const existing = Array.isArray(d?.attendees) ? d.attendees : [];

        const initial = catList.map((cat, i) => {
          const rawAllergies = existing[i]?.allergies || "";
          const parsedDietary = DIETARY_OPTIONS.filter((opt) =>
            rawAllergies.includes(opt.id),
          ).map((o) => o.id);
          const parsedNotes = rawAllergies.replace(/Dietary:.*?\|/g, "").trim();

          return {
            firstName: existing[i]?.firstName || "",
            lastName: existing[i]?.lastName || "",
            age: existing[i]?.age ?? "",
            dietary: parsedDietary,
            notes: parsedNotes,
            category: cat,
          };
        });

        setAttendees(initial);
        setError("");
      } catch (e) {
        console.error(e);
        setError(e.message || "Failed to load draft.");
        toast.error(e.message || "Failed to load draft.");
      } finally {
        setLoading(false);
      }
    })();
  }, [draftId, router, token]);

  const when = useMemo(() => {
    if (!slot?.date) return null;
    const d =
      typeof slot.date === "string" ? parseISO(slot.date) : new Date(slot.date);
    return { dateLabel: format(d, "PPP"), timeLabel: format(d, "p") };
  }, [slot]);

  const priceBreakdown = useMemo(() => {
    const A = Number(counts.adults || 0);
    const K = Number(counts.kids || 0);
    const la = A * unitPrices.adult;
    const lk = K * unitPrices.kid;
    const sum = la + lk;
    return {
      lines: [
        A > 0 && {
          label: `Adults × ${A} @ ${eur(unitPrices.adult)}`,
          value: eur(la),
        },
        K > 0 && {
          label: `Kids × ${K} @ ${eur(unitPrices.kid)}`,
          value: eur(lk),
        },
      ].filter(Boolean),
      total: eur(sum),
    };
  }, [counts, unitPrices]);

  function onChangeAttendee(idx, field, value) {
    setAttendees((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a)),
    );
  }

  function toggleDietary(idx, optionId) {
    setAttendees((prev) =>
      prev.map((a, i) => {
        if (i === idx) {
          const currentDietary = a.dietary || [];
          const updatedDietary = currentDietary.includes(optionId)
            ? currentDietary.filter((id) => id !== optionId)
            : [...currentDietary, optionId];
          return { ...a, dietary: updatedDietary };
        }
        return a;
      }),
    );
  }

  async function handleSaveAndContinue() {
    const effectivePcName = autoPcFromFirstAdult
      ? firstAdultFullName || pcName
      : pcName;
    const issues = validate(attendees, counts, {
      name: effectivePcName,
      email: pcEmail,
      phone: pcPhone,
    });

    if (issues.length) {
      toast.error(issues[0]);
      return;
    }

    try {
      setSaving(true);
      // 🔑 SECURITY: Pass the token to the PATCH request
      const res = await fetch(
        `/api/bookings/drafts/${draftId}?token=${token}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            primaryContact: {
              name: (effectivePcName || "").trim(),
              email: pcEmail.trim(),
              phone: pcPhone.trim(),
            },
            attendees: attendees.map((a) => {
              const dietaryStr =
                a.dietary.length > 0 ? `Dietary: ${a.dietary.join(", ")}` : "";
              const combinedAllergies = [dietaryStr, a.notes.trim()]
                .filter(Boolean)
                .join(" | ");

              return {
                firstName: a.firstName.trim(),
                lastName: a.lastName.trim(),
                age: Number(a.age),
                allergies: combinedAllergies,
                category: a.category,
              };
            }),
          }),
        },
      );

      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ||
            "Could not save attendees.",
        );

      const params = new URLSearchParams();
      if (expiresAt) params.set("expiresAt", expiresAt);
      if (token) params.set("token", token); // 🔑 Forward token to payment page

      router.push(
        `/booking/${draftId}/payment${params.toString() ? `?${params.toString()}` : ""}`,
      );
    } catch (e) {
      toast.error(e.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fcf9f4] font-sans pb-32 sm:pb-16">
      {/* Top Nav */}
      <div className="bg-white border-b border-[#e5e0d8] sticky top-0 z-30 shadow-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 text-[#5a4a3f] text-sm border border-[#e0dcd4] rounded-full px-4 py-2 hover:bg-[#f4f1ec] transition-all"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <span className="hidden sm:inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#a09084] pl-2 border-l border-[#e0dcd4]">
              Step 2 of 3
            </span>
          </div>
          <Stepper current={2} />
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-8">
        {/* Urgency Banner */}
        <AnimatePresence>
          {expiresAt && !expired && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-8 rounded-2xl border px-5 py-4 shadow-sm overflow-hidden relative ${
                isUrgent
                  ? "bg-red-50 border-red-200"
                  : "bg-amber-50 border-amber-200"
              }`}
            >
              <div className="absolute bottom-0 left-0 h-1 bg-black/5 w-full">
                <div
                  className={`h-full transition-[width] duration-1000 ease-linear ${isUrgent ? "bg-red-500" : "bg-amber-500"}`}
                  style={{ width: `${holdProgress * 100}%` }}
                />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
                <div
                  className={`flex items-center gap-3 ${isUrgent ? "text-red-900" : "text-amber-900"}`}
                >
                  {isUrgent ? (
                    <AlertCircle className="h-5 w-5" />
                  ) : (
                    <Clock className="h-5 w-5" />
                  )}
                  <span className="text-sm font-medium">
                    {isUrgent
                      ? "Hurry! Your hold is about to expire."
                      : "We're holding your seats for this experience."}
                  </span>
                </div>
                <div
                  className={`text-xl font-mono font-bold tracking-tight ${isUrgent ? "text-red-600 animate-pulse" : "text-amber-700"}`}
                >
                  {timeLeft}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <LoadingBlock />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 xl:gap-12">
            {/* Left: Attendee forms */}
            <section className="lg:col-span-2 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-serif text-[#3a2f28]">
                    Guest Details
                  </h1>
                  <p className="mt-1 text-sm text-[#7a6a5f]">
                    Let us know who's coming so we can prepare for your visit.
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#a09084] mb-1.5">
                    Completed:{" "}
                    <span className="text-[#8b6f47]">{completedCount}</span> /{" "}
                    {expectedTotal}
                  </div>
                  <Progress value={progressPct} />
                </div>
              </div>

              {attendees.map((a, idx) => {
                const isComplete =
                  a.firstName?.trim() && a.lastName?.trim() && a.age !== "";
                return (
                  <div
                    key={idx}
                    className="rounded-3xl border border-[#e0dcd4] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
                  >
                    {/* Card Header */}
                    <div
                      className={`px-6 py-4 flex items-center justify-between border-b ${isComplete ? "bg-[#f4f8f4] border-[#d3e3d3]" : "bg-[#fdfaf5] border-[#e0dcd4]"}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${isComplete ? "bg-[#d3e3d3] text-[#4a7854]" : "bg-[#e9e3d9] text-[#8b6f47]"}`}
                        >
                          {idx + 1}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-[#3a2f28] flex items-center gap-2">
                            {a.firstName || a.lastName
                              ? `${a.firstName} ${a.lastName}`
                              : `Guest ${idx + 1}`}
                            {idx === firstAdultIndex && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#8b6f47] bg-white border border-[#e0dcd4] px-2 py-0.5 rounded-md shadow-sm">
                                <Star className="h-3 w-3" /> Primary
                              </span>
                            )}
                          </h3>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-[#a09084] mt-0.5">
                            {labelForCategory(a.category)}
                          </p>
                        </div>
                      </div>
                      {isComplete && (
                        <CheckCircle2 className="h-6 w-6 text-[#4a7854]" />
                      )}
                    </div>

                    {/* Card Body */}
                    <div className="p-6 space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <Field label="First Name">
                          <input
                            type="text"
                            value={a.firstName}
                            onChange={(e) =>
                              onChangeAttendee(idx, "firstName", e.target.value)
                            }
                            className={inputCls}
                            placeholder="e.g. Maria"
                          />
                        </Field>
                        <Field label="Last Name">
                          <input
                            type="text"
                            value={a.lastName}
                            onChange={(e) =>
                              onChangeAttendee(idx, "lastName", e.target.value)
                            }
                            className={inputCls}
                            placeholder="e.g. Papadopoulos"
                          />
                        </Field>
                      </div>

                      <div className="w-full sm:w-1/2">
                        <Field label="Age" hint={hintForCategory(a.category)}>
                          <input
                            type="number"
                            min={0}
                            value={a.age}
                            onChange={(e) =>
                              onChangeAttendee(idx, "age", e.target.value)
                            }
                            className={inputCls}
                            placeholder="Required for safety & groups"
                          />
                        </Field>
                      </div>

                      {/* Dietary & Special Needs Section */}
                      <div className="pt-5 border-t border-[#e0dcd4]">
                        <h4 className="text-sm font-bold text-[#3a2f28] mb-3 flex items-center gap-2">
                          Dietary Preferences & Allergies
                        </h4>

                        <div className="flex flex-wrap gap-2 mb-4">
                          {DIETARY_OPTIONS.map((opt) => {
                            const Icon = opt.icon;
                            const isSelected = a.dietary.includes(opt.id);
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => toggleDietary(idx, opt.id)}
                                aria-pressed={isSelected}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border shadow-sm ${
                                  isSelected
                                    ? "bg-[#8b6f47] text-white border-[#8b6f47] scale-105"
                                    : "bg-white text-[#7a6a5f] border-[#e0dcd4] hover:bg-[#fdfaf5] hover:border-[#8b6f47]"
                                }`}
                              >
                                <Icon
                                  size={12}
                                  className={
                                    isSelected ? "text-white" : "text-[#a09084]"
                                  }
                                />
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>

                        <Field label="Other Notes or Specific Allergies">
                          <textarea
                            value={a.notes}
                            onChange={(e) =>
                              onChangeAttendee(idx, "notes", e.target.value)
                            }
                            className={`${inputCls} resize-none`}
                            rows={2}
                            placeholder="Please specify any other requirements we should know about..."
                          />
                        </Field>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Right: summary + primary contact */}
            <section className="space-y-6">
              <div className="rounded-[2rem] border border-[#e0dcd4] bg-white p-6 sm:p-8 shadow-sm lg:sticky lg:top-24">
                <div className="mb-6 pb-6 border-b border-[#e0dcd4]">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#a09084] mb-2">
                    Booking Summary
                  </h3>
                  <h2 className="text-2xl font-serif text-[#3a2f28] leading-tight mb-3">
                    {experience?.name}
                  </h2>

                  <div className="space-y-2 text-sm font-medium text-[#7a6a5f]">
                    {when && (
                      <div className="flex items-center gap-2">
                        <CalendarDays size={16} className="text-[#8b6f47]" />{" "}
                        {when.dateLabel} at {when.timeLabel}
                      </div>
                    )}
                    {experience?.location && (
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-[#8b6f47]" />{" "}
                        {experience.location}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-6 space-y-2 text-sm text-[#5a4a3f]">
                  {priceBreakdown.lines.map((ln, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-[#7a6a5f]">{ln.label}</span>
                      <span className="font-semibold text-[#3a2f28]">
                        {ln.value}
                      </span>
                    </div>
                  ))}
                  <div className="pt-3 flex items-center justify-between">
                    <span className="font-bold text-[#3a2f28] uppercase tracking-wider text-xs">
                      Total Amount
                    </span>
                    <span className="text-2xl font-serif text-[#8b6f47]">
                      {priceBreakdown.total}
                    </span>
                  </div>
                </div>

                {/* Primary Contact Section */}
                <div className="pt-6 border-t border-[#e0dcd4]">
                  <h4 className="text-lg font-serif text-[#3a2f28] mb-1">
                    Booking Contact
                  </h4>
                  <p className="text-xs text-[#7a6a5f] mb-5">
                    Your tickets and updates will be sent here.
                  </p>

                  <div className="flex items-center justify-between rounded-xl border border-[#e0dcd4] bg-[#fdfaf5] px-4 py-3 mb-4">
                    <div className="text-xs font-semibold text-[#5a4a3f]">
                      Use Guest 1 as contact
                    </div>
                    <button
                      type="button"
                      onClick={() => setAutoPcFromFirstAdult((v) => !v)}
                      className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${autoPcFromFirstAdult ? "bg-[#8b6f47]" : "bg-gray-300"}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoPcFromFirstAdult ? "translate-x-5" : "translate-x-1"}`}
                      />
                    </button>
                  </div>

                  <div className="space-y-4 mb-6">
                    <Field label="Full Name">
                      <div className="relative">
                        <User className="w-4 h-4 text-[#a09084] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={
                            autoPcFromFirstAdult
                              ? firstAdultFullName || pcName
                              : pcName
                          }
                          onChange={(e) => setPcName(e.target.value)}
                          disabled={autoPcFromFirstAdult}
                          className={`${inputCls} pl-10 ${autoPcFromFirstAdult ? "opacity-70 bg-[#fdfaf5]" : ""}`}
                          placeholder="e.g. Maria Papadopoulos"
                        />
                      </div>
                    </Field>

                    <Field label="Email Address">
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[#a09084] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="email"
                          value={pcEmail}
                          onChange={(e) => setPcEmail(e.target.value)}
                          className={`${inputCls} pl-10`}
                          placeholder="For your tickets"
                        />
                      </div>
                    </Field>

                    <Field label="Phone Number">
                      <div className="relative">
                        <Phone className="w-4 h-4 text-[#a09084] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="tel"
                          value={pcPhone}
                          onChange={(e) => setPcPhone(e.target.value)}
                          placeholder="For day-of updates"
                          className={`${inputCls} pl-10`}
                        />
                      </div>
                    </Field>
                  </div>

                  <button
                    type="button"
                    disabled={saving || expectedTotal === 0 || expired}
                    onClick={handleSaveAndContinue}
                    className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 ${
                      saving || expectedTotal === 0 || expired
                        ? "bg-gray-300 text-white cursor-not-allowed shadow-none"
                        : "bg-[#1A1A1A] hover:bg-[#C8AA86] text-white"
                    }`}
                  >
                    {saving ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <CreditCard className="w-5 h-5" />
                    )}
                    {expired ? "Hold Expired" : "Proceed to Payment"}
                  </button>
                  <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-[#a09084]">
                    <ShieldCheck size={14} className="text-[#8b6f47]" /> Secure
                    & Encrypted
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Mobile Bottom Bar */}
      {!loading && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-[#e0dcd4] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)]">
          <div className="p-4 px-6 flex items-center justify-between gap-4 max-w-md mx-auto">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8b7a6b]">
                Total
              </span>
              <span className="font-serif text-2xl text-[#1A1A1A] leading-none mt-1">
                {priceBreakdown.total}
              </span>
            </div>
            <button
              type="button"
              disabled={saving || expectedTotal === 0 || expired}
              onClick={handleSaveAndContinue}
              className="bg-[#1A1A1A] text-white px-8 py-4 rounded-full font-bold text-xs uppercase tracking-[0.15em] hover:bg-[#C8AA86] transition-colors shadow-lg disabled:bg-gray-300 w-full sm:w-auto active:scale-95"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : expired ? (
                "Expired"
              ) : (
                "Pay Now"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- helpers & small components ---------- */

function Stepper({ current = 2 }) {
  const steps = [
    { id: 1, label: "Group" },
    { id: 2, label: "Guests" },
    { id: 3, label: "Pay" },
  ];
  return (
    <div className="w-full sm:w-64">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-[#e0dcd4] z-0" />
        {steps.map((s) => {
          const active = s.id === current;
          const passed = s.id < current;
          return (
            <div
              key={s.id}
              className="relative z-10 flex flex-col items-center gap-1.5 bg-white px-2"
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                  active
                    ? "bg-[#8b6f47] text-white ring-4 ring-[#8b6f47]/20"
                    : passed
                      ? "bg-[#e9e3d9] text-[#8b6f47]"
                      : "bg-white border-2 border-[#e0dcd4] text-[#a09084]"
                }`}
              >
                {passed ? <CheckCircle2 size={12} /> : s.id}
              </div>
              <span
                className={`text-[9px] font-bold uppercase tracking-wider ${active ? "text-[#3a2f28]" : "text-[#a09084]"}`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Progress({ value = 0 }) {
  return (
    <div className="w-32 h-1.5 rounded-full bg-[#e9e3d9] overflow-hidden">
      <div
        className="h-full bg-[#4a7854] rounded-full transition-all duration-500"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold uppercase tracking-wider text-[#a09084] pl-1">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[10px] text-[#8b6f47] pl-1 font-medium">{hint}</p>
      )}
    </div>
  );
}

const inputCls =
  "w-full p-3 rounded-xl border border-[#e0dcd4] bg-white focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30 text-[#3a2f28] placeholder:text-[#a09084] shadow-sm transition-all";

function makeCategoryList(adults, kids) {
  const arr = [];
  for (let i = 0; i < adults; i++) arr.push("adult");
  for (let i = 0; i < kids; i++) arr.push("kid");
  return arr;
}

function labelForCategory(c) {
  if (c === "adult") return "Adult (16+)";
  if (c === "kid") return "Child (3–15)";
  return c;
}

function hintForCategory(c) {
  if (c === "adult") return "Must be 16 or older.";
  if (c === "kid") return "Must be between 3 and 15 years.";
  return "";
}

function eur(n) {
  return `€${(Number(n) || 0).toFixed(2)}`;
}

function isValidEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validate(attendees, counts, primaryContact) {
  const issues = [];
  const expected = Number(counts.adults || 0) + Number(counts.kids || 0);

  if (attendees.length !== expected) {
    issues.push(`Expected ${expected} attendees, found ${attendees.length}.`);
  }

  let hasEighteenPlus = false;

  attendees.forEach((a, i) => {
    const idx = i + 1;
    const age = Number(a.age);

    if (!a.firstName?.trim() || !a.lastName?.trim()) {
      issues.push(`Guest ${idx}: Name is required.`);
      return;
    }
    if (!Number.isFinite(age)) {
      issues.push(`Guest ${idx}: Age is required for group balancing.`);
      return;
    }
    if (age < 0 || age > 100) {
      issues.push(`Guest ${idx}: Age looks invalid.`);
      return;
    }

    if (a.category === "adult" && age < 16)
      issues.push(`Guest ${idx}: Adults must be 16+.`);
    else if (a.category === "kid" && (age < 3 || age > 15))
      issues.push(`Guest ${idx}: Children must be 3–15.`);

    if (age >= 18) hasEighteenPlus = true;
  });

  if (!hasEighteenPlus) issues.push("At least one guest must be 18+.");
  if (!primaryContact.name?.trim())
    issues.push("Booking Contact: Name is required.");
  if (!isValidEmail(primaryContact.email))
    issues.push("Booking Contact: Valid email is required for tickets.");

  return issues;
}

function LoadingBlock() {
  return (
    <div className="animate-pulse space-y-8 mt-8">
      <div className="h-40 bg-[#e0dcd4]/30 rounded-3xl" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-64 bg-[#e0dcd4]/30 rounded-3xl" />
          <div className="h-64 bg-[#e0dcd4]/30 rounded-3xl" />
        </div>
        <div className="h-96 bg-[#e0dcd4]/30 rounded-3xl" />
      </div>
    </div>
  );
}

function useDraftCountdown(expiresAtIso) {
  const [remainingMs, setRemainingMs] = useState(() => {
    if (!expiresAtIso) return 0;
    const ts = Date.parse(expiresAtIso);
    if (!Number.isFinite(ts)) return 0;
    return Math.max(0, ts - Date.now());
  });

  const [initialMs, setInitialMs] = useState(() => {
    if (!expiresAtIso) return 0;
    const ts = Date.parse(expiresAtIso);
    if (!Number.isFinite(ts)) return 0;
    return Math.max(0, ts - Date.now());
  });

  useEffect(() => {
    if (!expiresAtIso) {
      setRemainingMs(0);
      setInitialMs(0);
      return;
    }

    const ts = Date.parse(expiresAtIso);
    if (!Number.isFinite(ts)) return;

    const update = () => setRemainingMs(Math.max(0, ts - Date.now()));
    setInitialMs(Math.max(0, ts - Date.now()));
    update();

    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAtIso]);

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const expired = remainingMs <= 0;
  const progress =
    initialMs > 0 ? Math.max(0, Math.min(1, remainingMs / initialMs)) : 0;

  return { remainingMs, formatted, expired, progress };
}
