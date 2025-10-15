"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Save,
  Users,
  User,
  Mail,
  Phone,
  CalendarClock,
  CreditCard,
  ChevronDown,
  StickyNote,
} from "lucide-react";

/* ---------------------------- constants ---------------------------- */
const MAX_GROUP = 8; // hard cap
const MIN_ADULTS = 1;

/* ----------------------------- page ----------------------------- */
export default function NewBookingPage() {
  const router = useRouter();

  // Gate (optional)
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

  // Form matches Booking table
  const [form, setForm] = useState({
    userId: "", // integer
    scheduleSlotId: "", // integer (points to ScheduleSlot.id)
    status: "confirmed", // default
    notes: "",

    adultsCount: 1,
    kidsCount: 0,
    unitPriceAdult: "",
    unitPriceKid: "",
    totalPaidAmount: "", // amount actually paid (can be 0)
    currency: "EUR",

    // jsonb
    primary_contact: {
      name: "",
      email: "",
      phone: "",
    },
    attendees: [], // optional list of {name, email?}
    counts: null, // will auto-fill {adults, kids, total}

    // optional Stripe
    stripeSessionId: "",
    stripePaymentIntentId: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  /* --------------------------- derived --------------------------- */
  const numberOfPeople = useMemo(
    () =>
      Math.max(
        0,
        (parseInt(form.adultsCount) || 0) + (parseInt(form.kidsCount) || 0)
      ),
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

  const estimate = useMemo(
    () =>
      (parseInt(form.adultsCount) || 0) * priceAdult +
      (parseInt(form.kidsCount) || 0) * priceKid,
    [form.adultsCount, form.kidsCount, priceAdult, priceKid]
  );

  /* --------------------------- helpers --------------------------- */
  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function setContact(k, v) {
    setForm((f) => ({
      ...f,
      primary_contact: { ...(f.primary_contact || {}), [k]: v },
    }));
  }
  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }
  function bumpAdults(delta) {
    const nextAdults = clamp(
      (parseInt(form.adultsCount) || 0) + delta,
      MIN_ADULTS,
      MAX_GROUP
    );
    const currKids = parseInt(form.kidsCount) || 0;
    const remain = MAX_GROUP - nextAdults;
    const nextKids = clamp(currKids, 0, remain);
    setForm((f) => ({ ...f, adultsCount: nextAdults, kidsCount: nextKids }));
  }
  function bumpKids(delta) {
    const a = parseInt(form.adultsCount) || 0;
    const nextKids = clamp(
      (parseInt(form.kidsCount) || 0) + delta,
      0,
      Math.max(0, MAX_GROUP - a)
    );
    setForm((f) => ({ ...f, kidsCount: nextKids }));
  }

  function validate() {
    if (!String(form.userId).trim() || !Number.isFinite(Number(form.userId)))
      return "User ID must be a valid number.";
    if (
      !String(form.scheduleSlotId).trim() ||
      !Number.isFinite(Number(form.scheduleSlotId))
    )
      return "Schedule Slot ID must be a valid number.";

    const a = parseInt(form.adultsCount) || 0;
    const k = parseInt(form.kidsCount) || 0;
    if (a < MIN_ADULTS) return "At least one adult is required.";
    if (a + k < 1) return "Number of people must be at least 1.";
    if (a + k > MAX_GROUP) return `Group size cannot exceed ${MAX_GROUP}.`;

    if (form.unitPriceAdult !== "" && (isNaN(priceAdult) || priceAdult < 0))
      return "Adult unit price must be a non-negative number.";
    if (form.unitPriceKid !== "" && (isNaN(priceKid) || priceKid < 0))
      return "Kid unit price must be a non-negative number.";
    if (
      form.totalPaidAmount !== "" &&
      (isNaN(parseFloat(form.totalPaidAmount)) ||
        parseFloat(form.totalPaidAmount) < 0)
    )
      return "Total paid amount must be a non-negative number.";

    if (!/^\S+@\S+\.\S+$/.test(form.primary_contact?.email || ""))
      return "Primary contact email is invalid.";
    if (!form.primary_contact?.name?.trim())
      return "Primary contact name is required.";
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
      const payload = {
        userId: Number(form.userId),
        scheduleSlotId: Number(form.scheduleSlotId),
        status: form.status,
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
          name: form.primary_contact?.name?.trim() || "",
          email: form.primary_contact?.email?.trim().toLowerCase() || "",
          phone: form.primary_contact?.phone?.trim() || "",
        },

        attendees: form.attendees?.length ? form.attendees : null,

        stripeSessionId: form.stripeSessionId?.trim() || null,
        stripePaymentIntentId: form.stripePaymentIntentId?.trim() || null,
      };

      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const j = await safeJson(res);
        throw new Error(j?.error || "Failed to create booking");
      }

      const data = await res.json();
      setSuccess("Booking created");
      const id = data?.id || data?.booking?.id;
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
    <main className="rounded-3xl min-h-screen bg-[#f4f1ec] text-[#2f2f2f] transition-colors duration-500 dark:bg-[#0f0f0f] dark:text-[#e9e4da]">
      {/* Sticky header */}
      <div className="rounded-xl sticky top-0 z-10 border-b border-black/5 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-white/5">
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

      {/* Form */}
      <section className="px-4 py-6 md:px-6 md:py-10">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="md:col-span-2"
          >
            <form
              id="booking-form"
              onSubmit={handleSubmit}
              className="grid gap-6"
            >
              {/* Relations */}
              <Card title="Relations">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="User ID"
                    required
                    icon={<User className="h-4 w-4" />}
                  >
                    <input
                      inputMode="numeric"
                      value={form.userId}
                      onChange={(e) => setField("userId", e.target.value)}
                      placeholder="e.g., 42"
                      className="input"
                    />
                  </Field>
                  <Field
                    label="Schedule Slot ID"
                    required
                    icon={<CalendarClock className="h-4 w-4" />}
                  >
                    <input
                      inputMode="numeric"
                      value={form.scheduleSlotId}
                      onChange={(e) =>
                        setField("scheduleSlotId", e.target.value)
                      }
                      placeholder="e.g., 317"
                      className="input"
                    />
                  </Field>
                </div>
              </Card>

              {/* Primary contact */}
              <Card title="Primary contact">
                <div className="grid gap-4 md:grid-cols-3">
                  <Field
                    label="Name"
                    required
                    icon={<User className="h-4 w-4" />}
                  >
                    <input
                      value={form.primary_contact?.name || ""}
                      onChange={(e) => setContact("name", e.target.value)}
                      placeholder="Full name"
                      className="input"
                    />
                  </Field>
                  <Field
                    label="Email"
                    required
                    icon={<Mail className="h-4 w-4" />}
                  >
                    <input
                      type="email"
                      value={form.primary_contact?.email || ""}
                      onChange={(e) => setContact("email", e.target.value)}
                      placeholder="guest@example.com"
                      className="input"
                    />
                  </Field>
                  <Field label="Phone" icon={<Phone className="h-4 w-4" />}>
                    <input
                      value={form.primary_contact?.phone || ""}
                      onChange={(e) => setContact("phone", e.target.value)}
                      placeholder="+30 69…"
                      className="input"
                    />
                  </Field>
                </div>
              </Card>

              {/* People & Pricing */}
              <Card title="People & pricing">
                <div className="grid gap-6">
                  {/* Counters */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <Counter
                      label="Adults"
                      value={form.adultsCount}
                      min={MIN_ADULTS}
                      max={MAX_GROUP}
                      onDec={() => bumpAdults(-1)}
                      onInc={() => bumpAdults(1)}
                    />
                    <Counter
                      label="Kids"
                      value={form.kidsCount}
                      min={0}
                      max={Math.max(
                        0,
                        MAX_GROUP - (parseInt(form.adultsCount) || 0)
                      )}
                      onDec={() => bumpKids(-1)}
                      onInc={() => bumpKids(1)}
                    />
                    <CapacityBar total={MAX_GROUP} booked={numberOfPeople} />
                  </div>

                  {/* Prices */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field
                      label="Unit price (adult)"
                      icon={<CreditCard className="h-4 w-4" />}
                    >
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.unitPriceAdult}
                        onChange={(e) =>
                          setField("unitPriceAdult", e.target.value)
                        }
                        placeholder="0.00"
                        className="input"
                      />
                    </Field>
                    <Field label="Unit price (kid)">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.unitPriceKid}
                        onChange={(e) =>
                          setField("unitPriceKid", e.target.value)
                        }
                        placeholder="0.00"
                        className="input"
                      />
                    </Field>
                    <Field label="Currency">
                      <select
                        value={form.currency}
                        onChange={(e) => setField("currency", e.target.value)}
                        className="input"
                      >
                        <option>EUR</option>
                        <option>USD</option>
                        <option>GBP</option>
                      </select>
                    </Field>
                  </div>

                  {/* Totals */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Estimated total (calc)">
                      <div className="input flex items-center justify-between">
                        <span className="opacity-70">Estimate</span>
                        <strong>
                          {estimate.toFixed(2)} {form.currency}
                        </strong>
                      </div>
                    </Field>
                    <Field label="Total paid amount">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.totalPaidAmount}
                        onChange={(e) =>
                          setField("totalPaidAmount", e.target.value)
                        }
                        placeholder="0.00"
                        className="input"
                      />
                    </Field>
                    <Field label="Booking status">
                      <select
                        value={form.status}
                        onChange={(e) => setField("status", e.target.value)}
                        className="input"
                      >
                        <option value="confirmed">Confirmed</option>
                        <option value="pending">Pending</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </Field>
                  </div>
                </div>

                <p className="mt-2 text-xs opacity-70">
                  People: <b>{numberOfPeople}</b> (max {MAX_GROUP}). At least
                  one adult required.
                </p>
              </Card>

              {/* Notes */}
              <Card title="Notes">
                <Field icon={<StickyNote className="h-4 w-4" />}>
                  <textarea
                    rows={5}
                    value={form.notes}
                    onChange={(e) => setField("notes", e.target.value)}
                    placeholder="Special requests, dietary needs, logistics…"
                    className="input min-h-[120px]"
                  />
                </Field>
              </Card>

              {/* Advanced */}
              <Card
                title={
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((s) => !s)}
                    className="flex w-full items-center justify-between"
                  >
                    <span>Advanced (Stripe IDs & attendees)</span>
                    <ChevronDown
                      className={`h-4 w-4 transition ${
                        showAdvanced ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                }
              >
                <AnimatePresence initial={false}>
                  {showAdvanced && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="grid gap-4 md:grid-cols-2"
                    >
                      <Field label="Stripe session ID">
                        <input
                          value={form.stripeSessionId}
                          onChange={(e) =>
                            setField("stripeSessionId", e.target.value)
                          }
                          placeholder="cs_test_..."
                          className="input"
                        />
                      </Field>
                      <Field label="Stripe payment intent ID">
                        <input
                          value={form.stripePaymentIntentId}
                          onChange={(e) =>
                            setField("stripePaymentIntentId", e.target.value)
                          }
                          placeholder="pi_..."
                          className="input"
                        />
                      </Field>

                      {/* Attendees quick add (optional) */}
                      <div className="md:col-span-2">
                        <AttendeesEditor
                          attendees={form.attendees}
                          onChange={(attendees) =>
                            setField("attendees", attendees)
                          }
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>

              {/* Alerts + Actions */}
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

              <div className="flex justify-end gap-2">
                <Link
                  href="/admin/bookings"
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-full bg-[#a3845b] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#b79266] disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {submitting ? "Saving…" : "Create booking"}
                </button>
              </div>
            </form>
          </motion.div>

          {/* Sidebar */}
          <aside className="md:sticky md:top-16">
            <Card title="Summary" subtle>
              <div className="space-y-2 text-sm">
                <Row label="User ID" value={String(form.userId || "—")} />
                <Row
                  label="Slot ID"
                  value={String(form.scheduleSlotId || "—")}
                />
                <Row
                  label="Contact"
                  value={form.primary_contact?.name || "—"}
                />
                <Row label="Email" value={form.primary_contact?.email || "—"} />
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
                      : "0.00 " + form.currency
                  }
                />
                <Row label="Status" value={form.status} />
              </div>
            </Card>

            <div className="mt-6">
              <Card title="Checklist" subtle>
                <ul className="list-disc space-y-1 pl-5 text-sm opacity-80">
                  <li>Link to valid User & ScheduleSlot</li>
                  <li>Confirm primary contact email</li>
                  <li>Set prices & (optional) paid amount</li>
                </ul>
              </Card>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

/* --------------------------- widgets --------------------------- */
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

function AttendeesEditor({ attendees = [], onChange }) {
  const [draft, setDraft] = useState({ name: "", email: "" });

  function add() {
    if (!draft.name.trim()) return;
    const next = [
      ...attendees,
      { name: draft.name.trim(), email: draft.email.trim() || undefined },
    ];
    onChange(next);
    setDraft({ name: "", email: "" });
  }
  function remove(idx) {
    const next = attendees.slice();
    next.splice(idx, 1);
    onChange(next);
  }

  return (
    <div>
      <div className="mb-2 text-sm font-medium opacity-80">
        Attendees (optional)
      </div>
      <div className="flex flex-col gap-2 md:flex-row">
        <input
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="Name"
          className="input md:flex-1"
        />
        <input
          value={draft.email}
          onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
          placeholder="Email (optional)"
          className="input md:flex-1"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-xl bg-[#a3845b] px-4 py-2 text-sm font-medium text-white hover:bg-[#b79266]"
        >
          Add
        </button>
      </div>
      {!!attendees.length && (
        <ul className="mt-3 divide-y divide-black/5 rounded-xl border border-black/5 dark:divide-white/10 dark:border-white/10">
          {attendees.map((a, i) => (
            <li
              key={i}
              className="flex items-center justify-between px-3 py-2 text-sm"
            >
              <span className="truncate">
                <b>{a.name}</b>{" "}
                {a.email ? (
                  <span className="opacity-70">— {a.email}</span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded-lg border border-black/10 px-2 py-1 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
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
function Field({ label, icon, required, children }) {
  return (
    <label className="block">
      {label && (
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          {icon && <span className="text-[#a3845b]">{icon}</span>}
          <span>
            {label}
            {required && <span className="ml-1 text-[#b44d4d]">*</span>}
          </span>
        </div>
      )}
      <div className="relative">{children}</div>
    </label>
  );
}
function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="opacity-60">{label}</span>
      <span className="font-medium">{value}</span>
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
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
