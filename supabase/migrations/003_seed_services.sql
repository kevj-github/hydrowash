-- Seed Maintenance and Installation service types
INSERT INTO service_types (name, description, category, active, duration_minutes, price_sgd)
VALUES
  ('General Service',       'Basic aircon cleaning and filter wash.',                        'MAINTENANCE',  true, 60,  80.00),
  ('Chemical Wash',         'Deep clean to restore cooling efficiency and air quality.',     'MAINTENANCE',  true, 90, 120.00),
  ('Chemical Overhaul',     'Full disassembly clean for heavily soiled units.',              'MAINTENANCE',  true, 120,180.00),
  ('New Unit Installation', 'Supply and install a new aircon unit with proper setup and testing.', 'INSTALLATION', true, 180, NULL);
