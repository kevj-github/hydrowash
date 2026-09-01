-- 034_function_grants_and_search_path.sql
--
-- Cleanup surfaced by Supabase's security advisor immediately after applying 033.
--
--   1. assign_customer_no / assign_work_order_no have a mutable search_path.
--      Pre-existing; missed by the original audit because that sweep grepped for
--      "SECURITY DEFINER" and these two are SECURITY INVOKER. Lower risk for that
--      reason — they run with the caller's privileges, not the owner's — but lint
--      0011 applies to any function and pinning costs nothing.
--
--   2. The two trigger functions added by 033 are SECURITY DEFINER and carry
--      PostgreSQL's default PUBLIC EXECUTE grant, so they show up as callable via
--      /rest/v1/rpc/ (lints 0028/0029). A function returning `trigger` cannot
--      actually be invoked that way — Postgres rejects it with "trigger functions
--      can only be called as triggers" — so this is hygiene rather than a live hole,
--      but the grant serves no purpose: triggers fire through the table, not through
--      a caller's EXECUTE privilege. Revoked here for handle_new_user and the
--      assign_* pair as well, all of which are trigger functions.
--
-- Deliberately NOT changed: get_my_role().
--   The advisor flags it under the same 0028/0029 lints, but it is the only one of
--   these that is not a trigger function, and every admin RLS policy calls it.
--   Policy expressions are evaluated with the querying user's privileges, so
--   revoking EXECUTE from `authenticated` would break every admin policy, and
--   revoking from `anon` would break the public service_types listing
--   (service_types_read calls get_my_role()). Its search_path is pinned by 033,
--   which was the actual vulnerability. Leaving the grant is correct here.

BEGIN;

ALTER FUNCTION public.assign_customer_no()   SET search_path = public, pg_temp;
ALTER FUNCTION public.assign_work_order_no() SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.enforce_customer_booking_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_customer_booking_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_customer_no()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_work_order_no()            FROM PUBLIC, anon, authenticated;

COMMIT;
