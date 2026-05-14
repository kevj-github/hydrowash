-- Drop technician-specific RLS policies on bookings
DROP POLICY IF EXISTS "Technicians can view today's bookings for their car" ON bookings;

-- Drop technician-specific RLS policies on profiles
DROP POLICY IF EXISTS "Technicians can view today's customers" ON profiles;

-- Drop RLS policies for tables being removed
DROP POLICY IF EXISTS "Admins can manage service_cars" ON service_cars;
DROP POLICY IF EXISTS "Technicians can view service_cars" ON service_cars;
DROP POLICY IF EXISTS "Admins can manage daily_car_availability" ON daily_car_availability;
DROP POLICY IF EXISTS "Technicians can view daily_car_availability" ON daily_car_availability;
DROP POLICY IF EXISTS "Admins can manage scheduled_jobs" ON scheduled_jobs;
DROP POLICY IF EXISTS "Technicians can view own car scheduled_jobs" ON scheduled_jobs;

-- Drop helper function used by technician RLS
DROP FUNCTION IF EXISTS get_my_car_id();

-- Drop tables (order matters for FK constraints)
DROP TABLE IF EXISTS daily_car_availability;
DROP TABLE IF EXISTS scheduled_jobs;
DROP TABLE IF EXISTS service_cars;

-- Drop service_car_id from profiles
ALTER TABLE profiles DROP COLUMN IF EXISTS service_car_id;

-- Remove 'technician' from role check constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('customer', 'admin'));
