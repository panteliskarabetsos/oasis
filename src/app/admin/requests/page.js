// src/app/admin/requests/page.js
"use client";

import { useState, useEffect, useMemo } from "react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  Clock,
  CalendarDays,
  MessageSquare,
  AlertCircle,
  Loader2,
  RefreshCw,
  Search,
  Ticket,
  Users,
  ShieldAlert,
  CreditCard,
  Copy,
  ArrowUpDown,
} from "lucide-react";

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

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState("requested_desc");

  // Modal State
  const [activeModal, setActiveModal] = useState(null);
  const [modalAction, setModalAction] = useState(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [refundOption, setRefundOption] = useState("full");
  const [recommendedRefund, setRecommendedRefund] = useState(null);
  const [hoursBeforeEvent, setHoursBeforeEvent] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/requests");
      if (!res.ok) throw new Error("Failed to fetch requests");
      const data = await res.json();
      setRequests(data);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const filteredAndSortedRequests = useMemo(() => {
    let result = requests.filter((req) => {
      const matchesSearch =
        req.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.reference.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === "all" || req.type === filterType;
      return matchesSearch && matchesType;
    });

    result.sort((a, b) => {
      if (sortBy === "requested_desc")
        return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === "requested_asc")
        return new Date(a.createdAt) - new Date(b.createdAt);

      const dateA = a.eventDate
        ? new Date(a.eventDate).getTime()
        : 9999999999999;
      const dateB = b.eventDate
        ? new Date(b.eventDate).getTime()
        : 9999999999999;

      if (sortBy === "event_asc") return dateA - dateB; // Closest events first
      if (sortBy === "event_desc") return dateB - dateA; // Furthest events first
      return 0;
    });

    return result;
  }, [requests, searchQuery, filterType, sortBy]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Reference copied!");
  };

  const openModal = (request, action) => {
    setActiveModal(request);
    setModalAction(action);
    setAdminNotes("");

    // Calculate default refund recommendation if it's a cancellation approval
    if (action === "approve" && request.type === "cancel") {
      let defaultRefund = "none";
      let diffHours = 0;

      if (request.eventDate && request.createdAt) {
        const eventTime = new Date(request.eventDate).getTime();
        const requestTime = new Date(request.createdAt).getTime();
        diffHours = (eventTime - requestTime) / (1000 * 60 * 60);

        const policy = (request.cancellationPolicy || "moderate").toLowerCase();

        if (policy.includes("flexible")) {
          defaultRefund = diffHours >= 48 ? "full" : "none";
        } else if (policy.includes("strict")) {
          if (diffHours >= 14 * 24) defaultRefund = "full";
          else if (diffHours >= 7 * 24) defaultRefund = "partial";
          else defaultRefund = "none";
        } else {
          // Moderate
          if (diffHours >= 7 * 24) defaultRefund = "full";
          else if (diffHours >= 48) defaultRefund = "partial";
          else defaultRefund = "none";
        }
      }

      setHoursBeforeEvent(Math.max(0, diffHours));
      setRecommendedRefund(defaultRefund);
      setRefundOption(defaultRefund);
    } else {
      setRefundOption("full");
      setRecommendedRefund(null);
      setHoursBeforeEvent(null);
    }
  };

  const closeModal = () => {
    if (isProcessing) return;
    setActiveModal(null);
    setModalAction(null);
  };

  const handleProcessRequest = async () => {
    setIsProcessing(true);
    try {
      const payload = {
        action: modalAction,
        adminNotes: adminNotes,
      };

      if (modalAction === "approve" && activeModal.type === "cancel") {
        payload.refundOption = refundOption;
      }

      const res = await fetch(`/api/admin/requests/${activeModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to process request");
      }

      toast.success(`Request ${modalAction}d successfully!`);
      setRequests((prev) => prev.filter((r) => r.id !== activeModal.id));
      closeModal();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdfcfb] p-6 md:p-12 font-sans selection:bg-[#8b6f47]/20 relative">
      <div className="max-w-5xl mx-auto relative z-10">
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-serif font-bold text-stone-900 tracking-tight">
              Guest Requests
            </h1>
            <p className="text-stone-500 mt-2 text-lg">
              Review and manage pending cancellations and rescheduling requests.
            </p>
          </div>
          <button
            onClick={fetchRequests}
            disabled={isLoading}
            className="flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-900 bg-white px-5 py-2.5 border border-stone-200 rounded-xl shadow-sm hover:shadow transition disabled:opacity-50"
          >
            <RefreshCw className={isLoading ? "animate-spin" : ""} size={16} />
            {isLoading ? "Refreshing..." : "Refresh List"}
          </button>
        </header>

        {/* Toolbar: Search, Filters, Sort */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm mb-8 space-y-4 md:space-y-0 md:flex md:items-center md:gap-4">
          <div className="relative flex-1">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search by guest name or BK- reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30 focus:border-[#8b6f47] transition-all"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0">
            <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200/50 w-full sm:w-auto">
              {[
                { id: "all", label: "All" },
                { id: "cancel", label: "Cancellations" },
                { id: "reschedule", label: "Reschedules" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id)}
                  className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${
                    filterType === tab.id
                      ? "bg-white text-stone-900 shadow-sm"
                      : "text-stone-500 hover:text-stone-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto relative">
              <ArrowUpDown
                className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                size={16}
              />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full sm:w-auto pl-9 pr-8 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30 focus:border-[#8b6f47] appearance-none cursor-pointer"
              >
                <option value="requested_desc">Newest Requests</option>
                <option value="requested_asc">Oldest Requests</option>
                <option value="event_asc">Closest Event Date</option>
                <option value="event_desc">Furthest Event Date</option>
              </select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white border border-stone-100 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row gap-6 animate-pulse"
              >
                <div className="flex-1 space-y-4 w-full">
                  <div className="flex gap-3">
                    <div className="h-6 w-24 bg-stone-200 rounded-full" />
                    <div className="h-6 w-32 bg-stone-100 rounded-full" />
                  </div>
                  <div>
                    <div className="h-6 w-48 bg-stone-200 rounded mb-2" />
                    <div className="h-4 w-64 bg-stone-100 rounded" />
                  </div>
                  <div className="h-16 w-full bg-stone-50 rounded-xl" />
                </div>
                <div className="w-full lg:w-40 flex flex-row lg:flex-col gap-3 shrink-0">
                  <div className="h-11 w-full bg-stone-200 rounded-xl" />
                  <div className="h-11 w-full bg-stone-100 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredAndSortedRequests.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-stone-200 rounded-3xl p-12 text-center shadow-sm"
          >
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="text-emerald-500" size={32} />
            </div>
            <h3 className="text-xl font-bold text-stone-900 mb-2">
              You're all caught up!
            </h3>
            <p className="text-stone-500 max-w-md mx-auto">
              {searchQuery || filterType !== "all"
                ? "No requests match your current search or filters."
                : "There are no pending guest requests at the moment. Time for a coffee break!"}
            </p>
            {(searchQuery || filterType !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setFilterType("all");
                }}
                className="mt-6 text-sm font-semibold text-[#8b6f47] hover:underline"
              >
                Clear Filters
              </button>
            )}
          </motion.div>
        ) : (
          <div className="space-y-5">
            <AnimatePresence>
              {filteredAndSortedRequests.map((req) => {
                const hasEnoughCapacity =
                  req.availableSlots !== null &&
                  req.availableSlots >= req.totalGuests;

                let urgencyText = "";
                let urgencyColor = "text-stone-400";
                if (req.eventDate) {
                  const evDate = new Date(req.eventDate);
                  if (isPast(evDate)) {
                    urgencyText = "Event passed";
                    urgencyColor = "text-red-500 font-bold";
                  } else {
                    urgencyText = `Starts in ${formatDistanceToNow(evDate)}`;
                    const hoursLeft =
                      (evDate.getTime() - Date.now()) / (1000 * 60 * 60);
                    if (hoursLeft <= 48)
                      urgencyColor = "text-red-500 font-bold";
                    else if (hoursLeft <= 168)
                      urgencyColor = "text-amber-500 font-semibold";
                  }
                }

                return (
                  <motion.div
                    key={req.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{
                      opacity: 0,
                      scale: 0.95,
                      transition: { duration: 0.2 },
                    }}
                    className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col lg:flex-row gap-6 items-start justify-between group"
                  >
                    <div className="flex-1 space-y-4 w-full">
                      <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              req.type === "cancel"
                                ? "bg-red-50 text-red-600 border border-red-100"
                                : "bg-blue-50 text-blue-600 border border-blue-100"
                            }`}
                          >
                            {req.type === "cancel"
                              ? "Cancellation"
                              : "Reschedule"}
                          </span>
                          <span className="text-xs font-semibold text-stone-400 flex items-center gap-1.5 uppercase tracking-wide">
                            <Clock size={12} /> Req.{" "}
                            {format(new Date(req.createdAt), "MMM d, HH:mm")}
                          </span>
                        </div>
                        {urgencyText && (
                          <span
                            className={`text-xs uppercase tracking-wide flex items-center gap-1.5 ${urgencyColor}`}
                          >
                            {urgencyText}
                          </span>
                        )}
                      </div>

                      <div>
                        <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2 mb-1.5">
                          {req.guestName}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-stone-600">
                          <span className="flex items-center gap-1 bg-stone-100 pl-2 pr-1 py-0.5 rounded text-stone-700 font-mono text-xs border border-stone-200/50">
                            <Ticket size={12} className="text-stone-400" />{" "}
                            {req.reference}
                            <button
                              onClick={() => copyToClipboard(req.reference)}
                              className="p-1 hover:bg-stone-200 rounded transition ml-1"
                              title="Copy Reference"
                            >
                              <Copy size={12} className="text-stone-500" />
                            </button>
                          </span>
                          <span className="text-stone-300">•</span>
                          <span>{req.experienceName}</span>
                          <span className="text-stone-300">•</span>
                          <span className="flex items-center gap-1 text-stone-700">
                            <Users size={14} className="text-stone-400" />
                            Party of {req.totalGuests}
                          </span>
                        </div>
                      </div>

                      <div className="bg-stone-50 rounded-xl p-4 border border-stone-100 text-sm">
                        <div className="flex items-start gap-2.5 mb-1">
                          <MessageSquare
                            size={16}
                            className="text-[#8b6f47] shrink-0 mt-0.5"
                          />
                          <div>
                            <span className="font-semibold text-stone-800 block mb-0.5">
                              Guest's Reason:
                            </span>
                            <span className="text-stone-600 italic">
                              "{req.reason || "No reason provided."}"
                            </span>
                          </div>
                        </div>

                        {req.type === "cancel" && (
                          <div className="flex items-start gap-2.5 mt-4 pt-4 border-t border-stone-200">
                            <ShieldAlert
                              size={16}
                              className="text-[#8b6f47] shrink-0 mt-0.5"
                            />
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-stone-800 block">
                                  Cancellation Policy:
                                </span>
                                <span className="text-stone-800 capitalize bg-[#8b6f47]/10 px-2 py-0.5 rounded-md font-bold text-[10px] tracking-widest">
                                  {req.cancellationPolicy || "Moderate"}
                                </span>
                              </div>
                              <span className="text-stone-500 text-xs">
                                {getPolicyDescription(req.cancellationPolicy)}
                              </span>
                            </div>
                          </div>
                        )}

                        {req.type === "reschedule" && req.newDate && (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4 pt-4 border-t border-stone-200">
                            <div className="flex items-start gap-2.5">
                              <CalendarDays
                                size={16}
                                className="text-[#8b6f47] shrink-0 mt-0.5"
                              />
                              <div>
                                <span className="font-semibold text-stone-800 block mb-0.5">
                                  Requested New Date:
                                </span>
                                <span className="text-[#8b6f47] font-bold bg-[#8b6f47]/10 px-2 py-0.5 rounded-md">
                                  {format(
                                    new Date(req.newDate),
                                    "EEEE, MMMM d, yyyy @ HH:mm",
                                  )}
                                </span>
                              </div>
                            </div>

                            {req.availableSlots !== null && (
                              <div className="sm:text-right border-l-2 border-stone-200 pl-4 sm:border-l-0 sm:pl-0">
                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                                  Slot Capacity
                                </span>
                                {hasEnoughCapacity ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md text-xs font-bold">
                                    <CheckCircle size={12} />{" "}
                                    {req.availableSlots} spots available
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-md text-xs font-bold">
                                    <AlertCircle size={12} /> Only{" "}
                                    {req.availableSlots} spots left (Needs{" "}
                                    {req.totalGuests})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="w-full lg:w-48 flex flex-row lg:flex-col gap-3 shrink-0 pt-2 lg:pt-0">
                      <button
                        onClick={() => openModal(req, "approve")}
                        className="flex-1 flex justify-center items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white px-4 py-3 rounded-xl font-semibold transition"
                      >
                        <CheckCircle size={18} /> Approve
                      </button>
                      <button
                        onClick={() => openModal(req, "reject")}
                        className="flex-1 flex justify-center items-center gap-2 bg-white hover:bg-red-50 text-red-600 border border-stone-200 hover:border-red-200 px-4 py-3 rounded-xl font-semibold transition"
                      >
                        <XCircle size={18} /> Decline
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
              onClick={closeModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden z-10"
            >
              <div className="p-6 sm:p-8">
                <div
                  className={`w-12 h-12 rounded-full mb-5 flex items-center justify-center ${
                    modalAction === "approve"
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {modalAction === "approve" ? (
                    <CheckCircle size={24} />
                  ) : (
                    <AlertCircle size={24} />
                  )}
                </div>

                <h3 className="text-xl font-bold text-stone-900 mb-2">
                  {modalAction === "approve"
                    ? "Approve Request?"
                    : "Decline Request?"}
                </h3>

                <p className="text-sm text-stone-500 mb-6">
                  {modalAction === "approve"
                    ? activeModal.type === "cancel"
                      ? "This will permanently mark the booking as cancelled and open up capacity."
                      : "This will move the guest to their newly requested time slot and update their booking."
                    : "This will keep the booking as-is and mark the request as rejected."}
                </p>

                {modalAction === "approve" && activeModal.type === "cancel" && (
                  <div className="mb-6 bg-stone-50 border border-stone-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <CreditCard size={18} className="text-[#8b6f47]" />
                        <h4 className="font-bold text-stone-900 text-sm">
                          Money Refund Action
                        </h4>
                      </div>
                      <strong className="capitalize text-[10px] uppercase tracking-widest text-stone-800 bg-white px-2 py-0.5 rounded shadow-sm border border-stone-200">
                        {activeModal.cancellationPolicy || "Moderate"}
                      </strong>
                    </div>

                    <p className="text-xs text-stone-500 mb-4 italic pb-3 border-b border-stone-200">
                      Requested{" "}
                      <strong>
                        {hoursBeforeEvent
                          ? Math.floor(hoursBeforeEvent / 24)
                          : 0}{" "}
                        days,{" "}
                        {hoursBeforeEvent
                          ? Math.floor(hoursBeforeEvent % 24)
                          : 0}{" "}
                        hours
                      </strong>{" "}
                      before event start.
                    </p>

                    <div className="space-y-4">
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative flex items-center justify-center mt-0.5">
                          <input
                            type="radio"
                            name="refundOption"
                            value="full"
                            checked={refundOption === "full"}
                            onChange={(e) => setRefundOption(e.target.value)}
                            className="peer appearance-none w-5 h-5 border-2 border-stone-300 rounded-full checked:border-[#8b6f47] transition-all"
                          />
                          <div className="absolute w-2.5 h-2.5 rounded-full bg-[#8b6f47] opacity-0 peer-checked:opacity-100 transition-all" />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-stone-800 group-hover:text-stone-900 flex items-center gap-2">
                            Issue Full Refund (100%)
                            {recommendedRefund === "full" && (
                              <span className="bg-emerald-100 text-emerald-700 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-sm">
                                Recommended
                              </span>
                            )}
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative flex items-center justify-center mt-0.5">
                          <input
                            type="radio"
                            name="refundOption"
                            value="partial"
                            checked={refundOption === "partial"}
                            onChange={(e) => setRefundOption(e.target.value)}
                            className="peer appearance-none w-5 h-5 border-2 border-stone-300 rounded-full checked:border-[#8b6f47] transition-all"
                          />
                          <div className="absolute w-2.5 h-2.5 rounded-full bg-[#8b6f47] opacity-0 peer-checked:opacity-100 transition-all" />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-stone-800 group-hover:text-stone-900 flex items-center gap-2">
                            Issue Partial Refund (50%)
                            {recommendedRefund === "partial" && (
                              <span className="bg-emerald-100 text-emerald-700 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-sm">
                                Recommended
                              </span>
                            )}
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative flex items-center justify-center mt-0.5">
                          <input
                            type="radio"
                            name="refundOption"
                            value="none"
                            checked={refundOption === "none"}
                            onChange={(e) => setRefundOption(e.target.value)}
                            className="peer appearance-none w-5 h-5 border-2 border-stone-300 rounded-full checked:border-[#8b6f47] transition-all"
                          />
                          <div className="absolute w-2.5 h-2.5 rounded-full bg-[#8b6f47] opacity-0 peer-checked:opacity-100 transition-all" />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-stone-800 group-hover:text-stone-900 flex items-center gap-2">
                            No Refund (0%)
                            {recommendedRefund === "none" && (
                              <span className="bg-emerald-100 text-emerald-700 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-sm">
                                Recommended
                              </span>
                            )}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {modalAction === "approve" &&
                  activeModal.type === "reschedule" &&
                  activeModal.availableSlots !== null &&
                  activeModal.availableSlots < activeModal.totalGuests && (
                    <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm flex items-start gap-2">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      <div>
                        <strong className="block mb-1">
                          Overbooking Warning
                        </strong>
                        Approving this will overbook the schedule. The guest
                        needs {activeModal.totalGuests} spots, but only{" "}
                        {activeModal.availableSlots} are left.
                      </div>
                    </div>
                  )}

                <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                  Internal Admin Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Leave a note for other staff members regarding this decision..."
                  className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30 focus:border-[#8b6f47] resize-none"
                />
              </div>

              <div className="p-5 border-t border-stone-100 bg-stone-50 flex gap-3">
                <button
                  onClick={closeModal}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-stone-600 hover:bg-stone-200 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProcessRequest}
                  disabled={isProcessing}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-semibold text-white flex justify-center items-center gap-2 transition disabled:opacity-50 ${
                    modalAction === "approve"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {isProcessing ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : modalAction === "approve" ? (
                    <CheckCircle size={16} />
                  ) : (
                    <XCircle size={16} />
                  )}
                  Confirm {modalAction === "approve" ? "Approval" : "Decline"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
