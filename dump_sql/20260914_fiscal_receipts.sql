-- Receipts as fiscal documents, ready to hand to myDATA later.
--
-- Until now a Receipt was a record of a POS sale: items, a total, who paid.
-- A document you give a customer in Greece needs more — its own series and
-- number, the VAT split out, the issue date, and somewhere to record the
-- AADE response once transmission is switched on.
--
-- Nothing here talks to AADE. The point is that every receipt issued from
-- today carries the fields myDATA needs and sits in a queue, so connecting
-- later is one transmitter away and the backlog goes with it.

/* ------------------------------ document ------------------------------ */

alter table public."Receipt"
  add column if not exists "series"    text,
  add column if not exists "number"    bigint,
  add column if not exists "docType"   text not null default 'retail',
  add column if not exists "issuedAt"  timestamptz not null default now(),
  add column if not exists "netAmount" numeric,
  add column if not exists "vatAmount" numeric,
  add column if not exists "vatRate"   numeric,
  add column if not exists "bookingId" bigint;

comment on column public."Receipt"."series"  is 'Fiscal series, e.g. B for retail. Numbering runs per series.';
comment on column public."Receipt"."number"  is 'Sequential within the series. Assigned by trigger; gapless.';
comment on column public."Receipt"."docType" is 'retail = απόδειξη λιανικής, invoice = τιμολόγιο.';

/* ------------------------------- myDATA ------------------------------- */

alter table public."Receipt"
  add column if not exists "mydataStatus" text not null default 'pending',
  add column if not exists "mydataMark"   text,
  add column if not exists "mydataUid"    text,
  add column if not exists "mydataSentAt" timestamptz,
  add column if not exists "mydataError"  text;

comment on column public."Receipt"."mydataStatus" is
  'pending | sent | failed | skipped. Everything issued before AADE is connected stays pending, so the backlog can be drained in one pass.';
comment on column public."Receipt"."mydataMark" is 'MARK returned by AADE on acceptance.';
comment on column public."Receipt"."mydataUid"  is 'UID returned by AADE on acceptance.';

-- The transmitter will poll this; keep it cheap however large the table gets.
create index if not exists receipt_mydata_pending_idx
  on public."Receipt" ("issuedAt")
  where "mydataStatus" = 'pending';

create index if not exists receipt_booking_idx
  on public."Receipt" ("bookingId")
  where "bookingId" is not null;

/* ----------------------------- numbering ------------------------------ */

-- A counter table rather than a sequence: a sequence keeps its value across a
-- rollback, which would leave holes in the numbering. Updating a row inside
-- the same transaction as the insert means a failed insert gives the number
-- back.
create table if not exists public."ReceiptSeries" (
  series      text primary key,
  "lastNumber" bigint not null default 0,
  description text
);

insert into public."ReceiptSeries" (series, "lastNumber", description)
values ('B', 0, 'Retail receipts — απόδειξη λιανικής')
on conflict (series) do nothing;

create or replace function public.assign_receipt_number()
returns trigger
language plpgsql
as $$
declare
  next_no bigint;
begin
  if new.series is null or new.series = '' then
    new.series := 'B';
  end if;

  if new.number is not null then
    return new;  -- caller supplied one (a backfill, say)
  end if;

  insert into public."ReceiptSeries" (series, "lastNumber")
  values (new.series, 0)
  on conflict (series) do nothing;

  update public."ReceiptSeries"
     set "lastNumber" = "lastNumber" + 1
   where series = new.series
  returning "lastNumber" into next_no;

  new.number := next_no;
  return new;
end;
$$;

drop trigger if exists receipt_assign_number_trg on public."Receipt";
create trigger receipt_assign_number_trg
  before insert on public."Receipt"
  for each row execute function public.assign_receipt_number();

-- One document per series+number, always.
create unique index if not exists receipt_series_number_key
  on public."Receipt" ("series", "number");

/* ---------------------- backfill existing receipts --------------------- */

-- Rows that predate this migration get numbers in issue order so the series
-- stays contiguous, and are marked 'skipped': they were never fiscal
-- documents and must not be transmitted as though they were.
do $$
declare
  r record;
  n bigint;
begin
  select coalesce(max("number"), 0) into n
    from public."Receipt" where series = 'B';

  for r in
    select id from public."Receipt"
     where "number" is null
     order by created_at, id
  loop
    n := n + 1;
    update public."Receipt"
       set series = 'B',
           "number" = n,
           "issuedAt" = coalesce("issuedAt", created_at),
           "mydataStatus" = 'skipped',
           "mydataError" = 'Issued before myDATA was configured'
     where id = r.id;
  end loop;

  update public."ReceiptSeries" set "lastNumber" = n where series = 'B';
end $$;

notify pgrst, 'reload schema';
