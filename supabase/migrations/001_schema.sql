create table profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  phone text not null,
  role text not null check (role in ('customer', 'admin', 'technician')),
  service_car_id uuid,
  created_at timestamptz default now()
);

create table service_types (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  category text not null check (category in ('MAINTENANCE','FAULT_REPAIR','INSTALLATION')),
  description text not null default '',
  duration_minutes int,
  price_sgd numeric(10,2),
  active boolean not null default true,
  created_at timestamptz default now()
);

create table service_cars (
  id uuid default gen_random_uuid() primary key,
  label text not null,
  active boolean not null default true,
  created_at timestamptz default now()
);

alter table profiles
  add constraint profiles_service_car_id_fkey
  foreign key (service_car_id) references service_cars(id);

create table bookings (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid not null references profiles(id),
  category text not null check (category in ('MAINTENANCE','FAULT_REPAIR','INSTALLATION')),
  service_type_id uuid not null references service_types(id),
  address text not null,
  postal_code text not null,
  lat double precision not null,
  lng double precision not null,
  earliest_date date,
  latest_date date,
  preferred_slot text check (preferred_slot in ('MORNING','AFTERNOON','EVENING')),
  num_units int,
  fault_description text,
  urgency text check (urgency in ('HIGH','MEDIUM','LOW')),
  ac_brand text,
  ac_model text,
  room_type text,
  notes text,
  status text not null default 'PENDING'
    check (status in ('PENDING','APPROVED','REJECTED','COMPLETED')),
  confirmed_date date,
  rejection_reason text,
  created_at timestamptz default now()
);

create table daily_car_availability (
  service_car_id uuid not null references service_cars(id),
  date date not null,
  is_available boolean not null default true,
  primary key (service_car_id, date)
);

create table scheduled_jobs (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid not null references bookings(id),
  service_car_id uuid not null references service_cars(id),
  scheduled_date date not null,
  scheduled_start_time time not null,
  sequence_order int not null,
  optimized_at timestamptz not null default now()
);

create table app_settings (
  id int primary key default 1 check (id = 1),
  depot_address text not null default '',
  depot_lat double precision not null default 0,
  depot_lng double precision not null default 0,
  company_name text not null default 'HydroWash',
  contact_email text not null default ''
);

insert into app_settings (id) values (1);

insert into service_types (name, category, description, active) values
  ('AC Not Cooling', 'FAULT_REPAIR', 'Air conditioner not cooling adequately', true),
  ('Water Leaking', 'FAULT_REPAIR', 'Water dripping or leaking from unit', true),
  ('Unusual Noise', 'FAULT_REPAIR', 'Loud or unusual noise from unit', true),
  ('Not Turning On', 'FAULT_REPAIR', 'Unit does not power on', true),
  ('Other Fault', 'FAULT_REPAIR', 'Other fault — please describe', true);
