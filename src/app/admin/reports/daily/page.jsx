"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  Wallet,
  CreditCard,
  Banknote,
  Calculator,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Loader2,
  ArrowRightLeft,
  RotateCcw,
  Printer,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

// Format helper
const fmtMoney = (n) => {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(Number(n) || 0);
};

export default function DailyReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Default to today (YYYY-MM-DD) safely
  const [selectedDate, setSelectedDate] = useState("");

  // Cash Drawer State
  const [countedCash, setCountedCash] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [printedAt, setPrintedAt] = useState("");

  // Fix Hydration: Only set dates once the component mounts on the client
  useEffect(() => {
    setMounted(true);
    setSelectedDate(new Date().toISOString().split("T")[0]);
    setPrintedAt(new Date().toLocaleString("en-GB"));
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchReport(selectedDate);
    }
  }, [selectedDate]);

  const fetchReport = async (date) => {
    setLoading(true);
    setIsVerified(false); // Reset verification when changing dates
    setCountedCash("");
    try {
      const res = await fetch(`/api/admin/reports/daily?date=${date}`);
      if (!res.ok) throw new Error("Failed to fetch report");
      const json = await res.json();
      setData(json);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = () => {
    if (countedCash === "")
      return toast.error("Please enter the counted cash amount.");
    setIsVerified(true);
    setPrintedAt(new Date().toLocaleString("en-GB")); // Stamp the exact verification time
    toast.success("Shift verified and balanced!");
  };

  const handlePrint = () => {
    window.print();
  };

  // Prevent rendering until client-side hydration is complete to avoid mismatch UI
  if (!mounted) return null;

  const summary = data?.summary || {};
  const expectedCash = summary.cash || 0;
  const actualCash = Number(countedCash) || 0;
  const discrepancy = actualCash - expectedCash;
  const isPerfect = discrepancy === 0 && countedCash !== "";

  return (
    <main className="min-h-screen bg-[#fdfcfb] text-[#3f3127] pb-24">
      {/* Background Accent */}
      <div className="fixed top-0 left-0 w-full h-[400px] bg-[radial-gradient(ellipse_at_top,#f4f1ec,transparent)] pointer-events-none print:hidden" />

      {/* Web UI Header */}
      <div className="sticky top-0 z-30 border-b border-[#e3ddd2] bg-white/80 backdrop-blur-md px-6 py-4 print:hidden">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center w-10 h-10 rounded-full border border-[#e3ddd2] bg-white hover:bg-[#f4f1ec] transition-all shadow-sm shrink-0"
            >
              <ArrowLeft size={18} className="text-[#3f3127]" />
            </button>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#a09084]">
                Financial Ledger
              </p>
              <h1 className="text-xl font-serif text-[#3f3127]">
                Daily Z-Report
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-[#fdfaf5] p-1.5 rounded-full border border-[#e3ddd2]">
            <label className="sr-only">Date</label>
            <div className="pl-3 text-[#8b6f47]">
              <Calendar size={18} />
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none text-sm font-semibold text-[#3f3127] outline-none pr-3 cursor-pointer"
            />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 relative z-10 print:hidden">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="animate-spin text-[#8b6f47]" size={40} />
          </div>
        ) : (
          <div className="space-y-8">
            {/* HERO: Net Total */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-8"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a09084] mb-3">
                Total Net Revenue
              </p>
              <h2 className="text-6xl sm:text-7xl font-serif text-[#2a1f18] tracking-tighter">
                {fmtMoney(summary.net_total)}
              </h2>
              <p className="text-sm text-[#7a6a5f] mt-4 flex items-center justify-center gap-2">
                <ArrowRightLeft size={14} />
                {data.raw_payments} Transactions · {data.raw_refunds} Refunds
              </p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT COLUMN: Cash Verification */}
              <div className="lg:col-span-5 space-y-6">
                <div className="rounded-[2rem] border border-[#e3ddd2] bg-white p-8 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                      <Wallet size={20} />
                    </div>
                    <h3 className="text-lg font-serif text-[#3f3127]">
                      Cash Drawer Close
                    </h3>
                  </div>

                  <div className="space-y-6">
                    <div className="flex justify-between items-center pb-4 border-b border-[#e3ddd2]">
                      <span className="text-sm font-semibold text-[#7a6a5f]">
                        Expected Cash
                      </span>
                      <span className="text-xl font-serif text-[#3f3127]">
                        {fmtMoney(expectedCash)}
                      </span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#a09084] mb-2">
                        Actual Counted Cash
                      </label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8b6f47]">
                          <Calculator size={20} />
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={countedCash}
                          onChange={(e) => setCountedCash(e.target.value)}
                          disabled={isVerified}
                          className="w-full bg-[#f4f1ec] border border-transparent rounded-2xl pl-12 pr-4 py-4 text-lg font-mono text-[#3f3127] focus:bg-white focus:border-[#8b6f47] outline-none transition-all disabled:opacity-50"
                        />
                      </div>
                    </div>

                    <AnimatePresence>
                      {countedCash !== "" && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          className="overflow-hidden"
                        >
                          <div
                            className={`p-4 rounded-xl flex items-start gap-3 mt-4 border ${
                              isPerfect
                                ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                                : "bg-rose-50 border-rose-100 text-rose-800"
                            }`}
                          >
                            {isPerfect ? (
                              <CheckCircle2
                                size={20}
                                className="shrink-0 text-emerald-600"
                              />
                            ) : (
                              <AlertCircle
                                size={20}
                                className="shrink-0 text-rose-600"
                              />
                            )}
                            <div>
                              <p className="font-bold text-sm">
                                {isPerfect
                                  ? "Drawer perfectly balanced!"
                                  : `Discrepancy: ${fmtMoney(Math.abs(discrepancy))}`}
                              </p>
                              <p className="text-xs opacity-80 mt-1">
                                {isPerfect
                                  ? "All expected cash is accounted for."
                                  : discrepancy > 0
                                    ? "You have MORE cash than the system expects. Did you forget to log a payment?"
                                    : "You are SHORT on cash. Did you give too much change or forget to record a refund?"}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {!isVerified ? (
                      <button
                        onClick={handleVerify}
                        className="w-full mt-2 rounded-full bg-[#1a1a1a] text-white py-4 text-xs font-bold uppercase tracking-widest hover:bg-black transition-all shadow-md"
                      >
                        Verify & Lock Drawer
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="w-full mt-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                          <CheckCircle2 size={16} /> Shift Verified
                        </div>
                        <button
                          onClick={handlePrint}
                          className="w-full rounded-full border border-[#e3ddd2] bg-white text-[#3f3127] py-4 text-xs font-bold uppercase tracking-widest hover:bg-[#fdfaf5] transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                          <Printer size={16} /> Print Official Z-Report
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Ledger Breakdown */}
              <div className="lg:col-span-7 space-y-4">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#a09084] mb-2 px-2">
                  System Breakdown
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Card / Stripe */}
                  <div className="rounded-3xl border border-[#e3ddd2] bg-white p-6 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                        <CreditCard size={18} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                        Online/Terminal
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[#7a6a5f] mb-1">
                      Card Payments
                    </p>
                    <p className="text-2xl font-serif text-[#3f3127]">
                      {fmtMoney(summary.card)}
                    </p>
                  </div>

                  {/* Bank Transfer */}
                  <div className="rounded-3xl border border-[#e3ddd2] bg-white p-6 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Banknote size={18} />
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-[#7a6a5f] mb-1">
                      Bank Transfers
                    </p>
                    <p className="text-2xl font-serif text-[#3f3127]">
                      {fmtMoney(summary.bank_transfer)}
                    </p>
                  </div>

                  {/* Other / Vouchers */}
                  <div className="rounded-3xl border border-[#e3ddd2] bg-white p-6 shadow-sm">
                    <p className="text-sm font-semibold text-[#7a6a5f] mb-1">
                      Other / Gift Cards
                    </p>
                    <p className="text-xl font-serif text-[#3f3127]">
                      {fmtMoney(summary.other)}
                    </p>
                  </div>

                  {/* Refunds */}
                  <div className="rounded-3xl border border-rose-100 bg-rose-50/50 p-6 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                        <RotateCcw size={18} />
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-rose-800/70 mb-1">
                      Refunds Issued
                    </p>
                    <p className="text-xl font-serif text-rose-700">
                      -{fmtMoney(summary.refunds)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --------------------------------------------------------- */}
      {/* PRINT OPTIMIZED LAYOUT (Hidden on screen, visible on print) */}
      {/* --------------------------------------------------------- */}
      <div className="hidden print:block p-8 font-mono text-black">
        <div className="text-center border-b-2 border-black pb-6 mb-6">
          <h1 className="text-2xl font-bold uppercase tracking-widest mb-2">
            END OF DAY Z-REPORT
          </h1>
          <p className="text-sm">Date of Record: {selectedDate}</p>
          <p className="text-xs mt-1 text-gray-500">Printed: {printedAt}</p>
        </div>

        <div className="space-y-2 mb-8">
          <h2 className="text-sm font-bold uppercase tracking-widest border-b border-gray-300 pb-2 mb-4">
            Ledger Summary
          </h2>
          <div className="flex justify-between">
            <span>Card / Online Payments:</span>
            <span>{fmtMoney(summary.card)}</span>
          </div>
          <div className="flex justify-between">
            <span>Bank Transfers:</span>
            <span>{fmtMoney(summary.bank_transfer)}</span>
          </div>
          <div className="flex justify-between">
            <span>Other / Gift Cards:</span>
            <span>{fmtMoney(summary.other)}</span>
          </div>
          <div className="flex justify-between text-red-600">
            <span>Refunds Issued:</span>
            <span>-{fmtMoney(summary.refunds)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg pt-4 mt-2 border-t border-gray-300">
            <span>SYSTEM NET TOTAL:</span>
            <span>{fmtMoney(summary.net_total)}</span>
          </div>
        </div>

        <div className="space-y-2 mb-12">
          <h2 className="text-sm font-bold uppercase tracking-widest border-b border-gray-300 pb-2 mb-4">
            Cash Drawer Audit
          </h2>
          <div className="flex justify-between">
            <span>Expected Cash (System):</span>
            <span>{fmtMoney(expectedCash)}</span>
          </div>
          <div className="flex justify-between">
            <span>Actual Counted Cash:</span>
            <span className="font-bold">{fmtMoney(actualCash)}</span>
          </div>
          <div className="flex justify-between pt-4 mt-2 border-t border-gray-300 font-bold">
            <span>CASH DISCREPANCY:</span>
            <span className={discrepancy < 0 ? "text-red-600" : ""}>
              {fmtMoney(discrepancy)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-12 mt-20 pt-8 border-t-2 border-black border-dashed">
          <div>
            <p className="text-xs uppercase tracking-widest mb-8">
              Prepared By (Signature)
            </p>
            <div className="border-b border-black w-full"></div>
            <p className="text-xs mt-2 text-gray-500">Admin / Manager</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest mb-8">
              Verified By (Signature)
            </p>
            <div className="border-b border-black w-full"></div>
            <p className="text-xs mt-2 text-gray-500">Finance / Accounting</p>
          </div>
        </div>

        <div className="text-center mt-12 text-[10px] text-gray-400">
          * Staple physical merchant batch receipts and drop in safe.
        </div>
      </div>
    </main>
  );
}
