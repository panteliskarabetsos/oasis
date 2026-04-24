"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

import {
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  CheckCircle2,
  AlertTriangle,
  ShoppingBag,
  Package2,
  X,
  SmartphoneNfc,
  Receipt,
  Percent,
  Lock,
  PauseCircle,
  RotateCcw,
  FileBarChart2,
} from "lucide-react";

const ACCENT = "#8b6f47";
const RING = "ring-[rgba(139,111,71,0.3)]";

function clsx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function formatCurrency(n) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(n || 0);
  } catch {
    return "€" + Math.round(n || 0).toLocaleString();
  }
}

function addMinutes(d, m) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() + m);
  return x;
}

function toLocalDatetimeInputValue(d = new Date()) {
  const pad = (v) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function todayISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().split("T")[0];
}

function isInputFocused() {
  const a = typeof document !== "undefined" ? document.activeElement : null;
  return (
    a &&
    (a.tagName === "INPUT" ||
      a.tagName === "TEXTAREA" ||
      a.tagName === "SELECT" ||
      a.isContentEditable)
  );
}

function isValidDateInput(v) {
  const t = new Date(v).getTime();
  return !Number.isNaN(t);
}

function validateEmail(v) {
  if (!v) return true;
  return /.+@.+\..+/.test(v);
}

function validatePhone(v) {
  if (!v) return true;
  return /[0-9+\-()\s]{6,}/.test(v);
}

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
);

