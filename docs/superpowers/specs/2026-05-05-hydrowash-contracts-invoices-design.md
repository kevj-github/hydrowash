# HydroWash — Contract Management & Invoice Tracking (Phase 1B)

**Date:** 2026-05-05
**Phase:** 1B — Contracts + Invoices (builds on Phase 1 booking system)
**Prerequisite:** Phase 1 must be deployed and operational.

---

## Context

HydroWash offers 1-year maintenance contracts to regular customers. The contract price is negotiated individually (based on number of units, building type, etc.) and agreed offline. Under the contract, the customer receives servicing every 3 months (4 visits per year). Currently the owner tracks this mentally or on paper — visits get missed, renewals are forgotten, and there is no systematic record of what each customer owes or has paid.

This phase adds:
1. Admin-created contract records linked to customer accounts
2. Automatic 3-monthly service reminders on the admin dashboard
3. Contract renewal alerts (30 days before expiry)
4. Invoice tracking — admin records amounts owed and marks payments received (no payment gateway)

---

## Scope

**In scope:**
- Admin creates and manages contracts per customer
- System generates 4 service due-dates per contract (every 3 months)
- Admin dashboard "Due This Month" widget showing contracted customers needing service
- Renewal reminder: contract expiring in ≤30 days appears in a dashboard alert
- Invoice creation per booking or per contract (manual entry by admin)
- Admin marks invoice as paid (method: Cash / PayNow / Bank Transfer / Other)
- Customer can view their own contracts and invoice history

**Out of scope:**
- Online payment gateway (Phase 2)
- Customer-initiated contract requests
- Automated invoice generation (admin creates manually)
- PDF invoice export (Phase 2)

---

## Data Model

### `contracts`

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| customer_id | UUID | FK → profiles |
| num_units | int | Number of aircon units covered |
| price_sgd | numeric(10,2) | Total negotiated price for 1 year |
| start_date | date | Contract start date |
| end_date | date | Always start_date + 1 year |
| service_interval_months | int | Default 3 |
| notes | text (nullable) | e.g. "Includes chemical wash in June" |
| status | enum | 'ACTIVE' \| 'EXPIRED' \| 'CANCELLED' |
| created_at | timestamptz | |

### `contract_service_dates`
Auto-generated when a contract is created. One row per scheduled service visit.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| contract_id | UUID | FK → contracts |
| due_date | date | start_date + (3 × n) months, n = 1..4 |
| reminder_sent | boolean | Default false — set true when reminder shown in dashboard |
| booking_id | UUID (nullable) | FK → bookings — linked when customer books the service |

For a contract starting 2026-01-01 with 3-month intervals:
- due_date 1: 2026-04-01
- due_date 2: 2026-07-01
- due_date 3: 2026-10-01
- due_date 4: 2027-01-01

### `invoices`

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| customer_id | UUID | FK → profiles |
| booking_id | UUID (nullable) | FK → bookings — for one-off job invoices |
| contract_id | UUID (nullable) | FK → contracts — for contract fee invoices |
| amount_sgd | numeric(10,2) | |
| description | text | e.g. "General Cleaning × 2 units" or "Annual contract 2026" |
| status | enum | 'UNPAID' \| 'PAID' |
| payment_method | text (nullable) | "Cash" \| "PayNow" \| "Bank Transfer" \| "Other" |
| paid_at | timestamptz (nullable) | |
| created_at | timestamptz | |

---

## Admin Flow

### Contracts (`/admin/contracts`)

**List view:**
- All contracts, filterable by status (Active / Expired / Cancelled)
- Each row: customer name, units, price, start/end date, status, next service due date
- Badge: "Expiring Soon" if end_date ≤ 30 days away
- Badge: "Service Due" if any contract_service_date.due_date is within the current month and reminder_sent = false

**Create contract:**
- Admin clicks "New Contract" → form:
  - Select customer (from registered accounts)
  - Number of units
  - Negotiated price (SGD)
  - Start date (end date auto-computed as start + 1 year)
  - Notes
- On save: system auto-generates 4 `contract_service_dates` rows

