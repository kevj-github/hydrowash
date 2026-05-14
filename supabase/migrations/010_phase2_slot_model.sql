-- 010_phase2_slot_model.sql
-- Replaces date-range booking model with single-date + fixed-slot.
-- Run AFTER manually wiping booking/contract data in Supabase SQL editor:
--   TRUNCATE TABLE bookings, contracts, contract_service_dates, invoices CASCADE;

-- Remove old date-range and slot columns
ALTER TABLE bookings
  DROP COLUMN IF EXISTS earliest_date,
  DROP COLUMN IF EXISTS latest_date,
  DROP COLUMN IF EXISTS preferred_slot,
  DROP COLUMN IF EXISTS room_type;

-- Add new slot columns
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booking_date date,
  ADD COLUMN IF NOT EXISTS time_slot text
    CHECK (time_slot IN ('S10_12','S13_15','S15_17','S17_19','S19_21'));

-- Enforce NOT NULL (safe after wipe)
ALTER TABLE bookings ALTER COLUMN booking_date SET NOT NULL;
ALTER TABLE bookings ALTER COLUMN time_slot SET NOT NULL;

-- Partial unique index: one booking per slot among PENDING + APPROVED only
-- COMPLETED/REJECTED rows do not count, allowing the slot to be re-booked.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_date_slot_unique
  ON bookings (booking_date, time_slot)
  WHERE status IN ('PENDING', 'APPROVED');