export default function POSPage() {
  const router = useRouter();

  const [mode, setMode] = useState("experiences");
  const [txType, setTxType] = useState("experience");

  const [experiences, setExperiences] = useState([]);
  const [items, setItems] = useState([]);
  const [loadingExp, setLoadingExp] = useState(true);
  const [loadingItems, setLoadingItems] = useState(true);

  const [queryRaw, setQueryRaw] = useState("");
  const [query, setQuery] = useState("");
  const searchRef = useRef(null);
  const [selectedExperience, setSelectedExperience] = useState(null);

  const [cartItems, setCartItems] = useState({});
  const [adults, setAdults] = useState(1);
  const [kids, setKids] = useState(0);

  const [manualDiscount, setManualDiscount] = useState(0);
  const [promoCode, setPromoCode] = useState("");
  const [giftCode, setGiftCode] = useState("");

  const [startTime, setStartTime] = useState(() =>
    toLocalDatetimeInputValue(addMinutes(new Date(), 10)),
  );
  const [bookingRef, setBookingRef] = useState("");

  const [custName, setCustName] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custPhone, setCustPhone] = useState("");

  const [method, setMethod] = useState("terminal");
  const [reference, setReference] = useState("");
  const [cashReceived, setCashReceived] = useState("");

  const [cardOpen, setCardOpen] = useState(false);
  const [piClientSecret, setPiClientSecret] = useState(null);
  const [piId, setPiId] = useState(null);
  const [quote, setQuote] = useState(null);

  const [terminalIntentId, setTerminalIntentId] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [serverMsg, setServerMsg] = useState(null);
  const [undoData, setUndoData] = useState(null);
  const [heldOrders, setHeldOrders] = useState([]);
  const [todayLocked, setTodayLocked] = useState(false);

  useEffect(() => {
    let cancel = false;

    async function checkZLock() {
      try {
        const res = await fetch(`/api/admin/reports/daily?date=${todayISO()}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!cancel) setTodayLocked(json?.locked === true);
      } catch {
        if (!cancel) setTodayLocked(false);
      }
    }

    checkZLock();

    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("oasis_pos_held_orders") || "[]",
      );
      setHeldOrders(Array.isArray(saved) ? saved : []);
    } catch {
      setHeldOrders([]);
    }
  }, []);

  useEffect(() => {
    let cancel = false;

    (async function () {
      try {
        const res = await fetch("/api/pos/experiences", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load experiences");
        const data = await res.json();

        if (!cancel) {
          setExperiences(data || []);
          setLoadingExp(false);
        }
      } catch (e) {
        if (!cancel) {
          setExperiences([]);
          setLoadingExp(false);
          setServerMsg({
            type: "error",
            text: e.message || "Load error (experiences)",
          });
        }
      }
    })();

    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    let cancel = false;

    (async function () {
      try {
        const res = await fetch("/api/pos/items", { cache: "no-store" });
        const data = res.ok ? await res.json() : [];

        if (!cancel) {
          setItems(Array.isArray(data) ? data : []);
          setLoadingItems(false);
        }
      } catch (e) {
        if (!cancel) {
          setItems([]);
          setLoadingItems(false);
          setServerMsg({
            type: "error",
            text: e.message || "Load error (items)",
          });
        }
      }
    })();

    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setQuery(queryRaw.trim()), 180);
    return () => clearTimeout(t);
  }, [queryRaw]);

  useEffect(() => {
    let barcodeBuffer = "";
    let timeout;

    function handleGlobalKeyDown(e) {
      if (isInputFocused() && e.target !== searchRef.current) return;
      if (e.key.length !== 1 && e.key !== "Enter") return;

      if (e.key === "Enter" && barcodeBuffer.length > 3) {
        const matchedItem = items.find(
          (i) =>
            i.sku === barcodeBuffer ||
            String(i.name || "")
              .toLowerCase()
              .includes(barcodeBuffer.toLowerCase()),
        );

        if (matchedItem) {
          addItem(matchedItem);
          setServerMsg({
            type: "success",
            text: `Scanned: ${matchedItem.name}`,
          });
          setQueryRaw("");
        }

        barcodeBuffer = "";
        return;
      }

      if (e.key.length === 1) {
        barcodeBuffer += e.key;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          barcodeBuffer = "";
        }, 50);
      }
    }

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [items]);

  const filteredExperiences = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return experiences || [];
    return (experiences || []).filter((x) =>
      (x.name + " " + (x.slug || "")).toLowerCase().includes(q),
    );
  }, [experiences, query]);

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return items || [];
    return (items || []).filter((x) =>
      (x.name + " " + (x.sku || "")).toLowerCase().includes(q),
    );
  }, [items, query]);

  const priceAdult = selectedExperience?.pricing?.priceAdult ?? 0;
  const priceKid = selectedExperience?.pricing?.priceKid ?? 0;

  const expGross =
    (selectedExperience ? adults * priceAdult + kids * priceKid : 0) || 0;

  const expVatRate = 0.24;
  const expVatTotal = expGross - expGross / (1 + expVatRate);

  const itemLines = useMemo(() => Object.values(cartItems), [cartItems]);

  const itemsGross = useMemo(
    () =>
      itemLines.reduce(
        (sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 0),
        0,
      ),
    [itemLines],
  );

  const itemsVatTotal = useMemo(
    () =>
      itemLines.reduce((sum, it) => {
        const gross = (Number(it.price) || 0) * (Number(it.qty) || 0);
        const rate = Number(it.vat ?? 24) / 100;
        return sum + (gross - gross / (1 + rate));
      }, 0),
    [itemLines],
  );

  const totalGross = expGross + itemsGross;

  const clampedDiscount = Math.max(
    0,
    Math.min(Number(manualDiscount) || 0, totalGross),
  );

  const finalTotalToCollect = Math.max(0, totalGross - clampedDiscount);

  const discountRatio = totalGross > 0 ? clampedDiscount / totalGross : 0;
  const finalVatTotal = (expVatTotal + itemsVatTotal) * (1 - discountRatio);
  const finalNetTotal = finalTotalToCollect - finalVatTotal;

  const amountToCharge = method === "comp" ? 0 : finalTotalToCollect;

  const cashReceivedAmount = Number(cashReceived) || 0;
  const changeDue =
    method === "cash" ? Math.max(0, cashReceivedAmount - amountToCharge) : 0;
  const cashShort = method === "cash" && cashReceivedAmount < amountToCharge;

  const hasAnyCart = useMemo(() => {
    return (
      (!!selectedExperience && adults + kids > 0) ||
      itemLines.some((l) => l.qty > 0)
    );
  }, [itemLines, selectedExperience, adults, kids]);

  const canSubmit = useMemo(() => {
    if (todayLocked) return false;

    const emailOk = validateEmail(custEmail);
    const phoneOk = validatePhone(custPhone);

    if (!emailOk || !phoneOk) return false;
    if (method === "cash" && cashShort) return false;

    if (txType === "experience") {
      const startValid =
        !!selectedExperience && startTime && isValidDateInput(startTime);

      return !submitting && hasAnyCart && startValid;
    }

    return !submitting && itemLines.length > 0;
  }, [
    todayLocked,
    method,
    cashShort,
    txType,
    hasAnyCart,
    selectedExperience,
    startTime,
    submitting,
    custEmail,
    custPhone,
    itemLines,
  ]);

  const addItem = useCallback((it) => {
    setCartItems((prev) => {
      const cur = prev[it.id];

      return {
        ...prev,
        [it.id]: {
          id: it.id,
          name: it.name,
          sku: it.sku || null,
          price: Number(it.price || 0),
          qty: (cur?.qty || 0) + 1,
          vat: cur?.vat ?? (it.vatRate || 24),
        },
      };
    });
  }, []);

  const addCustomItem = useCallback(() => {
    const id = `custom-${Date.now()}`;

    setCartItems((prev) => ({
      ...prev,
      [id]: {
        id,
        name: "Custom Charge",
        sku: null,
        price: "",
        qty: 1,
        vat: 24,
      },
    }));

    setTxType((current) => (current === "experience" ? "items" : current));
  }, []);

  const setItemPriceRaw = useCallback((it, val) => {
    setCartItems((prev) => {
      const cur = prev[it.id];
      if (!cur) return prev;
      return { ...prev, [it.id]: { ...cur, price: val } };
    });
  }, []);

  const setItemName = useCallback((it, newName) => {
    setCartItems((prev) => {
      const cur = prev[it.id];
      if (!cur) return prev;
      return { ...prev, [it.id]: { ...cur, name: newName } };
    });
  }, []);

  const setItemVat = useCallback((it, newVat) => {
    setCartItems((prev) => {
      const cur = prev[it.id];
      if (!cur) return prev;
      return { ...prev, [it.id]: { ...cur, vat: newVat } };
    });
  }, []);

  const decItem = useCallback((it) => {
    setCartItems((prev) => {
      const cur = prev[it.id];
      if (!cur) return prev;

      const nextQty = Math.max(0, (cur.qty || 0) - 1);
      const copy = { ...prev };

      if (nextQty === 0) delete copy[it.id];
      else copy[it.id] = { ...cur, qty: nextQty };

      return copy;
    });
  }, []);

  const clearCart = useCallback(() => {
    setUndoData({
      selectedExperience,
      adults,
      kids,
      cartItems,
      manualDiscount,
      custName,
      custEmail,
      custPhone,
      startTime,
      bookingRef,
      txType,
    });

    setCartItems({});
    setAdults(1);
    setKids(0);
    setSelectedExperience(null);
    setManualDiscount(0);
    setPromoCode("");
    setGiftCode("");
    setReference("");
    setCashReceived("");
    setCustName("");
    setCustEmail("");
    setCustPhone("");
    setBookingRef("");
    setStartTime(toLocalDatetimeInputValue(addMinutes(new Date(), 10)));
  }, [
    selectedExperience,
    adults,
    kids,
    cartItems,
    manualDiscount,
    custName,
    custEmail,
    custPhone,
    startTime,
    bookingRef,
    txType,
  ]);

  function undoClear() {
    if (!undoData) return;

    setSelectedExperience(undoData.selectedExperience);
    setAdults(undoData.adults);
    setKids(undoData.kids);
    setCartItems(undoData.cartItems);
    setManualDiscount(undoData.manualDiscount);
    setCustName(undoData.custName || "");
    setCustEmail(undoData.custEmail || "");
    setCustPhone(undoData.custPhone || "");
    setStartTime(undoData.startTime);
    setBookingRef(undoData.bookingRef || "");
    setTxType(undoData.txType || "items");
    setUndoData(null);
  }

  function holdOrder() {
    if (!hasAnyCart) return;

    const held = {
      id: Date.now(),
      txType,
      selectedExperience,
      adults,
      kids,
      cartItems,
      manualDiscount,
      custName,
      custEmail,
      custPhone,
      startTime,
      bookingRef,
      createdAt: new Date().toISOString(),
    };

    const next = [held, ...heldOrders].slice(0, 10);
    setHeldOrders(next);
    localStorage.setItem("oasis_pos_held_orders", JSON.stringify(next));

    clearCart();
    setServerMsg({ type: "success", text: "Order held." });
  }

  function resumeOrder(order) {
    setTxType(order.txType);
    setSelectedExperience(order.selectedExperience);
    setAdults(order.adults);
    setKids(order.kids);
    setCartItems(order.cartItems);
    setManualDiscount(order.manualDiscount);
    setCustName(order.custName || "");
    setCustEmail(order.custEmail || "");
    setCustPhone(order.custPhone || "");
    setStartTime(order.startTime);
    setBookingRef(order.bookingRef || "");

    const next = heldOrders.filter((x) => x.id !== order.id);
    setHeldOrders(next);
    localStorage.setItem("oasis_pos_held_orders", JSON.stringify(next));
  }

  async function openCardCharge() {
    if (!hasAnyCart)
      return setServerMsg({ type: "error", text: "Cart is empty." });
    if (todayLocked)
      return setServerMsg({
        type: "error",
        text: "Today’s Z-Report is locked. POS is disabled.",
      });

    try {
      setSubmitting(true);
      const payload = createPayload();

      const res = await fetch("/api/pos/payments/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok)
        throw new Error(data?.error || "Could not start card payment");

      setPiClientSecret(data.clientSecret);
      setPiId(data.intentId);
      setQuote(data.quote);
      setCardOpen(true);
    } catch (e) {
      setServerMsg({ type: "error", text: e.message || "Card flow error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function openTerminalCharge() {
    if (!hasAnyCart)
      return setServerMsg({ type: "error", text: "Cart is empty." });
    if (todayLocked)
      return setServerMsg({
        type: "error",
        text: "Today’s Z-Report is locked. POS is disabled.",
      });

    try {
      setSubmitting(true);

      const res = await fetch("/api/pos/revolut/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountToCharge,
          currency: "EUR",
          reference: `POS-${Date.now()}`,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to push to terminal");

      setTerminalIntentId(data.intentId);
    } catch (e) {
      setServerMsg({
        type: "error",
        text: e.message || "Failed to wake up Terminal",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckout(overrideRef = null) {
    if (!hasAnyCart) return;
    if (todayLocked)
      return setServerMsg({
        type: "error",
        text: "Today’s Z-Report is locked. POS is disabled.",
      });

    setSubmitting(true);
    setServerMsg(null);

    try {
      const payload = createPayload(overrideRef);

      const res = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Checkout failed");

      if (txType === "items" || txType === "addons") {
        const receiptId = data.receiptId || data.bookingId;

        setServerMsg({ type: "success", text: "Receipt generated." });
        clearCart();

        if (receiptId) {
          window.open(`/api/receipts/${receiptId}/pdf`, "_blank");
          router.push(`/admin/receipts/${receiptId}`);
        }

        return;
      }

      setServerMsg({ type: "success", text: "Booking recorded." });
      clearCart();
      router.push(`/admin/bookings/${data.bookingId}`);
    } catch (e) {
      setServerMsg({ type: "error", text: e.message || "Checkout error" });
    } finally {
      setSubmitting(false);
    }
  }

  function createPayload(overrideRef = null) {
    return {
      transactionType: txType,
      relatedBookingRef: txType === "addons" ? bookingRef.trim() : null,
      experienceId: selectedExperience?.id ?? null,
      startTime: selectedExperience ? new Date(startTime).toISOString() : null,
      counts: selectedExperience ? { adults, kids } : null,
      items: itemLines
        .filter((l) => l.qty > 0)
        .map((l) => ({
          id: l.id,
          name: l.name,
          sku: l.sku,
          unitPrice: Number(l.price || 0),
          quantity: Number(l.qty || 0),
          vatRate: Number(l.vat || 24),
        })),
      manualDiscount: Number(clampedDiscount) || 0,
      promoCode: promoCode.trim() || null,
      giftCode: giftCode.trim() || null,
      payment: {
        method,
        reference: overrideRef ?? (reference.trim() || null),
        cashReceived: method === "cash" ? cashReceivedAmount : null,
        changeDue: method === "cash" ? changeDue : null,
      },
      customer: {
        name: custName.trim() || null,
        email: custEmail.trim() || null,
        phone: custPhone.trim() || null,
      },
      currency: "eur",
      clientGross: totalGross,
      stripePaymentIntentId: method === "card" ? piId : null,
    };
  }

  function onConfirmClick() {
    if (method === "card") return openCardCharge();
    if (method === "terminal") return openTerminalCharge();
    return handleCheckout();
  }

  return (
    <div className="min-h-screen bg-[#f4f1ec] text-[#4c4138] selection:bg-[#f0e7d9] font-sans">
      <div className="relative mx-auto px-4 sm:px-6 pt-4 pb-28 h-screen flex flex-col max-w-[1600px]">
        <header className="shrink-0 mb-4 bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-[#e8e2d9] p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-serif font-semibold tracking-tight flex items-center gap-2">
              <Receipt className="h-6 w-6 text-[#8b6f47]" /> Oasis POS
            </h1>

            <div className="hidden md:flex bg-[#faf7f2] border border-[#d8cfc3] rounded-lg p-1">
              <SegmentBtn
                active={mode === "experiences"}
                onClick={() => setMode("experiences")}
                icon={<Package2 className="h-4 w-4" />}
                label="Experiences"
              />
              <SegmentBtn
                active={mode === "items"}
                onClick={() => setMode("items")}
                icon={<ShoppingBag className="h-4 w-4" />}
                label="Items & Merch"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={holdOrder}
              disabled={!hasAnyCart}
              className="hidden sm:flex px-4 py-2 text-sm font-medium text-[#4c4138] bg-white border border-[#d8cfc3] hover:bg-[#f0e7d9] rounded-xl transition items-center gap-2 shadow-sm disabled:opacity-40"
            >
              <PauseCircle className="h-4 w-4" /> Hold
            </button>

            {undoData && (
              <button
                onClick={undoClear}
                className="hidden sm:flex px-4 py-2 text-sm font-medium text-[#4c4138] bg-white border border-[#d8cfc3] hover:bg-[#f0e7d9] rounded-xl transition items-center gap-2 shadow-sm"
              >
                <RotateCcw className="h-4 w-4" /> Undo
              </button>
            )}

            <button
              onClick={() => router.push("/admin/reports/daily")}
              className="hidden sm:flex px-4 py-2 text-sm font-medium text-[#4c4138] bg-white border border-[#d8cfc3] hover:bg-[#f0e7d9] rounded-xl transition items-center gap-2 shadow-sm"
            >
              <FileBarChart2 className="h-4 w-4" /> Z-Report
            </button>

            <button
              onClick={addCustomItem}
              className="hidden sm:flex px-4 py-2 text-sm font-medium text-[#4c4138] bg-white border border-[#d8cfc3] hover:bg-[#f0e7d9] rounded-xl transition items-center gap-2 shadow-sm"
            >
              <Plus className="h-4 w-4" /> Custom Line
            </button>

            <button
              onClick={() => {
                if (hasAnyCart) clearCart();
              }}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-xl transition shadow-sm"
            >
              Clear Cart
            </button>
          </div>
        </header>

        {todayLocked && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 flex items-start gap-3">
            <Lock className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">POS Locked</p>
              <p className="text-sm">
                Today’s Z-Report is already closed. New POS transactions are
                disabled.
              </p>
            </div>
          </div>
        )}

        {serverMsg && (
          <Toast type={serverMsg.type} onDismiss={() => setServerMsg(null)}>
            {serverMsg.text}
          </Toast>
        )}

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
          <main className="flex-1 flex flex-col bg-white/90 backdrop-blur border border-[#e0dcd4] shadow-md rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-[#e0dcd4] bg-[#fdfbf7] flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-[#8b6f47]" />
                <input
                  ref={searchRef}
                  value={queryRaw}
                  onChange={(e) => setQueryRaw(e.target.value)}
                  placeholder={`Search or scan barcode for ${mode}...`}
                  className={clsx(
                    "w-full rounded-xl border border-[#d8cfc3] bg-white px-12 py-3.5 text-base placeholder:text-[#a09084] focus:outline-none focus:ring-2 focus:border-[#8b6f47] shadow-inner",
                    RING,
                  )}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-[#f9f8f5]">
              {mode === "experiences" ? (
                <ExpGrid
                  loading={loadingExp}
                  list={filteredExperiences}
                  selected={selectedExperience}
                  onSelect={(x) => {
                    setSelectedExperience(x);
                    setTxType("experience");
                    setAdults((v) => (v === 0 ? 1 : v));
                  }}
                />
              ) : (
                <ItemGrid
                  loading={loadingItems}
                  list={filteredItems}
                  cartMap={cartItems}
                  onInc={addItem}
                />
              )}
            </div>
          </main>

          <aside className="w-full lg:w-[440px] xl:w-[480px] shrink-0 flex flex-col bg-white border border-[#e0dcd4] shadow-xl rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-[#e0dcd4] bg-[#faf7f2]">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-[#4c4138]">
                <ShoppingBag className="h-5 w-5 text-[#8b6f47]" /> Current Order
              </h2>

              <div className="flex bg-[#e0dcd4]/50 border border-[#d8cfc3] rounded-lg p-1 shadow-inner">
                <button
                  onClick={() => setTxType("experience")}
                  className={clsx(
                    "flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all",
                    txType === "experience"
                      ? "bg-white text-[#4c4138] shadow-sm"
                      : "text-[#7a6a5f] hover:text-[#4c4138]",
                  )}
                >
                  Booking
                </button>
                <button
                  onClick={() => {
                    setTxType("items");
                    setSelectedExperience(null);
                  }}
                  className={clsx(
                    "flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all",
                    txType === "items"
                      ? "bg-white text-[#4c4138] shadow-sm"
                      : "text-[#7a6a5f] hover:text-[#4c4138]",
                  )}
                >
                  Retail
                </button>
                <button
                  onClick={() => {
                    setTxType("addons");
                    setSelectedExperience(null);
                  }}
                  className={clsx(
                    "flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all",
                    txType === "addons"
                      ? "bg-white text-[#4c4138] shadow-sm"
                      : "text-[#7a6a5f] hover:text-[#4c4138]",
                  )}
                >
                  Add-on
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#fdfbf7]">
              {heldOrders.length > 0 && (
                <div className="bg-white border border-[#e6dfd6] rounded-xl p-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#a09084] mb-3">
                    Held Orders
                  </p>

                  <div className="space-y-2">
                    {heldOrders.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => resumeOrder(o)}
                        className="w-full flex items-center justify-between rounded-xl border border-[#e8e2d9] bg-[#fdfbf7] px-4 py-3 text-left hover:bg-[#f0e7d9]"
                      >
                        <div>
                          <p className="text-sm font-bold text-[#4c4138]">
                            {o.txType === "experience"
                              ? o.selectedExperience?.name || "Booking"
                              : "Retail Order"}
                          </p>
                          <p className="text-xs text-[#a09084]">
                            {new Date(o.createdAt).toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-[#8b6f47]">
                          Resume
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {txType === "experience" && selectedExperience && (
                <div className="bg-white border border-[#8b6f47]/40 rounded-xl p-5 shadow-sm relative">
                  <button
                    onClick={() => setSelectedExperience(null)}
                    className="absolute top-3 right-3 text-[#d8cfc3] hover:text-red-500 bg-[#f9f8f5] hover:bg-red-50 rounded-lg p-1.5 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <h3 className="font-bold text-lg mb-1 pr-8 text-[#4c4138]">
                    {selectedExperience.name}
                  </h3>

                  <p className="text-sm text-[#8b6f47] font-medium mb-5">
                    {formatCurrency(priceAdult)} / adult •{" "}
                    {formatCurrency(priceKid)} / kid
                  </p>

                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <Counter
                      label="Adults"
                      value={adults}
                      onChange={setAdults}
                      min={1}
                    />
                    <Counter
                      label="Kids"
                      value={kids}
                      onChange={setKids}
                      min={0}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-[#a09084] block mb-2">
                      Start Time
                    </label>
                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full rounded-xl border border-[#d8cfc3] px-4 py-3 text-sm focus:ring-2 focus:ring-[#8b6f47]/30 bg-[#fbf9f6] outline-none"
                    />
                  </div>
                </div>
              )}

              {itemLines.length > 0 && (
                <div className="bg-white border border-[#e6dfd6] rounded-xl overflow-hidden shadow-sm">
                  {itemLines.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-start gap-3 p-4 border-b border-[#f0ebe1] last:border-0 hover:bg-[#fbf9f6] transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <input
                          value={l.name}
                          onChange={(e) => setItemName(l, e.target.value)}
                          placeholder="Item name"
                          className="font-bold text-[#4c4138] text-sm w-full bg-transparent border-b border-transparent hover:border-[#d8cfc3] focus:border-[#8b6f47] focus:outline-none transition-colors truncate pb-1"
                        />

                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center bg-[#f4f1ec] px-2 py-1 rounded-md border border-[#e8e2d9]">
                            <span className="text-xs font-bold text-[#a09084] mr-1">
                              €
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={l.price}
                              onChange={(e) =>
                                setItemPriceRaw(l, e.target.value)
                              }
                              placeholder="0.00"
                              className="text-sm font-semibold text-[#4c4138] w-16 bg-transparent focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center gap-1.5 bg-[#f4f1ec] px-2 py-1 rounded-md border border-[#e8e2d9]">
                            <Percent className="h-3 w-3 text-[#a09084]" />
                            <select
                              value={l.vat}
                              onChange={(e) => setItemVat(l, e.target.value)}
                              className="text-xs font-semibold text-[#7a6a5f] bg-transparent focus:outline-none cursor-pointer"
                            >
                              <option value="24">24%</option>
                              <option value="13">13%</option>
                              <option value="0">0%</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0 mt-0.5">
                        <div className="text-base text-right font-bold text-[#4c4138]">
                          {formatCurrency((Number(l.price) || 0) * l.qty)}
                        </div>

                        <div className="flex items-center bg-[#fdfbf7] rounded-lg p-0.5 border border-[#e8e2d9]">
                          <button
                            onClick={() => decItem(l)}
                            className="p-1 hover:bg-white rounded text-[#7a6a5f] shadow-sm"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-8 text-center font-bold text-sm">
                            {l.qty}
                          </span>
                          <button
                            onClick={() => addItem(l)}
                            className="p-1 hover:bg-white rounded text-[#7a6a5f] shadow-sm"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {txType === "addons" && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#a09084]">
                    Existing Booking Ref
                  </label>
                  <input
                    placeholder="e.g. B-001234"
                    value={bookingRef}
                    onChange={(e) => setBookingRef(e.target.value)}
                    className="w-full rounded-xl border border-[#d8cfc3] px-4 py-3 text-sm focus:ring-2 focus:ring-[#8b6f47]/30 outline-none"
                  />
                </div>
              )}

              {((txType === "experience" && !selectedExperience) ||
                (txType !== "experience" && itemLines.length === 0)) && (
                <div className="text-center py-12 px-4 text-[#a09084] border-2 border-dashed border-[#e8e2d9] rounded-2xl bg-[#faf7f2]/50">
                  <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-20 text-[#8b6f47]" />
                  <p className="text-sm font-medium mb-4">
                    {txType === "experience"
                      ? "Select an experience to begin."
                      : "Select items from the catalog or add a custom line."}
                  </p>

                  {txType !== "experience" && (
                    <button
                      onClick={addCustomItem}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-[#d8cfc3] text-[#4c4138] rounded-xl hover:bg-[#f0e7d9] transition shadow-sm font-semibold text-sm"
                    >
                      <Plus className="h-4 w-4" /> Custom Line
                    </button>
                  )}
                </div>
              )}

              <div className="space-y-2 pt-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#a09084]">
                  Customer Data
                </label>

                <input
                  placeholder="Customer Name"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full rounded-xl border border-[#d8cfc3] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30 shadow-sm"
                />

                <input
                  placeholder="Email Address"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  className="w-full rounded-xl border border-[#d8cfc3] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30 shadow-sm"
                />

                <input
                  placeholder="Phone Number"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full rounded-xl border border-[#d8cfc3] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30 shadow-sm"
                />

                {!validateEmail(custEmail) && (
                  <p className="text-xs font-bold text-red-600">
                    Invalid email address.
                  </p>
                )}

                {!validatePhone(custPhone) && (
                  <p className="text-xs font-bold text-red-600">
                    Invalid phone number.
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white border-t border-[#e0dcd4] p-5 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] z-10">
              <div className="mb-5 bg-[#fdfbf7] rounded-xl border border-[#e8e2d9] p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-[#7a6a5f]">
                    Net Subtotal
                  </span>
                  <span className="text-sm font-medium text-[#4c4138]">
                    {formatCurrency(finalNetTotal)}
                  </span>
                </div>

                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-[#7a6a5f]">
                    VAT Included
                  </span>
                  <span className="text-sm font-medium text-[#4c4138]">
                    {formatCurrency(finalVatTotal)}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-[#e8e2d9] mt-2">
                  <span className="text-sm font-bold text-emerald-700">
                    Manual Discount
                  </span>
                  <div className="relative w-24">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 text-sm">
                      -€
                    </span>
                    <input
                      type="number"
                      value={manualDiscount || ""}
                      onChange={(e) => setManualDiscount(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-emerald-200 bg-emerald-50 py-1 pl-7 pr-2 text-sm text-right font-bold text-emerald-800 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-end mt-4 pt-3 border-t-2 border-[#e8e2d9]">
                  <p className="text-sm font-bold uppercase tracking-wider text-[#a09084] mb-1">
                    Total to Pay
                  </p>
                  <p className="text-4xl font-serif font-bold tracking-tight text-[#2a1f18]">
                    {formatCurrency(finalTotalToCollect)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-5">
                <PayBtn
                  active={method === "cash"}
                  onClick={() => setMethod("cash")}
                  icon={<Banknote className="h-5 w-5 mb-1" />}
                  label="Cash"
                />
                <PayBtn
                  active={method === "card"}
                  onClick={() => setMethod("card")}
                  icon={<CreditCard className="h-5 w-5 mb-1" />}
                  label="Web"
                />
                <PayBtn
                  active={method === "terminal"}
                  onClick={() => setMethod("terminal")}
                  icon={<SmartphoneNfc className="h-5 w-5 mb-1" />}
                  label="Terminal"
                />
                <PayBtn
                  active={method === "comp"}
                  onClick={() => setMethod("comp")}
                  icon={<CheckCircle2 className="h-5 w-5 mb-1" />}
                  label="Comp"
                />
              </div>

              {method === "cash" && (
                <div className="bg-[#fdfaf5] border border-[#8b6f47]/30 p-4 rounded-xl mb-5 shadow-sm">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#a09084] block mb-2">
                    Cash Received
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-[#d8cfc3] bg-white px-4 py-3 text-xl font-bold text-[#2a1f18] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30"
                  />

                  <div className="mt-3 flex justify-between text-sm">
                    <span className="text-[#7a6a5f]">Change Due</span>
                    <span className="font-bold text-[#2a1f18]">
                      {formatCurrency(changeDue)}
                    </span>
                  </div>

                  {cashShort && (
                    <p className="mt-2 text-xs font-bold text-red-600">
                      Cash received is less than the total.
                    </p>
                  )}
                </div>
              )}

              {method === "terminal" && (
                <div className="bg-[#fdfaf5] border border-[#8b6f47]/30 p-3 rounded-xl mb-5 text-sm text-[#5a4a3f] flex gap-3 items-center shadow-sm">
                  <SmartphoneNfc className="h-6 w-6 text-[#8b6f47] shrink-0" />
                  <p>
                    Ready to push <b>{formatCurrency(amountToCharge)}</b> to the
                    physical card terminal.
                  </p>
                </div>
              )}

              <button
                onClick={onConfirmClick}
                disabled={!canSubmit}
                className={clsx(
                  "w-full flex items-center justify-center gap-3 rounded-xl px-4 py-4 text-lg font-bold text-white transition-all shadow-md active:scale-[0.98]",
                  canSubmit
                    ? "bg-[#1a1a1a] hover:bg-black"
                    : "bg-[#c4b9aa] cursor-not-allowed",
                )}
              >
                {submitting ? (
                  <Spinner className="h-6 w-6" />
                ) : (
                  <CheckCircle2 className="h-6 w-6" />
                )}
                {todayLocked
                  ? "POS Locked"
                  : method === "terminal"
                    ? "Send to Terminal"
                    : method === "card"
                      ? "Pay via Web Stripe"
                      : txType === "items" || txType === "addons"
                        ? "Complete & Print Receipt"
                        : "Confirm Booking"}
              </button>
            </div>
          </aside>
        </div>

        {terminalIntentId && (
          <TerminalWaitingSheet
            intentId={terminalIntentId}
            amount={amountToCharge}
            onCancel={() => setTerminalIntentId(null)}
            onSuccess={(paymentId) => {
              setTerminalIntentId(null);
              setReference(paymentId);
              handleCheckout(paymentId);
            }}
          />
        )}

        {cardOpen && piClientSecret && (
          <CardChargeSheet
            clientSecret={piClientSecret}
            amountCents={quote?.amountCents || Math.round(amountToCharge * 100)}
            currency="EUR"
            onClose={() => setCardOpen(false)}
            onSuccess={() => {
              setCardOpen(false);
              handleCheckout();
            }}
          />
        )}
      </div>
    </div>
  );
}

/* Components below are unchanged from your version */

function ExpGrid({ loading, list, selected, onSelect }) {
  if (loading)
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );

  if (!list.length)
    return <EmptyState caption="No experiences match your search." />;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
      {list.map((x) => (
        <button
          key={x.id}
          onClick={() => onSelect(x)}
          className={clsx(
            "text-left p-6 rounded-2xl border transition-all active:scale-95 duration-100 relative overflow-hidden flex flex-col h-32",
            x.id === selected?.id
              ? "border-[#8b6f47] bg-[#fdfaf5] ring-1 ring-[#8b6f47]/30 shadow-md"
              : "border-[#e0dcd4] bg-white hover:border-[#8b6f47]/40 hover:shadow-sm",
          )}
        >
          {x.id === selected?.id && (
            <div className="absolute top-0 right-0 border-t-[36px] border-r-[36px] border-t-[#8b6f47] border-r-transparent">
              <CheckCircle2 className="absolute -top-[32px] right-[4px] h-4 w-4 text-white" />
            </div>
          )}

          <h3 className="font-bold text-lg leading-tight mb-auto pr-6 text-[#2a1f18] line-clamp-2">
            {x.name}
          </h3>

          <p className="text-sm text-[#8b6f47] font-bold mt-2">
            {formatCurrency(x.pricing?.priceAdult ?? 0)}{" "}
            <span className="text-[#a09084] font-medium">/ adult</span>
          </p>
        </button>
      ))}
    </div>
  );
}

function ItemGrid({ loading, list, cartMap, onInc }) {
  if (loading)
    return (
      <div className="grid grid-cols-3 md:grid-cols-4 gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );

  if (!list.length) return <EmptyState caption="No items match your search." />;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
      {list.map((x) => {
        const qty = cartMap[x.id]?.qty || 0;

        return (
          <button
            key={x.id}
            onClick={() => onInc(x)}
            className={clsx(
              "flex flex-col text-left p-5 rounded-2xl border transition-all active:scale-95 h-32",
              qty > 0
                ? "border-[#8b6f47] bg-[#fdfaf5] shadow-md ring-1 ring-[#8b6f47]/30"
                : "border-[#e0dcd4] bg-white hover:border-[#8b6f47]/40 hover:shadow-sm",
            )}
          >
            <div className="flex-1">
              <h3 className="font-bold text-base line-clamp-2 text-[#2a1f18]">
                {x.name}
              </h3>

              {x.sku && (
                <span className="text-xs text-[#a09084] font-mono mt-1 block bg-[#f4f1ec] w-fit px-1.5 py-0.5 rounded">
                  {x.sku}
                </span>
              )}
            </div>

            <div className="flex justify-between items-end w-full mt-2">
              <span className="font-bold text-lg text-[#8b6f47]">
                {formatCurrency(x.price)}
              </span>

              {qty > 0 && (
                <span className="bg-[#8b6f47] text-white text-xs font-bold px-2.5 py-1 rounded-md shadow-sm">
                  {qty}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Counter({ label, value, onChange, min = 0 }) {
  return (
    <div className="bg-[#fdfbf7] border border-[#e0dcd4] rounded-xl p-3 flex flex-col items-center shadow-inner">
      <span className="text-[10px] font-bold text-[#a09084] uppercase tracking-widest mb-2">
        {label}
      </span>

      <div className="flex items-center gap-3 w-full justify-between">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-10 h-10 rounded-lg bg-white border border-[#d8cfc3] flex items-center justify-center text-[#4c4138] active:bg-[#f0e7d9] shadow-sm hover:border-[#8b6f47]/50 transition-colors"
        >
          <Minus className="h-5 w-5" />
        </button>

        <span className="text-xl font-bold font-serif">{value}</span>

        <button
          onClick={() => onChange(value + 1)}
          className="w-10 h-10 rounded-lg bg-white border border-[#d8cfc3] flex items-center justify-center text-[#4c4138] active:bg-[#f0e7d9] shadow-sm hover:border-[#8b6f47]/50 transition-colors"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function PayBtn({ active, onClick, icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex flex-col items-center justify-center p-3 rounded-xl border transition-all h-20",
        active
          ? "border-transparent bg-[#1a1a1a] text-white shadow-md scale-105"
          : "border-[#d8cfc3] bg-white hover:bg-[#fdfaf5] text-[#7a6a5f] hover:border-[#8b6f47]/50",
      )}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-wider mt-1">
        {label}
      </span>
    </button>
  );
}

function SegmentBtn({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-2 px-5 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
        active
          ? "bg-white text-[#4c4138] shadow-sm border border-[#e0dcd4]"
          : "text-[#8a7b70] hover:text-[#4c4138]",
      )}
    >
      {icon} {label}
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="h-32 rounded-2xl bg-gradient-to-r from-[#eee5da]/40 via-[#f3ede4]/40 to-[#eee5da]/40 animate-pulse border border-[#e0dcd4]" />
  );
}

function EmptyState({ caption }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-[#a09084] space-y-4 bg-white/50 m-6 rounded-3xl border-2 border-dashed border-[#e8e2d9]">
      <Search className="h-10 w-10 opacity-30 text-[#8b6f47]" />
      <p className="font-medium text-sm">{caption}</p>
    </div>
  );
}

function Spinner({ className }) {
  return (
    <svg className={clsx("animate-spin", className)} viewBox="0 0 24 24">
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        opacity="0.25"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
      />
    </svg>
  );
}

function Toast({ type = "success", children, onDismiss }) {
  return (
    <div
      className={clsx(
        "fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3 rounded-full shadow-xl border text-sm font-bold animate-in slide-in-from-top-6",
        type === "error"
          ? "bg-red-50 border-red-200 text-red-800"
          : "bg-[#1a1a1a] border-transparent text-white",
      )}
    >
      {type === "error" ? (
        <AlertTriangle className="h-5 w-5 text-red-600" />
      ) : (
        <CheckCircle2 className="h-5 w-5 text-[#8b6f47]" />
      )}

      {children}

      <button
        onClick={onDismiss}
        className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function TerminalWaitingSheet({ intentId, amount, onCancel, onSuccess }) {
  const [status, setStatus] = useState("pending");

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/pos/revolut/status?intentId=${intentId}`);
        const data = await res.json();

        setStatus(data.status);

        if (data.status === "completed") {
          clearInterval(interval);
          onSuccess(data.paymentId);
        }

        if (data.status === "failed" || data.status === "cancelled") {
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [intentId, onSuccess]);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="relative w-full max-w-sm rounded-[2rem] bg-white p-8 shadow-2xl text-center">
        <SmartphoneNfc className="h-16 w-16 text-[#8b6f47] mx-auto mb-5 animate-pulse" />
        <h3 className="text-2xl font-serif font-bold mb-2">Awaiting Tap</h3>
        <p className="text-[#7a6a5f] mb-8 text-sm">
          Please ask the customer to tap their card on the Terminal for{" "}
          <strong className="text-[#4c4138] text-base">
            {formatCurrency(amount)}
          </strong>
          .
        </p>

        {status === "failed" || status === "cancelled" ? (
          <div className="text-red-600 font-bold mb-6 bg-red-50 py-3 rounded-xl border border-red-100">
            Payment {status}. Please try again.
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest text-[#8b6f47] mb-8">
            <Spinner className="h-4 w-4" /> Polling terminal...
          </div>
        )}

        <button
          onClick={onCancel}
          className="w-full py-3.5 rounded-xl border border-[#d8cfc3] text-[#4c4138] font-bold uppercase tracking-widest hover:bg-[#f0e7d9] transition shadow-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function CardChargeSheet({
  clientSecret,
  amountCents,
  currency = "EUR",
  onClose,
  onSuccess,
}) {
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-[2rem] bg-white p-8 shadow-2xl"
      >
        <div className="mb-6 border-b border-[#e8e2d9] pb-4">
          <h3 className="text-2xl font-serif font-bold text-[#2a1f18]">
            Charge Card
          </h3>
          <p className="text-sm font-medium text-[#8b6f47] mt-1">
            Total Amount: {formatCurrency((amountCents || 0) / 100)}
          </p>
        </div>

        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              variables: { colorPrimary: ACCENT, borderRadius: "12px" },
            },
          }}
        >
          <CardChargeInner onClose={onClose} onSuccess={onSuccess} />
        </Elements>
      </div>
    </div>
  );
}

