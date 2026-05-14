-- 011_phase2_ac_locations.sql
-- AC unit location list (admin-managed room labels) + per-booking locations.
-- Also seeds AC unit types and AC brands used by invoice finalization.

-- ── Room labels ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ac_unit_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking_unit_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES ac_unit_locations(id) ON DELETE RESTRICT,
  UNIQUE (booking_id, location_id)
);

INSERT INTO ac_unit_locations (label, display_order) VALUES
  ('Master Bedroom', 1),
  ('Room 1',         2),
  ('Room 2',         3),
  ('Room 3',         4),
  ('Living Room',    5),
  ('Kitchen',        6),
  ('Study Room',     7)
ON CONFLICT (label) DO NOTHING;

-- ── AC unit types ──────────────────────────────────────────────────────────────
-- Used by admin when finalising invoices (unit type per AC serviced).

CREATE TABLE IF NOT EXISTS ac_unit_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO ac_unit_types (label, display_order) VALUES
  ('Wall Mounted',  1),
  ('Ducted Unit',   2),
  ('Cassette Unit', 3)
ON CONFLICT (label) DO NOTHING;

-- ── AC brands ──────────────────────────────────────────────────────────────────
-- Used by admin when finalising invoices (brand per AC serviced).

CREATE TABLE IF NOT EXISTS ac_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO ac_brands (label, display_order) VALUES
  ('Mitsubishi', 1),
  ('Daikin',     2),
  ('Panasonic',  3),
  ('Toshiba',    4),
  ('Samsung',    5),
  ('Midea',      6)
ON CONFLICT (label) DO NOTHING;
