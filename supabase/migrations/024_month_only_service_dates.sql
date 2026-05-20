ALTER TABLE contract_service_dates
  ADD COLUMN IF NOT EXISTS due_month text;

UPDATE contract_service_dates
  SET due_month = to_char(due_date, 'YYYY-MM')
  WHERE due_month IS NULL;

ALTER TABLE contract_service_dates
  ALTER COLUMN due_month SET NOT NULL;

ALTER TABLE contract_service_dates
  ADD COLUMN IF NOT EXISTS second_reminder_sent boolean NOT NULL DEFAULT false;