**Contract detail view:**
- Customer details, contract terms
- Service schedule: 4 rows showing due dates, whether each has a linked booking, whether completed
- "Link Booking" button next to each service date — admin can link an existing booking to that service slot
- Invoices associated with this contract

### Dashboard widget (`/admin` overview page — updated)

Two new alert widgets alongside the existing pending count:

**"Service Due This Month"** — lists contracted customers whose `contract_service_date.due_date` falls in the current calendar month and have no linked booking yet. Admin uses this as a prompt to reach out and arrange the visit.

**"Contracts Expiring Soon"** — lists contracts with `end_date` within 30 days. Admin reaches out to discuss renewal.

### Invoices (`/admin/invoices`)

**List view:**
- All invoices, filterable by status (Unpaid / Paid) and customer
- Each row: customer, description, amount, status, created date, paid date

**Create invoice:**
- Admin clicks "New Invoice" → form:
  - Select customer
  - Optionally link to a booking or contract
  - Amount (SGD)
  - Description
- On save: status = UNPAID

**Mark as paid:**
- Admin clicks "Mark Paid" on any unpaid invoice
- Selects payment method (Cash / PayNow / Bank Transfer / Other)
- System records `paid_at = now()`, status → PAID

---

## Customer View

**`/account/contracts`** — customer sees their own contracts:
- Contract terms (units, start/end date, service interval)
- Service schedule with due dates and which have been completed
- Any invoices linked to their account (amounts + paid status)

Customers cannot create or modify contracts or invoices.

---

## Cron Jobs

### Monthly service reminder check
Runs daily at 8am SGT. Checks for `contract_service_dates` where:
- `due_date` is within the current month
- `booking_id` is null (not yet booked)
- `reminder_sent` = false

For each match: marks `reminder_sent = true`. The admin dashboard widget reads this data — no email is sent to the customer (admin-only workflow).

### Contract expiry check
Runs daily at 8am SGT alongside the above. Checks for contracts where:
- `status = 'ACTIVE'`
- `end_date` ≤ today + 30 days

Results surface in the "Contracts Expiring Soon" dashboard widget. No automated email — admin reaches out manually.

Both cron jobs run as a single Vercel cron endpoint: `GET /api/cron/contracts` on schedule `0 0 * * *` (midnight UTC = 8am SGT).

---

## RLS Policies (additions to Phase 1)

```sql
-- contracts: admin full access; customer reads own
create policy "contracts_admin" on contracts for all using (get_my_role() = 'admin');
create policy "contracts_customer_read" on contracts for select
  using (customer_id = auth.uid());

-- contract_service_dates: admin full; customer reads their contract's dates
create policy "csd_admin" on contract_service_dates for all using (get_my_role() = 'admin');
create policy "csd_customer_read" on contract_service_dates for select
  using (
    contract_id in (select id from contracts where customer_id = auth.uid())
  );

-- invoices: admin full; customer reads own
create policy "invoices_admin" on invoices for all using (get_my_role() = 'admin');
create policy "invoices_customer_read" on invoices for select
  using (customer_id = auth.uid());
```

---

## Pages Summary

| Path | Role | Description |
|---|---|---|
| `/admin/contracts` | Admin | List + create contracts |
| `/admin/contracts/[id]` | Admin | Contract detail, service schedule, linked bookings |
| `/admin/invoices` | Admin | List + create invoices, mark paid |
| `/account/contracts` | Customer | View own contracts and invoices |
| `/api/cron/contracts` | Cron | Daily check: service reminders + expiry alerts |

---

## Verification

1. Admin creates a contract for a customer → 4 service dates auto-generated
2. Admin dashboard shows "Service Due This Month" widget when a service date falls in current month
3. Admin dashboard shows "Contracts Expiring Soon" when contract end_date ≤ 30 days away
4. Admin creates an invoice for a booking → marks it paid → paid_at timestamp recorded
5. Customer logs in → sees their contract details and invoice history at `/account/contracts`
6. Run cron endpoint manually → confirm `reminder_sent` flips to true for due-this-month records
