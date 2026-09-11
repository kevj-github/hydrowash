-- resolve_customer_region() was created in 040 without a pinned search_path,
-- flagged by the Supabase security linter (function_search_path_mutable) —
-- the same hardening migration 034 already applied to the codebase's other
-- SECURITY DEFINER/plpgsql functions was missed here.
CREATE OR REPLACE FUNCTION resolve_customer_region(postal text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  sector int;
BEGIN
  IF postal IS NULL OR length(trim(postal)) < 2 THEN
    RETURN 'UNCLASSIFIED';
  END IF;

  BEGIN
    sector := substring(trim(postal) from 1 for 2)::int;
  EXCEPTION WHEN others THEN
    RETURN 'UNCLASSIFIED';
  END;

  RETURN CASE
    WHEN sector BETWEEN 1 AND 10 THEN 'CENTRAL'
    WHEN sector BETWEEN 11 AND 13 THEN 'WEST'
    WHEN sector BETWEEN 14 AND 37 THEN 'CENTRAL'
    WHEN sector BETWEEN 38 AND 52 THEN 'EAST'
    WHEN sector BETWEEN 53 AND 57 THEN 'NORTH_EAST'
    WHEN sector BETWEEN 58 AND 71 THEN 'WEST'
    WHEN sector BETWEEN 72 AND 78 THEN 'NORTH'
    WHEN sector BETWEEN 79 AND 80 THEN 'NORTH_EAST'
    WHEN sector = 81 THEN 'EAST'
    WHEN sector = 82 THEN 'NORTH_EAST'
    ELSE 'UNCLASSIFIED'
  END;
END;
$$;
