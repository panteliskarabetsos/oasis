// admin/bookings/new/page.js
"use client";

import React, { useEffect, useMemo, useRef, useState, memo } from "react";
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
} from "lucide-react";

/* ---------------------------- constants ---------------------------- */
const MAX_GROUP = 100;
const MIN_ADULTS = 1;

/* ----------------------------- page ----------------------------- */
export default function NewBookingPage() {
  const router = useRouter();
  const [rangeDays, setRangeDays] = useState(60);
  const today = useMemo(() => fmtYMD(new Date()), []);
  const toDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + rangeDays);
    return fmtYMD(d);
  }, [rangeDays]);
  /* ---------- gate ---------- */
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
    return () => (ignore = true);
  }, []);

  /* ---------- steps ---------- */
  const [step, setStep] = useState(1); // 1: Experience, 2: Slot, 3: Details

  /* ---------- experience + slots ---------- */
  const [experienceQuery, setExperienceQuery] = useState("");
  const [experiences, setExperiences] = useState([]);
  const [expLoading, setExpLoading] = useState(false);
  const [experienceId, setExperienceId] = useState(null);

  const [date, setDate] = useState(""); // YYYY-MM-DD
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

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!experienceQuery) {
        setExperiences([]);
        return;
      }
      setExpLoading(true);
      try {
        const res = await fetch(
          `/api/admin/experiences/search?q=${encodeURIComponent(
            experienceQuery
          )}`
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

  /* ---------- booking form ---------- */
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

  const numberOfPeople = useMemo(
    () => (parseInt(form.adultsCount) || 0) + (parseInt(form.kidsCount) || 0),
    [form.adultsCount, form.kidsCount]
  );
  const priceAdult = useMemo(
    () =>
      form.unitPriceAdult === "" ? 0 : parseFloat(form.unitPriceAdult) || 0,
    [form.unitPriceAdult]
  );
  const priceKid = useMemo(
    () => (form.unitPriceKid === "" ? 0 : parseFloat(form.unitPriceKid) || 0),
    [form.unitPriceKid]
  );

  const [priceDirty, setPriceDirty] = useState({
    adult: false,
    kid: false,
    currency: false,
  });

  const toMoney = (n) => Number(n ?? 0).toFixed(2);

  // show where the defaults came from
  const [priceSource, setPriceSource] = useState(""); // "", "slot", "experience"

  const estimate = useMemo(
    () =>
      (parseInt(form.adultsCount) || 0) * priceAdult +
      (parseInt(form.kidsCount) || 0) * priceKid,
    [form.adultsCount, form.kidsCount, priceAdult, priceKid]
  );

  // Selected slot (public mode only)
  const selectedSlot = useMemo(
    () =>
      !privateBooking
        ? (slots || []).find((s) => s.id === selectedSlotId)
        : null,
    [privateBooking, slots, selectedSlotId]
  );

  // Remaining seats on that slot
  const slotRemaining = useMemo(() => {
    if (privateBooking) return Infinity; // private has no cap
    const cap = selectedSlot?.capacity ?? MAX_GROUP;
    const booked = selectedSlot?.booked ?? 0;
    return Math.max(0, cap - booked);
  }, [privateBooking, selectedSlot]);

  // Effective group maximum
  const effectiveGroupMax = useMemo(() => {
    return privateBooking ? Infinity : Math.min(MAX_GROUP, slotRemaining);
  }, [privateBooking, slotRemaining]);

  // For <input max /> and counters (can't use Infinity there)
  const uiGroupMax = Number.isFinite(effectiveGroupMax)
    ? effectiveGroupMax
    : 999;

  // custom title for private bookings
  const [customExperienceName, setCustomExperienceName] = useState("");
  const privateNameRef = useRef(null);
  useEffect(() => {
    if (privateBooking) privateNameRef.current?.focus();
  }, [privateBooking]);

  useEffect(() => {
    // only in PUBLIC mode and when we have both experience & slot
    if (privateBooking || !experienceId || !selectedSlotId) return;

    let cancelled = false;

    (async () => {
      // 1) Try from the selected slot (if slot carries pricing)
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
      if (filled) {
        if (!cancelled) setPriceSource("slot");
        return;
      }

      // 2) Fallback to experience defaults
      try {
        const res = await fetch(`/api/admin/experiences/?id=${experienceId}`, {
          cache: "no-store",
        });
        const j = await res.json().catch(() => ({}));
        const exp = j?.experience || j || {};

        const expAdult = exp.priceAdult ?? exp.unitPriceAdult ?? null;
        const expKid = exp.priceKid ?? exp.unitPriceKid ?? null;
        const expCurr = exp.currency ?? null;

        let did = false;
        if (!priceDirty.adult && expAdult != null) {
          setField("unitPriceAdult", toMoney(expAdult));
          did = true;
        }
        if (!priceDirty.kid && expKid != null) {
          setField("unitPriceKid", toMoney(expKid));
          did = true;
        }
        if (!priceDirty.currency && expCurr) {
          setField("currency", expCurr);
          did = true;
        }
        if (did && !cancelled) setPriceSource("experience");
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    privateBooking,
    experienceId,
    selectedSlotId,
    slots,
    priceDirty.adult,
    priceDirty.kid,
    priceDirty.currency,
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // --- Availability calendar state ---
  const [selectedDate, setSelectedDate] = useState("");
  const [availLoading, setAvailLoading] = useState(false);
  const [availability, setAvailability] = useState([]);
  // shape: [{ date: 'YYYY-MM-DD', slots: number, booked: number, capacity: number }]

  /* --------------------------- helpers --------------------------- */
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
      const nextA = Math.max(MIN_ADULTS, a + d);
      setForm((f) => ({ ...f, adultsCount: nextA }));
      return;
    }

    const nextA = clamp(a + d, MIN_ADULTS, uiGroupMax);
    const remain = Math.max(0, uiGroupMax - nextA);
    const nextK = clamp(k, 0, remain);
    setForm((f) => ({ ...f, adultsCount: nextA, kidsCount: nextK }));
  };

  const bumpKids = (d) => {
    const a = parseInt(form.adultsCount) || 0;
    const k = parseInt(form.kidsCount) || 0;

    if (privateBooking) {
      const nextK = Math.max(0, k + d);
      setForm((f) => ({ ...f, kidsCount: nextK }));
      return;
    }

    const nextK = clamp(k + d, 0, Math.max(0, uiGroupMax - a));
    setForm((f) => ({ ...f, kidsCount: nextK }));
  };

  const canContinueStep2 =
    !!privateBooking || (!!selectedSlotId && !!selectedDate);
  // Step gating
  const canEnterStep2 =
    privateBooking || (!!experienceId && !!selectedDate && !!selectedSlotId);

  // Keep your Step 3 rule (private OR public with slot picked)
  const canEnterStep3 =
    !!privateBooking || (!!selectedDate && !!selectedSlotId);

  // (optional) if you still reference this name elsewhere, alias it:
  const canContinueStep1 = canEnterStep2;
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
  function validate() {
    // --- Private vs Public core checks ---
    if (privateBooking) {
      if (!customExperienceName?.trim())
        return "Enter a name for the private booking.";
      if (!privateSlot.date) return "Select a date for the private booking.";
      if (!privateSlot.startTime)
        return "Select a start time for the private booking.";
      if (
        !Number.isFinite(Number(privateSlot.durationMinutes)) ||
        Number(privateSlot.durationMinutes) <= 0
      )
        return "Duration must be a positive number.";
      if (
        !Number.isFinite(Number(privateSlot.capacity)) ||
        Number(privateSlot.capacity) < 1
      )
        return "Capacity must be at least 1.";
    } else {
      if (!experienceId) return "Please select an experience.";
      if (!selectedDate) return "Select a date.";
      if (!selectedSlotId) return "Select an available slot.";
    }

    // --- Contact (no userId; require first & last, email, phone) ---
    const first = (form.primary_contact?.firstName || "").trim();
    const last = (form.primary_contact?.lastName || "").trim();
    const email = (form.primary_contact?.email || "").trim();
    const phone = (form.primary_contact?.phone || "").trim();
    // track if admin has edited prices/currency (so we don't overwrite)

    if (!first) return "First name is required.";
    if (!last) return "Surname is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return "Primary contact email is invalid.";
    const phoneDigits = phone.replace(/\D/g, "");
    if (!phoneDigits || phoneDigits.length < 7)
      return "Phone number looks invalid.";

    // --- People counts ---
    const a = parseInt(form.adultsCount) || 0;
    const k = parseInt(form.kidsCount) || 0;
    if (a < MIN_ADULTS) return "At least one adult is required.";
    if (a + k < 1) return "Number of people must be at least 1.";

    // Public-mode cap: min(8, free seats of selected slot)
    if (!privateBooking) {
      const slot = (slots || []).find((s) => s.id === selectedSlotId);
      const slotCap = slot?.capacity ?? MAX_GROUP; // total seats in slot
      const slotBooked = slot?.booked ?? 0; // already booked
      const slotRemaining = Math.max(0, slotCap - slotBooked);
      const cap = Math.min(MAX_GROUP, slotRemaining);

      if (a + k > cap) {
        return `Group exceeds the allowed maximum for this slot (max ${cap}).`;
      }
    }

    // --- Pricing fields ---
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

  function minutesToHours(mins) {
    const n = Number(mins || 0);
    return Number.isFinite(n) ? +(n / 60).toFixed(2) : 0;
  }
  function hoursToMinutes(hours) {
    const h = Number(hours || 0);
    return Number.isFinite(h) ? Math.round(h * 60) : 0;
  }

  // Display-only: "YYYY-MM-DD" or Date -> "DD/MM/YYYY"
  function fmtDMY(input) {
    if (typeof input === "string") {
      const [y, m, d] = input.split("-");
      if (y && m && d)
        return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
    }
    const dt = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(dt.getTime())) return "—";
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yy = dt.getFullYear();
    return `${dd}/${mm}/${yy}`;
  }

  function endTimeInfo(dateStr, timeStr, durationMinutes) {
    if (!dateStr || !timeStr || !Number.isFinite(Number(durationMinutes)))
      return null;
    try {
      const [y, m, d] = dateStr.split("-").map(Number);
      const [hh, mm] = timeStr.split(":").map(Number);
      const start = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0); // local
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + Number(durationMinutes));
      const crossesDay =
        end.getDate() !== start.getDate() ||
        end.getMonth() !== start.getMonth() ||
        end.getFullYear() !== start.getFullYear();
      const endDate = fmtYMD(end);
      const endTime = end.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      return { end, endDate, endTime, crossesDay };
    } catch {
      return null;
    }
  }
  // helpers

  // load calendar availability when an experience is chosen (non-private mode)
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

        // auto-pick the first open day
        const open = days.find(
          (d) => (d.slots ?? 0) > 0 && (d.capacity ?? 0) > (d.booked ?? 0)
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

  // prefill prices from the selected experience when public-mode + slot selected
  useEffect(() => {
    if (privateBooking) return;
    if (!experienceId || !selectedSlotId) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/admin/experiences?id=${experienceId}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json().catch(() => null);

        // Handle both array and object shapes
        const exp = Array.isArray(json)
          ? json.find((x) => Number(x.id) === Number(experienceId)) || null
          : json?.experience ?? json ?? null;

        if (!exp || cancelled) return;

        setForm((f) => {
          const next = { ...f };

          // Only prefill if user hasn't typed AND the API value is a positive number
          if (
            !priceDirty.adult &&
            (next.unitPriceAdult ?? "") === "" &&
            typeof exp.priceAdult === "number" &&
            exp.priceAdult > 0
          ) {
            next.unitPriceAdult = exp.priceAdult.toFixed(2);
          }
          if (
            !priceDirty.kid &&
            (next.unitPriceKid ?? "") === "" &&
            typeof exp.priceKid === "number" &&
            exp.priceKid > 0
          ) {
            next.unitPriceKid = exp.priceKid.toFixed(2);
          }
          return next;
        });
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    privateBooking,
    experienceId,
    selectedSlotId,
    priceDirty.adult,
    priceDirty.kid,
  ]);

  // keep your existing `date` in sync with calendar selection for payload/summary
  useEffect(() => {
    if (selectedDate) setDate(selectedDate);
  }, [selectedDate]);

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

      // Route & payload depend on mode
      const isPrivate = !!privateBooking;
      const url = isPrivate
        ? "/api/admin/private-reservations"
        : "/api/admin/reservations";

      const payload = isPrivate
        ? {
            ...common,
            // private booking: NO scheduleSlotId, we pass explicit time
            experienceId: experienceId ? Number(experienceId) : null, // optional
            customExperienceName: (customExperienceName || "").trim(),
            date: privateSlot.date, // "YYYY-MM-DD"
            startTime: privateSlot.startTime, // "HH:mm"
            // optional extras for your API if supported:
            // durationMinutes: Number(privateSlot.durationMinutes) || 90,
            // capacity: Number(privateSlot.capacity) || MAX_GROUP,
          }
        : {
            ...common,
            // public booking: uses existing slot
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
          j?.error || `Failed to create ${isPrivate ? "private " : ""}booking`
        );
      }

      const data = await res.json();
      const item = data?.item || data; // both endpoints return { item }
      setSuccess("Booking created");
      const id = item?.id;
      setTimeout(() => {
        router.push(id ? `/admin/bookings/${id}` : "/admin/bookings");
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
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!auth.ok) {
    return (
      <div className="mx-auto max-w-xl p-6 text-center">
        <p className="text-sm text-red-600">
          Access denied. Please sign in as an admin.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-2"
        >
          <ArrowLeft className="h-4 w-4" /> Go home
        </Link>
      </div>
    );
  }

  return (
    <main className="rounded-3xl min-h-screen bg-[linear-gradient(180deg,#f6f3ee,transparent_30%),radial-gradient(800px_400px_at_10%_-20%,#f0eadf,transparent),radial-gradient(600px_300px_at_90%_-10%,#efe7da,transparent)] text-[#2f2f2f] transition-colors duration-500 dark:bg-[#0f0f0f] dark:text-[#e9e4da]">
      {/* Sticky header */}
      <div className="rounded-3xl sticky top-0 z-10 border-b border-black/5 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-white/5">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/bookings"
              className="inline-flex items-center gap-1 text-sm opacity-80 hover:opacity-100"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            <span className="hidden text-sm opacity-60 md:inline">/</span>
            <span className="text-sm font-medium">New booking</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              form="booking-form"
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-[#a3845b] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#b79266] disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <section className="px-4 py-6 md:px-6 md:py-10">
        <div className="mx-auto max-w-6xl">
          {/* Stepper */}
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

          <form
            id="booking-form"
            onSubmit={handleSubmit}
            className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3"
          >
            {/* LEFT: Steps */}
            <div className="md:col-span-2 space-y-6">
              {/* Step 1: Experience */}
              {step === 1 && (
                <Card title="Step 1 — Experience & date">
                  {/* Subheader */}
                  <div className="mb-4 rounded-xl bg-black/[0.03] px-3 py-2 text-xs leading-5 text-black/70 dark:bg-white/5 dark:text-white/70">
                    Choose an experience, then either book a public slot or
                    create a private one.
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    {/* Experience picker + small actions */}

                    <div className="md:col-span-2">
                      {!privateBooking && (
                        <div className="flex items-end gap-2">
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
                            <p className="mt-1 text-xs opacity-60">
                              Tip: type 2+ characters to search by name.
                            </p>
                          </div>

                          {/* Clear selection */}
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
                            className="h-10 rounded-xl border border-black/10 px-3 text-xs hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                            aria-label="Clear selected experience"
                            title="Clear"
                          >
                            Clear
                          </button>
                        </div>
                      )}
                      {/* Loading / Empty state for experiences */}
                      {expLoading && (
                        <div className="mt-2 animate-pulse rounded-xl border border-black/5 bg-white/70 p-3 text-xs opacity-70 dark:border-white/10 dark:bg-white/5">
                          Searching experiences…
                        </div>
                      )}
                      {!expLoading &&
                        experienceId == null &&
                        experienceQuery &&
                        !experiences.length && (
                          <div className="mt-2 rounded-xl border border-amber-500/20 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-400/20 dark:bg-amber-900/10 dark:text-amber-200">
                            No experiences found. Try a different term.
                          </div>
                        )}
                    </div>

                    {/* Mode segmented control with icons */}
                    <Field
                      label="Mode"
                      icon={<ShieldCheck className="h-4 w-4" />}
                    >
                      <div
                        role="tablist"
                        aria-label="Booking mode"
                        className="flex rounded-xl border border-black/10 p-1 dark:border-white/10"
                      >
                        <button
                          role="tab"
                          aria-selected={!privateBooking}
                          type="button"
                          onClick={() => setPrivateBooking(false)}
                          className={[
                            "flex-1 rounded-lg px-3 py-2 text-sm transition",
                            !privateBooking
                              ? "bg-[#a3845b] text-white shadow-sm"
                              : "hover:bg-black/5 dark:hover:bg-white/10",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <Users className="h-4 w-4" />
                            <span>Book on slot</span>
                          </div>
                        </button>
                        <button
                          role="tab"
                          aria-selected={privateBooking}
                          type="button"
                          onClick={() => setPrivateBooking(true)}
                          className={[
                            "flex-1 rounded-lg px-3 py-2 text-sm transition",
                            privateBooking
                              ? "bg-[#a3845b] text-white shadow-sm"
                              : "hover:bg-black/5 dark:hover:bg-white/10",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            <span>Private booking</span>
                          </div>
                        </button>
                      </div>
                      <p className="mt-1 text-xs opacity-60">
                        Slots are public; private creates a one-off hidden slot
                        with custom capacity/duration.
                      </p>
                    </Field>

                    {/* PUBLIC: Availability + quick picks + slots */}
                    {!privateBooking && (
                      <>
                        <div className="md:col-span-3 space-y-3">
                          {/* Quick picks (next open days) */}
                          {!!availability?.length && (
                            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-black/10 bg-white/60 p-2 text-xs dark:border-white/10 dark:bg-white/5">
                              <span className="opacity-70">Quick picks:</span>
                              {availability
                                .filter(
                                  (d) =>
                                    (d.slots ?? 0) > 0 &&
                                    (d.capacity ?? 0) > (d.booked ?? 0)
                                )
                                .slice(0, 3)
                                .map((d) => {
                                  const isActive = selectedDate === d.date;
                                  return (
                                    <button
                                      key={d.date}
                                      type="button"
                                      aria-pressed={isActive}
                                      disabled={isActive}
                                      onClick={() => {
                                        setSelectedDate(d.date);
                                        setSelectedSlotId(null);
                                        setSlots([]);
                                      }}
                                      className={[
                                        "rounded-full border px-3 py-1",
                                        isActive
                                          ? "border-[#a3845b] bg-[#a3845b]/10 text-[#a3845b] cursor-default"
                                          : "border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10",
                                      ].join(" ")}
                                      title={`${fmtDMY(d.date)} — ${
                                        d.slots
                                      } slots open`}
                                    >
                                      {fmtDMY(d.date)} • {d.slots} slots
                                    </button>
                                  );
                                })}

                              {/* +N more (expand range to show more open days) */}
                              {(() => {
                                const totalOpen =
                                  availability.filter(
                                    (d) =>
                                      (d.slots ?? 0) > 0 &&
                                      (d.capacity ?? 0) > (d.booked ?? 0)
                                  ).length || 0;
                                const more = Math.max(0, totalOpen - 3);
                                return more > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRangeDays((r) => Math.max(r, 90))
                                    }
                                    className="rounded-full border border-black/10 px-3 py-1 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                                    title={`Show ${more} more open day${
                                      more > 1 ? "s" : ""
                                    }`}
                                  >
                                    +{more} more
                                  </button>
                                ) : null;
                              })()}
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

                          {/* Selected date pill */}
                          <div className="flex items-center justify-between">
                            <div className="text-sm">
                              <span className="opacity-60">Selected date:</span>{" "}
                              {selectedDate ? (
                                <span
                                  className="inline-flex items-center gap-2 rounded-full border border-[#a3845b]/30 bg-[#a3845b]/10 px-3 py-1 font-medium text-[#a3845b]"
                                  title={fmtDMY(selectedDate)}
                                >
                                  <CalIcon className="h-3.5 w-3.5" />
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
                                className="text-xs opacity-70 hover:opacity-100"
                              >
                                Clear date
                              </button>
                            )}
                          </div>

                          {/* subtle hint */}
                          <p className="text-xs opacity-60">
                            Tip: use the month arrows to browse more days. Quick
                            picks jump straight to the next open dates.
                          </p>
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

                    {/* PRIVATE: grouped layout, responsive, no group cap */}
                    {privateBooking && (
                      <div className="md:col-span-3 space-y-5">
                        {/* DETAILS */}
                        <div className="rounded-2xl border border-black/5 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                          <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-70">
                              <Sparkles className="h-4 w-4" />
                              <span>Private booking</span>
                            </div>
                            <span className="rounded-full border border-[#a3845b]/30 bg-[#a3845b]/10 px-2 py-0.5 text-[11px] font-medium text-[#a3845b]">
                              Custom name
                            </span>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Field label="Private booking name">
                              <div className="flex items-center gap-2">
                                <input
                                  ref={privateNameRef}
                                  autoFocus
                                  value={customExperienceName}
                                  onChange={(e) =>
                                    setCustomExperienceName(e.target.value)
                                  }
                                  placeholder="e.g., VIP Sunset Tour for Acme Inc."
                                  className={[
                                    "input",
                                    !customExperienceName.trim()
                                      ? "ring-1 ring-amber-300/70"
                                      : "",
                                  ].join(" ")}
                                />
                                {!!customExperienceName && (
                                  <button
                                    type="button"
                                    onClick={() => setCustomExperienceName("")}
                                    className="rounded-lg border border-black/10 px-2 py-1 text-xs hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                                    title="Clear name"
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                              <p className="mt-1 text-xs opacity-60">
                                This name will appear on the booking.
                              </p>
                            </Field>
                          </div>
                        </div>

                        {/* WHEN */}
                        <div className="rounded-2xl border border-black/5 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-70">
                            <CalIcon className="h-4 w-4" />
                            <span>When</span>
                          </div>

                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {/* Date */}
                            <Field
                              label="Date"
                              icon={<CalIcon className="h-4 w-4" />}
                            >
                              <div className="flex items-center gap-2">
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
                                  className={[
                                    "input",
                                    !privateSlot.date
                                      ? "ring-1 ring-amber-300/70"
                                      : "",
                                  ].join(" ")}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPrivateSlot((s) => ({
                                      ...s,
                                      date: fmtYMD(new Date()),
                                    }))
                                  }
                                  className="rounded-lg border border-black/10 px-2 py-1 text-xs hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                                  title="Set to today"
                                >
                                  Today
                                </button>
                              </div>
                              <p className="mt-1 text-xs opacity-60">
                                Local date
                                {privateSlot.date
                                  ? ` • ${fmtDMY(privateSlot.date)}`
                                  : ""}
                                .
                              </p>
                            </Field>

                            {/* Start time + Now */}
                            <Field
                              label="Start time"
                              icon={<Clock3 className="h-4 w-4" />}
                            >
                              <div className="flex items-center gap-2">
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
                                  min={
                                    privateSlot.date === fmtYMD(new Date())
                                      ? new Date().toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          hour12: false,
                                        })
                                      : undefined
                                  }
                                  className={[
                                    "input disabled:opacity-60",
                                    privateSlot.date && !privateSlot.startTime
                                      ? "ring-1 ring-amber-300/70"
                                      : "",
                                  ].join(" ")}
                                />
                                <button
                                  type="button"
                                  disabled={!privateSlot.date}
                                  onClick={() => {
                                    const t = new Date();
                                    const q =
                                      Math.ceil(t.getMinutes() / 15) * 15;
                                    t.setMinutes(q, 0, 0);
                                    const hh = String(t.getHours()).padStart(
                                      2,
                                      "0"
                                    );
                                    const mm = String(t.getMinutes()).padStart(
                                      2,
                                      "0"
                                    );
                                    setPrivateSlot((s) => ({
                                      ...s,
                                      startTime: `${hh}:${mm}`,
                                    }));
                                  }}
                                  className="rounded-lg border border-black/10 px-2 py-1 text-xs hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/10"
                                  title="Set to now (rounded to 15m)"
                                >
                                  Now
                                </button>
                              </div>
                              <p className="mt-1 text-xs opacity-60">
                                Local time (
                                {
                                  Intl.DateTimeFormat().resolvedOptions()
                                    .timeZone
                                }
                                )
                              </p>
                            </Field>

                            {/* Ends at */}
                            <Field label="Ends">
                              {(() => {
                                const info = endTimeInfo(
                                  privateSlot.date,
                                  privateSlot.startTime,
                                  Number(privateSlot.durationMinutes) || 0
                                );
                                return (
                                  <div
                                    className="input flex items-center justify-between"
                                    aria-live="polite"
                                  >
                                    <span className="opacity-70">End</span>
                                    <strong>
                                      {info
                                        ? `${fmtDMY(info.endDate)} • ${
                                            info.endTime
                                          }${
                                            info.crossesDay ? " (next day)" : ""
                                          }`
                                        : "—"}
                                    </strong>
                                  </div>
                                );
                              })()}
                              <p className="mt-1 text-xs opacity-60">
                                Calculated from start + duration.
                              </p>
                            </Field>
                          </div>
                        </div>

                        {/* SETTINGS */}
                        <div className="rounded-2xl border border-black/5 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-70">
                            <Settings className="h-4 w-4" />
                            <span>Settings</span>
                          </div>

                          <div className="items-center grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {/* Duration (hours) */}
                            <Field label="Duration (hours)">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPrivateSlot((s) => ({
                                      ...s,
                                      durationMinutes: hoursToMinutes(
                                        Math.max(
                                          0.5,
                                          minutesToHours(s.durationMinutes) -
                                            0.5
                                        )
                                      ),
                                    }))
                                  }
                                  className="rounded-lg border border-black/10 px-3 py-1 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                                  aria-label="Decrease duration"
                                >
                                  −
                                </button>
                                <input
                                  type="number"
                                  min={0.5}
                                  step={0.5}
                                  value={minutesToHours(
                                    privateSlot.durationMinutes
                                  )}
                                  onChange={(e) =>
                                    setPrivateSlot((s) => ({
                                      ...s,
                                      durationMinutes: hoursToMinutes(
                                        e.target.value
                                      ),
                                    }))
                                  }
                                  className="input w-28 text-center"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPrivateSlot((s) => ({
                                      ...s,
                                      durationMinutes: hoursToMinutes(
                                        minutesToHours(s.durationMinutes) + 0.5
                                      ),
                                    }))
                                  }
                                  className="rounded-lg border border-black/10 px-3 py-1 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                                  aria-label="Increase duration"
                                >
                                  +
                                </button>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {[1, 1.5, 2, 3, 4].map((h) => (
                                  <button
                                    key={h}
                                    type="button"
                                    onClick={() =>
                                      setPrivateSlot((s) => ({
                                        ...s,
                                        durationMinutes: hoursToMinutes(h),
                                      }))
                                    }
                                    className={[
                                      "rounded-full border px-3 py-1 text-xs",
                                      Number(
                                        minutesToHours(
                                          privateSlot.durationMinutes
                                        )
                                      ) === h
                                        ? "border-[#a3845b] bg-[#a3845b]/10 text-[#a3845b]"
                                        : "border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10",
                                    ].join(" ")}
                                    title={`${h} hours`}
                                  >
                                    {h}h
                                  </button>
                                ))}
                              </div>
                              <p className="mt-1 text-xs opacity-60">
                                Common choices: 1–2 h
                                <span className="ml-1 opacity-60">
                                  (≈ {Number(privateSlot.durationMinutes || 0)}{" "}
                                  min)
                                </span>
                              </p>
                            </Field>
                            {/* Capacity (no cap in private) */}
                            {/* <Field label="Capacity">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setPrivateSlot((s) => ({
                                    ...s,
                                    capacity: Math.max(
                                      1,
                                      Number(s.capacity || 1) - 1
                                    ),
                                  }))
                                }
                                className="rounded-lg border border-black/10 px-3 py-1 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                                aria-label="Decrease capacity"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min={1}
                                value={privateSlot.capacity}
                                onChange={(e) =>
                                  setPrivateSlot((s) => ({
                                    ...s,
                                    capacity: e.target.value,
                                  }))
                                }
                                className="input w-24 text-center"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setPrivateSlot((s) => ({
                                    ...s,
                                    capacity: Number(s.capacity || 1) + 1,
                                  }))
                                }
                                className="rounded-lg border border-black/10 px-3 py-1 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                                aria-label="Increase capacity"
                              >
                                +
                              </button>
                            </div>
                            <p className="mt-1 text-xs opacity-60">
                              No maximum for private slots.
                            </p>
                          </Field> */}
                            <div className="hidden lg:block" />
                          </div>
                        </div>

                        {/* NOTES */}
                        <div className="rounded-2xl border border-black/5 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-70">
                            <StickyNote className="h-4 w-4" />
                            <span>Notes</span>
                          </div>
                          <Field label="Internal note">
                            <textarea
                              rows={4}
                              value={privateSlot.note}
                              onChange={(e) =>
                                setPrivateSlot((s) => ({
                                  ...s,
                                  note: e.target.value,
                                }))
                              }
                              className="input min-h-[96px] resize-y"
                              placeholder="Optional (visible to staff only)"
                            />
                            <div className="mt-1 text-right text-[11px] opacity-60">
                              {privateSlot.note?.length || 0} chars
                            </div>
                          </Field>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer actions with inline validation hint */}
                  <div className="mt-4 flex items-center justify-between">
                    {!canContinueStep1 && (
                      <div className="text-xs text-amber-700 dark:text-amber-300">
                        {(!experienceId &&
                          "Select an experience to continue.") ||
                          (!privateBooking &&
                            !selectedDate &&
                            "Pick a date with open slots.") ||
                          (privateBooking &&
                            !privateSlot.date &&
                            "Choose a date and time.")}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      disabled={!canEnterStep2}
                      className="inline-flex items-center gap-2 rounded-full bg-[#a3845b] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#b79266] disabled:opacity-60"
                    >
                      Continue
                    </button>
                  </div>
                </Card>
              )}
              {/* Step 2: People & pricing */}

              {step == 2 && canEnterStep2 && (
                <Card title="Step 2 — People & pricing">
                  {(() => {
                    // selected slot (public)
                    const slot = !privateBooking
                      ? (slots || []).find((s) => s.id === selectedSlotId)
                      : null;

                    const totalCap = slot?.capacity ?? 0;
                    const bookedBefore = slot?.booked ?? 0;
                    const remaining = Math.max(0, totalCap - bookedBefore); // <-- FREE SEATS

                    const adults = parseInt(form.adultsCount) || 0;
                    const kids = parseInt(form.kidsCount) || 0;

                    // CAP = remaining seats (public), UNCAPPED (private)
                    const groupMax = privateBooking ? Infinity : remaining;
                    const uiMax = Number.isFinite(groupMax) ? groupMax : 999;

                    const adultMax = uiMax; // adults cannot exceed free seats
                    const kidMax = Math.max(0, uiMax - adults); // kids limited by what's left after adults

                    const paid =
                      form.totalPaidAmount === ""
                        ? 0
                        : parseFloat(form.totalPaidAmount) || 0;
                    const balance = +(estimate - paid).toFixed(2);

                    const canFitPreset = (a, k) =>
                      privateBooking ? true : a + k <= remaining;

                    const setGroup = (a, k) =>
                      setForm((f) => ({ ...f, adultsCount: a, kidsCount: k }));

                    const markPaid = () =>
                      setField("totalPaidAmount", estimate.toFixed(2));

                    return (
                      <>
                        <div className="space-y-6">
                          {/* PEOPLE */}
                          <div className="rounded-2xl border border-black/5 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                            <div className="mb-3 flex items-center justify-between">
                              <div className="text-sm font-semibold opacity-80">
                                Guests
                              </div>
                              {!privateBooking ? (
                                <div className="text-xs opacity-70">
                                  Remaining seats:{" "}
                                  <span className="font-semibold">
                                    {Math.max(0, remaining - (adults + kids))}
                                  </span>{" "}
                                  / {remaining}
                                </div>
                              ) : (
                                <div className="text-xs opacity-70">
                                  No capacity limit (private)
                                </div>
                              )}
                            </div>

                            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

                              <div className="rounded-xl border border-black/5 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
                                <div className="mb-1 flex items-center justify-between text-xs opacity-70">
                                  <span>
                                    {privateBooking
                                      ? "Group size"
                                      : "Slot capacity"}
                                  </span>
                                  <span>
                                    {numberOfPeople}
                                    {!privateBooking ? (
                                      <> / {totalCap}</>
                                    ) : null}
                                  </span>
                                </div>
                                {!privateBooking ? (
                                  <div className="h-2 w-full rounded-full bg-black/10 dark:bg-white/10">
                                    <div
                                      className="h-2 rounded-full bg-[#a3845b]"
                                      style={{
                                        width: `${Math.min(
                                          100,
                                          Math.round(
                                            ((bookedBefore + numberOfPeople) /
                                              totalCap) *
                                              100
                                          )
                                        )}%`,
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <div className="text-xs opacity-60">
                                    Private bookings don’t enforce a max size.
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Quick presets (wrap under) */}
                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              <span className="opacity-70">Quick presets:</span>
                              {[
                                { a: 1, k: 0, label: "1 adult" },
                                { a: 2, k: 0, label: "2 adults" },
                                { a: 2, k: 2, label: "2 + 2 kids" },
                                { a: 4, k: 0, label: "4 adults" },
                                { a: 6, k: 0, label: "6 adults" },
                              ].map((p) => {
                                const disabled = !canFitPreset(p.a, p.k);
                                return (
                                  <button
                                    key={p.label}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => setGroup(p.a, p.k)}
                                    className={[
                                      "rounded-full border px-3 py-1",
                                      "border-black/10 dark:border-white/10",
                                      disabled
                                        ? "cursor-not-allowed opacity-40"
                                        : "hover:bg-black/5 dark:hover:bg-white/10",
                                    ].join(" ")}
                                  >
                                    {p.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* PRICING */}
                          <div className="rounded-2xl border border-black/5 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                            <div className="mb-3 text-sm font-semibold opacity-80">
                              Pricing
                            </div>

                            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                              <Field
                                label="Unit price (adult)"
                                icon={<CreditCard className="h-4 w-4" />}
                              >
                                <div className="space-y-2">
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
                                      setField(
                                        "unitPriceAdult",
                                        e.target.value
                                      );
                                    }}
                                    placeholder="0.00"
                                    className="input"
                                  />

                                  <div className="flex flex-wrap gap-1">
                                    {[0, 25, 50, 100].map((n) => (
                                      <button
                                        key={n}
                                        type="button"
                                        className="rounded-full border border-black/10 px-2.5 py-1 text-xs hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                                        onClick={() =>
                                          setField(
                                            "unitPriceAdult",
                                            n.toFixed(2)
                                          )
                                        }
                                        title={`Set ${n.toFixed(2)} ${
                                          form.currency
                                        }`}
                                      >
                                        {n}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </Field>

                              <Field label="Unit price (kid)">
                                <div className="space-y-2">
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={form.unitPriceKid}
                                    onChange={(e) => {
                                      setPriceDirty((d) => ({
                                        ...d,
                                        kid: true,
                                      }));
                                      setField("unitPriceKid", e.target.value);
                                    }}
                                    placeholder="0.00"
                                    className="input"
                                  />

                                  <div>
                                    <button
                                      type="button"
                                      className="rounded-full border border-black/10 px-2.5 py-1 text-xs hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                                      onClick={() =>
                                        setField(
                                          "unitPriceKid",
                                          form.unitPriceAdult || "0.00"
                                        )
                                      }
                                      title="Match adult price"
                                    >
                                      Match adult
                                    </button>
                                  </div>
                                </div>
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
                                  className="input"
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
                          </div>

                          {/* TOTALS */}
                          <div className="rounded-2xl border border-black/5 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                            <div className="mb-3 text-sm font-semibold opacity-80">
                              Totals
                            </div>

                            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                              <Field label="Estimated total">
                                <div className="input flex items-center justify-between">
                                  <span className="opacity-70">Estimate</span>
                                  <strong>
                                    {estimate.toFixed(2)} {form.currency}
                                  </strong>
                                </div>
                              </Field>

                              <Field label="Total paid">
                                <div className="space-y-2">
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={form.totalPaidAmount}
                                    onChange={(e) =>
                                      setField(
                                        "totalPaidAmount",
                                        e.target.value
                                      )
                                    }
                                    placeholder="0.00"
                                    className="input"
                                  />
                                  <button
                                    type="button"
                                    onClick={markPaid}
                                    className="rounded-full border border-black/10 px-3 py-1 text-xs hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                                    title="Set paid = estimate"
                                  >
                                    Mark paid
                                  </button>
                                </div>
                              </Field>

                              <Field label="Booking status">
                                <select
                                  value={form.status}
                                  onChange={(e) =>
                                    setField("status", e.target.value)
                                  }
                                  className="input"
                                >
                                  <option value="confirmed">Confirmed</option>
                                  <option value="pending">Pending</option>
                                  <option value="cancelled">Cancelled</option>
                                </select>
                              </Field>
                            </div>

                            {/* Balance row */}
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/10 bg-white/60 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5">
                              <span className="opacity-70">Balance</span>
                              <span
                                className={[
                                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                  balance > 0
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                                    : balance < 0
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
                                ].join(" ")}
                                title={
                                  balance > 0
                                    ? "Amount due"
                                    : balance < 0
                                    ? "Overpaid (credit)"
                                    : "Fully paid"
                                }
                              >
                                {balance.toFixed(2)} {form.currency}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-4 flex justify-between">
                          <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="rounded-full border border-black/10 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
                          >
                            Back
                          </button>
                          <button
                            type="button"
                            onClick={() => setStep(3)}
                            disabled={!canEnterStep3}
                            className="inline-flex items-center gap-2 rounded-full bg-[#a3845b] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#b79266] disabled:opacity-60"
                          >
                            Continue
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </Card>
              )}

              {/* Step 3: Contact & notes (improved) */}
              {step === 3 && canEnterStep3 && (
                <Card title="Step 3 — Contact & notes">
                  {/* Wrapper with subtle glass effect */}
                  <div className="rounded-2xl ring-1 ring-black/5 dark:ring-white/10 bg-gradient-to-b from-white to-white/70 dark:from-white/5 dark:to-white/[0.03] p-4">
                    {/* Section heading */}
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-semibold">
                          Primary contact & notes
                        </h3>
                        <p className="mt-1 text-xs opacity-70">
                          We'll use these details to confirm the booking.
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium dark:bg-white/10">
                        Step 3
                      </span>
                    </div>

                    {/* Primary contact card */}
                    <div className="rounded-xl border border-black/5 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
                      <div className="mb-3 text-sm font-semibold opacity-80">
                        Primary contact
                      </div>

                      <div className="grid grid-cols-1 gap-x-4 gap-y-3 items-start sm:grid-cols-2 xl:grid-cols-4">
                        {/* First name */}
                        <Field
                          label="First name"
                          icon={<User className="h-4 w-4" />}
                        >
                          <input
                            id="firstName"
                            name="firstName"
                            autoComplete="given-name"
                            value={form.primary_contact?.firstName || ""}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="e.g., Maria"
                            className="w-full min-w-0 rounded-xl border border-black/10 bg-white/90 px-3 py-2 text-sm shadow-inner placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-[#a3845b] dark:border-white/10 dark:bg-white/10 dark:placeholder:text-white/40"
                          />
                        </Field>

                        {/* Surname */}
                        <Field
                          label="Surname"
                          icon={<User className="h-4 w-4" />}
                        >
                          <input
                            id="lastName"
                            name="lastName"
                            autoComplete="family-name"
                            value={form.primary_contact?.lastName || ""}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="e.g., Papadopoulou"
                            className="w-full min-w-0 rounded-xl border border-black/10 bg-white/90 px-3 py-2 text-sm shadow-inner placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-[#a3845b] dark:border-white/10 dark:bg-white/10 dark:placeholder:text-white/40"
                          />
                        </Field>

                        {/* Email */}
                        <Field
                          label="Email"
                          icon={<Mail className="h-4 w-4" />}
                        >
                          <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            inputMode="email"
                            value={form.primary_contact?.email || ""}
                            onChange={(e) =>
                              setContact("email", e.target.value)
                            }
                            placeholder="guest@example.com"
                            className="w-full min-w-0 rounded-xl border border-black/10 bg-white/90 px-3 py-2 text-sm shadow-inner placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-[#a3845b] dark:border-white/10 dark:bg-white/10 dark:placeholder:text-white/40"
                          />
                        </Field>

                        {/* Phone */}
                        <Field
                          label="Phone"
                          icon={<Phone className="h-4 w-4" />}
                        >
                          <input
                            id="phone"
                            name="phone"
                            inputMode="tel"
                            autoComplete="tel"
                            pattern="^[+]?[\\d\\s()\-]{7,}$"
                            value={form.primary_contact?.phone || ""}
                            onChange={(e) =>
                              setContact("phone", e.target.value)
                            }
                            placeholder="+30 69…"
                            className="w-full min-w-0 rounded-xl border border-black/10 bg-white/90 px-3 py-2 text-sm shadow-inner placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-[#a3845b] dark:border-white/10 dark:bg-white/10 dark:placeholder:text-white/40"
                          />
                        </Field>
                      </div>
                    </div>

                    {/* Notes card */}
                    <div className="mt-4 rounded-xl border border-black/5 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
                      <div className="mb-3 text-sm font-semibold opacity-80">
                        Notes
                      </div>

                      <Field
                        label="Internal notes"
                        icon={<StickyNote className="h-4 w-4" />}
                      >
                        <textarea
                          id="notes"
                          name="notes"
                          rows={5}
                          maxLength={600}
                          value={form.notes || ""}
                          onChange={(e) => setField("notes", e.target.value)}
                          placeholder="Special requests, dietary needs, logistics…"
                          className="w-full min-h-[120px] resize-y rounded-xl border border-black/10 bg-white/90 px-3 py-2 text-sm shadow-inner placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-[#a3845b] dark:border-white/10 dark:bg-white/10 dark:placeholder:text-white/40"
                          aria-describedby="notes-hint notes-count"
                        />
                      </Field>

                      <div className="mt-2 flex items-center justify-between text-xs opacity-70">
                        <p id="notes-hint">Visible to staff only.</p>
                        <p id="notes-count">{(form.notes || "").length}/600</p>
                      </div>
                    </div>

                    {/* Footer actions */}
                    <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-4 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="rounded-xl border border-black/10 px-4 py-2 text-sm transition hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:hover:bg-white/10 dark:focus:ring-white/20"
                      >
                        Back
                      </button>

                      <button
                        form="booking-form"
                        type="submit"
                        disabled={submitting}
                        aria-busy={submitting}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#a3845b] to-[#b79266] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#a3845b]/40 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {submitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        {submitting ? "Saving…" : "Create booking"}
                      </button>
                    </div>
                  </div>
                </Card>
              )}

              {/* Alerts */}
              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-900/20 dark:text-red-200">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-900/20 dark:text-emerald-200">
                  {success}
                </div>
              )}
            </div>

            {/* RIGHT: Summary */}
            <aside className="md:sticky md:top-16 space-y-6">
              <Card title="Summary" subtle>
                <div className="space-y-2 text-sm">
                  <Row label="Experience" value={experienceId || "—"} />
                  <Row
                    label="Mode"
                    value={privateBooking ? "Private booking" : "Book on slot"}
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
                  <Row label="Slot">
                    {privateBooking ? (
                      <span className="inline-flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> private
                      </span>
                    ) : selectedSlotId ? (
                      `#${selectedSlotId}`
                    ) : (
                      "—"
                    )}
                  </Row>
                  <Row label="People" value={numberOfPeople || "—"} />
                  <Row
                    label="Adults/Kids"
                    value={`${form.adultsCount}/${form.kidsCount}`}
                  />
                  <Row
                    label="Estimate"
                    value={`${estimate.toFixed(2)} ${form.currency}`}
                  />
                  <Row
                    label="Paid"
                    value={
                      form.totalPaidAmount !== ""
                        ? `${Number(form.totalPaidAmount).toFixed(2)} ${
                            form.currency
                          }`
                        : `0.00 ${form.currency}`
                    }
                  />
                  <Row label="Status" value={form.status} />
                </div>
              </Card>

              <Card title="Tips" subtle>
                <ul className="list-disc space-y-1 pl-5 text-sm opacity-80">
                  <li>Private bookings create a hidden slot (not public).</li>
                  <li>Capacity is capped at {MAX_GROUP} (min 1 adult).</li>
                  <li>Paid amount can be 0 (reservation only).</li>
                </ul>
              </Card>
            </aside>
          </form>
        </div>
      </section>
    </main>
  );
}

/* --------------------------- widgets --------------------------- */
function Stepper({ step, onStep, canEnterStep2 = true, canEnterStep3 = true }) {
  const steps = [
    { id: 1, label: "Experience" },
    { id: 2, label: "People & pricing", enabled: canEnterStep2 },
    { id: 3, label: "Contact & notes", enabled: canEnterStep3 },
  ];
  return (
    <div className="rounded-2xl border border-black/5 bg-white/70 p-3 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="grid grid-cols-3 gap-2">
        {steps.map((s) => {
          const active = s.id === step;
          const done = s.id < step;
          const enabled = s.enabled ?? true;
          return (
            <button
              key={s.id}
              onClick={() => enabled && onStep(s.id)}
              aria-disabled={!enabled}
              className={[
                "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                active
                  ? "bg-[#a3845b] text-white"
                  : done
                  ? "bg-black/5 dark:bg-white/10"
                  : "bg-transparent hover:bg-black/5 dark:hover:bg-white/10",
                !enabled
                  ? "opacity-50 cursor-not-allowed hover:bg-transparent"
                  : "",
              ].join(" ")}
            >
              {done ? (
                <Check className="h-4 w-4" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-current opacity-60" />
              )}
              <span className="font-medium">{s.label}</span>
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
    <div ref={ref}>
      <Field label={label} icon={<Search className="h-4 w-4" />}>
        <div
          className="input flex cursor-text items-center justify-between"
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
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="mt-2 overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-[#1a1a1a]"
          >
            <div className="flex items-center gap-2 border-b border-black/5 px-3 py-2 text-sm dark:border-white/10">
              <Search className="h-4 w-4 opacity-60" />
              <input
                autoFocus
                onChange={(e) => onQuery(e.target.value)}
                placeholder="Type to search…"
                className="w-full bg-transparent outline-none"
              />
            </div>
            <div className="max-h-64 overflow-auto">
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
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <span>{o.label}</span>
                    {value === o.value ? <Check className="h-4 w-4" /> : null}
                  </button>
                ))
              ) : (
                <div className="p-3 text-sm opacity-70">No results</div>
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
    <div>
      <div className="mb-2 text-sm font-medium opacity-80">Available slots</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {loading ? (
          <div className="rounded-xl border border-black/5 bg-white/70 p-4 text-sm opacity-70 dark:border-white/10 dark:bg-white/5">
            Loading slots…
          </div>
        ) : !slots?.length ? (
          <div className="rounded-xl border border-black/5 bg-white/70 p-4 text-sm opacity-70 dark:border-white/10 dark:bg-white/5">
            No slots for this date
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
                className={`group rounded-2xl border p-4 text-left shadow-sm transition ${
                  active
                    ? "border-[#a3845b] ring-2 ring-[#a3845b]/20"
                    : "border-black/5 hover:border-black/10"
                } ${disabled ? "opacity-50" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">
                    {fmtTimeRange(s.startsAt, s.endsAt)}
                  </div>
                  <div className="text-xs opacity-70">
                    {booked}/{total}
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-black/10 dark:bg-white/10">
                  <div
                    className="h-1.5 rounded-full bg-[#a3845b]"
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

function CapacityBar({ total, booked }) {
  const pct = Math.min(100, Math.round((booked / total) * 100));
  return (
    <div className="rounded-xl border border-black/5 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
      <div className="mb-1 flex items-center justify-between text-xs opacity-70">
        <span>Group capacity</span>
        <span>
          {booked}/{total}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-black/10 dark:bg-white/10">
        <div
          className="h-2 rounded-full bg-[#a3845b]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Counter({ label, value, min, max, onDec, onInc }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
      <div className="mb-2 text-sm font-medium opacity-80">{label}</div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onDec}
          disabled={Number(value) <= min}
          className="rounded-lg border border-black/10 px-3 py-1 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5"
        >
          −
        </button>
        <div className="text-base font-semibold">{value}</div>
        <button
          type="button"
          onClick={onInc}
          disabled={Number(value) >= max}
          className="rounded-lg border border-black/10 px-3 py-1 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5"
        >
          +
        </button>
      </div>
      <div className="mt-1 text-xs opacity-60">
        Min {min}, Max {max}
      </div>
    </div>
  );
}

/* --------------------------- layout bits --------------------------- */
function Card({ title, children, subtle }) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm backdrop-blur md:p-6 ${
        subtle
          ? "border-black/5 bg-white/60 dark:border-white/10 dark:bg-white/5"
          : "border-black/5 bg-white/70 dark:border-white/10 dark:bg-white/5"
      }`}
    >
      {title && (
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide opacity-70">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
function Field({ label, icon, children }) {
  return (
    <label className="block">
      {label && (
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
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
    <div className="flex items-center justify-between">
      <span className="opacity-60">{label}</span>
      <span className="font-medium">{children || value}</span>
    </div>
  );
}

/* --------------------------- shared styles --------------------------- */
const base =
  "w-full rounded-xl border px-4 py-2.5 text-[15px] outline-none transition";
const light =
  "border-[#d3cec7] bg-[#fafafa] placeholder:text-[#9a9388] focus:border-[#a3845b] focus:ring-4 focus:ring-[#a3845b]/20 dark:border-[#3b3b3b] dark:bg-[#1f1f1f] dark:placeholder:text-[#7f7a72]";
if (
  typeof document !== "undefined" &&
  !document.getElementById("admin-input-styles")
) {
  const style = document.createElement("style");
  style.id = "admin-input-styles";
  style.innerHTML = `.input{ ${base.replaceAll(" ", " ")}; ${light.replaceAll(
    " ",
    " "
  )} }`;
  document.head.appendChild(style);
}

/* --------------------------- utils --------------------------- */
function fmtTimeRange(a, b) {
  try {
    const A = a ? new Date(a) : null;
    const B = b ? new Date(b) : null;
    if (A && B) {
      return `${A.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}–${B.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    if (A) {
      return A.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return "—";
  } catch {
    return "—";
  }
}
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// Hoisted, memoized component (top-level)
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

    // optional dedupe to avoid re-fetching same key
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
          { signal: ctrl.signal, cache: "no-store" }
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

  // Map incoming availability by YYYY-MM-DD
  const map = useMemo(() => {
    const m = Object.create(null);
    for (const d of days || []) if (d?.date) m[d.date] = d;
    return m;
  }, [days]);

  // ---- Month navigation state ----
  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = React.useState(() => {
    // start at the month that contains "today"
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Helper: align to Monday (0..6 -> Mon..Sun)
  const weekdayIndexMonFirst = (d) => (d.getDay() + 6) % 7;

  // Compute first cell (Monday) of the view
  const viewMonthFirst = useMemo(() => {
    const d = new Date(viewDate);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [viewDate]);

  const gridStart = useMemo(() => {
    const d = new Date(viewMonthFirst);
    const w = weekdayIndexMonFirst(d); // how many days to go back to Monday
    d.setDate(d.getDate() - w);
    return d;
  }, [viewMonthFirst]);

  // Build 6x7 grid
  const cells = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const key = fmtYMD(d);
      const info = map[key];
      const open =
        info &&
        (info.slots ?? 0) > 0 &&
        (info.capacity ?? 0) > (info.booked ?? 0);
      arr.push({
        key,
        date: d,
        info,
        open,
        inMonth: d.getMonth() === viewMonthFirst.getMonth(),
      });
    }
    return arr;
  }, [gridStart, map, viewMonthFirst]);

  // Navigation helpers
  function goMonth(delta) {
    const next = new Date(viewMonthFirst);
    next.setMonth(viewMonthFirst.getMonth() + delta, 1);
    setViewDate(next);

    // Ask parent for enough range to cover this month (from today -> month end)
    const endOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0);
    const ms = endOfMonth.getTime() - today.getTime();
    const daysAhead = Math.max(30, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    onNavigateRange?.(daysAhead);
  }

  function goToday() {
    const base = new Date();
    base.setDate(1);
    base.setHours(0, 0, 0, 0);
    setViewDate(base);
    onNavigateRange?.(60); // a sensible default window
  }

  const headerLabel = `${
    monthNames[viewMonthFirst.getMonth()]
  } ${viewMonthFirst.getFullYear()}`;

  return (
    <div className="rounded-2xl border border-black/5 bg-white/70 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            className="rounded-lg border border-black/10 px-2 py-1 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            aria-label="Previous month"
          >
            ‹
          </button>
          <div className="text-sm font-semibold">{headerLabel}</div>
          <button
            type="button"
            onClick={() => goMonth(1)}
            className="rounded-lg border border-black/10 px-2 py-1 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            aria-label="Next month"
          >
            ›
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToday}
            className="rounded-full border border-black/10 px-3 py-1 text-xs hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
          >
            Today
          </button>
          <div className="hidden items-center gap-2 text-xs opacity-70 sm:flex">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-[#a3845b]" />
              Open
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-black/10 dark:bg-white/10" />
              Unavailable
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="rounded-xl border border-black/5 p-3 text-sm opacity-70 dark:border-white/10">
          Loading availability…
        </div>
      ) : (
        <>
          {/* Weekday labels (Mon–Sun) */}
          <div className="grid grid-cols-7 gap-1 text-xs opacity-60">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="px-2 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((c) => {
              const day = c.date.getDate();
              const isSelected = selectedDate === c.key;
              const badge = c.info ? `${c.info.slots ?? 0} slots` : "—";
              const isToday = fmtYMD(c.date) === fmtYMD(today);

              const baseClasses = [
                "h-16 rounded-xl border p-2 text-left transition",
                isSelected
                  ? "border-[#a3845b] ring-2 ring-[#a3845b]/20"
                  : "border-black/10 hover:border-black/20 dark:border-white/10",
                c.open
                  ? "bg-white/80 dark:bg-white/5"
                  : "bg-black/5 dark:bg-white/10 opacity-60",
                !c.inMonth ? "opacity-40" : "",
              ].join(" ");

              return (
                <button
                  key={c.key}
                  type="button"
                  disabled={!c.open}
                  onClick={() => onSelectDate(c.key)}
                  className={baseClasses}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {day}
                      {isToday && (
                        <span className="ml-1 rounded-full border border-[#a3845b]/40 px-1.5 text-[10px] font-semibold text-[#a3845b]">
                          today
                        </span>
                      )}
                    </span>
                    {isSelected ? (
                      <span className="text-[10px] font-semibold uppercase opacity-70">
                        Selected
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[11px] opacity-70">{badge}</div>
                </button>
              );
            })}
          </div>

          {/* Optional: keep your range quick buttons */}
          <div className="mt-3 flex items-center justify-end gap-2 text-xs">
            <span className="opacity-60">Range:</span>
            <button
              type="button"
              onClick={() => onNavigateRange?.(30)}
              className="rounded-full border border-black/10 px-3 py-1 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            >
              30 days
            </button>
            <button
              type="button"
              onClick={() => onNavigateRange?.(60)}
              className="rounded-full border border-black/10 px-3 py-1 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            >
              60 days
            </button>
            <button
              type="button"
              onClick={() => onNavigateRange?.(90)}
              className="rounded-full border border-black/10 px-3 py-1 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            >
              90 days
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// utils (top-level, outside any component)
function fmtYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* --------------------------- shared styles --------------------------- */
if (
  typeof document !== "undefined" &&
  !document.getElementById("admin-input-styles")
) {
  const style = document.createElement("style");
  style.id = "admin-input-styles";
  style.innerHTML = `
  .input{
    width:100%;
    border:1px solid #d3cec7;
    background:#fafafa;
    color:inherit;
    border-radius:0.75rem;
    padding:0.625rem 1rem; /* py-2.5 px-4 */
    font-size:15px;
    line-height:1.4;
    outline:none;
    box-sizing:border-box;
    transition:border-color .2s, box-shadow .2s, background-color .2s;
  }
  .input::placeholder{ color:#9a9388; }
  .input:focus{
    border-color:#a3845b;
    box-shadow:0 0 0 .25rem rgba(163,132,91,.20);
  }
  @media (prefers-color-scheme: dark) {
    .input{
      background:#1f1f1f;
      border-color:#3b3b3b;
    }
    .input::placeholder{ color:#7f7a72; }
  }`;
  document.head.appendChild(style);
}
