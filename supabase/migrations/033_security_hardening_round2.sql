-- 033_security_hardening_round2.sql
--
-- Follow-up to 031. That migration closed self-approval on the UPDATE path and left
-- the same write reachable via INSERT; it also did not address the search_path on the
-- function every admin policy depends on. See docs/security/2026-08-31-*.md.
--
--   1. get_my_role() ran SECURITY DEFINER with a mutable search_path
--   2. bookings_customer_insert constrained ownership but not state (self-approval)
--   3. profiles_insert constrained ownership but not role
--   4. reschedule/cancel rules lived only in the route handler, not in the database
--   5. contract_id and service_type_id were written without validation
--   6. dormant technician policies referenced objects dropped in 008

BEGIN;

-- ── 1. Pin the search_path on the authorisation primitive ────────────────────
-- get_my_role() backs every admin RLS policy in the schema. As SECURITY DEFINER
-- with an unpinned search_path, a role able to create objects in an earlier schema
-- could shadow `profiles` and make it return 'admin'. Supabase linter 0011.

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- ── 2. Remove dormant technician policies ────────────────────────────────────
-- 008 dropped scheduled_jobs, service_cars, profiles.service_car_id and
-- get_my_car_id(), and narrowed profiles_role_check to ('customer','admin'), but the
-- policies created in 006/007 that reference those objects were never dropped by name.
-- Idempotent: no-ops if 008 already cascaded them away.

DROP POLICY IF EXISTS "bookings_tech_read" ON bookings;
DROP POLICY IF EXISTS "profiles_tech_read" ON profiles;
DROP FUNCTION IF EXISTS get_my_car_id();

-- ── 3. Customers may only INSERT a booking in the PENDING state ──────────────
-- Previously `with check (customer_id = auth.uid())` only. status is a plain column
-- whose CHECK permits 'APPROVED', so a customer could POST an already-approved
-- booking to PostgREST with a chosen confirmed_date/confirmed_slot: self-scheduled
-- work in the admin's route plan, and — via the unique index on
-- (confirmed_date, confirmed_slot) WHERE status='APPROVED' — a denial-of-booking
-- primitive against every other customer.

DROP POLICY IF EXISTS "bookings_customer_insert" ON bookings;

CREATE POLICY "bookings_customer_insert" ON bookings FOR INSERT
  WITH CHECK (
    customer_id = auth.uid()
    AND status = 'PENDING'
    AND confirmed_date IS NULL
    AND confirmed_slot IS NULL
    AND work_order_no IS NULL
  );

-- ── 4. Customers may only INSERT their own profile as role='customer' ────────
-- Unreachable today (handle_new_user creates the row inside the auth.users trigger,
-- so the primary key rejects a second insert), but it is the same shape as the
-- bookings hole above and 031 tightened only the UPDATE side.
-- Note: at signup get_my_role() is NULL, so the OR falls through to role='customer'.

DROP POLICY IF EXISTS "profiles_insert" ON profiles;

CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (
    id = auth.uid()
    AND (get_my_role() = 'admin' OR role = 'customer')
  );

-- ── 5. Mirror the route-handler rules into the database ──────────────────────
-- RLS is row-level and cannot express "these columns are immutable" or a time-based
-- cutoff, so the invariants that app/api/bookings/[id]/{reschedule,cancel}/route.ts
-- enforce are implemented as BEFORE triggers. Without these, a customer holding the
-- public anon key skips the route entirely via PostgREST.

CREATE OR REPLACE FUNCTION enforce_customer_booking_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  effective_date date;
BEGIN
  IF get_my_role() = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Columns a customer must never rewrite on an existing booking.
  IF NEW.customer_id      IS DISTINCT FROM OLD.customer_id
  OR NEW.category         IS DISTINCT FROM OLD.category
  OR NEW.service_type_id  IS DISTINCT FROM OLD.service_type_id
  OR NEW.contract_id      IS DISTINCT FROM OLD.contract_id
  OR NEW.work_order_no    IS DISTINCT FROM OLD.work_order_no
  OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
  THEN
    RAISE EXCEPTION 'bookings: column not updatable by customer';
  END IF;

  -- confirmed_* may be cleared (reschedule) or left alone (cancel), never set.
  IF (NEW.confirmed_date IS DISTINCT FROM OLD.confirmed_date AND NEW.confirmed_date IS NOT NULL)
  OR (NEW.confirmed_slot IS DISTINCT FROM OLD.confirmed_slot AND NEW.confirmed_slot IS NOT NULL)
  THEN
    RAISE EXCEPTION 'bookings: confirmed_date/confirmed_slot are set by admin only';
  END IF;

  -- 24-hour cutoff, measured against the booking as it stands before the change.
  -- The route handler is deliberately stricter than this (see the note in
  -- docs/security/2026-08-31-remediation.md); this is the backstop, not a re-spec.
  effective_date := COALESCE(
    OLD.confirmed_date,
    (OLD.preferred_date_slots -> 0 ->> 'date')::date,
    OLD.booking_date
  );

  IF effective_date IS NOT NULL
     AND (now() AT TIME ZONE 'Asia/Singapore')
         >= (effective_date::timestamp - interval '24 hours')
  THEN
    RAISE EXCEPTION 'bookings: within the 24-hour change cutoff';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_customer_booking_update ON bookings;
CREATE TRIGGER trg_enforce_customer_booking_update
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION enforce_customer_booking_update();

-- ── 6. Validate referenced rows on INSERT ────────────────────────────────────
-- contract_id was written straight from the request body with no ownership check, so
-- a booking could be linked to — and later invoiced against — a third party's
-- contract. service_type_id was never checked for active/category agreement, letting
-- a caller book a withdrawn service and inherit its stale price_sgd. The full-day
-- blocked_slots check existed only in the route.

CREATE OR REPLACE FUNCTION enforce_customer_booking_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF get_my_role() = 'admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.contract_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM contracts c
    WHERE c.id = NEW.contract_id AND c.customer_id = NEW.customer_id
  ) THEN
    RAISE EXCEPTION 'bookings: contract_id does not belong to this customer';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_types st
    WHERE st.id = NEW.service_type_id
      AND st.active = true
      AND st.category = NEW.category
  ) THEN
    RAISE EXCEPTION 'bookings: service_type_id is not an active service in this category';
  END IF;

  IF EXISTS (
    SELECT 1 FROM blocked_slots bs
    WHERE bs.blocked_date = NEW.booking_date AND bs.slot IS NULL
  ) THEN
    RAISE EXCEPTION 'bookings: that date is not available for booking';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_customer_booking_insert ON bookings;
CREATE TRIGGER trg_enforce_customer_booking_insert
  BEFORE INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION enforce_customer_booking_insert();

COMMIT;
