-- Expire unpaid booking holds inside the database, on a schedule.
--
-- The app already sweeps lazily (every admin bookings read releases lapsed
-- holds), but "whenever someone next looks" is a poor guarantee when a stale
-- hold is the only thing keeping a seat off sale. This does it on the hour
-- without Vercel Cron — Supabase ships pg_cron, so the schedule lives in your
-- own database and costs nothing.
--
-- Run dump_sql/20260912_booking_payment_holds.sql first; this needs the
-- "holdExpiresAt" column.

-- 1. The work itself, callable on its own:  select public.expire_booking_holds();
create or replace function public.expire_booking_holds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  released integer;
begin
  update public."booking"
     set status = 'cancelled',
         "holdExpiresAt" = null,
         "updatedAt" = now()
   where status = 'pending'
     and "holdExpiresAt" is not null
     and "holdExpiresAt" < now();

  get diagnostics released = row_count;
  return released;
end;
$$;

comment on function public.expire_booking_holds() is
  'Cancels pending bookings whose payment window closed, freeing their seats.';

-- 2. The schedule. pg_cron is available on Supabase; enabling it is idempotent.
create extension if not exists pg_cron;

-- Replace the job if it already exists, so re-running this file is safe.
do $$
begin
  perform cron.unschedule('expire-booking-holds');
exception
  when others then null;  -- no such job yet
end;
$$;

select cron.schedule(
  'expire-booking-holds',
  '0 * * * *',                      -- hourly, on the hour
  $$select public.expire_booking_holds();$$
);

-- Check it landed:
--   select jobname, schedule, active from cron.job where jobname = 'expire-booking-holds';
-- See recent runs:
--   select status, return_message, start_time from cron.job_run_details
--    where jobid = (select jobid from cron.job where jobname = 'expire-booking-holds')
--    order by start_time desc limit 10;

notify pgrst, 'reload schema';
