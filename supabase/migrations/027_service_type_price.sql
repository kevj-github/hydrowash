-- Adds optional default price to service_types for invoice pre-fill.
ALTER TABLE service_types
  ADD COLUMN IF NOT EXISTS default_price_sgd numeric;
