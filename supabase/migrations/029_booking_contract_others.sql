-- Migration 029: add contract_id and unit_location_others to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS unit_location_others text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL;
