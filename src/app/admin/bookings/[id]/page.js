"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import Icon from "../../_ui/Icon";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  Muted,
  Page,
  PageHeader,
  Skeleton,
  StatusBadge,
  inputClass,
} from "../../_ui";

/* ---------------------------- helpers ---------------------------- */

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

const fractionDigits = (curr = "EUR") =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: curr,
  }).resolvedOptions().maximumFractionDigits;

const minorToMajor = (minor, curr = "EUR") => {
  const fd = fractionDigits(curr);
  return (Number(minor) || 0) / 10 ** fd;
};

const fmtMoney = (n, currency = "EUR") => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "-";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    Number(n),
  );
};

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

// Pull out likely promo fields and compute discount if needed
function extractPromoFromRaw(raw, unitPrices, counts) {
  try {
    const pj =
      raw.promoJson || raw.promo_json || raw.promo || raw.discount || null;

    const codeList = []
      .concat(raw.appliedPromoCode || [])
      .concat(raw.promoCodes || [])
      .concat(raw.promoCode || [])
      .concat((pj && pj.code) || []);
    const flat = codeList.flat
      ? codeList.flat()
      : [].concat(...codeList.map((x) => (Array.isArray(x) ? x : [x])));
    const codes = [
      ...new Set(
        flat
          .filter(Boolean)
          .map((x) => String(x).trim())
          .filter(Boolean),
      ),
    ];
    const code = codes.length ? codes.join(" + ") : null;

    let discountAmount = Number(raw.discountAmount);
    if (!Number.isFinite(discountAmount) || discountAmount <= 0) {
      const type = String(pj?.discountType || pj?.type || "").toLowerCase();
      const val = Number(pj?.discountValue ?? pj?.value);
      if (type && Number.isFinite(val)) {
        const subtotal =
          Number(counts?.adults || 0) * (Number(unitPrices?.adult) || 0) +
          Number(counts?.kids || 0) * (Number(unitPrices?.kid) || 0);
        if (type.includes("percent") || type === "percentage") {
          discountAmount = Math.max(
            0,
            Math.round(subtotal * (val / 100) * 100) / 100,
          );
        } else if (type.includes("fixed") || type === "amount") {
          discountAmount = Math.max(0, val);
        }
      }
    }
    if (!Number.isFinite(discountAmount) || discountAmount < 0)
      discountAmount = 0;

    return { code, discountAmount };
  } catch {
    return { code: null, discountAmount: 0 };
  }
}

// Extract payment method + card details from Stripe payload

// Normalize API payload into a clean booking model
function normalizeBooking(raw) {
  if (!raw || typeof raw !== "object") return null;

  const scheduleSlotId = raw.scheduleSlotId ?? raw.slot?.id ?? null;
  const isPrivate = !scheduleSlotId;

  const startTime = raw.startTime ?? raw.date ?? raw.ScheduleSlot?.date ?? null;
  const experienceId =
    raw.experienceId ??
    raw.slot?.experienceId ??
    raw.Experience?.id ??
    raw.experience?.id ??
    null;
  const experienceName =
    raw.experienceName ?? raw.Experience?.name ?? raw.experience?.name ?? null;

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
    discountAmount: Number.isFinite(raw.discountAmount)
      ? raw.discountAmount
      : null,
  };

  const promo = extractPromoFromRaw(raw, unitPrices, counts);

  const payments = {
    stripeSessionId:
      raw.payments?.stripeSessionId ?? raw.stripeSessionId ?? null,
    stripePaymentIntentId:
      raw.payments?.stripePaymentIntentId ?? raw.stripePaymentIntentId ?? null,
    paymentMethod: raw.payments?.paymentMethod ?? raw.paymentMethod ?? null,
    ledger: raw.payments?.ledger || [], // Ensure ledger is passed through
  };

  return {
    id: raw.id,
    code: raw.code || (raw.id ? `B-${String(raw.id).padStart(6, "0")}` : null),
    status: raw.status || "confirmed",
    createdAt: raw.createdAt || raw.created_at || null,
    updatedAt: raw.updatedAt || raw.updated_at || null,
    notes: raw.notes ?? null,
    source: raw.source || null,
    isPrivate,
    scheduleSlotId,
    startTime,
    duration: raw.duration ?? null,
    customExperienceName: raw.customExperienceName ?? null,
    experience: {
      id: experienceId,
      name: experienceName,
      location: raw.experience?.location ?? null,
      isCustom: isPrivate || !experienceId,
    },
    selected_meetup_point: raw.selected_meetup_point || null,
    guest,
    guestSnapshot: pc,
    counts,
    numberOfPeople: Number.isFinite(raw.numberOfPeople)
      ? raw.numberOfPeople
      : counts.total,
    attendees: Array.isArray(raw.attendees) ? raw.attendees : [],
    unitPrices,
    money,
    payments,
    promo,
    currency: raw.currency,
    unitPriceAdult: raw.unitPriceAdult,
    unitPriceKid: raw.unitPriceKid,
    totalPaidAmount: raw.totalPaidAmount,
  };
}

