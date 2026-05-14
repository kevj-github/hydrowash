-- ============================================================
-- Migration 003: Contracts, service dates, invoices
-- ============================================================

create table contracts (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid not null references profiles(id) on delete cascade,
  num_units int not null,
  price_sgd numeric(10,2) not null,
  start_date date not null,
  end_date date not null,
  service_interval_months int not null default 3,
  notes text,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'EXPIRED', 'CANCELLED')),
  created_at timestamptz default now()
);

create table contract_service_dates (
  id uuid default gen_random_uuid() primary key,
  contract_id uuid not null references contracts(id) on delete cascade,
  due_date date not null,
  reminder_sent boolean not null default false,
  booking_id uuid references bookings(id) on delete set null
);

create table invoices (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid not null references profiles(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  contract_id uuid references contracts(id) on delete set null,
  amount_sgd numeric(10,2) not null,
  description text not null,
  status text not null default 'UNPAID'
    check (status in ('UNPAID', 'PAID')),
  payment_method text
    check (payment_method in ('Cash', 'PayNow', 'Bank Transfer', 'Other')),
  paid_at timestamptz,
  created_at timestamptz default now()
);

alter table contracts enable row level security;
alter table contract_service_dates enable row level security;
alter table invoices enable row level security;

create policy "contracts_admin" on contracts
  for all
  using (get_my_role() = 'admin');

create policy "contracts_customer_read" on contracts
  for select
  using (customer_id = auth.uid());

create policy "csd_admin" on contract_service_dates
  for all
  using (get_my_role() = 'admin');

create policy "csd_customer_read" on contract_service_dates
  for select
  using (
    contract_id in (
      select id from contracts where customer_id = auth.uid()
    )
  );

create policy "invoices_admin" on invoices
  for all
  using (get_my_role() = 'admin');

create policy "invoices_customer_read" on invoices
  for select
  using (customer_id = auth.uid());

create index contracts_customer_id_idx on contracts(customer_id);
create index contracts_status_idx on contracts(status);
create index contracts_end_date_idx on contracts(end_date);
create index contract_service_dates_contract_id_idx on contract_service_dates(contract_id);
create index contract_service_dates_due_date_idx on contract_service_dates(due_date);
create index invoices_customer_id_idx on invoices(customer_id);
create index invoices_status_idx on invoices(status);
