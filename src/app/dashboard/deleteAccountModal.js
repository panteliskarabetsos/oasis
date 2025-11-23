// src/app/dashboard/deleteAccountModal.js
"use client";

import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

export default function DeleteAccountModal({
  isOpen,
  onClose,
  onConfirm,
  message,
  isError,
}) {
  if (!isOpen) return null;

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-[#e8e2d8] bg-[#fdfaf7] px-6 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.35)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e4ddd3] bg-white text-[#7a6a5f] text-xs shadow-sm hover:bg-[#f3ede6] transition"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3 pr-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fbe3df] text-[#b03228]">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2
              id="delete-account-title"
              className="text-base sm:text-lg font-semibold text-[#5a4a3f]"
            >
              Confirm account deletion
            </h2>
            <p className="mt-1 text-xs sm:text-sm leading-relaxed text-[#7a6a5f]">
              Deleting your account is permanent. Your profile, history and
              saved details will be removed and you won&apos;t be able to access
              your oasis dashboard again with this account.
            </p>
          </div>
        </div>

        {/* Info list */}
        <div className="mt-4 rounded-2xl bg-[#f7f2ea] px-4 py-3 text-xs text-[#6b5b50]">
          <p className="mb-1 font-semibold text-[#5a4a3f]">This action will:</p>
          <ul className="list-inside list-disc space-y-1">
            <li>Remove your account and profile details.</li>
            <li>Revoke access to your bookings dashboard.</li>
            <li>Log you out from all active sessions.</li>
          </ul>
        </div>

        {/* Server response */}
        {message && (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3 text-xs sm:text-sm ${
              isError
                ? "border-[#f5c2c7] bg-[#f8d7da] text-[#842029]"
                : "border-[#badbcc] bg-[#d1e7dd] text-[#0f5132]"
            }`}
          >
            {message}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full border border-[#d3cec6] bg-white px-4 py-2 text-xs sm:text-sm font-medium text-[#5a4a3f] shadow-sm transition hover:bg-[#f3ede6]"
          >
            Keep my account
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center justify-center rounded-full border border-[#f0b5b3] bg-[#e35b57] px-4 py-2 text-xs sm:text-sm font-medium text-white shadow-sm transition hover:bg-[#c94440]"
          >
            Yes, delete permanently
          </button>
        </div>
      </div>
    </div>
  );
}
