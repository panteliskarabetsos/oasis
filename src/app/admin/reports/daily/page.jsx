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
  ChevronLeft,
  ChevronRight,
  History,
  Lock,
  Unlock,
  FileText,
  TrendingUp,
  ArrowDownRight,
  RefreshCw,
  BadgeEuro,
  ShieldCheck,
  Search,
  Download,
  ListChecks,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

const fmtMoney = (n) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(Number(n) || 0);

const todayISO = () => {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().split("T")[0];
};

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

export default function DailyReportPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [data, setData] = useState(null);

  const [selectedDate, setSelectedDate] = useState("");
  const [todayString, setTodayString] = useState("");

  const [openingFloat, setOpeningFloat] = useState("");
  const [cashDrops, setCashDrops] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [drawerNotes, setDrawerNotes] = useState("");

  const [isVerified, setIsVerified] = useState(false);
  const [printedAt, setPrintedAt] = useState("");

  useEffect(() => {
    const today = todayISO();
    setMounted(true);
    setTodayString(today);
    setSelectedDate(today);
    setPrintedAt(new Date().toLocaleString("en-GB"));
  }, []);

  useEffect(() => {
    if (selectedDate) fetchReport(selectedDate);
  }, [selectedDate]);

  const summary = data?.summary || {};
  const report = data?.report || null;
  const incomingRows = data?.payments || [];
  const outgoingRows = data?.refunds || [];

  const isHistorical =
    selectedDate && todayString && selectedDate !== todayString;

  const grossTotal = round2(summary.gross_total ?? 0);
  const netTotal = round2(summary.net_total ?? 0);
  const systemCash = round2(summary.cash ?? 0);

  const floatAmt = round2(openingFloat);
  const dropsAmt = round2(cashDrops);
  const actualCash = round2(countedCash);

  const expectedDrawer = round2(floatAmt + systemCash - dropsAmt);
  const discrepancy = round2(actualCash - expectedDrawer);

  const countedEntered = countedCash !== "";
  const isPerfect = countedEntered && discrepancy === 0;
  const isOver = countedEntered && discrepancy > 0;
  const isShort = countedEntered && discrepancy < 0;

  const canLock =
    !isVerified &&
    openingFloat !== "" &&
    countedCash !== "" &&
    (discrepancy === 0 || drawerNotes.trim().length > 0);

  const varianceLabel = isPerfect
    ? "Balanced"
    : isOver
      ? `Overage: +${fmtMoney(Math.abs(discrepancy))}`
      : isShort
        ? `Shortage: -${fmtMoney(Math.abs(discrepancy))}`
        : "Awaiting Count";

  const restoreReportState = (json) => {
    const saved = json?.report;

    setIsVerified(json?.locked === true || saved?.status === "locked");

    if (saved) {
      setOpeningFloat(String(saved.opening_float ?? ""));
      setCashDrops(String(saved.cash_drops ?? ""));
      setCountedCash(String(saved.counted_cash ?? ""));
      setDrawerNotes(saved.notes || "");
    } else {
      setOpeningFloat("");
      setCashDrops("");
      setCountedCash("");
      setDrawerNotes("");
    }
  };

  const fetchReport = async (date) => {
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/reports/daily?date=${date}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to fetch report");
      }

      setData(json);
      restoreReportState(json);
    } catch (e) {
      toast.error(e.message || "Failed to fetch report");
      setData(null);
      setIsVerified(false);
    } finally {
      setLoading(false);
    }
  };

  const changeDate = (days) => {
    if (!selectedDate || loading || locking || unlocking) return;

    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() + days);

    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const handleVerify = async () => {
    if (openingFloat === "")
      return toast.error("Please enter the Opening Float.");
    if (countedCash === "")
      return toast.error("Please enter the Actual Counted Cash.");

    if (discrepancy !== 0 && drawerNotes.trim() === "") {
      return toast.error(
        "A discrepancy exists. You must provide an audit note.",
      );
    }

    if (!window.confirm("Verify and permanently lock this Z-Report?")) return;

    setLocking(true);

    try {
      const res = await fetch("/api/admin/reports/daily/lock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          report_date: selectedDate,

          opening_float: floatAmt,
          cash_revenue: systemCash,
          cash_drops: dropsAmt,
          expected_drawer: expectedDrawer,
          counted_cash: actualCash,
          discrepancy,

          card_total: round2(summary.card),
          bank_transfer_total: round2(summary.bank_transfer),
          other_total: round2(summary.other),
          refund_total: round2(summary.refunds),
          net_total: netTotal,

          raw_payments: data?.raw_payments || 0,
          raw_refunds: data?.raw_refunds || 0,

          notes: drawerNotes.trim(),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to lock Z-Report");
      }

      setIsVerified(true);
      setPrintedAt(new Date().toLocaleString("en-GB"));
      toast.success("Z-Report verified and locked.");
      await fetchReport(selectedDate);
    } catch (e) {
      toast.error(e.message || "Failed to lock Z-Report");
    } finally {
      setLocking(false);
    }
  };

  const handleUnlock = async () => {
    const reason = window.prompt(
      "Enter unlock reason. This will be saved in the audit log.",
    );

    if (reason === null) return;
    if (!reason.trim()) return toast.error("Unlock reason is required.");
    if (!window.confirm("Unlock this Z-Report for corrections?")) return;

    setUnlocking(true);

    try {
      const res = await fetch("/api/admin/reports/daily/unlock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          report_date: selectedDate,
          reason: reason.trim(),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to unlock Z-Report");
      }

      setIsVerified(false);
      toast.success("Z-Report unlocked for corrections.");
      await fetchReport(selectedDate);
    } catch (e) {
      toast.error(e.message || "Failed to unlock Z-Report");
    } finally {
      setUnlocking(false);
    }
  };

  const handlePrint = async () => {
    try {
      setPrintedAt(new Date().toLocaleString("en-GB"));

      const url = `/api/admin/reports/daily/pdf?date=${selectedDate}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error("Failed to generate Z-Report PDF");
    }
  };
  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-[#fdfcfb] text-[#3f3127] pb-32">
      <div className="fixed top-0 left-0 w-full h-[400px] bg-[radial-gradient(ellipse_at_top,#f4f1ec,transparent)] pointer-events-none print:hidden" />

      <div className="sticky top-0 z-30 border-b border-[#e3ddd2] bg-white/80 backdrop-blur-md px-6 py-4 print:hidden shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center w-10 h-10 rounded-full border border-[#e3ddd2] bg-white hover:bg-[#f4f1ec] transition-all shadow-sm shrink-0"
            >
              <ArrowLeft size={18} />
            </button>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#a09084]">
                  Financial Ledger
                </p>

                {isHistorical && (
                  <span className="flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                    <History size={10} /> Historical
                  </span>
                )}

                {isVerified ? (
                  <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                    <Lock size={10} /> Locked
                  </span>
                ) : (
                  <span className="flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                    <Unlock size={10} /> Open
                  </span>
                )}
              </div>

              <h1 className="text-xl font-serif text-[#3f3127] font-semibold">
                End of Day Z-Report
              </h1>

              {report?.locked_at && (
                <p className="text-[11px] text-[#a09084] mt-0.5">
                  Locked at {new Date(report.locked_at).toLocaleString("en-GB")}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white p-1.5 rounded-full border border-[#e3ddd2] shadow-sm">
            <button
              onClick={() => changeDate(-1)}
              disabled={loading || locking || unlocking}
              className="p-1.5 hover:bg-[#f4f1ec] rounded-full text-[#7a6a5f] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex items-center gap-2 border-x border-[#e3ddd2] px-4">
              <Calendar size={16} className="text-[#8b6f47]" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                disabled={loading || locking || unlocking}
                className="bg-transparent border-none text-sm font-bold text-[#3f3127] outline-none cursor-pointer disabled:cursor-not-allowed"
              />
            </div>

            <button
              onClick={() => changeDate(1)}
              disabled={loading || locking || unlocking}
              className="p-1.5 hover:bg-[#f4f1ec] rounded-full text-[#7a6a5f] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={18} />
            </button>

            <button
              onClick={() => fetchReport(selectedDate)}
              disabled={loading || locking || unlocking}
              className="p-1.5 hover:bg-[#f4f1ec] rounded-full text-[#7a6a5f] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 relative z-10 print:hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-[#8b6f47]">
            <Loader2 className="animate-spin mb-4" size={40} />
            <p className="text-sm font-semibold animate-pulse uppercase tracking-widest text-[#a09084]">
              Compiling Ledger...
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <KpiCard
                label="Gross Revenue"
                value={fmtMoney(grossTotal)}
                icon={<TrendingUp size={30} className="text-emerald-600/20" />}
              />
              <KpiCard
                label="Net Revenue"
                value={fmtMoney(netTotal)}
                icon={<BadgeEuro size={30} className="text-[#8b6f47]/25" />}
              />
              <KpiCard
                label="Incoming"
                value={data?.raw_payments || 0}
                icon={<ArrowRightLeft size={30} className="text-blue-600/20" />}
              />
              <KpiCard
                label="Outgoing Refunds"
                value={fmtMoney(summary.refunds)}
                danger
                icon={<RotateCcw size={30} className="text-rose-600/20" />}
              />
            </div>

            <TransactionJournal
              incoming={incomingRows}
              outgoing={outgoingRows}
              locked={isVerified}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-5 space-y-6">
                <div className="rounded-[2rem] border border-[#e3ddd2] bg-white p-8 shadow-sm">
                  <div className="flex items-center gap-3 mb-6 border-b border-[#e3ddd2] pb-6">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-inner border border-amber-100">
                      <Wallet size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-serif text-[#3f3127] font-semibold">
                        Drawer Reconciliation
                      </h3>
                      <p className="text-xs text-[#a09084] uppercase tracking-wider font-bold">
                        Mandatory Audit
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <MoneyInput
                      label="Starting Float / Opening Cash"
                      value={openingFloat}
                      onChange={setOpeningFloat}
                      disabled={isVerified}
                      placeholder="e.g. 150.00"
                    />

                    <ReadonlyLine label="+ Cash Revenue" value={systemCash} />

                    <MoneyInput
                      label="- Cash Payouts / Safe Drops"
                      value={cashDrops}
                      onChange={setCashDrops}
                      disabled={isVerified}
                      placeholder="e.g. 50.00"
                    />

                    <div className="flex justify-between items-center bg-[#3f3127] text-white px-5 py-4 rounded-xl shadow-inner">
                      <span className="text-xs font-bold uppercase tracking-widest text-[#d8cfc3]">
                        = Expected in Drawer
                      </span>
                      <span className="text-xl font-mono font-bold">
                        {fmtMoney(expectedDrawer)}
                      </span>
                    </div>

                    <div className="pt-4 border-t border-[#e3ddd2]">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#a09084] mb-2 text-center">
                        Actual Counted Cash
                      </label>
                      <div className="relative max-w-xs mx-auto">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8b6f47]">
                          <Calculator size={20} />
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={countedCash}
                          onChange={(e) => setCountedCash(e.target.value)}
                          disabled={isVerified}
                          placeholder="0.00"
                          className="w-full bg-white border-2 border-[#8b6f47] rounded-2xl pl-12 pr-4 py-4 text-2xl text-center font-mono font-bold text-[#3f3127] focus:ring-4 focus:ring-[#8b6f47]/20 outline-none transition-all disabled:opacity-50 disabled:bg-[#f4f1ec] disabled:border-[#e3ddd2]"
                        />
                      </div>
                    </div>

                    <AnimatePresence>
                      {countedEntered && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div
                            className={`p-5 rounded-2xl flex items-start gap-4 border shadow-sm ${
                              isPerfect
                                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                                : isOver
                                  ? "bg-amber-50 border-amber-200 text-amber-900"
                                  : "bg-rose-50 border-rose-200 text-rose-900"
                            }`}
                          >
                            {isPerfect ? (
                              <CheckCircle2
                                size={24}
                                className="shrink-0 text-emerald-600"
                              />
                            ) : (
                              <AlertCircle
                                size={24}
                                className={
                                  isOver
                                    ? "shrink-0 text-amber-600"
                                    : "shrink-0 text-rose-600"
                                }
                              />
                            )}

                            <div>
                              <p className="font-bold text-base">
                                {varianceLabel}
                              </p>
                              <p className="text-xs opacity-80 mt-1 leading-relaxed">
                                {isPerfect
                                  ? "Drawer matches expected value."
                                  : isOver
                                    ? "More cash than expected. Add an audit note before locking."
                                    : "Less cash than expected. Add an audit note before locking."}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#a09084] mb-1 pl-1 flex items-center gap-2">
                        <FileText size={12} /> Audit Notes / Expenses
                      </label>
                      <textarea
                        rows={4}
                        value={drawerNotes}
                        onChange={(e) => setDrawerNotes(e.target.value)}
                        disabled={isVerified}
                        placeholder={
                          discrepancy !== 0
                            ? "Required: explain the cash variance..."
                            : "Optional notes regarding today's shift..."
                        }
                        className="w-full bg-[#fcfbf9] border border-[#e3ddd2] rounded-xl p-3 text-sm text-[#3f3127] focus:bg-white focus:ring-2 focus:ring-[#8b6f47]/30 outline-none transition-all disabled:opacity-50 resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 space-y-6">
                <TenderBreakdown
                  summary={summary}
                  grossTotal={grossTotal}
                  netTotal={netTotal}
                  isVerified={isVerified}
                />

                <div className="bg-white border border-[#e3ddd2] rounded-[2rem] p-6 shadow-sm">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-[#3f3127] mb-4">
                    Closure Checklist
                  </h3>

                  <div className="space-y-3">
                    <ChecklistItem
                      done={incomingRows.length + outgoingRows.length > 0}
                      label="Transaction journal reviewed"
                    />
                    <ChecklistItem
                      done={openingFloat !== ""}
                      label="Opening float entered"
                    />
                    <ChecklistItem
                      done={countedCash !== ""}
                      label="Actual counted cash entered"
                    />
                    <ChecklistItem
                      done={discrepancy === 0 || drawerNotes.trim().length > 0}
                      label="Variance explained when required"
                    />
                    <ChecklistItem done={isVerified} label="Z-Report locked" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ActionFooter
        isVerified={isVerified}
        unlocking={unlocking}
        locking={locking}
        canLock={canLock}
        handleUnlock={handleUnlock}
        handlePrint={handlePrint}
        handleVerify={handleVerify}
      />

      <PrintLayout
        selectedDate={selectedDate}
        printedAt={printedAt}
        isVerified={isVerified}
        report={report}
        summary={summary}
        grossTotal={grossTotal}
        netTotal={netTotal}
        floatAmt={floatAmt}
        systemCash={systemCash}
        dropsAmt={dropsAmt}
        expectedDrawer={expectedDrawer}
        actualCash={actualCash}
        discrepancy={discrepancy}
        drawerNotes={drawerNotes}
        incomingRows={incomingRows}
        outgoingRows={outgoingRows}
      />
    </main>
  );
}

function KpiCard({ label, value, icon, danger }) {
  return (
    <div className="bg-white border border-[#e3ddd2] rounded-2xl p-6 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#a09084] mb-1">
          {label}
        </p>
        <p
          className={`text-2xl font-serif font-bold ${
            danger ? "text-rose-700" : "text-[#2a1f18]"
          }`}
        >
          {value}
        </p>
      </div>
      {icon}
    </div>
  );
}

function TransactionJournal({ incoming, outgoing, locked }) {
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");

  const rows = [
    ...incoming.map((x) => ({ ...x, signedAmount: Number(x.amount) || 0 })),
    ...outgoing.map((x) => ({
      ...x,
      signedAmount: -(Number(x.amount) || 0),
    })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const filtered = rows.filter((r) => {
    const tabOk =
      tab === "all" ||
      (tab === "incoming" && r.type === "incoming") ||
      (tab === "outgoing" && r.type === "outgoing");

    const q = query.trim().toLowerCase();

    const text = [
      r.id,
      r.source,
      r.type,
      r.method,
      r.reference,
      r.booking_id,
      r.invoice_id,
      r.currency,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return tabOk && (!q || text.includes(q));
  });

  const incomingTotal = incoming.reduce(
    (s, r) => s + (Number(r.amount) || 0),
    0,
  );
  const outgoingTotal = outgoing.reduce(
    (s, r) => s + (Number(r.amount) || 0),
    0,
  );

  const exportCsv = () => {
    const header = [
      "time",
      "type",
      "method",
      "source",
      "reference",
      "booking_id",
      "invoice_id",
      "amount",
      "currency",
    ];

    const csvRows = filtered.map((r) =>
      [
        r.created_at || "",
        r.type || "",
        r.method || "",
        r.source || "",
        r.reference || "",
        r.booking_id || "",
        r.invoice_id || "",
        r.signedAmount || 0,
        r.currency || "EUR",
      ]
        .map((x) => `"${String(x).replaceAll('"', '""')}"`)
        .join(","),
    );

    const blob = new Blob([[header.join(","), ...csvRows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "z-report-transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-[#e3ddd2] rounded-[2rem] p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 border-b border-[#e3ddd2] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <ListChecks size={18} className="text-[#8b6f47]" />
            <h3 className="text-lg font-serif text-[#3f3127] font-semibold">
              Transaction Journal
            </h3>
          </div>
          <p className="text-xs text-[#a09084] uppercase tracking-wider font-bold mt-1">
            Review incoming and outgoing payments before closing
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a09084]"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search journal..."
              className="w-full sm:w-56 rounded-full border border-[#e3ddd2] bg-[#fcfbf9] pl-9 pr-4 py-2 text-xs font-semibold text-[#3f3127] outline-none focus:ring-2 focus:ring-[#8b6f47]/20"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#f4f1ec] rounded-full p-1">
            {["all", "incoming", "outgoing"].map((x) => (
              <button
                key={x}
                onClick={() => setTab(x)}
                className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                  tab === x
                    ? "bg-white text-[#3f3127] shadow-sm"
                    : "text-[#7a6a5f] hover:text-[#3f3127]"
                }`}
              >
                {x}
              </button>
            ))}
          </div>

          <button
            onClick={exportCsv}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#e3ddd2] bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#3f3127] hover:bg-[#fdfaf5]"
          >
            <Download size={13} /> CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <MiniTotal label="Incoming Total" value={fmtMoney(incomingTotal)} />
        <MiniTotal
          label="Outgoing Total"
          value={`-${fmtMoney(outgoingTotal)}`}
          danger
        />
        <MiniTotal
          label="Journal Net"
          value={fmtMoney(incomingTotal - outgoingTotal)}
          strong
        />
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#a09084]">
          No transactions found for this day.
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[440px] overflow-y-auto rounded-2xl border border-[#f4f1ec]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white z-10">
              <tr>
                <th className="px-4 py-3 border-b border-[#e3ddd2] text-[10px] font-bold uppercase tracking-widest text-[#a09084]">
                  Time
                </th>
                <th className="px-4 py-3 border-b border-[#e3ddd2] text-[10px] font-bold uppercase tracking-widest text-[#a09084]">
                  Type
                </th>
                <th className="px-4 py-3 border-b border-[#e3ddd2] text-[10px] font-bold uppercase tracking-widest text-[#a09084]">
                  Method
                </th>
                <th className="px-4 py-3 border-b border-[#e3ddd2] text-[10px] font-bold uppercase tracking-widest text-[#a09084]">
                  Source
                </th>
                <th className="px-4 py-3 border-b border-[#e3ddd2] text-[10px] font-bold uppercase tracking-widest text-[#a09084]">
                  Reference
                </th>
                <th className="px-4 py-3 border-b border-[#e3ddd2] text-[10px] font-bold uppercase tracking-widest text-[#a09084] text-right">
                  Amount
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#f4f1ec]">
              {filtered.map((r) => (
                <tr key={`${r.source}-${r.id}`} className="hover:bg-[#fdfaf5]">
                  <td className="px-4 py-4 text-xs font-mono text-[#7a6a5f] whitespace-nowrap">
                    {r.created_at
                      ? new Date(r.created_at).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest border ${
                        r.type === "incoming"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}
                    >
                      {r.type}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-sm font-bold text-[#3f3127] capitalize whitespace-nowrap">
                    {String(r.method || "other").replaceAll("_", " ")}
                  </td>

                  <td className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-[#a09084] whitespace-nowrap">
                    {r.source}
                  </td>

                  <td className="px-4 py-4 text-xs font-mono text-[#7a6a5f] max-w-[240px] truncate">
                    {r.booking_id
                      ? `Booking #${r.booking_id}`
                      : r.invoice_id
                        ? `Invoice #${r.invoice_id}`
                        : r.reference || "—"}
                  </td>

                  <td
                    className={`px-4 py-4 text-right font-mono font-bold whitespace-nowrap ${
                      r.signedAmount < 0 ? "text-rose-700" : "text-[#3f3127]"
                    }`}
                  >
                    {r.signedAmount < 0 ? "-" : ""}
                    {fmtMoney(Math.abs(r.signedAmount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!locked && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 leading-relaxed">
          Review this journal before closing. Once locked, the Z-Report stores
          the day totals and the cash reconciliation.
        </div>
      )}
    </div>
  );
}

function MiniTotal({ label, value, danger, strong }) {
  return (
    <div className="rounded-2xl border border-[#e3ddd2] bg-[#fcfbf9] p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#a09084]">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-mono font-bold ${
          danger
            ? "text-rose-700"
            : strong
              ? "text-[#2a1f18]"
              : "text-[#3f3127]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function TenderBreakdown({ summary, grossTotal, netTotal, isVerified }) {
  return (
    <div className="bg-white border border-[#e3ddd2] rounded-[2rem] p-8 shadow-sm">
      <div className="flex items-center justify-between mb-6 border-b border-[#e3ddd2] pb-6">
        <div>
          <h3 className="text-lg font-serif text-[#3f3127] font-semibold">
            Tender Breakdown
          </h3>
          <p className="text-xs text-[#a09084] uppercase tracking-wider font-bold mt-1">
            System Transactions
          </p>
        </div>
        {isVerified && (
          <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold uppercase tracking-widest">
            <ShieldCheck size={16} /> Verified
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <tbody className="divide-y divide-[#f4f1ec]">
            <TenderRow
              icon={<CreditCard size={16} />}
              iconClass="bg-blue-50 text-blue-600 border-blue-100"
              label="Credit / Debit / Stripe / Terminal"
              value={summary.card}
            />
            <TenderRow
              icon={<Banknote size={16} />}
              iconClass="bg-emerald-50 text-emerald-600 border-emerald-100"
              label="Cash Revenue"
              value={summary.cash}
            />
            <TenderRow
              icon={<ArrowDownRight size={16} />}
              iconClass="bg-indigo-50 text-indigo-600 border-indigo-100"
              label="Bank Transfers"
              value={summary.bank_transfer}
            />
            <TenderRow
              icon={<Wallet size={16} />}
              iconClass="bg-purple-50 text-purple-600 border-purple-100"
              label="Gift Cards / Voucher / Other"
              value={summary.other}
            />

            <tr className="bg-rose-50/30">
              <td className="py-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-100 text-rose-600 rounded-lg border border-rose-200">
                    <RotateCcw size={16} />
                  </div>
                  <span className="text-sm font-bold text-rose-800">
                    Refunds Processed
                  </span>
                </div>
              </td>
              <td className="py-4 text-right font-mono font-bold text-rose-700">
                -{fmtMoney(summary.refunds)}
              </td>
            </tr>
          </tbody>

          <tfoot>
            <tr>
              <td className="pt-6 text-xs font-bold uppercase tracking-widest text-[#7a6a5f]">
                Gross Revenue
              </td>
              <td className="pt-6 text-right text-lg font-mono font-bold">
                {fmtMoney(grossTotal)}
              </td>
            </tr>
            <tr>
              <td className="pt-3 text-sm font-bold uppercase tracking-widest text-[#3f3127]">
                Net Ledger Total
              </td>
              <td className="pt-3 text-right text-2xl font-serif font-bold text-[#2a1f18]">
                {fmtMoney(netTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function MoneyInput({ label, value, onChange, disabled, placeholder }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#a09084] mb-1 pl-1">
        {label}
      </label>
      <input
        type="number"
        step="0.01"
        min="0"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full bg-[#fcfbf9] border border-[#e3ddd2] rounded-xl px-4 py-3 text-sm font-mono font-bold text-[#3f3127] focus:bg-white focus:ring-2 focus:ring-[#8b6f47]/30 outline-none transition-all disabled:opacity-50 disabled:bg-[#f4f1ec]"
      />
    </div>
  );
}

function ReadonlyLine({ label, value }) {
  return (
    <div className="flex justify-between items-center px-4 py-3 bg-[#fdfaf5] rounded-xl border border-[#e3ddd2]">
      <span className="text-xs font-bold uppercase tracking-wider text-[#7a6a5f]">
        {label}
      </span>
      <span className="text-base font-mono font-bold text-[#3f3127]">
        {fmtMoney(value)}
      </span>
    </div>
  );
}

function TenderRow({ icon, iconClass, label, value }) {
  return (
    <tr className="hover:bg-[#fdfaf5] transition-colors">
      <td className="py-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg border ${iconClass}`}>{icon}</div>
          <span className="text-sm font-bold text-[#3f3127]">{label}</span>
        </div>
      </td>
      <td className="py-4 text-right font-mono font-bold text-[#3f3127]">
        {fmtMoney(value)}
      </td>
    </tr>
  );
}

function ChecklistItem({ done, label }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="font-medium text-[#3f3127]">{label}</span>
      {done ? (
        <span className="flex items-center gap-1 text-emerald-700 text-xs font-bold uppercase">
          <CheckCircle2 size={14} /> Done
        </span>
      ) : (
        <span className="flex items-center gap-1 text-amber-700 text-xs font-bold uppercase">
          <AlertCircle size={14} /> Pending
        </span>
      )}
    </div>
  );
}

function ActionFooter({
  isVerified,
  unlocking,
  locking,
  canLock,
  handleUnlock,
  handlePrint,
  handleVerify,
}) {
  return (
    <div className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-[#e3ddd2] p-4 sm:p-6 z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] print:hidden">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        <div className="hidden sm:block">
          {isVerified ? (
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest flex items-center gap-2">
              <Lock size={14} /> Ledger Locked
            </p>
          ) : (
            <p className="text-xs font-bold text-rose-700 uppercase tracking-widest flex items-center gap-2">
              <Unlock size={14} /> Ledger Open
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {isVerified ? (
            <>
              <button
                onClick={handleUnlock}
                disabled={unlocking}
                className="flex-1 sm:flex-none text-xs font-bold text-[#7a6a5f] hover:text-rose-600 uppercase tracking-widest px-4 py-3 transition-colors disabled:opacity-50"
              >
                {unlocking ? "Unlocking..." : "Unlock Ledger"}
              </button>

              <button
                onClick={handlePrint}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-full border border-[#e3ddd2] bg-white text-[#3f3127] px-8 py-3.5 text-xs font-bold uppercase tracking-widest hover:bg-[#fdfaf5] transition-all shadow-sm"
              >
                <Printer size={16} /> Print Z-Report
              </button>
            </>
          ) : (
            <button
              onClick={handleVerify}
              disabled={!canLock || locking}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-full bg-[#1a1a1a] text-white px-10 py-3.5 text-xs font-bold uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {locking ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Locking...
                </>
              ) : (
                <>
                  <Lock size={16} /> Verify & Close Shift
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PrintLayout({
  selectedDate,
  printedAt,
  isVerified,
  report,
  summary,
  grossTotal,
  netTotal,
  floatAmt,
  systemCash,
  dropsAmt,
  expectedDrawer,
  actualCash,
  discrepancy,
  drawerNotes,
  incomingRows,
  outgoingRows,
}) {
  const rows = [
    ...incomingRows.map((x) => ({ ...x, signedAmount: Number(x.amount) || 0 })),
    ...outgoingRows.map((x) => ({
      ...x,
      signedAmount: -(Number(x.amount) || 0),
    })),
  ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return (
    <div className="hidden print:block p-8 font-mono text-black text-sm max-w-4xl mx-auto">
      <div className="text-center border-b border-black pb-4 mb-6">
        <h1 className="text-2xl font-bold uppercase tracking-widest">
          Z-REPORT
        </h1>
        <p className="mt-2">Date: {selectedDate}</p>
        <p>Printed: {printedAt}</p>
        <p>Status: {isVerified ? "VERIFIED & LOCKED" : "UNVERIFIED"}</p>
        {report?.id && <p>Report ID: {report.id}</p>}
      </div>

      <PrintSection title="System Ledger">
        <PrintLine label="Credit/Debit" value={fmtMoney(summary.card)} />
        <PrintLine label="Cash Revenue" value={fmtMoney(summary.cash)} />
        <PrintLine
          label="Bank Transfers"
          value={fmtMoney(summary.bank_transfer)}
        />
        <PrintLine label="Gift Cards/Other" value={fmtMoney(summary.other)} />
        <PrintLine label="Gross Revenue" value={fmtMoney(grossTotal)} bold />
        <PrintLine label="Refunds" value={`-${fmtMoney(summary.refunds)}`} />
        <PrintLine label="Net Revenue" value={fmtMoney(netTotal)} bold />
      </PrintSection>

      <PrintSection title="Cash Drawer Audit">
        <PrintLine label="Opening Float" value={fmtMoney(floatAmt)} />
        <PrintLine label="Cash Revenue" value={fmtMoney(systemCash)} />
        <PrintLine label="Payouts / Drops" value={`-${fmtMoney(dropsAmt)}`} />
        <PrintLine
          label="Expected in Drawer"
          value={fmtMoney(expectedDrawer)}
          bold
        />
        <PrintLine label="Actual Counted" value={fmtMoney(actualCash)} />
        <PrintLine
          label="Variance"
          value={`${discrepancy > 0 ? "+" : ""}${fmtMoney(discrepancy)}`}
          bold
        />
      </PrintSection>

      <PrintSection title="Transaction Journal">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr>
              <th className="border-b border-black py-1">Time</th>
              <th className="border-b border-black py-1">Type</th>
              <th className="border-b border-black py-1">Method</th>
              <th className="border-b border-black py-1">Source</th>
              <th className="border-b border-black py-1">Reference</th>
              <th className="border-b border-black py-1 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.source}-${r.id}`}>
                <td className="py-1">
                  {r.created_at
                    ? new Date(r.created_at).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </td>
                <td className="py-1">{r.type}</td>
                <td className="py-1">{r.method || "other"}</td>
                <td className="py-1">{r.source}</td>
                <td className="py-1">
                  {r.booking_id
                    ? `Booking #${r.booking_id}`
                    : r.invoice_id
                      ? `Invoice #${r.invoice_id}`
                      : r.reference || "—"}
                </td>
                <td className="py-1 text-right">
                  {r.signedAmount < 0 ? "-" : ""}
                  {fmtMoney(Math.abs(r.signedAmount))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </PrintSection>

      <div className="mb-12">
        <h2 className="font-bold uppercase tracking-widest border-b border-dashed border-gray-400 pb-1 mb-2">
          Audit Notes / Expenses
        </h2>
        <p className="whitespace-pre-wrap">{drawerNotes || "None provided."}</p>
      </div>

      <div className="grid grid-cols-2 gap-12 mt-16 pt-8 border-t border-black">
        <div>
          <p className="uppercase mb-8">Prepared By</p>
          <div className="border-b border-black" />
          <p className="mt-1">Manager Signature</p>
        </div>
        <div>
          <p className="uppercase mb-8">Verified By</p>
          <div className="border-b border-black" />
          <p className="mt-1">Finance Signature</p>
        </div>
      </div>
    </div>
  );
}

function PrintSection({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="font-bold uppercase tracking-widest border-b border-dashed border-gray-400 pb-1 mb-2">
        {title}
      </h2>
      {children}
    </div>
  );
}

function PrintLine({ label, value, bold }) {
  return (
    <div
      className={`flex justify-between ${
        bold ? "font-bold mt-2 pt-2 border-t border-gray-400" : ""
      }`}
    >
      <span>{label}:</span>
      <span>{value}</span>
    </div>
  );
}
