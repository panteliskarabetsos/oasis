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
  Printer,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  User,
  Mail,
  Phone,
  Tag,
  Check,
  ShoppingBag,
  Package2,
  RotateCcw,
  Info,
  Keyboard,
  X,
} from "lucide-react";

/* ====================================================================
   Design tokens & tiny UI helpers
   ==================================================================== */
const ACCENT = "#8b6f47"; // single source of truth for the brand accent
const RING = "ring-[rgba(139,111,71,0.25)]"; // Tailwind-friendly ring color

function clsx(...xs) {
  return xs.filter(Boolean).join(" ");
}
function formatCurrency(n) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
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
    d.getHours()
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
  if (!v) return true; // optional
  return /.+@.+\..+/.test(v);
}
function validatePhone(v) {
  if (!v) return true; // optional
  return /[0-9+\-()\s]{6,}/.test(v);
}

/* --------------------------------------------------------------------
   Stripe singleton (fixes scope bug in original file)
   -------------------------------------------------------------------- */
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

/* ====================================================================
   Page
   ==================================================================== */
export default function POSPage() {
  const router = useRouter();

  // Modes
  const [mode, setMode] = useState("experiences"); // 'experiences' | 'items'
  const [scanMode, setScanMode] = useState(false); // quick add first match on Enter
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Data
  const [experiences, setExperiences] = useState([]);
  const [items, setItems] = useState([]);
  const [loadingExp, setLoadingExp] = useState(true);
  const [loadingItems, setLoadingItems] = useState(true);

  // UI + selection
  const [queryRaw, setQueryRaw] = useState("");
  const [query, setQuery] = useState(""); // debounced
  const searchRef = useRef(null);
  const [selectedExperience, setSelectedExperience] = useState(null);

  // Item cart (id -> { id, name, price, sku?, qty })
  const [cartItems, setCartItems] = useState({});

  // Experience counts
  const [adults, setAdults] = useState(1);
  const [kids, setKids] = useState(0);

  // Discounts & codes
  const [manualDiscount, setManualDiscount] = useState(0);
  const [promoCode, setPromoCode] = useState("");
  const [giftCode, setGiftCode] = useState("");

  // Meta
  const [startTime, setStartTime] = useState(() =>
    toLocalDatetimeInputValue(addMinutes(new Date(), 10))
  );
  const minStartTime = toLocalDatetimeInputValue(new Date());

  // Customer
  const [custName, setCustName] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custPhone, setCustPhone] = useState("");

  // Payment
  const [method, setMethod] = useState("cash"); // 'cash' | 'card' | 'revolut' | 'comp'
  const [reference, setReference] = useState("");
  const [cardOpen, setCardOpen] = useState(false);
  const [piClientSecret, setPiClientSecret] = useState(null);
  const [piId, setPiId] = useState(null);
  const [quote, setQuote] = useState(null); // {amountCents, currency}

  // UX
  const [submitting, setSubmitting] = useState(false);
  const [serverMsg, setServerMsg] = useState(null); // {type, text}
  const [undoData, setUndoData] = useState(null); // for clear-cart undo

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
     Effects – search debounce + autofocus
     ------------------------------------------------------------------ */
  useEffect(() => {
    const t = setTimeout(() => setQuery(queryRaw.trim()), 180);
    return () => clearTimeout(t);
  }, [queryRaw]);

  useEffect(() => {
    searchRef.current?.focus();
  }, [mode]);

  /* ------------------------------------------------------------------
     Effects – keyboard shortcuts & unsaved-protect
     ------------------------------------------------------------------ */
  const hasAnyCart = useMemo(() => {
    const itemLines = Object.values(cartItems);
    return (
      (!!selectedExperience && adults + kids > 0) ||
      itemLines.some((l) => l.qty > 0)
    );
  }, [cartItems, selectedExperience, adults, kids]);

  useEffect(() => {
    function onKeyDown(e) {
      if (isInputFocused()) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "?" || (e.shiftKey && e.key.toLowerCase() === "/")) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }
      if (mode === "experiences") {
        if (e.key === "a") setAdults((v) => v + 1);
        if (e.key === "z") setAdults((v) => Math.max(0, v - 1));
        if (e.key === "k") setKids((v) => v + 1);
        if (e.key === "m") setKids((v) => Math.max(0, v - 1));
      }
      if (e.key === "Escape") {
        if (cardOpen) setCardOpen(false);
        else if (queryRaw) setQueryRaw("");
        else clearCart();
      }
      if (e.key === "Enter" && hasAnyCart) {
        // one-tap confirm from keyboard
        onConfirmClick();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    mode,
    cardOpen,
    queryRaw,
    hasAnyCart,
    method,
    selectedExperience,
    adults,
    kids,
  ]);

  useEffect(() => {
    const beforeUnload = (e) => {
      if (!hasAnyCart) return;
      e.preventDefault();
      e.returnValue = "You have an order in progress. Leave the page?";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [hasAnyCart]);

  /* ------------------------------------------------------------------
     Effects – persist draft to localStorage
     ------------------------------------------------------------------ */
  const DRAFT_KEY = "pos_draft_v3"; // bumped to avoid conflicts
  // Load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      setCartItems(d.cartItems || {});
      setAdults(d.adults ?? 1);
      setKids(d.kids ?? 0);
      setManualDiscount(d.manualDiscount || 0);
      setPromoCode(d.promoCode || "");
      setGiftCode(d.giftCode || "");
      setCustName(d.custName || "");
      setCustEmail(d.custEmail || "");
      setCustPhone(d.custPhone || "");
      setMethod(d.method || "cash");
      setReference(d.reference || "");
      setStartTime(
        d.startTime || toLocalDatetimeInputValue(addMinutes(new Date(), 10))
      );
      setMode(d.mode || "experiences");
    } catch {}
  }, []);
  // Save (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      const payload = {
        cartItems,
        adults,
        kids,
        manualDiscount,
        promoCode,
        giftCode,
        custName,
        custEmail,
        custPhone,
        method,
        reference,
        startTime,
        mode,
        selectedExperienceId: selectedExperience?.id || null,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    }, 220);
    return () => clearTimeout(t);
  }, [
    cartItems,
    adults,
    kids,
    manualDiscount,
    promoCode,
    giftCode,
    custName,
    custEmail,
    custPhone,
    method,
    reference,
    startTime,
    mode,
    selectedExperience,
  ]);

  // Rehydrate selected experience after experiences load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d?.selectedExperienceId && experiences?.length) {
        const x = experiences.find((e) => e.id === d.selectedExperienceId);
        if (x) setSelectedExperience(x);
      }
    } catch {}
  }, [experiences]);

  /* ------------------------------------------------------------------
     Derived values
     ------------------------------------------------------------------ */
  const filteredExperiences = useMemo(() => {
    const q = query.toLowerCase();
    const arr = experiences || [];
    if (!q) return arr;
    return arr.filter((x) =>
      (x.name + " " + (x.slug || "")).toLowerCase().includes(q)
    );
  }, [experiences, query]);

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase();
    const arr = items || [];
    if (!q) return arr;
    return arr.filter((x) =>
      (x.name + " " + (x.sku || "")).toLowerCase().includes(q)
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
        0
      ),
    [itemLines]
  );

  const gross = expSubtotal + itemsSubtotal;
  const clampedDiscount = Math.max(
    0,
    Math.min(Number(manualDiscount) || 0, Math.round(gross))
  );
  const previewTotal = Math.max(0, Math.round(gross - clampedDiscount));
  const totalToCollect = method === "comp" ? 0 : previewTotal;

  const canSubmit = useMemo(() => {
    const hasCart = hasAnyCart;
    const startValid =
      !selectedExperience || (startTime && isValidDateInput(startTime));
    const emailOk = validateEmail(custEmail);
    const phoneOk = validatePhone(custPhone);
    return !submitting && hasCart && startValid && emailOk && phoneOk;
  }, [
    hasAnyCart,
    selectedExperience,
    startTime,
    submitting,
    custEmail,
    custPhone,
  ]);

  /* ====================================================================
     Handlers
     ==================================================================== */
  const addItem = useCallback((it) => {
    setCartItems((prev) => {
      const cur = prev[it.id];
      const nextQty = (cur?.qty || 0) + 1;
      return {
        ...prev,
        [it.id]: {
          id: it.id,
          name: it.name,
          sku: it.sku || null,
          price: Number(it.price || 0),
          qty: nextQty,
        },
      };
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

  const setItemQty = useCallback((it, qty) => {
    const q = Math.max(0, Number(qty) || 0);
    setCartItems((prev) => {
      const copy = { ...prev };
      if (q === 0) delete copy[it.id];
      else
        copy[it.id] = {
          id: it.id,
          name: it.name,
          sku: it.sku || null,
          price: Number(it.price || 0),
          qty: q,
        };
      return copy;
    });
  }, []);

  const clearCart = useCallback(() => {
    setUndoData({
      selectedExperience,
      adults,
      kids,
      cartItems,
    });
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

  async function openCardCharge() {
    if (!hasAnyCart) {
      setServerMsg({
        type: "error",
        text: "Add an experience or items first.",
      });
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        experienceId: selectedExperience?.id ?? null,
        startTime: selectedExperience
          ? new Date(startTime).toISOString()
          : null,
        counts: selectedExperience ? { adults, kids } : null,
        items: Object.values(cartItems)
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
        customer: {
          name: custName || null,
          email: custEmail || null,
          phone: custPhone || null,
        },
        currency: "eur",
        clientGross: gross,
      };

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

  async function handleCheckout() {
    if (!hasAnyCart) {
      setServerMsg({
        type: "error",
        text: "Add an experience or at least one item.",
      });
      return;
    }
    if (selectedExperience && adults + kids <= 0) {
      setServerMsg({ type: "error", text: "Add at least one attendee." });
      return;
    }
    if (selectedExperience && !isValidDateInput(startTime)) {
      setServerMsg({ type: "error", text: "Choose a valid start time." });
      return;
    }
    if (!validateEmail(custEmail)) {
      setServerMsg({ type: "error", text: "Invalid email format." });
      return;
    }
    if (!validatePhone(custPhone)) {
      setServerMsg({ type: "error", text: "Invalid phone number." });
      return;
    }

    setSubmitting(true);
    setServerMsg(null);
    try {
      const payload = {
        experienceId: selectedExperience?.id ?? null,
        startTime: selectedExperience
          ? new Date(startTime).toISOString()
          : null,
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
        payment: { method, reference: reference.trim() || null },
        customer: {
          name: custName.trim() || null,
          email: custEmail.trim() || null,
          phone: custPhone.trim() || null,
        },
        currency: "eur",
        clientGross: gross,
      };

      const res = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Checkout failed");

      setServerMsg({
        type: "success",
        text: `Booking created (#${data.bookingId}).`,
      });
      clearCart();
      router.push(`/admin/bookings/${data.bookingId}`);
    } catch (e) {
      setServerMsg({ type: "error", text: e.message || "Checkout error" });
    } finally {
      setSubmitting(false);
    }
  }

  // If user chose card, Confirm should charge first then finalize
  function onConfirmClick() {
    if (method === "card") return openCardCharge();
    return handleCheckout();
  }

  // Add first matching item when scanning/SKU + Enter
  const onSearchKeyDown = (e) => {
    if (e.key !== "Enter") return;
    if (mode !== "items") return;
    if (!scanMode) return;
    const first = filteredItems[0];
    if (first) {
      e.preventDefault();
      addItem(first);
      setServerMsg({ type: "success", text: `Added \"${first.name}\"` });
      // Clear query to speed multiple scans
      setQueryRaw("");
    }
  };

  /* ====================================================================
     UI
     ==================================================================== */
  return (
    <div className="min-h-screen bg-[#f4f1ec] text-[#4c4138] selection:bg-[#f0e7d9]">
      {/* Ambient blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-24 h-[26rem] w-[26rem] rounded-full bg-[#e9e4dc] blur-3xl opacity-70"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-24 h-[30rem] w-[30rem] rounded-full bg-[#fff4e1] blur-3xl opacity-80"
      />

      <div className="relative mx-auto px-6 pt-4 pb-28 max-w-6xl xl:max-w-7xl">
        {/* Header */}
        <div className="sticky top-[env(safe-area-inset-top)] z-30 -mx-6 mb-4 bg-gradient-to-b from-[#f4f1ec]/95 to-[#f4f1ec]/50 backdrop-blur border-b border-[#e8e2d9] px-6 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-2xl md:text-3xl font-serif tracking-tight leading-tight">
                Point of Sale
              </h1>
              <span className="hidden sm:inline-flex items-center rounded-full border border-[#d8cfc3] bg-[#fffaf2] px-2 py-0.5 text-[11px]">
                Experiences • Items • Fast checkout
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={() => setShowShortcuts(true)}
                className="text-xs rounded-full border border-[#d8cfc3] bg-white/70 px-3 py-1 hover:bg-[#f1ede7] inline-flex items-center gap-1"
                title="Keyboard shortcuts"
              >
                <Keyboard className="h-3.5 w-3.5" /> Shortcuts
              </button>
              <button
                onClick={() => {
                  if (!hasAnyCart) return;
                  clearCart();
                  setServerMsg({
                    type: "success",
                    text: "Cart cleared. You can undo for a few seconds.",
                  });
                  setTimeout(() => setUndoData(null), 7000);
                }}
                className="text-xs rounded-full border border-[#d8cfc3] bg-white/70 px-3 py-1 hover:bg-[#f1ede7]"
                title="Clear cart"
              >
                Clear cart
              </button>
              <button
                onClick={undoClear}
                disabled={!undoData}
                className={clsx(
                  "inline-flex items-center gap-1 text-xs rounded-full border px-3 py-1",
                  undoData
                    ? "border-[#d8cfc3] bg-white/70 hover:bg-[#f1ede7]"
                    : "border-[#e8e2d9] bg-white/50 text-[#a19084] cursor-not-allowed"
                )}
                title="Undo clear"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Undo
              </button>
            </div>
          </div>
        </div>

        {/* Toast / Alert */}
        {serverMsg ? (
          <Toast type={serverMsg.type} onDismiss={() => setServerMsg(null)}>
            {serverMsg.text}
          </Toast>
        ) : null}

        {/* Undo chip for mobile */}
        {undoData ? (
          <div className="lg:hidden mb-3">
            <button
              onClick={undoClear}
              className="inline-flex items-center gap-1 rounded-full border border-[#d8cfc3] bg-white/80 px-3 py-1 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Undo clear
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Catalog */}
          <section className="lg:col-span-2 rounded-2xl bg-white/85 backdrop-blur border border-[#e0dcd4] shadow-xl p-4">
            {/* Segment switcher */}
            <div className="mb-3 flex items-center justify-between">
              <div
                className="inline-flex rounded-full border border-[#d8cfc3] bg-[#faf7f2] p-1"
                role="tablist"
                aria-label="Catalog type"
              >
                <SegmentBtn
                  active={mode === "experiences"}
                  onClick={() => setMode("experiences")}
                  icon={<Package2 className="h-3.5 w-3.5" />}
                  label="Experiences"
                />
                <SegmentBtn
                  active={mode === "items"}
                  onClick={() => setMode("items")}
                  icon={<ShoppingBag className="h-3.5 w-3.5" />}
                  label="Items"
                />
              </div>

              {/* Scan mode toggle for items */}
              <div
                className={clsx(
                  "hidden sm:flex items-center gap-2",
                  mode === "items" ? "" : "opacity-0 pointer-events-none"
                )}
              >
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={scanMode}
                    onChange={(e) => setScanMode(e.target.checked)}
                  />
                  Scan mode (Enter adds first match)
                </label>
              </div>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 mb-3">
              <div className="relative w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#7a6a5f]" />
                <input
                  ref={searchRef}
                  value={queryRaw}
                  onChange={(e) => setQueryRaw(e.target.value)}
                  onKeyDown={onSearchKeyDown}
                  placeholder={`Search ${mode}`}
                  aria-label={`Search ${mode}`}
                  className={clsx(
                    "w-full rounded-full border border-[#d8cfc3] bg-white/80 backdrop-blur px-9 py-2 text-sm placeholder:text-[#a09084] focus:outline-none focus:ring-2",
                    RING
                  )}
                />
                <div className="absolute right-2 top-1.5 hidden sm:flex gap-1">
                  <Kbd>/</Kbd>
                  <span className="text-[11px] text-[#8a7b70]">to focus</span>
                </div>
              </div>
              <HelpPopover onOpen={() => setShowShortcuts(true)} />
            </div>

            {/* Grid (Experiences or Items) */}
            {mode === "experiences" ? (
              <ExpGrid
                loading={loadingExp}
                list={filteredExperiences}
                selected={selectedExperience}
                onSelect={(x) => {
                  setSelectedExperience(x);
                  setAdults((v) => (v === 0 ? 1 : v));
                }}
              />
            ) : (
              <ItemGrid
                loading={loadingItems}
                list={filteredItems}
                cartMap={cartItems}
                onInc={addItem}
                onDec={decItem}
                setQty={setItemQty}
              />
            )}

            {/* Selection panel (only for experiences) */}
            {mode === "experiences" && (
              <div className="mt-4 rounded-xl border border-[#e6dfd6] p-4 bg-[#fdfbf7]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Selection</h4>
                  {selectedExperience ? (
                    <button
                      onClick={() => setSelectedExperience(null)}
                      className="text-xs rounded-full border border-[#d8cfc3] bg-white/70 px-2.5 py-1 hover:bg-[#f1ede7]"
                      title="Clear selection"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                {!selectedExperience ? (
                  <p className="text-sm text-[#7a6a5f]">
                    Pick an experience from the catalog.
                  </p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {/* Time with quick chips */}
                    <Field
                      label="Start time"
                      icon={<CalendarClock className="h-4 w-4" />}
                    >
                      <input
                        type="datetime-local"
                        min={minStartTime}
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className={clsx(
                          "w-full rounded-md border border-[#d8cfc3] bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2",
                          RING
                        )}
                      />
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[
                          { label: "Now", add: 0 },
                          { label: "+30m", add: 30 },
                          { label: "+1h", add: 60 },
                          { label: "+2h", add: 120 },
                        ].map((b) => (
                          <button
                            key={b.label}
                            type="button"
                            onClick={() =>
                              setStartTime(
                                toLocalDatetimeInputValue(
                                  addMinutes(new Date(), b.add)
                                )
                              )
                            }
                            className="text-[11px] rounded-full border border-[#d8cfc3] bg-white/80 px-2 py-1 hover:bg-[#f1ede7]"
                          >
                            {b.label}
                          </button>
                        ))}
                      </div>
                    </Field>

                    {/* Qty with presets */}
                    <div className="grid grid-cols-2 gap-3">
                      <Counter
                        label="Adults"
                        value={adults}
                        onChange={setAdults}
                        min={0}
                      />
                      <Counter
                        label="Kids"
                        value={kids}
                        onChange={setKids}
                        min={0}
                      />
                      <div className="col-span-2 flex items-center gap-2 mt-1">
                        <span className="text-xs text-[#7a6a5f]">Presets:</span>
                        {[
                          { a: 2, k: 0 },
                          { a: 4, k: 0 },
                          { a: 2, k: 2 },
                        ].map((p, i) => (
                          <button
                            key={i}
                            className="text-[11px] rounded-full border border-[#d8cfc3] bg-white/80 px-2 py-1 hover:bg-[#f1ede7]"
                            onClick={() => {
                              setAdults(p.a);
                              setKids(p.k);
                            }}
                          >
                            {p.a}A{p.k ? `/${p.k}K` : ""}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Right: Cart & Payment */}
          <section className="rounded-2xl bg-white/85 backdrop-blur border border-[#e0dcd4] shadow-xl p-4 lg:sticky lg:top-[calc(env(safe-area-inset-top)+56px)] h-max">
            <h3 className="font-semibold mb-3">Cart & Payment</h3>

            <div className="rounded-xl border border-[#e6dfd6] p-3 bg-[#fdfbf7] mb-3">
              {/* Experience summary */}
              {selectedExperience ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm min-w-0">
                      <p className="font-medium truncate">
                        {selectedExperience.name}
                      </p>
                      <p className="text-xs text-[#7a6a5f]">
                        {adults} adult × {formatCurrency(priceAdult)}
                        {kids > 0
                          ? `, ${kids} kid × ${formatCurrency(priceKid)}`
                          : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedExperience(null)}
                      className="text-[#7a6a5f] hover:text-[#5a4a3f]"
                      title="Remove"
                      aria-label="Remove experience"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="h-px bg-[#eee5da] my-2" />
                </>
              ) : null}

              {/* Item lines */}
              {itemLines.length > 0 ? (
                <ul className="space-y-2">
                  {itemLines.map((l) => (
                    <li key={l.id} className="flex items-center gap-2">
                      <div className="min-w-0 grow">
                        <p className="text-sm truncate">{l.name}</p>
                        <p className="text-xs text-[#7a6a5f]">
                          {l.sku ? `${l.sku} • ` : ""}
                          {formatCurrency(l.price)} each
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <IconBtn
                          onClick={() => decItem(l)}
                          ariaLabel="Decrease"
                        >
                          <Minus className="h-4 w-4" />
                        </IconBtn>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={l.qty}
                          onChange={(e) => setItemQty(l, e.target.value)}
                          className={clsx(
                            "w-14 text-center rounded-md border border-[#d8cfc3] bg-white/90 px-2 py-1 text-sm focus:outline-none focus:ring-2",
                            RING
                          )}
                        />
                        <IconBtn
                          onClick={() => addItem(l)}
                          ariaLabel="Increase"
                        >
                          <Plus className="h-4 w-4" />
                        </IconBtn>
                      </div>
                      <div className="w-20 text-right text-sm font-medium">
                        {formatCurrency((l.price || 0) * (l.qty || 0))}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}

              {!selectedExperience && itemLines.length === 0 ? (
                <EmptyState caption="Cart is empty." />
              ) : null}

              {/* Totals & codes */}
              <div className="mt-3 space-y-1 text-sm">
                <Row label="Subtotal" value={formatCurrency(gross)} />
                {!!promoCode && <Row label={`Promo: ${promoCode}`} value="—" />}
                {!!giftCode && <Row label={`Gift: ${giftCode}`} value="—" />}
                <CodeInput
                  label="Promo code"
                  value={promoCode}
                  onChange={setPromoCode}
                />
                <CodeInput
                  label="Gift card"
                  value={giftCode}
                  onChange={setGiftCode}
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#7a6a5f]">
                    Manual discount
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={manualDiscount}
                    onChange={(e) => setManualDiscount(e.target.value)}
                    className={clsx(
                      "w-24 rounded-md border border-[#d8cfc3] bg-white/90 px-2 py-1 text-sm focus:outline-none focus:ring-2",
                      RING
                    )}
                  />
                  {clampedDiscount > 0 && (
                    <span className="ml-auto text-[11px] text-[#6f6056]">
                      −{formatCurrency(clampedDiscount)}
                    </span>
                  )}
                </div>
                <div className="h-px bg-[#eee5da] my-2" />
                <Row
                  label={method === "comp" ? "Total (complimentary)" : "Total"}
                  value={formatCurrency(totalToCollect)}
                  strong
                />
              </div>
            </div>

            {/* Customer */}
            <div className="rounded-xl border border-[#e6dfd6] p-3 bg-[#fffdfa] mb-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-sm">Customer</h4>
                <span className="text-[11px] text-[#8a7b70]">optional</span>
              </div>
              <div className="grid gap-2">
                <FieldRow icon={<User className="h-4 w-4" />}>
                  <input
                    value={custName}
                    required
                    onChange={(e) => setCustName(e.target.value)}
                    placeholder="Full name"ß
                    className={clsx(
                      "w-full rounded-md border bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2",
                      RING,
                      "border-[#d8cfc3]"
                    )}
                  />
                </FieldRow>
                <FieldRow icon={<Mail className="h-4 w-4" />}>
                  <input
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    placeholder="Email"
                    className={clsx(
                      "w-full rounded-md border bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2",
                      validateEmail(custEmail)
                        ? clsx("border-[#d8cfc3]", RING)
                        : "border-red-300 focus:ring-red-200"
                    )}
                  />
                </FieldRow>
                <FieldRow icon={<Phone className="h-4 w-4" />}>
                  <input
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="Phone"
                    className={clsx(
                      "w-full rounded-md border bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2",
                      validatePhone(custPhone)
                        ? clsx("border-[#d8cfc3]", RING)
                        : "border-red-300 focus:ring-red-200"
                    )}
                  />
                </FieldRow>
              </div>
            </div>

            {/* Payment */}
            <div className="rounded-xl border border-[#e6dfd6] p-3 bg-[#fffdfa] mb-4">
              <h4 className="font-medium mb-2 text-sm">Payment</h4>
              <div
                className="grid grid-cols-2 gap-2"
                role="tablist"
                aria-label="Payment method"
              >
                <PayBtn
                  active={method === "cash"}
                  onClick={() => setMethod("cash")}
                  icon={<Banknote className="h-4 w-4" />}
                  label="Cash"
                />
                <PayBtn
                  active={method === "card"}
                  onClick={() => setMethod("card")}
                  icon={<CreditCard className="h-4 w-4" />}
                  label="Card"
                />
                <PayBtn
                  active={method === "revolut"}
                  onClick={() => setMethod("revolut")}
                  icon={<CreditCard className="h-4 w-4" />}
                  label="Revolut POS"
                />
                <PayBtn
                  active={method === "comp"}
                  onClick={() => setMethod("comp")}
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  label="Complimentary"
                />
              </div>
              <div className="mt-2">
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={
                    method === "card"
                      ? "Reference (auto) — pay to confirm"
                      : "Reference (last4 / tx id – optional)"
                  }
                  readOnly={method === "card"}
                  className={clsx(
                    "w-full rounded-md border border-[#d8cfc3] bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2",
                    RING
                  )}
                />
                {method === "card" ? (
                  <p className="mt-1 text-xs text-[#7a6a5f]">
                    Click <strong>Confirm</strong> to charge the card; the
                    booking is created automatically after successful payment.
                  </p>
                ) : null}
              </div>

              {method === "card" && (
                <div className="mt-2 flex items-center justify-end">
                  <button
                    onClick={openCardCharge}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm border border-[#d8cfc3] bg-white/80 hover:bg-[#f1ede7]"
                  >
                    <CreditCard className="h-4 w-4" /> Charge card
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={onConfirmClick}
              disabled={!canSubmit}
              className={clsx(
                "w-full inline-flex items-center justify-between gap-2 rounded-xl px-4 py-3 border border-[#d8cfc3] text-white transition text-sm shadow-sm",
                canSubmit
                  ? "bg-[#8b6f47] hover:brightness-110"
                  : "bg-[#8b6f47]/60 cursor-not-allowed"
              )}
              aria-label="Confirm and save booking"
            >
              <span className="inline-flex items-center gap-2">
                {submitting ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                {submitting ? "Creating booking…" : "Confirm & Save Booking"}
              </span>
              <span className="text-xs font-semibold bg-black/10 px-2 py-1 rounded-md">
                {formatCurrency(totalToCollect)}
              </span>
            </button>

            <div className="mt-3 text-xs text-[#7a6a5f] flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
              <p>
                This POS records the payment method but doesn’t charge a card
                unless you use <em>Charge card</em>. Otherwise, use your
                terminal (e.g., Revolut POS) and save the reference here.
              </p>
            </div>
          </section>
        </div>

        {/* Mobile bottom bar CTA */}
        <div className="lg:hidden fixed left-0 right-0 bottom-0 z-40 border-t border-[#e8e2d9] bg-[#f8f4ee]/90 backdrop-blur px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-[#7a6a5f] truncate">
                {selectedExperience
                  ? selectedExperience.name
                  : itemLines.length
                  ? `${itemLines.length} item${itemLines.length > 1 ? "s" : ""}`
                  : "No selection"}
              </p>
              <p className="text-sm font-semibold">
                {formatCurrency(totalToCollect)}
              </p>
            </div>
            <button
              onClick={onConfirmClick}
              disabled={!canSubmit}
              className={clsx(
                "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm border border-[#d8cfc3] text-white",
                canSubmit ? "bg-[#8b6f47]" : "bg-[#8b6f47]/50"
              )}
            >
              <Printer className="h-4 w-4" /> Confirm
            </button>
          </div>
        </div>

        {cardOpen && piClientSecret ? (
          <CardChargeSheet
            clientSecret={piClientSecret}
            amountCents={quote?.amountCents}
            currency={(quote?.currency || "eur").toUpperCase()}
            onClose={() => setCardOpen(false)}
            onSuccess={async () => {
              // After card confirmed, finalize booking (record the charge + create booking)
              try {
                setSubmitting(true);
                const payload = {
                  experienceId: selectedExperience?.id ?? null,
                  startTime: selectedExperience
                    ? new Date(startTime).toISOString()
                    : null,
                  counts: selectedExperience ? { adults, kids } : null,
                  items: Object.values(cartItems)
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
                  payment: { method: "card", reference: null },
                  customer: {
                    name: custName || null,
                    email: custEmail || null,
                    phone: custPhone || null,
                  },
                  currency: "eur",
                  clientGross: gross,
                  stripePaymentIntentId: piId,
                };

                const res = await fetch("/api/pos/checkout", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "Checkout failed");
                setServerMsg({
                  type: "success",
                  text: `Booking created (#${data.bookingId}).`,
                });
                setCardOpen(false);
                // clear cart and go
                setCartItems({});
                setAdults(1);
                setKids(0);
                setSelectedExperience(null);
                router.push(`/admin/bookings/${data.bookingId}`);
              } catch (e) {
                setServerMsg({
                  type: "error",
                  text: e.message || "Post-charge finalize error",
                });
              } finally {
                setSubmitting(false);
              }
            }}
          />
        ) : null}

        {/* Shortcuts modal */}
        {showShortcuts ? (
          <ShortcutsModal onClose={() => setShowShortcuts(false)} />
        ) : null}
      </div>
    </div>
  );
}

/* ====================================================================
   Catalog components
   ==================================================================== */
function ExpGrid({ loading, list, selected, onSelect }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {loading ? (
        Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
      ) : list.length > 0 ? (
        list.map((x) => (
          <button
            key={x.id}
            onClick={() => onSelect?.(x)}
            className={clsx(
              "group text-left rounded-xl border p-4 transition bg-white/90 hover:shadow-md",
              x.id === selected?.id
                ? "border-[#8b6f47] ring-2 ring-[#8b6f47]/30"
                : "border-[#e6dfd6] hover:border-[#d8cfc3]"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold truncate">{x.name}</h3>
                <p className="mt-1 text-xs text-[#7a6a5f] truncate">
                  {x.duration || 60} min
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge>
                    {formatCurrency(x.pricing?.priceAdult ?? 0)} adult
                  </Badge>
                  {Number(x.pricing?.priceKid) > 0 ? (
                    <Badge>{formatCurrency(x.pricing?.priceKid)} kid</Badge>
                  ) : null}
                </div>
              </div>
              <div className="shrink-0 opacity-60 group-hover:opacity-100 transition">
                <Check
                  className={clsx(
                    "h-5 w-5",
                    x.id === selected?.id ? "text-[#8b6f47]" : "text-[#7a6a5f]"
                  )}
                />
              </div>
            </div>
          </button>
        ))
      ) : (
        <div className="col-span-2">
          <EmptyState caption="No experiences match your search." />
        </div>
      )}
    </div>
  );
}

function ItemGrid({ loading, list, cartMap, onInc, onDec, setQty }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {loading ? (
        Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
      ) : list.length > 0 ? (
        list.map((x) => {
          const line = cartMap[x.id];
          const qty = line?.qty || 0;
          return (
            <div
              key={x.id}
              className={clsx(
                "rounded-xl border p-4 transition bg-white/90",
                qty > 0
                  ? "border-[#8b6f47] ring-2 ring-[#8b6f47]/20"
                  : "border-[#e6dfd6] hover:border-[#d8cfc3]"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{x.name}</h3>
                  <p className="text-xs text-[#7a6a5f] truncate">
                    {x.sku ? `${x.sku} • ` : ""}
                    {formatCurrency(x.price)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-sm font-medium">
                  {formatCurrency(x.price)}
                </div>
                <div className="flex items-center gap-1">
                  <IconBtn onClick={() => onDec?.(x)} ariaLabel="Decrease">
                    <Minus className="h-4 w-4" />
                  </IconBtn>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={qty}
                    onChange={(e) => setQty?.(x, e.target.value)}
                    className={clsx(
                      "w-14 text-center rounded-md border border-[#d8cfc3] bg-white/90 px-2 py-1 text-sm focus:outline-none focus:ring-2",
                      RING
                    )}
                  />
                  <IconBtn onClick={() => onInc?.(x)} ariaLabel="Increase">
                    <Plus className="h-4 w-4" />
                  </IconBtn>
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <div className="col-span-2">
          <EmptyState caption="No items match your search." />
        </div>
      )}
    </div>
  );
}

/* ====================================================================
   Small components
   ==================================================================== */
function Field({ label, icon, children }) {
  return (
    <label className="block">
      <span className="text-xs text-[#7a6a5f] flex items-center gap-1">
        {icon}
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
function FieldRow({ icon, children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-[#7a6a5f]">{icon}</span>
      <div className="grow">{children}</div>
    </div>
  );
}
function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between">
      <span className={clsx("text-sm", strong ? "font-semibold" : "")}>
        {label}
      </span>
      <span className={clsx("text-sm", strong ? "font-semibold" : "")}>
        {value}
      </span>
    </div>
  );
}
function CodeInput({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <Tag className="h-3.5 w-3.5" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        className={clsx(
          "w-full rounded-md border border-[#d8cfc3] bg-white/90 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2",
          RING
        )}
      />
    </div>
  );
}
function Counter({ label, value, onChange, min = 0, max = 999 }) {
  return (
    <div className="rounded-md border border-[#d8cfc3] bg-white/80 px-2 py-2">
      <div className="text-xs text-[#7a6a5f] mb-1">{label}</div>
      <div className="flex items-center gap-1">
        <IconBtn
          onClick={() => onChange(Math.max(min, (value || 0) - 1))}
          ariaLabel={`Decrease ${label}`}
        >
          <Minus className="h-4 w-4" />
        </IconBtn>
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={clsx(
            "w-14 text-center rounded-md border border-[#d8cfc3] bg-white/90 px-2 py-1 text-sm focus:outline-none focus:ring-2",
            RING
          )}
        />
        <IconBtn
          onClick={() => onChange(Math.min(max, (value || 0) + 1))}
          ariaLabel={`Increase ${label}`}
        >
          <Plus className="h-4 w-4" />
        </IconBtn>
      </div>
    </div>
  );
}
function PayBtn({ active, onClick, icon, label }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition",
        active
          ? "border-[#8b6f47] bg-[#8b6f47] text-white"
          : "border-[#d8cfc3] bg-white/80 hover:bg-[#f1ede7]"
      )}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}
function IconBtn({ children, onClick, ariaLabel }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-md border border-[#d8cfc3] bg-white/80 px-2 py-1 hover:bg-[#f1ede7] focus:outline-none focus:ring-2 ring-offset-1 ring-offset-white focus:ring-[rgba(139,111,71,0.25)]"
    >
      {children}
    </button>
  );
}
function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#e6dfd6] bg-[#faf7f2] px-2 py-0.5 text-[11px]">
      {children}
    </span>
  );
}
function Kbd({ children }) {
  return (
    <kbd className="px-1.5 py-0.5 rounded-md border border-[#ded7cd] bg-white/80 shadow-sm text-[10px] font-mono">
      {children}
    </kbd>
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
function SkeletonCard() {
  return (
    <div className="h-28 rounded-xl border border-[#eee5da] bg-gradient-to-r from-[#eee5da]/60 via-[#f3ede4]/60 to-[#eee5da]/60 animate-pulse" />
  );
}
function EmptyState({ caption }) {
  return (
    <div className="text-center text-sm text-[#7a6a5f] py-6 flex flex-col items-center gap-2">
      <Info className="h-5 w-5 opacity-70" />
      <p>{caption}</p>
    </div>
  );
}
function SegmentBtn({ active, onClick, icon, label }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition",
        active
          ? "bg-white shadow border border-[#e6dfd6]"
          : "text-[#7a6a5f] border border-transparent"
      )}
      aria-selected={active}
      onClick={onClick}
    >
      {icon} {label}
    </button>
  );
}
function HelpPopover({ onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="hidden sm:inline-flex items-center gap-1 rounded-full border border-[#d8cfc3] bg-white/80 px-3 py-1 text-xs hover:bg-[#f1ede7]"
      title="Keyboard shortcuts"
    >
      <Keyboard className="h-3.5 w-3.5" />
      Help
    </button>
  );
}
function Toast({ type = "success", children, onDismiss }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        "mb-4 rounded-xl border px-3 py-2 text-sm shadow-sm flex items-start gap-2",
        type === "error"
          ? "border-red-200 bg-red-50/90 text-red-800"
          : "border-emerald-200 bg-emerald-50/90 text-emerald-900"
      )}
    >
      <div className="pt-0.5">
        {type === "error" ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
      </div>
      <div className="min-w-0 grow">{children}</div>
      <button
        onClick={onDismiss}
        className="shrink-0 text-[#7a6a5f] hover:text-black/70"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ====================================================================
   Card charge sheet
   ==================================================================== */
function CardChargeSheet({
  clientSecret,
  amountCents,
  currency = "EUR",
  onClose,
  onSuccess,
}) {
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-[#e0dcd4] bg-white/95 p-4 shadow-2xl"
      >
        <div className="mb-2">
          <h3 className="text-lg font-semibold">Charge card</h3>
          <p className="text-sm text-[#7a6a5f]">
            Amount:{" "}
            <span className="font-medium">
              {formatCurrency((amountCents || 0) / 100)} {currency}
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
    if (
      status === "succeeded" ||
      status === "requires_capture" ||
      status === "processing"
    ) {
      await onSuccess?.();
    } else {
      setError(`Payment status: ${status}`);
    }
  }

  return (
    <div>
      <div className="rounded-md border border-[#e6dfd6] bg-white/80 p-3">
        <PaymentElement
          options={{
            paymentMethodOrder: ["card"],
            wallets: { applePay: "never", googlePay: "never" },
          }}
        />
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-full border border-[#d8cfc3] bg-white/80 px-3 py-1.5 text-sm hover:bg-[#f1ede7]"
        >
          Cancel
        </button>
        <button
          onClick={handlePay}
          disabled={!stripe || !elements || busy}
          className={clsx(
            "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm border border-[#d8cfc3] text-white",
            busy ? "bg-[#8b6f47]/60" : "bg-[#8b6f47] hover:brightness-110"
          )}
        >
          {busy ? "Processing…" : "Pay now"}
        </button>
      </div>
    </div>
  );
}

/* ====================================================================
   Shortcuts modal (UX discovery)
   ==================================================================== */
function ShortcutsModal({ onClose }) {
  useEffect(() => {
    function onEsc(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const rows = [
    ["/", "Focus search"],
    ["?", "Toggle this help"],
    ["Enter", "Confirm & save booking"],
    ["Esc", "Clear search / close / clear cart"],
    ["a / z", "Adults +1 / −1 (experiences)"],
    ["k / m", "Kids +1 / −1 (experiences)"],
  ];

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-[#e0dcd4] bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between mb-2">
          <div className="inline-flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Keyboard shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-[#d8cfc3] bg-white/80 w-8 h-8 inline-flex items-center justify-center"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {rows.map(([key, action]) => (
            <div key={key} className="flex items-center gap-3">
              <Kbd>{key}</Kbd>
              <span className="text-sm">{action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
