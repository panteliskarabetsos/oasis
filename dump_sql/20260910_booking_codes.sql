-- Random booking references.
--
-- Until now a reference was just "BK-" plus the row id, so BK-000042 told you
-- the next customer would be BK-000043 — guessable, and enumerable against the
-- guest lookup. Give every booking an unguessable code instead, assigned by a
-- trigger so it holds no matter which path creates the row.
--
-- Alphabet is Crockford base32 (no I, L, O or U) so a code read down the phone
-- cannot be mistyped. 8 characters = 32^8 ≈ 1.1 trillion possibilities.

alter table public.booking add column if not exists code text;

create unique index if not exists booking_code_key
  on public.booking (code) where code is not null;

create or replace function public.gen_booking_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  body text := '';
  i int;
begin
  for i in 1..8 loop
    body := body || substr(alphabet, 1 + floor(random() * 32)::int, 1);
  end loop;
  return 'BK-' || substr(body, 1, 4) || '-' || substr(body, 5, 4);
end;
$$;

-- Assign on insert, retrying on the vanishingly unlikely collision.
create or replace function public.booking_assign_code()
returns trigger
language plpgsql
as $$
declare
  candidate text;
  tries int := 0;
begin
  if new.code is not null and new.code <> '' then
    return new;
  end if;
  loop
    candidate := public.gen_booking_code();
    exit when not exists (select 1 from public.booking where code = candidate);
    tries := tries + 1;
    if tries > 20 then
      raise exception 'could not allocate a unique booking code';
    end if;
  end loop;
  new.code := candidate;
  return new;
end;
$$;

drop trigger if exists booking_assign_code_trg on public.booking;
create trigger booking_assign_code_trg
  before insert on public.booking
  for each row execute function public.booking_assign_code();

-- Backfill everything that already exists, one row at a time so each gets its
-- own value (a set-based update would evaluate random() per row anyway, but the
-- uniqueness check has to see prior rows).
do $$
declare
  r record;
  candidate text;
  tries int;
begin
  for r in select id from public.booking where code is null or code = '' loop
    tries := 0;
    loop
      candidate := public.gen_booking_code();
      exit when not exists (select 1 from public.booking where code = candidate);
      tries := tries + 1;
      if tries > 20 then
        raise exception 'could not allocate a unique booking code for booking %', r.id;
      end if;
    end loop;
    update public.booking set code = candidate where id = r.id;
  end loop;
end $$;

-- PostgREST caches the schema.
notify pgrst, 'reload schema';
