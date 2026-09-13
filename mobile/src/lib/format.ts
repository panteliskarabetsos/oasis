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

/**
 * Tidy a reference as it is typed.
 *
 * Mirrors formatBookingCodeInput in the website's @/lib/bookingCode — the
 * server normalises the same way, so the guest sees exactly what will be
 * searched for and a misread O or I is corrected in front of them.
 *
 * References are five characters (T8VQR). Older bookings carry BK-XXXX-XXXX
 * or "BK-" plus the row id, and those still have to be typeable.
 */
export function formatBookingCodeInput(raw: string): string {
  const cleaned = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cleaned) return "";

  // Short enough to still be the current format — including a code that
  // happens to start with BK — so leave it whole.
  if (cleaned.length <= 5) return fold(cleaned);

  const body = cleaned.startsWith("BK") ? cleaned.slice(2) : cleaned;
  if (/^\d+$/.test(body)) return `BK-${body.slice(0, 10)}`;

  const folded = fold(body).slice(0, 8);
  return folded.length <= 4
    ? `BK-${folded}`
    : `BK-${folded.slice(0, 4)}-${folded.slice(4)}`;
}

/**
 * Only letters the alphabet leaves out may be folded. Q is in it — folding Q
 * to 0 makes every code containing one impossible to look up.
 */
function fold(s: string): string {
  return s.replace(/O/g, "0").replace(/[IL]/g, "1").replace(/U/g, "V");
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
