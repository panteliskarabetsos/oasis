"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  XCircle,
  Mail,
  Phone,
  User2,
  MapPin,
  Printer,
  Copy,
  CreditCard,
  CheckCircle2,
  Clock3,
  Users,
  Loader2,
  DollarSign,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import BookingPricingEditor from "../../components/BookingPricingEditor";

/* ---------------------------- helpers ---------------------------- */
const cx = (...xs) => xs.filter(Boolean).join(" ");
const fmtDateLong = (d) =>
  d
    ? new Date(d).toLocaleString("en-GB", {
        dateStyle: "full",
        timeStyle: "short",
      })
    : "-";
const fmtDateShort = (d) =>
  d
    ? new Date(d).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-";
const fmtMoney = (n, currency = "EUR") =>
  typeof n === "number"
    ? n.toLocaleString("en-GB", { style: "currency", currency })
    : "-";

function toDateInput(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function plusDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/* ------------------------------ Page ------------------------------ */
export default function ReservationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal state
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showStripeSession, setShowStripeSession] = useState(false);
  const [showPricing, setShowPricing] = useState(false);

  const [showReschedule, setShowReschedule] = useState(false);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotFrom, setSlotFrom] = useState(() => toDateInput(new Date()));
  const [slotTo, setSlotTo] = useState(() =>
    toDateInput(plusDays(new Date(), 60))
  );
  const [targetSlotId, setTargetSlotId] = useState("");
  const [rev, setRev] = useState(0);
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/admin/reservations/${id}`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok)
          throw new Error(
            (await res.json().catch(() => ({})))?.error || "Failed to load"
          );
        const { item } = await res.json();
        setItem(normalizeBooking(item));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/admin/reservations/${id}`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok)
          throw new Error(
            (await res.json().catch(() => ({})))?.error || "Failed to load"
          );
        const { item } = await res.json();
        setItem(normalizeBooking(item));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, rev]);

  /* ------------------------------ actions ------------------------------ */
  async function cancelBooking() {
    const res = await fetch(`/api/admin/reservations/${item.id}/cancel`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ reason: cancelReason }),
    });
    if (!res.ok)
      throw new Error(
        (await res.json().catch(() => ({})))?.error || "Cancellation failed"
      );
    setItem((curr) => ({ ...curr, status: "cancelled" }));
    setShowCancel(false);
    toast.success("Reservation cancelled");
  }

  async function loadSlots() {
    if (!item || isPrivate || !item?.experience?.id) return setSlots([]);
    setSlotsLoading(true);
    try {
      const qs = new URLSearchParams({
        experienceId: String(item.experience.id),
      });
      if (slotFrom) qs.set("from", slotFrom);
      if (slotTo) qs.set("to", slotTo);
      const res = await fetch(`/api/admin/schedule/slots?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ||
            "Failed to load availability"
        );
      const payload = await res.json();
      setSlots(payload?.items || []);
    } finally {
      setSlotsLoading(false);
    }
  }
  function normalizeBooking(raw) {
    if (!raw || typeof raw !== "object") return null;

    // ids & type
    const scheduleSlotId = raw.scheduleSlotId ?? raw.slot?.id ?? null;
    const isPrivate = !scheduleSlotId;

    // time
    const startTime =
      raw.startTime ?? raw.date ?? raw.ScheduleSlot?.date ?? null;

    // experience
    const experienceId =
      raw.experienceId ??
      raw.slot?.experienceId ??
      raw.Experience?.id ??
      raw.experience?.id ??
      null;

    const experienceName =
      raw.experienceName ??
      raw.customExperienceName ??
      raw.Experience?.name ??
      raw.experience?.name ??
      null;

    // guest/contact
    const u = raw.user || raw.User || {};
    const pc =
      raw.primary_contact || raw.primaryContact || raw.guestSnapshot || {};

    const guestName =
      [u?.name, u?.surname].filter(Boolean).join(" ").trim() ||
      pc?.name ||
      [pc?.firstName, pc?.lastName].filter(Boolean).join(" ").trim() ||
      null;

    const guest = {
      name: guestName,
      email: u?.email || pc?.email || null,
      phone: u?.phone || pc?.phone || null,
    };

    // counts
    const counts = raw.counts || {
      adults:
        (Number.isFinite(raw.adults) ? raw.adults : null) ??
        (Number.isFinite(raw.adultsCount) ? raw.adultsCount : null) ??
        0,
      kids:
        (Number.isFinite(raw.kids) ? raw.kids : null) ??
        (Number.isFinite(raw.kidsCount) ? raw.kidsCount : null) ??
        0,
    };
    if (!Number.isFinite(counts.total)) {
      counts.total = (Number(counts.adults) || 0) + (Number(counts.kids) || 0);
    }

    // pricing & money
    const unitPrices = {
      adult: Number.isFinite(raw.unitPriceAdult) ? raw.unitPriceAdult : null,
      kid: Number.isFinite(raw.unitPriceKid) ? raw.unitPriceKid : null,
    };

    const money = {
      currency: raw.currency || "EUR",
      totalPaidAmount: Number.isFinite(raw.totalPaidAmount)
        ? raw.totalPaidAmount
        : null,
      totalAmount: Number.isFinite(raw.totalAmount) ? raw.totalAmount : null,
    };

    // payments
    const payments = {
      stripeSessionId: raw.stripeSessionId ?? null,
      stripePaymentIntentId: raw.stripePaymentIntentId ?? null,
    };

    return {
      // identity
      id: raw.id,
      code:
        raw.code || (raw.id ? `B-${String(raw.id).padStart(6, "0")}` : null),

      // status & meta
      status: raw.status || "confirmed",
      createdAt: raw.createdAt || raw.created_at || null,
      updatedAt: raw.updatedAt || raw.updated_at || null,
      notes: raw.notes ?? null,
      source: raw.source || null,

      // type
      isPrivate,
      scheduleSlotId,

      // timing
      startTime,
      duration: raw.duration ?? null,

      // experience (unified)
      experience: {
        id: experienceId,
        name: experienceName || (isPrivate ? "Private booking" : null),
        location: raw.experience?.location ?? null, // if your API includes it
        isCustom: isPrivate || !experienceId,
      },

      // guest + snapshots
      guest,
      guestSnapshot: pc,

      // counts & attendees
      counts,
      numberOfPeople: Number.isFinite(raw.numberOfPeople)
        ? raw.numberOfPeople
        : counts.total,
      attendees: Array.isArray(raw.attendees) ? raw.attendees : [],

      // pricing & money & payments
      unitPrices,
      money,
      payments,

      // raw fallbacks (kept for safety)
      currency: raw.currency,
      unitPriceAdult: raw.unitPriceAdult,
      unitPriceKid: raw.unitPriceKid,
      totalPaidAmount: raw.totalPaidAmount,
      customExperienceName: raw.customExperienceName ?? null,
    };
  }

  async function submitReschedule() {
    if (!targetSlotId) return toast.error("Select a new slot");
    const res = await fetch(`/api/admin/reservations/${item.id}/reschedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ scheduleSlotId: Number(targetSlotId) }),
    });
    if (!res.ok)
      throw new Error(
        (await res.json().catch(() => ({})))?.error || "Reschedule failed"
      );
    const payload = await res.json();
    setItem((curr) => ({
      ...curr,
      startTime: payload?.newStartTime || curr.startTime,
    }));
    setShowReschedule(false);
    toast.success("Reservation rescheduled");
  }

  // ------- derived UI state -------
  const statusNorm = String(item?.status || "").toLowerCase();
  const isCancelled = statusNorm === "cancelled";
  const isPrivate = !!item?.isPrivate;
  const isPaid =
    statusNorm === "paid" ||
    statusNorm === "confirmed" ||
    statusNorm === "completed" ||
    statusNorm === "checked_in";

  // ---- money & counts derived ----
  const moneyCurrency = item?.money?.currency || "EUR";

  const paidTotal =
    typeof item?.money?.totalPaidAmount === "number"
      ? item.money.totalPaidAmount
      : Number(item?.money?.totalAmount) || 0;

  const unitPriceAdult = Number(item?.unitPrices?.adult ?? 0);
  const unitPriceKid = Number(item?.unitPrices?.kid ?? 0);
  const adults = Number(item?.counts?.adults ?? 0);
  const kids = Number(item?.counts?.kids ?? 0);

  const estimate = +(adults * unitPriceAdult + kids * unitPriceKid).toFixed(2);
  const balance = +(
    estimate - (Number.isFinite(paidTotal) ? paidTotal : 0)
  ).toFixed(2);

  const guestName = (item?.guest?.name || "").trim() || "";

  const guestInitials = (guestName || "-")
    .split(" ")
    .filter(Boolean)
    .map((x) => x[0])
    .slice(0, 2)
    .join("");

  const priceAdult = item?.unitPrices?.adult ?? null;
  const priceKid = item?.unitPrices?.kid ?? null;

  const currency = moneyCurrency;
  // make sure your money() handles 0 correctly:
  function money(n, c = "EUR") {
    if (n === null || n === undefined) return "—";
    const num = typeof n === "string" ? Number(n) : n;
    return Number.isFinite(num) ? `${num.toFixed(2)} ${c}` : "—";
  }
  const sourceBadge = item?.source ? (
    <span
      className={cx(
        "ml-2 rounded-full border px-2 py-0.5 text-xs",
        item.source === "admin" &&
          "bg-purple-50 border-purple-200 text-purple-700",
        item.source === "web" && "bg-blue-50 border-blue-200 text-blue-700",
        item.source === "phone" &&
          "bg-amber-50 border-amber-200 text-amber-800",
        !["admin", "web", "phone"].includes(item.source) &&
          "bg-neutral-100 border-neutral-200 text-neutral-600"
      )}
    >
      {item.source}
    </span>
  ) : null;

  /* ------------------------------ UI ------------------------------ */
  return (
    <div className="pb-16">
      {/* sticky header */}
      <div className="rounded-full sticky top-0 z-40 border-b bg-white/75 backdrop-blur supports-[backdrop-filter]:bg-white/55 print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => router.push("/admin/bookings")}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <div className="ml-1 truncate text-sm text-neutral-600">
              {item?.code ? (
                <span className="font-mono">{item.code}</span>
              ) : (
                <span className="text-neutral-400">#{id}</span>
              )}
              {sourceBadge}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <IconButton
              onClick={() => {
                const ok =
                  typeof navigator !== "undefined" &&
                  navigator.clipboard?.writeText;
                if (ok) {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success("Link copied");
                } else {
                  toast.error("Copy not supported by this browser");
                }
              }}
              title="Copy link"
              ariaLabel="Copy link"
            >
              <Copy className="h-4 w-4" />
            </IconButton>
            <IconButton
              onClick={() => window.print()}
              title="Print"
              ariaLabel="Print"
            >
              <Printer className="h-4 w-4" />
            </IconButton>
            <IconButton
              onClick={() => setShowReschedule(true)}
              title="Reschedule"
              ariaLabel="Reschedule reservation"
              disabled={isCancelled || isPrivate}
              className="hover:bg-amber-50"
            >
              <CalendarClock className="h-4 w-4" />
            </IconButton>
            <IconButton
              onClick={() => setShowCancel(true)}
              title="Cancel"
              ariaLabel="Cancel reservation"
              disabled={isCancelled}
              className="hover:bg-red-50"
            >
              <XCircle className="h-4 w-4" />
            </IconButton>
            <IconButton
              onClick={() => setShowPricing(true)}
              title="Edit pricing"
              ariaLabel="Edit pricing"
              disabled={isCancelled}
              className="hover:bg-emerald-50"
            >
              <DollarSign className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {showPricing && (
          <motion.div
            key="pricing-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setShowPricing(false)}
          >
            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
              className="w-full max-w-2xl rounded-2xl border border-black/10 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-[#111]"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Edit pricing & payment"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide opacity-70">
                  Pricing & payment
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPricing(false)}
                  className="rounded-lg border border-black/10 px-3 py-1 text-xs hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                >
                  Close
                </button>
              </div>

              <BookingPricingEditor
                bookingId={id}
                onClose={() => setShowPricing(false)}
                onSaved={(updated) => {
                  setShowPricing(false);

                  setRev((v) => v + 1);
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-5xl px-4">
        {loading ? (
          <Skeleton />
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-8 text-red-700">
            {error}
          </div>
        ) : !item ? (
          <div className="mt-6 rounded-2xl border p-8 text-neutral-600">
            Reservation not found.
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Hero */}
            <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
              <div className="relative">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-400 via-amber-400 to-pink-400" />
                <div className="flex flex-col justify-between gap-4 p-5 md:flex-row md:items-center">
                  <div className="flex items-center gap-4 min-w-0">
                    {/* avatar */}
                    <div className="grid h-12 w-12 place-items-center rounded-2xl border bg-neutral-50 font-semibold text-neutral-700">
                      {guestInitials || "?"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="truncate text-lg font-semibold text-neutral-900">
                          {guestName || "No name"}
                        </h1>
                        <StatusBadge status={statusNorm} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
                        <Chip icon={<Users className="h-3.5 w-3.5" />}>
                          {item.counts?.adults ?? 0}
                          {typeof item.counts?.kids === "number"
                            ? ` + ${item.counts.kids}`
                            : ""}
                          {typeof item.counts?.teens === "number"
                            ? ` + ${item.counts.teens}`
                            : ""}
                        </Chip>
                        <Dot />
                        <Chip icon={<CalendarClock className="h-3.5 w-3.5" />}>
                          {fmtDateShort(item.startTime)}
                        </Chip>
                        {item.experience?.name ? (
                          <>
                            <Dot />
                            <Chip icon={<MapPin className="h-3.5 w-3.5" />}>
                              {item.experience?.name}
                              {isPrivate && (
                                <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                  Private
                                </span>
                              )}
                            </Chip>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-semibold text-neutral-900">
                      {fmtMoney(paidTotal, moneyCurrency)}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {typeof item?.money?.totalPaidAmount === "number"
                        ? "Total paid"
                        : "Total"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card title="Reservation info">
                <Row label="Date">{fmtDateLong(item.startTime)}</Row>
                <Row label="Experience">
                  {item.experience?.name || "-"}
                  {isPrivate && (
                    <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      Private
                    </span>
                  )}
                </Row>
                <Row
                  label={
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-4 w-4" /> Location
                    </span>
                  }
                >
                  {item.experience?.location || "-"}
                </Row>
                <Row label="Duration">
                  {Number.isFinite(item.duration)
                    ? `${item.duration} min`
                    : "-"}
                </Row>

                <Row label="Code" mono>
                  <Copyable value={item.code} empty="-" />
                </Row>
                <Row label="Price / adult">{money(priceAdult, currency)}</Row>
                <Row label="Price / kid">{money(priceKid, currency)}</Row>
                <Row label="Created">{fmtDateShort(item.createdAt)}</Row>
                <Row label="Updated">{fmtDateShort(item.updatedAt)}</Row>
                <Row label="Source" mono>
                  {item.source || "-"}
                </Row>
              </Card>

              <Card title="Customer">
                <Row
                  label={
                    <span className="inline-flex items-center gap-1">
                      <User2 className="h-4 w-4" /> Name
                    </span>
                  }
                >
                  {guestName || "-"}
                </Row>
                <Row
                  label={
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-4 w-4" /> Email
                    </span>
                  }
                  mono
                >
                  {item.guest?.email ? (
                    <a
                      className="hover:underline"
                      href={`mailto:${item.guest.email}`}
                    >
                      {item.guest.email}
                    </a>
                  ) : (
                    "-"
                  )}
                </Row>
                <Row
                  label={
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-4 w-4" /> Phone
                    </span>
                  }
                  mono
                >
                  {item.guest?.phone ? (
                    <a
                      className="hover:underline"
                      href={`tel:${item.guest.phone}`}
                    >
                      {item.guest.phone}
                    </a>
                  ) : (
                    "-"
                  )}
                </Row>
                <Row label="Notes">{item.notes || "-"}</Row>
              </Card>

              <Card title="Payment">
                <Row label="Payment status">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={statusNorm} />
                  </div>
                </Row>
                <Row
                  label={
                    <span className="inline-flex items-center gap-1">
                      <CreditCard className="h-4 w-4" /> Stripe Session
                    </span>
                  }
                  mono
                >
                  {item?.payments?.stripeSessionId ? (
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setShowStripeSession(true)}
                        className=" "
                      >
                        Show
                      </Button>
                      {/* <Copyable value={item.payments.stripeSessionId} /> */}
                    </div>
                  ) : (
                    "-"
                  )}
                </Row>

                <Row
                  label={
                    <span className="inline-flex items-center gap-1">
                      <CreditCard className="h-4 w-4" /> Payment Intent
                    </span>
                  }
                  mono
                >
                  <Copyable
                    value={item.payments?.stripePaymentIntentId}
                    empty="-"
                  />
                </Row>
                <Row
                  label={
                    typeof item?.money?.totalPaidAmount === "number"
                      ? "Total paid"
                      : "Total"
                  }
                  mono
                >
                  {fmtMoney(paidTotal, moneyCurrency)}
                  {balance < 0 && (
                    <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-900/20 dark:text-amber-100">
                      Overpaid by{" "}
                      <strong>
                        {fmtMoney(Math.abs(balance), moneyCurrency)}
                      </strong>
                      . Consider issuing a refund or keeping it as credit.
                    </div>
                  )}
                </Row>
              </Card>

              {/* Optional attendees list if present */}
              {Array.isArray(item?.attendees) && item.attendees.length > 0 && (
                <Card title="Attendees">
                  <div className="divide-y rounded-xl border">
                    {item.attendees.map((a, idx) => {
                      const name =
                        a?.name ||
                        [a?.firstName, a?.lastName].filter(Boolean).join(" ") ||
                        `#${idx + 1}`;
                      const type = a?.type || a?.category || "adult";
                      const age =
                        typeof a?.age === "number" && Number.isFinite(a.age)
                          ? a.age
                          : null;

                      // pick the first non-empty notes-like field
                      const notes =
                        (typeof a?.notes === "string" && a.notes.trim()) ||
                        (typeof a?.allergies === "string" &&
                          a.allergies.trim()) ||
                        (typeof a?.dietary === "string" && a.dietary.trim()) ||
                        (typeof a?.comment === "string" && a.comment.trim()) ||
                        null;

                      return (
                        <div
                          key={idx}
                          className="px-3 py-2 hover:bg-neutral-50"
                        >
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="truncate">{name}</span>
                            <div className="flex items-center gap-2">
                              {age !== null && (
                                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                                  {age}
                                </span>
                              )}
                              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                                {type}
                              </span>
                            </div>
                          </div>

                          {notes && (
                            <div className="mt-1 text-xs text-neutral-600">
                              Notes: {notes}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      {showStripeSession && (
        <Modal
          onClose={() => setShowStripeSession(false)}
          title="Stripe Session ID"
        >
          <div className="space-y-3">
            <textarea
              readOnly
              value={item?.payments?.stripeSessionId || ""}
              rows={8}
              className="mt-1 w-full rounded-xl border p-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setShowStripeSession(false)}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  const v = item?.payments?.stripeSessionId || "";
                  if (navigator?.clipboard?.writeText) {
                    navigator.clipboard.writeText(v);
                    toast.success("Copied");
                  } else {
                    toast.error("Copy not supported");
                  }
                }}
              >
                Copy
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cancel modal */}
      {showCancel && (
        <Modal onClose={() => setShowCancel(false)} title="Cancel reservation">
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              Are you sure you want to cancel? This action will free up seats
              for this slot.
              {isPrivate
                ? " This will release the private time."
                : " This action will free up seats for this slot."}
            </p>
            <label className="block text-sm">
              <span className="text-neutral-700">Reason (optional)</span>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="mt-1 w-full rounded-xl border p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                rows={3}
              />
            </label>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCancel(false)}>
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  cancelBooking().catch((e) => toast.error(e.message))
                }
              >
                Cancel reservation
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reschedule modal */}
      {showReschedule && !isPrivate && (
        <Modal
          onClose={() => setShowReschedule(false)}
          title="Reschedule reservation"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs text-neutral-600">From</label>
                <input
                  type="date"
                  value={slotFrom}
                  onChange={(e) => setSlotFrom(e.target.value)}
                  className="mt-1 w-full rounded-xl border p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-600">To</label>
                <input
                  type="date"
                  value={slotTo}
                  onChange={(e) => setSlotTo(e.target.value)}
                  className="mt-1 w-full rounded-xl border p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
                />
              </div>
              <div className="flex items-end">
                <Button
                  className="w-full sm:w-auto"
                  onClick={() =>
                    loadSlots().catch((e) => toast.error(e.message))
                  }
                >
                  {slotsLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </span>
                  ) : (
                    "Load availability"
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border">
              <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-neutral-500">Current slot</div>
                  <div className="text-sm">{fmtDateShort(item?.startTime)}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500">New slot</div>
                  <select
                    value={targetSlotId}
                    onChange={(e) => setTargetSlotId(e.target.value)}
                    className="mt-1 w-full rounded-xl border p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                  >
                    <option value="">— Select —</option>
                    {slotsLoading ? (
                      <option value="" disabled>
                        Loading…
                      </option>
                    ) : (
                      slots.map((s) => (
                        <option
                          key={s.id}
                          value={s.id}
                          disabled={(s.available ?? 0) <= 0}
                        >
                          {fmtDateShort(s.date)} — {s.experienceName} •
                          Available: {s.available}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowReschedule(false)}>
                Close
              </Button>
              <Button
                variant="amber"
                onClick={() =>
                  submitReschedule().catch((e) => toast.error(e.message))
                }
              >
                Reschedule
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* print helpers */}
      <style jsx global>{`
        @media print {
          .print\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ---------------------------- Subcomponents ---------------------------- */
function Card({ title, children }) {
  return (
    <div className="rounded-3xl border bg-white shadow-sm">
      <div className="border-b px-4 py-3 text-sm font-semibold text-neutral-800">
        {title}
      </div>
      <div className="space-y-2 p-4">{children}</div>
    </div>
  );
}
function Row({ label, children, mono }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <div className="min-w-[160px] text-neutral-500">{label}</div>
      <div className={cx("flex-1 text-neutral-900", mono && "font-mono")}>
        {children}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = String(status || "").toLowerCase();
  const map = {
    paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
    confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
    completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
    checked_in: "bg-emerald-100 text-emerald-800 border-emerald-200",
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
    draft: "bg-neutral-100 text-neutral-700 border-neutral-200",
    converted: "bg-sky-100 text-sky-800 border-sky-200",
  };
  const dotMap = {
    paid: "bg-emerald-500",
    confirmed: "bg-emerald-500",
    completed: "bg-emerald-500",
    checked_in: "bg-emerald-500",
    pending: "bg-amber-500",
    cancelled: "bg-red-500",
    draft: "bg-neutral-400",
    converted: "bg-sky-500",
  };
  const labelMap = {
    paid: "Paid",
    confirmed: "Confirmed",
    completed: "Completed",
    checked_in: "Checked-in",
    pending: "Pending",
    cancelled: "Cancelled",
    draft: "Draft",
    converted: "Converted",
  };
  const cls = map[s] || "bg-neutral-100 text-neutral-700 border-neutral-200";
  const dot = dotMap[s] || "bg-neutral-400";
  const label = labelMap[s] || status || "-";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
        cls
      )}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-base font-semibold text-neutral-800">{title}</h3>
          <button
            className="rounded-lg p-1 hover:bg-neutral-100"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto mt-6 max-w-5xl space-y-4">
      <div className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="h-48 animate-pulse rounded-3xl bg-neutral-100" />
        <div className="h-48 animate-pulse rounded-3xl bg-neutral-100" />
        <div className="h-48 animate-pulse rounded-3xl bg-neutral-100" />
        <div className="h-48 animate-pulse rounded-3xl bg-neutral-100" />
      </div>
    </div>
  );
}

function IconButton({ children, className, title, ariaLabel, ...props }) {
  return (
    <button
      className={cx(
        "rounded-xl border p-2 text-sm hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:opacity-50",
        className
      )}
      title={title}
      aria-label={ariaLabel || title}
      {...props}
    >
      {children}
    </button>
  );
}

function Button({ variant = "default", className, children, ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50";
  const variants = {
    default:
      "border-neutral-200 bg-white hover:bg-neutral-50 focus-visible:ring-neutral-300",
    ghost:
      "border-transparent bg-transparent hover:bg-neutral-50 focus-visible:ring-neutral-300",
    destructive:
      "border-red-600 bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-300",
    amber:
      "border-amber-600 bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-300",
  };
  return (
    <button className={cx(base, variants[variant], className)} {...props}>
      {children}
    </button>
  );
}

function Chip({ children, icon }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
      {icon}
      {children}
    </span>
  );
}

function Dot() {
  return (
    <span className="mx-2 inline-block h-1 w-1 rounded-full bg-neutral-300 align-middle" />
  );
}

function Copyable({ value, empty = "-" }) {
  if (!value) return <span>{empty}</span>;
  return (
    <span className="group inline-flex max-w-full items-center gap-2">
      <span className="truncate">{value}</span>
      <button
        type="button"
        onClick={() => {
          const ok =
            typeof navigator !== "undefined" && navigator.clipboard?.writeText;
          if (ok) {
            navigator.clipboard.writeText(String(value));
            toast.success("Copied!");
          } else {
            toast.error("Copy not supported");
          }
        }}
        className="invisible rounded-lg border p-1 text-xs group-hover:visible hover:bg-neutral-50"
        title="Copy"
        aria-label="Copy"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
