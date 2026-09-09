-- Courier shipping: what each product weighs and measures, and what each order
-- was charged to send. Rates themselves live in AppSetting.settings->'shipping'
-- (added by 20260909_shop_emails.sql), because they change often and are a
-- single row of configuration rather than a table.

alter table public.shop_product
  add column if not exists shipping_weight_grams integer not null default 0;
alter table public.shop_product
  add column if not exists shipping_length_cm numeric(6,1);
alter table public.shop_product
  add column if not exists shipping_width_cm numeric(6,1);
alter table public.shop_product
  add column if not exists shipping_height_cm numeric(6,1);

-- What the customer actually paid to have it sent, kept beside the goods total
-- so reporting can separate the two.
alter table public.shop_order
  add column if not exists shipping_cents integer not null default 0;
alter table public.shop_order
  add column if not exists shipping_method text;

-- PostgREST caches the schema: without this the app keeps reporting the
-- new columns as missing until its cache happens to refresh.
notify pgrst, 'reload schema';
