// src/app/manage-booking/page.js
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  Search,
  Ticket,
  Calendar,
  Clock,
  Users,
  MapPin,
  RefreshCw,
  XCircle,
  ChevronLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Navigation,
  User,
  Lock,
  ShieldAlert,
  CreditCard,
  Mail,
  Banknote,
  Sparkles,
  Crown,
  ReceiptText,
  WalletCards,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

const formatMoney = (amount, currency = "EUR") =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "EUR",
  }).format(Number(amount) || 0);

const getPolicyDescription = (policy) => {
  const p = policy?.toLowerCase() || "moderate";

  if (p.includes("flexible")) {
    return "Full refund up to 48 hours before the experience starts.";
  }

  if (p.includes("strict")) {
    return "100% refund up to 14 days, 50% refund 7-13 days, no refund under 7 days.";
  }

  return "Full refund up to 7 days before, 50% refund up to 48 hours before.";
};

const getBookingAmount = (booking) =>
  Number(booking?.bookingTotal ?? booking?.totalAmount ?? 0);

const getPaidAmount = (booking) => Number(booking?.paidAmount ?? 0);

const getAmountDue = (booking) =>
  Number(
    booking?.amountDue ??
      Math.max(0, getBookingAmount(booking) - getPaidAmount(booking)),
  );

const isPrivateBooking = (booking) =>
  booking?.isPrivate === true ||
  booking?.bookingType === "private" ||
  Boolean(booking?.customExperienceName);

const isBookingUnpaid = (booking) => {
  const paymentStatus = String(booking?.paymentStatus || "").toLowerCase();
  const due = getAmountDue(booking);

  return (
    ["unpaid", "partially_paid", "pending_payment", "payment_pending"].includes(
      paymentStatus,
    ) || due > 0
  );
};