// Stripe summary helper (collected/refunded/net)
const normalizeStripeSummary = (raw, fallbackCurrency) => {
  const empty = {
    currency: (fallbackCurrency || "EUR").toUpperCase(),
    collectedCents: 0,
    refundedCents: 0,
    netCents: 0,
    refunds: [],
  };
  if (!raw) return empty;

  const unwrapPI = (x) => {
    if (!x || typeof x !== "object") return null;
    if (x.object === "payment_intent") return x;
    if (x.payment_intent && typeof x.payment_intent === "object")
      return x.payment_intent;
    if (x.paymentIntent && typeof x.paymentIntent === "object")
      return x.paymentIntent;
    if (x.item && typeof x.item === "object") return unwrapPI(x.item);
    if (x.data && x.data.object) return unwrapPI(x.data.object);
    return x;
  };

  const pi = unwrapPI(raw);
  const baseCurrency = (
    pi?.currency ||
    raw?.currency ||
    raw?.charges?.data?.[0]?.currency ||
    fallbackCurrency ||
    "EUR"
  ).toUpperCase();
  const charges = Array.isArray(pi?.charges?.data)
    ? pi.charges.data
    : Array.isArray(raw?.charges?.data)
      ? raw.charges.data
      : [];

  let collectedCents = Number(pi?.amount_received) || 0;
  if (!collectedCents && charges.length) {
    collectedCents = charges.reduce(
      (sum, c) => sum + Number(c?.amount_captured ?? c?.amount ?? 0),
      0,
    );
  }

  let refundObjs = [];
  if (Array.isArray(raw?.refunds?.data)) refundObjs = raw.refunds.data;
  else if (Array.isArray(pi?.refunds?.data)) refundObjs = pi.refunds.data;
  else if (Array.isArray(raw?.refunds)) refundObjs = raw.refunds;

  if (charges.length) {
    charges.forEach((c) => {
      const rs = Array.isArray(c?.refunds?.data)
        ? c.refunds.data
        : Array.isArray(c?.refunds)
          ? c.refunds
          : [];
      if (rs.length) {
        refundObjs.push(...rs);
      } else if (Number(c?.amount_refunded) > 0) {
        refundObjs.push({
          id: `${c.id}-refund`,
          amount: Number(c.amount_refunded),
          currency: (c.currency || baseCurrency).toUpperCase(),
          created: Number(c.created || 0),
          status: "succeeded",
          reason: "",
          _synthetic: true,
        });
      }
    });
  }

  if (!refundObjs.length && charges.length) {
    const sumRef = charges.reduce(
      (s, c) => s + Number(c?.amount_refunded || 0),
      0,
    );
    if (sumRef > 0) {
      refundObjs.push({
        id: "refund-total",
        amount: sumRef,
        currency: baseCurrency,
        created: Number(pi?.created || charges[0]?.created || 0),
        status: "succeeded",
        reason: "Refund (summary)",
        _synthetic: true,
      });
    }
  }

  const refundedCents = refundObjs.reduce(
    (s, r) => s + Number(r?.amount || 0),
    0,
  );
  const netCents = Math.max(0, collectedCents - refundedCents);

  const refunds = refundObjs
    .map((r) => ({
      id: r.id,
      amount: Number(r.amount || 0),
      currency: (r.currency || baseCurrency).toUpperCase(),
      created: Number(r.created || 0),
      status: r.status || (r._synthetic ? "succeeded" : ""),
      reason:
        r.reason ||
        r?.metadata?.reason ||
        (r._synthetic ? "Refund (summary)" : ""),
    }))
    .sort((a, b) => b.created - a.created);

  return {
    currency: baseCurrency,
    collectedCents,
    refundedCents,
    netCents,
    refunds,
  };
};

