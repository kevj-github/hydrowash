-- 013_phase2_blocked_slots.sql
-- Admin can block full days or individual time slots.
-- slot IS NULL means the entire day is blocked.

CREATE TABLE IF NOT EXISTS blocked_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocked_date date NOT NULL,
  slot text CHECK (slot IN ('S10_12','S13_15','S15_17','S17_19','S19_21')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Full-day blocks: one row per date with slot IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS blocked_slots_full_day
  ON blocked_slots (blocked_date)
  WHERE slot IS NULL;

-- Slot-level blocks: one row per (date, slot) pair
CREATE UNIQUE INDEX IF NOT EXISTS blocked_slots_slot_level
  ON blocked_slots (blocked_date, slot)
  WHERE slot IS NOT NULL;
