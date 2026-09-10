-- Migration 036: contract hard-delete was failing on every contract that had
-- a linked booking or invoice ("bookings: column not updatable by customer").
--
-- Root cause: bookings_contract_id_fkey / invoices_contract_id_fkey are
-- ON DELETE SET NULL, so deleting a contract makes Postgres UPDATE
-- bookings.contract_id (and invoices.contract_id) to NULL as part of the
-- DELETE. That UPDATE still fires trg_enforce_customer_booking_update,
-- which only exempted an admin-authenticated session (get_my_role() =
-- 'admin') — not the service-role client the admin API routes use for
-- privileged writes (createAdminClient() has no auth.uid() session, so
-- get_my_role() returns NULL). The trigger then saw contract_id changing
-- and rejected it as an unauthorized customer edit, so the whole contract
-- DELETE rolled back.
--
-- Fix: also exempt auth.role() = 'service_role', matching how the admin
-- API routes actually perform these writes.

CREATE OR REPLACE FUNCTION public.enforce_customer_booking_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  effective_date date;
BEGIN
  IF get_my_role() = 'admin' OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.customer_id      IS DISTINCT FROM OLD.customer_id
  OR NEW.category         IS DISTINCT FROM OLD.category
  OR NEW.service_type_id  IS DISTINCT FROM OLD.service_type_id
  OR NEW.contract_id      IS DISTINCT FROM OLD.contract_id
  OR NEW.work_order_no    IS DISTINCT FROM OLD.work_order_no
  OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
  THEN
    RAISE EXCEPTION 'bookings: column not updatable by customer';
  END IF;

  IF (NEW.confirmed_date IS DISTINCT FROM OLD.confirmed_date AND NEW.confirmed_date IS NOT NULL)
  OR (NEW.confirmed_slot IS DISTINCT FROM OLD.confirmed_slot AND NEW.confirmed_slot IS NOT NULL)
  THEN
    RAISE EXCEPTION 'bookings: confirmed_date/confirmed_slot are set by admin only';
  END IF;

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
$function$;