const fmtTs = (sec) =>
  sec
    ? new Date(sec * 1000).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-";


/* ------------------------------ Page ------------------------------ */

export default function ReservationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const piId = useMemo(
    () =>
      item?.payments?.stripePaymentIntentId || item?.stripePaymentIntentId || null,
    [item]
  );

  const [modal, setModal] = useState(null); // "cancel" | "reschedule"
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotFrom, setSlotFrom] = useState(() => toDateInput(new Date()));
  const [slotTo, setSlotTo] = useState(() => toDateInput(plusDays(new Date(), 60)));
  const [targetSlotId, setTargetSlotId] = useState("");

  const [stripe, setStripe] = useState(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeErr, setStripeErr] = useState("");

  /* -------------------------- data fetching -------------------------- */
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
          throw new Error((await res.json().catch(() => ({})))?.error || "Failed to load");
        const { item: raw } = await res.json();
        setItem(normalizeBooking(raw));
      } catch (e) {
        setError(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!piId) return;
    let aborted = false;
    (async () => {
      try {
        setStripeLoading(true);
        setStripeErr("");
        const res = await fetch(`/api/admin/payments/${piId}`, {
          cache: "no-store",
          credentials: "include",
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || "Failed to load payment");
        if (!aborted) setStripe(j?.item || j);
      } catch (e) {
        if (!aborted) {
          setStripe(null);
          setStripeErr(e?.message || "Failed to load payment");
        }
      } finally {
        if (!aborted) setStripeLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [piId]);

  /* ------------------------------ actions ------------------------------ */
  async function run(fn, ok) {
    setBusy(true);
    setActionError("");
    try {
      await fn();
      if (ok) toast.success(ok);
      setModal(null);
    } catch (e) {
      setActionError(e?.message || "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const cancelBooking = () =>
    run(async () => {
      const res = await fetch(`/api/admin/reservations/${item.id}/cancel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: cancelReason }),
      });
      if (!res.ok)
        throw new Error((await res.json().catch(() => ({})))?.error || "Cancellation failed");
      setItem((c) => ({ ...c, status: "cancelled" }));
    }, "Reservation cancelled");

  async function loadSlots(f = slotFrom, t = slotTo) {
    if (!item || item?.isPrivate || !item?.experience?.id) return setSlots([]);
    setSlotsLoading(true);
    try {
      const qs = new URLSearchParams({ experienceId: String(item.experience.id) });
      if (f) qs.set("from", f);
      if (t) qs.set("to", t);
      const res = await fetch(`/api/admin/schedule/slots?${qs}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error || "Failed to load availability"
        );
      setSlots((await res.json())?.items || []);
    } catch (e) {
      toast.error(e.message || "Failed to load availability");
    } finally {
      setSlotsLoading(false);
    }
  }

  const submitReschedule = () => {
    if (!targetSlotId) return toast.error("Select a new slot");
    return run(async () => {
      const res = await fetch(`/api/admin/reservations/${item.id}/reschedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ scheduleSlotId: Number(targetSlotId) }),
      });
      if (!res.ok)
        throw new Error((await res.json().catch(() => ({})))?.error || "Reschedule failed");
      const payload = await res.json();
      setItem((c) => ({ ...c, startTime: payload?.newStartTime || c.startTime }));
    }, "Reservation rescheduled");
  };

  /* ----------------------- derived UI state ----------------------- */
  const isCancelled = String(item?.status || "").toLowerCase() === "cancelled";
  const isPrivate = !!item?.isPrivate;
  const displayExperienceName =
    item?.customExperienceName || item?.experience?.name || "Custom private experience";

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
  const promoCode = item?.promo?.code || null;
  const discountValue = Number(item?.promo?.discountAmount || 0);
  const grandTotal = Math.max(0, +(estimate - discountValue).toFixed(2));
  const balance = +(grandTotal - (Number.isFinite(paidTotal) ? paidTotal : 0)).toFixed(2);

  const stripeSummary = useMemo(
    () => normalizeStripeSummary(stripe, moneyCurrency),
    [stripe, moneyCurrency]
  );
  const { currency: stripeCurrency, collectedCents, refundedCents, netCents, refunds } =
    stripeSummary;

  const offlineLedger = item?.payments?.ledger || [];
  const paymentMethod = item?.payments?.paymentMethod || null;
  const guestName = (item?.guest?.name || "").trim();
  const attendees = Array.isArray(item?.attendees) ? item.attendees : [];

  /* -------------------------------- view -------------------------------- */

  if (loading) {
    return (
      <Page>
        <Skeleton className="mb-4 h-8 w-52" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-44" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-80" />
        </div>
      </Page>
    );
  }

  if (error || !item) {
    return (
      <Page>
        <Card padded={false}>
          <EmptyState
            icon={<Icon name="calendar" size={20} />}
            title="Reservation not found"
            description={error || "This booking may have been deleted."}
            action={
              <Button as={Link} href="/admin/bookings" variant="secondary">
                Back to bookings
              </Button>
            }
          />
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <div className="mb-4">
        <Link
          href="/admin/bookings"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#8b6f47] hover:underline"
        >
          <Icon name="x" size={13} className="rotate-45" /> All bookings
        </Link>
      </div>

      <PageHeader
        eyebrow={item.code}
        title={displayExperienceName}
        description={
          item.startTime
            ? fmtDateLong(item.startTime)
            : isPrivate
              ? "Private booking — no scheduled slot"
              : "No date set"
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                toast.success("Link copied");
              }}
            >
              <Icon name="external" size={15} /> Copy link
            </Button>
            {!isPrivate && !isCancelled ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setActionError("");
                  setTargetSlotId("");
                  setModal("reschedule");
                  loadSlots();
                }}
              >
                <Icon name="clock" size={15} /> Reschedule
              </Button>
            ) : null}
            {!isCancelled ? (
              <Button
                variant="danger"
                onClick={() => {
                  setActionError("");
                  setCancelReason("");
                  setModal("cancel");
                }}
              >
                <Icon name="x" size={15} /> Cancel
              </Button>
            ) : null}
            {piId ? (
              <Button as={Link} href={`/admin/payments/${piId}`} variant="primary">
                <Icon name="card" size={15} /> Payment
              </Button>
            ) : balance > 0 ? (
              <Button as={Link} href={`/admin/bookings/${id}/payment-setup`} variant="primary">
                <Icon name="card" size={15} /> Collect {fmtMoney(balance, moneyCurrency)}
              </Button>
            ) : null}
          </>
        }
      />

      {/* status strip */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StatusBadge status={item.status} />
        {isPrivate ? <Badge variant="info">private</Badge> : null}
        {item.source ? <Badge>{item.source}</Badge> : null}
        {promoCode ? <Badge variant="brand">{promoCode}</Badge> : null}
        {balance > 0 && !isCancelled ? (
          <Badge variant="warning">{fmtMoney(balance, moneyCurrency)} outstanding</Badge>
        ) : grandTotal > 0 ? (
          <Badge variant="success">paid in full</Badge>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ------------------------- left column ------------------------- */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Reservation" />
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              <Row label="When">
                {item.startTime ? fmtDateLong(item.startTime) : "—"}
              </Row>
              <Row label="Experience">{displayExperienceName}</Row>
              <Row label="Location">{item.experience?.location || "—"}</Row>
              <Row label="Duration">{item.duration ? `${item.duration} min` : "—"}</Row>
              <Row label="Party">
                {adults} adult{adults === 1 ? "" : "s"}
                {kids ? `, ${kids} child${kids === 1 ? "" : "ren"}` : ""}
              </Row>
              <Row label="Created">{item.createdAt ? fmtDateShort(item.createdAt) : "—"}</Row>
              {item.selected_meetup_point ? (
                <Row label="Meeting point" className="sm:col-span-2">
                  {typeof item.selected_meetup_point === "string"
                    ? item.selected_meetup_point
                    : item.selected_meetup_point?.name || "—"}
                </Row>
              ) : null}
              {item.notes ? (
                <Row label="Notes" className="sm:col-span-2">
                  <span className="whitespace-pre-wrap">{item.notes}</span>
                </Row>
              ) : null}
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Guest roster"
              description={`${attendees.length || adults + kids} guest${
                (attendees.length || adults + kids) === 1 ? "" : "s"
              } on this booking`}
            />
            {attendees.length === 0 ? (
              <Muted>No attendee details were captured.</Muted>
            ) : (
              <ul className="divide-y divide-[#f0ebe2]">
                {attendees.map((a, i) => {
                  const name =
                    a?.name || [a?.firstName, a?.lastName].filter(Boolean).join(" ") || `Guest ${i + 1}`;
                  return (
                    <li key={i} className="flex items-center gap-3 py-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f2ede4] text-[11px] font-bold text-[#8b6f47]">
                        {name.split(" ").filter(Boolean).map((x) => x[0]).slice(0, 2).join("") || "?"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-[#2a211a]">{name}</p>
                        {a?.allergies ? (
                          <p className="truncate text-[11.5px] text-[#a33c22]">{a.allergies}</p>
                        ) : null}
                      </div>
                      {a?.age ? (
                        <span className="text-[12px] text-[#9a8c7e]">{a.age}y</span>
                      ) : null}
                      {a?.category ? <Badge>{a.category}</Badge> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Payment ledger"
              description={paymentMethod?.label || (piId ? "Card via Stripe" : "No payment recorded")}
              actions={
                piId ? (
                  <Button as={Link} href={`/admin/payments/${piId}`} size="sm" variant="secondary">
                    Open in payments
                  </Button>
                ) : null
              }
            />

            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Money label="Order total" value={fmtMoney(grandTotal, moneyCurrency)} />
              <Money label="Paid" value={fmtMoney(paidTotal, moneyCurrency)} tone="success" />
              <Money
                label="Balance"
                value={fmtMoney(balance, moneyCurrency)}
                tone={balance > 0 ? "warning" : "muted"}
              />
              <Money
                label="Refunded"
                value={fmtMoney(minorToMajor(refundedCents, stripeCurrency), stripeCurrency)}
                tone={refundedCents > 0 ? "danger" : "muted"}
              />
            </div>

            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 border-t border-[#f0ebe2] pt-4 sm:grid-cols-2">
              <Row label={`Adults × ${adults}`}>
                {fmtMoney(adults * unitPriceAdult, moneyCurrency)}
              </Row>
              {kids > 0 ? (
                <Row label={`Children × ${kids}`}>
                  {fmtMoney(kids * unitPriceKid, moneyCurrency)}
                </Row>
              ) : null}
              {discountValue > 0 ? (
                <Row label={`Discount${promoCode ? ` (${promoCode})` : ""}`}>
                  −{fmtMoney(discountValue, moneyCurrency)}
                </Row>
              ) : null}
            </dl>

            {stripeErr ? <ErrorNote className="mt-4">{stripeErr}</ErrorNote> : null}

            {stripeLoading ? (
              <Skeleton className="mt-4 h-16" />
            ) : piId ? (
              <div className="mt-4 rounded-xl border border-[#e6e0d6] bg-[#fdfbf7] p-4">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9a8c7e]">
                  Stripe
                </p>
                <div className="grid grid-cols-3 gap-3 text-[13px]">
                  <div>
                    <p className="text-[11px] text-[#9a8c7e]">Collected</p>
                    <p className="font-semibold">
                      {fmtMoney(minorToMajor(collectedCents, stripeCurrency), stripeCurrency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#9a8c7e]">Refunded</p>
                    <p className="font-semibold">
                      {fmtMoney(minorToMajor(refundedCents, stripeCurrency), stripeCurrency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#9a8c7e]">Net</p>
                    <p className="font-semibold">
                      {fmtMoney(minorToMajor(netCents, stripeCurrency), stripeCurrency)}
                    </p>
                  </div>
                </div>
                {refunds?.length ? (
                  <ul className="mt-3 space-y-1.5 border-t border-[#e6e0d6] pt-3">
                    {refunds.map((r, i) => (
                      <li key={r.id || i} className="flex items-center gap-2 text-[12px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#a33c22]" />
                        <span className="text-[#3f3127]">
                          {fmtMoney(minorToMajor(r.amount, stripeCurrency), stripeCurrency)} refunded
                        </span>
                        {r.created ? (
                          <span className="ml-auto text-[#9a8c7e]">{fmtTs(r.created)}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {offlineLedger.length ? (
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9a8c7e]">
                  Manual payments
                </p>
                <ul className="divide-y divide-[#f0ebe2]">
                  {offlineLedger.map((p, i) => (
                    <li key={p.id || i} className="flex items-center gap-3 py-2 text-[13px]">
                      <Badge>{p.method || "other"}</Badge>
                      <span className="font-semibold">
                        {fmtMoney(p.amount, p.currency || moneyCurrency)}
                      </span>
                      {p.processed_at || p.created_at ? (
                        <span className="ml-auto text-[12px] text-[#9a8c7e]">
                          {fmtDateShort(p.processed_at || p.created_at)}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        </div>

        {/* ------------------------- right column ------------------------- */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Guest" />
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#8b6f47] text-[14px] font-bold text-white">
                {(guestName || "?").split(" ").filter(Boolean).map((x) => x[0]).slice(0, 2).join("") || "?"}
              </span>
              <div className="min-w-0">
                <p className="truncate font-serif text-[16px] text-[#2a211a]">
                  {guestName || "Unnamed guest"}
                </p>
                <Muted className="text-[12px]">{item.guest?.email || "No email"}</Muted>
              </div>
            </div>
            <div className="space-y-2">
              {item.guest?.email ? (
                <a
                  href={`mailto:${item.guest.email}`}
                  className="flex items-center gap-2 rounded-xl border border-[#e6e0d6] px-3 py-2 text-[13px] text-[#3f3127] transition-colors hover:border-[#c9b393] hover:bg-[#fdfbf7]"
                >
                  <Icon name="inbox" size={15} className="text-[#8b6f47]" />
                  <span className="truncate">{item.guest.email}</span>
                </a>
              ) : null}
              {item.guest?.phone ? (
                <a
                  href={`tel:${item.guest.phone}`}
                  className="flex items-center gap-2 rounded-xl border border-[#e6e0d6] px-3 py-2 text-[13px] text-[#3f3127] transition-colors hover:border-[#c9b393] hover:bg-[#fdfbf7]"
                >
                  <Icon name="users" size={15} className="text-[#8b6f47]" />
                  <span>{item.guest.phone}</span>
                </a>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Manage" />
            <div className="space-y-2">
              <Button
                as={Link}
                href={`/admin/bookings/${id}/edit`}
                variant="secondary"
                className="w-full justify-start"
              >
                <Icon name="file" size={15} /> Edit details
              </Button>
              <Button
                as={Link}
                href={`/admin/bookings/${id}/payment-setup`}
                variant="secondary"
                className="w-full justify-start"
              >
                <Icon name="card" size={15} /> Collect payment
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={() => window.print()}
              >
                <Icon name="file" size={15} /> Print
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* ------------------------------ modals ------------------------------ */}
      <Modal
        open={modal === "cancel"}
        onClose={() => setModal(null)}
        title="Cancel reservation"
        subtitle={`${item.code} · ${guestName || "Guest"}`}
      >
        <Field label="Reason">
          <Input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Guest requested cancellation"
          />
        </Field>
        <Muted className="mt-3 text-[12px]">
          Seats are released immediately. Refunds are issued separately from the payment screen.
        </Muted>
        {actionError ? <ErrorNote className="mt-3">{actionError}</ErrorNote> : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Keep it
          </Button>
          <Button variant="danger" onClick={cancelBooking} disabled={busy}>
            {busy ? "Cancelling…" : "Cancel reservation"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={modal === "reschedule"}
        onClose={() => setModal(null)}
        title="Reschedule"
        subtitle={displayExperienceName}
      >
        <div className="mb-3 flex items-center gap-2">
          <input
            type="date"
            value={slotFrom}
            onChange={(e) => {
              setSlotFrom(e.target.value);
              loadSlots(e.target.value, slotTo);
            }}
            className={`${inputClass} h-9 flex-1 text-[12px]`}
          />
          <span className="text-[12px] text-[#9a8c7e]">→</span>
          <input
            type="date"
            value={slotTo}
            onChange={(e) => {
              setSlotTo(e.target.value);
              loadSlots(slotFrom, e.target.value);
            }}
            className={`${inputClass} h-9 flex-1 text-[12px]`}
          />
        </div>
        {slotsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : slots.length === 0 ? (
          <Muted>No slots with availability in this range.</Muted>
        ) : (
          <div className="max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
            {slots.map((s) => {
              const active = String(targetSlotId) === String(s.id);
              const free = s.available ?? Math.max(0, (s.totalSlots || 0) - (s.bookedSlots || 0));
              return (
                <button
                  key={s.id}
                  onClick={() => setTargetSlotId(s.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    active ? "border-[#8b6f47] bg-[#f7f3ec]" : "border-[#e6e0d6] hover:border-[#c9b393]"
                  }`}
                >
                  <span className="text-[13px] font-semibold text-[#2a211a]">
                    {fmtDateShort(s.date)}
                  </span>
                  <span className="ml-auto text-[12px] text-[#9a8c7e]">{free} free</span>
                </button>
              );
            })}
          </div>
        )}
        {actionError ? <ErrorNote className="mt-3">{actionError}</ErrorNote> : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submitReschedule} disabled={busy || !targetSlotId}>
            {busy ? "Moving…" : "Move booking"}
          </Button>
        </div>
      </Modal>
    </Page>
  );
}

/* ---------------------------- small local bits ---------------------------- */

function Row({ label, children, className = "" }) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a8c7e]">
        {label}
      </dt>
      <dd className="mt-0.5 text-[13.5px] text-[#2a211a]">{children}</dd>
    </div>
  );
}

function Money({ label, value, tone = "default" }) {
  const tones = {
    default: "text-[#2a211a]",
    success: "text-[#3f6b3f]",
    warning: "text-[#8a6412]",
    danger: "text-[#a33c22]",
    muted: "text-[#9a8c7e]",
  };
  return (
    <div className="rounded-xl border border-[#e6e0d6] bg-[#fdfbf7] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9a8c7e]">
        {label}
      </p>
      <p className={`mt-1 font-serif text-[17px] ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function Modal({ open, onClose, title, subtitle, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-t-3xl border border-[#e6e0d6] bg-white p-6 shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-[19px] text-[#2a211a]">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[12px] text-[#9a8c7e]">{subtitle}</p> : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[#9a8c7e] hover:bg-[#f2ede4]"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
