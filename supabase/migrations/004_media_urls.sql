-- Add media attachments to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS media_urls text[] DEFAULT '{}';
