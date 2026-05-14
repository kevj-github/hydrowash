-- Allow technicians to read bookings that are part of their car's schedule for today
CREATE POLICY "bookings_tech_read" ON bookings FOR SELECT USING (
  get_my_role() = 'technician'
  AND id IN (
    SELECT booking_id FROM scheduled_jobs
    WHERE service_car_id = get_my_car_id()
    AND scheduled_date = current_date
  )
);
