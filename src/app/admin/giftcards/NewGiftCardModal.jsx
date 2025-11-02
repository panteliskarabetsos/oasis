// src/app/admin/giftcards/NewGiftCardModal.jsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Gift,
  X,
  CreditCard,
  Hash,
  Calendar as CalendarIcon,
  Mail,
  RefreshCw,
} from "lucide-react";

const MIN_EUR = 25;
const MAX_EUR = 400;
const STEP_EUR = 5;

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const snapToStep = (n) => Math.round((Number(n) || 0) / STEP_EUR) * STEP_EUR;
const parseIntSafe = (s) => {
  const n = Math.round(Number(s));
  return Number.isFinite(n) ? n : NaN;
};
const generateCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let s = "";
  for (let i = 0; i < 12; i++)
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s.replace(/(.{4})/g, "$1-").replace(/-$/, "");
};

export default function NewGiftCardModal({ open, onClose, onCreated }) {
  const dlgRef = useRef(null);
  const amountRef = useRef(null);

  // core fields
  const [amountInput, setAmountInput] = useState("50"); // keep as string to allow ''
  const [currency, setCurrency] = useState("EUR");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [message, setMessage] = useState("");
  const [expiresAt, setExpiresAt] = useState(""); // yyyy-mm-dd
  const [code, setCode] = useState(generateCode());
  const [paymentMethod, setPaymentMethod] = useState("stripe"); // 'offline' | 'stripe'
  const [sendEmail, setSendEmail] = useState(true);

  const [saving, setSaving] = useState(false);

  // derived validation
  const amountNum = parseIntSafe(amountInput);
  const inRange =
    Number.isFinite(amountNum) && amountNum >= MIN_EUR && amountNum <= MAX_EUR;
  const stepOk = Number.isFinite(amountNum) && amountNum % STEP_EUR === 0;
  const isValid = inRange && stepOk;

  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onEsc);
    // focus amount on open
    setTimeout(() => amountRef.current?.focus(), 0);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSave() {
    if (!isValid || saving) return;

    setSaving(true);

    const snapped = clamp(snapToStep(amountNum), MIN_EUR, MAX_EUR);
    const payload = {
      code,
      currency,
      initialAmountCents: Math.round(snapped * 100),
      recipientEmail: recipientEmail || null,
      recipientName: recipientName || null,
      message: message || null,
      expiresAt: expiresAt || null,
      source: "admin",
    };

    try {
      if (paymentMethod === "offline") {
        const res = await fetch("/api/admin/giftcards", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error || "Failed to create gift card");
        }

        let id = null;
        try {
          const j = await res.json();
          id = j?.id || null;
        } catch {}

        // optionally email right away if we have a recipient
        if (sendEmail && recipientEmail && id) {
          fetch(`/api/admin/giftcards/${id}/resend`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: recipientEmail }),
          }).catch(() => {});
        }

        onCreated?.(id, recipientEmail);
        onClose?.();
        setSaving(false);
        return;
      }

      // ---------- Stripe flow ----------
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch("/api/admin/giftcards/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          successUrl: `${origin}/admin/giftcards?paid=1&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${origin}/admin/giftcards?cancel=1`,
        }),
      });

      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(j?.error || "Failed to start Stripe checkout");
      }
      if (!j?.url) {
        throw new Error("Checkout URL missing");
      }

      // Navigate to Stripe — do not unset saving (we're leaving the page)
      window.location.assign(j.url);
    } catch (e) {
      setSaving(false);
      alert(e?.message || "Something went wrong");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
      onClick={(e) => {
        // close on backdrop click only
        if (e.target === e.currentTarget) onClose?.();
      }}
      aria-modal="true"
      role="dialog"
      aria-labelledby="new-giftcard-title"
    >
      <div
        ref={dlgRef}
        className="w-full max-w-lg rounded-2xl bg-white border border-[#e0dcd4] shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#fbf7f1] border border-[#efe7db]">
              <Gift className="h-5 w-5 text-[#8b6f47]" />
            </div>
            <div>
              <h3
                id="new-giftcard-title"
                className="text-lg font-semibold leading-tight"
              >
                New Gift Card
              </h3>
              <p className="text-xs text-[#7a6a5f]">
                Issue a new stored-value code and (optionally) send it to a
                recipient.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 border border-[#e6dfd6] text-[#5a4a3f] hover:bg-[#f6f3ef]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Payment method segmented control */}
        <div className="mt-4 mb-3 inline-flex rounded-full border border-[#d8cfc3] p-0.5 bg-white/70">
          <button
            type="button"
            onClick={() => setPaymentMethod("offline")}
            className={
              "px-3 py-1.5 text-sm rounded-full transition " +
              (paymentMethod === "offline"
                ? "bg-[#8b6f47] text-white"
                : "text-[#5a4a3f] hover:bg-[#f1ede7]")
            }
          >
            Paid offline
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod("stripe")}
            className={
              "px-3 py-1.5 text-sm rounded-full transition inline-flex items-center gap-1 " +
              (paymentMethod === "stripe"
                ? "bg-[#8b6f47] text-white"
                : "text-[#5a4a3f] hover:bg-[#f1ede7]")
            }
          >
            <CreditCard className="h-4 w-4" />
            Charge via Stripe
          </button>
        </div>

        {/* Quick presets */}
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {[25, 50, 55, 60, 75, 100, 150, 200, 250, 300, 350, 400].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setAmountInput(String(n))}
              className={`rounded-full border px-2 py-1 ${
                parseIntSafe(amountInput) === n
                  ? "bg-[#8b6f47] text-white border-[#8b6f47]"
                  : "bg-white/70 border-[#d8cfc3]"
              }`}
              aria-pressed={parseIntSafe(amountInput) === n}
            >
              €{n}
            </button>
          ))}
        </div>

        {/* Form grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {/* Amount */}
          <label className="flex flex-col gap-1">
            <span>Amount</span>
            <div className="relative">
              <input
                ref={amountRef}
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min={MIN_EUR}
                max={MAX_EUR}
                step={STEP_EUR}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                onBlur={() => {
                  const n = parseIntSafe(amountInput);
                  if (Number.isFinite(n) && n > 0) {
                    const snapped = snapToStep(n);
                    setAmountInput(String(clamp(snapped, MIN_EUR, MAX_EUR)));
                  }
                }}
                className="w-full rounded-md border border-[#d8cfc3] px-2 py-1.5 pr-10"
              />
              <span className="absolute inset-y-0 right-2 inline-flex items-center text-xs text-[#7a6a5f]">
                EUR
              </span>
            </div>
            {amountInput !== "" && !inRange && (
              <span className="text-xs text-red-600">
                Amount must be between €{MIN_EUR}–€{MAX_EUR}.
              </span>
            )}
            {amountInput !== "" && inRange && !stepOk && (
              <span className="text-xs text-red-600">
                Amount must be in €{STEP_EUR} increments (e.g., 55, 60).
              </span>
            )}
          </label>

          {/* Currency */}
          <label className="flex flex-col gap-1">
            <span>Currency</span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="rounded-md border border-[#d8cfc3] px-2 py-1.5"
            >
              <option>EUR</option>
            </select>
          </label>

          {/* Recipient email */}
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" /> Recipient email (optional)
            </span>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="name@example.com"
              className="rounded-md border border-[#d8cfc3] px-2 py-1.5"
            />
          </label>

          {/* Recipient name */}
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span>Recipient name (optional)</span>
            <input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="rounded-md border border-[#d8cfc3] px-2 py-1.5"
            />
          </label>

          {/* Message */}
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span>Personal message (optional)</span>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="rounded-md border border-[#d8cfc3] px-2 py-1.5"
            />
          </label>

          {/* Expires */}
          <label className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="h-3.5 w-3.5" /> Expires at (optional)
            </span>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="rounded-md border border-[#d8cfc3] px-2 py-1.5"
            />
          </label>

          {/* Code */}
          <label className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1">
              <Hash className="h-3.5 w-3.5" /> Code
            </span>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="flex-1 rounded-md border border-[#d8cfc3] px-2 py-1.5 font-mono"
              />
              <button
                type="button"
                onClick={() => setCode(generateCode())}
                className="rounded-md border border-[#d8cfc3] px-2 py-1.5 inline-flex items-center gap-1 hover:bg-[#f6f3ef]"
                title="Random code"
              >
                <RefreshCw className="h-4 w-4" />
                Random
              </button>
            </div>
          </label>

          {/* Email toggle (offline only) */}
          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              disabled={!recipientEmail || paymentMethod === "stripe"}
            />
            <span className="text-sm text-[#5a4a3f]">
              Email recipient after{" "}
              {paymentMethod === "stripe" ? "payment" : "creation"}
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="rounded-full border border-[#d8cfc3] px-3 py-1.5 bg-white hover:bg-[#f6f3ef]"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="rounded-full border px-3 py-1.5 bg-[#8b6f47] text-white disabled:opacity-50 inline-flex items-center gap-2"
            disabled={saving || !isValid}
            onClick={handleSave}
            aria-busy={saving ? "true" : "false"}
          >
            {saving ? (
              "Preparing…"
            ) : paymentMethod === "stripe" ? (
              <>
                <CreditCard className="h-4 w-4" /> Pay with Stripe
              </>
            ) : (
              "Create"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
