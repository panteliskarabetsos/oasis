"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { SmartphoneNfc } from "lucide-react";

import Icon from "../_ui/Icon";
import {
  Badge,
  Button,
  Card,
  Field,
  Muted,
  Page,
  PageHeader,
  Skeleton,
  inputClass,
} from "../_ui";

/* The Stripe card sheet and the Revolut terminal sheet at the bottom of this
   file are preserved exactly as they were — they talk to payment hardware and
   there is no terminal here to re-test them against. */

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


const TENDER_NOTES = [5, 10, 20, 50, 100];

/* --------------------------------- page ---------------------------------- */

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
  const [category, setCategory] = useState("all");
  const searchRef = useRef(null);
  const [selectedExperience, setSelectedExperience] = useState(null);

  const [cartItems, setCartItems] = useState({});
  const [adults, setAdults] = useState(1);
  const [kids, setKids] = useState(0);

  const [discountMode, setDiscountMode] = useState("amount"); // 'amount' | 'percent'
  const [discountInput, setDiscountInput] = useState(0);
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
  const [linkSession, setLinkSession] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [undoData, setUndoData] = useState(null);
  const [heldOrders, setHeldOrders] = useState([]);
  const [heldOpen, setHeldOpen] = useState(false);
  const [todayLocked, setTodayLocked] = useState(false);

  /* ------------------------------- loading -------------------------------- */

  useEffect(() => {
    try {
      setHeldOrders(JSON.parse(localStorage.getItem("oasis_pos_held_orders") || "[]"));
    } catch {
      setHeldOrders([]);
    }
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/reports/daily?date=${todayISO()}`, { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        if (!cancel) setTodayLocked(Boolean(j?.locked));
      } catch {
        /* non-critical */
      }
    })();
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch("/api/pos/experiences", { cache: "no-store", credentials: "include" });
        if (!res.ok) throw new Error("Failed to load experiences");
        const data = await res.json();
        if (!cancel) setExperiences(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancel) {
          setExperiences([]);
          toast.error(e.message || "Could not load experiences.");
        }
      } finally {
        if (!cancel) setLoadingExp(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch("/api/pos/items", { cache: "no-store", credentials: "include" });
        const data = res.ok ? await res.json() : [];
        if (!cancel) setItems(Array.isArray(data) ? data : []);
      } catch {
        if (!cancel) setItems([]);
      } finally {
        if (!cancel) setLoadingItems(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setQuery(queryRaw.trim()), 180);
    return () => clearTimeout(t);
  }, [queryRaw]);

  /* --------------------------- barcode scanner ----------------------------- */
  // A hardware scanner types very fast then sends Enter; a 50ms gap resets the
  // buffer so ordinary typing never accumulates.
  useEffect(() => {
    let buffer = "";
    let timer;

    function onKeyDown(e) {
      if (isInputFocused() && e.target !== searchRef.current) return;
      if (e.key.length !== 1 && e.key !== "Enter") return;

      if (e.key === "Enter" && buffer.length > 3) {
        const needle = buffer.toLowerCase();
        const match = items.find(
          (i) => i.sku === buffer || String(i.name || "").toLowerCase().includes(needle),
        );
        if (match) {
          if (isOutOfStock(match)) toast.error(`${match.name} is out of stock.`);
          else {
            addItem(match);
            // A scan can land while the Experiences tab is showing, which hid
            // the thing that was just added.
            setMode("items");
            toast.success(`Scanned: ${match.name}`);
          }
          setQueryRaw("");
        } else {
          toast.error(`No product matches "${buffer}".`);
        }
        buffer = "";
        return;
      }

      if (e.key.length === 1) {
        buffer += e.key;
        clearTimeout(timer);
        timer = setTimeout(() => { buffer = ""; }, 50);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  /* -------------------------------- derived -------------------------------- */

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category).filter(Boolean));
    return ["all", ...Array.from(set).sort()];
  }, [items]);

  const filteredExperiences = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return experiences;
    return experiences.filter((x) => `${x.name} ${x.slug || ""}`.toLowerCase().includes(q));
  }, [experiences, query]);

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter((x) => {
      if (category !== "all" && x.category !== category) return false;
      if (!q) return true;
      return `${x.name} ${x.sku || ""}`.toLowerCase().includes(q);
    });
  }, [items, query, category]);

  const priceAdult = selectedExperience?.pricing?.priceAdult ?? 0;
  const priceKid = selectedExperience?.pricing?.priceKid ?? 0;
  const expGross = (selectedExperience ? adults * priceAdult + kids * priceKid : 0) || 0;
  const expVatRate = 0.24;
  const expVatTotal = expGross - expGross / (1 + expVatRate);

  const itemLines = useMemo(() => Object.values(cartItems), [cartItems]);
  // Lines in the basket, counting a selected experience as one.
  const cartLineCount = itemLines.length + (selectedExperience ? 1 : 0);

  const itemsGross = useMemo(
    () => itemLines.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0),
    [itemLines],
  );

  const itemsVatTotal = useMemo(
    () =>
      itemLines.reduce((s, it) => {
        const gross = (Number(it.price) || 0) * (Number(it.qty) || 0);
        const rate = Number(it.vat ?? 24) / 100;
        return s + (gross - gross / (1 + rate));
      }, 0),
    [itemLines],
  );

  const totalGross = expGross + itemsGross;

  // The server contract takes an absolute discount; percent is a till-side convenience.
  const rawDiscount =
    discountMode === "percent"
      ? (totalGross * (Number(discountInput) || 0)) / 100
      : Number(discountInput) || 0;
  const clampedDiscount = Math.max(0, Math.min(rawDiscount, totalGross));

  const finalTotalToCollect = Math.max(0, totalGross - clampedDiscount);
  const discountRatio = totalGross > 0 ? clampedDiscount / totalGross : 0;
  const finalVatTotal = (expVatTotal + itemsVatTotal) * (1 - discountRatio);
  const finalNetTotal = finalTotalToCollect - finalVatTotal;

  const amountToCharge = method === "comp" ? 0 : finalTotalToCollect;
  const cashReceivedAmount = Number(cashReceived) || 0;
  const changeDue = method === "cash" ? Math.max(0, cashReceivedAmount - amountToCharge) : 0;
  const cashShort = method === "cash" && cashReceivedAmount < amountToCharge;

  const hasAnyCart = useMemo(
    () => (!!selectedExperience && adults + kids > 0) || itemLines.some((l) => l.qty > 0),
    [itemLines, selectedExperience, adults, kids],
  );

  const emailOk = validateEmail(custEmail);
  const phoneOk = validatePhone(custPhone);

  const blockers = useMemo(() => {
    const out = [];
    if (todayLocked) out.push("Today's Z-report is locked.");
    if (!hasAnyCart) out.push("The cart is empty.");
    if (!emailOk) out.push("Customer email is missing or invalid.");
    if (!phoneOk) out.push("Customer phone is missing or invalid.");
    if (method === "cash" && cashShort) out.push("Cash received is less than the total.");
    if (txType === "experience") {
      if (!selectedExperience) out.push("Pick an experience.");
      else if (!startTime || !isValidDateInput(startTime)) out.push("Set a valid start time.");
    } else if (!itemLines.length) out.push("Add at least one item.");
    if (txType === "addons" && !bookingRef.trim()) out.push("Add the booking reference.");
    return out;
  }, [todayLocked, hasAnyCart, emailOk, phoneOk, method, cashShort, txType,
      selectedExperience, startTime, itemLines.length, bookingRef]);

  const canSubmit = !submitting && blockers.length === 0;

  /* --------------------------------- cart ---------------------------------- */

  const isOutOfStock = useCallback(
    (it) => typeof it?.stock === "number" && it.stock <= 0,
    [],
  );

  const addItem = useCallback((it) => {
    setCartItems((prev) => {
      const cur = prev[it.id];
      const nextQty = (cur?.qty || 0) + 1;
      if (typeof it.stock === "number" && nextQty > it.stock) {
        toast.error(`Only ${it.stock} of ${it.name} left.`);
        return prev;
      }
      return {
        ...prev,
        [it.id]: {
          id: it.id,
          name: it.name,
          sku: it.sku || null,
          price: Number(it.price || 0),
          qty: nextQty,
          vat: cur?.vat ?? (it.vatRate || 24),
          stock: typeof it.stock === "number" ? it.stock : null,
        },
      };
    });
  }, []);

  const addCustomItem = useCallback(() => {
    const id = `custom-${Date.now()}`;
    setCartItems((prev) => ({
      ...prev,
      [id]: { id, name: "Custom charge", sku: null, price: "", qty: 1, vat: 24, stock: null },
    }));
    setTxType((cur) => (cur === "experience" ? "items" : cur));
    setMode("items");
  }, []);

  const setQty = useCallback((id, qty) => {
    setCartItems((prev) => {
      const line = prev[id];
      if (!line) return prev;
      const n = Math.max(0, Number(qty) || 0);
      if (n === 0) {
        const { [id]: _drop, ...rest } = prev;
        return rest;
      }
      if (typeof line.stock === "number" && n > line.stock) {
        toast.error(`Only ${line.stock} in stock.`);
        return { ...prev, [id]: { ...line, qty: line.stock } };
      }
      return { ...prev, [id]: { ...line, qty: n } };
    });
  }, []);

  const setLinePrice = useCallback((id, price) => {
    setCartItems((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], price } } : prev));
  }, []);

  const removeLine = useCallback((id) => {
    setCartItems((prev) => {
      const { [id]: _drop, ...rest } = prev;
      return rest;
    });
  }, []);

  const snapshot = useCallback(
    () => ({
      selectedExperience, adults, kids, cartItems,
      discountMode, discountInput, custName, custEmail, custPhone,
      startTime, bookingRef, txType,
    }),
    [selectedExperience, adults, kids, cartItems, discountMode, discountInput,
     custName, custEmail, custPhone, startTime, bookingRef, txType],
  );

  const clearCart = useCallback(
    (keepUndo = true) => {
      if (keepUndo && hasAnyCart) setUndoData(snapshot());
      setSelectedExperience(null);
      setCartItems({});
      setAdults(1);
      setKids(0);
      setDiscountInput(0);
      setPromoCode("");
      setGiftCode("");
      setCustName("");
      setCustEmail("");
      setCustPhone("");
      setReference("");
      setCashReceived("");
      setBookingRef("");
      setStartTime(toLocalDatetimeInputValue(addMinutes(new Date(), 10)));
    },
    [hasAnyCart, snapshot],
  );

  function restore(s) {
    setSelectedExperience(s.selectedExperience);
    setAdults(s.adults ?? 1);
    setKids(s.kids ?? 0);
    setCartItems(s.cartItems || {});
    setDiscountMode(s.discountMode || "amount");
    setDiscountInput(s.discountInput ?? s.manualDiscount ?? 0);
    setCustName(s.custName || "");
    setCustEmail(s.custEmail || "");
    setCustPhone(s.custPhone || "");
    setStartTime(s.startTime || toLocalDatetimeInputValue(addMinutes(new Date(), 10)));
    setBookingRef(s.bookingRef || "");
    setTxType(s.txType || "items");
  }

  function undoClear() {
    if (!undoData) return;
    restore(undoData);
    setUndoData(null);
    toast.success("Cart restored.");
  }

  function persistHeld(next) {
    setHeldOrders(next);
    try {
      localStorage.setItem("oasis_pos_held_orders", JSON.stringify(next));
    } catch {
      /* private mode — the list simply won't survive a reload */
    }
  }

  function holdOrder() {
    if (!hasAnyCart) return;
    const held = {
      id: `hold-${Date.now()}`,
      at: new Date().toISOString(),
      label: selectedExperience?.name || `${itemLines.length} item${itemLines.length === 1 ? "" : "s"}`,
      total: finalTotalToCollect,
      ...snapshot(),
    };
    persistHeld([held, ...heldOrders].slice(0, 10));
    clearCart(false);
    toast.success("Sale parked.");
  }

  function resumeOrder(order) {
    restore(order);
    persistHeld(heldOrders.filter((x) => x.id !== order.id));
    setHeldOpen(false);
    toast.success("Sale resumed.");
  }

  /* -------------------------------- payment -------------------------------- */

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

  function guardTill() {
    if (!hasAnyCart) {
      toast.error("The cart is empty.");
      return false;
    }
    if (todayLocked) {
      toast.error("Today's Z-report is locked. The till is closed.");
      return false;
    }
    return true;
  }

  async function openCardCharge() {
    if (!guardTill()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/pos/payments/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(createPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not start the card payment");
      setPiClientSecret(data.clientSecret);
      setPiId(data.intentId);
      setQuote(data.quote);
      setCardOpen(true);
    } catch (e) {
      toast.error(e.message || "Card payment could not be started.");
    } finally {
      setSubmitting(false);
    }
  }

  async function openLinkCharge() {
    if (!guardTill()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/pos/payments/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(createPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not create the payment link");
      setLinkSession(data);
    } catch (e) {
      toast.error(e.message || "The payment link could not be created.");
    } finally {
      setSubmitting(false);
    }
  }

  async function settleLink(sessionId) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/pos/payments/link/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId, payload: createPayload() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not complete the sale");

      const receiptId = data.receiptId || data.bookingId;
      const mail = data.receiptEmail;
      if (mail?.sent) toast.success(`Paid — receipt emailed to ${mail.to}.`);
      else if (mail && mail.reason !== "no-email")
        toast.error("Paid, but the receipt email failed. Print or resend it.");
      else toast.success("Payment received.");

      clearCart(false);
      if (receiptId) {
        window.open(`/api/receipts/${receiptId}/pdf`, "_blank");
        router.push(`/admin/receipts/${receiptId}`);
      }
    } catch (e) {
      // The money is with Stripe either way; the webhook will record the sale.
      toast.error(e.message || "Paid, but the sale could not be recorded here.");
    } finally {
      setSubmitting(false);
    }
  }

  /** Abandon a QR payment, expiring it at Stripe so it cannot be paid later. */
  async function cancelLink() {
    const session = linkSession;
    setLinkSession(null);
    if (!session?.sessionId) return;
    try {
      const res = await fetch(
        `/api/pos/payments/link?sessionId=${encodeURIComponent(session.sessionId)}`,
        { method: "DELETE", credentials: "include" },
      );
      const data = await res.json();
      // They paid in the moment it took to press Cancel — settle it anyway
      // rather than pocketing a payment with no receipt behind it.
      if (data?.alreadyPaid) {
        toast.success("The customer had already paid — completing the sale.");
        settleLink(session.sessionId);
      }
    } catch {
      // The session expires on its own within 30 minutes.
    }
  }

  async function openTerminalCharge() {
    if (!guardTill()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/pos/revolut/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          amount: amountToCharge,
          currency: "EUR",
          reference: `POS-${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to push to the terminal");
      setTerminalIntentId(data.intentId);
    } catch (e) {
      toast.error(e.message || "The terminal did not respond.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckout(overrideRef = null) {
    if (!hasAnyCart) return;
    if (todayLocked) return toast.error("Today's Z-report is locked. The till is closed.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(createPayload(overrideRef)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Checkout failed");

      if (txType === "items" || txType === "addons") {
        const receiptId = data.receiptId || data.bookingId;
        // The cashier is standing in front of the customer: say plainly
        // whether the emailed copy actually went, so they can offer a print
        // instead of assuming.
        const mail = data.receiptEmail;
        if (mail?.sent) toast.success(`Receipt emailed to ${mail.to}.`);
        else if (mail && mail.reason !== "no-email")
          toast.error("Receipt generated, but the email failed. Print or resend it.");
        else toast.success("Receipt generated.");
        clearCart(false);
        if (receiptId) {
          window.open(`/api/receipts/${receiptId}/pdf`, "_blank");
          router.push(`/admin/receipts/${receiptId}`);
        }
        return;
      }

      toast.success("Booking recorded.");
      clearCart(false);
      router.push(`/admin/bookings/${data.bookingId}`);
    } catch (e) {
      toast.error(e.message || "Checkout failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function onConfirmClick() {
    if (method === "card") return openCardCharge();
    if (method === "link") return openLinkCharge();
    if (method === "terminal") return openTerminalCharge();
    return handleCheckout();
  }

  /* --------------------------------- view ---------------------------------- */

  return (
    <Page className="pb-10">
      <PageHeader
        eyebrow="Operations"
        title="Point of sale"
        description={
          todayLocked
            ? "The till is closed for today."
            : hasAnyCart
              ? `${formatCurrency(finalTotalToCollect)} in the cart`
              : "Scan, tap or search to start a sale."
        }
        actions={
          <>
            {heldOrders.length ? (
              <Button variant="secondary" onClick={() => setHeldOpen((v) => !v)}>
                <Icon name="clock" size={15} /> Parked ({heldOrders.length})
              </Button>
            ) : null}
            {undoData ? (
              <Button variant="secondary" onClick={undoClear}>
                <Icon name="clock" size={15} /> Undo clear
              </Button>
            ) : null}
            <Button variant="secondary" onClick={addCustomItem}>
              <Icon name="plus" size={15} /> Custom line
            </Button>
            <Button variant="secondary" onClick={() => router.push("/admin/reports/daily")}>
              <Icon name="chart" size={15} /> Z-report
            </Button>
          </>
        }
      />

      {todayLocked ? (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#f0e0bb] bg-[#fbf1dc] px-4 py-3">
          <Icon name="lock" size={17} className="text-[#8a6412]" />
          <span className="text-[13px] font-semibold text-[#8a6412]">
            Today’s Z-report is locked — no new sales can be taken until it is reopened.
          </span>
          <Button as="a" href="/admin/reports/daily" size="sm" variant="secondary" className="ml-auto">
            Open Z-report
          </Button>
        </div>
      ) : null}

      {heldOpen && heldOrders.length ? (
        <Card className="mb-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-[16px] text-[#2a211a]">Parked sales</h2>
            <button onClick={() => setHeldOpen(false)} className="rounded-lg p-1 text-[#9a8c7e] hover:bg-[#f2ede4]">
              <Icon name="x" size={16} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {heldOrders.map((o) => (
              <button
                key={o.id}
                onClick={() => resumeOrder(o)}
                className="rounded-xl border border-[#e6e0d6] bg-[#fdfbf7] px-3 py-2 text-left transition-colors hover:border-[#c9b393] hover:bg-white"
              >
                <span className="block text-[13px] font-semibold text-[#2a211a]">{o.label}</span>
                <span className="block text-[11.5px] text-[#9a8c7e]">
                  {formatCurrency(o.total || 0)} ·{" "}
                  {new Date(o.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* catalogue */}
        <div className="space-y-4">
          <Card padded={false} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-[#e6e0d6] p-4">
              <div className="inline-flex rounded-xl border border-[#e6e0d6] bg-[#fdfbf7] p-1">
                {[
                  ["experiences", "Experiences"],
                  ["items", "Shop"],
                ].map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => setMode(v)}
                    className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                      mode === v ? "bg-[#2a211a] text-white" : "text-[#6b5c4d] hover:bg-[#f2ede4]"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[200px] flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#b0a294]">
                  <Icon name="search" size={16} />
                </span>
                <input
                  ref={searchRef}
                  value={queryRaw}
                  onChange={(e) => setQueryRaw(e.target.value)}
                  placeholder={mode === "items" ? "Search or scan a product…" : "Search experiences…"}
                  className={`${inputClass} h-11 pl-9 ${queryRaw ? "pr-9" : ""}`}
                />
                {queryRaw ? (
                  <button onClick={() => setQueryRaw("")} aria-label="Clear"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#9a8c7e] hover:bg-[#f2ede4]">
                    <Icon name="x" size={14} />
                  </button>
                ) : null}
              </div>
            </div>

            {mode === "items" && categories.length > 2 ? (
              <div className="flex flex-wrap gap-1.5 border-b border-[#f0ebe2] bg-[#fdfbf7] px-4 py-2.5">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`rounded-full px-3 py-1 text-[12px] font-medium capitalize transition-colors ${
                      category === c
                        ? "bg-[#2a211a] text-white"
                        : "bg-white text-[#6b5c4d] ring-1 ring-inset ring-[#e6e0d6] hover:bg-[#f2ede4]"
                    }`}
                  >
                    {c === "all" ? "All" : c}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="p-4">
              {mode === "experiences" ? (
                <ExpGrid
                  loading={loadingExp}
                  list={filteredExperiences}
                  selected={selectedExperience}
                  onSelect={(x) => {
                    setSelectedExperience(x);
                    setTxType("experience");
                  }}
                />
              ) : (
                <ItemGrid
                  loading={loadingItems}
                  list={filteredItems}
                  cartMap={cartItems}
                  onInc={(it) => {
                    if (isOutOfStock(it)) return toast.error(`${it.name} is out of stock.`);
                    addItem(it);
                    setTxType((cur) => (cur === "experience" && !selectedExperience ? "items" : cur));
                  }}
                />
              )}
            </div>
          </Card>

          {/* experience details */}
          {selectedExperience ? (
            <Card>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-serif text-[17px] text-[#2a211a]">{selectedExperience.name}</h2>
                  <Muted className="text-[12px]">
                    {formatCurrency(priceAdult)} adult · {formatCurrency(priceKid)} child
                  </Muted>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelectedExperience(null)}>
                  <Icon name="x" size={14} /> Remove
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Counter label="Adults" value={adults} onChange={setAdults} min={0} />
                <Counter label="Children" value={kids} onChange={setKids} min={0} />
                <Field label="Start time">
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
            </Card>
          ) : null}
        </div>

        {/* cart + payment
            The column ran to ~1200px with two lines in the basket, so on a
            900px screen the Charge button sat below the fold on every sale.
            It is now a panel bounded by the viewport: the cart, discount,
            customer and payment scroll inside it, while the amount due and
            the charge button stay pinned to the bottom where the cashier
            always has them. */}
        <div className="lg:sticky lg:top-[calc(var(--admin-header-h,57px)+1rem)] lg:flex lg:max-h-[calc(100vh-var(--admin-header-h,57px)-2rem)] lg:flex-col lg:gap-4">
          <div className="space-y-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
          <Card padded={false} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#e6e0d6] px-4 py-3">
              <h2 className="font-serif text-[17px] text-[#2a211a]">
                Current sale
                {cartLineCount ? (
                  <span className="ml-2 align-middle text-[12px] font-medium text-[#9a8c7e]">
                    {cartLineCount} line{cartLineCount === 1 ? "" : "s"}
                  </span>
                ) : null}
              </h2>
              {hasAnyCart ? (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={holdOrder}>Park</Button>
                  <Button size="sm" variant="ghost" onClick={() => clearCart()}>Clear</Button>
                </div>
              ) : null}
            </div>

            <div className="max-h-[min(38vh,340px)] overflow-y-auto">
              {!hasAnyCart ? (
                <p className="px-4 py-10 text-center text-[13px] text-[#9a8c7e]">
                  Nothing in the cart yet.
                </p>
              ) : (
                <ul className="divide-y divide-[#f0ebe2]">
                  {selectedExperience ? (
                    <li className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <span className="block truncate text-[13.5px] font-semibold text-[#2a211a]">
                          {selectedExperience.name}
                        </span>
                        <span className="text-[11.5px] text-[#9a8c7e]">
                          {adults} adult{adults === 1 ? "" : "s"}
                          {kids ? ` · ${kids} child${kids === 1 ? "" : "ren"}` : ""}
                        </span>
                      </div>
                      <span className="shrink-0 text-[13.5px] font-semibold">{formatCurrency(expGross)}</span>
                    </li>
                  ) : null}

                  {itemLines.map((l) => (
                    <li key={l.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold text-[#2a211a]">{l.name}</span>
                          {l.sku ? <span className="text-[11px] text-[#b0a294]">{l.sku}</span> : null}
                        </div>
                        <button onClick={() => removeLine(l.id)} aria-label="Remove line"
                          className="rounded-lg p-1 text-[#b0a294] hover:bg-[#fbeae5] hover:text-[#a33c22]">
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex items-center rounded-lg border border-[#e6e0d6] bg-white">
                          <button onClick={() => setQty(l.id, l.qty - 1)}
                            className="px-2.5 py-1 text-[#6b5c4d] hover:bg-[#f2ede4]">−</button>
                          <span className="min-w-[28px] text-center text-[13px] font-semibold">{l.qty}</span>
                          <button onClick={() => setQty(l.id, l.qty + 1)}
                            className="px-2.5 py-1 text-[#6b5c4d] hover:bg-[#f2ede4]">+</button>
                        </div>
                        <span className="text-[12px] text-[#9a8c7e]">×</span>
                        <input
                          type="number" min="0" step="0.01"
                          value={l.price}
                          onChange={(e) => setLinePrice(l.id, e.target.value)}
                          className={`${inputClass} h-8 w-[86px] text-[12.5px]`}
                        />
                        <span className="ml-auto text-[13.5px] font-semibold">
                          {formatCurrency((Number(l.price) || 0) * l.qty)}
                        </span>
                      </div>
                      {typeof l.stock === "number" && l.qty >= l.stock ? (
                        <p className="mt-1 text-[11px] font-medium text-[#8a6412]">
                          All {l.stock} in stock are in this sale.
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* totals — the headline amount lives in the pinned footer below */}
            <div className="space-y-1.5 border-t border-[#e6e0d6] bg-[#fdfbf7] px-4 py-3 text-[13px]">
              <Row label="Gross" value={formatCurrency(totalGross)} />
              {clampedDiscount > 0 ? (
                <Row label="Discount" value={`−${formatCurrency(clampedDiscount)}`} accent />
              ) : null}
              <Row label="Net" value={formatCurrency(finalNetTotal)} muted />
              <Row label="VAT" value={formatCurrency(finalVatTotal)} muted />
            </div>
          </Card>

          {/* discount */}
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9a8c7e]">Discount</span>
              <div className="inline-flex rounded-lg border border-[#e6e0d6] bg-[#fdfbf7] p-0.5">
                {[["amount", "€"], ["percent", "%"]].map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => { setDiscountMode(v); setDiscountInput(0); }}
                    className={`rounded-md px-2.5 py-0.5 text-[12px] font-semibold transition-colors ${
                      discountMode === v ? "bg-[#2a211a] text-white" : "text-[#6b5c4d]"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number" min="0" step={discountMode === "percent" ? "1" : "0.01"}
                max={discountMode === "percent" ? 100 : undefined}
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                className={`${inputClass} h-9`}
              />
              {discountMode === "percent" ? (
                <div className="flex gap-1">
                  {[10, 20, 50].map((p) => (
                    <button key={p} onClick={() => setDiscountInput(p)}
                      className="rounded-full bg-[#f2ede4] px-2.5 py-1 text-[12px] font-medium text-[#6b5c4d] hover:bg-[#e8e0d3]">
                      {p}%
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Field label="Promo code">
                <input value={promoCode} onChange={(e) => setPromoCode(e.target.value)}
                  className={`${inputClass} h-9`} placeholder="Optional" />
              </Field>
              <Field label="Gift card">
                <input value={giftCode} onChange={(e) => setGiftCode(e.target.value)}
                  className={`${inputClass} h-9`} placeholder="Optional" />
              </Field>
            </div>
          </Card>

          {/* customer */}
          <Card>
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[#9a8c7e]">
              Customer
            </span>
            <div className="space-y-2">
              <input value={custName} onChange={(e) => setCustName(e.target.value)}
                placeholder="Name" className={`${inputClass} h-9`} />
              <input
                type="email" value={custEmail} onChange={(e) => setCustEmail(e.target.value)}
                placeholder="Email (required)"
                className={`${inputClass} h-9 ${custEmail && !emailOk ? "border-[#e0a89a]" : ""}`}
              />
              <input
                value={custPhone} onChange={(e) => setCustPhone(e.target.value)}
                placeholder="Phone (required)"
                className={`${inputClass} h-9 ${custPhone && !phoneOk ? "border-[#e0a89a]" : ""}`}
              />
              {txType === "addons" ? (
                <input value={bookingRef} onChange={(e) => setBookingRef(e.target.value)}
                  placeholder="Booking reference" className={`${inputClass} h-9`} />
              ) : null}
            </div>
          </Card>

          {/* payment */}
          <Card>
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[#9a8c7e]">
              Payment
            </span>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["terminal", "Terminal", "card"],
                ["card", "Card (online)", "card"],
                ["link", "Payment link", "qr"],
                ["cash", "Cash", "register"],
                ["comp", "Comp", "gift"],
              ].map(([v, label, icon]) => (
                <button
                  key={v}
                  onClick={() => setMethod(v)}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                    method === v
                      ? "border-[#2a211a] bg-[#2a211a] text-white"
                      : "border-[#e6e0d6] bg-white text-[#6b5c4d] hover:border-[#c9b393]"
                  }`}
                >
                  <Icon name={icon} size={15} /> {label}
                </button>
              ))}
            </div>

            {method === "cash" ? (
              <div className="mt-3 rounded-2xl border border-[#e6e0d6] bg-[#fdfbf7] p-3">
                <Field label="Cash received">
                  <input
                    type="number" min="0" step="0.01" inputMode="decimal"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className={`${inputClass} bg-white text-[16px] font-semibold`}
                  />
                </Field>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setCashReceived(amountToCharge.toFixed(2))}
                    className="rounded-full bg-[#2a211a] px-3 py-1 text-[12px] font-semibold text-white"
                  >
                    Exact
                  </button>
                  {TENDER_NOTES.filter((n) => n >= amountToCharge).slice(0, 4).map((n) => (
                    <button key={n} onClick={() => setCashReceived(String(n))}
                      className="rounded-full bg-white px-3 py-1 text-[12px] font-medium text-[#6b5c4d] ring-1 ring-inset ring-[#e6e0d6] hover:bg-[#f2ede4]">
                      €{n}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-baseline justify-between border-t border-[#e6e0d6] pt-2">
                  <span className="text-[12px] font-semibold uppercase tracking-wider text-[#9a8c7e]">Change</span>
                  <span className={`font-serif text-[20px] ${cashShort ? "text-[#a33c22]" : "text-[#2a211a]"}`}>
                    {cashShort ? `${formatCurrency(amountToCharge - cashReceivedAmount)} short` : formatCurrency(changeDue)}
                  </span>
                </div>
              </div>
            ) : null}

            {method === "comp" ? (
              <Muted className="mt-2 text-[12px]">
                Nothing will be charged. The sale is still recorded for the Z-report.
              </Muted>
            ) : null}

            {method !== "cash" && method !== "comp" ? (
              <Field label="Reference (optional)" className="mt-3">
                <input value={reference} onChange={(e) => setReference(e.target.value)}
                  className={`${inputClass} h-9`} placeholder="Terminal or transaction id" />
              </Field>
            ) : null}
          </Card>

          </div>

          {/* Pinned: the amount and the action, never scrolled off. */}
          <div className="shrink-0 space-y-3 rounded-2xl border border-[#e6e0d6] bg-white p-4 shadow-[0_-4px_16px_-12px_rgba(42,33,26,0.35)]">
            {blockers.length && hasAnyCart ? (
              <div className="rounded-xl border border-[#f0e0bb] bg-[#fbf1dc] px-3 py-2">
                <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#8a6412]">
                  Before you can charge
                </p>
                <ul className="list-inside list-disc space-y-0.5 text-[12.5px] text-[#8a6412]">
                  {blockers.map((b) => <li key={b}>{b}</li>)}
                </ul>
              </div>
            ) : null}

            <div className="flex items-baseline justify-between">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-[#9a8c7e]">
                To pay
              </span>
              <span className="font-serif text-[32px] leading-none text-[#2a211a]">
                {formatCurrency(amountToCharge)}
              </span>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full text-[15px]"
              disabled={!canSubmit}
              onClick={onConfirmClick}
            >
              {submitting
                ? "Working…"
                : method === "link"
                  ? `Show QR for ${formatCurrency(amountToCharge)}`
                  : method === "comp"
                    ? "Record comp sale"
                    : `Charge ${formatCurrency(amountToCharge)}`}
            </Button>
          </div>
        </div>
      </div>

      {linkSession ? (
        <LinkWaitingSheet
          session={linkSession}
          onCancel={cancelLink}
          onPaid={() => {
            const sessionId = linkSession.sessionId;
            setLinkSession(null);
            settleLink(sessionId);
          }}
        />
      ) : null}

      {terminalIntentId ? (
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
      ) : null}

      {cardOpen && piClientSecret ? (
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
      ) : null}
    </Page>
  );
}

/* ------------------------------- components ------------------------------- */

function Row({ label, value, muted, accent }) {
  return (
    <div className="flex justify-between">
      <span className={muted ? "text-[#b0a294]" : "text-[#7a6a5f]"}>{label}</span>
      <span className={accent ? "font-medium text-[#a33c22]" : muted ? "text-[#9a8c7e]" : "font-medium text-[#2a211a]"}>
        {value}
      </span>
    </div>
  );
}

function Counter({ label, value, onChange, min = 0 }) {
  return (
    <div>
      <span className="mb-1 block text-[11px] font-semibold text-[#6b5c4d]">{label}</span>
      <div className="flex items-center justify-between rounded-xl border border-[#e6e0d6] bg-white px-2 py-1.5">
        <button
          onClick={() => onChange(Math.max(min, Number(value) - 1))}
          className="rounded-lg px-3 py-1 text-[16px] text-[#6b5c4d] hover:bg-[#f2ede4]"
          aria-label={`Fewer ${label}`}
        >
          −
        </button>
        <span className="text-[16px] font-semibold text-[#2a211a]">{value}</span>
        <button
          onClick={() => onChange(Number(value) + 1)}
          className="rounded-lg px-3 py-1 text-[16px] text-[#6b5c4d] hover:bg-[#f2ede4]"
          aria-label={`More ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

function ExpGrid({ loading, list, selected, onSelect }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }
  if (!list.length) {
    return <p className="py-10 text-center text-[13px] text-[#9a8c7e]">No experiences match.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {list.map((x) => {
        const active = selected?.id === x.id;
        return (
          <button
            key={x.id}
            onClick={() => onSelect(x)}
            className={`rounded-2xl border p-3 text-left transition-all ${
              active
                ? "border-[#2a211a] bg-[#2a211a] text-white shadow-sm"
                : "border-[#e6e0d6] bg-white hover:border-[#c9b393] hover:shadow-sm"
            }`}
          >
            <span className={`block text-[13.5px] font-semibold ${active ? "text-white" : "text-[#2a211a]"}`}>
              {x.name}
            </span>
            <span className={`mt-1 block text-[12px] ${active ? "text-white/70" : "text-[#9a8c7e]"}`}>
              {formatCurrency(x?.pricing?.priceAdult ?? 0)} adult
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ItemGrid({ loading, list, cartMap, onInc }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }
  if (!list.length) {
    return <p className="py-10 text-center text-[13px] text-[#9a8c7e]">No products match.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
      {list.map((x) => {
        const inCart = cartMap[x.id]?.qty || 0;
        const out = typeof x.stock === "number" && x.stock <= 0;
        const low = typeof x.stock === "number" && x.stock > 0 && x.stock <= 5;
        return (
          <button
            key={x.id}
            onClick={() => onInc(x)}
            disabled={out}
            className={`relative rounded-2xl border p-3 text-left transition-all ${
              out
                ? "cursor-not-allowed border-[#eee7dc] bg-[#faf8f4] opacity-60"
                : inCart
                  ? "border-[#8b6f47] bg-[#fdfbf7] shadow-sm"
                  : "border-[#e6e0d6] bg-white hover:border-[#c9b393] hover:shadow-sm"
            }`}
          >
            {inCart ? (
              <span className="absolute right-2 top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#8b6f47] px-1 text-[11px] font-bold text-white">
                {inCart}
              </span>
            ) : null}
            <span className="block pr-6 text-[13px] font-semibold leading-tight text-[#2a211a]">{x.name}</span>
            {x.sku ? <span className="mt-0.5 block text-[10.5px] text-[#b0a294]">{x.sku}</span> : null}
            <span className="mt-1.5 block text-[13.5px] font-semibold text-[#8b6f47]">
              {formatCurrency(x.price)}
            </span>
            {out ? (
              <Badge variant="danger" className="mt-1.5">Out of stock</Badge>
            ) : low ? (
              <Badge variant="warning" className="mt-1.5">{x.stock} left</Badge>
            ) : typeof x.stock === "number" ? (
              <span className="mt-1.5 block text-[11px] text-[#9a8c7e]">{x.stock} in stock</span>
            ) : null}
          </button>
        );
      })}
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

/**
 * The customer-facing half of a QR sale.
 *
 * The cashier turns the screen around; the customer scans, pays on their own
 * phone, and this polls Stripe until the money lands. The sale is only written
 * to our database afterwards, by the same checkout call the card sheet uses.
 */
function LinkWaitingSheet({ session, onCancel, onPaid }) {
  const [status, setStatus] = useState("pending");
  const [copied, setCopied] = useState(false);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  useEffect(() => {
    let stop = false;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/pos/payments/link/status?sessionId=${encodeURIComponent(session.sessionId)}`,
          { credentials: "include" },
        );
        const data = await res.json();
        if (stop || !res.ok) return;

        setStatus(data.status);
        if (data.status === "paid" && data.paymentIntentId) {
          clearInterval(interval);
          onPaidRef.current(data.paymentIntentId);
        }
        if (data.status === "expired") clearInterval(interval);
      } catch (err) {
        // A dropped poll is not a failed payment — the next tick retries.
        console.error("Payment link polling error", err);
      }
    }, 2500);

    return () => {
      stop = true;
      clearInterval(interval);
    };
  }, [session.sessionId]);

  const amount = (session.amountCents || 0) / 100;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="relative w-full max-w-sm rounded-[2rem] bg-white p-8 shadow-2xl text-center">
        <h3 className="text-2xl font-serif font-bold mb-1">Scan to pay</h3>
        <p className="text-[#7a6a5f] mb-5 text-sm">
          Ask the customer to scan this with their phone camera for{" "}
          <strong className="text-[#4c4138] text-base">{formatCurrency(amount)}</strong>.
        </p>

        {status === "expired" ? (
          <div className="mb-6 rounded-xl border border-red-100 bg-red-50 py-6 text-red-600 font-bold">
            This code has expired. Close and start again.
          </div>
        ) : (
          <img
            src={session.qrDataUrl}
            alt="Payment QR code"
            width={256}
            height={256}
            className="mx-auto mb-5 h-64 w-64 rounded-2xl border border-[#e6e0d6] bg-white p-2"
          />
        )}

        {status === "paid" ? (
          <div className="mb-6 flex items-center justify-center gap-2 rounded-xl border border-green-100 bg-green-50 py-3 font-bold text-green-700">
            <Icon name="check" size={16} /> Paid — finishing the sale…
          </div>
        ) : status === "pending" ? (
          <div className="mb-6 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest text-[#8b6f47]">
            <Spinner className="h-4 w-4" /> Waiting for payment…
          </div>
        ) : null}

        {/* A camera that will not focus, a cracked screen: give the cashier a
            way to hand the link over by other means. */}
        <button
          onClick={() => {
            navigator.clipboard?.writeText(session.url).then(
              () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              },
              () => {},
            );
          }}
          className="mb-3 w-full py-3 rounded-xl border border-[#e6e0d6] text-[13px] font-semibold text-[#6b5c4d] hover:bg-[#f0e7d9] transition"
        >
          {copied ? "Link copied" : "Copy payment link"}
        </button>

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
