-- Region-coded customer numbers.
--
-- Region is derived from the 2-digit Singapore postal-code "sector", grouped
-- into URA's 5 official planning regions (Central/East/North/North-East/West).
-- This is a best-effort mapping via the standard 28 Singapore postal districts
-- (a handful of districts straddle two planning regions — e.g. District 20
-- covers both Ang Mo Kio (North-East) and Bishan (Central) — each such
-- district is mapped to the region matching the larger/better-known area).
-- It's a convenience grouping for customer numbering, not authoritative geodata.
--
-- Number bands (sequential within each band, atomically assigned):
--   CENTRAL       1000–1999
--   EAST          2000–2999
--   NORTH         3000–3999
--   NORTH_EAST    4000–4999
--   WEST          5000–5999
--   UNCLASSIFIED  9000–9999   (no postal code, or one outside 01–82)
--
-- Existing customers keep their old sequential customer_no (1, 2, 3, ...) —
-- this migration does not retroactively renumber them, since those numbers
-- may already appear on invoices/work-order PDFs already sent to customers.
-- An admin can still manually move an existing customer onto the new scheme
-- via the customer-no editor (PATCH /api/admin/customers/[id]/customer-no).

CREATE TABLE IF NOT EXISTS customer_no_counters (
  region text PRIMARY KEY,
  next_no int NOT NULL
);

INSERT INTO customer_no_counters (region, next_no) VALUES
  ('CENTRAL', 1000),
  ('EAST', 2000),
  ('NORTH', 3000),
  ('NORTH_EAST', 4000),
  ('WEST', 5000),
  ('UNCLASSIFIED', 9000)
ON CONFLICT (region) DO NOTHING;

ALTER TABLE customer_no_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customer_no_counters_admin_read" ON customer_no_counters
  FOR SELECT USING (get_my_role() = 'admin');

CREATE OR REPLACE FUNCTION resolve_customer_region(postal text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
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

CREATE OR REPLACE FUNCTION assign_customer_no()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_region text;
  v_assigned int;
BEGIN
  IF NEW.role <> 'customer' THEN
    RETURN NEW;
  END IF;
  IF NEW.customer_no IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_region := resolve_customer_region(NEW.postal_code);

  UPDATE customer_no_counters
    SET next_no = next_no + 1
    WHERE customer_no_counters.region = v_region
    RETURNING next_no - 1 INTO v_assigned;

  NEW.customer_no := v_assigned;
  RETURN NEW;
END;
$$;

-- Uniqueness across both the legacy sequence (small ints) and the new bands
-- (1000+) — a manual admin edit could otherwise collide with either.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_customer_no_unique
  ON profiles (customer_no) WHERE customer_no IS NOT NULL;
