# HydroWash — Booking & Admin System Design (Phase 1)

**Date:** 2026-05-05 (updated from 2026-05-04)
**Phase:** 1 — Booking + Admin (e-commerce and payment gateway deferred)

---

## Context

HydroWash is a Singapore-based aircon servicing and sales business. Currently all bookings are handled manually via WhatsApp — customers message the owner to check availability, the owner responds with options, and this goes back and forth inefficiently. The owner also needs to mentally plan daily routes across multiple service cars to minimise travel time, and services one geographic cluster of Singapore per day (demand-driven — he groups nearby bookings together before scheduling a day).

This system replaces the WhatsApp workflow with:
1. An online booking form for customers (three distinct flows: maintenance, fault repair, installation)
2. An admin dashboard for the owner to spot geographic clusters, approve bookings with confirmed dates, and optimise daily routes
3. A read-only job view for technicians

---

## Scope

**In scope (Phase 1):**
- Customer registration, login, and booking submission (3 category flows)
- Date-range booking — customer provides earliest and latest acceptable date
- Admin booking management with map view for geographic clustering
- Bulk-approve maintenance bookings with one confirmed date per cluster
- Daily schedule planner with auto route optimisation
- Technician accounts with read-only job views
- Email notifications at each booking status change

**Out of scope (Phase 1 — covered in Phase 1B):**
- Contract management (1-year maintenance contracts, 3-monthly reminders)
- Invoice tracking
- Renewal reminders

**Out of scope (Phase 2+):**
- E-commerce (selling aircon units online)
- Online payment gateway
- WhatsApp Business API integration
- Mobile app

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 15 (App Router, TypeScript) | Single codebase for customer portal + admin + API |
| Database | Supabase (Postgres) | Managed Postgres + Row Level Security for role-based access |
| Auth | Supabase Auth | Handles customer, admin, and technician login |
| Maps | Google Maps Platform | Geocoding API + Distance Matrix API + Maps JavaScript API (for admin cluster map) |
| Email | Resend + React Email | Transactional email |
| UI | Tailwind CSS + shadcn/ui | Fast, consistent component library |
| Optimiser | Custom VRP (server action) | Nearest-neighbour greedy algorithm — sufficient for Singapore scale |
| Deployment | Vercel | CI/CD, environment variables, cron jobs |

---

## User Roles

| Role | Can do |
|---|---|
| `customer` | Register, log in, submit bookings in any category, view own booking history and status |
| `admin` | Full access: view map of pending bookings, approve/reject with confirmed dates, manage schedule, run route optimiser, manage service types / cars / technicians / settings |
| `technician` | Log in, view their car's scheduled jobs for the day (read-only, no approvals) |

Role stored on `profiles` table and enforced via Supabase Row Level Security on every table.

---

## Service Categories

Three categories, each with a distinct booking flow:

| Category | Description | Scheduling | Key extra fields |
|---|---|---|---|
| `MAINTENANCE` | General cleaning, chemical wash, servicing | Date range → admin clusters geographically → bulk-approves | `num_units`, `service_type_id` |
| `FAULT_REPAIR` | AC not cooling, leaking, noisy — inspection first | Date range → admin approves by urgency → technician inspects, fixes or creates follow-up | `fault_description`, `urgency` |
| `INSTALLATION` | New AC unit install | Date range → admin reviews specs → approves | `num_units`, `ac_brand`, `ac_model`, `room_type` |

---

## Data Model

### `profiles`
Extends Supabase Auth `auth.users`. One row per user.

| Column | Type | Notes |
|---|---|---|
| id | UUID | FK → auth.users (PK) |
| name | text | |
| phone | text | |
| role | enum | 'customer' \| 'admin' \| 'technician' |
| service_car_id | UUID (nullable) | FK → service_cars — only set for technicians |

### `service_types`
Configured by admin in Settings. Drives which options appear in the booking form.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | text | e.g. "General Cleaning", "Chemical Wash", "Split AC Installation" |
| category | enum | 'MAINTENANCE' \| 'FAULT_REPAIR' \| 'INSTALLATION' |
| description | text | |
| duration_minutes | int (nullable) | Null for fault repair (duration unknown until inspection) |
| price_sgd | numeric (nullable) | Null if quoted on-site |
| active | boolean | |

