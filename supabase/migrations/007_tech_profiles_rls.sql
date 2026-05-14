-- Allow technicians to read customer profiles for today's jobs on their car
CREATE POLICY "profiles_tech_read" ON profiles FOR SELECT USING (
  get_my_role() = 'technician'
  AND id IN (
    SELECT b.customer_id FROM bookings b
    JOIN scheduled_jobs sj ON sj.booking_id = b.id
    WHERE sj.service_car_id = get_my_car_id()
    AND sj.scheduled_date = current_date
  )
);
