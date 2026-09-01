-- 033-verify.sql — run in the Supabase SQL editor AFTER applying migration 033.
-- Read-only except for the final functional test, which is wrapped in a ROLLBACK
-- so it creates no data.

-- ── A. Structural checks — all four rows must say PASS ───────────────────────

SELECT 'get_my_role search_path' AS check,
       CASE WHEN 'search_path=public, pg_temp' = ANY(p.proconfig)
            THEN 'PASS' ELSE 'FAIL — search_path not pinned' END AS result
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'get_my_role' AND n.nspname = 'public'

UNION ALL
SELECT 'bookings_customer_insert pins status',
       CASE WHEN pg_get_expr(pol.polwithcheck, pol.polrelid) LIKE '%PENDING%'
            THEN 'PASS' ELSE 'FAIL — status not pinned' END
FROM pg_policy pol WHERE pol.polname = 'bookings_customer_insert'

UNION ALL
SELECT 'insert guard trigger',
       CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL — trigger missing' END
FROM pg_trigger WHERE tgname = 'trg_enforce_customer_booking_insert'

UNION ALL
SELECT 'update guard trigger',
       CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL — trigger missing' END
FROM pg_trigger WHERE tgname = 'trg_enforce_customer_booking_update';

-- ── B. Dormant technician policies are gone (expect zero rows) ───────────────

SELECT polname AS leftover_technician_policy
FROM pg_policy WHERE polname IN ('bookings_tech_read', 'profiles_tech_read');

-- ── C. Functional test: can a customer still self-approve? ───────────────────
-- Replace <CUSTOMER_UUID> with any real profiles.id where role = 'customer',
-- and <SERVICE_TYPE_UUID> with any service_types.id where active = true
-- and category = 'MAINTENANCE'. Find them with:
--     SELECT id FROM profiles WHERE role = 'customer' LIMIT 1;
--     SELECT id FROM service_types WHERE active AND category = 'MAINTENANCE' LIMIT 1;
--
-- EXPECTED after 033: "new row violates row-level security policy for table bookings".
-- If it INSERTS successfully, the migration did NOT take — do not close this out.

BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}';

  INSERT INTO bookings (
    customer_id, category, service_type_id, address, postal_code, lat, lng,
    booking_date, time_slot, status, confirmed_date, confirmed_slot
  ) VALUES (
    '<CUSTOMER_UUID>', 'MAINTENANCE', '<SERVICE_TYPE_UUID>',
    'RLS probe', '000000', 1.3, 103.8,
    '2027-01-04', 'S10_12',
    'APPROVED', '2027-01-04', 'S10_12'   -- <- the escalation being tested
  );
ROLLBACK;

-- ── D. Control: the same insert as PENDING must still be allowed ─────────────
-- This proves 033 did not break ordinary booking creation.
-- EXPECTED: succeeds (then rolls back).

BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}';

  INSERT INTO bookings (
    customer_id, category, service_type_id, address, postal_code, lat, lng,
    booking_date, time_slot, status
  ) VALUES (
    '<CUSTOMER_UUID>', 'MAINTENANCE', '<SERVICE_TYPE_UUID>',
    'RLS probe', '000000', 1.3, 103.8,
    '2027-01-04', 'S10_12', 'PENDING'
  );
ROLLBACK;
