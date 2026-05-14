-- 012_phase2_app_settings.sql
-- New columns on the singleton app_settings row for PayNow and contract pricing.

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS paynow_mobile text,
  ADD COLUMN IF NOT EXISTS contract_pricing_tiers jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Seed placeholder tiers. Admin updates via /admin/settings.
-- Format: [{min_units, max_units (null = unlimited / per-unit rate), price_sgd}]
-- For max_units = null: total = price_sgd × unit_count
UPDATE app_settings
SET contract_pricing_tiers = '[
  {"min_units": 1, "max_units": 2,   "price_sgd": 400},
  {"min_units": 3, "max_units": 4,   "price_sgd": 600},
  {"min_units": 5, "max_units": 5,   "price_sgd": 800},
  {"min_units": 6, "max_units": null, "price_sgd": 150}
]'::jsonb
WHERE id = 1;
