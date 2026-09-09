-- Order operations for the e-shop admin: a timeline of what happened to an
-- order, plus the fields the order page needs to track fulfilment and money
-- returned. Safe to re-run.

create table if not exists public.shop_order_event (
  id           bigserial primary key,
  order_id     bigint not null references public.shop_order(id) on delete cascade,
  -- note | status | refund | fulfilment | payment | system
  type         text not null default 'note',
  message      text not null default '',
  meta         jsonb not null default '{}'::jsonb,
  created_by_email text,
  created_by_name  text,
  created_at   timestamptz not null default now()
);

create index if not exists shop_order_event_order_idx
  on public.shop_order_event (order_id, created_at desc);

-- Running total of money returned to the customer, kept in step with Stripe so
-- the list and the order page can show it without calling out to Stripe.
alter table public.shop_order
  add column if not exists refunded_cents integer not null default 0;

-- Fulfilment details shown to staff (and usable in a future customer email).
alter table public.shop_order
  add column if not exists tracking_number text;
alter table public.shop_order
  add column if not exists tracking_url text;
alter table public.shop_order
  add column if not exists internal_note text;
