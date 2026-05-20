-- Allows customers to update their own bookings (reschedule + cancel flows).
-- The API routes enforce the 24h cutoff and status guards before the DB update.
CREATE POLICY "bookings_customer_update" ON bookings FOR UPDATE
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());
