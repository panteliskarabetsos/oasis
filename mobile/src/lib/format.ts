const EUR = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
});

export function money(amount?: number | null, currency?: string): string {
  const value = Number(amount ?? 0);
  if (!currency || currency.toUpperCase() === "EUR") return EUR.format(value);
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function moneyCents(cents?: number | null, currency?: string): string {
  return money((cents ?? 0) / 100, currency);
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

/**
 * The reference to show for a booking.
 *
 * New bookings carry a random `code` (BK-XXXX-XXXX) so one reference cannot be
 * used to guess the next. Anything booked before that falls back to the old
 * "BK-" plus row id, which is still what its confirmation email says.
 */
export function bookingRef(
  booking?: { id?: number | string | null; code?: string | null } | number | string | null,
): string {
  if (typeof booking === "string") return booking;
  if (booking && typeof booking === "object" && booking.code) return booking.code;
  const id = typeof booking === "number" ? booking : (booking as { id?: number })?.id;
  return `BK-${String(Number(id ?? 0)).padStart(6, "0")}`;
}

/** yyyy-mm-dd in local time (for calendar keys). */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function splitItems(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n|•|;/)
    .map((s) => s.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

export const POLICY_MAP: Record<string, { label: string; description: string }> = {
  flexible: {
    label: "Flexible",
    description:
      "Free cancellation up to 48 hours before the experience for a full refund.",
  },
  moderate: {
    label: "Moderate",
    description:
      "Full refund up to 7 days before; 50% refund up to 48 hours before the experience.",
  },
  strict: {
    label: "Strict (Oasis Bespoke)",
    description:
      "Full refund up to 14 days before; 50% refund up to 7 days before the experience.",
  },
};
