-- Somewhere to keep per-area settings that don't deserve their own column.
-- AppSetting is a narrow fixed-column table; the shop's email automation
-- switches live in this jsonb bag under the existing key = 'shop' row.
alter table public."AppSetting"
  add column if not exists settings jsonb not null default '{}'::jsonb;

-- Make sure the shop row exists so the admin has something to write to.
insert into public."AppSetting" (key)
select 'shop'
where not exists (select 1 from public."AppSetting" where key = 'shop');
