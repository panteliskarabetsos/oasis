export type MeetupPoint = {
  id?: string | number;
  name?: string;
  mapPin?: string; // address string
  instructions?: string;
  time?: string;
};

export type GuestReview = { name?: string; comment?: string };

export type Experience = {
  id: number | string;
  name: string;
  slug: string;
  description?: string | null;
  location?: string | null;
  duration?: string | null;
  whatsIncluded?: string | null;
  whatToBring?: string | null;
  whyYoullLove?: string | null;
  images?: string[] | null;
  meetupPoints?: MeetupPoint[] | null;
  guestReviews?: (GuestReview | string)[] | null;
  frequency?: string | string[] | null;
  visibility?: boolean;
  priceAdult?: number | null;
  priceKid?: number | null;
  cancellationPolicy?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ExperienceDetail = Experience & {
  pricing?: { adult?: number | null; kid?: number | null };
  slots?: ScheduleSlot[];
};

export type ScheduleSlot = {
  id: number;
  date: string; // ISO
  totalSlots?: number;
  booked?: number;
  holds?: number;
  available?: number;
  isCancelled?: boolean;
  isFullyBooked?: boolean;
  meetupPoints?: MeetupPoint[] | null;
};

export type Counts = { adults: number; kids: number };

export type Attendee = {
  firstName: string;
  lastName: string;
  age?: number | string;
  type?: "adult" | "kid";
};

export type PrimaryContact = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
};

export type Draft = {
  id: number;
  selected_meetup_point?: unknown;
  experienceId?: number;
  scheduleSlotId?: number;
  counts?: Counts;
  attendees?: Attendee[];
  primary_contact?: PrimaryContact;
  status?: string;
  unitPriceAdult?: number;
  unitPriceKid?: number;
  totalAmount?: number;
  expiresAt?: string;
  convertedBookingId?: number | null;
  stripeSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  unitPrices?: { adult?: number; kid?: number };
};

export type DraftEnvelope = {
  bookingId?: number | null;
  booking?: {
    id: number;
    status?: string;
    numberOfPeople?: number;
    totalPaidAmount?: number;
    currency?: string;
  } | null;
  draft?: Draft;
  experience?: Pick<
    Experience,
    "id" | "name" | "slug" | "location" | "images" | "priceAdult" | "priceKid"
  >;
  slot?: { id: number; date: string };
};

export type PromoValidation = {
  code: string;
  source: "discount" | "voucher" | "giftcard";
  discountType: "percent" | "amount";
  discountValue: number;
  currency?: string;
  remaining?: number | null;
  giftcard?: {
    id: number | string;
    remainingAmountCents?: number;
    applyAmountCents?: number;
  };
};

export type MyBooking = {
  id: number;
  status?: string;
  createdAt?: string;
  startTime?: string;
  duration?: string | null;
  durationMinutes?: number;
  counts?: Counts;
  totalPaidAmount?: number;
  currency?: string;
  experience?: Pick<
    Experience,
    "id" | "name" | "location" | "slug" | "images" | "duration"
  > | null;
  experienceName?: string;
  scheduleSlot?: { id: number; date: string; isCancelled?: boolean } | null;
  appliedPromoCode?: string | null;
  discountAmount?: number | null;
  qrValue?: string;
  user?: { name?: string; email?: string };
};

export type BookingLookup = {
  id: number;
  experienceId?: number;
  reference: string;
  guestName?: string;
  email?: string;
  experienceName?: string;
  isPrivate?: boolean;
  date?: string;
  time?: string;
  guests?: number;
  adultsCount?: number;
  kidsCount?: number;
  status?: string;
  currency?: string;
  bookingTotal?: number;
  paidAmount?: number;
  refundedAmount?: number;
  amountDue?: number;
  paymentStatus?: "paid" | "partially_paid" | "unpaid";
  location?: string;
  meetupPoint?: string | MeetupPoint | null;
  cancellationPolicy?: string;
  attendees?: Attendee[];
  updateRequested?: boolean;
  hasRescheduled?: boolean;
};

export type Profile = {
  id: number | null;
  email?: string | null;
  name?: string | null;
  surname?: string | null;
  phone?: string | null;
  role?: string;
  dateOfBirth?: string | null;
  createdAt?: string | null;
};

export type FavoriteRow = {
  id: number | string;
  created_at?: string;
  Experience?: Pick<
    Experience,
    "id" | "name" | "slug" | "location" | "priceAdult" | "images"
  > | null;
};

export type PromotionInfo = {
  campaigns: {
    id: number | string;
    name?: string;
    description?: string;
    startsAt?: string;
    endsAt?: string;
  }[];
  codes: {
    id: number | string;
    code: string;
    discountType?: string;
    discountValue?: number;
    currency?: string;
    endsAt?: string;
  }[];
};

export type BookingSettings = {
  bookingsPaused?: boolean;
  bookingsPausedMessage?: string | null;
  bookingsPausedUntil?: string | null;
};
