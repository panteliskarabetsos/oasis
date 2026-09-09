import type { Session } from "@supabase/supabase-js";

import { buildAuthCookie } from "@/lib/authCookie";
import { config } from "@/lib/config";
import type {
  Attendee,
  BookingLookup,
  BookingSettings,
  Counts,
  DraftEnvelope,
  Experience,
  ExperienceDetail,
  FavoriteRow,
  MyBooking,
  PrimaryContact,
  Profile,
  PromoValidation,
  PromotionInfo,
  ScheduleSlot,
  ShopCheckoutResult,
  ShopListing,
  ShopOrder,
  ShopProduct,
  ShopOrderItem,
  ShopShippingQuote,
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

// The auth context registers the current session here so every API call can
// attach the synthesized Supabase SSR cookie the website's routes expect.
let sessionGetter: () => Session | null = () => null;
export function registerSessionGetter(fn: () => Session | null) {
  sessionGetter = fn;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean; // attach session cookie
  headers?: Record<string, string>;
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...opts.headers,
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.auth) {
    const session = sessionGetter();
    if (session) headers["Cookie"] = buildAuthCookie(session);
  }
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (e) {
    throw new ApiError(0, "Network error — please check your connection.", e);
  }
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON response (e.g. HTML error page)
  }
  if (!res.ok) {
    const message =
      (json && (json.error || json.message)) || `Request failed (${res.status})`;
    throw new ApiError(res.status, String(message), json);
  }
  return json as T;
}

/* ---------------- Experiences & availability ---------------- */

