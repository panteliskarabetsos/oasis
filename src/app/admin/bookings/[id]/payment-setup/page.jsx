"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CreditCard,
  Banknote,
  Send,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Link as LinkIcon,
  Copy,
  Mail,
  ShieldCheck,
  ExternalLink,
  Wallet,
  Zap,
  Lock,
  RefreshCw,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

export default function PaymentSetupPage() {
  const router = useRouter();
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [paymentLink, setPaymentLink] = useState(null);

  // Manual Card Charge State
  const [showTerminal, setShowTerminal] = useState(false);
  const [cardData, setCardData] = useState({
    number: "",
    expMonth: "",
    expYear: "",
    cvc: "",
  });

  // Fetch Booking Data
  const fetchBooking = async () => {
    try {
      const res = await fetch(`/api/admin/reservations/${id}`);
      const data = await res.json();
      const item = data.item;
      setBooking(item);

      // If a Stripe session URL already exists in the DB, load it automatically
      // Check both the specific column and the nested payments object
      const existingLink =
        item?.stripeSessionUrl || item?.payments?.stripeSessionUrl;
      if (existingLink) {
        setPaymentLink(existingLink);
      }
    } catch (e) {
      toast.error("Failed to load booking details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooking();
  }, [id]);

  const generateStripeLink = async () => {
    if (paymentLink) return; // Guard clause

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/reservations/${id}/generate-payment-link`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate link");

      setPaymentLink(data.url);
      toast.success("Payment link generated and saved");

      // Refresh booking data to ensure balance and status are in sync
      fetchBooking();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const emailLinkToClient = async () => {
    setSendingEmail(true);
    try {
      const res = await fetch(
        `/api/admin/reservations/${id}/send-payment-email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentLink }),
        },
      );
      if (!res.ok) throw new Error("Failed to send email");
      toast.success("Branded payment request sent to client");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSendingEmail(false);
    }
  };

  const logManualPayment = async (method) => {
    if (!window.confirm(`Confirm manual settlement via ${method}?`)) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/reservations/${id}/manual-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          amount: balanceToPay,
        }),
      });
      if (!res.ok) throw new Error("Failed to log payment");
      toast.success("Manual payment recorded");
      router.push(`/admin/bookings/${id}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualCharge = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/reservations/${id}/manual-charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cardData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Charge failed");
      toast.success("Card charged successfully!");
      router.push(`/admin/bookings/${id}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f3ee]">
        <Loader2 className="animate-spin text-[#a3845b]" size={32} />
      </div>
    );

  // --- DERIVED DATA ---
  const guestName =
    booking?.guest?.name || booking?.primary_contact?.firstName || "Guest";
  const totalAmount = booking?.money?.totalAmount || 0;
  const totalPaid = booking?.money?.totalPaidAmount || 0;
  const balanceToPay = Math.max(0, totalAmount - totalPaid);
  const currency = booking?.money?.currency || "EUR";

  const formattedBalance = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency,
  }).format(balanceToPay);

  const formattedTotal = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency,
  }).format(totalAmount);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6f3ee,transparent_30%),radial-gradient(800px_400px_at_10%_-20%,#f0eadf,transparent)] text-[#2f2f2f] transition-colors duration-500 pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 border-b border-black/5 bg-white/70 backdrop-blur-md px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center w-10 h-10 rounded-full border border-black/10 bg-white hover:bg-black/5 transition-all shadow-sm"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">
                Financials
              </p>
              <h1 className="text-xl font-serif font-medium">
                Payment Provisioning
              </h1>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
            <ShieldCheck size={14} /> Secure Admin Access
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* --- SIDEBAR SUMMARY --- */}
          <div className="lg:col-span-4 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[2rem] border border-black/5 bg-white p-8 shadow-sm"
            >
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40 mb-6">
                Balance Due
              </h3>
              <div className="text-5xl font-serif text-[#a3845b] mb-4 tracking-tighter">
                {formattedBalance}
              </div>

              <div className="space-y-3 pt-6 border-t border-black/5">
                <div className="flex justify-between text-sm">
                  <span className="opacity-50">Guest Name</span>
                  <span className="font-medium text-right">{guestName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="opacity-50">Booking Ref</span>
                  <span className="font-mono font-bold text-[#a3845b]">
                    {booking?.code || `#${id}`}
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-black/5">
                  <span className="opacity-50">Total Price</span>
                  <span className="font-medium">{formattedTotal}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="opacity-50">Already Paid</span>
                  <span className="font-medium text-emerald-600">
                    {new Intl.NumberFormat("en-GB", {
                      style: "currency",
                      currency,
                    }).format(totalPaid)}
                  </span>
                </div>
              </div>
            </motion.div>

            <div className="rounded-2xl bg-amber-500/5 border border-amber-500/10 p-5">
              <div className="flex gap-4">
                <AlertCircle className="text-amber-600 shrink-0" size={20} />
                <p className="text-xs leading-relaxed text-amber-800/80 font-medium">
                  {paymentLink
                    ? "A digital link is active. If the guest pays via this link, the balance above will update automatically."
                    : "No payment intent found. Use the panels to the right to resolve this balance."}
                </p>
              </div>
            </div>
          </div>

          {/* --- ACTION PANELS --- */}
          <div className="lg:col-span-8 space-y-6">
            {/* OPTION 1: DIGITAL STRIPE REQUEST */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-[2.5rem] border border-black/5 bg-white/80 backdrop-blur-xl overflow-hidden shadow-sm"
            >
              <div className="px-10 py-8 border-b border-black/5 flex items-center justify-between bg-black/[0.01]">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                    <LinkIcon size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif text-black/90">
                      Digital Request
                    </h3>
                    <p className="text-xs text-black/40">
                      Secure Stripe payment session
                    </p>
                  </div>
                </div>
                {paymentLink && (
                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider border border-emerald-100">
                    Active
                  </span>
                )}
              </div>

              <div className="p-10">
                <AnimatePresence mode="wait">
                  {!paymentLink ? (
                    <motion.div
                      key="gen"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="max-w-md"
                    >
                      <p className="text-[15px] leading-relaxed text-black/60 mb-8 font-light">
                        Generate a hosted checkout session. This allows{" "}
                        <strong>{guestName}</strong> to pay securely via Credit
                        Card, Apple Pay, or Google Pay.
                      </p>
                      <button
                        onClick={generateStripeLink}
                        disabled={submitting}
                        className="flex items-center gap-4 rounded-full bg-[#2f2f2f] text-white px-8 py-3 text-xs font-bold uppercase tracking-widest hover:bg-black transition-all shadow-md"
                      >
                        {submitting ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <Zap size={16} />
                        )}{" "}
                        Generate Secure Link
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="active"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-6"
                    >
                      <p className="text-sm text-black/60">
                        An active payment link exists for this booking. You can
                        copy it manually or send a branded email request.
                      </p>
                      <div className="relative group">
                        <input
                          readOnly
                          value={paymentLink}
                          className="w-full bg-black/5 border border-black/5 rounded-2xl px-6 py-4 text-xs font-mono text-black/60 outline-none pr-16 focus:bg-white focus:border-[#a3845b] transition-all"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(paymentLink);
                            toast.success("Copied to clipboard");
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-3 text-[#a3845b] hover:bg-black/5 rounded-xl transition-all"
                        >
                          <Copy size={20} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={emailLinkToClient}
                          disabled={sendingEmail}
                          className="flex-1 inline-flex items-center justify-center gap-3 rounded-2xl border border-black/10 px-6 py-4 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all disabled:opacity-50"
                        >
                          {sendingEmail ? (
                            <Loader2 className="animate-spin" size={18} />
                          ) : (
                            <Mail size={18} />
                          )}
                          {sendingEmail ? "Sending..." : "Email to Client"}
                        </button>
                        <a
                          href={paymentLink}
                          target="_blank"
                          className="flex-1 inline-flex items-center justify-center gap-3 rounded-2xl bg-[#a3845b] text-white px-6 py-4 text-xs font-bold uppercase tracking-widest hover:bg-[#b79266] transition-all"
                        >
                          Open Checkout <ExternalLink size={18} />
                        </a>
                      </div>

                      <div className="pt-4 border-t border-black/5 flex justify-between items-center">
                        <p className="text-[10px] text-black/40 italic">
                          Only one active link is permitted per booking.
                        </p>
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                "This will overwrite the current link. Proceed?",
                              )
                            )
                              setPaymentLink(null);
                          }}
                          className="text-[10px] font-bold text-red-400 hover:text-red-600 uppercase tracking-wider flex items-center gap-1 transition-colors"
                        >
                          <RefreshCw size={10} /> Reset & Regenerate
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* OPTION 2: VIRTUAL TERMINAL */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-[2.5rem] border border-black/5 bg-white/80 backdrop-blur-xl overflow-hidden shadow-sm"
            >
              <div className="px-10 py-8 border-b border-black/5 flex items-center justify-between bg-black/[0.01]">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-600">
                    <CreditCard size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif text-black/90">
                      Virtual Terminal
                    </h3>
                    <p className="text-xs text-black/40">
                      Process a card for {formattedBalance}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTerminal(!showTerminal)}
                  className="text-xs font-bold text-[#a3845b] uppercase tracking-widest hover:underline transition-all"
                >
                  {showTerminal ? "Hide Form" : "Expand Form"}
                </button>
              </div>
              <AnimatePresence>
                {showTerminal && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <form
                      onSubmit={handleManualCharge}
                      className="p-10 space-y-6"
                    >
                      <div className="grid grid-cols-1 gap-4">
                        <label className="block">
                          <span className="text-[10px] font-bold uppercase text-black/40 ml-1">
                            Card Number
                          </span>
                          <input
                            required
                            placeholder="**** **** **** ****"
                            className="w-full mt-1 bg-black/5 border-none rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-[#a3845b]/20 transition-all"
                            onChange={(e) =>
                              setCardData({
                                ...cardData,
                                number: e.target.value,
                              })
                            }
                          />
                        </label>
                        <div className="grid grid-cols-3 gap-4">
                          <input
                            required
                            placeholder="MM"
                            className="bg-black/5 border-none rounded-xl px-4 py-3 text-sm text-center"
                            onChange={(e) =>
                              setCardData({
                                ...cardData,
                                expMonth: e.target.value,
                              })
                            }
                          />
                          <input
                            required
                            placeholder="YYYY"
                            className="bg-black/5 border-none rounded-xl px-4 py-3 text-sm text-center"
                            onChange={(e) =>
                              setCardData({
                                ...cardData,
                                expYear: e.target.value,
                              })
                            }
                          />
                          <input
                            required
                            placeholder="CVC"
                            className="bg-black/5 border-none rounded-xl px-4 py-3 text-sm text-center"
                            onChange={(e) =>
                              setCardData({ ...cardData, cvc: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl flex gap-3 items-start">
                        <Lock size={16} className="text-purple-600 mt-0.5" />
                        <p className="text-[11px] text-purple-800 leading-relaxed">
                          Processed via Stripe MOTO. Ensure you have explicit
                          authorization from the cardholder before proceeding.
                        </p>
                      </div>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full flex items-center justify-center gap-3 rounded-full bg-purple-600 text-white py-4 text-xs font-bold uppercase tracking-widest hover:bg-purple-700 transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20"
                      >
                        {submitting ? (
                          <Loader2 className="animate-spin" size={18} />
                        ) : (
                          <ShieldCheck size={18} />
                        )}
                        Execute Payment
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* OPTION 3: OFFLINE SETTLEMENT */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-[2.5rem] border border-black/5 bg-white/80 backdrop-blur-xl overflow-hidden shadow-sm"
            >
              <div className="px-10 py-8 border-b border-black/5 flex items-center gap-4 bg-black/[0.01]">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                  <Banknote size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-serif text-black/90">
                    Offline Settlement
                  </h3>
                  <p className="text-xs text-black/40">
                    Record payment received outside the platform
                  </p>
                </div>
              </div>
              <div className="p-10 grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  {
                    label: "Bank Transfer",
                    icon: ShieldCheck,
                    method: "Bank Transfer",
                  },
                  { label: "Cash Settlement", icon: Wallet, method: "Cash" },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => logManualPayment(item.method)}
                    disabled={submitting}
                    className="flex items-center gap-6 p-6 rounded-3xl border border-black/5 bg-white hover:border-[#a3845b] hover:shadow-lg hover:shadow-[#a3845b]/5 transition-all group disabled:opacity-50"
                  >
                    <div className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center text-black/40 group-hover:bg-[#a3845b]/10 group-hover:text-[#a3845b] transition-all">
                      <item.icon size={22} />
                    </div>
                    <span className="text-sm font-bold uppercase tracking-widest">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </main>
  );
}
