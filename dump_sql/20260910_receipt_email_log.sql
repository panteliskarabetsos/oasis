-- Records when a POS receipt was emailed to the customer.
--
-- Optional: the POS emails the receipt whether or not this column exists —
-- sendReceiptEmail() treats a missing column as a no-op. Running it lets the
-- admin receipt page show that the customer already has their copy, and stops
-- a resend going out twice by accident.

alter table if exists public."Receipt"
  add column if not exists "receiptEmailedAt" timestamptz;

comment on column public."Receipt"."receiptEmailedAt" is
  'When the receipt PDF was emailed to customerEmail. Null = never sent.';

-- PostgREST caches the schema; without this the new column stays invisible.
notify pgrst, 'reload schema';
