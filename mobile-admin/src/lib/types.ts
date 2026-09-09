export type Metrics = {
  from?: string;
  to?: string;
  bookingsMTD?: number;
  revenueMTD?: number;
  openSlotsMTD?: number;
  occupancyMTDPct?: number;
  pendingApprovals?: number;
  trend?: { name: string; value: number }[];
  byDay?: Record<
    string,
    { bookings: number; revenue: number; openSlots: number; occupancyPct: number }
  >;
};

export type ActivityItem = { id: number | string; label: string; meta?: string; at: string };

export type Reservation = {
  id: number;
  source: "booking" | "draft";
  code: string;
  scheduleSlotId?: number | null;
  startTime?: string | null;
  experienceId?: number | null;
  experienceName?: string | null;
  guestName?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  adults?: number;
  kids?: number;
  totalAmount?: number;
  status?: string;
  createdAt?: string;
  isPrivate?: boolean;
  attendees?: any[];
  notes?: string | null;
};

export type ReservationDetail = Reservation & {
  counts?: { adults?: number; kids?: number; teens?: number; total?: number };
  unitPrices?: { adult?: number; kid?: number };
  money?: { totalPaidAmount?: number; totalAmount?: number; currency?: string };
  payments?: {
    stripeSessionUrl?: string | null;
    stripePaymentIntentId?: string | null;
    paymentMethod?: { type?: string; label?: string; card?: string } | null;
    ledger?: { method?: string; amount?: number; created_at?: string }[];
  };
  experience?: { id?: number; name?: string; location?: string } | null;
  guest?: { name?: string; email?: string; phone?: string } | null;
  selected_meetup_point?: any;
  appliedPromoCode?: string | null;
  discountAmount?: number | null;
};

export type CheckinSlot = {
  id: number;
  date: string;
  experienceName?: string;
  totalSlots?: number;
  bookings: CheckinBooking[];
};

export type CheckinBooking = {
  id: number;
  code?: string;
  guestName?: string;
  pax?: number;
  status?: string;
  meetupPoint?: string | null;
  // raw fields as the checkins API actually returns them
  primary_contact?: {
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  } | null;
  adultsCount?: number | null;
  kidsCount?: number | null;
  numberOfPeople?: number | null;
};

export type BookingRequest = {
  id: number;
  booking_id?: number;
  type?: "cancel" | "reschedule" | "meetup";
  reason?: string | null;
  status?: string;
  created_at?: string;
  booking?: any;
  experienceName?: string;
  guestName?: string;
  requestedSlot?: any;
  availableSlots?: any[];
  [k: string]: any;
};

export type AdminSlot = {
  id: number;
  date: string;
  experienceId?: number;
  totalSlots?: number;
  isCancelled?: boolean;
  booked?: number;
  holds?: number;
  occupied?: number;
  available?: number;
};

export type MeetupPoint = {
  id?: string | number;
  name?: string;
  time?: string;
  mapPin?: string;
  instructions?: string;
};

export type AdminExperience = {
  id: number;
  name: string;
  slug?: string;
  description?: string | null;
  visibility?: boolean;
  priceAdult?: number | null;
  priceKid?: number | null;
  location?: string | null;
  duration?: string | null;
  whatsIncluded?: string | null;
  whatToBring?: string | null;
  whyYoullLove?: string | null;
  cancellationPolicy?: string | null;
  frequency?: string[] | string | null;
  images?: string[] | null;
  meetupPoints?: MeetupPoint[] | null;
  guestReviews?: unknown[] | null;
  createdAt?: string;
};

export type PaymentRow = {
  kind?: string;
  id: string;
  created?: number;
  status?: string;
  amount?: number;
  amount_received?: number;
  currency?: string;
  customer?: { id?: string; email?: string; name?: string } | null;
  booking_id?: number | null;
  method?: string;
  card_brand?: string;
  card_last4?: string;
  receipt_url?: string;
  refunds?: any[];
};

export type PaymentDetail = PaymentRow & {
  aggregates?: {
    amount_intended_cents?: number;
    amount_received_cents?: number;
    refunds_total_cents?: number;
    net_cents?: number;
    available_to_refund_cents?: number;
    currency?: string;
  };
};

export type GiftCard = {
  id: number | string;
  code: string;
  status?: string;
  initialAmountCents?: number;
  remainingAmountCents?: number;
  currency?: string;
  recipientEmail?: string | null;
  recipientName?: string | null;
  issuedAt?: string;
  expiresAt?: string | null;
};

export type DiscountCode = {
  id: number | string;
  code: string;
  discountType?: "percent" | "amount";
  discountValue?: number;
  currency?: string;
  active?: boolean;
  maxRedemptions?: number | null;
  redemptionCount?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  scope?: string;
};

export type Campaign = {
  id: number | string;
  name?: string;
  description?: string | null;
  scope?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  active?: boolean;
  code?: string;
};

export type Voucher = {
  id: number | string;
  code: string;
  assignedToEmail?: string | null;
  discountType?: "percent" | "amount";
  discountValue?: number;
  currency?: string;
  maxRedemptions?: number | null;
  redemptionCount?: number;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type ReportKpis = {
  window?: { from?: string; to?: string };
  kpis?: {
    totalRevenue?: number;
    totalBookings?: number;
    avgOrderValue?: number;
    avgPartySize?: number;
    occupancyRate?: number;
    newCustomers?: number;
    returningCustomers?: number;
  };
  statusBreakdown?: { status: string; count: number }[];
  topExperiences?: { name: string; revenue?: number; bookings?: number }[];
};

export type DailyReport = {
  date?: string;
  locked?: boolean;
  summary?: {
    cash?: number;
    card?: number;
    bank_transfer?: number;
    other?: number;
    refunds?: number;
    gross_total?: number;
    net_total?: number;
  };
  transactions?: any[];
};

export type AdminUser = {
  id: number;
  auth_user_id?: string;
  email?: string;
  name?: string;
  surname?: string;
  phone?: string;
  role?: string;
  createdAt?: string;
};

export type BookingSettings = {
  bookingsPaused?: boolean;
  bookingsPausedUntil?: string | null;
  bookingsPausedMessage?: string | null;
};

export type Profile = {
  id: number | null;
  email?: string | null;
  name?: string | null;
  surname?: string | null;
  role?: string;
  /** Effective component access from /api/me: "*" or a list of permissions. */
  permissions?: "*" | string[];
  createdAt?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
};
