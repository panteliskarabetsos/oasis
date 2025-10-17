"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Copy, Clock, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Promo banner — ultra thin, centered carousel
 * - One-line, very slim height (tight padding + leading-none)
 * - Centers all text; auto-rotates multiple promos
 * - Pauses on hover/focus; respects reduced motion
 * - Per-promo dismiss (persisted); copy-to-clipboard + countdown
 */
export default function PromoBannerClient({ codes = [], campaigns = [] }) {
  // Normalize items (codes + campaigns)
  const items = useMemo(() => {
    const mappedCodes = (codes || []).map((c) => ({
      kind: "code",
      id: c.id,
      key: `promo.v4.code.${c.id}.${c.endsAt ?? ""}`,
      endsAtRaw: c.endsAt ?? null,
      code: c.code,
      discountType: c.discountType,
      discountValue: c.discountValue,
      currency: c.currency ?? "",
    }));
    const mappedCamps = (campaigns || []).map((k) => ({
      kind: "campaign",
      id: k.id,
      key: `promo.v4.camp.${k.id}.${k.endsAt ?? ""}`,
      endsAtRaw: k.endsAt ?? null,
      name: k.name,
      description: k.description ?? "",
      url: k.url ?? null,
    }));
    return [...mappedCodes, ...mappedCamps];
  }, [codes, campaigns]);

  // Read dismissed
  const [hiddenKeys, setHiddenKeys] = useState(() => new Set());
  useEffect(() => {
    const next = new Set();
    items.forEach((it) => {
      try {
        if (localStorage.getItem(it.key) === "1") next.add(it.key);
      } catch {}
    });
    setHiddenKeys(next);
  }, [items]);

  const visibleItems = useMemo(
    () => items.filter((i) => !hiddenKeys.has(i.key)),
    [items, hiddenKeys]
  );
  if (visibleItems.length === 0) return null;

  // Carousel state
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (index > visibleItems.length - 1) setIndex(0);
  }, [visibleItems.length, index]);

  // Pause on hover/focus
  const [paused, setPaused] = useState(false);
  const containerRef = useRef(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onFocusIn = () => setPaused(true);
    const onFocusOut = (e) => {
      if (!el.contains(e.relatedTarget)) setPaused(false);
    };
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);
    return () => {
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  // Reduced motion
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    try {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReduced(mq.matches);
      const onChange = () => setReduced(mq.matches);
      mq.addEventListener?.("change", onChange) || mq.addListener(onChange);
      return () =>
        mq.removeEventListener?.("change", onChange) ||
        mq.removeListener(onChange);
    } catch {}
  }, []);

  // Auto-rotate
  const intervalMs = 7000;
  useEffect(() => {
    if (reduced || paused || visibleItems.length <= 1) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % visibleItems.length),
      intervalMs
    );
    return () => clearInterval(id);
  }, [reduced, paused, visibleItems.length]);

  const current = visibleItems[index];

  // Dismiss current
  const dismiss = () => {
    if (!current) return;
    setHiddenKeys((prev) => new Set([...prev, current.key]));
    try {
      localStorage.setItem(current.key, "1");
    } catch {}
  };

  // Copy helpers
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [index]);
  const copy = async (t) => {
    try {
      await navigator.clipboard.writeText(String(t));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  // Time helpers
  const endsAt = current?.endsAtRaw ? new Date(current.endsAtRaw) : null;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  const msLeft = endsAt ? Math.max(0, endsAt.getTime() - now.getTime()) : null;
  const fmtLeft = (ms) => {
    if (ms == null) return null;
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${Math.max(0, m)}m`;
  };

  const discountLabel = (it) =>
    it.kind === "code"
      ? it.discountType === "percent"
        ? `${it.discountValue}% off`
        : `${it.discountValue} ${it.currency} off`
      : null;

  const goPrev = () =>
    setIndex((i) => (i - 1 + visibleItems.length) % visibleItems.length);
  const goNext = () => setIndex((i) => (i + 1) % visibleItems.length);

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Promotions"
      aria-live="polite"
      className="border-b border-[#eae6e0] bg-[#f6f2ea] text-[#5a4a3f] dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      ref={containerRef}
    >
      <div className="mx-auto max-w-6xl px-3">
        <div className="relative py-2.5 flex items-center justify-center min-h-[1.75rem]">
          {/* Dismiss */}
          {/* <button
            onClick={dismiss}
            className="absolute right-0.5  rounded-full p-0.5 text-[#7a6a58] transition hover:bg-[#eee7dd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40 dark:text-zinc-300 dark:hover:bg-zinc-800"
            aria-label="Dismiss promotion"
          >
            <X className="h-3.5 w-3.5" />
          </button> */}

          {/* Prev/Next */}
          {/* {visibleItems.length > 1 && (
            <>
              <button
                onClick={goPrev}
                className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[#7a6a58] transition hover:bg-[#eee7dd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40 dark:text-zinc-300 dark:hover:bg-zinc-800"
                aria-label="Previous promotion"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={goNext}
                className="absolute right-6 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[#7a6a58] transition hover:bg-[#eee7dd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40 dark:text-zinc-300 dark:hover:bg-zinc-800"
                aria-label="Next promotion"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )} */}

          {/* One-line centered content */}
          <div className="flex items-center justify-center gap-2 overflow-hidden text-center text-[12px] leading-none">
            <span
              aria-hidden
              className="inline-block h-1 w-1 rounded-full bg-[#8b6f47]"
            />

            {current.kind === "code" ? (
              <div className="flex items-center justify-center gap-2 min-w-0">
                <strong className="font-medium text-[#4b4136] truncate max-w-[26ch]">
                  {discountLabel(current)}
                </strong>
                <span className="opacity-90 hidden xs:inline">— use code</span>
                <button
                  onClick={() => copy(current.code)}
                  className="group inline-flex items-center gap-1.5 rounded border border-[#e0dcd4] bg-white px-1.5 py-0.5 font-mono text-[11px] leading-none text-[#4b4136] transition hover:bg-[#f8f5f0] active:scale-[0.98] dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                  aria-label="Copy discount code"
                >
                  <span>{current.code}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] opacity-70 group-hover:opacity-100">
                    <Copy className="h-3 w-3" /> {copied ? "Copied" : "Copy"}
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 min-w-0">
                <strong className="font-medium text-[#4b4136] truncate max-w-[20ch]">
                  {current.name}
                </strong>
                {current.description ? (
                  <span className="truncate max-w-[40vw] opacity-90">
                    — {current.description}
                  </span>
                ) : null}
                {current.url ? (
                  <a
                    href={current.url}
                    className="rounded px-1 py-0.5 text-[11px] underline underline-offset-2 hover:opacity-90 whitespace-nowrap"
                  >
                    Details
                  </a>
                ) : null}
              </div>
            )}

            {endsAt ? (
              <div className="hidden sm:inline-flex items-center gap-1 text-[11px] text-[#6d5f52] dark:text-zinc-300 whitespace-nowrap">
                <Clock className="h-3 w-3" aria-hidden />
                Ends in {fmtLeft(msLeft)}
              </div>
            ) : null}

            {visibleItems.length > 1 && (
              <div className="ml-1 hidden sm:flex items-center gap-1">
                {visibleItems.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    className={`h-1 w-1 rounded-full transition ${
                      i === index
                        ? "bg-[#8b6f47]"
                        : "bg-[#c8b79f] hover:bg-[#b3a186]"
                    }`}
                    aria-label={`Go to promotion ${i + 1}`}
                    aria-current={i === index}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
