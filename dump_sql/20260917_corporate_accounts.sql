-- Corporate becomes an account ledger, not a second booking system.
--
-- The page shipped with its own Requests and Invoices tables sitting beside
-- the ones the rest of admin already uses. Both stayed empty: nothing in the
-- codebase ever wrote a corporate invoice, and requests were being taken on
-- booking_request all along. So Corporate keeps the one thing nothing else
-- holds -- who the company is and how they are allowed to pay -- and points
-- at the real booking, request and invoice pages for the rest.
--
-- That only works if a booking and an invoice can say which company they
-- belong to, which is what the second half of this file adds.

/* --------------------------- how they may pay --------------------------- */

alter table public.corporate_companies
  add column if not exists payment_terms   text    not null default 'prepaid',
  add column if not exists discount_pct    numeric(5,2) not null default 0,
  add column if not exists po_required     boolean not null default false,
  add column if not exists billing_address text,
  add column if not exists updated_at      timestamptz not null default now();

comment on column public.corporate_companies.payment_terms   is 'prepaid | net15 | net30 | net45 — when the balance falls due after invoicing.';
comment on column public.corporate_companies.discount_pct    is 'Standing discount for this account, applied before any promo code.';
comment on column public.corporate_companies.po_required     is 'Refuse to invoice this account without a purchase-order number.';
comment on column public.corporate_companies.credit_cents    is 'Ceiling on what may stand unpaid at once. 0 = no credit, pay up front.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'corporate_companies_payment_terms_check'
  ) then
    alter table public.corporate_companies
      add constraint corporate_companies_payment_terms_check
      check (payment_terms in ('prepaid', 'net15', 'net30', 'net45'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'corporate_companies_discount_pct_check'
  ) then
    alter table public.corporate_companies
      add constraint corporate_companies_discount_pct_check
      check (discount_pct >= 0 and discount_pct <= 100);
  end if;
end $$;

-- Two accounts should not share a tax id. This is checked against the rows
-- already there, so if it fails you have duplicates to merge first; blank and
-- null tax ids are exempt, since plenty of accounts never supply one.
create unique index if not exists corporate_companies_vat_key
  on public.corporate_companies (lower(vat))
  where vat is not null and vat <> '';

/* ------------------------- whose booking is this ------------------------ */

alter table public."booking"
  add column if not exists "companyId" uuid references public.corporate_companies(id) on delete set null;

create index if not exists booking_company_idx on public."booking" ("companyId") where "companyId" is not null;

comment on column public."booking"."companyId" is 'Set when the booking is billed to a corporate account rather than the guest.';

alter table public.invoice
  add column if not exists company_id uuid references public.corporate_companies(id) on delete set null;

create index if not exists invoice_company_idx on public.invoice (company_id) where company_id is not null;

/* ---------------------------- what is retired --------------------------- */

-- corporate_requests and corporate_invoices are both empty and no longer read
-- by anything. Left in place here rather than dropped: run these two by hand
-- once you are satisfied nothing else wants them.
--
--   drop table if exists public.corporate_invoices;
--   drop table if exists public.corporate_requests;
