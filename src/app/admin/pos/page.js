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
  Info,
  X,
  SmartphoneNfc,
} from "lucide-react";

/* ====================================================================
   Design tokens & tiny UI helpers
   ==================================================================== */
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

/* ====================================================================
   Page
   ==================================================================== */
export default function POSPage() {
  const router = useRouter();

  // Modes & Types
  const [mode, setMode] = useState("experiences");
  const [txType, setTxType] = useState("experience"); // 'experience' | 'items' | 'addons'
  const [scanMode, setScanMode] = useState(true);

  // Data
  const [experiences, setExperiences] = useState([]);
  const [items, setItems] = useState([]);
  const [loadingExp, setLoadingExp] = useState(true);
  const [loadingItems, setLoadingItems] = useState(true);

  // UI + selection
  const [queryRaw, setQueryRaw] = useState("");
  const [query, setQuery] = useState("");
  const searchRef = useRef(null);
  const [selectedExperience, setSelectedExperience] = useState(null);

  // Cart
  const [cartItems, setCartItems] = useState({});
  const [adults, setAdults] = useState(1);
  const [kids, setKids] = useState(0);

  // Discounts & codes
  const [manualDiscount, setManualDiscount] = useState(0);
  const [promoCode, setPromoCode] = useState("");
  const [giftCode, setGiftCode] = useState("");

  // Meta
  const [startTime, setStartTime] = useState(() =>
    toLocalDatetimeInputValue(addMinutes(new Date(), 10)),
  );
  const [bookingRef, setBookingRef] = useState(""); // Used if txType === 'addons'

  // Customer
  const [custName, setCustName] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custPhone, setCustPhone] = useState("");

  // Payment
  const [method, setMethod] = useState("terminal");
  const [reference, setReference] = useState("");
  const [cardOpen, setCardOpen] = useState(false);
  const [piClientSecret, setPiClientSecret] = useState(null);
  const [piId, setPiId] = useState(null);
  const [quote, setQuote] = useState(null);

  // Terminal Integration
  const [terminalIntentId, setTerminalIntentId] = useState(null);

  // UX
  const [submitting, setSubmitting] = useState(false);
  const [serverMsg, setServerMsg] = useState(null);
  const [undoData, setUndoData] = useState(null);

  /* ------------------------------------------------------------------
     Effects – data fetch
     ------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------
     Effects – search debounce + barcode scanner trap
     ------------------------------------------------------------------ */
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
          (i) => i.sku === barcodeBuffer || i.name.includes(barcodeBuffer),
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

  /* ------------------------------------------------------------------
     Derived values
     ------------------------------------------------------------------ */
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
  const expSubtotal =
    (selectedExperience ? adults * priceAdult + kids * priceKid : 0) || 0;

  const itemLines = useMemo(() => Object.values(cartItems), [cartItems]);
  const itemsSubtotal = useMemo(
    () =>
      itemLines.reduce(
        (sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 0),
        0,
      ),
    [itemLines],
  );

  const gross = expSubtotal + itemsSubtotal;
  const clampedDiscount = Math.max(
    0,
    Math.min(Number(manualDiscount) || 0, Math.round(gross)),
  );
  const previewTotal = Math.max(0, Math.round(gross - clampedDiscount));
  const totalToCollect = method === "comp" ? 0 : previewTotal;

  const hasAnyCart = useMemo(() => {
    return (
      (!!selectedExperience && adults + kids > 0) ||
      itemLines.some((l) => l.qty > 0)
    );
  }, [cartItems, selectedExperience, adults, kids]);

  const canSubmit = useMemo(() => {
    const emailOk = validateEmail(custEmail);
    const phoneOk = validatePhone(custPhone);

    if (txType === "experience") {
      const startValid =
        !!selectedExperience && startTime && isValidDateInput(startTime);
      return !submitting && hasAnyCart && startValid && emailOk && phoneOk;
    } else {
      // items or addons flow (doesn't require a selected experience)
      return !submitting && itemLines.length > 0 && emailOk && phoneOk;
    }
  }, [
    txType,
    hasAnyCart,
    selectedExperience,
    startTime,
    submitting,
    custEmail,
    custPhone,
    itemLines,
  ]);

  /* ====================================================================
     Handlers (Cart & Manual Pricing)
     ==================================================================== */
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
      },
    }));
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
    setUndoData({ selectedExperience, adults, kids, cartItems });
    setCartItems({});
    setAdults(1);
    setKids(0);
    setSelectedExperience(null);
  }, [selectedExperience, adults, kids, cartItems]);

  const undoClear = useCallback(() => {
    if (!undoData) return;
    setSelectedExperience(undoData.selectedExperience || null);
    setAdults(undoData.adults ?? 1);
    setKids(undoData.kids ?? 0);
    setCartItems(undoData.cartItems || {});
    setUndoData(null);
  }, [undoData]);

  /* ====================================================================
     Checkout
     ==================================================================== */
  async function openCardCharge() {
    if (!hasAnyCart)
      return setServerMsg({ type: "error", text: "Cart is empty." });
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
    try {
      setSubmitting(true);
      const res = await fetch("/api/pos/revolut/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: totalToCollect,
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

      if (txType === "items") {
        setServerMsg({ type: "success", text: `Receipt generated.` });
        clearCart();
        // Route to receipts page if you have one, else fallback to a generic success page
        router.push(
          `/admin/receipts/${data.receiptId || data.bookingId || ""}`,
        );
      } else {
        setServerMsg({ type: "success", text: `Booking recorded.` });
        clearCart();
        router.push(`/admin/bookings/${data.bookingId}`);
      }
    } catch (e) {
      setServerMsg({ type: "error", text: e.message || "Checkout error" });
    } finally {
      setSubmitting(false);
    }
  }

  function createPayload(overrideRef = null) {
    return {
      transactionType: txType, // "experience" | "items" | "addons"
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
        })),
      manualDiscount: Number(clampedDiscount) || 0,
      promoCode: promoCode.trim() || null,
      giftCode: giftCode.trim() || null,
      payment: { method, reference: overrideRef ?? (reference.trim() || null) },
      customer: {
        name: custName.trim() || null,
        email: custEmail.trim() || null,
        phone: custPhone.trim() || null,
      },
      currency: "eur",
      clientGross: gross,
      stripePaymentIntentId: method === "card" ? piId : null,
    };
  }

  function onConfirmClick() {
    if (method === "card") return openCardCharge();
    if (method === "terminal") return openTerminalCharge();
    return handleCheckout();
  }

  /* ====================================================================
     UI
     ==================================================================== */
  return (
    <div className="min-h-screen bg-[#f4f1ec] text-[#4c4138] selection:bg-[#f0e7d9] font-sans">
      <div className="relative mx-auto px-4 sm:px-6 pt-4 pb-28 h-screen flex flex-col max-w-[1600px]">
        {/* Header */}
        <header className="shrink-0 mb-4 bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-[#e8e2d9] p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-serif font-semibold tracking-tight">
              Terminal POS
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
                label="Items"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={addCustomItem}
              className="hidden sm:flex px-4 py-2 text-sm font-medium text-[#4c4138] bg-white border border-[#d8cfc3] hover:bg-[#f0e7d9] rounded-xl transition items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Custom Charge
            </button>
            <button
              onClick={() => {
                if (hasAnyCart) clearCart();
              }}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition"
            >
              Clear Cart
            </button>
          </div>
        </header>

        {serverMsg && (
          <Toast type={serverMsg.type} onDismiss={() => setServerMsg(null)}>
            {serverMsg.text}
          </Toast>
        )}

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
          {/* Left: Catalog */}
          <main className="flex-1 flex flex-col bg-white/90 backdrop-blur border border-[#e0dcd4] shadow-md rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-[#e0dcd4] bg-[#fdfbf7] flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 h-5 w-5 text-[#8b6f47]" />
                <input
                  ref={searchRef}
                  value={queryRaw}
                  onChange={(e) => setQueryRaw(e.target.value)}
                  placeholder={`Search or scan ${mode}...`}
                  className={clsx(
                    "w-full rounded-xl border border-[#d8cfc3] bg-white px-10 py-3 text-base placeholder:text-[#a09084] focus:outline-none focus:ring-2 focus:border-[#8b6f47]",
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
                    setTxType("experience"); // Auto switch mode to experience
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

          {/* Right: Cart Panel */}
          <aside className="w-full lg:w-[420px] xl:w-[480px] shrink-0 flex flex-col bg-white border border-[#e0dcd4] shadow-xl rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-[#e0dcd4] bg-[#faf7f2]">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
                <ShoppingBag className="h-5 w-5 text-[#8b6f47]" /> Current Order
              </h2>

              {/* Transaction Type Selector */}
              <div className="flex bg-[#e0dcd4]/50 border border-[#d8cfc3] rounded-lg p-1">
                <button
                  onClick={() => setTxType("experience")}
                  className={clsx(
                    "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all",
                    txType === "experience"
                      ? "bg-white text-[#4c4138] shadow-sm"
                      : "text-[#7a6a5f] hover:text-[#4c4138]",
                  )}
                >
                  Experience Booking
                </button>
                <button
                  onClick={() => {
                    setTxType("items");
                    setSelectedExperience(null);
                  }}
                  className={clsx(
                    "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all",
                    txType === "items"
                      ? "bg-white text-[#4c4138] shadow-sm"
                      : "text-[#7a6a5f] hover:text-[#4c4138]",
                  )}
                >
                  Items (Receipt)
                </button>
                <button
                  onClick={() => {
                    setTxType("addons");
                    setSelectedExperience(null);
                  }}
                  className={clsx(
                    "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all",
                    txType === "addons"
                      ? "bg-white text-[#4c4138] shadow-sm"
                      : "text-[#7a6a5f] hover:text-[#4c4138]",
                  )}
                >
                  Add-ons
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#fdfbf7]">
              {/* Experience Config */}
              {txType === "experience" && selectedExperience && (
                <div className="bg-white border border-[#8b6f47]/40 rounded-xl p-4 shadow-sm relative">
                  <button
                    onClick={() => setSelectedExperience(null)}
                    className="absolute top-3 right-3 text-red-400 hover:text-red-600 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <h3 className="font-bold text-lg mb-1 pr-6">
                    {selectedExperience.name}
                  </h3>
                  <p className="text-sm text-[#7a6a5f] mb-4">
                    {formatCurrency(priceAdult)} / adult •{" "}
                    {formatCurrency(priceKid)} / kid
                  </p>

                  <div className="grid grid-cols-2 gap-4">
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
                  <div className="mt-4">
                    <label className="text-sm font-medium text-[#7a6a5f] block mb-1">
                      Time
                    </label>
                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full rounded-lg border border-[#d8cfc3] px-3 py-2 text-sm focus:ring-2 focus:ring-[#8b6f47]/30"
                    />
                  </div>
                </div>
              )}

              {/* Items List (Inline Editable) */}
              {itemLines.length > 0 && (
                <div className="bg-white border border-[#e6dfd6] rounded-xl overflow-hidden shadow-sm">
                  {itemLines.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center gap-3 p-3 border-b border-[#f0ebe1] last:border-0 hover:bg-[#fbf9f6] transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <input
                          value={l.name}
                          onChange={(e) => setItemName(l, e.target.value)}
                          placeholder="Item name"
                          className="font-medium text-sm w-full bg-transparent border-b border-transparent hover:border-[#d8cfc3] focus:border-[#8b6f47] focus:outline-none transition-colors truncate pb-0.5"
                        />
                        <div className="flex items-center mt-1">
                          <span className="text-xs text-[#8a7b70] mr-1">€</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={l.price}
                            onChange={(e) => setItemPriceRaw(l, e.target.value)}
                            placeholder="0.00"
                            className="text-xs font-mono text-[#8a7b70] w-20 bg-transparent border-b border-transparent hover:border-[#d8cfc3] focus:border-[#8b6f47] focus:outline-none transition-colors pb-0.5"
                          />
                        </div>
                      </div>
                      <div className="flex items-center bg-[#f4f1ec] rounded-lg p-1 border border-[#e8e2d9] shrink-0">
                        <button
                          onClick={() => decItem(l)}
                          className="p-1.5 hover:bg-white rounded-md text-[#7a6a5f] transition-colors"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center font-semibold text-sm">
                          {l.qty}
                        </span>
                        <button
                          onClick={() => addItem(l)}
                          className="p-1.5 hover:bg-white rounded-md text-[#7a6a5f] transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="w-16 text-right font-medium shrink-0 text-[#4c4138]">
                        {formatCurrency((Number(l.price) || 0) * l.qty)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add-ons Configuration */}
              {txType === "addons" && (
                <div className="space-y-3 pt-2">
                  <input
                    placeholder="Existing Booking Reference (Optional)"
                    value={bookingRef}
                    onChange={(e) => setBookingRef(e.target.value)}
                    className="w-full rounded-lg border border-[#d8cfc3] px-3 py-2.5 text-sm"
                  />
                </div>
              )}

              {/* Empty State */}
              {((txType === "experience" && !selectedExperience) ||
                (txType !== "experience" && itemLines.length === 0)) && (
                <div className="text-center py-12 px-4 text-[#a09084]">
                  <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="mb-6">
                    {txType === "experience"
                      ? "Tap an experience on the left to build the booking."
                      : "Tap items on the left or add a custom charge."}
                  </p>
                  {txType !== "experience" && (
                    <button
                      onClick={addCustomItem}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-[#d8cfc3] text-[#4c4138] rounded-xl hover:bg-[#f0e7d9] transition shadow-sm font-medium"
                    >
                      <Plus className="h-4 w-4" /> Add Custom Charge
                    </button>
                  )}
                </div>
              )}

              {/* Discount / Customer */}
              <div className="space-y-3 pt-2">
                <input
                  placeholder="Customer Email (Optional)"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  className="w-full rounded-lg border border-[#d8cfc3] px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            {/* Payment Footer */}
            <div className="bg-white border-t border-[#e0dcd4] p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <p className="text-sm text-[#7a6a5f]">Total Amount</p>
                  <p className="text-3xl font-bold tracking-tight text-[#4c4138]">
                    {formatCurrency(totalToCollect)}
                  </p>
                </div>
              </div>

              {/* POS Payment Methods */}
              <div className="grid grid-cols-4 gap-2 mb-4">
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
                  label="Web Card"
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

              {method === "terminal" && (
                <div className="bg-[#f0e7d9]/50 border border-[#d8cfc3] p-3 rounded-xl mb-4 text-sm text-[#5a4a3f] flex gap-3 items-center">
                  <SmartphoneNfc className="h-6 w-6 text-[#8b6f47] shrink-0" />
                  <p>
                    Click below to send <b>{formatCurrency(totalToCollect)}</b>{" "}
                    to the physical terminal.
                  </p>
                </div>
              )}

              <button
                onClick={onConfirmClick}
                disabled={!canSubmit}
                className={clsx(
                  "w-full flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-lg font-semibold text-white transition shadow-md",
                  canSubmit
                    ? "bg-[#8b6f47] hover:bg-[#765e3c]"
                    : "bg-[#c4b9aa] cursor-not-allowed",
                )}
              >
                {submitting ? (
                  <Spinner className="h-5 w-5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" />
                )}
                {method === "terminal"
                  ? "Push to Terminal"
                  : method === "card"
                    ? "Pay via Stripe"
                    : txType === "items"
                      ? "Generate Receipt"
                      : "Complete Order"}
              </button>
            </div>
          </aside>
        </div>

        {/* Polling Modal for Hardware Terminal */}
        {terminalIntentId && (
          <TerminalWaitingSheet
            intentId={terminalIntentId}
            amount={totalToCollect}
            onCancel={() => setTerminalIntentId(null)}
            onSuccess={(paymentId) => {
              setTerminalIntentId(null);
              setReference(paymentId);
              handleCheckout(paymentId);
            }}
          />
        )}

        {/* Stripe Web Card Checkout Modal */}
        {cardOpen && piClientSecret && (
          <CardChargeSheet
            clientSecret={piClientSecret}
            amountCents={quote?.amountCents || Math.round(totalToCollect * 100)}
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

/* ====================================================================
   Components
   ==================================================================== */
function ExpGrid({ loading, list, selected, onSelect }) {
  if (loading)
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  if (!list.length)
    return <EmptyState caption="No experiences match your search." />;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {list.map((x) => (
        <button
          key={x.id}
          onClick={() => onSelect(x)}
          className={clsx(
            "text-left p-5 rounded-2xl border transition-all active:scale-95 duration-100 relative overflow-hidden",
            x.id === selected?.id
              ? "border-[#8b6f47] bg-[#fbf9f6] ring-2 ring-[#8b6f47]/30 shadow-md"
              : "border-[#e0dcd4] bg-white hover:border-[#d8cfc3] hover:shadow-sm",
          )}
        >
          {x.id === selected?.id && (
            <div className="absolute top-0 right-0 border-t-[30px] border-r-[30px] border-t-[#8b6f47] border-r-transparent">
              <Check className="absolute -top-[28px] right-[2px] h-4 w-4 text-white" />
            </div>
          )}
          <h3 className="font-bold text-lg leading-tight mb-2 pr-4">
            {x.name}
          </h3>
          <p className="text-sm text-[#7a6a5f] font-medium">
            {formatCurrency(x.pricing?.priceAdult ?? 0)} / adult
          </p>
        </button>
      ))}
    </div>
  );
}

function ItemGrid({ loading, list, cartMap, onInc }) {
  if (loading)
    return (
      <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  if (!list.length) return <EmptyState caption="No items match your search." />;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {list.map((x) => {
        const qty = cartMap[x.id]?.qty || 0;
        return (
          <button
            key={x.id}
            onClick={() => onInc(x)}
            className={clsx(
              "flex flex-col text-left p-4 rounded-2xl border transition-all active:scale-95 h-32",
              qty > 0
                ? "border-[#8b6f47] bg-[#fbf9f6] shadow-md ring-1 ring-[#8b6f47]/20"
                : "border-[#e0dcd4] bg-white hover:border-[#d8cfc3]",
            )}
          >
            <div className="flex-1">
              <h3 className="font-semibold text-base line-clamp-2">{x.name}</h3>
              {x.sku && (
                <span className="text-xs text-[#a09084] font-mono mt-1 block">
                  {x.sku}
                </span>
              )}
            </div>
            <div className="flex justify-between items-end w-full">
              <span className="font-bold text-lg text-[#4c4138]">
                {formatCurrency(x.price)}
              </span>
              {qty > 0 && (
                <span className="bg-[#8b6f47] text-white text-xs font-bold px-2 py-1 rounded-full">
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
    <div className="bg-[#fdfbf7] border border-[#e0dcd4] rounded-xl p-2 flex flex-col items-center">
      <span className="text-xs font-semibold text-[#8a7b70] uppercase tracking-wider mb-2">
        {label}
      </span>
      <div className="flex items-center gap-3 w-full justify-between">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-10 h-10 rounded-lg bg-white border border-[#d8cfc3] flex items-center justify-center text-[#4c4138] active:bg-[#f0e7d9]"
        >
          <Minus className="h-5 w-5" />
        </button>
        <span className="text-xl font-bold">{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          className="w-10 h-10 rounded-lg bg-white border border-[#d8cfc3] flex items-center justify-center text-[#4c4138] active:bg-[#f0e7d9]"
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
        "flex flex-col items-center justify-center p-3 rounded-xl border transition-colors h-20",
        active
          ? "border-[#8b6f47] bg-[#8b6f47] text-white shadow-inner"
          : "border-[#d8cfc3] bg-[#faf7f2] hover:bg-[#f0e7d9] text-[#7a6a5f]",
      )}
    >
      {icon}
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}

function SegmentBtn({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
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
    <div className="flex flex-col items-center justify-center h-full text-[#a09084] space-y-3">
      <Info className="h-8 w-8 opacity-50" />
      <p>{caption}</p>
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
        "fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-3 rounded-full shadow-lg border text-sm font-medium animate-in slide-in-from-top-4",
        type === "error"
          ? "bg-red-50 border-red-200 text-red-800"
          : "bg-emerald-50 border-emerald-200 text-emerald-900",
      )}
    >
      {type === "error" ? (
        <AlertTriangle className="h-5 w-5" />
      ) : (
        <CheckCircle2 className="h-5 w-5" />
      )}
      {children}
      <button onClick={onDismiss} className="ml-2 opacity-60 hover:opacity-100">
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
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl text-center">
        <SmartphoneNfc className="h-16 w-16 text-[#8b6f47] mx-auto mb-4 animate-pulse" />
        <h3 className="text-xl font-bold mb-2">Awaiting Payment</h3>
        <p className="text-[#7a6a5f] mb-6">
          Please ask the customer to tap their card on the Revolut Terminal for{" "}
          <strong>{formatCurrency(amount)}</strong>.
        </p>
        {status === "failed" || status === "cancelled" ? (
          <div className="text-red-600 font-medium mb-6">
            Payment {status}. Please try again.
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-sm font-medium text-[#8b6f47] mb-6">
            <Spinner className="h-4 w-4" /> Polling terminal...
          </div>
        )}
        <button
          onClick={onCancel}
          className="w-full py-3 rounded-xl border border-[#d8cfc3] text-[#4c4138] font-semibold hover:bg-[#f0e7d9] transition"
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
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4">
          <h3 className="text-xl font-bold">Charge Card (Web)</h3>
          <p className="text-sm text-[#7a6a5f]">
            Amount:{" "}
            <span className="font-medium">
              {formatCurrency((amountCents || 0) / 100)}
            </span>
          </p>
        </div>
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: { variables: { colorPrimary: ACCENT } },
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
      <div className="rounded-xl border border-[#e6dfd6] bg-[#f9f8f5] p-3 mb-4">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>
      {error && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl border border-[#d8cfc3] text-[#4c4138] font-semibold hover:bg-[#f0e7d9] transition"
        >
          Cancel
        </button>
        <button
          onClick={handlePay}
          disabled={!stripe || !elements || busy}
          className={clsx(
            "px-6 py-2 rounded-xl font-semibold text-white transition shadow-sm",
            busy ? "bg-[#8b6f47]/60" : "bg-[#8b6f47] hover:bg-[#765e3c]",
          )}
        >
          {busy ? "Processing…" : "Charge Card"}
        </button>
      </div>
    </div>
  );
}
