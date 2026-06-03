alter table profiles
  add column if not exists unit_floor text,
  add column if not exists building_name text;
