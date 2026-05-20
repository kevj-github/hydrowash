-- Adds customer_no, work_order_no, attended_by to existing tables.
-- Creates job_completions table for job completion workflow.

-- Customer number on profiles (auto-increment)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS customer_no bigint;

CREATE SEQUENCE IF NOT EXISTS profiles_customer_no_seq START 1;

-- Backfill existing profiles
UPDATE profiles
  SET customer_no = nextval('profiles_customer_no_seq')
  WHERE customer_no IS NULL;

-- Work order number and attended_by on bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS work_order_no bigint,
  ADD COLUMN IF NOT EXISTS attended_by text;

CREATE SEQUENCE IF NOT EXISTS bookings_work_order_no_seq START 1;

-- Trigger: auto-assign work_order_no when booking status → COMPLETED
CREATE OR REPLACE FUNCTION assign_work_order_no()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'COMPLETED' AND (OLD.status IS DISTINCT FROM 'COMPLETED') AND NEW.work_order_no IS NULL THEN
    NEW.work_order_no := nextval('bookings_work_order_no_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assign_work_order_no
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION assign_work_order_no();

-- Trigger: auto-assign customer_no on new profile
CREATE OR REPLACE FUNCTION assign_customer_no()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_no IS NULL THEN
    NEW.customer_no := nextval('profiles_customer_no_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assign_customer_no
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION assign_customer_no();

-- Job completions table
CREATE TABLE IF NOT EXISTS job_completions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  completed_by uuid REFERENCES auth.users(id),
  completed_at timestamptz NOT NULL DEFAULT now(),
  attended_by text,
  time_arrived text,
  time_completed text,
  ac_details jsonb NOT NULL DEFAULT '[]',
  checklist jsonb NOT NULL DEFAULT '[]',
  job_description text,
  job_rendered text,
  remarks text,
  additional_charges jsonb NOT NULL DEFAULT '[]',
  base_price_sgd numeric,
  total_sgd numeric,
  pdf_url text,
  UNIQUE(booking_id)
);

ALTER TABLE job_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jc_admin" ON job_completions FOR ALL
  USING (get_my_role() = 'admin');

CREATE POLICY "jc_customer_read" ON job_completions FOR SELECT
  USING (
    booking_id IN (
      SELECT id FROM bookings WHERE customer_id = auth.uid()
    )
  );
