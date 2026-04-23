// admin/bookings/new/page.js
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clock3,
  Loader2,
  Save,
  Search,
  Users,
  User,
  Mail,
  Phone,
  Calendar as CalIcon,
  CreditCard,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Settings,
  AlertCircle,
} from "lucide-react";

/* ---------------------------- Constants & Styles ---------------------------- */
const MAX_GROUP = 100;
const MIN_ADULTS = 1;

// Replaces the injected <style> tag with standard Tailwind
const inputStyles =
  "w-full rounded-xl border border-black/10 bg-white/50 px-4 py-2.5 text-sm transition-all focus:border-[#a3845b] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#a3845b]/10 dark:border-white/10 dark:bg-white/5 dark:focus:bg-white/10 dark:focus:ring-[#a3845b]/20 placeholder:text-black/40 dark:placeholder:text-white/40";

/* ----------------------------- Page Component ----------------------------- */
export default function NewBookingPage() {
  const router = useRouter();
  const [rangeDays, setRangeDays] = useState(60);
  const today = useMemo(() => fmtYMD(new Date()), []);
  const toDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + rangeDays);
    return fmtYMD(d);
  }, [rangeDays]);

  /* ---------- Auth Gate ---------- */
  const [auth, setAuth] = useState({ loading: true, ok: true });
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (!ignore) setAuth({ loading: false, ok: res.ok });
      } catch {
        if (!ignore) setAuth({ loading: false, ok: true });
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  /* ---------- Steps & State ---------- */
  const [step, setStep] = useState(1);

  const [experienceQuery, setExperienceQuery] = useState("");
  const [experiences, setExperiences] = useState([]);
  const [expLoading, setExpLoading] = useState(false);
  const [experienceId, setExperienceId] = useState(null);

  const [date, setDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState(null);

  const [privateBooking, setPrivateBooking] = useState(false);
  const [privateSlot, setPrivateSlot] = useState({
    date: "",
    startTime: "",
    durationMinutes: 90,
    capacity: MAX_GROUP,
    note: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedDate, setSelectedDate] = useState("");
  const [availLoading, setAvailLoading] = useState(false);
  const [availability, setAvailability] = useState([]);

  /* ---------- Form State ---------- */
  const [form, setForm] = useState({
    status: "confirmed",
    notes: "",
    adultsCount: 1,
    kidsCount: 0,
    unitPriceAdult: "",
    unitPriceKid: "",
    totalPaidAmount: "",
    currency: "EUR",
    primary_contact: {
      firstName: "",
      lastName: "",
      name: "",
      email: "",
      phone: "",
    },
    attendees: [],
    stripeSessionId: "",
    stripePaymentIntentId: "",
  });

  const [priceDirty, setPriceDirty] = useState({
    adult: false,
    kid: false,
    currency: false,
  });

  const numberOfPeople = useMemo(
    () => (parseInt(form.adultsCount) || 0) + (parseInt(form.kidsCount) || 0),
    [form.adultsCount, form.kidsCount],
  );
  const priceAdult = useMemo(
    () =>
      form.unitPriceAdult === "" ? 0 : parseFloat(form.unitPriceAdult) || 0,
    [form.unitPriceAdult],
  );
  const priceKid = useMemo(
    () => (form.unitPriceKid === "" ? 0 : parseFloat(form.unitPriceKid) || 0),
    [form.unitPriceKid],
  );

  const toMoney = (n) => Number(n ?? 0).toFixed(2);
  const estimate = useMemo(
    () =>
      (parseInt(form.adultsCount) || 0) * priceAdult +
      (parseInt(form.kidsCount) || 0) * priceKid,
    [form.adultsCount, form.kidsCount, priceAdult, priceKid],
  );

  const selectedSlot = useMemo(
    () =>
      !privateBooking
        ? (slots || []).find((s) => s.id === selectedSlotId)
        : null,
    [privateBooking, slots, selectedSlotId],
  );

  const slotRemaining = useMemo(() => {
    if (privateBooking) return Infinity;
    const cap = selectedSlot?.capacity ?? MAX_GROUP;
    const booked = selectedSlot?.booked ?? 0;
    return Math.max(0, cap - booked);
  }, [privateBooking, selectedSlot]);

  const effectiveGroupMax = useMemo(() => {
    return privateBooking ? Infinity : Math.min(MAX_GROUP, slotRemaining);
  }, [privateBooking, slotRemaining]);

  const uiGroupMax = Number.isFinite(effectiveGroupMax)
    ? effectiveGroupMax
    : 999;

  const [customExperienceName, setCustomExperienceName] = useState("");
  const privateNameRef = useRef(null);

  /* ---------- Effects ---------- */
  useEffect(() => {
    if (privateBooking) privateNameRef.current?.focus();
  }, [privateBooking]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!experienceQuery) {
        setExperiences([]);
        return;
      }
      setExpLoading(true);
      try {
        const res = await fetch(
          `/api/admin/experiences/search?q=${encodeURIComponent(experienceQuery)}`,
        );
        const data = await res.json().catch(() => ({}));
        setExperiences(data?.items || []);
      } catch {
        setExperiences([]);
      } finally {
        setExpLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [experienceQuery]);

  useEffect(() => {
    if (privateBooking || !experienceId || !selectedSlotId) return;
    let cancelled = false;

    (async () => {
      const slot = (slots || []).find((s) => s.id === selectedSlotId);
      const slotAdult = slot?.priceAdult ?? slot?.unitPriceAdult ?? null;
      const slotKid = slot?.priceKid ?? slot?.unitPriceKid ?? null;
      const slotCurr = slot?.currency ?? null;

      let filled = false;
      if (!priceDirty.adult && slotAdult != null) {
        setField("unitPriceAdult", toMoney(slotAdult));
        filled = true;
      }
      if (!priceDirty.kid && slotKid != null) {
        setField("unitPriceKid", toMoney(slotKid));
        filled = true;
      }
      if (!priceDirty.currency && slotCurr) {
        setField("currency", slotCurr);
        filled = true;
      }

      if (filled) return;

      try {
        const res = await fetch(`/api/admin/experiences/?id=${experienceId}`, {
          cache: "no-store",
        });
        const j = await res.json().catch(() => ({}));
        const exp = j?.experience || j || {};

        const expAdult = exp.priceAdult ?? exp.unitPriceAdult ?? null;
        const expKid = exp.priceKid ?? exp.unitPriceKid ?? null;
        const expCurr = exp.currency ?? null;

        if (!priceDirty.adult && expAdult != null)
          setField("unitPriceAdult", toMoney(expAdult));
        if (!priceDirty.kid && expKid != null)
          setField("unitPriceKid", toMoney(expKid));
        if (!priceDirty.currency && expCurr) setField("currency", expCurr);
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [privateBooking, experienceId, selectedSlotId, slots, priceDirty]);

  useEffect(() => {
    (async () => {
      if (!experienceId || privateBooking) {
        setAvailability([]);
        setSelectedDate("");
        return;
      }
      setAvailLoading(true);
      try {
        const url = `/api/admin/schedule-slots/availability?experienceId=${experienceId}&from=${today}&to=${toDate}`;
        const res = await fetch(url);
        const data = await res.json().catch(() => ({}));
        const days = Array.isArray(data?.days) ? data.days : [];
        setAvailability(days);

        const open = days.find(
          (d) => (d.slots ?? 0) > 0 && (d.capacity ?? 0) > (d.booked ?? 0),
        );
        setSelectedDate(open?.date || "");
      } catch {
        setAvailability([]);
        setSelectedDate("");
      } finally {
        setAvailLoading(false);
      }
    })();
  }, [experienceId, privateBooking, today, toDate]);

  useEffect(() => {
    if (selectedDate) setDate(selectedDate);
  }, [selectedDate]);

  /* ---------- Helpers ---------- */
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setContact = (k, v) =>
    setForm((f) => ({
      ...f,
      primary_contact: { ...(f.primary_contact || {}), [k]: v },
    }));
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const bumpAdults = (d) => {
    const a = parseInt(form.adultsCount) || 0;
    const k = parseInt(form.kidsCount) || 0;
    if (privateBooking) {
      setForm((f) => ({ ...f, adultsCount: Math.max(MIN_ADULTS, a + d) }));
      return;
    }
    const nextA = clamp(a + d, MIN_ADULTS, uiGroupMax);
    const remain = Math.max(0, uiGroupMax - nextA);
    setForm((f) => ({
      ...f,
      adultsCount: nextA,
      kidsCount: clamp(k, 0, remain),
    }));
  };

  const bumpKids = (d) => {
    const a = parseInt(form.adultsCount) || 0;
    const k = parseInt(form.kidsCount) || 0;
    if (privateBooking) {
      setForm((f) => ({ ...f, kidsCount: Math.max(0, k + d) }));
      return;
    }
    setForm((f) => ({
      ...f,
      kidsCount: clamp(k + d, 0, Math.max(0, uiGroupMax - a)),
    }));
  };

  const setFirstName = (v) =>
    setForm((f) => ({
      ...f,
      primary_contact: {
        ...(f.primary_contact || {}),
        firstName: v,
        name: [v, f.primary_contact?.lastName || ""]
          .filter(Boolean)
          .join(" ")
          .trim(),
      },
    }));

  const setLastName = (v) =>
    setForm((f) => ({
      ...f,
      primary_contact: {
        ...(f.primary_contact || {}),
        lastName: v,
        name: [f.primary_contact?.firstName || "", v]
          .filter(Boolean)
          .join(" ")
          .trim(),
      },
    }));

  const canEnterStep2 =
    privateBooking || (!!experienceId && !!selectedDate && !!selectedSlotId);
  const canEnterStep3 =
    !!privateBooking || (!!selectedDate && !!selectedSlotId);
  const canContinueStep1 = canEnterStep2;

  function validate() {
    if (privateBooking) {
      if (!customExperienceName?.trim())
        return "Enter a name for the private booking.";
      if (!privateSlot.date) return "Select a date for the private booking.";
      if (!privateSlot.startTime) return "Select a start time.";
      if (
        !Number.isFinite(Number(privateSlot.durationMinutes)) ||
        Number(privateSlot.durationMinutes) <= 0
      )
        return "Duration must be positive.";
    } else {
      if (!experienceId) return "Please select an experience.";
      if (!selectedDate) return "Select a date.";
      if (!selectedSlotId) return "Select an available slot.";
    }

    const first = (form.primary_contact?.firstName || "").trim();
    const last = (form.primary_contact?.lastName || "").trim();
    const email = (form.primary_contact?.email || "").trim();
    const phone = (form.primary_contact?.phone || "").trim();

    if (!first) return "First name is required.";
    if (!last) return "Surname is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return "Primary contact email is invalid.";
    const phoneDigits = phone.replace(/\D/g, "");
    if (!phoneDigits || phoneDigits.length < 7)
      return "Phone number looks invalid.";

    const a = parseInt(form.adultsCount) || 0;
    const k = parseInt(form.kidsCount) || 0;
    if (a < MIN_ADULTS) return "At least one adult is required.";
    if (a + k < 1) return "Number of people must be at least 1.";

    if (!privateBooking) {
      const slot = (slots || []).find((s) => s.id === selectedSlotId);
      const cap = Math.min(
        MAX_GROUP,
        Math.max(0, (slot?.capacity ?? MAX_GROUP) - (slot?.booked ?? 0)),
      );
      if (a + k > cap)
        return `Group exceeds the allowed maximum for this slot (max ${cap}).`;
    }

    if (form.unitPriceAdult !== "" && (isNaN(priceAdult) || priceAdult < 0))
      return "Adult unit price must be ≥ 0.";
    if (form.unitPriceKid !== "" && (isNaN(priceKid) || priceKid < 0))
      return "Kid unit price must be ≥ 0.";
    if (
      form.totalPaidAmount !== "" &&
      (isNaN(parseFloat(form.totalPaidAmount)) ||
        parseFloat(form.totalPaidAmount) < 0)
    )
      return "Total paid amount must be ≥ 0.";

    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setSubmitting(true);
    try {
      const common = {
        status: String(form.status || "confirmed").toLowerCase(),
        notes: form.notes?.trim() || null,
        numberOfPeople,
        adultsCount: Number(form.adultsCount),
        kidsCount: Number(form.kidsCount),
        counts: {
          adults: Number(form.adultsCount),
          kids: Number(form.kidsCount),
          total: numberOfPeople,
        },
        unitPriceAdult:
          form.unitPriceAdult === "" ? null : Number(priceAdult.toFixed(2)),
        unitPriceKid:
          form.unitPriceKid === "" ? null : Number(priceKid.toFixed(2)),
        totalPaidAmount:
          form.totalPaidAmount === ""
            ? null
            : Number(parseFloat(form.totalPaidAmount).toFixed(2)),
        currency: form.currency || "EUR",
        primary_contact: {
          name: (form.primary_contact?.name || "").trim(),
          firstName: (form.primary_contact?.firstName || "").trim(),
          lastName: (form.primary_contact?.lastName || "").trim(),
          email: (form.primary_contact?.email || "").trim().toLowerCase(),
          phone: (form.primary_contact?.phone || "").trim(),
        },
        attendees: form.attendees?.length ? form.attendees : null,
        stripeSessionId: form.stripeSessionId?.trim() || null,
        stripePaymentIntentId: form.stripePaymentIntentId?.trim() || null,
      };

      const isPrivate = !!privateBooking;
      const url = isPrivate
        ? "/api/admin/private-reservations"
        : "/api/admin/reservations";
      const payload = isPrivate
        ? {
            ...common,
            experienceId: experienceId ? Number(experienceId) : null,
            customExperienceName: (customExperienceName || "").trim(),
            date: privateSlot.date,
            startTime: privateSlot.startTime,
          }
        : {
            ...common,
            scheduleSlotId: Number(selectedSlotId),
          };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const j = await safeJson(res);
        throw new Error(
          j?.error || `Failed to create ${isPrivate ? "private " : ""}booking`,
        );
      }

      const data = await res.json();
      const item = data?.item || data;
      setSuccess("Booking created successfully.");
      setTimeout(() => {
        router.push(
          item?.id ? `/admin/bookings/${item.id}` : "/admin/bookings",
        );
      }, 600);
    } catch (err) {
      setError(err?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (auth.loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#a3845b]" />
      </div>
    );
  }

  if (!auth.ok) {
    return (
      <div className="mx-auto max-w-xl p-6 text-center mt-20">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
        <p className="text-sm text-red-600 font-medium">
          Access denied. Please sign in as an admin.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-black/10 px-5 py-2 hover:bg-black/5 transition"
        >
          <ArrowLeft className="h-4 w-4" /> Go home
        </Link>
      </div>
    );
  }

  return (
    <main className="rounded-3xl min-h-screen bg-[linear-gradient(180deg,#f6f3ee,transparent_30%),radial-gradient(800px_400px_at_10%_-20%,#f0eadf,transparent),radial-gradient(600px_300px_at_90%_-10%,#efe7da,transparent)] text-[#2f2f2f] transition-colors duration-500 dark:bg-[#0a0a0a] dark:text-[#e9e4da]">
      {/* Sticky header */}
      <div className="rounded-t-3xl sticky top-0 z-20 border-b border-black/5 bg-white/70 backdrop-blur-md dark:border-white/10 dark:bg-[#0a0a0a]/80 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/bookings"
              className="inline-flex items-center gap-2 text-sm font-medium opacity-70 hover:opacity-100 transition-opacity bg-black/5 dark:bg-white/10 px-3 py-1.5 rounded-full"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            <span className="hidden text-sm opacity-40 md:inline">/</span>
            <span className="text-sm font-semibold tracking-wide">
              New Booking
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              form="booking-form"
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#a3845b] to-[#b79266] px-5 py-2 text-sm font-medium text-white shadow-md hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {submitting ? "Saving…" : "Save Booking"}
            </button>
          </div>
        </div>
      </div>

      <section className="px-4 py-8 md:px-6 md:py-12">
        <div className="mx-auto max-w-6xl">
          <Stepper
            step={step}
            onStep={(s) => {
              if (s === 2 && !canEnterStep2) return;
              if (s === 3 && !canEnterStep3) return;
              setStep(s);
            }}
            canEnterStep2={canEnterStep2}
            canEnterStep3={canEnterStep3}
          />

          {/* Form Status Banners */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-6 rounded-xl border border-red-500/30 bg-red-50/80 px-4 py-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200 flex items-center gap-3 shadow-sm"
              >
                <AlertCircle className="w-4 h-4" /> {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200 flex items-center gap-3 shadow-sm"
              >
                <Check className="w-4 h-4" /> {success}
              </motion.div>
            )}
          </AnimatePresence>

          <form
            id="booking-form"
            onSubmit={handleSubmit}
            className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3"
          >
            {/* LEFT: Steps Area */}
            <div className="md:col-span-2 relative">
              <AnimatePresence mode="wait">
                {/* STEP 1 */}
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card title="Step 1 — Experience & Date">
                      <div className="grid gap-6 md:grid-cols-3">
                        <div className="md:col-span-2">
                          {!privateBooking && (
                            <div className="flex items-end gap-3">
                              <div className="flex-1">
                                <ComboBox
                                  label="Experience"
                                  placeholder="Search experiences…"
                                  value={experienceId}
                                  onQuery={setExperienceQuery}
                                  onChange={(v) => setExperienceId(Number(v))}
                                  loading={expLoading}
                                  options={experiences.map((x) => ({
                                    value: x.id,
                                    label: x.name,
                                  }))}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setPrivateBooking(true);
                                  setExperienceId(null);
                                  setSelectedDate("");
                                  setSelectedSlotId(null);
                                  setSlots([]);
                                  setAvailability([]);
                                }}
                                className="h-[42px] rounded-xl border border-black/10 px-4 text-xs font-medium hover:bg-black/5 transition dark:border-white/10 dark:hover:bg-white/10"
                              >
                                Clear
                              </button>
                            </div>
                          )}
                          {expLoading && (
                            <div className="mt-3 animate-pulse rounded-xl bg-black/5 dark:bg-white/5 h-10 w-full" />
                          )}
                          {!expLoading &&
                            experienceId == null &&
                            experienceQuery &&
                            !experiences.length && (
                              <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/10 dark:text-amber-200">
                                No experiences found. Try a different term.
                              </div>
                            )}
                        </div>

                        <Field
                          label="Mode"
                          icon={<ShieldCheck className="h-4 w-4" />}
                        >
                          <div className="flex rounded-xl border border-black/10 bg-white/50 p-1 dark:border-white/10 dark:bg-black/20 shadow-inner">
                            <button
                              type="button"
                              onClick={() => setPrivateBooking(false)}
                              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${!privateBooking ? "bg-[#a3845b] text-white shadow-md" : "text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"}`}
                            >
                              <div className="flex items-center justify-center gap-2">
                                <Users className="h-4 w-4" /> Public
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => setPrivateBooking(true)}
                              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${privateBooking ? "bg-[#a3845b] text-white shadow-md" : "text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"}`}
                            >
                              <div className="flex items-center justify-center gap-2">
                                <Sparkles className="h-4 w-4" /> Private
                              </div>
                            </button>
                          </div>
                        </Field>

                        {/* PUBLIC FLOW */}
                        {!privateBooking && (
                          <>
                            <div className="md:col-span-3 space-y-4">
                              {!!availability?.length && (
                                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-black/5 p-3 dark:bg-white/5">
                                  <span className="text-xs font-semibold uppercase tracking-wider opacity-60 mr-2">
                                    Quick Picks
                                  </span>
                                  {availability
                                    .filter(
                                      (d) =>
                                        (d.slots ?? 0) > 0 &&
                                        (d.capacity ?? 0) > (d.booked ?? 0),
                                    )
                                    .slice(0, 3)
                                    .map((d) => {
                                      const isActive = selectedDate === d.date;
                                      return (
                                        <button
                                          key={d.date}
                                          type="button"
                                          onClick={() => {
                                            setSelectedDate(d.date);
                                            setSelectedSlotId(null);
                                            setSlots([]);
                                          }}
                                          className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-all ${isActive ? "border-[#a3845b] bg-[#a3845b] text-white shadow-md" : "border-black/10 bg-white hover:border-[#a3845b]/50 dark:border-white/10 dark:bg-black"}`}
                                        >
                                          {fmtDMY(d.date)} • {d.slots} slots
                                        </button>
                                      );
                                    })}
                                </div>
                              )}

                              <AvailabilityCalendar
                                loading={availLoading}
                                days={availability}
                                selectedDate={selectedDate}
                                onSelectDate={(d) => {
                                  setSelectedDate(d);
                                  setSelectedSlotId(null);
                                  setSlots([]);
                                }}
                                onNavigateRange={(daysAhead) =>
                                  setRangeDays(daysAhead)
                                }
                              />

                              <div className="flex items-center justify-between px-2">
                                <div className="text-sm flex items-center gap-2">
                                  <span className="opacity-60">
                                    Selected date:
                                  </span>
                                  {selectedDate ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#a3845b]/10 text-[#a3845b] px-3 py-1 font-semibold border border-[#a3845b]/20">
                                      <CalIcon className="h-3.5 w-3.5" />{" "}
                                      {fmtDMY(selectedDate)}
                                    </span>
                                  ) : (
                                    <span className="opacity-60">—</span>
                                  )}
                                </div>
                                {!!selectedDate && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedDate("");
                                      setSelectedSlotId(null);
                                      setSlots([]);
                                    }}
                                    className="text-xs font-medium text-red-500/80 hover:text-red-500 transition"
                                  >
                                    Clear date
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="md:col-span-3">
                              <SlotsForDate
                                experienceId={experienceId}
                                date={selectedDate}
                                slots={slots}
                                setSlots={setSlots}
                                loading={slotsLoading}
                                setLoading={setSlotsLoading}
                                selected={selectedSlotId}
                                onSelect={setSelectedSlotId}
                              />
                            </div>
                          </>
                        )}

                        {/* PRIVATE FLOW */}
                        {privateBooking && (
                          <div className="md:col-span-3 space-y-6 mt-4 border-t border-black/5 dark:border-white/5 pt-6">
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                              <Field label="Custom Event Name">
                                <input
                                  ref={privateNameRef}
                                  value={customExperienceName}
                                  onChange={(e) =>
                                    setCustomExperienceName(e.target.value)
                                  }
                                  placeholder="e.g., VIP Sunset Tour for Acme Inc."
                                  className={inputStyles}
                                />
                              </Field>
                              <Field
                                label="Date"
                                icon={<CalIcon className="h-4 w-4" />}
                              >
                                <input
                                  type="date"
                                  value={privateSlot.date}
                                  min={fmtYMD(new Date())}
                                  onChange={(e) =>
                                    setPrivateSlot((s) => ({
                                      ...s,
                                      date: e.target.value,
                                    }))
                                  }
                                  className={inputStyles}
                                />
                              </Field>
                              <Field
                                label="Start time"
                                icon={<Clock3 className="h-4 w-4" />}
                              >
                                <input
                                  type="time"
                                  step={900}
                                  value={privateSlot.startTime}
                                  onChange={(e) =>
                                    setPrivateSlot((s) => ({
                                      ...s,
                                      startTime: e.target.value,
                                    }))
                                  }
                                  disabled={!privateSlot.date}
                                  className={inputStyles}
                                />
                              </Field>
                              <Field
                                label="Duration (hours)"
                                icon={<Settings className="h-4 w-4" />}
                              >
                                <input
                                  type="number"
                                  min={0.5}
                                  step={0.5}
                                  value={minutesToHours(
                                    privateSlot.durationMinutes,
                                  )}
                                  onChange={(e) =>
                                    setPrivateSlot((s) => ({
                                      ...s,
                                      durationMinutes: hoursToMinutes(
                                        e.target.value,
                                      ),
                                    }))
                                  }
                                  className={inputStyles}
                                />
                              </Field>
                            </div>

                            <Field
                              label="Internal Event Notes"
                              icon={<StickyNote className="h-4 w-4" />}
                            >
                              <textarea
                                rows={4}
                                value={privateSlot.note}
                                onChange={(e) =>
                                  setPrivateSlot((s) => ({
                                    ...s,
                                    note: e.target.value,
                                  }))
                                }
                                className={`${inputStyles} resize-y min-h-[100px]`}
                                placeholder="Optional prep notes (visible to staff only)"
                              />
                            </Field>
                          </div>
                        )}
                      </div>

                      {/* Step Footer */}
                      <div className="mt-8 flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-6">
                        <div className="text-xs font-medium text-amber-600 dark:text-amber-400">
                          {!canContinueStep1 &&
                            "Complete the fields above to continue."}
                        </div>
                        <button
                          type="button"
                          onClick={() => setStep(2)}
                          disabled={!canEnterStep2}
                          className="inline-flex items-center gap-2 rounded-full bg-[#2f2f2f] dark:bg-white text-white dark:text-black px-6 py-2.5 text-sm font-medium shadow-md transition hover:bg-black disabled:opacity-50"
                        >
                          Next Step
                        </button>
                      </div>
                    </Card>
                  </motion.div>
                )}

                {/* STEP 2 */}
                {step === 2 && canEnterStep2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card title="Step 2 — People & Pricing">
                      {(() => {
                        const slot = !privateBooking
                          ? (slots || []).find((s) => s.id === selectedSlotId)
                          : null;
                        const totalCap = slot?.capacity ?? 0;
                        const bookedBefore = slot?.booked ?? 0;
                        const remaining = Math.max(0, totalCap - bookedBefore);
                        const adults = parseInt(form.adultsCount) || 0;
                        const kids = parseInt(form.kidsCount) || 0;
                        const groupMax = privateBooking ? Infinity : remaining;
                        const uiMax = Number.isFinite(groupMax)
                          ? groupMax
                          : 999;
                        const adultMax = uiMax;
                        const kidMax = Math.max(0, uiMax - adults);
                        const paid =
                          form.totalPaidAmount === ""
                            ? 0
                            : parseFloat(form.totalPaidAmount) || 0;
                        const balance = +(estimate - paid).toFixed(2);

                        return (
                          <div className="space-y-8">
                            {/* People Section */}
                            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                              <Counter
                                label="Adults"
                                value={form.adultsCount}
                                min={MIN_ADULTS}
                                max={adultMax}
                                onDec={() => bumpAdults(-1)}
                                onInc={() => bumpAdults(1)}
                              />
                              <Counter
                                label="Kids"
                                value={form.kidsCount}
                                min={0}
                                max={kidMax}
                                onDec={() => bumpKids(-1)}
                                onInc={() => bumpKids(1)}
                              />

                              <div className="rounded-xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/5">
                                <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider opacity-60">
                                  <span>
                                    {privateBooking
                                      ? "Group Size"
                                      : "Slot Capacity"}
                                  </span>
                                  <span>
                                    {numberOfPeople}
                                    {!privateBooking && ` / ${totalCap}`}
                                  </span>
                                </div>
                                {!privateBooking && (
                                  <div className="h-2 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                                    <div
                                      className="h-full bg-[#a3845b]"
                                      style={{
                                        width: `${Math.min(100, Math.round(((bookedBefore + numberOfPeople) / totalCap) * 100))}%`,
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Pricing Section */}
                            <div className="border-t border-black/5 dark:border-white/5 pt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                              <Field
                                label="Unit price (Adult)"
                                icon={<CreditCard className="h-4 w-4" />}
                              >
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={form.unitPriceAdult}
                                  onChange={(e) => {
                                    setPriceDirty((d) => ({
                                      ...d,
                                      adult: true,
                                    }));
                                    setField("unitPriceAdult", e.target.value);
                                  }}
                                  placeholder="0.00"
                                  className={inputStyles}
                                />
                              </Field>
                              <Field label="Unit price (Kid)">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={form.unitPriceKid}
                                  onChange={(e) => {
                                    setPriceDirty((d) => ({ ...d, kid: true }));
                                    setField("unitPriceKid", e.target.value);
                                  }}
                                  placeholder="0.00"
                                  className={inputStyles}
                                />
                              </Field>
                              <Field label="Currency">
                                <select
                                  value={form.currency}
                                  onChange={(e) => {
                                    setPriceDirty((d) => ({
                                      ...d,
                                      currency: true,
                                    }));
                                    setField("currency", e.target.value);
                                  }}
                                  className={inputStyles}
                                >
                                  <option>EUR</option>
                                  <option>USD</option>
                                  <option>GBP</option>
                                  <option>CHF</option>
                                  <option>CAD</option>
                                  <option>AUD</option>
                                </select>
                              </Field>
                            </div>

                            <div className="border-t border-black/5 dark:border-white/5 pt-8 grid gap-6 sm:grid-cols-2">
                              <Field label="Amount Paid By Client">
                                <div className="relative">
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={form.totalPaidAmount}
                                    onChange={(e) =>
                                      setField(
                                        "totalPaidAmount",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="0.00"
                                    className={inputStyles}
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setField(
                                        "totalPaidAmount",
                                        estimate.toFixed(2),
                                      )
                                    }
                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-black/5 px-2 py-1 text-[10px] font-medium uppercase tracking-wider hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
                                  >
                                    Full Price
                                  </button>
                                </div>
                              </Field>
                              <Field label="Booking Status">
                                <select
                                  value={form.status}
                                  onChange={(e) =>
                                    setField("status", e.target.value)
                                  }
                                  className={inputStyles}
                                >
                                  <option value="confirmed">Confirmed</option>
                                  <option value="pending">Pending</option>
                                  <option value="cancelled">Cancelled</option>
                                </select>
                              </Field>
                            </div>

                            {/* Step Footer */}
                            <div className="mt-8 flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-6">
                              <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="rounded-full border border-black/20 px-6 py-2.5 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5 transition"
                              >
                                Back
                              </button>
                              <button
                                type="button"
                                onClick={() => setStep(3)}
                                disabled={!canEnterStep3}
                                className="inline-flex items-center gap-2 rounded-full bg-[#2f2f2f] dark:bg-white text-white dark:text-black px-6 py-2.5 text-sm font-medium shadow-md transition hover:bg-black disabled:opacity-50"
                              >
                                Next Step
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </Card>
                  </motion.div>
                )}

                {/* STEP 3 */}
                {step === 3 && canEnterStep3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card title="Step 3 — Contact & Notes">
                      <div className="space-y-8">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <Field
                            label="First Name"
                            icon={<User className="h-4 w-4" />}
                          >
                            <input
                              value={form.primary_contact?.firstName || ""}
                              onChange={(e) => setFirstName(e.target.value)}
                              placeholder="e.g., Maria"
                              className={inputStyles}
                            />
                          </Field>
                          <Field label="Surname">
                            <input
                              value={form.primary_contact?.lastName || ""}
                              onChange={(e) => setLastName(e.target.value)}
                              placeholder="e.g., Papadopoulou"
                              className={inputStyles}
                            />
                          </Field>
                          <Field
                            label="Email Address"
                            icon={<Mail className="h-4 w-4" />}
                          >
                            <input
                              type="email"
                              value={form.primary_contact?.email || ""}
                              onChange={(e) =>
                                setContact("email", e.target.value)
                              }
                              placeholder="guest@example.com"
                              className={inputStyles}
                            />
                          </Field>
                          <Field
                            label="Phone Number"
                            icon={<Phone className="h-4 w-4" />}
                          >
                            <input
                              type="tel"
                              value={form.primary_contact?.phone || ""}
                              onChange={(e) =>
                                setContact("phone", e.target.value)
                              }
                              placeholder="+30 69…"
                              className={inputStyles}
                            />
                          </Field>
                        </div>

                        <div className="border-t border-black/5 dark:border-white/5 pt-8">
                          <Field
                            label="Internal Notes"
                            icon={<StickyNote className="h-4 w-4" />}
                          >
                            <textarea
                              rows={4}
                              maxLength={600}
                              value={form.notes || ""}
                              onChange={(e) =>
                                setField("notes", e.target.value)
                              }
                              placeholder="Dietary needs, special requests..."
                              className={`${inputStyles} resize-y min-h-[120px]`}
                            />
                            <div className="mt-2 text-right text-xs opacity-50">
                              {(form.notes || "").length}/600
                            </div>
                          </Field>
                        </div>

                        {/* Step Footer */}
                        <div className="mt-8 flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-6">
                          <button
                            type="button"
                            onClick={() => setStep(2)}
                            className="rounded-full border border-black/20 px-6 py-2.5 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5 transition"
                          >
                            Back
                          </button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* RIGHT: Summary Sidebar */}
            <aside className="md:sticky md:top-24 h-fit space-y-6">
              <div className="rounded-2xl border border-black/10 bg-white/90 p-6 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-[#121212]/90">
                <h3 className="text-lg font-serif mb-6 border-b border-black/10 pb-4 dark:border-white/10">
                  Booking Summary
                </h3>
                <div className="space-y-4 text-[14px]">
                  <Row
                    label="Mode"
                    value={
                      privateBooking ? "Private Experience" : "Public Slot"
                    }
                  />
                  <Row
                    label="Date"
                    value={
                      privateBooking
                        ? privateSlot.date
                          ? fmtDMY(privateSlot.date)
                          : "—"
                        : selectedDate
                          ? fmtDMY(selectedDate)
                          : "—"
                    }
                  />
                  <Row
                    label="Group Size"
                    value={`${numberOfPeople} (${form.adultsCount}A / ${form.kidsCount}K)`}
                  />

                  <div className="border-t border-black/10 pt-4 dark:border-white/10 mt-4">
                    <Row label="Total Estimate">
                      <span className="font-semibold text-lg">
                        {estimate.toFixed(2)} {form.currency}
                      </span>
                    </Row>
                    <Row
                      label="Amount Paid"
                      value={`${(Number(form.totalPaidAmount) || 0).toFixed(2)} ${form.currency}`}
                    />

                    {/* Balance calculation */}
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-black/5 p-3 dark:bg-white/5">
                      <span className="font-medium text-sm">Balance Due</span>
                      <span
                        className={`font-bold ${estimate - (Number(form.totalPaidAmount) || 0) > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}
                      >
                        {Math.max(
                          0,
                          estimate - (Number(form.totalPaidAmount) || 0),
                        ).toFixed(2)}{" "}
                        {form.currency}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  form="booking-form"
                  type="submit"
                  disabled={submitting || !canEnterStep3}
                  className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#a3845b] px-6 py-3.5 text-sm font-medium text-white shadow-md hover:bg-[#b79266] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Save className="h-5 w-5" />
                  )}
                  {submitting ? "Processing..." : "Finalize Booking"}
                </button>
              </div>
            </aside>
          </form>
        </div>
      </section>
    </main>
  );
}

/* --------------------------- Widgets --------------------------- */
function Stepper({ step, onStep, canEnterStep2 = true, canEnterStep3 = true }) {
  const steps = [
    { id: 1, label: "Experience & Date" },
    { id: 2, label: "Pricing & Group", enabled: canEnterStep2 },
    { id: 3, label: "Guest Details", enabled: canEnterStep3 },
  ];
  return (
    <div className="rounded-2xl border border-black/10 bg-white/60 p-2 shadow-sm dark:border-white/10 dark:bg-white/5 backdrop-blur-md">
      <div className="grid grid-cols-3 gap-2">
        {steps.map((s) => {
          const active = s.id === step;
          const done = s.id < step;
          const enabled = s.enabled ?? true;
          return (
            <button
              key={s.id}
              onClick={() => enabled && onStep(s.id)}
              disabled={!enabled}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-white shadow-sm ring-1 ring-black/5 dark:bg-black/40 dark:ring-white/10 text-[#a3845b]"
                  : done
                    ? "text-black/60 dark:text-white/60 hover:bg-white/40 dark:hover:bg-white/5"
                    : "text-black/40 dark:text-white/30"
              }`}
            >
              {done ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <span
                  className={`h-2 w-2 rounded-full ${active ? "bg-[#a3845b]" : "bg-current opacity-40"}`}
                />
              )}
              <span className="hidden sm:block">{s.label}</span>
              <span className="sm:hidden">Step {s.id}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ComboBox({
  label,
  value,
  onChange,
  options,
  onQuery,
  placeholder,
  loading,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const selected = options?.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative z-50">
      <Field label={label} icon={<Search className="h-4 w-4" />}>
        <div
          className={`${inputStyles} flex cursor-text items-center justify-between`}
          onClick={() => setOpen(true)}
        >
          <span className={`truncate ${selected ? "" : "opacity-60"}`}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-70" />
        </div>
      </Field>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute left-0 right-0 top-full mt-2 max-h-64 overflow-auto rounded-xl border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-[#1a1a1a]"
          >
            <div className="sticky top-0 flex items-center gap-2 border-b border-black/5 bg-white/90 px-3 py-3 backdrop-blur dark:border-white/10 dark:bg-[#1a1a1a]/90">
              <Search className="h-4 w-4 opacity-60" />
              <input
                onChange={(e) => onQuery(e.target.value)}
                placeholder="Type to search…"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <div className="p-2">
              {loading ? (
                <div className="p-3 text-sm opacity-70">Searching…</div>
              ) : options?.length ? (
                options.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <span>{o.label}</span>
                    {value === o.value && (
                      <Check className="h-4 w-4 text-[#a3845b]" />
                    )}
                  </button>
                ))
              ) : (
                <div className="p-3 text-sm opacity-70">No results found</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SlotPicker({ loading, slots, selected, onSelect }) {
  return (
    <div className="mt-4 border-t border-black/5 pt-6 dark:border-white/5">
      <div className="mb-4 text-sm font-semibold uppercase tracking-wider opacity-60">
        Available time slots
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full rounded-xl bg-black/5 p-4 text-sm opacity-70 dark:bg-white/5 animate-pulse">
            Loading slots…
          </div>
        ) : !slots?.length ? (
          <div className="col-span-full rounded-xl border border-dashed border-black/20 p-6 text-center text-sm opacity-70 dark:border-white/20">
            No slots available for this date
          </div>
        ) : (
          slots.map((s) => {
            const booked = s.booked ?? 0;
            const total = s.capacity ?? MAX_GROUP;
            const disabled = booked >= total;
            const pct = Math.min(100, Math.round((booked / total) * 100));
            const active = selected === s.id;

            return (
              <button
                key={s.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(s.id)}
                className={`relative overflow-hidden rounded-2xl border p-4 text-left transition-all ${active ? "border-[#a3845b] bg-[#a3845b]/5 ring-1 ring-[#a3845b]" : "border-black/10 bg-white hover:border-black/30 dark:border-white/10 dark:bg-[#121212] dark:hover:border-white/30"} ${disabled ? "opacity-50 grayscale cursor-not-allowed" : ""}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`text-base font-semibold ${active ? "text-[#a3845b]" : ""}`}
                  >
                    {fmtTimeRange(s.startsAt, s.endsAt)}
                  </div>
                </div>
                <div className="text-xs text-black/60 dark:text-white/60 mb-2">
                  Booked: {booked} / {total}
                </div>
                <div className="h-1.5 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div
                    className={`h-full ${disabled ? "bg-red-500" : "bg-[#a3845b]"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function Counter({ label, value, min, max, onDec, onInc }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white/50 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="mb-3 text-sm font-medium opacity-80">{label}</div>
      <div className="flex items-center justify-between rounded-lg bg-black/5 dark:bg-white/5 p-1">
        <button
          type="button"
          onClick={onDec}
          disabled={Number(value) <= min}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-lg font-medium shadow-sm hover:bg-gray-50 disabled:opacity-40 dark:bg-[#2a2a2a] dark:hover:bg-[#333]"
        >
          −
        </button>
        <div className="text-lg font-semibold w-12 text-center">{value}</div>
        <button
          type="button"
          onClick={onInc}
          disabled={Number(value) >= max}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-lg font-medium shadow-sm hover:bg-gray-50 disabled:opacity-40 dark:bg-[#2a2a2a] dark:hover:bg-[#333]"
        >
          +
        </button>
      </div>
    </div>
  );
}

/* --------------------------- Layout & Shared --------------------------- */
function Card({ title, children }) {
  return (
    <div className="rounded-[2rem] border border-black/5 bg-white/80 p-6 sm:p-8 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#121212]/80">
      {title && (
        <h3 className="mb-6 text-xl font-serif text-black/90 dark:text-white/90">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

function Field({ label, icon, children }) {
  return (
    <label className="block w-full">
      {label && (
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-black/60 dark:text-white/60">
          {icon && <span className="text-[#a3845b]">{icon}</span>}
          <span>{label}</span>
        </div>
      )}
      <div className="relative">{children}</div>
    </label>
  );
}

function Row({ label, value, children }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-black/60 dark:text-white/60">{label}</span>
      <span className="font-medium text-right">{children || value}</span>
    </div>
  );
}

/* --------------------------- Utils --------------------------- */
function fmtTimeRange(a, b) {
  try {
    const A = a ? new Date(a) : null;
    const B = b ? new Date(b) : null;
    if (A && B)
      return `${A.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${B.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    if (A)
      return A.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return "—";
  } catch {
    return "—";
  }
}

function fmtYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDMY(input) {
  if (typeof input === "string") {
    const [y, m, d] = input.split("-");
    if (y && m && d) return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }
  const dt = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(dt.getTime())) return "—";
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
}

function minutesToHours(mins) {
  return Number.isFinite(Number(mins)) ? +(Number(mins) / 60).toFixed(2) : 0;
}
function hoursToMinutes(hours) {
  return Number.isFinite(Number(hours)) ? Math.round(Number(hours) * 60) : 0;
}
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// Calendar Components
const SlotsForDate = React.memo(function SlotsForDate({
  experienceId,
  date,
  slots,
  setSlots,
  loading,
  setLoading,
  selected,
  onSelect,
}) {
  const keyRef = React.useRef("");
  React.useEffect(() => {
    if (!experienceId || !date) return;
    const key = `${experienceId}|${date}`;
    if (keyRef.current === key) return;
    keyRef.current = key;

    const ctrl = new AbortController();
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/schedule-slots/available?experienceId=${experienceId}&date=${date}`,
          { signal: ctrl.signal, cache: "no-store" },
        );
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setSlots(data?.items || []);
      } catch (e) {
        if (!cancelled && e.name !== "AbortError") setSlots([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [experienceId, date, setLoading, setSlots]);

  return (
    <SlotPicker
      loading={loading}
      slots={slots}
      selected={selected}
      onSelect={onSelect}
    />
  );
});

function AvailabilityCalendar({
  loading,
  days,
  selectedDate,
  onSelectDate,
  onNavigateRange,
}) {
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const map = useMemo(() => {
    const m = Object.create(null);
    for (const d of days || []) if (d?.date) m[d.date] = d;
    return m;
  }, [days]);
  const today = useMemo(() => new Date(), []);

  const [viewDate, setViewDate] = React.useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const viewMonthFirst = useMemo(() => {
    const d = new Date(viewDate);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [viewDate]);
  const gridStart = useMemo(() => {
    const d = new Date(viewMonthFirst);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }, [viewMonthFirst]);

  const cells = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const key = fmtYMD(d);
      const info = map[key];
      arr.push({
        key,
        date: d,
        info,
        open:
          info &&
          (info.slots ?? 0) > 0 &&
          (info.capacity ?? 0) > (info.booked ?? 0),
        inMonth: d.getMonth() === viewMonthFirst.getMonth(),
      });
    }
    return arr;
  }, [gridStart, map, viewMonthFirst]);

  function goMonth(delta) {
    const next = new Date(viewMonthFirst);
    next.setMonth(viewMonthFirst.getMonth() + delta, 1);
    setViewDate(next);
    onNavigateRange?.(
      Math.max(
        30,
        Math.ceil(
          (new Date(next.getFullYear(), next.getMonth() + 1, 0).getTime() -
            today.getTime()) /
            86400000,
        ),
      ),
    );
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-[#1a1a1a] overflow-hidden">
      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] px-4 py-3">
        <div className="font-serif text-lg font-medium">
          {monthNames[viewMonthFirst.getMonth()]} {viewMonthFirst.getFullYear()}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            className="rounded-md p-1.5 hover:bg-black/5 dark:hover:bg-white/10"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => {
              const b = new Date();
              b.setDate(1);
              b.setHours(0, 0, 0, 0);
              setViewDate(b);
              onNavigateRange?.(60);
            }}
            className="rounded-md px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => goMonth(1)}
            className="rounded-md p-1.5 hover:bg-black/5 dark:hover:bg-white/10"
          >
            ›
          </button>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="p-6 text-center text-sm opacity-60 animate-pulse">
            Syncing calendar...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-[10px] font-bold uppercase tracking-widest opacity-50">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {cells.map((c) => {
                const isSelected = selectedDate === c.key;
                const isToday = fmtYMD(c.date) === fmtYMD(today);
                return (
                  <button
                    key={c.key}
                    type="button"
                    disabled={!c.open}
                    onClick={() => onSelectDate(c.key)}
                    className={`relative flex flex-col items-center justify-center rounded-xl p-2 h-14 transition-all ${
                      isSelected
                        ? "bg-[#a3845b] text-white shadow-md"
                        : c.open
                          ? "bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
                          : "opacity-30 cursor-not-allowed"
                    } ${!c.inMonth ? "opacity-20" : ""}`}
                  >
                    <span
                      className={`text-sm font-medium ${isToday && !isSelected ? "text-[#a3845b] font-bold" : ""}`}
                    >
                      {c.date.getDate()}
                    </span>
                    {c.open && (
                      <span
                        className={`mt-0.5 h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-[#a3845b]"}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
