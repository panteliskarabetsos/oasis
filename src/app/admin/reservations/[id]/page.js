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
} from "lucide-react";
import { toast } from "react-hot-toast";

/* ---------------------------- helpers ---------------------------- */
const cx = (...xs) => xs.filter(Boolean).join(" ");
const fmtDateLong = (d) =>
  d
    ? new Date(d).toLocaleString("el-GR", {
        dateStyle: "full",
        timeStyle: "short",
      })
    : "-";
const fmtDateShort = (d) =>
  d
    ? new Date(d).toLocaleString("el-GR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-";
const fmtMoney = (n) =>
  typeof n === "number"
    ? n.toLocaleString("el-GR", { style: "currency", currency: "EUR" })
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

  const [showReschedule, setShowReschedule] = useState(false);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotFrom, setSlotFrom] = useState(() => toDateInput(new Date()));
  const [slotTo, setSlotTo] = useState(() =>
    toDateInput(plusDays(new Date(), 60))
  );
  const [targetSlotId, setTargetSlotId] = useState("");

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
            (await res.json().catch(() => ({})))?.error || "Σφάλμα φόρτωσης"
          );
        const { item } = await res.json();
        setItem(item);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

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
        (await res.json().catch(() => ({})))?.error || "Αποτυχία ακύρωσης"
      );
    setItem((curr) => ({ ...curr, status: "cancelled" }));
    setShowCancel(false);
    toast.success("Η κράτηση ακυρώθηκε");
  }

  async function loadSlots() {
    if (!item?.experience?.id) return setSlots([]);
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
            "Σφάλμα φόρτωσης διαθέσιμων"
        );
      const payload = await res.json();
      setSlots(payload?.items || []);
    } finally {
      setSlotsLoading(false);
    }
  }

  async function submitReschedule() {
    if (!targetSlotId) return toast.error("Επιλέξτε νέο slot");
    const res = await fetch(`/api/admin/reservations/${item.id}/reschedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ scheduleSlotId: Number(targetSlotId) }),
    });
    if (!res.ok)
      throw new Error(
        (await res.json().catch(() => ({})))?.error || "Αποτυχία μεταφοράς"
      );
    const payload = await res.json();
    setItem((curr) => ({
      ...curr,
      startTime: payload?.newStartTime || curr.startTime,
    }));
    setShowReschedule(false);
    toast.success("Η κράτηση μεταφέρθηκε");
  }

  const isCancelled = item?.status === "cancelled";
  const isPaid = item?.status === "confirmed";
  const guestInitials = (item?.guest?.name || "-")
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");

  /* ------------------------------ UI ------------------------------ */
  return (
    <div className="pb-16">
      {/* sticky header */}
      <div className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/admin/reservations")}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-neutral-50"
            >
              <ArrowLeft className="h-4 w-4" /> Πίσω
            </button>
            <div className="ml-1 text-sm text-neutral-600">
              {item?.code ? (
                <span className="font-mono">{item.code}</span>
              ) : (
                <span className="text-neutral-400">#{id}</span>
              )}
              {item?.source ? (
                <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
                  {item.source}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                toast.success("Αντιγράφηκε ο σύνδεσμος");
              }}
              className="rounded-xl border p-2 text-sm hover:bg-neutral-50"
              title="Αντιγραφή συνδέσμου"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-xl border p-2 text-sm hover:bg-neutral-50"
              title="Εκτύπωση"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowReschedule(true)}
              className="rounded-xl border p-2 text-sm hover:bg-amber-50 disabled:opacity-50"
              title="Μεταφορά"
              disabled={isCancelled}
            >
              <CalendarClock className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowCancel(true)}
              className="rounded-xl border p-2 text-sm hover:bg-red-50 disabled:opacity-50"
              title="Ακύρωση"
              disabled={isCancelled}
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4">
        {loading ? (
          <Skeleton />
        ) : error ? (
          <div className="mt-6 rounded-2xl border p-8 text-red-600">
            {error}
          </div>
        ) : !item ? (
          <div className="mt-6 rounded-2xl border p-8 text-neutral-600">
            Δεν βρέθηκε η κράτηση.
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Hero */}
            <div className="rounded-3xl border bg-white p-5">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div className="flex items-center gap-4">
                  {/* avatar */}
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border bg-neutral-50 font-semibold text-neutral-700">
                    {guestInitials || "?"}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-lg font-semibold text-neutral-900">
                        {item.guest?.name || "Χωρίς όνομα"}
                      </h1>
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="mt-1 text-sm text-neutral-600">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-4 w-4" /> {item.counts?.adults ?? 0}
                        {typeof item.counts?.kids === "number"
                          ? ` + ${item.counts.kids}`
                          : ""}
                      </span>
                      <span className="mx-2">•</span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-4 w-4" />{" "}
                        {fmtDateShort(item.startTime)}
                      </span>
                      {item.experience?.name ? (
                        <>
                          <span className="mx-2">•</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-4 w-4" />{" "}
                            {item.experience?.name}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold text-neutral-900">
                    {fmtMoney(item.money?.totalAmount)}
                  </div>
                  <div className="text-xs text-neutral-500">Σύνολο</div>
                </div>
              </div>
            </div>

            {/* Grid cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card title="Πληροφορίες κράτησης">
                <Row label="Ημερομηνία">{fmtDateLong(item.startTime)}</Row>
                <Row label="Εμπειρία">{item.experience?.name || "-"}</Row>
                <Row
                  label={
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-4 w-4" /> Τοποθεσία
                    </span>
                  }
                >
                  {item.experience?.location || "-"}
                </Row>
                <Row label="Κωδικός" mono>
                  {item.code}
                </Row>
                <Row label="Δημιουργήθηκε">{fmtDateShort(item.createdAt)}</Row>
                <Row label="Ενημερώθηκε">{fmtDateShort(item.updatedAt)}</Row>
                <Row label="Πηγή" mono>
                  {item.source}
                </Row>
              </Card>

              <Card title="Πελάτης">
                <Row
                  label={
                    <span className="inline-flex items-center gap-1">
                      <User2 className="h-4 w-4" /> Όνομα
                    </span>
                  }
                >
                  {item.guest?.name || "-"}
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
                      <Phone className="h-4 w-4" /> Τηλέφωνο
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
                <Row label="Σημειώσεις">{item.notes || "-"}</Row>
              </Card>

              <Card title="Πληρωμή">
                <Row label="Κατάσταση πληρωμής">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={item.status} />
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
                  {item.payments?.stripeSessionId || "-"}
                </Row>
                <Row
                  label={
                    <span className="inline-flex items-center gap-1">
                      <CreditCard className="h-4 w-4" /> Payment Intent
                    </span>
                  }
                  mono
                >
                  {item.payments?.stripePaymentIntentId || "-"}
                </Row>
                <Row label="Σύνολο" mono>
                  {fmtMoney(item.money?.totalAmount)}
                </Row>
              </Card>

              {/* Optional attendees list if present */}
              {Array.isArray(item?.attendees) && item.attendees.length > 0 && (
                <Card title="Συμμετέχοντες">
                  <div className="divide-y rounded-xl border">
                    {item.attendees.map((a, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                      >
                        <span className="truncate">
                          {a?.name || `#${idx + 1}`}
                        </span>
                        <span className="text-neutral-500">
                          {a?.type || "ενήλικας"}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cancel modal */}
      {showCancel && (
        <Modal onClose={() => setShowCancel(false)} title="Ακύρωση κράτησης">
          <div className="space-y-3">
            <p className="text-sm text-neutral-600">
              Θέλετε σίγουρα να ακυρώσετε; Αυτή η ενέργεια θα ελευθερώσει θέσεις
              στο slot.
            </p>
            <label className="block text-sm">
              <span className="text-neutral-700">Λόγος (προαιρετικό)</span>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="mt-1 w-full rounded-xl border p-2 text-sm"
                rows={3}
              />
            </label>
            <div className="flex items-center justify-end gap-2">
              <button
                className="rounded-xl border px-3 py-2 text-sm"
                onClick={() => setShowCancel(false)}
              >
                Κλείσιμο
              </button>
              <button
                className="rounded-xl border px-3 py-2 text-sm bg-red-600 text-white"
                onClick={() =>
                  cancelBooking().catch((e) => toast.error(e.message))
                }
              >
                Ακύρωση κράτησης
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reschedule modal */}
      {showReschedule && (
        <Modal
          onClose={() => setShowReschedule(false)}
          title="Μεταφορά κράτησης"
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-neutral-600">Από</label>
                <input
                  type="date"
                  value={slotFrom}
                  onChange={(e) => setSlotFrom(e.target.value)}
                  className="mt-1 w-full rounded-xl border p-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-600">Έως</label>
                <input
                  type="date"
                  value={slotTo}
                  onChange={(e) => setSlotTo(e.target.value)}
                  className="mt-1 w-full rounded-xl border p-2 text-sm"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() =>
                    loadSlots().catch((e) => toast.error(e.message))
                  }
                  className="rounded-xl border px-3 py-2 text-sm w-full sm:w-auto"
                >
                  Φόρτωση διαθέσιμων
                </button>
              </div>
            </div>

            <div className="rounded-xl border">
              <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-neutral-500">Τρέχον slot</div>
                  <div className="text-sm">{fmtDateShort(item?.startTime)}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500">Νέο slot</div>
                  <select
                    value={targetSlotId}
                    onChange={(e) => setTargetSlotId(e.target.value)}
                    className="mt-1 w-full rounded-xl border p-2 text-sm"
                  >
                    <option value="">— Επιλέξτε —</option>
                    {slotsLoading ? (
                      <option value="" disabled>
                        Φόρτωση…
                      </option>
                    ) : (
                      slots.map((s) => (
                        <option
                          key={s.id}
                          value={s.id}
                          disabled={(s.available ?? 0) <= 0}
                        >
                          {fmtDateShort(s.date)} — {s.experienceName} •
                          Διαθέσιμες: {s.available}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                className="rounded-xl border px-3 py-2 text-sm"
                onClick={() => setShowReschedule(false)}
              >
                Κλείσιμο
              </button>
              <button
                className="rounded-xl border px-3 py-2 text-sm bg-amber-600 text-white"
                onClick={() =>
                  submitReschedule().catch((e) => toast.error(e.message))
                }
              >
                Μεταφορά κράτησης
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------- Subcomponents ---------------------------- */
function Card({ title, children }) {
  return (
    <div className="rounded-3xl border bg-white">
      <div className="border-b px-4 py-3 text-sm font-semibold text-neutral-800">
        {title}
      </div>
      <div className="p-4 space-y-2">{children}</div>
    </div>
  );
}
function Row({ label, children, mono }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <div className="text-neutral-500 min-w-[160px]">{label}</div>
      <div className={cx("flex-1 text-neutral-900", mono && "font-mono")}>
        {children}
      </div>
    </div>
  );
}
function StatusBadge({ status }) {
  const map = {
    confirmed: "bg-green-100 text-green-800 border-green-200",
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
    draft: "bg-neutral-100 text-neutral-700 border-neutral-200",
  };
  const label =
    {
      confirmed: "Επιβεβαιωμένη",
      pending: "Σε εκκρεμότητα",
      cancelled: "Ακυρωμένη",
      draft: "Προσχέδιο",
    }[status] ||
    status ||
    "-";
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs",
        map[status]
      )}
    >
      {label}
    </span>
  );
}
function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-base font-semibold text-neutral-800">{title}</h3>
          <button
            className="rounded-lg p-1 hover:bg-neutral-100"
            onClick={onClose}
          >
            <span className="sr-only">Κλείσιμο</span>✕
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
