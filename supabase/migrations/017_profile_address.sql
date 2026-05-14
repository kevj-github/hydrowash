-- 017_profile_address.sql
-- Add address fields to profiles so customers can store their home address.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS address_lat float8,
  ADD COLUMN IF NOT EXISTS address_lng float8,
  ADD COLUMN IF NOT EXISTS postal_code text;
