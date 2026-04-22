"use client";

import { useState } from "react";
import { Mail, Check, AlertCircle } from "lucide-react";

export default function EmailButton({ receipt }) {
  const [status, setStatus] = useState("idle"); // 'idle' | 'loading' | 'success' | 'error'

  async function handleSendEmail() {
    // If the receipt already has an email attached to it, use it. Otherwise, ask the cashier.
    const defaultEmail = receipt?.customerEmail || "";

    const emailToUse = window.prompt(
      "Enter customer email address to send receipt:",
      defaultEmail,
    );

    if (!emailToUse || !emailToUse.includes("@")) return;

    try {
      setStatus("loading");

      const res = await fetch("/api/receipts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipt: receipt,
          email: emailToUse.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to send email");

      setStatus("success");

      // Reset button after 3 seconds
      setTimeout(() => setStatus("idle"), 3000);
    } catch (error) {
      console.error(error);
      setStatus("error");
      alert(error.message);
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <button
      onClick={handleSendEmail}
      disabled={status === "loading" || status === "success"}
      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#d8cfc3] bg-white px-4 py-3 text-sm font-semibold text-[#4c4138] shadow-sm transition-all hover:bg-[#f0e7d9] disabled:opacity-70 disabled:cursor-not-allowed"
    >
      {status === "idle" && (
        <>
          <Mail className="h-4 w-4" /> Email
        </>
      )}

      {status === "loading" && (
        <>
          <svg
            className="animate-spin h-4 w-4 text-[#8b6f47]"
            viewBox="0 0 24 24"
          >
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
          Sending...
        </>
      )}

      {status === "success" && (
        <>
          <Check className="h-4 w-4 text-green-600" /> Sent!
        </>
      )}

      {status === "error" && (
        <>
          <AlertCircle className="h-4 w-4 text-red-600" /> Failed
        </>
      )}
    </button>
  );
}
