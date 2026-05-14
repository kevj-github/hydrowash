-- Add PENDING_REVIEW status and expiry_reminder_sent to contracts
ALTER TABLE contracts
  ALTER COLUMN price_sgd DROP NOT NULL,
  ALTER COLUMN price_sgd SET DEFAULT NULL,
  DROP CONSTRAINT IF EXISTS contracts_status_check,
  ADD CONSTRAINT contracts_status_check
    CHECK (status IN ('PENDING_REVIEW', 'ACTIVE', 'EXPIRED', 'CANCELLED'));

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS expiry_reminder_sent boolean NOT NULL DEFAULT false;