export default function ManageBookingPage() {
  const [step, setStep] = useState("search");

  const [reference, setReference] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const [booking, setBooking] = useState(null);

  const [activeModal, setActiveModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionReason, setActionReason] = useState("");

  const [availableSlots, setAvailableSlots] = useState({});
  const [availableMeetupPoints, setAvailableMeetupPoints] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [selectedMeetupPoint, setSelectedMeetupPoint] = useState(null);

  const [paymentLoading, setPaymentLoading] = useState(false);

  const privateBooking = booking ? isPrivateBooking(booking) : false;
  const unpaid = booking ? isBookingUnpaid(booking) : false;

  const bookingTotal = booking ? getBookingAmount(booking) : 0;
  const paidAmount = booking ? getPaidAmount(booking) : 0;
  const refundedAmount = Number(booking?.refundedAmount || 0);
  const amountDue = booking ? getAmountDue(booking) : 0;
  const currency = booking?.currency || "EUR";

  let isMeetupChangeable = false;
  let hoursUntilEvent = 0;
  let refundStatus = "none";

  if (booking && booking.date && booking.time && booking.time !== "TBD") {
    const timeStr =
      booking.time.length === 5 ? `${booking.time}:00` : booking.time;
    const eventDateTime = new Date(`${booking.date}T${timeStr}`);

    if (!isNaN(eventDateTime.getTime())) {
      hoursUntilEvent =
        (eventDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
      isMeetupChangeable = hoursUntilEvent >= 10;

      const policy = (booking.cancellationPolicy || "moderate").toLowerCase();

      if (policy.includes("flexible")) {
        if (hoursUntilEvent >= 48) refundStatus = "full";
      } else if (policy.includes("strict")) {
        if (hoursUntilEvent >= 14 * 24) refundStatus = "full";
        else if (hoursUntilEvent >= 7 * 24) refundStatus = "partial";
      } else {
        if (hoursUntilEvent >= 7 * 24) refundStatus = "full";
        else if (hoursUntilEvent >= 48) refundStatus = "partial";
      }
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!reference.trim() || !lastName.trim()) {
      toast.error("Please enter both your booking reference and last name.");
      return;
    }

    setIsSearching(true);

    try {
      const res = await fetch(
        `/api/bookings/lookup?ref=${encodeURIComponent(
          reference,
        )}&lastName=${encodeURIComponent(lastName)}`,
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data?.error ||
            "Booking not found. Please check your details and try again.",
        );
      }

      setBooking(data);
      setStep("details");
    } catch (error) {
      toast.error(error.message || "Booking not found.");
    } finally {
      setIsSearching(false);
    }
  };

  const handlePayOnline = async () => {
    if (!booking?.id) return;

    setPaymentLoading(true);

    try {
      const res = await fetch(`/api/bookings/${booking.id}/payment-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: booking.reference,
          email: booking.email,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Could not start payment.");
      }

      const url = data.url || data.checkoutUrl;

      if (!url) {
        throw new Error("Payment link was not returned.");
      }

      window.location.href = url;
    } catch (error) {
      toast.error(error.message || "Could not start payment.");
    } finally {
      setPaymentLoading(false);
    }
  };

  useEffect(() => {
    if ((activeModal === "reschedule" || activeModal === "meetup") && booking) {
      const fetchData = async () => {
        setLoadingSlots(true);

        try {
          const res = await fetch(
            `/api/public/schedule?experienceId=${booking.experienceId}`,
          );

          if (!res.ok) throw new Error("Failed to fetch scheduling data");

          const data = await res.json();

          if (activeModal === "reschedule") {
            const validSlots = data.filter(
              (slot) => slot.available >= booking.guests,
            );

            const grouped = validSlots.reduce((acc, slot) => {
              const dateObj = new Date(slot.date);
              const dateStr = dateObj.toISOString().split("T")[0];
              const timeStr = dateObj.toLocaleTimeString("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
              });

              if (!acc[dateStr]) acc[dateStr] = [];
              acc[dateStr].push({
                id: slot.id,
                time: timeStr,
                remaining: slot.available,
              });

              return acc;
            }, {});

            setAvailableSlots(grouped);
          }

          if (activeModal === "meetup") {
            const points =
              data.length > 0 && data[0].meetupPoints
                ? data[0].meetupPoints
                : [];
            setAvailableMeetupPoints(points);
          }
        } catch {
          toast.error("Failed to load options from the server.");
        } finally {
          setLoadingSlots(false);
        }
      };

      fetchData();
    } else {
      setAvailableSlots({});
      setSelectedSlotId(null);
      setAvailableMeetupPoints([]);
      setSelectedMeetupPoint(null);
      setActionReason("");
    }
  }, [activeModal, booking]);

  const handleActionSubmit = async () => {
    if (activeModal === "cancel" && !actionReason.trim()) {
      toast.error("Please provide a reason for cancellation.");
      return;
    }

    if (activeModal === "reschedule" && !selectedSlotId) {
      toast.error("Please select a new date and time.");
      return;
    }

    if (activeModal === "meetup" && !selectedMeetupPoint) {
      toast.error("Please select a new meetup point.");
      return;
    }

    setActionLoading(true);

    try {
      const res = await fetch(`/api/bookings/${booking.id}/request-change`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activeModal,
          reason: actionReason,
          newSlotId: selectedSlotId,
          newMeetupPoint: selectedMeetupPoint,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit request.");

      toast.success("Your request has been submitted.");
      setActiveModal(null);

      setBooking((prev) => ({
        ...prev,
        updateRequested: true,
        hasRescheduled:
          activeModal === "reschedule" ? true : prev.hasRescheduled,
      }));
    } catch {
      toast.error("Could not submit your request.");
    } finally {
      setActionLoading(false);
    }
  };

  const resetSearch = () => {
    setStep("search");
    setBooking(null);
    setReference("");
    setLastName("");
  };

  const getStatusBadge = () => {
    const s = String(booking?.status || "").toLowerCase();

    if (s === "cancelled" || s === "canceled") {
      return (
        <StatusBadge
          tone="red"
          icon={<XCircle size={14} />}
          label="Cancelled"
        />
      );
    }

    if (unpaid) {
      return (
        <StatusBadge
          tone="amber"
          icon={<CreditCard size={14} />}
          label={
            booking?.paymentStatus === "partially_paid"
              ? "Partially Paid"
              : "Payment Due"
          }
        />
      );
    }

    if (s === "confirmed") {
      return (
        <StatusBadge
          tone="emerald"
          icon={<CheckCircle2 size={14} />}
          label="Confirmed"
        />
      );
    }

    return (
      <StatusBadge
        tone="stone"
        icon={<AlertCircle size={14} />}
        label={booking?.status || "Pending"}
      />
    );
  };

  return (
    <div className="min-h-screen bg-[#fdfcfb] selection:bg-[#8b6f47]/20 flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[10%] -right-[5%] w-[50%] h-[50%] rounded-full bg-[#8b6f47]/5 blur-[120px]" />
        <div className="absolute bottom-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-[#e3ddd2]/30 blur-[100px]" />
      </div>

      <header className="relative z-10 border-b border-stone-200 bg-white/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link
            href="/"
            className="text-xl font-serif font-bold text-stone-800 tracking-tight hover:text-[#8b6f47] transition"
          >
            Oasis.
          </Link>
          <div className="text-sm font-medium text-stone-500">Guest Portal</div>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center p-6 py-12 sm:py-24">
        <div className="w-full max-w-3xl">
          <AnimatePresence mode="wait">
            {step === "search" && (
              <motion.div
                key="search"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-xl mx-auto"
              >
                <div className="text-center mb-8">
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-stone-200 shadow-sm">
                    <Ticket className="text-[#8b6f47]" size={24} />
                  </div>
                  <h1 className="text-4xl font-serif text-stone-900 tracking-tight mb-3">
                    Manage Your Booking
                  </h1>
                  <p className="text-stone-500">
                    View your reservation, complete payment, request a
                    reschedule, or update your meetup point.
                  </p>
                </div>

                <div className="bg-white border border-stone-200 rounded-[2rem] p-6 sm:p-8 shadow-xl shadow-stone-200/50">
                  <form onSubmit={handleSearch} className="space-y-5">
                    <InputField
                      id="reference"
                      label="Booking Reference"
                      icon={<Ticket size={18} />}
                      value={reference}
                      onChange={setReference}
                      placeholder="e.g. BK-000123"
                    />

                    <InputField
                      id="lastName"
                      label="Last Name"
                      icon={<Users size={18} />}
                      value={lastName}
                      onChange={setLastName}
                      placeholder="Used during checkout"
                    />

                    <button
                      type="submit"
                      disabled={isSearching}
                      className="w-full flex items-center justify-center gap-2 bg-[#1a1a1a] text-white py-3.5 rounded-xl font-semibold hover:bg-[#333] transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                    >
                      {isSearching ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : (
                        <Search size={20} />
                      )}
                      Find Booking
                    </button>
                  </form>
                </div>
              </motion.div>
            )}

            {step === "details" && booking && (
              <motion.div
                key="details"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <button
                  onClick={resetSearch}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800 mb-6 transition"
                >
                  <ChevronLeft size={16} /> Back to Search
                </button>

                <div className="bg-white border border-stone-200 rounded-[2rem] overflow-hidden shadow-xl shadow-stone-200/50">
                  <div className="bg-gradient-to-br from-stone-50 to-white border-b border-stone-100 p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">
                            Booking Ref
                          </span>

                          {privateBooking && (
                            <StatusBadge
                              tone="purple"
                              icon={<Crown size={12} />}
                              label="Private"
                              small
                            />
                          )}

                          {unpaid && (
                            <StatusBadge
                              tone="amber"
                              icon={<CreditCard size={12} />}
                              label="Unpaid"
                              small
                            />
                          )}
                        </div>

                        <h2 className="text-2xl font-mono font-bold text-stone-800">
                          {booking.reference}
                        </h2>
                      </div>

                      {getStatusBadge()}
                    </div>
                  </div>

                  <div className="p-6 sm:p-8 space-y-6">
                    {privateBooking && <PrivateBookingCard booking={booking} />}

                    {unpaid ? (
                      <PaymentDueCard
                        amountDue={amountDue}
                        bookingTotal={bookingTotal}
                        paidAmount={paidAmount}
                        refundedAmount={refundedAmount}
                        currency={currency}
                        booking={booking}
                        paymentLoading={paymentLoading}
                        onPayOnline={handlePayOnline}
                      />
                    ) : (
                      <PaidCard
                        bookingTotal={bookingTotal}
                        paidAmount={paidAmount}
                        currency={currency}
                      />
                    )}

                    <section>
                      <h3 className="text-xl font-serif font-semibold text-stone-900 mb-5">
                        {booking.experienceName ||
                          booking.customExperienceName ||
                          "Your Experience"}
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <InfoItem
                          icon={<Calendar size={20} />}
                          label="Date"
                          value={
                            booking.date
                              ? new Date(booking.date).toLocaleDateString(
                                  undefined,
                                  {
                                    weekday: "short",
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  },
                                )
                              : "TBD"
                          }
                        />

                        <InfoItem
                          icon={<Clock size={20} />}
                          label="Time"
                          value={booking.time || "TBD"}
                        />

                        <InfoItem
                          icon={<Users size={20} />}
                          label="Guests"
                          value={`${booking.guests || booking.numberOfPeople || 1} People`}
                        />

                        <InfoItem
                          icon={<MapPin size={20} />}
                          label="Location"
                          value={booking.location || "Chania, Crete"}
                        />
                      </div>
                    </section>

                    <section className="pt-6 border-t border-stone-100">
                      <h4 className="text-base font-semibold text-stone-900 mb-4">
                        Party & Meetup Details
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-stone-50/50 rounded-2xl p-5 border border-stone-100">
                        <MeetupCard
                          booking={booking}
                          isMeetupChangeable={isMeetupChangeable}
                          onChange={() => setActiveModal("meetup")}
                        />

                        <AttendeesCard booking={booking} />
                      </div>
                    </section>

                    <section className="pt-6 border-t border-stone-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <p className="text-sm text-stone-500 mb-0.5">
                          Primary Contact
                        </p>
                        <p className="font-medium text-stone-800">
                          {booking.guestName || "Guest"}
                        </p>
                        <p className="text-sm text-stone-500">
                          {booking.email}
                        </p>
                      </div>

                      <div className="sm:text-right">
                        <p className="text-sm text-stone-500 mb-0.5">
                          Booking Total
                        </p>
                        <p className="text-xl font-bold text-stone-800">
                          {formatMoney(bookingTotal, currency)}
                        </p>

                        {unpaid ? (
                          <p className="text-xs font-bold text-amber-700 mt-1">
                            Due: {formatMoney(amountDue, currency)}
                          </p>
                        ) : (
                          <p className="text-xs font-bold text-emerald-700 mt-1 flex items-center gap-1 sm:justify-end">
                            <ReceiptText size={12} /> Paid
                          </p>
                        )}
                      </div>
                    </section>

                    {booking.updateRequested && (
                      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-3">
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <p>
                          We have received your modification request and our
                          team is currently reviewing it. We will contact you
                          shortly.
                        </p>
                      </div>
                    )}
                  </div>

                  {booking.status?.toLowerCase() !== "cancelled" &&
                    !booking.updateRequested && (
                      <div className="bg-stone-50 border-t border-stone-100 p-6 flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={() =>
                            !booking.hasRescheduled &&
                            setActiveModal("reschedule")
                          }
                          disabled={booking.hasRescheduled}
                          className={`flex-1 inline-flex justify-center items-center gap-2 px-4 py-3 rounded-xl font-semibold transition shadow-sm border ${
                            booking.hasRescheduled
                              ? "bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed"
                              : "bg-white border-stone-200 text-stone-800 hover:bg-stone-100"
                          }`}
                        >
                          {booking.hasRescheduled ? (
                            <Lock size={18} />
                          ) : (
                            <RefreshCw size={18} />
                          )}
                          Request Reschedule
                        </button>

                        <button
                          onClick={() => setActiveModal("cancel")}
                          className="flex-1 inline-flex justify-center items-center gap-2 bg-white border border-red-200 text-red-600 px-4 py-3 rounded-xl font-semibold hover:bg-red-50 transition shadow-sm"
                        >
                          <XCircle size={18} /> Request Cancellation
                        </button>
                      </div>
                    )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {activeModal && (
          <BookingModal
            activeModal={activeModal}
            setActiveModal={setActiveModal}
            booking={booking}
            actionLoading={actionLoading}
            actionReason={actionReason}
            setActionReason={setActionReason}
            availableSlots={availableSlots}
            availableMeetupPoints={availableMeetupPoints}
            loadingSlots={loadingSlots}
            selectedSlotId={selectedSlotId}
            setSelectedSlotId={setSelectedSlotId}
            selectedMeetupPoint={selectedMeetupPoint}
            setSelectedMeetupPoint={setSelectedMeetupPoint}
            handleActionSubmit={handleActionSubmit}
            refundStatus={refundStatus}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function InputField({ id, label, icon, value, onChange, placeholder }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-semibold text-stone-700 mb-1.5"
      >
        {label}
      </label>
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
          {icon}
        </div>
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30 focus:border-[#8b6f47] transition-all"
          required
        />
      </div>
    </div>
  );
}

function StatusBadge({ tone = "stone", icon, label, small = false }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    stone: "bg-stone-100 text-stone-700 border-stone-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${
        small
          ? "px-2.5 py-1 text-[10px] uppercase tracking-wider"
          : "px-3 py-1 text-xs"
      } ${tones[tone] || tones.stone}`}
    >
      {icon}
      {label}
    </span>
  );
}

function PrivateBookingCard({ booking }) {
  return (
    <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-[#fdfcfb] p-5">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
          <Crown size={24} />
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-bold text-purple-950">Private Booking</h4>
            <span className="rounded-full bg-white border border-purple-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-700">
              Exclusive Group
            </span>
          </div>

          <p className="text-sm text-purple-900/75 mt-1 leading-relaxed">
            This experience is reserved only for your party. The schedule,
            capacity, and guest handling are treated separately from public
            availability.
          </p>

          {booking.customExperienceName && (
            <div className="mt-4 rounded-xl bg-white border border-purple-100 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-purple-700">
                Private Experience Name
              </p>
              <p className="mt-1 text-sm font-semibold text-stone-900">
                {booking.customExperienceName}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PaymentDueCard({
  amountDue,
  bookingTotal,
  paidAmount,
  refundedAmount,
  currency,
  booking,
  paymentLoading,
  onPayOnline,
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <CreditCard size={24} />
        </div>

        <div className="flex-1">
          <h4 className="font-bold text-amber-950">Payment Required</h4>
          <p className="text-sm text-amber-900/75 mt-1">
            Complete the outstanding balance to secure this reservation.
          </p>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MoneyBox
              label="Total"
              value={formatMoney(bookingTotal, currency)}
            />
            <MoneyBox
              label="Paid"
              value={formatMoney(paidAmount, currency)}
              tone="green"
            />
            <MoneyBox
              label="Refunded"
              value={formatMoney(refundedAmount, currency)}
            />
            <MoneyBox
              label="Due"
              value={formatMoney(amountDue, currency)}
              tone="amber"
            />
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <button
              onClick={onPayOnline}
              disabled={paymentLoading || amountDue <= 0}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1a1a1a] px-4 py-3 text-sm font-bold text-white hover:bg-black disabled:opacity-60"
            >
              {paymentLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CreditCard size={16} />
              )}
              Pay Online
            </button>

            {booking.stripeSessionUrl && (
              <a
                href={booking.stripeSessionUrl}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white border border-amber-200 px-4 py-3 text-sm font-bold text-amber-800 hover:bg-amber-100"
              >
                <WalletCards size={16} />
                Existing Link
              </a>
            )}

            <a
              href={`mailto:info@youroasis.gr?subject=Payment help for booking ${booking.reference}`}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white border border-amber-200 px-4 py-3 text-sm font-bold text-amber-800 hover:bg-amber-100"
            >
              <Mail size={16} />
              Help
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaidCard({ bookingTotal, paidAmount, currency }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 flex items-start gap-4">
      <div className="h-11 w-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
        <ShieldCheck size={22} />
      </div>
      <div>
        <h4 className="font-bold text-emerald-900">Payment Complete</h4>
        <p className="text-sm text-emerald-800/80 mt-1">
          Your payment has been recorded.
        </p>
        <p className="text-sm font-bold text-emerald-900 mt-2">
          Paid: {formatMoney(paidAmount || bookingTotal, currency)}
        </p>
      </div>
    </div>
  );
}

function MoneyBox({ label, value, tone = "stone" }) {
  const tones = {
    amber: "text-amber-900",
    green: "text-emerald-800",
    stone: "text-stone-900",
  };

  return (
    <div className="rounded-xl bg-white border border-amber-100 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
        {label}
      </p>
      <p className={`mt-1 text-sm font-bold ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function InfoItem({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-stone-100 bg-stone-50/60 p-4">
      <div className="text-[#8b6f47] shrink-0 mt-0.5">{icon}</div>
      <div>
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-0.5">
          {label}
        </p>
        <p className="font-medium text-stone-800">{value}</p>
      </div>
    </div>
  );
}

function MeetupCard({ booking, isMeetupChangeable, onChange }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
          <Navigation size={14} className="text-[#8b6f47]" />
          Meetup Point
        </p>

        {booking.status?.toLowerCase() !== "cancelled" &&
          !booking.updateRequested &&
          (isMeetupChangeable ? (
            <button
              onClick={onChange}
              className="text-[10px] font-bold text-[#8b6f47] hover:text-[#6a5436] hover:bg-[#8b6f47]/20 transition uppercase tracking-wider bg-[#8b6f47]/10 px-2 py-0.5 rounded-full"
            >
              Change
            </button>
          ) : (
            <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider px-2 py-0.5 flex items-center gap-1">
              <Lock size={10} /> Locked
            </span>
          ))}
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm flex-1 flex flex-col justify-center">
        <p className="font-medium text-stone-800 flex items-start gap-2">
          <MapPin size={18} className="text-[#8b6f47] shrink-0 mt-0.5" />
          <span>
            {typeof booking.meetupPoint === "string"
              ? booking.meetupPoint
              : booking.meetupPoint?.name || "Standard departure point"}
          </span>
        </p>

        {typeof booking.meetupPoint === "object" &&
          booking.meetupPoint?.time && (
            <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-2 text-sm">
              <Clock size={16} className="text-stone-400 shrink-0" />
              <span className="text-stone-600">
                Meeting time:{" "}
                <strong className="text-stone-800">
                  {booking.meetupPoint.time}
                </strong>
              </span>
            </div>
          )}
      </div>
    </div>
  );
}

function AttendeesCard({ booking }) {
  return (
    <div>
      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <User size={14} className="text-[#8b6f47]" />
        Attendees
      </p>

      {booking.attendees && booking.attendees.length > 0 ? (
        <ul className="space-y-2">
          {booking.attendees.map((attendee, idx) => {
            const isObj = typeof attendee === "object" && attendee !== null;
            const fName = isObj ? attendee.firstName : attendee;
            const lName = isObj ? attendee.lastName : "";
            const isKid = isObj ? attendee.isKid : false;

            const fullName =
              `${fName || ""} ${lName || ""}`.trim() || `Guest ${idx + 1}`;

            return (
              <li
                key={idx}
                className="flex items-center justify-between bg-white border border-stone-200 p-3 rounded-xl shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-stone-100 text-stone-500 rounded-full h-8 w-8 flex items-center justify-center text-xs font-bold shrink-0">
                    {fullName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-stone-800">
                    {fullName}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                    isKid
                      ? "bg-blue-50 text-blue-600 border-blue-100"
                      : "bg-stone-50 text-stone-500 border-stone-200"
                  }`}
                >
                  {isKid ? "Child" : "Adult"}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm h-full flex items-center">
          <p className="text-sm font-medium text-stone-800">
            {booking.adultsCount || 0} Adults, {booking.kidsCount || 0} Children
          </p>
        </div>
      )}
    </div>
  );
}

function BookingModal({
  activeModal,
  setActiveModal,
  booking,
  actionLoading,
  actionReason,
  setActionReason,
  availableSlots,
  availableMeetupPoints,
  loadingSlots,
  selectedSlotId,
  setSelectedSlotId,
  selectedMeetupPoint,
  setSelectedMeetupPoint,
  handleActionSubmit,
  refundStatus,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
        onClick={() => !actionLoading && setActiveModal(null)}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden z-10 flex flex-col max-h-[90vh]"
      >
        <div className="p-6 sm:p-8 flex-1 overflow-y-auto">
          <h3 className="text-xl font-bold text-stone-900 mb-2">
            {activeModal === "cancel" && "Request Cancellation"}
            {activeModal === "reschedule" && "Reschedule Booking"}
            {activeModal === "meetup" && "Change Meetup Point"}
          </h3>

          {activeModal === "cancel" && (
            <div className="mb-6">
              <p className="text-sm text-stone-500 mb-4">
                Review the cancellation policy for this experience before
                proceeding.
              </p>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 mb-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={18} className="text-[#8b6f47]" />
                    <h4 className="font-bold text-stone-900 text-sm">
                      Cancellation Policy
                    </h4>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest font-bold bg-white border border-stone-200 px-2 py-0.5 rounded text-stone-600 shadow-sm">
                    {booking.cancellationPolicy || "Moderate"}
                  </span>
                </div>

                <p className="text-sm text-stone-600 mb-4">
                  {getPolicyDescription(booking.cancellationPolicy)}
                </p>

                <div
                  className={`p-3 rounded-lg flex items-start gap-2 border ${
                    refundStatus === "full"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : refundStatus === "partial"
                        ? "bg-amber-50 border-amber-200 text-amber-800"
                        : "bg-red-50 border-red-200 text-red-800"
                  }`}
                >
                  <CreditCard size={16} className="shrink-0 mt-0.5" />
                  <div className="text-sm">
                    {refundStatus === "full" ? (
                      <>
                        <strong className="block mb-0.5">
                          Eligible for Full Refund
                        </strong>
                        You are eligible for a 100% refund.
                      </>
                    ) : refundStatus === "partial" ? (
                      <>
                        <strong className="block mb-0.5">
                          Eligible for Partial Refund
                        </strong>
                        Cancellations made at this time are eligible for a 50%
                        refund.
                      </>
                    ) : (
                      <>
                        <strong className="block mb-0.5">
                          Past Refund Window
                        </strong>
                        This booking is not eligible for a refund.
                      </>
                    )}
                  </div>
                </div>
              </div>

              <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                Reason for cancellation
              </label>
              <textarea
                rows={3}
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Please tell us why you need to cancel..."
                className="w-full p-3 bg-white border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30 focus:border-[#8b6f47] resize-none"
              />
            </div>
          )}

          {activeModal === "meetup" && (
            <div className="mb-6">
              <p className="text-sm text-stone-500 mb-6">
                Select an alternative meetup point for your experience.
              </p>

              {loadingSlots ? (
                <LoadingOptions label="Finding alternative meetup points..." />
              ) : availableMeetupPoints.length === 0 ? (
                <EmptyOptions label="No alternative meetup points are available." />
              ) : (
                <div className="space-y-3">
                  {availableMeetupPoints.map((mp, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedMeetupPoint(mp)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                        selectedMeetupPoint?.name === mp.name
                          ? "bg-[#8b6f47]/5 border-[#8b6f47] ring-1 ring-[#8b6f47]"
                          : "bg-white border-stone-200 hover:border-[#8b6f47]"
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-stone-800">
                          {mp.name}
                        </p>
                        {mp.time && (
                          <p className="text-sm text-stone-500 mt-0.5">
                            Meeting time: {mp.time}
                          </p>
                        )}
                      </div>

                      {selectedMeetupPoint?.name === mp.name && (
                        <CheckCircle2
                          size={20}
                          className="text-[#8b6f47] shrink-0 ml-3"
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeModal === "reschedule" && (
            <div className="mb-6">
              <p className="text-sm text-stone-500 mb-6">
                Select a new date and time that fits your party of{" "}
                <strong>{booking.guests}</strong>.
              </p>

              {loadingSlots ? (
                <LoadingOptions label="Finding available slots..." />
              ) : Object.keys(availableSlots).length === 0 ? (
                <EmptyOptions label="No available slots found for your party size." />
              ) : (
                <div className="space-y-4">
                  {Object.entries(availableSlots).map(([dateStr, slots]) => {
                    const d = new Date(dateStr);

                    return (
                      <div key={dateStr}>
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">
                          {d.toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>

                        <div className="grid grid-cols-3 gap-2">
                          {slots.map((slot) => (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => setSelectedSlotId(slot.id)}
                              className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                                selectedSlotId === slot.id
                                  ? "bg-[#8b6f47] text-white border-[#8b6f47] shadow-md"
                                  : "bg-white text-stone-700 border-stone-200 hover:border-[#8b6f47] hover:text-[#8b6f47]"
                              }`}
                            >
                              {slot.time}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <label className="block text-sm font-semibold text-stone-700 mb-1.5 mt-6">
                Additional Notes
              </label>
              <textarea
                rows={2}
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Any special requests?"
                className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30 focus:border-[#8b6f47] resize-none"
              />
            </div>
          )}
        </div>

        <div className="p-6 border-t border-stone-100 bg-stone-50 flex gap-3 shrink-0">
          <button
            onClick={() => setActiveModal(null)}
            disabled={actionLoading}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-stone-600 hover:bg-stone-200 transition disabled:opacity-50"
          >
            Go Back
          </button>

          <button
            onClick={handleActionSubmit}
            disabled={
              actionLoading ||
              (activeModal === "reschedule" && !selectedSlotId) ||
              (activeModal === "meetup" && !selectedMeetupPoint) ||
              (activeModal === "cancel" && !actionReason.trim())
            }
            className={`flex-1 px-4 py-2.5 rounded-xl font-semibold text-white flex justify-center items-center gap-2 transition disabled:opacity-50 ${
              activeModal === "cancel"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-[#1a1a1a] hover:bg-[#333]"
            }`}
          >
            {actionLoading && <Loader2 className="animate-spin" size={16} />}
            Submit Request
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function LoadingOptions({ label }) {
  return (
    <div className="py-12 flex flex-col items-center justify-center text-stone-400">
      <Loader2 className="animate-spin mb-2" size={24} />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function EmptyOptions({ label }) {
  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-center text-sm text-stone-600">
      {label}
    </div>
  );
}
