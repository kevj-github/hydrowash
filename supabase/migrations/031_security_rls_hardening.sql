-- 031_security_rls_hardening.sql
-- Fixes two privilege-escalation vulnerabilities in RLS policies.
--
-- Vuln 1 (HIGH): profiles_update had no WITH CHECK clause, so any customer
-- could call the Supabase REST API directly to set role='admin' on their own
-- profile row. Fix: add WITH CHECK that non-admins may only write role='customer'.
--
-- Vuln 2 (HIGH): bookings_customer_update WITH CHECK only verified customer_id
-- ownership. A customer could directly PATCH their booking to status='APPROVED',
-- set confirmed_date/confirmed_slot, or mark COMPLETED. Fix: restrict the
-- resulting status to PENDING or CANCELLED (the only two states legitimate
-- customer operations produce).

-- ── Fix 1: profiles.role cannot be self-escalated ────────────────────────────

DROP POLICY IF EXISTS "profiles_update" ON profiles;

CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (id = auth.uid() OR get_my_role() = 'admin')
  WITH CHECK (
    get_my_role() = 'admin'   -- admins may set any role
    OR role = 'customer'      -- non-admins may only retain/write 'customer'
  );

-- ── Fix 2: customers cannot self-approve or self-complete bookings ───────────

DROP POLICY IF EXISTS "bookings_customer_update" ON bookings;

CREATE POLICY "bookings_customer_update" ON bookings FOR UPDATE
  USING (customer_id = auth.uid())
  WITH CHECK (
    customer_id = auth.uid()
    AND status IN ('PENDING', 'CANCELLED')
  );