export const api = {
  experiences: (params?: { limit?: number; offset?: number; order?: "asc" | "desc" }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    if (params?.order) q.set("order", params.order);
    const qs = q.toString();
    return request<Experience[]>(`/api/experiences${qs ? `?${qs}` : ""}`);
  },

  experience: (slug: string) =>
    request<ExperienceDetail>(`/api/experiences/${encodeURIComponent(slug)}`),

  /** Authoritative seat availability (subtracts bookings and active holds). */
  schedule: (experienceId: number | string) =>
    request<ScheduleSlot[]>(`/api/public/schedule?experienceId=${experienceId}`),

  bookingSettings: () => request<BookingSettings>(`/api/settings/bookings`),

  /* ---------------- Booking drafts / checkout ---------------- */

  createDraft: (body: {
    experienceId: number | string;
    scheduleSlotId: number;
    counts: Counts;
    selected_meetup_point?: unknown;
    clientToken?: string;
  }) =>
    request<{ id: number; expiresAt: string; token: string; reused?: boolean }>(
      `/api/bookings/drafts`,
      { method: "POST", body }
    ),

  getDraft: (id: number | string, token: string) =>
    request<DraftEnvelope>(
      `/api/bookings/drafts/${id}?token=${encodeURIComponent(token)}`
    ),

  updateDraft: (
    id: number | string,
    token: string,
    body: {
      primaryContact: PrimaryContact;
      attendees: Attendee[];
      selected_meetup_point?: unknown;
    }
  ) =>
    request<{ ok: true }>(
      `/api/bookings/drafts/${id}?token=${encodeURIComponent(token)}`,
      { method: "PATCH", body }
    ),

  checkoutDraft: (
    id: number | string,
    promoCode?: string,
    mode: "checkout" | "elements" = "checkout"
  ) =>
    request<{
      mode: "checkout" | "elements" | "free";
      url?: string;
      redirectUrl?: string;
      clientSecret?: string;
      paymentIntentId?: string;
      amountCents?: number;
      currency?: string;
      discounted?: boolean;
      discountCents?: number;
      finalTotalCents?: number;
    }>(`/api/bookings/drafts/${id}/checkout`, {
      method: "POST",
      body: { mode, ...(promoCode ? { promoCode } : {}) },
    }),

  confirmDraft: (
    id: number | string,
    ref: { session_id?: string; payment_intent?: string }
  ) =>
    request<{
      converted?: boolean;
      bookingId?: number;
      bookingCode?: string;
      already?: boolean;
      status?: string;
    }>(`/api/bookings/drafts/${id}/confirm`, { method: "POST", body: ref }),

  validatePromo: (code: string, draftId?: number | string) =>
    request<PromoValidation>(
      `/api/promotions/validate?code=${encodeURIComponent(code)}${
        draftId ? `&draftId=${draftId}` : ""
      }`
    ),

  promotionsActive: () => request<PromotionInfo>(`/api/promotions/active`),

  /* ---------------- Shop ---------------- */

  shopProducts: (params?: {
    category?: string;
    search?: string;
    sort?: "new" | "price_asc" | "price_desc" | "title";
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.category && params.category !== "all") q.set("category", params.category);
    if (params?.search) q.set("search", params.search);
    if (params?.sort) q.set("sort", params.sort);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return request<ShopListing>(`/api/shop/products${qs ? `?${qs}` : ""}`);
  },

  shopProduct: (slug: string) =>
    request<{ product: ShopProduct; related: ShopProduct[] }>(
      `/api/shop/products/${encodeURIComponent(slug)}`
    ),

  /** What this bag costs to deliver, before committing to pay. */
  shopQuote: (body: {
    items: { productId: number; quantity: number }[];
    country?: string;
    method?: "courier" | "pickup";
  }) => request<ShopShippingQuote>(`/api/shop/quote`, { method: "POST", body }),

  shopCheckout: (body: {
    items: { productId: number; quantity: number; option?: string | null }[];
    contact: { name: string; email: string; phone?: string };
    shipping: {
      line1: string;
      line2?: string;
      city: string;
      postalCode: string;
      country?: string;
      notes?: string;
    };
    mode?: "elements" | "checkout";
    shippingMethod?: "courier" | "pickup";
  }) =>
    request<ShopCheckoutResult>(`/api/shop/checkout`, {
      method: "POST",
      body,
      auth: true,
    }),

  confirmShopOrder: (orderId: number | string, paymentIntentId?: string) =>
    request<{ ok: boolean; already?: boolean; status?: string; order?: ShopOrder }>(
      `/api/shop/orders/${orderId}/confirm`,
      { method: "POST", body: paymentIntentId ? { paymentIntentId } : {}, auth: true }
    ),

  shopOrder: (orderId: number | string, email?: string) =>
    request<{ order: ShopOrder; items: ShopOrderItem[] }>(
      `/api/shop/orders/${orderId}${email ? `?email=${encodeURIComponent(email)}` : ""}`,
      { auth: true }
    ),

  myShopOrders: () =>
    request<{ items: ShopOrder[] }>(`/api/shop/orders`, { auth: true }),

  /* ---------------- Manage booking (guest lookup) ---------------- */

  lookupBooking: (ref: string, lastName: string) =>
    request<BookingLookup>(
      `/api/bookings/lookup?ref=${encodeURIComponent(ref)}&lastName=${encodeURIComponent(lastName)}`
    ),

  paymentLink: (bookingId: number | string, email?: string) =>
    request<{ url?: string; checkoutUrl?: string; amountDue?: number }>(
      `/api/bookings/${bookingId}/payment-link`,
      { method: "POST", body: email ? { email } : {} }
    ),

  requestChange: (
    bookingId: number | string,
    body: {
      type: "cancel" | "reschedule" | "meetup";
      reason?: string;
      newSlotId?: number;
      newMeetupPoint?: unknown;
    }
  ) =>
    request<{ success: boolean; message?: string }>(
      `/api/bookings/${bookingId}/request-change`,
      { method: "POST", body }
    ),

  ticketPdfUrl: (bookingId: number | string) =>
    `${config.apiUrl}/api/bookings/${bookingId}/invoice`,

  appleWalletUrl: (bookingId: number | string) =>
    `${config.apiUrl}/api/wallet/apple?bookingId=${bookingId}`,

  googleWallet: (bookingId: number | string) =>
    request<{ saveUrl: string }>(`/api/wallet/google?bookingId=${bookingId}`),

  /* ---------------- Account (session cookie required) ---------------- */

  me: () => request<Profile>(`/api/me`, { auth: true }),

  myBookings: () => request<MyBooking[]>(`/api/my-bookings`, { auth: true }),

  myBooking: (id: number | string) =>
    request<MyBooking>(`/api/my-bookings/${id}`, { auth: true }),

  favorites: () =>
    request<{ data: FavoriteRow[] }>(`/api/favorites`, { auth: true }),

  toggleFavorite: (experienceId: number | string) =>
    request<{ success: boolean; isFavorite: boolean; action: string }>(
      `/api/favorites`,
      { method: "POST", body: { experienceId }, auth: true }
    ),

  updateAccount: (body: {
    name?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
    password: string; // current password, required by the API
  }) =>
    request<{ message?: string; user?: Profile }>(`/api/account/update`, {
      method: "POST",
      body,
      auth: true,
    }),

  deleteAccount: (hints?: { userId?: number; email?: string }) =>
    request<{ success: boolean }>(`/api/auth/delete-account`, {
      method: "DELETE",
      body: hints ?? {},
      auth: true,
    }),

  /* ---------------- Auth (server-assisted) ---------------- */

  signup: (body: {
    email: string;
    password: string;
    name: string;
    surname: string;
    phone?: string;
    dateOfBirth: string;
    recaptchaToken?: string;
  }) =>
    request<{ ok: boolean; authUserId?: string; created?: boolean }>(
      `/api/auth/signup`,
      { method: "POST", body: { recaptchaToken: "", ...body } }
    ),

  forgotPassword: (email: string) =>
    request<{ message: string }>(`/api/auth/forgot-password`, {
      method: "POST",
      body: { email, recaptchaToken: "" },
    }),

  resetPassword: (token: string, newPassword: string) =>
    request<{ message: string }>(`/api/auth/reset-password`, {
      method: "POST",
      body: { token, newPassword },
    }),

  /* ---------------- Forms ---------------- */

  contact: (body: {
    name: string;
    email: string;
    message: string;
    contactType?: "planning" | "support" | "info";
    idealDates?: string;
    groupSize?: string;
    bookingRef?: string;
  }) => request<{ ok: boolean }>(`/api/contact`, { method: "POST", body }),

  privateInquiry: (body: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    date: string;
    guests: string | number;
    location?: string;
    concept: string;
    notes?: string;
  }) =>
    request<{ message: string }>(`/api/private-inquiry`, {
      method: "POST",
      body,
    }),

  scheduleCall: (body: {
    name: string;
    email: string;
    country: string;
    phone: string;
    timezone: string;
    preferredDate: string;
    preferredTimeOfDay?: string;
    focusArea?: string;
    meetingType?: string;
    message: string;
  }) => request<{ ok: boolean }>(`/api/schedule-call`, { method: "POST", body }),

  newsletter: (email: string) =>
    request<{ ok: boolean; subscribed?: boolean }>(`/api/newsletter`, {
      method: "POST",
      body: { email },
    }),

  health: () => request<{ status: string }>(`/api/health`),
};
