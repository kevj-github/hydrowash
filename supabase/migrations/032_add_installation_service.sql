-- Add installation service type if missing
INSERT INTO service_types (name, description, category, active, duration_minutes, price_sgd)
SELECT 'AC Installation', 'Supply and install a new aircon unit with setup and testing.', 'INSTALLATION', true, 180, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM service_types WHERE category = 'INSTALLATION' AND (LOWER(name) LIKE '%install%')
);