### `service_cars`
Each car = one team + vehicle. Team size derived by counting assigned technicians.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| label | text | e.g. "Car A" |
| active | boolean | |

### `bookings`
Core table. One row per booking request regardless of category.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| customer_id | UUID | FK → profiles |
| category | enum | 'MAINTENANCE' \| 'FAULT_REPAIR' \| 'INSTALLATION' |
| service_type_id | UUID | FK → service_types — fault repair types are also in service_types (e.g. "AC Not Cooling", "Water Leaking", "Unusual Noise", "Not Turning On", "Other Fault") |
| address | text | |
| postal_code | text | Singapore 6-digit |
| lat | float | Geocoded on submission |
| lng | float | Geocoded on submission |
| earliest_date | date (nullable) | Customer's earliest acceptable date (MAINTENANCE + INSTALLATION) |
| latest_date | date (nullable) | Customer's latest acceptable date |
| preferred_slot | enum (nullable) | 'MORNING' \| 'AFTERNOON' \| 'EVENING' |
| num_units | int (nullable) | MAINTENANCE + INSTALLATION |
| fault_description | text (nullable) | FAULT_REPAIR only |
| urgency | enum (nullable) | 'HIGH' \| 'MEDIUM' \| 'LOW' — FAULT_REPAIR only |
| ac_brand | text (nullable) | INSTALLATION only |
| ac_model | text (nullable) | INSTALLATION only |
| room_type | text (nullable) | INSTALLATION only — e.g. "Bedroom", "Living Room" |
| notes | text (nullable) | Any category |
| status | enum | 'PENDING' \| 'APPROVED' \| 'REJECTED' \| 'COMPLETED' |
| confirmed_date | date (nullable) | Set by admin when approving — must fall within earliest/latest |
| rejection_reason | text (nullable) | |
| created_at | timestamptz | |

### `daily_car_availability`
Owner sets which cars are active per day.

| Column | Type | Notes |
|---|---|---|
| service_car_id | UUID | FK → service_cars |
| date | date | |
| is_available | boolean | Default: available if no row exists |

Unique constraint on `(service_car_id, date)`.

### `scheduled_jobs`
Created when owner confirms the day's optimised schedule.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| booking_id | UUID | FK → bookings |
| service_car_id | UUID | FK → service_cars |
| scheduled_date | date | |
| scheduled_start_time | time | |
| sequence_order | int | |
| optimized_at | timestamptz | |

### `app_settings`
Singleton — one row.

| Column | Type | Notes |
|---|---|---|
| depot_address | text | Where all cars start each morning |
| depot_lat | float | |
| depot_lng | float | |
| company_name | text | |
| contact_email | text | |

---

## Customer Booking Flows

### Category selection
Customer starts at `/book` → picks a category (Maintenance / Fault Repair / Installation) → form adapts accordingly.

### Maintenance (4 steps)
1. **Service details** — pick service type (filtered to MAINTENANCE), number of units, notes
2. **Date range** — earliest acceptable date, latest acceptable date, preferred time slot
3. **Address** — street + postal code, geocoded immediately, map pin confirmation
4. **Review + submit** → status `PENDING`, confirmation email sent

### Fault Repair (4 steps)
1. **Fault details** — fault type (Not Cooling / Leaking / Noisy / Other), urgency (High / Medium / Low), describe the problem
2. **Availability** — earliest date, latest date, preferred time to be home
3. **Address** — geocoded, map pin confirmation
4. **Review + submit** → status `PENDING`, admin notified

After inspection: technician fixes minor issues on-site → admin marks `COMPLETED`. Major repair needed → admin creates a new follow-up booking manually linked to same customer.

### Installation (4 steps)
1. **Unit details** — number of units, AC brand + model (optional), room type
2. **Date range** — earliest/latest date, preferred slot
3. **Address** — geocoded, map pin confirmation
4. **Review + submit** → status `PENDING`, confirmation email sent

---

## Admin Flow

### Booking Management (`/admin/bookings`)

Four tabs:

