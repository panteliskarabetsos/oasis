"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Users,
  Loader2,
  DollarSign,
  Info,
  CalendarDays,
  FileText,
  Tag,
  Banknote,
  Clock,
  SearchIcon,
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
function extractPaymentMethodSummary(raw) {
  const empty = { type: null, label: null, card: null };
  if (!raw || typeof raw !== "object") return empty;

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
  const charges = Array.isArray(pi?.charges?.data)
    ? pi.charges.data
    : Array.isArray(raw?.charges?.data)
      ? raw.charges.data
      : [];

  const charge = charges[0] || null;
  const pmd =
    charge?.payment_method_details || pi?.payment_method_details || null;

  if (!pmd) return empty;

  let type = pmd.type;
  if (!type) {
    if (pmd.card) type = "card";
    else {
      const keys = Object.keys(pmd).filter((k) => k !== "type");
      type = keys[0] || null;
    }
  }

  let card = null;
  if (type === "card") {
    const cardObj =
      pmd.card ||
      charge?.payment_method_details?.card ||
      pi?.payment_method?.card ||
      null;

    if (cardObj) {
      card = {
        brand: cardObj.brand || null,
        last4: cardObj.last4 || null,
        expMonth: cardObj.exp_month || null,
        expYear: cardObj.exp_year || null,
        country: cardObj.country || null,
        funding: cardObj.funding || null,
      };
    }
  }

  const labelParts = [];
  if (type === "card") {
    if (card?.brand) labelParts.push(card.brand.toUpperCase());
    if (card?.last4) labelParts.push(`•••• ${card.last4}`);
  } else if (type) {
    labelParts.push(type);
  }

  return { type, label: labelParts.join(" · ") || null, card };
}

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
    raw.experienceName ??
    raw.customExperienceName ??
    raw.Experience?.name ??
    raw.experience?.name ??
    null;

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
    experience: {
      id: experienceId,
      name: experienceName || (isPrivate ? "Private booking" : null),
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
    customExperienceName: raw.customExperienceName ?? null,
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
      item?.payments?.stripePaymentIntentId ||
      item?.stripePaymentIntentId ||
      null,
    [item],
  );

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
    toDateInput(plusDays(new Date(), 60)),
  );
  const [targetSlotId, setTargetSlotId] = useState("");
  const [rev, setRev] = useState(0);

  // Stripe state
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
          throw new Error(
            (await res.json().catch(() => ({})))?.error || "Failed to load",
          );
        const { item } = await res.json();
        setItem(normalizeBooking(item));
      } catch (e) {
        setError(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Fetch Stripe PI
  useEffect(() => {
    if (!piId) {
      setStripe(null);
      setStripeErr("");
      return;
    }
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
  }, [piId, rev]);

  // Lock scroll when pricing modal is open
  useEffect(() => {
    if (!showPricing) return;
    const scrollY = window.scrollY;
    const original = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflow: document.documentElement.style.overflow,
      paddingRight: document.documentElement.style.paddingRight,
    };
    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarW > 0)
      document.documentElement.style.paddingRight = `${scrollbarW}px`;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.position = original.position;
      document.body.style.top = original.top;
      document.body.style.width = original.width;
      document.documentElement.style.overflow = original.overflow;
      document.documentElement.style.paddingRight = original.paddingRight;
      window.scrollTo(0, scrollY);
    };
  }, [showPricing]);

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
        (await res.json().catch(() => ({})))?.error || "Cancellation failed",
      );
    setItem((curr) => ({ ...curr, status: "cancelled" }));
    setShowCancel(false);
    toast.success("Reservation cancelled");
  }

  async function loadSlots() {
    if (!item || item?.isPrivate || !item?.experience?.id) {
      setSlots([]);
      return;
    }
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
            "Failed to load availability",
        );
      const payload = await res.json();
      setSlots(payload?.items || []);
    } catch (e) {
      toast.error(e.message || "Failed to load availability");
    } finally {
      setSlotsLoading(false);
    }
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
        (await res.json().catch(() => ({})))?.error || "Reschedule failed",
      );
    const payload = await res.json();
    setItem((curr) => ({
      ...curr,
      startTime: payload?.newStartTime || curr.startTime,
    }));
    setShowReschedule(false);
    toast.success("Reservation rescheduled");
  }

  /* ----------------------- derived UI state ----------------------- */
  const statusNorm = String(item?.status || "").toLowerCase();
  const isCancelled = statusNorm === "cancelled";
  const isPrivate = !!item?.isPrivate;

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
  const balance = +(
    grandTotal - (Number.isFinite(paidTotal) ? paidTotal : 0)
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

  const stripeSummary = useMemo(
    () => normalizeStripeSummary(stripe, item?.money?.currency || "EUR"),
    [stripe, item?.money?.currency],
  );
  const {
    currency: stripeCurrency,
    collectedCents,
    refundedCents,
    netCents,
    refunds,
  } = stripeSummary;

  const hasPI = Boolean(item?.payments?.stripePaymentIntentId);
  const heroShowLoading = hasPI && stripeLoading;
  const heroValue =
    hasPI && stripe ? minorToMajor(netCents, stripeCurrency) : paidTotal;
  const heroCurrency = hasPI && stripe ? stripeCurrency : moneyCurrency;
  const heroLabel = hasPI
    ? "Net via Stripe"
    : typeof item?.money?.totalPaidAmount === "number"
      ? "Total paid"
      : "Total";
  const paymentMethod = item?.payments?.paymentMethod || null;
  const paymentCard = paymentMethod?.card || null;

  const sourceBadge = item?.source ? (
    <span
      className={cx(
        "ml-2 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        item.source === "admin" &&
          "bg-purple-50 border-purple-200 text-purple-700",
        item.source === "web" && "bg-blue-50 border-blue-200 text-blue-700",
        item.source === "phone" &&
          "bg-amber-50 border-amber-200 text-amber-800",
        !["admin", "web", "phone"].includes(item.source) &&
          "bg-neutral-100 border-neutral-200 text-neutral-600",
      )}
    >
      {item.source}
    </span>
  ) : null;

  /* ------------------------------ UI ------------------------------ */
  return (
    <div className="pb-24 min-h-screen bg-[#fdfcfb] text-[#3f3127] selection:bg-[#8b6f47]/20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 border-b border-[#e3ddd2] bg-white/90 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={() => router.push("/admin/bookings")}
              className="flex items-center justify-center w-10 h-10 rounded-full border border-[#e3ddd2] bg-[#fdfaf5] text-[#5a4a3f] hover:bg-[#f5f1ea] transition-colors shrink-0"
              title="Back to Bookings"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#a09084]">
                Booking Reference
              </span>
              <div className="flex items-center text-sm font-semibold text-[#3f3127] truncate">
                {item?.code ? (
                  <span className="font-mono tracking-tight">{item.code}</span>
                ) : (
                  <span className="text-neutral-400 font-mono">#{id}</span>
                )}
                {sourceBadge}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            <IconButton
              onClick={() => {
                if (navigator?.clipboard?.writeText) {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success("Link copied");
                } else {
                  toast.error("Copy not supported by this browser");
                }
              }}
              title="Copy Link"
              icon={Copy}
            />
            <IconButton
              onClick={() => window.print()}
              title="Print Details"
              icon={Printer}
            />
            <div className="h-6 w-[1px] bg-[#e3ddd2] mx-1 hidden sm:block shrink-0" />
            <IconButton
              onClick={() => setShowReschedule(true)}
              disabled={isCancelled || isPrivate}
              title="Reschedule"
              icon={CalendarClock}
              tone="amber"
            />
            <IconButton
              onClick={() => setShowCancel(true)}
              disabled={isCancelled}
              title="Cancel Booking"
              icon={XCircle}
              tone="red"
            />
            <IconButton
              onClick={() => setShowPricing(true)}
              disabled={isCancelled}
              title="Edit Pricing"
              icon={DollarSign}
              tone="emerald"
            />
          </div>
        </div>
      </div>

      {/* Pricing Editor Modal */}
      <AnimatePresence>
        {showPricing && (
          <motion.div
            key="pricing-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] grid place-items-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto overscroll-contain"
            onClick={() => setShowPricing(false)}
          >
            <motion.div
              initial={{ y: 20, scale: 0.95, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 20, scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl rounded-[2rem] border border-[#e3ddd2] bg-white p-6 shadow-2xl max-h-[85vh] overflow-y-auto no-scrollbar"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="mb-6 flex items-center justify-between border-b border-[#e3ddd2] pb-4">
                <h3 className="text-lg font-serif text-[#3f3127]">
                  Pricing & Payment
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPricing(false)}
                  className="rounded-full p-2 hover:bg-[#fdfaf5] text-[#7a6a5f] transition-colors"
                >
                  <XCircle size={20} />
                </button>
              </div>
              <BookingPricingEditor
                bookingId={id}
                onClose={() => setShowPricing(false)}
                onSaved={() => setRev((v) => v + 1)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-8">
        {loading ? (
          <Skeleton />
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-red-700 text-center font-medium shadow-sm">
            {error}
          </div>
        ) : !item ? (
          <div className="rounded-2xl border border-[#e3ddd2] bg-white p-12 text-center text-[#7a6a5f] shadow-sm">
            Reservation not found.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Hero Profile Card */}
            <div className="overflow-hidden rounded-[2rem] border border-[#e3ddd2] bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col md:flex-row justify-between gap-6 p-6 sm:p-8 md:items-center">
                <div className="flex items-center gap-4 sm:gap-5 min-w-0 flex-1">
                  <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-full border border-[#e3ddd2] bg-[#fdfaf5] text-lg sm:text-xl font-serif text-[#8b6f47] shadow-sm">
                    {guestInitials || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-1.5">
                      <h1 className="truncate text-xl sm:text-2xl font-serif text-[#2a1f18]">
                        {guestName || "No name provided"}
                      </h1>
                      <StatusBadge status={statusNorm} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs sm:text-sm font-medium text-[#7a6a5f]">
                      <span className="flex items-center gap-1.5">
                        <Users size={14} className="text-[#a09084]" />
                        {item.counts?.adults ?? 0}{" "}
                        {typeof item.counts?.kids === "number"
                          ? ` + ${item.counts.kids}`
                          : ""}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-[#d8cfc3]" />
                      <span className="flex items-center gap-1.5">
                        <CalendarClock size={14} className="text-[#a09084]" />
                        {fmtDateShort(item.startTime)}
                      </span>
                      {item.selected_meetup_point && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-[#d8cfc3]" />
                          <span className="flex items-center gap-1.5 text-emerald-700">
                            <MapPin size={14} />
                            {item.selected_meetup_point.name || "Pickup Set"}
                          </span>
                        </>
                      )}
                      {item.experience?.name && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-[#d8cfc3]" />
                          <span className="flex items-center gap-1.5 min-w-0 truncate">
                            <MapPin
                              size={14}
                              className="text-[#a09084] shrink-0"
                            />
                            <span className="truncate">
                              {item.experience?.name}
                            </span>
                            {isPrivate && (
                              <span className="ml-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 shrink-0">
                                Private
                              </span>
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="md:text-right bg-[#fdfcfb] md:bg-transparent p-4 md:p-0 rounded-2xl border border-[#e3ddd2] md:border-none shrink-0">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#a09084] mb-1">
                    {heroLabel}
                  </div>
                  <div className="text-2xl sm:text-3xl font-serif text-[#2a1f18]">
                    {heroShowLoading ? (
                      <Loader2
                        size={24}
                        className="animate-spin text-[#8b6f47]"
                      />
                    ) : (
                      fmtMoney(heroValue, heroCurrency)
                    )}
                  </div>
                  {paymentMethod?.label && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#e3ddd2] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#5a4a3f] shadow-sm">
                      <CreditCard size={12} className="text-[#8b6f47]" />
                      {paymentMethod.label}
                    </div>
                  )}
                  {stripeErr && (
                    <div className="mt-2 text-[11px] font-medium text-red-500">
                      {stripeErr}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bento Grid Cards */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
              <Card title="Reservation Info" icon={<FileText size={16} />}>
                <Row label="Date">{fmtDateLong(item.startTime)}</Row>
                <Row label="Experience">
                  {item.experience?.name || "-"}
                  {isPrivate && (
                    <span className="ml-2 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
                      Private
                    </span>
                  )}
                </Row>
                <Row label="Location">{item.experience?.location || "-"}</Row>
                <Row label="Meetup Point">
                  {item.selected_meetup_point?.name || "-"}
                </Row>
                <Row label="Duration">
                  {Number.isFinite(item.duration)
                    ? `${item.duration} min`
                    : "-"}
                </Row>
                <Row label="Code" mono>
                  <Copyable value={item.code} empty="-" />
                </Row>
                <Row label="Adult Price">{fmtMoney(priceAdult, currency)}</Row>
                <Row label="Child Price">{fmtMoney(priceKid, currency)}</Row>
                <Row label="Created On">{fmtDateShort(item.createdAt)}</Row>
                <Row label="Last Updated">{fmtDateShort(item.updatedAt)}</Row>
                <Row label="Source" mono>
                  {item.source || "-"}
                </Row>
              </Card>

              <div className="space-y-6">
                <Card title="Customer Details" icon={<User2 size={16} />}>
                  <Row label="Full Name">{guestName || "-"}</Row>
                  <Row label="Email Address" mono>
                    {item.guest?.email ? (
                      <a
                        className="text-[#8b6f47] hover:underline break-all"
                        href={`mailto:${item.guest.email}`}
                      >
                        {item.guest.email}
                      </a>
                    ) : (
                      "-"
                    )}
                  </Row>
                  <Row label="Phone Number" mono>
                    {item.guest?.phone ? (
                      <a
                        className="text-[#8b6f47] hover:underline break-all"
                        href={`tel:${item.guest.phone}`}
                      >
                        {item.guest.phone}
                      </a>
                    ) : (
                      "-"
                    )}
                  </Row>
                  <Row label="Internal Notes">
                    {item.notes ? (
                      <span className="italic text-[#7a6a5f]">
                        {item.notes}
                      </span>
                    ) : (
                      "-"
                    )}
                  </Row>
                </Card>

                {Array.isArray(item?.attendees) &&
                  item.attendees.length > 0 && (
                    <Card title="Roster & Attendees" icon={<Users size={16} />}>
                      <div className="divide-y divide-[#e3ddd2] border border-[#e3ddd2] rounded-xl overflow-hidden bg-[#fdfcfb]">
                        {item.attendees.map((a, idx) => {
                          const name =
                            a?.name ||
                            [a?.firstName, a?.lastName]
                              .filter(Boolean)
                              .join(" ") ||
                            `Guest #${idx + 1}`;
                          const type = a?.type || a?.category || "adult";
                          const age =
                            typeof a?.age === "number" && Number.isFinite(a.age)
                              ? a.age
                              : null;
                          const notes =
                            (typeof a?.notes === "string" && a.notes.trim()) ||
                            (typeof a?.allergies === "string" &&
                              a.allergies.trim()) ||
                            (typeof a?.dietary === "string" &&
                              a.dietary.trim()) ||
                            null;

                          return (
                            <div
                              key={idx}
                              className="p-4 hover:bg-[#fdfaf5] transition-colors"
                            >
                              <div className="flex items-center justify-between gap-3 mb-1">
                                <span className="font-semibold text-[#3f3127] truncate min-w-0">
                                  {name}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  {age !== null && (
                                    <span className="rounded-md bg-white border border-[#e3ddd2] px-2 py-0.5 text-[10px] font-bold text-[#7a6a5f] shadow-sm">
                                      {age} yrs
                                    </span>
                                  )}
                                  <span className="rounded-md bg-white border border-[#e3ddd2] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#8b6f47] shadow-sm">
                                    {type}
                                  </span>
                                </div>
                              </div>
                              {notes && (
                                <div className="text-xs text-[#7a6a5f] bg-white border border-[#e3ddd2] rounded-lg p-2 mt-2">
                                  <span className="font-semibold text-[#5a4a3f]">
                                    Note:
                                  </span>{" "}
                                  {notes}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )}
              </div>

              <div className="lg:col-span-2">
                <Card title="Payment Ledger" icon={<Banknote size={16} />}>
                  <Row label="Status">
                    <StatusBadge status={statusNorm} />
                  </Row>
                  <Row label="Method">
                    {paymentMethod?.label ? (
                      paymentMethod.label
                    ) : hasPI ? (
                      stripeLoading ? (
                        <Loader2
                          size={14}
                          className="animate-spin text-[#8b6f47]"
                        />
                      ) : (
                        "Card"
                      )
                    ) : (
                      "—"
                    )}
                  </Row>

                  {paymentCard && (
                    <Row label="Card Details">
                      <div className="space-y-1 text-sm font-medium text-[#3f3127]">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded border border-[#e3ddd2] bg-white text-[10px] uppercase tracking-wider shadow-sm">
                            {paymentCard.brand || "Card"}
                          </span>
                          {paymentCard.last4 && (
                            <span>•••• {paymentCard.last4}</span>
                          )}
                        </div>
                        {(paymentCard.expMonth || paymentCard.expYear) && (
                          <div className="text-xs text-[#7a6a5f] mt-1">
                            Expires:{" "}
                            {paymentCard.expMonth
                              ? String(paymentCard.expMonth).padStart(2, "0")
                              : "??"}
                            /
                            {paymentCard.expYear
                              ? String(paymentCard.expYear).slice(-2)
                              : "??"}
                          </div>
                        )}
                        {paymentCard.funding && (
                          <div className="text-xs text-[#7a6a5f] capitalize">
                            Type: {paymentCard.funding}
                          </div>
                        )}
                        {paymentCard.country && (
                          <div className="text-xs text-[#7a6a5f]">
                            Issuer: {paymentCard.country}
                          </div>
                        )}
                      </div>
                    </Row>
                  )}

                  {promoCode && (
                    <Row label="Promo Code" mono>
                      <span className="text-[#8b6f47] font-bold bg-[#8b6f47]/10 px-2 py-1 rounded">
                        {promoCode}
                      </span>
                    </Row>
                  )}
                  {discountValue > 0 && (
                    <Row label="Discount Applied" mono>
                      <span className="text-emerald-600 font-bold">
                        −{fmtMoney(discountValue, moneyCurrency)}
                      </span>
                    </Row>
                  )}

                  <Row label="Stripe Session" mono>
                    {item?.payments?.stripeSessionId ? (
                      <button
                        onClick={() => setShowStripeSession(true)}
                        className="text-xs font-bold uppercase tracking-wider text-[#8b6f47] hover:underline break-all text-left"
                      >
                        View Session ID
                      </button>
                    ) : (
                      "-"
                    )}
                  </Row>

                  <Row label="Payment Intent" mono>
                    <Copyable
                      value={item.payments?.stripePaymentIntentId}
                      empty="-"
                    />
                  </Row>

                  {hasPI && (
                    <div className="mt-4 pt-4 border-t border-[#e3ddd2] space-y-3">
                      <Row label="Collected via Stripe" mono>
                        {stripeLoading ? (
                          "…"
                        ) : (
                          <span className="font-bold">
                            {fmtMoney(
                              minorToMajor(collectedCents, stripeCurrency),
                              stripeCurrency,
                            )}
                          </span>
                        )}
                      </Row>
                      <Row label="Refunded via Stripe" mono>
                        {stripeLoading ? (
                          "…"
                        ) : (
                          <span className="text-rose-600 font-bold">
                            {fmtMoney(
                              minorToMajor(refundedCents, stripeCurrency),
                              stripeCurrency,
                            )}
                          </span>
                        )}
                      </Row>
                      <Row label="Net Revenue" mono>
                        {stripeLoading ? (
                          "…"
                        ) : (
                          <span className="text-emerald-600 font-bold">
                            {fmtMoney(
                              minorToMajor(netCents, stripeCurrency),
                              stripeCurrency,
                            )}
                          </span>
                        )}
                      </Row>

                      {refunds.length > 0 && (
                        <div className="mt-4 rounded-xl border border-[#e3ddd2] bg-[#fdfcfb] overflow-hidden">
                          <div className="px-4 py-2 bg-[#fdfaf5] border-b border-[#e3ddd2] text-[10px] font-bold uppercase tracking-wider text-[#a09084]">
                            Refund History
                          </div>
                          <ul className="divide-y divide-[#e3ddd2]">
                            {refunds.map((r) => (
                              <li
                                key={r.id}
                                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white transition-colors"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <code className="text-[10px] font-bold text-[#7a6a5f] bg-[#e3ddd2]/40 px-1.5 py-0.5 rounded truncate max-w-[150px]">
                                      {r.id}
                                    </code>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                                      {r.status || "Completed"}
                                    </span>
                                  </div>
                                  <div className="text-xs text-[#5a4a3f]">
                                    {r.reason || "No reason provided"}
                                  </div>
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#a09084] mt-2">
                                    {fmtTs(r.created)}
                                  </div>
                                </div>
                                <div className="font-serif text-lg text-rose-600 font-bold whitespace-nowrap self-start sm:self-auto">
                                  -
                                  {fmtMoney(
                                    minorToMajor(r.amount, r.currency),
                                    r.currency,
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-[#e3ddd2]">
                    <Row
                      label={
                        typeof item?.money?.totalPaidAmount === "number"
                          ? "Total Paid (System)"
                          : "Total (System)"
                      }
                      mono
                    >
                      <span className="font-bold text-lg">
                        {fmtMoney(paidTotal, moneyCurrency)}
                      </span>
                      {balance < 0 && (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm flex items-start gap-3">
                          <Info size={18} className="shrink-0 mt-0.5" />
                          <div>
                            <strong className="block mb-1">
                              Overpaid by{" "}
                              {fmtMoney(Math.abs(balance), moneyCurrency)}
                            </strong>
                            <span className="text-xs opacity-80">
                              Consider issuing a refund or retaining as store
                              credit.
                            </span>
                          </div>
                        </div>
                      )}
                    </Row>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- MODALS --- */}

      {/* Stripe session modal */}
      {showStripeSession && (
        <Modal
          onClose={() => setShowStripeSession(false)}
          title="Stripe Session ID"
          icon={<CreditCard size={20} className="text-[#8b6f47]" />}
        >
          <div className="space-y-4">
            <textarea
              readOnly
              value={item?.payments?.stripeSessionId || ""}
              rows={4}
              className="w-full rounded-xl border border-[#e3ddd2] bg-[#fdfcfb] p-4 font-mono text-xs text-[#3f3127] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30 shadow-inner"
            />
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => setShowStripeSession(false)}
              >
                Close
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const v = item?.payments?.stripeSessionId || "";
                  if (navigator?.clipboard?.writeText) {
                    navigator.clipboard.writeText(v);
                    toast.success("Session ID Copied");
                  } else {
                    toast.error("Copy not supported");
                  }
                }}
              >
                Copy ID
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cancel modal */}
      {showCancel && (
        <Modal
          onClose={() => setShowCancel(false)}
          title="Cancel Reservation"
          icon={<XCircle size={20} className="text-red-500" />}
        >
          <div className="space-y-5">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 leading-relaxed">
              You are about to cancel this booking.{" "}
              {isPrivate
                ? "This will release the privately held time block."
                : "This will immediately free up seats for this schedule slot."}
            </div>
            <label className="block text-sm">
              <span className="text-[#3f3127] font-semibold mb-1.5 block">
                Internal Note / Reason (Optional)
              </span>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full rounded-xl border border-[#e3ddd2] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 shadow-sm"
                rows={3}
                placeholder="e.g. Guest requested cancellation due to travel delay..."
              />
            </label>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setShowCancel(false)}>
                Keep Booking
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  cancelBooking().catch((e) => toast.error(e.message))
                }
              >
                Yes, Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reschedule modal */}
      {showReschedule && !isPrivate && (
        <Modal
          onClose={() => setShowReschedule(false)}
          title="Reschedule Reservation"
          icon={<CalendarClock size={20} className="text-amber-500" />}
        >
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-5 p-4 bg-[#fdfcfb] border border-[#e3ddd2] rounded-xl">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#a09084] mb-1.5 block">
                  Look From
                </label>
                <input
                  type="date"
                  value={slotFrom}
                  onChange={(e) => setSlotFrom(e.target.value)}
                  className="w-full rounded-lg border border-[#e3ddd2] p-2 text-sm focus:ring-2 focus:ring-[#8b6f47]/30 outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#a09084] mb-1.5 block">
                  Look To
                </label>
                <input
                  type="date"
                  value={slotTo}
                  onChange={(e) => setSlotTo(e.target.value)}
                  className="w-full rounded-lg border border-[#e3ddd2] p-2 text-sm focus:ring-2 focus:ring-[#8b6f47]/30 outline-none"
                />
              </div>
              <div className="sm:col-span-1 flex items-end">
                <button
                  onClick={loadSlots}
                  disabled={slotsLoading}
                  className="w-full rounded-lg bg-white border border-[#e3ddd2] p-2 text-sm font-semibold hover:bg-[#fdfaf5] shadow-sm flex justify-center items-center h-[38px]"
                >
                  {slotsLoading ? (
                    <Loader2
                      size={16}
                      className="animate-spin text-[#8b6f47]"
                    />
                  ) : (
                    <SearchIcon size={16} className="text-[#8b6f47]" />
                  )}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-[#e3ddd2] bg-white overflow-hidden shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2">
                <div className="p-4 border-b sm:border-b-0 sm:border-r border-[#e3ddd2] bg-[#fdfaf5]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#a09084] mb-1">
                    Current Slot
                  </div>
                  <div className="text-sm font-semibold text-[#3f3127]">
                    {fmtDateShort(item?.startTime)}
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#a09084] mb-1">
                    New Target Slot
                  </div>
                  <select
                    value={targetSlotId}
                    onChange={(e) => setTargetSlotId(e.target.value)}
                    className="w-full rounded-lg border border-[#e3ddd2] bg-white p-2 text-sm focus:ring-2 focus:ring-amber-500/30 outline-none"
                  >
                    <option value="">— Select Available Slot —</option>
                    {slots.length === 0 && !slotsLoading && (
                      <option value="" disabled>
                        Search to load availability
                      </option>
                    )}
                    {slotsLoading && (
                      <option value="" disabled>
                        Searching calendar…
                      </option>
                    )}
                    {!slotsLoading &&
                      slots.map((s) => (
                        <option
                          key={s.id}
                          value={s.id}
                          disabled={(s.available ?? 0) <= 0}
                        >
                          {fmtDateShort(s.date)} — Avail: {s.available}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setShowReschedule(false)}>
                Cancel
              </Button>
              <Button
                variant="amber"
                onClick={() =>
                  submitReschedule().catch((e) => toast.error(e.message))
                }
                disabled={!targetSlotId}
              >
                Confirm Reschedule
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

function Card({ title, icon, children }) {
  return (
    <div className="rounded-[1.5rem] border border-[#e3ddd2] bg-white shadow-sm overflow-hidden flex flex-col h-full">
      <div className="border-b border-[#e3ddd2] bg-[#fcfbf9] px-6 py-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#8b6f47]">
        {icon && <span className="opacity-70">{icon}</span>}
        {title}
      </div>
      <div className="p-5 sm:p-6 flex flex-col flex-1">{children}</div>
    </div>
  );
}

function Row({ label, children, mono }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-4 text-sm border-b border-[#e3ddd2]/50 py-3 first:pt-0 last:border-0 last:pb-0">
      <div className="sm:min-w-[140px] shrink-0 text-[10px] font-bold uppercase tracking-wider text-[#a09084] pt-0.5">
        {label}
      </div>
      <div
        className={cx(
          "flex-1 min-w-0 text-[#3f3127] font-medium sm:text-right break-words overflow-hidden",
          mono && "font-mono tracking-tight",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = String(status || "").toLowerCase();
  const map = {
    paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    checked_in: "bg-indigo-50 text-indigo-700 border-indigo-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    cancelled: "bg-red-50 text-red-700 border-red-200",
    draft: "bg-gray-50 text-gray-700 border-gray-200",
    converted: "bg-sky-50 text-sky-700 border-sky-200",
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
  const cls = map[s] || "bg-gray-50 text-gray-700 border-gray-200";
  const label = labelMap[s] || status || "-";
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        cls,
      )}
    >
      {label}
    </span>
  );
}

function Modal({ title, icon, children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/60 backdrop-blur-sm p-4 print:hidden animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-[2rem] bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-[#e3ddd2] px-6 py-5 bg-[#fdfcfb]">
          <h3 className="text-xl font-serif text-[#2a1f18] flex items-center gap-3">
            {icon} {title}
          </h3>
          <button
            className="rounded-full p-2 hover:bg-[#e3ddd2]/50 text-[#7a6a5f] transition-colors"
            onClick={onClose}
            aria-label="Close"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto mt-6 max-w-6xl space-y-6">
      <div className="h-32 animate-pulse rounded-[2rem] bg-[#e3ddd2]/30 border border-[#e3ddd2]" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="h-80 animate-pulse rounded-[1.5rem] bg-[#e3ddd2]/30 border border-[#e3ddd2]" />
        <div className="h-80 animate-pulse rounded-[1.5rem] bg-[#e3ddd2]/30 border border-[#e3ddd2]" />
      </div>
    </div>
  );
}

function IconButton({
  icon: Icon,
  children,
  className,
  title,
  ariaLabel,
  tone,
  ...props
}) {
  const tones = {
    red: "text-red-500 hover:bg-red-50 hover:border-red-200",
    amber: "text-amber-500 hover:bg-amber-50 hover:border-amber-200",
    emerald: "text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200",
    default: "text-[#5a4a3f] hover:bg-[#fdfaf5] hover:border-[#e3ddd2]",
  };

  return (
    <button
      className={cx(
        "flex shrink-0 items-center justify-center w-10 h-10 rounded-full border border-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
        tones[tone] || tones.default,
        className,
      )}
      title={title}
      aria-label={ariaLabel || title}
      {...props}
    >
      {/* 1. Render the icon prop if it exists */}
      {Icon && <Icon size={20} strokeWidth={2} />}

      {/* 2. Render children if they exist (for flexibility) */}
      {children}
    </button>
  );
}

function Button({ variant = "default", className, children, ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 shadow-sm";
  const variants = {
    default:
      "border border-[#e3ddd2] bg-white text-[#3f3127] hover:bg-[#fdfaf5] focus-visible:ring-[#8b6f47]/30",
    primary:
      "border border-transparent bg-[#1a1a1a] text-white hover:bg-[#333] shadow-md focus-visible:ring-[#1a1a1a]/50",
    ghost:
      "border-transparent bg-transparent text-[#7a6a5f] hover:bg-[#e3ddd2]/50 shadow-none focus-visible:ring-[#8b6f47]/30",
    destructive:
      "border border-transparent bg-red-600 text-white hover:bg-red-700 shadow-md focus-visible:ring-red-500/50",
    amber:
      "border border-transparent bg-amber-600 text-white hover:bg-amber-700 shadow-md focus-visible:ring-amber-500/50",
  };
  return (
    <button className={cx(base, variants[variant], className)} {...props}>
      {children}
    </button>
  );
}

function Copyable({ value, empty = "-" }) {
  if (!value) return <span>{empty}</span>;
  return (
    <span className="group inline-flex max-w-full items-center gap-2 bg-neutral-50 px-2 py-0.5 rounded border border-[#e3ddd2]">
      <span className="truncate">{value}</span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(String(value));
            toast.success("Copied!");
          } else {
            toast.error("Copy not supported");
          }
        }}
        className="opacity-0 group-hover:opacity-100 rounded-md p-1 hover:bg-[#e3ddd2] text-[#7a6a5f] transition-all shrink-0"
        title="Copy"
        aria-label="Copy"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
