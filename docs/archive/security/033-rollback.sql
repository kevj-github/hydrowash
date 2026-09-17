-- 033-rollback.sql — reverts migration 033 to the pre-033 state.
-- ⚠ This REOPENS the HIGH-severity self-approval hole (B1). Use only if 033 breaks
-- customer booking flows and you need to restore service while investigating.

BEGIN;

DROP TRIGGER IF EXISTS trg_enforce_customer_booking_insert ON bookings;
DROP TRIGGER IF EXISTS trg_enforce_customer_booking_update ON bookings;
DROP FUNCTION IF EXISTS enforce_customer_booking_insert();
DROP FUNCTION IF EXISTS enforce_customer_booking_update();

DROP POLICY IF EXISTS "bookings_customer_insert" ON bookings;
CREATE POLICY "bookings_customer_insert" ON bookings FOR INSERT
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- get_my_role keeps its pinned search_path: that change is behaviour-neutral and
-- there is no reason to revert it.

COMMIT;
