-- ===========================================================================
-- Oasis — tables referenced by the application but missing from the database.
--
-- Both writes below currently fail silently: supabase-js returns an error
-- object rather than throwing, and neither call site inspects it. The visible
-- symptom is missing data, not an error.
--
--   1. z_report_audit_log  — every Z-report lock/unlock is meant to be audited.
--                            Right now the financial close leaves no audit
--                            trail at all.
--   2. PromotionRedemption — promo/discount redemptions attached to a Stripe
--                            checkout session are never recorded, so promo
--                            usage reporting is incomplete.
--
-- Safe to run more than once (IF NOT EXISTS throughout).
-- Review before running against production.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Z-report audit trail
--    Written by: /api/admin/reports/daily/lock, /api/admin/reports/daily/unlock
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.z_report_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  z_report_id   uuid NOT NULL REFERENCES public.z_report(id) ON DELETE CASCADE,
  action        text NOT NULL CHECK (action IN ('created', 'locked', 'unlocked')),
  performed_by  uuid REFERENCES auth.users(id),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS z_report_audit_log_report_idx
  ON public.z_report_audit_log (z_report_id, created_at DESC);

ALTER TABLE public.z_report_audit_log ENABLE ROW LEVEL SECURITY;
-- Written only by the service role from the admin API; no client policies.

-- ---------------------------------------------------------------------------
-- 2. Promotion redemptions
--    Written by: /api/bookings/drafts/[id]/checkout  (status 'pending')
--    Updated by: /api/webhooks/stripe                (status 'succeeded')
--    Upsert conflict target is stripeSessionId, so it must be UNIQUE.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."PromotionRedemption" (
  id                integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code              text NOT NULL,
  "draftId"         integer REFERENCES public."BookingDraft"(id) ON DELETE SET NULL,
  "bookingId"       integer REFERENCES public.booking(id) ON DELETE SET NULL,
  "stripeSessionId" text UNIQUE,
  "discountCents"   integer NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
  "createdAt"       timestamptz NOT NULL DEFAULT now(),
  "updatedAt"       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promotion_redemption_code_idx
  ON public."PromotionRedemption" (code, "createdAt" DESC);

ALTER TABLE public."PromotionRedemption" ENABLE ROW LEVEL SECURITY;
-- Written only by the service role; no client policies.
