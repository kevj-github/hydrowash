-- Admin-managed "attended by" technician options, with one flagged as default.
-- A table (not app_settings jsonb) because app_settings is world-readable
-- (migration 002: "settings_read" ... USING (true)) and staff names should not be.
CREATE TABLE IF NOT EXISTS staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  is_default boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_members_single_default
  ON staff_members (is_default) WHERE is_default;

ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;

-- Admin-only in both directions — unlike ac_brands/ac_unit_types (customer-readable
-- catalogs), only admins ever need to see or manage staff names.
CREATE POLICY "staff_members_admin_all" ON staff_members
  FOR ALL USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

INSERT INTO staff_members (label, is_default, display_order) VALUES
  ('Gilbert', true, 1)
ON CONFLICT (label) DO NOTHING;
