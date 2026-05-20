ALTER TABLE bookings
  DROP CONSTRAINT bookings_status_check,
  ADD CONSTRAINT bookings_status_check
    CHECK (status IN ('PENDING','APPROVED','REJECTED','COMPLETED','CANCELLED'));

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS cancelled_reason text;
