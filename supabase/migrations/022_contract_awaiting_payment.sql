-- Adds AWAITING_PAYMENT to the contracts status check constraint.
-- Status flow: PENDING_REVIEW → AWAITING_PAYMENT → ACTIVE → EXPIRED / CANCELLED

ALTER TABLE contracts
  DROP CONSTRAINT IF EXISTS contracts_status_check,
  ADD CONSTRAINT contracts_status_check
    CHECK (status IN ('PENDING_REVIEW', 'AWAITING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELLED'));