function CardChargeInner({ onClose, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onEsc(e) {
      if (e.key === "Escape") onClose?.();
    }

    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  async function handlePay() {
    if (!stripe || !elements) return;

    setBusy(true);
    setError(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });

    setBusy(false);

    if (error) {
      setError(error.message || "Payment failed");
      return;
    }

    const status = paymentIntent?.status;

    if (["succeeded", "requires_capture", "processing"].includes(status)) {
      await onSuccess?.();
    } else {
      setError(`Payment status: ${status}`);
    }
  }

  return (
    <div>
      <div className="rounded-xl border border-[#e6dfd6] bg-[#f9f8f5] p-4 mb-6 shadow-inner">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>

      {error && (
        <p className="mb-6 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          onClick={onClose}
          className="px-6 py-3 rounded-xl border border-[#d8cfc3] text-[#4c4138] font-bold uppercase tracking-widest hover:bg-[#f0e7d9] transition text-xs"
        >
          Cancel
        </button>

        <button
          onClick={handlePay}
          disabled={!stripe || !elements || busy}
          className={clsx(
            "px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-white transition shadow-md text-xs flex items-center gap-2",
            busy
              ? "bg-[#1a1a1a]/60 cursor-not-allowed"
              : "bg-[#1a1a1a] hover:bg-black",
          )}
        >
          {busy && <Spinner className="h-4 w-4" />}
          {busy ? "Processing…" : "Charge Card"}
        </button>
      </div>
    </div>
  );
}
