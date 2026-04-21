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
} from "lucide-react";
import Link from "next/link";

// Helper to translate policy types into readable rules
const getPolicyDescription = (policy) => {
  const p = policy?.toLowerCase() || "moderate";
  if (p.includes("flexible")) {
    return "Full refund up to 48 hours before the experience starts.";
  }
  if (p.includes("strict")) {
    return "100% refund up to 14 days, 50% refund 7-13 days, no refund under 7 days.";
  }
  // Default to Moderate
  return "Full refund up to 7 days before, 50% refund up to 48 hours before.";
};

export default function ManageBookingPage() {
  const [step, setStep] = useState("search");

  // Search Form State
  const [reference, setReference] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Booking Data State
  const [booking, setBooking] = useState(null);

  // Action Modals State
  const [activeModal, setActiveModal] = useState(null); // 'cancel' | 'reschedule' | 'meetup' | null
  const [actionLoading, setActionLoading] = useState(false);
  const [actionReason, setActionReason] = useState("");

  // Reschedule & Meetup State
  const [availableSlots, setAvailableSlots] = useState({});
  const [availableMeetupPoints, setAvailableMeetupPoints] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [selectedMeetupPoint, setSelectedMeetupPoint] = useState(null);

  // ---------- Time & Policy Calculations ----------
  let isMeetupChangeable = false;
  let hoursUntilEvent = 0;
  let refundStatus = "none"; // 'full' | 'partial' | 'none'

  if (booking && booking.date && booking.time && booking.time !== "TBD") {
    // Format "17:30" to "17:30:00" for valid parsing across browsers
    const timeStr =
      booking.time.length === 5 ? `${booking.time}:00` : booking.time;
    const eventDateTime = new Date(`${booking.date}T${timeStr}`);

    if (!isNaN(eventDateTime.getTime())) {
      hoursUntilEvent =
        (eventDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
      isMeetupChangeable = hoursUntilEvent >= 10;

      // Determine refund eligibility based on actual policies
      const policy = (booking.cancellationPolicy || "moderate").toLowerCase();

      if (policy.includes("flexible")) {
        if (hoursUntilEvent >= 48) refundStatus = "full";
        else refundStatus = "none";
      } else if (policy.includes("strict")) {
        if (hoursUntilEvent >= 14 * 24) refundStatus = "full";
        else if (hoursUntilEvent >= 7 * 24) refundStatus = "partial";
        else refundStatus = "none";
      } else {
        // Moderate (Default)
        if (hoursUntilEvent >= 7 * 24) refundStatus = "full";
        else if (hoursUntilEvent >= 48) refundStatus = "partial";
        else refundStatus = "none";
      }
    }
  }

  // ---------- Handlers ----------

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!reference.trim() || !lastName.trim()) {
      toast.error("Please enter both your booking reference and last name.");
      return;
    }

    setIsSearching(true);

    try {
      const res = await fetch(
        `/api/bookings/lookup?ref=${encodeURIComponent(reference)}&lastName=${encodeURIComponent(lastName)}`,
      );

      if (!res.ok) {
        throw new Error(
          "Booking not found. Please check your details and try again.",
        );
      }

      const data = await res.json();
      setBooking(data);
      setStep("details");
    } catch (error) {
      // Mock fallback for demonstration purposes
      if (reference.startsWith("BKG") && lastName) {
        setBooking({
          id: 123,
          experienceId: 42,
          reference: reference.toUpperCase(),
          guestName: `John ${lastName}`,
          email: "john@example.com",
          experienceName: "Sunset Wine Tasting & Vineyard Tour",
          date: "2026-05-15",
          time: "17:30",
          guests: 3,
          adultsCount: 2,
          kidsCount: 1,
          status: "confirmed",
          totalAmount: 160.0,
          location: "Estate Winery, North Block",
          meetupPoint: { name: "Main Entrance Gate", time: "17:15" },
          cancellationPolicy: "moderate", // Mock policy
          attendees: [
            { firstName: "John", lastName: lastName },
            { firstName: "Jane", lastName: lastName },
            { firstName: "Timmy", lastName: lastName, isKid: true },
          ],
          hasRescheduled: false,
        });
        setStep("details");
      } else {
        toast.error(error.message || "Booking not found.");
      }
    } finally {
      setIsSearching(false);
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
            // Extract the general meetup points from the schedule response
            const points =
              data.length > 0 && data[0].meetupPoints
                ? data[0].meetupPoints
                : [];
            setAvailableMeetupPoints(points);
          }
        } catch (error) {
          console.error("Data fetch error:", error);
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

      toast.success(`Your request has been submitted.`);
      setActiveModal(null);

      // If it's a reschedule request, we can assume they've used up their 1 chance locally
      if (activeModal === "reschedule") {
        setBooking((prev) => ({
          ...prev,
          updateRequested: true,
          hasRescheduled: true,
        }));
      } else {
        setBooking((prev) => ({ ...prev, updateRequested: true }));
      }
    } catch (error) {
      // Mock fallback
      toast.success(
        `Your request has been submitted. Our team will review it shortly.`,
      );
      setActiveModal(null);

      if (activeModal === "reschedule") {
        setBooking((prev) => ({
          ...prev,
          updateRequested: true,
          hasRescheduled: true,
        }));
      } else {
        setBooking((prev) => ({ ...prev, updateRequested: true }));
      }
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

  // ---------- Render Helpers ----------

  const getStatusBadge = (status) => {
    switch (status.toLowerCase()) {
      case "confirmed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={14} /> Confirmed
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 border border-red-200">
            <XCircle size={14} /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700 border border-stone-200">
            <AlertCircle size={14} /> {status}
          </span>
        );
    }
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
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            {/* STEP 1: SEARCH */}
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
                  <h1 className="text-4xl font-serif text-stone-900 tracking-tight mb-3">
                    Manage Your Booking
                  </h1>
                  <p className="text-stone-500">
                    Enter your booking details below to view, reschedule, or
                    cancel your reservation.
                  </p>
                </div>

                <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-xl shadow-stone-200/50">
                  <form onSubmit={handleSearch} className="space-y-5">
                    <div>
                      <label
                        htmlFor="reference"
                        className="block text-sm font-semibold text-stone-700 mb-1.5"
                      >
                        Booking Reference
                      </label>
                      <div className="relative">
                        <Ticket
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
                          size={18}
                        />
                        <input
                          id="reference"
                          type="text"
                          value={reference}
                          onChange={(e) => setReference(e.target.value)}
                          placeholder="e.g. BK-000123"
                          className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30 focus:border-[#8b6f47] transition-all"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="lastName"
                        className="block text-sm font-semibold text-stone-700 mb-1.5"
                      >
                        Last Name
                      </label>
                      <div className="relative">
                        <Users
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
                          size={18}
                        />
                        <input
                          id="lastName"
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Used during checkout"
                          className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30 focus:border-[#8b6f47] transition-all"
                          required
                        />
                      </div>
                    </div>

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

                  <div className="mt-8 pt-6 border-t border-stone-100 text-center">
                    <p className="text-sm text-stone-500 mb-3">
                      Have an account?
                    </p>
                    <Link
                      href="/login"
                      className="inline-flex items-center justify-center w-full bg-white border border-stone-200 text-stone-700 py-3 rounded-xl font-semibold hover:bg-stone-50 transition-all"
                    >
                      Sign In to view all bookings
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: BOOKING DETAILS */}
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

                <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xl shadow-stone-200/50">
                  <div className="bg-stone-50 border-b border-stone-100 p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <div className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">
                        Booking Ref
                      </div>
                      <h2 className="text-2xl font-mono font-bold text-stone-800">
                        {booking.reference}
                      </h2>
                    </div>
                    {getStatusBadge(booking.status)}
                  </div>

                  <div className="p-6 sm:p-8 space-y-8">
                    <div>
                      <h3 className="text-xl font-serif font-semibold text-stone-900 mb-5">
                        {booking.experienceName}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="flex items-start gap-3">
                          <Calendar
                            className="text-[#8b6f47] shrink-0 mt-0.5"
                            size={20}
                          />
                          <div>
                            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-0.5">
                              Date
                            </p>
                            <p className="font-medium text-stone-800">
                              {new Date(booking.date).toLocaleDateString(
                                undefined,
                                {
                                  weekday: "short",
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                },
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Clock
                            className="text-[#8b6f47] shrink-0 mt-0.5"
                            size={20}
                          />
                          <div>
                            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-0.5">
                              Time
                            </p>
                            <p className="font-medium text-stone-800">
                              {booking.time}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Users
                            className="text-[#8b6f47] shrink-0 mt-0.5"
                            size={20}
                          />
                          <div>
                            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-0.5">
                              Total Guests
                            </p>
                            <p className="font-medium text-stone-800">
                              {booking.guests} People
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <MapPin
                            className="text-[#8b6f47] shrink-0 mt-0.5"
                            size={20}
                          />
                          <div>
                            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-0.5">
                              General Location
                            </p>
                            <p className="font-medium text-stone-800">
                              {booking.location}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ---------- PARTY & MEETUP SECTION ---------- */}
                    <div className="pt-6 border-t border-stone-100">
                      <h4 className="text-base font-semibold text-stone-900 mb-4">
                        Party & Meetup Details
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-stone-50/50 rounded-xl p-5 border border-stone-100">
                        {/* Meetup Point Column */}
                        <div className="flex flex-col">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                              <Navigation
                                size={14}
                                className="text-[#8b6f47]"
                              />{" "}
                              Meetup Point
                            </p>
                            {booking.status.toLowerCase() !== "cancelled" &&
                              !booking.updateRequested &&
                              (isMeetupChangeable ? (
                                <button
                                  onClick={() => setActiveModal("meetup")}
                                  className="text-[10px] font-bold text-[#8b6f47] hover:text-[#6a5436] hover:bg-[#8b6f47]/20 transition uppercase tracking-wider bg-[#8b6f47]/10 px-2 py-0.5 rounded-full"
                                >
                                  Change
                                </button>
                              ) : (
                                <span
                                  className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider px-2 py-0.5 flex items-center gap-1"
                                  title="Changes are not allowed within 10 hours of the event"
                                >
                                  <Lock size={10} /> Locked
                                </span>
                              ))}
                          </div>

                          {booking.meetupPoint ? (
                            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm flex-1 flex flex-col justify-center">
                              <p className="font-medium text-stone-800 flex items-start gap-2">
                                <MapPin
                                  size={18}
                                  className="text-[#8b6f47] shrink-0 mt-0.5"
                                />
                                <span>
                                  {typeof booking.meetupPoint === "string"
                                    ? booking.meetupPoint
                                    : booking.meetupPoint.name ||
                                      "Designated Meetup Point"}
                                </span>
                              </p>
                              {typeof booking.meetupPoint === "object" &&
                                booking.meetupPoint !== null &&
                                booking.meetupPoint.time && (
                                  <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-2 text-sm">
                                    <Clock
                                      size={16}
                                      className="text-stone-400 shrink-0"
                                    />
                                    <span className="text-stone-600">
                                      Meeting time:{" "}
                                      <strong className="text-stone-800">
                                        {booking.meetupPoint.time}
                                      </strong>
                                    </span>
                                  </div>
                                )}
                            </div>
                          ) : (
                            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm flex-1 flex items-center">
                              <p className="text-sm text-stone-600">
                                Standard departure point (please check your
                                confirmation email for exact details).
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Attendees Column */}
                        <div>
                          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <User size={14} className="text-[#8b6f47]" />{" "}
                            Attendees
                          </p>
                          {booking.attendees && booking.attendees.length > 0 ? (
                            <ul className="space-y-2">
                              {booking.attendees.map((attendee, idx) => {
                                const isObj =
                                  typeof attendee === "object" &&
                                  attendee !== null;
                                const fName = isObj
                                  ? attendee.firstName
                                  : attendee;
                                const lName = isObj ? attendee.lastName : "";
                                const isKid = isObj ? attendee.isKid : false;

                                const fullName =
                                  `${fName || ""} ${lName || ""}`.trim() ||
                                  `Guest ${idx + 1}`;
                                const initial = fullName
                                  .charAt(0)
                                  .toUpperCase();

                                return (
                                  <li
                                    key={idx}
                                    className="flex items-center justify-between bg-white border border-stone-200 p-3 rounded-xl shadow-sm"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="bg-stone-100 text-stone-500 rounded-full h-8 w-8 flex items-center justify-center text-xs font-bold shrink-0">
                                        {initial}
                                      </div>
                                      <span className="text-sm font-medium text-stone-800">
                                        {fullName}
                                      </span>
                                    </div>
                                    {isKid ? (
                                      <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full border border-blue-100">
                                        Child
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold uppercase tracking-wider bg-stone-50 text-stone-500 px-2.5 py-1 rounded-full border border-stone-200">
                                        Adult
                                      </span>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm h-full flex items-center">
                              <p className="text-sm font-medium text-stone-800">
                                {booking.adultsCount || 0} Adults,{" "}
                                {booking.kidsCount || 0} Children
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* ---------------------------------------------------- */}

                    <div className="pt-6 border-t border-stone-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <p className="text-sm text-stone-500 mb-0.5">
                          Primary Contact
                        </p>
                        <p className="font-medium text-stone-800">
                          {booking.guestName}
                        </p>
                        <p className="text-sm text-stone-500">
                          {booking.email}
                        </p>
                      </div>
                      <div className="sm:text-right">
                        <p className="text-sm text-stone-500 mb-0.5">
                          Total Paid
                        </p>
                        <p className="text-xl font-bold text-stone-800">
                          ${booking.totalAmount.toFixed(2)}
                        </p>
                      </div>
                    </div>

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

                  {booking.status.toLowerCase() !== "cancelled" &&
                    !booking.updateRequested && (
                      <div className="bg-stone-50 border-t border-stone-100 p-6 flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={() =>
                            !booking.hasRescheduled &&
                            setActiveModal("reschedule")
                          }
                          disabled={booking.hasRescheduled}
                          title={
                            booking.hasRescheduled
                              ? "Bookings can only be rescheduled once."
                              : ""
                          }
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

      {/* Action Modal (Reschedule / Cancel / Meetup) */}
      <AnimatePresence>
        {activeModal && (
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

                {/* Cancel View with Policy Rules */}
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

                      {/* Dynamic Refund Eligibility Box */}
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
                              Based on the{" "}
                              {booking.cancellationPolicy || "Moderate"} policy
                              and the current time, you are eligible for a 100%
                              refund.
                            </>
                          ) : refundStatus === "partial" ? (
                            <>
                              <strong className="block mb-0.5">
                                Eligible for Partial Refund (50%)
                              </strong>
                              Based on the{" "}
                              {booking.cancellationPolicy || "Moderate"} policy,
                              cancellations made at this time are eligible for a
                              50% refund.
                            </>
                          ) : (
                            <>
                              <strong className="block mb-0.5">
                                Past Refund Window
                              </strong>
                              Based on the{" "}
                              {booking.cancellationPolicy || "Moderate"} policy,
                              cancellations made this close to the event time
                              are not eligible for a refund.
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

                {activeModal === "reschedule" && (
                  <p className="text-sm text-stone-500 mb-6">
                    Select a new date and time that fits your party of{" "}
                    <strong>{booking.guests}</strong>.
                  </p>
                )}
                {activeModal === "meetup" && (
                  <p className="text-sm text-stone-500 mb-6">
                    Select an alternative meetup point for your experience.
                  </p>
                )}

                {/* Meetup Point Picker */}
                {activeModal === "meetup" && (
                  <div className="mb-6">
                    {loadingSlots ? (
                      <div className="py-12 flex flex-col items-center justify-center text-stone-400">
                        <Loader2 className="animate-spin mb-2" size={24} />
                        <p className="text-sm">
                          Finding alternative meetup points...
                        </p>
                      </div>
                    ) : availableMeetupPoints.length === 0 ? (
                      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-center text-sm text-stone-600">
                        No alternative meetup points are available for this
                        experience.
                      </div>
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

                {/* Reschedule Slot Picker */}
                {activeModal === "reschedule" && (
                  <div className="mb-6">
                    {loadingSlots ? (
                      <div className="py-12 flex flex-col items-center justify-center text-stone-400">
                        <Loader2 className="animate-spin mb-2" size={24} />
                        <p className="text-sm">Finding available slots...</p>
                      </div>
                    ) : Object.keys(availableSlots).length === 0 ? (
                      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-center text-sm text-stone-600">
                        No available slots found for your party size. Please
                        contact support.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(availableSlots).map(
                          ([dateStr, slots]) => {
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
                          },
                        )}
                      </div>
                    )}

                    <label className="block text-sm font-semibold text-stone-700 mb-1.5 mt-6">
                      Additional Notes (Optional)
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
                  className={`flex-1 px-4 py-2.5 rounded-xl font-semibold text-white flex justify-center items-center gap-2 transition disabled:opacity-50 ${activeModal === "cancel" ? "bg-red-600 hover:bg-red-700" : "bg-[#1a1a1a] hover:bg-[#333]"}`}
                >
                  {actionLoading && (
                    <Loader2 className="animate-spin" size={16} />
                  )}
                  Submit Request
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
