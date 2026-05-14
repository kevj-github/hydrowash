-- 016_phase2_rls.sql
-- RLS policies for all Phase 2 new tables.

-- ── ac_unit_locations ──────────────────────────────────────────────────────────
ALTER TABLE ac_unit_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ac_locations_read_all" ON ac_unit_locations
  FOR SELECT USING (true);

CREATE POLICY "ac_locations_admin_write" ON ac_unit_locations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── booking_unit_locations ─────────────────────────────────────────────────────
ALTER TABLE booking_unit_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking_locations_select_customer" ON booking_unit_locations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM bookings WHERE id = booking_id AND customer_id = auth.uid())
  );

CREATE POLICY "booking_locations_select_admin" ON booking_unit_locations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "booking_locations_insert_own" ON booking_unit_locations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM bookings WHERE id = booking_id AND customer_id = auth.uid())
  );

CREATE POLICY "booking_locations_admin_all" ON booking_unit_locations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── blocked_slots ──────────────────────────────────────────────────────────────
ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocked_slots_read_all" ON blocked_slots
  FOR SELECT USING (true);

CREATE POLICY "blocked_slots_admin_write" ON blocked_slots
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── ac_unit_types ──────────────────────────────────────────────────────────────
ALTER TABLE ac_unit_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ac_unit_types_read_all" ON ac_unit_types
  FOR SELECT USING (true);

CREATE POLICY "ac_unit_types_admin_write" ON ac_unit_types
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── ac_brands ──────────────────────────────────────────────────────────────────
ALTER TABLE ac_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ac_brands_read_all" ON ac_brands
  FOR SELECT USING (true);

CREATE POLICY "ac_brands_admin_write" ON ac_brands
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