**Maintenance tab (default):**
- Google Map showing pins for all pending MAINTENANCE bookings
- Owner visually spots geographic clusters
- Selects a group of nearby pins → picks one confirmed date
- System validates the date against each selected booking's `earliest_date`/`latest_date` range. Bookings whose range does not include the chosen date are automatically excluded from the batch and highlighted with a warning ("3 of 5 selected bookings fit this date — 2 excluded"). The admin can adjust the date or proceed approving only the compatible subset.
- Clicks "Approve Selected" → compatible bookings status → `APPROVED`, `confirmed_date` set, customers emailed

**Fault Repair tab:**
- List sorted by urgency (High → Medium → Low), then by `created_at`
- Each card: fault description, customer phone, urgency badge, date range
- Owner approves individually with a confirmed date → customer emailed
- No bulk-approve (fault repairs are handled case by case)

**Installation tab:**
- Card list with AC details visible
- Owner reviews specs (may call customer to confirm model before approving)
- Approves individually with a confirmed date

**All tab:**
- Full filterable list of every booking regardless of category or status
- Admin marks bookings as `COMPLETED` after technicians finish on-site

### Daily Schedule & Route Optimisation (`/admin/schedule/[date]`)

1. Set car availability for the day
2. View all `APPROVED` bookings with `confirmed_date` matching the selected date
3. Click "Auto-Optimise Routes" — server action:
   - Fetches depot + all job lat/lng
   - Calls Google Maps Distance Matrix API
   - Runs nearest-neighbour VRP across available cars
   - Calculates estimated start time per job
4. Review suggested schedule per car, optionally reorder
5. Confirm → writes `scheduled_jobs`, sends confirmed time emails to all customers

### Settings (`/admin/settings`)
- Manage service types (add, edit, deactivate) — with category tag
- Manage service cars
- Manage technicians (create accounts, assign to car)
- Set depot address

---

## Technician Flow

Login at `/technician/jobs`. Read-only:
- Today's job list for their car in sequence order
- Per job: time, duration, address, service type/category, customer name, notes
- No write access to any table (enforced by Supabase RLS)

---

## Route Optimisation Algorithm

Unchanged from original design. Nearest-neighbour greedy VRP:
1. Build distance/time matrix via Google Maps Distance Matrix API (depot + all job locations)
2. Initialise each available car at depot at 8:00am
3. Greedily assign nearest unassigned job to the car that finishes earliest
4. Calculate estimated start times
5. Return ordered job list per car

All three booking categories (maintenance, fault repair, installation) flow through the same optimiser once approved.

---

## Email Notifications

| Trigger | Recipient | Content |
|---|---|---|
| Booking submitted (any category) | Customer | "Request received. We'll confirm your appointment soon." |
| Booking approved | Customer | "Confirmed for [confirmed_date] ([slot]). Exact time TBC when we plan the day." |
| Booking rejected | Customer | "Unable to accommodate. Reason: [rejection_reason]." |
| Schedule confirmed | Customer | "Your appointment is [date] at [time]. Address: [address]." |
| Day-before reminder | Customer | "Reminder: service tomorrow at [time]." |

---

## Pages Summary

| Path | Role | Description |
|---|---|---|
| `/` | Public | Landing / home |
| `/services` | Public | Service listing by category |
| `/auth/login` | Public | Login |
| `/auth/register` | Public | Register |
| `/book` | Customer | Category selection + 4-step booking wizard |
| `/account/bookings` | Customer | Booking history with status and confirmed date |
| `/admin` | Admin | Overview (pending counts by category, today's jobs) |
| `/admin/bookings` | Admin | 4-tab booking management with map |
| `/admin/schedule/[date]` | Admin | Daily planner + route optimiser |
| `/admin/settings` | Admin | Service types, cars, technicians, depot |
| `/technician/jobs` | Technician | Read-only daily job list |

---

## Verification

1. Register customer → submit MAINTENANCE booking with date range
2. Admin opens Maintenance tab → sees map pin → selects it + sets confirmed date → approves
3. Customer receives approval email with confirmed date
4. Admin goes to `/admin/schedule/[confirmed_date]` → auto-optimise → confirm schedule
5. Customer receives exact time email
6. Technician logs in → sees job in list
7. Admin marks booking COMPLETED

8. Register customer → submit FAULT REPAIR booking
9. Admin opens Fault Repair tab → approves inspection visit for a date within customer's range
10. Admin creates follow-up booking manually (major repair scenario)

11. Admin → Settings → add a service type with category INSTALLATION → verify it appears in installation booking flow only
