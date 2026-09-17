"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * A dialog on the admin design system.
 *
 * Escape and the backdrop both close it, focus moves inside on open and the
 * page behind it stops scrolling — the previous corporate modal did none of
 * these, and its buttons carried class names that resolved to nothing.
 */
export default function Modal({ title, description, children, footer, onClose, wide = false }) {
  const panelRef = useRef(null);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#2a211a]/30 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-[#e6e0d6] bg-white shadow-xl outline-none sm:rounded-2xl ${
          wide ? "sm:max-w-3xl" : "sm:max-w-xl"
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#f0ebe2] px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-serif text-[19px] text-[#2a211a]">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-[12px] text-[#7a6a5f]">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-[#9a8c7e] transition-colors hover:bg-[#f2ede4] hover:text-[#3f3127]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-[#f0ebe2] bg-[#fdfbf7] px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
