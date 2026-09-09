-- Every product gets a scannable barcode and a unique human SKU.
--
-- The barcode is an EAN-13 built from the existing shop_product.sku sequence,
-- prefixed with "2" — GS1 reserves the 20–29 prefixes for in-store/restricted
-- distribution, so these can never collide with a real manufacturer's code.
-- Assignment happens in a trigger so it holds no matter which code path (admin
-- form, POS, an import, psql) creates the row.

alter table public.shop_product add column if not exists barcode text;

create unique index if not exists shop_product_barcode_key
  on public.shop_product (barcode) where barcode is not null;

-- EAN-13 check digit for a 12-digit base.
create or replace function public.shop_ean13_check(p_base text)
returns text
language plpgsql
immutable
as $$
declare
  s int := 0;
  d int;
  i int;
begin
  if p_base is null or length(p_base) <> 12 or p_base !~ '^[0-9]{12}$' then
    return null;
  end if;
  for i in 1..12 loop
    d := substr(p_base, i, 1)::int;
    -- positions 2,4,…,12 carry weight 3; the rest weight 1
    if i % 2 = 0 then
      s := s + d * 3;
    else
      s := s + d;
    end if;
  end loop;
  return ((10 - (s % 10)) % 10)::text;
end;
$$;

-- Full 13-digit code for a product sequence number.
create or replace function public.shop_barcode_for(p_seq bigint)
returns text
language sql
immutable
as $$
  select b || public.shop_ean13_check(b)
  from (select '2' || lpad(p_seq::text, 11, '0') as b) t;
$$;

create or replace function public.shop_product_assign_codes()
returns trigger
language plpgsql
as $$
begin
  if new.barcode is null or new.barcode = '' then
    new.barcode := public.shop_barcode_for(new.sku);
  end if;
  if new.sku_code is null or new.sku_code = '' then
    new.sku_code := 'OAS-' || lpad(new.sku::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists shop_product_assign_codes_trg on public.shop_product;
create trigger shop_product_assign_codes_trg
  before insert or update on public.shop_product
  for each row execute function public.shop_product_assign_codes();

-- Backfill everything that already exists.
update public.shop_product
   set barcode = public.shop_barcode_for(sku)
 where barcode is null or barcode = '';

update public.shop_product
   set sku_code = 'OAS-' || lpad(sku::text, 6, '0')
 where sku_code is null or sku_code = '';

create index if not exists shop_product_sku_code_idx on public.shop_product (sku_code);

-- PostgREST caches the schema: without this the app keeps reporting the
-- new tables and columns as missing until its cache happens to refresh.
notify pgrst, 'reload schema';
