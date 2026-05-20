ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS company_address text NOT NULL DEFAULT '404B Fernvale Lane, S792404',
  ADD COLUMN IF NOT EXISTS company_phone text NOT NULL DEFAULT '(+65) 8811 1105',
  ADD COLUMN IF NOT EXISTS company_email text NOT NULL DEFAULT 'hydrowash20@gmail.com',
  ADD COLUMN IF NOT EXISTS company_instagram text NOT NULL DEFAULT '@Hydrowash.sg',
  ADD COLUMN IF NOT EXISTS authorised_officer_name text NOT NULL DEFAULT 'Gilbert Chen';
