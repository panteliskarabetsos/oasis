import type { Session } from "@supabase/supabase-js";

import { buildAuthCookie } from "@/lib/authCookie";
import { config } from "@/lib/config";
import type {
  ActivityItem,
  AdminExperience,
  AdminSlot,
  AdminUser,
  BookingRequest,
  BookingSettings,
  Campaign,
  CheckinSlot,
  DailyReport,
  DiscountCode,
  GiftCard,
  ManifestSlot,
  Metrics,
  PaymentDetail,
  PaymentRow,
  Profile,
  ReportKpis,
  Reservation,
  ReservationDetail,
  Voucher,
} from "@/lib/types";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

let sessionGetter: () => Session | null = () => null;
export function registerSessionGetter(fn: () => Session | null) {
  sessionGetter = fn;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

// Every admin route authenticates via Supabase SSR cookies, so the cookie is
// attached to every request.
async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...opts.headers };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const session = sessionGetter();
  if (session) headers["Cookie"] = buildAuthCookie(session);
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (e) {
    throw new ApiError(0, "Network error — check your connection.", e);
  }
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON
  }
  if (!res.ok) {
    const message =
      (json && (json.error || json.message)) ||
      (res.status === 401
        ? "Session expired — please log in again."
        : res.status === 403
          ? "Your account doesn't have access to this."
          : `Request failed (${res.status})`);
    throw new ApiError(res.status, String(message), json);
  }
  return json as T;
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const api = {
  me: () => request<Profile>("/api/me"),

  /* ---------- Dashboard ---------- */
  metrics: () => request<Metrics>("/api/admin/metrics?group=day&tz=Europe/Athens"),
  activity: (limit = 15) => request<ActivityItem[]>(`/api/admin/activity?limit=${limit}`),

  /* ---------- Reservations ---------- */
  reservations: (params: {
    page?: number;
    pageSize?: number;
    q?: string;
    status?: string;
    from?: string;
    to?: string;
    experienceId?: number;
  }) =>
    request<{ items: Reservation[]; total: number }>(
      `/api/admin/reservations${qs(params as any)}`
    ),

  reservation: (id: number | string) =>
    request<{ item: ReservationDetail }>(`/api/admin/reservations/${id}`),

  updateReservation: (id: number | string, body: Record<string, unknown>) =>
    request<{ item?: ReservationDetail; success?: boolean }>(
      `/api/admin/reservations/${id}`,
      { method: "PATCH", body }
    ),

  cancelReservation: (
    id: number | string,
    body: { reason?: string; refund?: boolean; amountCents?: number }
  ) =>
    request<{ status?: string; refunded?: boolean; refundAmountCents?: number }>(
      `/api/admin/reservations/${id}/cancel`,
      { method: "POST", body }
    ),

  rescheduleReservation: (id: number | string, scheduleSlotId: number) =>
    request<{ success?: boolean }>(`/api/admin/reservations/${id}/reschedule`, {
      method: "PATCH",
      body: { scheduleSlotId },
    }),

  manualPayment: (id: number | string, body: { method: string; amount: number }) =>
    request<{ success?: boolean; totalPaid?: number }>(
      `/api/admin/reservations/${id}/manual-payment`,
      { method: "POST", body }
    ),

  generatePaymentLink: (id: number | string) =>
    request<{ url?: string; bookingCode?: string; guestName?: string }>(
      `/api/admin/reservations/${id}/generate-payment-link`,
      { method: "POST", body: {} }
    ),

  sendPaymentEmail: (id: number | string, body: { paymentLink: string; amountDue?: number }) =>
    request<{ ok?: boolean; success?: boolean }>(
      `/api/admin/reservations/${id}/send-payment-email`,
      { method: "POST", body }
    ),

  /* ---------- Check-ins ---------- */
  checkins: (date?: string) =>
    request<{ date: string; slots: CheckinSlot[]; totals?: { slots: number; bookings: number } }>(
      `/api/admin/checkins${qs({ date, tz: "Europe/Athens" })}`
    ),

  checkinAction: (bookingId: number | string, action: "checkin" | "undo" | "no_show") =>
    request<{ already?: boolean; status?: string }>(`/api/admin/checkins/${bookingId}`, {
      method: "PATCH",
      body: { action },
    }),

  /* ---------- Change requests ---------- */
  requests: () => request<BookingRequest[]>("/api/admin/requests"),

  resolveRequest: (
    id: number | string,
    body: { action: "approve" | "reject"; adminNotes?: string; refundOption?: "full" | "partial" }
  ) =>
    request<{ success?: boolean; message?: string }>(`/api/admin/requests/${id}`, {
      method: "PATCH",
      body,
    }),

  /* ---------- Experiences ---------- */
  adminExperiences: () => request<AdminExperience[]>("/api/admin/experiences"),

  createExperience: (body: Partial<AdminExperience>) =>
    request<AdminExperience>(`/api/admin/experiences`, { method: "POST", body }),

  updateExperience: (body: Partial<AdminExperience> & { id: number }) =>
    request<AdminExperience>(`/api/admin/experiences`, { method: "PUT", body }),

  deleteExperience: (id: number) =>
    request<{ ok?: boolean }>(`/api/admin/experiences`, { method: "DELETE", body: { id } }),

  /** Upload photos through the site's Cloudinary endpoint; returns hosted URLs. */
  uploadImages: async (uris: string[]): Promise<string[]> => {
    const form = new FormData();
    for (const uri of uris) {
      const name = uri.split("/").pop() || `photo-${Date.now()}.jpg`;
      form.append("file", { uri, name, type: "image/jpeg" } as unknown as Blob);
    }
    form.append("folder", "experiences");
    const session = sessionGetter();
    const res = await fetch(`${config.apiUrl}/api/admin/uploads`, {
      method: "POST",
      headers: session ? { Cookie: buildAuthCookie(session) } : undefined,
      body: form,
    });
    const json: any = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError(res.status, json?.error || `Upload failed (${res.status})`, json);
    }
    return (json?.files ?? [])
      .map((f: any) => f.secure_url || f.url)
      .filter(Boolean);
  },

  /** Read-only daily manifest: tours for a range with their guest lists. */
  manifest: (from: string, to: string, experienceId?: number | "all") =>
    request<{ items: ManifestSlot[] }>(
      `/api/admin/schedule/overview${qs({
        from,
        to,
        ...(experienceId && experienceId !== "all" ? { experienceId } : {}),
      })}`,
    ),

  schedule: (experienceId: number, from?: string, to?: string) =>
    request<AdminSlot[]>(
      `/api/admin/schedule${qs({ experienceId, from, to, withUsage: true, includeCancelled: true })}`
    ),

  createSlot: (body: { experienceId: number; date: string; totalSlots: number }) =>
    request<AdminSlot>(`/api/admin/schedule`, { method: "POST", body }),

  updateSlotCapacity: (id: number, totalSlots: number) =>
    request<AdminSlot>(`/api/admin/schedule`, { method: "PUT", body: { id, totalSlots } }),

  setSlotCancelled: (id: number, isCancelled: boolean) =>
    request<AdminSlot>(`/api/admin/schedule`, { method: "PATCH", body: { id, isCancelled } }),

  deleteSlot: (id: number) =>
    request<{ ok?: boolean; softCancelled?: boolean }>(`/api/admin/schedule?id=${id}`, {
      method: "DELETE",
    }),

  /* ---------- Payments ---------- */
  payments: (params: { status?: string; q?: string; limit?: number; starting_after?: string }) =>
    request<{ items: PaymentRow[]; has_more?: boolean; next_cursor?: string }>(
      `/api/admin/payments${qs({ kind: "payment_intents", ...params })}`
    ),

  payment: (id: string) => request<{ item: PaymentDetail }>(`/api/admin/payments/${id}`),

  refundPayment: (id: string, body: { amount_cents?: number; reason?: string }) =>
    request<{ refund?: any; summary?: any }>(`/api/admin/payments/${id}/refund`, {
      method: "POST",
      body,
    }),

  /* ---------- Gift cards ---------- */
  giftcards: (params?: { status?: string; q?: string }) =>
    request<GiftCard[]>(`/api/admin/giftcards${qs(params ?? {})}`),

  giftcardMetrics: () =>
    request<{
      outstandingCents?: number;
      sold30d?: number;
      redemptions30d?: number;
      avgValue30dCents?: number;
      currency?: string;
    }>(`/api/admin/giftcards/metrics`),

  createGiftcard: (body: {
    code: string;
    initialAmountCents: number;
    currency?: string;
    recipientEmail?: string;
    recipientName?: string;
    message?: string;
    expiresAt?: string;
  }) => request<{ id: number | string }>(`/api/admin/giftcards`, { method: "POST", body }),

  redeemGiftcard: (id: number | string, body: { amountCents: number; bookingId?: number; notes?: string }) =>
    request<{ ok?: boolean }>(`/api/admin/giftcards/${id}/redeem`, { method: "POST", body }),

  voidGiftcard: (id: number | string) =>
    request<{ ok?: boolean }>(`/api/admin/giftcards/${id}/void`, { method: "POST", body: {} }),

  resendGiftcard: (id: number | string, to?: string) =>
    request<{ ok?: boolean }>(`/api/admin/giftcards/${id}/resend`, {
      method: "POST",
      body: to ? { to } : {},
    }),

  /* ---------- Promotions ---------- */
  discountCodes: async () => {
    const res = await request<{ items?: DiscountCode[] } | DiscountCode[]>(
      `/api/admin/promotions/discount-codes`
    );
    return Array.isArray(res) ? res : (res.items ?? []);
  },

  campaigns: async () => {
    const res = await request<{ items?: Campaign[] } | Campaign[]>(
      `/api/admin/promotions/campaigns`
    );
    return Array.isArray(res) ? res : (res.items ?? []);
  },

  createCampaign: (body: {
    name: string;
    description?: string;
    scope?: string;
    startsAt?: string;
    endsAt?: string;
    active?: boolean;
  }) => request<Campaign>(`/api/admin/promotions/campaigns`, { method: "POST", body }),

  updateCampaign: (id: number | string, body: Partial<Campaign>) =>
    request<Campaign>(`/api/admin/promotions/campaigns/${id}`, { method: "PATCH", body }),

  vouchers: async () => {
    const res = await request<{ items?: Voucher[] } | Voucher[]>(
      `/api/admin/promotions/vouchers`
    );
    return Array.isArray(res) ? res : (res.items ?? []);
  },

  updateVoucher: (id: number | string, body: Partial<Voucher>) =>
    request<Voucher>(`/api/admin/promotions/vouchers/${id}`, { method: "PATCH", body }),

  createDiscountCode: (body: {
    code: string;
    discountType: "percent" | "amount";
    discountValue: number;
    currency?: string;
    maxRedemptions?: number;
    startsAt?: string;
    endsAt?: string;
    scope?: string;
    active?: boolean;
  }) =>
    request<DiscountCode>(`/api/admin/promotions/discount-codes`, { method: "POST", body }),

  updateDiscountCode: (id: number | string, body: Partial<DiscountCode>) =>
    request<DiscountCode>(`/api/admin/promotions/discount-codes/${id}`, {
      method: "PATCH",
      body,
    }),

  deleteDiscountCode: (id: number | string) =>
    request<{ ok?: boolean }>(`/api/admin/promotions/discount-codes/${id}`, {
      method: "DELETE",
    }),

  /* ---------- Reports ---------- */
  reports: (from?: string, to?: string) =>
    request<ReportKpis>(`/api/admin/reports${qs({ from, to })}`),

  dailyReport: (date: string) => request<DailyReport>(`/api/admin/reports/daily?date=${date}`),

  /* ---------- Settings ---------- */
  bookingSettings: () => request<BookingSettings>(`/api/admin/settings/bookings`),

  updateBookingSettings: (body: BookingSettings) =>
    request<BookingSettings>(`/api/admin/settings/bookings`, { method: "PUT", body }),

  /* ---------- Users ---------- */
  users: () => request<AdminUser[]>(`/api/admin/users`),
};
