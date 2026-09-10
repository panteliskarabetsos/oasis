-- Pending QR payments at the till.
--
-- When the cashier shows a payment QR we park the basket here against the
-- Stripe Checkout Session id. If the till never gets to confirm the payment —
-- the app is killed, the wifi drops, the cashier walks away — the Stripe
-- webhook picks the row up and records the sale anyway, so a customer who has
-- paid always ends up with a receipt.
--
-- Optional: without this table the QR flow still works through the till's own
-- polling; only the webhook safety net is unavailable.

create table if not exists public.pos_pending_sale (
  session_id        text primary key,
  payload           jsonb       not null,
  amount_cents      integer     not null,
  currency          text        not null default 'eur',
  -- pending | settled | cancelled | failed
  status            text        not null default 'pending',
  payment_intent_id text,
  receipt_id        integer,
  booking_id        integer,
  created_by_email  text,
  created_at        timestamptz not null default now(),
  settled_at        timestamptz,
  last_error        text
);

-- The webhook and any reconciliation only ever look for outstanding rows.
create index if not exists pos_pending_sale_pending_idx
  on public.pos_pending_sale (created_at desc)
  where status = 'pending';

-- Holds basket contents and customer emails: service role only. No policies
-- are defined, so with RLS on nothing else can read it.
alter table public.pos_pending_sale enable row level security;

comment on table public.pos_pending_sale is
  'Baskets awaiting a QR payment, settled by the till poll or the Stripe webhook.';

-- PostgREST caches the schema; without this the new table stays invisible.
notify pgrst, 'reload schema';
