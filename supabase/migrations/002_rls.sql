alter table profiles enable row level security;
alter table service_types enable row level security;
alter table service_cars enable row level security;
alter table bookings enable row level security;
alter table daily_car_availability enable row level security;
alter table scheduled_jobs enable row level security;
alter table app_settings enable row level security;

create or replace function get_my_role()
returns text language sql security definer stable as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function get_my_car_id()
returns uuid language sql security definer stable as $$
  select service_car_id from profiles where id = auth.uid()
$$;

-- profiles
create policy "profiles_select" on profiles for select
  using (id = auth.uid() or get_my_role() = 'admin');
create policy "profiles_insert" on profiles for insert
  with check (id = auth.uid());
create policy "profiles_update" on profiles for update
  using (id = auth.uid() or get_my_role() = 'admin');

-- service_types: public read of active; admin writes
create policy "service_types_read" on service_types for select
  using (active = true or get_my_role() = 'admin');
create policy "service_types_admin_write" on service_types for all
  using (get_my_role() = 'admin');

-- service_cars: admin + technician read; admin writes
create policy "service_cars_read" on service_cars for select
  using (get_my_role() in ('admin','technician'));
create policy "service_cars_admin_write" on service_cars for all
  using (get_my_role() = 'admin');

-- bookings: customer sees own; admin sees all
create policy "bookings_customer_read" on bookings for select
  using (customer_id = auth.uid() or get_my_role() = 'admin');
create policy "bookings_customer_insert" on bookings for insert
  with check (customer_id = auth.uid());
create policy "bookings_admin_update" on bookings for update
  using (get_my_role() = 'admin');

-- daily_car_availability: admin full; technician read
create policy "dca_admin" on daily_car_availability for all
  using (get_my_role() = 'admin');
create policy "dca_tech_read" on daily_car_availability for select
  using (get_my_role() = 'technician');

-- scheduled_jobs: admin full; technician reads own car today only
create policy "sj_admin" on scheduled_jobs for all
  using (get_my_role() = 'admin');
create policy "sj_tech_read" on scheduled_jobs for select
  using (
    get_my_role() = 'technician'
    and service_car_id = get_my_car_id()
    and scheduled_date = current_date
  );

-- app_settings: anyone reads; admin updates
create policy "settings_read" on app_settings for select using (true);
create policy "settings_admin_write" on app_settings for update
  using (get_my_role() = 'admin');
