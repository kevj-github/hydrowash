-- 020_multi_slot.sql
-- Adds preferred_slots[] (customer availability windows) and confirmed_slot (admin pick).
-- Drops the PENDING/APPROVED slot uniqueness constraint (multi-slot model: conflicts
-- resolved by admin, not enforced at submission). Drops unique constraint on
-- booking_unit_locations so the same room can be listed for multiple units.

-- 1. Add preferred_slots: customer's 1-3 availability choices
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS preferred_slots text[] NOT NULL DEFAULT '{}';

-- 2. Add confirmed_slot: set by admin when approving
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS confirmed_slot text
  CHECK (confirmed_slot IS NULL OR confirmed_slot IN ('S10_12','S13_15','S15_17','S17_19','S19_21'));

-- 3. Backfill preferred_slots for existing bookings
UPDATE bookings
  SET preferred_slots = ARRAY[time_slot]
  WHERE time_slot IS NOT NULL AND preferred_slots = '{}';

-- 4. Drop old unique index (no longer valid with multi-slot preferences)
DROP INDEX IF EXISTS bookings_date_slot_unique;

-- 5. New unique index: only APPROVED confirmed slots must be unique per confirmed date
CREATE UNIQUE INDEX IF NOT EXISTS bookings_confirmed_slot_unique
  ON bookings (confirmed_date, confirmed_slot)
  WHERE status = 'APPROVED' AND confirmed_slot IS NOT NULL AND confirmed_date IS NOT NULL;

-- 6. Allow same room for multiple units (drop UNIQUE on booking_unit_locations)
ALTER TABLE booking_unit_locations
  DROP CONSTRAINT IF EXISTS booking_unit_locations_booking_id_location_id_key;
