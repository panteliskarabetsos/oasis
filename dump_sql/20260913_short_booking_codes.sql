-- Shorter booking references.
--
-- A reference is read down the phone and typed into a small field, so
-- "BK-KZRW-6KV2" was more than the job needed. New bookings get five
-- characters, no prefix and no dashes: "7Q2K9".
--
-- Alphabet stays Crockford base32 (no I, L, O or U) so a code cannot be
-- misheard into a different one. 32^5 ≈ 33.5 million references — ample here,
-- and the trigger still retries on the vanishingly unlikely collision.
--
-- Existing codes are deliberately left alone. Guests are holding confirmation
-- emails and ticket PDFs whose QR carries the old reference; regenerating
-- would stop those scanning at the gate. Both forms resolve in the app.

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
  for i in 1..5 loop
    body := body || substr(alphabet, 1 + floor(random() * 32)::int, 1);
  end loop;
  return body;
end;
$$;

comment on function public.gen_booking_code() is
  'A five character Crockford base32 booking reference, e.g. 7Q2K9.';

-- public.booking_assign_code() is unchanged: it calls this, checks the code is
-- free, and retries. The unique index booking_code_key still guards it.

-- PostgREST caches the schema.
notify pgrst, 'reload schema';
