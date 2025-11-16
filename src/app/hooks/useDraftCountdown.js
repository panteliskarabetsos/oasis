// src/app/hooks/useDraftCountdown.js
"use client";

import { useEffect, useState } from "react";

/**
 * Countdown for a booking draft.
 *
 * - expiresAtIso: ISO string from DB (e.g. 2025-11-16T11:34:52.83+00:00)
 * - totalDurationMs: full hold duration (e.g. 10 * 60 * 1000)
 */
export function useDraftCountdown(
  expiresAtIso,
  totalDurationMs = 10 * 60 * 1000
) {
  const [remainingMs, setRemainingMs] = useState(() => {
    if (!expiresAtIso) return 0;
    const ts = Date.parse(expiresAtIso);
    if (!Number.isFinite(ts)) return 0;
    return Math.max(0, ts - Date.now());
  });

  // This is the "full bar" baseline – fixed per render.
  const [fullMs] = useState(() => {
    const safeTotal = Number.isFinite(totalDurationMs)
      ? Math.max(0, totalDurationMs)
      : 10 * 60 * 1000; // fallback: 10 minutes

    if (!expiresAtIso) return safeTotal;

    const ts = Date.parse(expiresAtIso);
    const nowDiff = Number.isFinite(ts) ? ts - Date.now() : 0;

    // If the remaining time is longer than our expected window
    // (e.g. HOLD_MINUTES changed) use the larger one so the bar
    // never starts over-full.
    return Math.max(safeTotal, Math.max(0, nowDiff));
  });

  useEffect(() => {
    if (!expiresAtIso) {
      setRemainingMs(0);
      return;
    }

    const ts = Date.parse(expiresAtIso);
    if (!Number.isFinite(ts)) {
      setRemainingMs(0);
      return;
    }

    const update = () => {
      const diff = Math.max(0, ts - Date.now());
      setRemainingMs(diff);
    };

    update(); // initial tick

    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAtIso]);

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const formatted = `${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;

  const expired = remainingMs <= 0;

  // progress = portion of original hold still left (0–1)
  const rawProgress = fullMs > 0 ? remainingMs / fullMs : 0;
  const progress = Math.max(0, Math.min(1, rawProgress));

  return { remainingMs, formatted, expired, progress };
}
