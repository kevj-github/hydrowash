-- Per-unit AC details captured at contract creation/request time (location, unit
-- type, optional brand — with denormalized label snapshots so pruning/renaming a
-- catalog row later never corrupts a historical contract).
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS unit_details jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Either empty (legacy rows, or a request that skipped details) or exactly num_units entries.
ALTER TABLE contracts
  ADD CONSTRAINT contracts_unit_details_len
  CHECK (
    jsonb_typeof(unit_details) = 'array'
    AND (jsonb_array_length(unit_details) = 0
         OR jsonb_array_length(unit_details) = num_units)
  );

COMMENT ON COLUMN contracts.unit_details IS
  'ContractUnitDetail[]: {no, location_id, location_label, unit_type_id, unit_type_label, brand_id, brand_label}. Labels are denormalized snapshots so catalog edits do not rewrite history.';
