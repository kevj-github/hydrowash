-- Adds preferred_date_slots JSONB to bookings.
-- Structure: [{"date": "YYYY-MM-DD", "slots": ["S10_12", ...]}, ...]
-- booking_date + preferred_slots + time_slot remain for backward compat.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS preferred_date_slots jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill existing rows from current booking_date + preferred_slots
UPDATE bookings
SET preferred_date_slots = jsonb_build_array(
  jsonb_build_object('date', booking_date::text, 'slots', preferred_slots)
)
WHERE preferred_date_slots = '[]'::jsonb;
