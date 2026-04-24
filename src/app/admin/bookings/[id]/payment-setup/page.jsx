"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { loadStripeTerminal } from "@stripe/terminal-js";
import {
  ArrowLeft,
  CreditCard,
  Banknote,
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
  Check,
  Wifi,
  Smartphone,
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

  // --- STRIPE TERMINAL STATE ---
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminal, setTerminal] = useState(null);
  const terminalRef = useRef(null); // Prevents duplicate instances in React 18 Strict Mode
  const [readers, setReaders] = useState([]);
  const [connectedReader, setConnectedReader] = useState(null);
  // 'idle' | 'discovering' | 'connecting' | 'connected' | 'collecting' | 'processing'
  const [terminalStatus, setTerminalStatus] = useState("idle");

  const fetchBooking = async () => {
    try {
      const res = await fetch(`/api/admin/reservations/${id}`);
      const data = await res.json();
      const item = data.item;
      setBooking(item);

      const existingLink =
        item?.stripeSessionUrl || item?.payments?.stripeSessionUrl;
      if (existingLink) setPaymentLink(existingLink);
    } catch (e) {
      toast.error("Failed to load booking details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooking();
  }, [id]);

  // --- INITIALIZE STRIPE TERMINAL ---
  useEffect(() => {
    // If the terminal is already initialized (e.g., from a Strict Mode re-render), abort
    if (terminalRef.current) return;

    const initTerminal = async () => {
      try {
        const StripeTerminal = await loadStripeTerminal();
        if (!StripeTerminal) return;

        const terminalInstance = StripeTerminal.create({
          onFetchConnectionToken: async () => {
            const res = await fetch("/api/stripe/terminal/connection-token", {
              method: "POST",
            });
            const data = await res.json();
            return data.secret;
          },
          onUnexpectedReaderDisconnect: () => {
            toast.error("Reader disconnected unexpectedly.");
            setConnectedReader(null);
            setTerminalStatus("idle");
          },
          onConnectionStatusChange: (event) => {
            if (event.status === "not_connected") {
              setConnectedReader(null);
              setTerminalStatus("idle");
            }
          },
        });

        terminalRef.current = terminalInstance;
        setTerminal(terminalInstance);
      } catch (err) {
        console.error("Failed to initialize Stripe Terminal", err);
      }
    };
    initTerminal();
  }, []);

  const discoverReaders = async () => {
    if (!terminal) return toast.error("Terminal SDK not loaded");
    setTerminalStatus("discovering");
    setReaders([]);

    // Note: simulated: true is used for testing. Change to false in production!
    const discoverResult = await terminal.discoverReaders({ simulated: true });

    if (discoverResult.error) {
      toast.error(discoverResult.error.message);
      setTerminalStatus("idle");
    } else {
      setReaders(discoverResult.discoveredReaders);
      setTerminalStatus("idle");
    }
  };

  const connectReader = async (reader) => {
    setTerminalStatus("connecting");
    const connectResult = await terminal.connectReader(reader);

    if (connectResult.error) {
      toast.error(connectResult.error.message);
      setTerminalStatus("idle");
    } else {
      setConnectedReader(connectResult.reader);
      setTerminalStatus("connected");
      toast.success(`Connected to ${reader.label || reader.serial_number}`);
    }
  };

  const handleTerminalCharge = async () => {
    if (!terminal) return;

    // Strict check to ensure the connection hasn't dropped before charging
    if (terminal.getConnectionStatus() !== "connected") {
      toast.error("Reader is not connected. Please connect a reader first.");
      setConnectedReader(null);
      setTerminalStatus("idle");
      return;
    }

    try {
      // 1. Create Payment Intent specifically for Terminal
      setTerminalStatus("collecting");
      const intentRes = await fetch(
        `/api/admin/reservations/${id}/terminal-intent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: balanceToPay }),
        },
      );
      const { clientSecret, paymentIntentId } = await intentRes.json();

      // 2. Wait for guest to tap/insert card on the physical reader
      const collectResult = await terminal.collectPaymentMethod(clientSecret);
      if (collectResult.error) throw new Error(collectResult.error.message);

      // 3. Process the payment
      setTerminalStatus("processing");
      const processResult = await terminal.processPayment(
        collectResult.paymentIntent,
      );
      if (processResult.error) throw new Error(processResult.error.message);

      // 4. Tell the backend to capture the funds and mark booking as paid
      const captureRes = await fetch(
        `/api/admin/reservations/${id}/terminal-capture`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId }),
        },
      );

      if (!captureRes.ok)
        throw new Error("Failed to capture payment on server.");

      toast.success("Card read and charged successfully!");
      setTerminalStatus("connected");
      fetchBooking();
    } catch (err) {
      toast.error(err.message || "Terminal charge failed");
      setTerminalStatus("connected"); // Reset to connected so they can try again
    }
  };

  // --- EXISTING ACTIONS (Link & Cash) ---
  const generateStripeLink = async () => {
    if (paymentLink) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/reservations/${id}/generate-payment-link`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate link");
      setPaymentLink(data.url);
      toast.success("Payment link generated");
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
          body: JSON.stringify({
            paymentLink,
            amountDue: balanceToPay,
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to send email");
      toast.success("Branded payment request sent");
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
        body: JSON.stringify({ method, amount: balanceToPay }),
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

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdfcfb]">
        <Loader2 className="animate-spin text-[#a3845b]" size={32} />
      </div>
    );

  // --- DERIVED DATA ---
  const guestName =
    booking?.guest?.name || booking?.primary_contact?.firstName || "Guest";
  const aCount = booking?.counts?.adults || 1;
  const kCount = booking?.counts?.kids || 0;
  const aPrice = booking?.unitPrices?.adult || 0;
  const kPrice = booking?.unitPrices?.kid || 0;
  const discount = booking?.discountAmount || 0;
  const calculatedTotal = Math.max(
    0,
    aCount * aPrice + kCount * kPrice - discount,
  );

  const totalAmount =
    booking?.money?.totalAmount > 0
      ? booking.money.totalAmount
      : calculatedTotal;
  const totalPaid = booking?.money?.totalPaidAmount || 0;
  const currency = booking?.money?.currency || "EUR";

  const balanceToPay = Math.max(0, totalAmount - totalPaid);
  const isFullyPaid = totalAmount > 0 && balanceToPay === 0;

  const formattedBalance = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(balanceToPay);
  const formattedTotal = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(totalAmount);
  const formattedPaid = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(totalPaid);

  return (
    <main className="min-h-screen bg-[#fdfcfb] text-[#2f2f2f] pb-20">
      {/* Background Accent */}
      <div className="fixed top-0 left-0 w-full h-[500px] bg-[radial-gradient(ellipse_at_top,#f4f1ec,transparent)] pointer-events-none" />

      {/* Sticky Header */}
      <div className="sticky top-0 z-30 border-b border-[#e3ddd2] bg-white/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center w-10 h-10 rounded-full border border-[#e3ddd2] bg-white hover:bg-[#f4f1ec] transition-all shadow-sm"
            >
              <ArrowLeft size={18} className="text-[#3f3127]" />
            </button>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#a09084]">
                Financials
              </p>
              <h1 className="text-xl font-serif text-[#3f3127]">
                Payment Provisioning
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* --- SIDEBAR SUMMARY --- */}
          <div className="lg:col-span-4 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-[2rem] border p-8 shadow-sm transition-colors ${
                isFullyPaid
                  ? "bg-emerald-50 border-emerald-100"
                  : "bg-white border-[#e3ddd2]"
              }`}
            >
              <h3
                className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-6 ${isFullyPaid ? "text-emerald-700" : "text-[#a09084]"}`}
              >
                {isFullyPaid ? "Fully Paid" : "Balance Due"}
              </h3>
              <div
                className={`text-5xl font-serif mb-4 tracking-tighter ${isFullyPaid ? "text-emerald-700" : "text-[#a3845b]"}`}
              >
                {isFullyPaid ? (
                  <span className="flex items-center gap-3">
                    <Check size={40} /> €0.00
                  </span>
                ) : (
                  formattedBalance
                )}
              </div>
              <div
                className={`space-y-3 pt-6 border-t ${isFullyPaid ? "border-emerald-200/50" : "border-[#e3ddd2]"}`}
              >
                <div className="flex justify-between text-sm">
                  <span
                    className={
                      isFullyPaid ? "text-emerald-800/60" : "text-[#7a6a5f]"
                    }
                  >
                    Guest Name
                  </span>
                  <span className="font-medium text-right">{guestName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span
                    className={
                      isFullyPaid ? "text-emerald-800/60" : "text-[#7a6a5f]"
                    }
                  >
                    Booking Ref
                  </span>
                  <span className="font-mono font-bold">
                    {booking?.code || `#${id}`}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* --- ACTION PANELS --- */}
          <div className="lg:col-span-8 space-y-6">
            {isFullyPaid && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 z-20 rounded-[2.5rem] bg-white/50 backdrop-blur-sm flex items-center justify-center"
              >
                <div className="bg-white px-8 py-4 rounded-full shadow-lg border border-[#e3ddd2] flex items-center gap-3 text-emerald-700 font-medium">
                  <CheckCircle2 size={20} /> This booking requires no further
                  payment.
                </div>
              </motion.div>
            )}

            <div
              className={
                isFullyPaid || totalAmount === 0
                  ? "opacity-50 pointer-events-none"
                  : ""
              }
            >
              {/* OPTION 1: DIGITAL STRIPE REQUEST (Unchanged) */}
              <motion.div className="rounded-[2.5rem] border border-[#e3ddd2] bg-white shadow-sm overflow-hidden mb-6">
                <div className="px-10 py-8 border-b border-[#e3ddd2] flex items-center justify-between bg-[#faf9f7]">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                      <LinkIcon size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-serif text-[#3f3127]">
                        Digital Request
                      </h3>
                      <p className="text-xs text-[#7a6a5f]">
                        Secure remote checkout link
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-10">
                  <AnimatePresence mode="wait">
                    {!paymentLink ? (
                      <motion.div
                        key="gen"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <button
                          onClick={generateStripeLink}
                          disabled={submitting}
                          className="flex items-center gap-3 rounded-full bg-[#1a1a1a] text-white px-8 py-3.5 text-xs font-bold uppercase tracking-widest hover:bg-black transition-all"
                        >
                          {submitting ? (
                            <Loader2 className="animate-spin" size={16} />
                          ) : (
                            <Zap size={16} />
                          )}{" "}
                          Generate Link
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="active"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-4"
                      >
                        <div className="relative group">
                          <input
                            readOnly
                            value={paymentLink}
                            className="w-full bg-[#f4f1ec] border border-[#e3ddd2] rounded-2xl px-6 py-4 text-xs font-mono text-[#3f3127] outline-none pr-16"
                          />
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={emailLinkToClient}
                            className="flex-1 inline-flex items-center justify-center gap-3 rounded-2xl border border-[#e3ddd2] bg-white px-6 py-4 text-xs font-bold uppercase tracking-widest hover:bg-[#faf9f7] transition-all"
                          >
                            <Mail size={18} /> Email to Client
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* OPTION 2: PHYSICAL STRIPE TERMINAL */}
              <motion.div className="rounded-[2.5rem] border border-[#e3ddd2] bg-white shadow-sm overflow-hidden mb-6">
                <div className="px-10 py-8 border-b border-[#e3ddd2] flex items-center justify-between bg-[#faf9f7]">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
                      <CreditCard size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-serif text-[#3f3127]">
                        Physical Card Reader
                      </h3>
                      <p className="text-xs text-[#7a6a5f]">
                        Tap, Insert, or Swipe via Stripe Terminal
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowTerminal(!showTerminal)}
                    className="text-xs font-bold text-[#a3845b] uppercase tracking-widest hover:text-[#8b6f47]"
                  >
                    {showTerminal ? "Close" : "Expand"}
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
                      <div className="p-10 space-y-8">
                        {/* Not Connected State */}
                        {!connectedReader ? (
                          <div className="space-y-6">
                            <button
                              onClick={discoverReaders}
                              disabled={terminalStatus === "discovering"}
                              className="flex items-center gap-3 rounded-full bg-purple-600 text-white px-8 py-3.5 text-xs font-bold uppercase tracking-widest hover:bg-purple-700 transition-all shadow-lg shadow-purple-500/20"
                            >
                              {terminalStatus === "discovering" ? (
                                <Loader2 className="animate-spin" size={16} />
                              ) : (
                                <Wifi size={16} />
                              )}
                              {terminalStatus === "discovering"
                                ? "Scanning..."
                                : "Scan for Nearby Readers"}
                            </button>

                            {readers.length > 0 && (
                              <div className="grid grid-cols-1 gap-3">
                                <p className="text-xs font-bold uppercase tracking-widest text-[#a09084] mb-2">
                                  Available Readers
                                </p>
                                {readers.map((r, i) => (
                                  <button
                                    key={i}
                                    onClick={() => connectReader(r)}
                                    className="flex items-center justify-between p-4 rounded-2xl border border-[#e3ddd2] hover:border-purple-500 hover:bg-purple-50 transition-all text-left group"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Smartphone
                                        className="text-[#a09084] group-hover:text-purple-600 transition-colors"
                                        size={20}
                                      />
                                      <div>
                                        <p className="text-sm font-medium text-[#3f3127]">
                                          {r.label || "Stripe Reader"}
                                        </p>
                                        <p className="text-xs text-[#a09084] font-mono">
                                          {r.serial_number}
                                        </p>
                                      </div>
                                    </div>
                                    <span className="text-xs font-bold text-purple-600 uppercase tracking-widest">
                                      Connect
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Connected State */
                          <div className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-800">
                              <div className="flex items-center gap-3">
                                <CheckCircle2
                                  size={20}
                                  className="text-emerald-600"
                                />
                                <div>
                                  <p className="text-sm font-medium">
                                    Connected to{" "}
                                    {connectedReader.label || "Reader"}
                                  </p>
                                  <p className="text-xs opacity-70">
                                    Ready to accept payments
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  terminal.disconnectReader();
                                  setConnectedReader(null);
                                }}
                                className="text-xs font-bold text-emerald-700 uppercase hover:underline"
                              >
                                Disconnect
                              </button>
                            </div>

                            <button
                              onClick={handleTerminalCharge}
                              disabled={
                                terminalStatus === "collecting" ||
                                terminalStatus === "processing"
                              }
                              className="w-full flex items-center justify-center gap-3 rounded-full bg-[#1a1a1a] text-white py-4 text-xs font-bold uppercase tracking-widest hover:bg-black transition-all disabled:opacity-70"
                            >
                              {terminalStatus === "collecting" ||
                              terminalStatus === "processing" ? (
                                <Loader2 className="animate-spin" size={18} />
                              ) : (
                                <ShieldCheck size={18} />
                              )}
                              {terminalStatus === "collecting"
                                ? "Waiting for Guest to Tap/Insert..."
                                : terminalStatus === "processing"
                                  ? "Processing with Bank..."
                                  : `Push ${formattedBalance} to Reader`}
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* OPTION 3: OFFLINE SETTLEMENT */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-[2.5rem] border border-[#e3ddd2] bg-white shadow-sm overflow-hidden"
              >
                <div className="px-10 py-8 border-b border-[#e3ddd2] flex items-center gap-4 bg-[#faf9f7]">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <Banknote size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif text-[#3f3127]">
                      Offline Settlement
                    </h3>
                    <p className="text-xs text-[#7a6a5f]">
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
                      className="flex items-center gap-5 p-6 rounded-3xl border border-[#e3ddd2] bg-white hover:border-[#a3845b] hover:shadow-md transition-all group disabled:opacity-50 text-left"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#f4f1ec] flex items-center justify-center text-[#7a6a5f] group-hover:bg-[#a3845b]/10 group-hover:text-[#a3845b] transition-all shrink-0">
                        <item.icon size={22} />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-[#3f3127]">
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
