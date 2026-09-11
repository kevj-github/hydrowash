-- Bookings only ever stored the composed full address string. Unit/floor,
-- building name, and landmark/access notes were entered in the booking
-- wizard but discarded after being folded into that composed string, so the
-- "book again" prefill (GET /api/bookings/last, GET /api/bookings/[id])
-- could never recall them separately for the next booking. Store them as
-- their own columns, matching the pattern already used on `profiles`
-- (migration 030) and `contracts` (migration 038's unit_details).
alter table bookings
  add column if not exists unit_floor text,
  add column if not exists building_name text,
  add column if not exists access_notes text;
