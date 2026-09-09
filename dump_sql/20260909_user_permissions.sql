-- Per-user component access for staff accounts.
--
-- A staff member's effective access is the union of the permissions their named
-- role carries and the grants stored here. Role "custom" carries none of its
-- own, so its holders are governed entirely by this column.
--
-- Safe to run more than once.

alter table public."User"
  add column if not exists "permissions" text[] not null default '{}';

comment on column public."User"."permissions" is
  'Extra component permissions granted to this staff account, on top of whatever their role carries. Validated against ALL_PERMISSIONS in src/lib/auth/requireAdmin.js.';

-- Lets the staff-accounts screen filter by a granted component.
create index if not exists "User_permissions_idx"
  on public."User" using gin ("permissions");
