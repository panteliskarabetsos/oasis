-- Admin-created bookings are held for a fixed window while the guest pays.
--
-- The admin console now creates a booking as `pending`, emails the guest a
-- Stripe payment link, and holds the seats until `holdExpiresAt`. Paying
-- confirms the booking (the Stripe webhook); letting the hold lapse cancels it
-- and returns the seats to availability.
--
-- Required for the hold to be enforced. Without the column the booking is
-- still created and the link still goes out, but nothing expires — the seats
-- would stay held indefinitely.

alter table if exists public."booking"
  add column if not exists "holdExpiresAt" timestamptz;

comment on column public."booking"."holdExpiresAt" is
  'When an unpaid pending booking stops holding its seats. Null = no hold.';

-- Only ever scanned for holds that are still open, so a partial index keeps it
-- small however large the booking table gets.
create index if not exists booking_hold_expiry_idx
  on public."booking" ("holdExpiresAt")
  where "holdExpiresAt" is not null and status = 'pending';

-- PostgREST caches the schema; without this the new column stays invisible.
notify pgrst, 'reload schema';
