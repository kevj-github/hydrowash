# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is
A Next.js 15 web app for online booking at a Singapore aircon servicing company. Customers book online; the owner manages jobs via an admin dashboard with geographic clustering and route optimisation. Includes 1-year maintenance contracts, quarterly service reminders, and manual invoice tracking.

## Commands

```bash
npm run dev        # Start dev server (localhost:3000)
npm run build      # Production build
npm run lint       # ESLint
npm test           # Run all Jest tests (if script exists)
npx jest vrp       # Run VRP test file
```

## Tech stack
- **Framework:** Next.js 16 App Router, TypeScript
- **Database/Auth:** Supabase (Postgres + Auth + Row Level Security)
- **Maps:** Google Maps Platform (Geocoding API, Distance Matrix API, Maps JavaScript API)
- **Email:** Resend + React Email
- **UI:** Tailwind CSS + shadcn/ui
- **Deployment:** Vercel (with cron jobs)

## Env vars
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY   # client-side Maps JS API + Places Autocomplete
GOOGLE_MAPS_API_KEY               # server-side geocoding + distance matrix + reverse geocoding
RESEND_API_KEY
CRON_SECRET
```

## Two user roles
- `customer` — register, submit bookings, view own booking history and contracts/invoices
- `admin` — manage bookings, approve/reject, run route optimiser, manage contracts and invoices, manage settings

Roles are stored in `profiles.role` and enforced via Supabase RLS on every table.

## Three booking categories
- `MAINTENANCE` — cleaning, chemical wash; admin views on map, approves each card individually (same as Fault/Installation)
- `FAULT_REPAIR` — inspection visit first; admin approves individually by urgency
- `INSTALLATION` — new AC unit; admin reviews specs and approves

All categories use the **multi-date slot model**: customers choose up to 5 preferred dates, each with up to 3 time slots (`preferred_date_slots jsonb`). For backward compatibility, `booking_date` + `preferred_slots` + `time_slot` are still written from the first preference entry. Admin resolves conflicts and assigns a `confirmed_date` + `confirmed_slot` on approval. Uniqueness is enforced only on confirmed APPROVED bookings `(confirmed_date, confirmed_slot)`.

### Time slots (canonical enum values)
```
S10_12  →  10:00–12:00
S13_15  →  13:00–15:00
S15_17  →  15:00–17:00
S17_19  →  17:00–19:00
S19_21  →  19:00–21:00
```
`SLOT_LABELS` and `SLOT_KEYS` are exported from `lib/types.ts`. Always import and use these — never hardcode slot strings.

## File map

```
app/
  (public)/layout.tsx          # Public shell (server: auth check → passes props to PublicHeader)
  (public)/PublicHeader.tsx    # Client: scroll-aware navbar; logged-in non-admin customers see My Bookings + Contracts & Invoices
  (public)/MobileNav.tsx       # Client: hamburger menu; same links as PublicHeader for mobile
  (public)/page.tsx            # Landing page — "Hydrowash home aircon solution" hero, stat strip, ServiceCard grid, StepItem timeline
  (public)/book/page.tsx       # 3-step booking wizard (uses public layout + navbar)
  auth/login/page.tsx
  auth/register/page.tsx
  auth/callback/route.ts       # Supabase auth callback
  account/layout.tsx           # Customer auth guard + nav (also has Contracts & Invoices link)
  account/bookings/page.tsx    # Customer booking history
  account/contracts/page.tsx   # Server wrapper: fetches contracts + invoices, delegates to AccountContractsClient
  account/AccountContractsClient.tsx  # Client: contract status filter + invoice status/date-range filters
  admin/layout.tsx             # Admin auth guard + nav
  admin/page.tsx               # Overview dashboard (stats + Phase 1B widgets)
  admin/bookings/page.tsx      # 4-tab: Maintenance (map) / Fault / Installation / All
  admin/bookings/AdminBookingsClient.tsx  # Client: draggable resizer, per-tab filters, bidirectional map↔card sync, InfoWindow popup, All-tab customer search
  admin/contracts/page.tsx     # Contracts list + create; client-side filters: name/phone search, start/expiry/next-service-due date ranges, status
  admin/contracts/[id]/page.tsx   # Contract detail: service schedule + invoices
  admin/invoices/page.tsx      # Invoices list + create; client-side filters: name/phone search, created/paid date ranges, status; Create dialog uses searchable customer combobox
  admin/schedule/[date]/page.tsx  # Route optimiser — date picker, job selection, map
  admin/customers/page.tsx     # Customer list with search, booking counts, invoice totals, active contract badge
  admin/customers/[id]/page.tsx  # Customer detail: profile card + bookings + contracts + invoices + total paid
  admin/agenda/page.tsx        # Week-grid view (?week=YYYY-MM-DD): 5 slot rows × 7 day cols; APPROVED/all toggle + week nav
  admin/settings/page.tsx      # Service types + depot settings + company info fields
  api/bookings/route.ts        # POST: create booking (validates slot not blocked/taken, inserts booking + booking_unit_locations)
  api/bookings/[id]/route.ts   # PATCH: approve / reject
  api/bookings/[id]/reschedule/route.ts  # PATCH: customer reschedule (24h SGT cutoff); resets confirmed_date/slot; emails admin
  api/bookings/[id]/cancel/route.ts      # PATCH: customer cancel (24h cutoff); sets CANCELLED + cancelled_at/by/reason; emails admin
  api/bookings/[id]/complete/route.ts    # POST: admin marks APPROVED → COMPLETED; upserts job_completions; work_order_no auto-assigned by DB trigger
  api/bookings/[id]/work-order-pdf/route.ts  # GET: admin generates Work Order PDF on-the-fly
  api/bookings/[id]/send-work-order/route.ts # POST: admin sends Work Order PDF + PayNow QR to customer; creates UNPAID invoice
  api/bookings/bulk-approve/route.ts  # POST: bulk approve PENDING maintenance bookings with a confirmed_date
  api/availability/route.ts    # GET ?month=YYYY-MM → { byDate: { [date]: { booked: TimeSlot[], blockedSlots: (TimeSlot|null)[] } } }
  api/admin/ac-catalog/route.ts   # GET/POST/PATCH ?kind=unit_types|brands — admin CRUD for ac_unit_types and ac_brands
  api/contracts/route.ts       # POST: create contract + auto-generate service dates; GET: list
  api/contracts/request/route.ts  # POST: customer self-signup (status=PENDING_REVIEW, no price; sends confirmation email)
  api/contracts/[id]/route.ts  # PATCH: edit; DELETE: cancel or hard delete
  api/contracts/[id]/set-price/route.ts  # PATCH: set price → AWAITING_PAYMENT (email now sent separately via send-contract-pdf)
  api/contracts/[id]/send-contract-pdf/route.ts  # POST: generate contract PDF + PayNow QR; upload to storage; email to customer
  api/contracts/[id]/pdf/route.ts        # GET: admin preview — returns contract PDF blob on-the-fly
  api/contracts/[id]/mark-paid/route.ts  # PATCH: AWAITING_PAYMENT → ACTIVE + generate service dates + send activation email
  api/contracts/[id]/activate/route.ts  # PATCH: admin activates PENDING_REVIEW → ACTIVE + generates service dates + emails customer (admin-created contracts)
  api/contracts/[id]/link-booking/route.ts  # PATCH: link booking to service date
  api/invoices/route.ts        # POST: create invoice; GET: list with filters
  api/invoices/[id]/pay/route.ts  # PATCH: mark invoice paid
  api/geocode/route.ts         # POST: geocode address → lat/lng
  api/geocode/reverse/route.ts # POST: { lat, lng } → { address, postalCode } (reverse geocode via Google)
  api/optimize/route.ts        # POST: run single-route VRP for selected booking IDs
  api/availability/suggest/route.ts  # GET ?from=YYYY-MM-DD&slot=S10_12&days=14 → top 5 (date,slot) suggestions
  api/cron/reminders/route.ts  # GET: day-before reminder cron (uses booking_date, not confirmed_date)
  api/cron/contracts/route.ts  # GET: quarterly service due emails + contract expiry emails (uses expiry_reminder_sent)

components/
  ui/section.tsx               # <Section> full-width wrapper + <SectionInner> max-w-6xl centered
  ui/section-heading.tsx       # <SectionHeading label title subtitle align light> — shared section titles
  ui/service-card.tsx          # <ServiceCard icon title description> — Lucide icon card with hover
  ui/step-item.tsx             # <StepItem number label description done> — numbered step circle
  booking/BookingWizard.tsx    # 3-step wizard: Service → Schedule & Location → Review
  booking/StepServiceDetails.tsx  # Step 0: service type, category fields, UnitLocationPicker for MAINTENANCE
  booking/StepScheduleLocation.tsx  # Step 1: SlotCalendar (date+slot) + address presets (Home/My Location/Other) + Places autocomplete
  booking/StepReview.tsx       # Step 2: summary of all booking data before submit
  booking/SlotCalendar.tsx     # Month-grid calendar; up to 5 dates, 3 slots each; SGT-aware past-slot blocking
  booking/UnitLocationPicker.tsx  # N per-unit <Select> dropdowns (one per unit), driven by numUnits prop; reads ac_unit_locations from Supabase browser client
  admin/BookingCard.tsx        # Status badge, preferred_slots chips, confirmed_date + confirmed_slot picker; highlighted prop for map-pin selection; onCardClick prop for card→map sync; JobCompletionDialog replaces "Mark Complete"
  admin/BookingsMap.tsx        # Google Map markers; InfoWindow popup on pin click (customer name, service, address, status, dates); next/dynamic ssr:false
  admin/ContractCard.tsx       # Contract list card with status/due/expiry badges; shows address if present
  admin/ServiceDateRow.tsx     # One quarterly service visit row; displays formatDueMonth(due_month)
  admin/InvoiceRow.tsx         # One invoice row with mark-paid dialog
  admin/RouteMap.tsx           # Google Map with numbered pins + polyline (next/dynamic, ssr:false)
  admin/JobCompletionDialog.tsx  # 3-step dialog: Step 1 (attended_by, AC details, checklist); Step 2 (pricing + additional charges); Step 3 (preview PDF + confirm & send)
  account/RescheduleDialog.tsx   # Customer reschedule dialog wrapping SlotCalendar; uses buttonVariants() on DialogTrigger
  account/CancelDialog.tsx       # Customer cancel confirm dialog with optional reason textarea

lib/
  supabase/client.ts           # Browser Supabase client — exports createClient()
  supabase/server.ts           # Server Supabase client — exports async createClient()
  supabase/admin.ts            # Service role client — exports createAdminClient(); used for auth.admin.getUserById()
  booking/slots.ts             # Pure functions: isDayFullyBlocked, isSlotBlocked, getSlotsForDate, resolveContractTierPrice
  utils/paynow.ts              # buildPayNowPayload() + crc16ccitt() — EMVCo SGQR format for Singapore PayNow
  booking/__tests__/slots.test.ts
  vrp/optimizer.ts             # Single-route nearest-neighbour VRP; uses timeSlot (not preferredSlot); DAY_START=10*60; SLOT_WINDOWS keyed by TimeSlot
  vrp/__tests__/optimizer.test.ts
  maps/geocode.ts              # Google Geocoding API wrapper (forward geocode)
  maps/distance-matrix.ts      # Google Distance Matrix API wrapper
  email/send.ts                # Send functions via Resend (includes sendBookingRescheduled, sendBookingCancelled, sendContractPricing, sendWorkOrderReport)
  email/templates/             # React Email templates (ContractRequestReceived, ContractPricingEmail, BookingRescheduled, BookingCancelled, WorkOrderEmail)
  pdf/ContractPdfTemplate.tsx  # React-PDF 2-page contract document (navy/blue brand); props: customerName, contactNo, address, numUnits, totalAmountSgd, serviceDueMonths[], company{}
  pdf/WorkOrderTemplate.tsx    # React-PDF single-page work order report; props: WorkOrderProps (customer, AC details, checklist, charges, PayNow)
  pdf/generate.ts              # generateContractPdf(props) + generateWorkOrderPdf(props) → Promise<Buffer>
  contracts/service-dates.ts   # generateServiceDates() returns due_month (YYYY-MM) + second_reminder_sent; formatDueMonth(due_month) → display string
  types.ts                     # Shared TypeScript types — TimeSlot, PreferredDateSlot, SLOT_LABELS, SLOT_KEYS, AcUnitLocation, AcUnitType, AcBrand, BlockedSlot, ContractPricingTier, RouteStop, BookingWithRelations, AppSettings, AcUnitDetail, ChecklistItem, AdditionalCharge, JobCompletion

middleware.ts                  # Auth routing (role-based redirects — admin and customer only) ⚠ Next.js 16 deprecated this filename in favour of proxy.ts — still works but will need renaming
supabase/migrations/001_schema.sql
supabase/migrations/002_rls.sql
supabase/migrations/003_seed_services.sql
supabase/migrations/003_contracts.sql        # contracts, contract_service_dates, invoices + RLS
supabase/migrations/004_media_urls.sql       # media_urls text[] column on bookings
supabase/migrations/005_auto_create_profile.sql  # SECURITY DEFINER trigger: auto-creates profile on auth.users insert
supabase/migrations/006_tech_bookings_rls.sql    # (superseded by 008 — policies dropped)
supabase/migrations/007_tech_profiles_rls.sql    # (superseded by 008 — policies dropped)
supabase/migrations/008_remove_cars_and_jobs.sql # Drops service_cars, scheduled_jobs, daily_car_availability; removes technician role ✅ applied
supabase/migrations/009_contract_address.sql     # Adds address text column to contracts table
supabase/migrations/010_phase2_slot_model.sql    # Drops earliest_date/latest_date/preferred_slot/room_type; adds booking_date + time_slot + partial unique index ✅ applied
supabase/migrations/011_phase2_ac_locations.sql  # ac_unit_locations, booking_unit_locations, ac_unit_types, ac_brands + seeds ✅ applied
supabase/migrations/012_phase2_app_settings.sql  # paynow_mobile, contract_pricing_tiers on app_settings ✅ applied
supabase/migrations/013_phase2_blocked_slots.sql # blocked_slots table with full-day + slot-level unique indexes ✅ applied
supabase/migrations/016_phase2_rls.sql           # RLS for all Phase 2 new tables ✅ applied
supabase/migrations/017_profile_address.sql      # address, address_lat, address_lng, postal_code on profiles ✅ applied
supabase/migrations/018_contract_pending.sql     # price_sgd nullable; PENDING_REVIEW status; expiry_reminder_sent ✅ applied
supabase/migrations/019_contracts_customer_insert.sql  # RLS INSERT for customer self-signup ✅ applied
supabase/migrations/020_multi_slot.sql               # preferred_slots text[], confirmed_slot text; drop PENDING slot uniqueness; new APPROVED confirmed_slot unique index; drop booking_unit_locations unique constraint ✅ applied
supabase/migrations/021_multi_date_slots.sql         # preferred_date_slots jsonb ✅ applied
supabase/migrations/022_contract_awaiting_payment.sql # contracts status adds AWAITING_PAYMENT ✅ applied
supabase/migrations/023_booking_cancellation.sql     # adds CANCELLED to bookings status; cancelled_at, cancelled_by, cancelled_reason columns ✅ applied
supabase/migrations/024_month_only_service_dates.sql # adds due_month text + second_reminder_sent bool to contract_service_dates ✅ applied
supabase/migrations/025_app_settings_company.sql     # adds company_address, company_phone, company_email, company_instagram, authorised_officer_name to app_settings ✅ applied
supabase/migrations/026_completion_invoice.sql       # profiles.customer_no (bigint, auto-seq trigger); bookings.work_order_no + attended_by; job_completions table; RLS ✅ applied
supabase/migrations/027_service_type_price.sql       # service_types.default_price_sgd numeric ✅ applied
supabase/migrations/028_customer_booking_update.sql  # RLS UPDATE policy for customers on own bookings ✅ applied
supabase/migrations/029_booking_contract_others.sql  # bookings.unit_location_others text[] + bookings.contract_id uuid ✅ applied
jest.config.ts
jest.setup.ts
vercel.json                    # Cron config (reminders daily + contracts daily)
```

## Data model (key tables)

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users`; holds `name`, `phone`, `role` |
| `service_types` | Admin-configured list of services; `category` enum drives booking form options |
| `bookings` | Core table — `booking_date date NOT NULL`, `time_slot text NOT NULL` (first preferred slot, backward compat), `preferred_slots text[] NOT NULL DEFAULT '{}'` (up to 3 choices), `preferred_date_slots jsonb` (up to 5 date+slot entries), `confirmed_slot text`; `unit_location_others text[]` (free-text labels for units that chose "Others"); `contract_id uuid` (optional link to customer's contract); unique index on `(confirmed_date, confirmed_slot) WHERE status = 'APPROVED'` |
| `app_settings` | Singleton — depot location, company info, `paynow_mobile`, `contract_pricing_tiers jsonb` |
| `contracts` | 1-year maintenance contracts; `status` = PENDING_REVIEW/AWAITING_PAYMENT/ACTIVE/EXPIRED/CANCELLED; optional `address` text column |
| `contract_service_dates` | 4 auto-generated quarterly visit dates per contract; `due_month text` (YYYY-MM, month-only); `second_reminder_sent bool`; `booking_id` links to the booking when scheduled |
| `invoices` | Manual invoices; optionally linked to a booking and/or contract |
| `ac_unit_locations` | Admin-managed room labels (Master Bedroom, Room 1–3, Living Room, Kitchen, Study Room) |
| `booking_unit_locations` | Join table: which room locations are included in a booking |
| `ac_unit_types` | Admin-managed unit types for invoice finalization (Wall Mounted, Ducted Unit, Cassette Unit) |
| `ac_brands` | Admin-managed AC brands for invoice finalization (Mitsubishi, Daikin, Panasonic, Toshiba, Samsung, Midea) |
| `blocked_slots` | Admin-blocked full days (slot IS NULL) or individual slots; enforced at booking creation |
| `job_completions` | One row per completed booking — AC unit details (brand/model), checklist items, additional charges, base price; UNIQUE on booking_id |

- `service_type_id` is NOT NULL on all bookings — fault repair types (e.g. "AC Not Cooling") are also rows in `service_types`
- Booking statuses: `PENDING | APPROVED | REJECTED | COMPLETED | CANCELLED`
- Contract statuses: `PENDING_REVIEW | AWAITING_PAYMENT | ACTIVE | EXPIRED | CANCELLED` — customer self-requests move to AWAITING_PAYMENT after pricing
- Invoice statuses: `UNPAID | PAID`
- `contract_pricing_tiers` format: `[{min_units, max_units: number|null, price_sgd}]` — `max_units: null` = per-unit rate
- `contracts.price_sgd` is **nullable** (NULL for PENDING_REVIEW contracts, set on activation). Guard with `price_sgd != null ? ... : 'TBD'` before rendering.
- **Booking POST** (`/api/bookings`) accepts `preferred_date_slots` (1–5 entries, each with 1–3 slots). Derives `booking_date`, `preferred_slots`, and `time_slot` from the first entry. Only checks for full-day blocks — no per-slot conflict check (conflicts resolved by admin at approval time).
- **Booking PATCH** (`/api/bookings/[id]`) approve action accepts `confirmed_date` + `confirmed_slot`; both are saved on the booking.
- **Bulk approve** (`/api/bookings/bulk-approve`) accepts `confirmed_date` + optional `confirmed_slot`; applies both to all selected bookings.
- **Availability API** (`/api/availability`) returns `confirmed_slot` from APPROVED bookings only (not PENDING). Pending bookings no longer block calendar slots.
- **Profile role checks** in API routes use `if (profileError || !profile || profile.role !== 'admin')` — not `profile?.role !== 'admin'`.
- **Cron auth**: both cron routes use `x-cron-secret` header (NOT `Authorization: Bearer`).
- **Geocode** (`lib/maps/geocode.ts`) includes `&region=sg` for Singapore-biased results.
- **Distance Matrix** (`lib/maps/distance-matrix.ts`) batches in chunks of 25 to handle large route days.
- **Contract date arithmetic** uses `T00:00:00Z` + `setUTCFullYear`/`setUTCMonth` to avoid timezone drift.
- **Service date tracking is month-only** (`due_month: 'YYYY-MM'`). Use `formatDueMonth(due_month)` from `lib/contracts/service-dates.ts` for display. Cron fires reminders on day 1 (first) and day 15 (second) of the due month if booking not yet linked.
- **work_order_no** auto-assigned by DB BEFORE UPDATE trigger on bookings when status → COMPLETED. Do not set it from application code.
- **customer_no** auto-assigned by DB BEFORE INSERT trigger on profiles for role='customer'. Sequential from 1.
- **PDF generation:** `@react-pdf/renderer` used server-side. Supabase Storage bucket `documents` (private) stores generated PDFs at `contracts/{id}/contract.pdf` and `work-orders/{id}/work-order.pdf`.
- **Booking cancellation/reschedule**: 24h SGT cutoff check — compute effective date from `confirmed_date ?? preferred_date_slots[0].date ?? booking_date`; disallow if within 24h. Use `Awaited<ReturnType<typeof createClient>>` for the supabase type in route handlers.

## Key flows

**Booking wizard (`/book`) — 3 steps:**
- **Step 0 (Service):** Service type selector (grouped by category). MAINTENANCE shows num_units + UnitLocationPicker (room dropdowns from `ac_unit_locations` + "Others" free-text option) + optional contract link dropdown (ACTIVE contracts only). FAULT_REPAIR shows fault description + urgency. INSTALLATION shows AC brand/model + num_units.
- **Step 1 (Schedule & Location):** `SlotCalendar` — month grid fetching `/api/availability`; select up to 5 dates, each with up to 3 slots (SGT-aware — past slots on today greyed/disabled). Address presets: Home (profile address — if available), My Location (geolocation → `/api/geocode/reverse`), Other (Google Places Autocomplete). After location confirmed, unit/floor + building + access notes fields appear.
- **Step 2 (Review):** Summary. Submit POSTs to `/api/bookings` with `{ preferred_date_slots, booking_date, preferred_slots, time_slot, unit_location_ids[], address, ... }`.

**Admin booking management (`/admin/bookings`) — 4 tabs:**
- **Maintenance tab (default):** Google Map with pins; each card has its own confirmed date + slot picker + individual Approve/Reject buttons (same as Fault/Installation tabs). Search, date filter, ALL/PENDING/APPROVED filter. No bulk-approve.
- **Fault Repair tab:** Cards sorted by urgency — approve individually. Filter bar: customer name search, booking_date-from filter, ALL/PENDING/APPROVED toggle. **Bidirectional map↔card sync**.
- **Installation tab:** Same as Fault Repair.
- **All tab:** Full table view with customer name search + PENDING / ACTIVE / PAST status filter. Same bidirectional sync.
- **Map InfoWindow popup:** Clicking any pin opens popup with customer name, phone, service type, address, date + slot, confirmed date, and status badge.
- **Sidebar width:** Draggable resize handle (240–600 px, default 320 px).

**Route optimiser (`/admin/schedule/[date]`):**
- Admin picks a date → navigates to `/admin/schedule/[date]`
- Lists all APPROVED bookings for that date; each card shows customer name, time slot badge, service type, duration, address
- Calls `POST /api/optimize` → Google Distance Matrix → single-route nearest-neighbour VRP with slot-window penalty
- VRP uses `timeSlot` (not `preferredSlot`); `DAY_START = 10 * 60`; `SLOT_WINDOWS` keyed by `TimeSlot` enum values
- Visual only — no DB writes

**Contract management (`/admin/contracts`):**
- Admin creates a contract → API auto-generates 4 `contract_service_dates` at 3-month intervals
- Create dialog: searchable customer combobox; optional `address` field
- List filters (client-side): name/phone search; start/expiry/next-service-due date ranges; status pills
- Detail page: service schedule; admin links bookings to service dates; actions: set price → awaiting payment, mark paid, edit, deactivate/delete

**Invoice management (`/admin/invoices`):**
- Admin creates invoices manually; links to contract/booking optionally
- "Mark Paid" records `payment_method` + stamps `paid_at`
- List filters (client-side): name/phone search; created/paid date ranges; status pills

**Customer contracts & invoices (`/account/contracts`):**
- Server component fetches; delegates to `AccountContractsClient` for filters
- Contract status pills include Awaiting Payment; invoice status pills + date-range filter

**Customer booking self-service (`/account/bookings`):**
- `canModify()` helper: PENDING/APPROVED only, and effective date > 24h away in SGT
- `RescheduleDialog`: opens SlotCalendar in a Dialog; PATCH `/api/bookings/[id]/reschedule`; resets confirmed_date/slot; emails admin
- `CancelDialog`: confirm + optional reason textarea; PATCH `/api/bookings/[id]/cancel`; sets CANCELLED status; emails admin
- "Book Again" link to `/book?repeat=[id]` — `BookingWizard` prefills service type, units, address from past booking

**Repeat booking (`/book?repeat=[id]`):**
- `BookingWizard` detects `?repeat=` param, fetches `/api/bookings/[id]`, prefills step 0 service/units/locations + step 1 address. Preferred date slots are always cleared (fresh calendar).

**Admin contract PDF flow:**
- Admin opens contract detail → "Set Price" dialog (2-step): step 1 saves price → AWAITING_PAYMENT via `PATCH /api/contracts/[id]/set-price`; step 2 shows Preview PDF link + "Confirm & Send" button
- Preview: `GET /api/contracts/[id]/pdf` → PDF blob rendered in new tab
- Send: `POST /api/contracts/[id]/send-contract-pdf` → generates PDF, uploads to Storage, generates PayNow QR, emails customer with PDF attachment
- AWAITING_PAYMENT banner on detail page also shows Preview + Resend buttons

**Admin job completion + work order:**
- `JobCompletionDialog` on `BookingCard`: 3-step — Step 1 (attended_by, job times, AC unit details table with brand/model, checklist items, job description); Step 2 (base price, additional charges, live total); Step 3 (preview PDF + confirm & send)
- Step 3 "Preview" → `GET /api/bookings/[id]/work-order-pdf` → PDF in new tab
- Step 3 "Confirm & Send" → `POST /api/bookings/[id]/complete` (upserts job_completions, marks COMPLETED) then `POST /api/bookings/[id]/send-work-order` (generates PDF, uploads to Storage, sends email with PDF + PayNow QR, creates UNPAID invoice row)

**Admin customer 360 (`/admin/customers`):**
- List: search by name/phone; columns: customer_no, name, phone, booking count, total paid (PAID invoices), active contract badge, View link
- Detail `/admin/customers/[id]`: profile card (email from auth, phone, address, member since, total paid), bookings table, contracts list with next due, invoices table

**Admin agenda (`/admin/agenda`):**
- Week-grid: SLOT_KEYS rows × 7 day columns; ?week=YYYY-MM-DD param (defaults to current Monday)
- Each cell shows booking customer name chips (links to /admin/bookings)
- APPROVED/all active toggle; prev/next week nav; Today shortcut

## Design system
Brand rules: `design-system/hydrowash/MASTER.md`. Per-page overrides: `design-system/pages/[page-name].md`.

**Token layer:** wired in `app/globals.css` `:root`. Always use Tailwind semantic tokens — never hardcode hex.

| Token | Hex | Usage |
|---|---|---|
| `bg-primary` / `text-primary` | `#0F172A` | Navy — headings, dark backgrounds |
| `bg-accent` / `text-accent` | `#0369A1` | Blue — CTAs, links, active states |
| `bg-background` | `#F8FAFC` | Page background |
| `bg-muted` | `#E8ECF1` | Section backgrounds |
| `text-muted-foreground` | `#64748B` | Secondary / helper text |
| `border-border` | `#E2E8F0` | Card and input borders |

**Fonts:** Poppins (`font-heading`) + Open Sans (body), loaded via `next/font/google`. Do NOT add a Google Fonts CDN link.

**Shared primitives:** `<Section>`, `<SectionInner>`, `<SectionHeading>`, `<ServiceCard>`, `<StepItem>` in `components/ui/`.

**Animation utilities:** `.animate-fade-up`, `.animate-fade-up-delay-1/2/3` in `globals.css`. Hero elements only.

## Phases
- **Phase 1** — booking portal + admin dashboard ✅ complete
- **Phase 1B** — contract management + invoice tracking ✅ complete
- **Phase 1C** — route optimiser redesign ✅ complete (2026-05-08)
- **Phase 1D** — admin bookings UX + contract improvements ✅ complete (2026-05-08)
- **Phase 1E** — UI modernization across all pages ✅ complete (2026-05-08)
- **Phase 1F** — search, filters, and bidirectional map sync ✅ complete (2026-05-08)
- **Phase 2 — Subsystem H** — landing page copy refresh ✅ complete (2026-05-14)
- **Phase 2 — Subsystem A** — slot model + booking calendar + AC locations + availability API ✅ complete (2026-05-14)
- **Phase 2 — Subsystem B** — profile address at registration + account settings ✅ complete (2026-05-14)
- **Phase 2 — Subsystem C** — admin date/slot blocking UI ✅ complete (2026-05-14)
- **Phase 2 — Subsystem D** — customer contract self-signup ✅ complete (2026-05-14)
- **Phase 2 — Subsystem E** — invoice PayNow QR display ✅ complete (2026-05-14)
- **Phase 2 — Subsystem F** — wire up automated reminder emails ✅ complete (2026-05-14)
- **Phase 2 — Subsystem G** — alternative slot suggestions on 409 ✅ complete (2026-05-14)
- **Phase 2 — Multi-slot + UX** — multi-slot preferences (up to 3), per-unit location dropdowns, SGT past-slot blocking, admin confirmed_slot picker, contract 403 fix ✅ complete (2026-05-19)
- **Phase 2 — Subsystem I** — customer reschedule/cancel (24h cutoff, email notifications) + repeat booking prefill ✅ complete (2026-05-20)
- **Phase 2 — Subsystem M** — contract PDF generation (React-PDF), PayNow QR email, two-step set-price flow, company settings ✅ complete (2026-05-20)
- **Phase 2 — Subsystem K** — job completion workflow: JobCompletionDialog (3-step), work order PDF, PayNow QR email, auto work_order_no/customer_no, job_completions table ✅ complete (2026-05-20)
- **Phase 2 — Subsystem J** — admin customer 360 (/admin/customers list + detail) + agenda week-grid (/admin/agenda) ✅ complete (2026-05-20)
- **Phase 2 — Subsystem L** — mobile QA polish: tap targets ≥44px, hero text overflow fix, all customer-facing pages audited at 375px ✅ complete (2026-05-20)
- **Phase 3 initial changes (2026-05-20):**
  - Admin Maintenance tab: replaced bulk-approve with per-card approval (same UX as Fault/Installation)
  - Post-login/signup redirect: all users (customer + admin) go to landing page `/` after auth
  - "Book Now" for guests: goes to `/auth/login?redirect=/book` so they return to booking after login
  - `UnitLocationPicker`: added "Others" option with inline free-text input; stored in `bookings.unit_location_others`
  - `SlotCalendar`: removed "(N/5)" count from preferred dates label
  - MAINTENANCE booking wizard: optional "Link to Contract" dropdown shows customer's ACTIVE contracts; stored as `bookings.contract_id`
  - Email FROM domain updated to `noreply@hydrowash.services` (Resend domain verified, DKIM confirmed)
  - Migration 029: `unit_location_others text[]` + `contract_id uuid` on bookings ✅ applied

- **Post-Phase 2 fixes (2026-05-20):**
  - Removed "Book Again" feature from customer bookings page
  - `SlotCalendar`: max 3 slots **total** across all dates (not per-date); multi-date still supported
  - Admin `BookingCard` confirmed slot dropdown now shows all 5 time slots (not just customer's preferred)
  - Contract PDF (`/api/contracts/[id]/pdf`) and work order PDF (`/api/bookings/[id]/work-order-pdf`) now accessible to the owning customer (not admin-only)
  - `ContractCard`: Preview PDF button for AWAITING_PAYMENT/ACTIVE contracts
  - `InvoiceRow`: View PDF button when `booking_id` present
  - Customer contracts page: View Contract PDF link; customer invoices table: View PDF link
  - cancel/reschedule API routes: allow admin role (was customer-only)
  - Migration 028: customer booking UPDATE RLS policy (required for cancel/reschedule)

- **Bug fixes (2026-05-21):**
  - Fixed broken Unsplash photo URLs (hero + installation card + auth pages) — replaced 404 IDs with working ones
  - `app/admin/settings/AdminSettingsClient.tsx`: added PayNow Mobile Number input field (was missing, preventing QR generation)
  - `app/api/contracts/[id]/send-contract-pdf/route.ts`: contract PDF email now sends unconditionally — PayNow QR is optional (included only when `paynow_mobile` is configured); previously email was silently skipped when `paynow_mobile` was null

- **Frontend upgrade (2026-05-20):** Full visual refresh across all pages ✅ complete
  - `next.config.ts`: added `images.remotePatterns` for `images.unsplash.com`
  - `app/globals.css`: `@media (prefers-reduced-motion: no-preference)` guard on fade-up animations
  - `components/ui/service-card.tsx`: optional `photoSrc`/`photoAlt` props render a photo banner at top of card
  - `app/(public)/page.tsx`: hero photo (Unsplash, `fill priority`), stat strip icons, Why Choose Us split section, Testimonials 3-card grid, How It Works with `w-14 h-14` accent circles, CTA background photo
  - `app/auth/login/page.tsx` + `app/auth/register/page.tsx`: left panel replaced with Unsplash photo + `bg-primary/70` overlay; "← Back to home" link added
  - `components/booking/BookingWizard.tsx`: numbered circle progress bar (Check icon for completed steps, Loader2 spinner on submit); step content wrapped in `rounded-2xl border shadow-sm p-6` card
  - `components/booking/SlotCalendar.tsx`: selected dates filled `bg-accent text-white`; today gets `ring-2 ring-accent/50`
  - `app/account/bookings/page.tsx`: 2-chip summary strip (Total / Upcoming); CalendarOff empty state with CTA
  - `app/account/contracts/page.tsx` + `AccountContractsClient.tsx`: FileText summary strip (Active count); FileX empty state
  - `components/admin/AdminNav.tsx` (new): `'use client'` nav with `usePathname` active states and Lucide icons for all 8 admin nav items
  - `app/admin/layout.tsx`: replaced inline nav with `<AdminNav />`
  - `app/admin/page.tsx`: stat cards with `border-l-4` + icon circles; ArrowRight hover on quick actions; alert sections as `bg-white border-l-4` cards with → links to contract detail
  - `components/admin/BookingCard.tsx`: `border-l-4` status strip (amber=PENDING, green=APPROVED, slate=rest)
  - `app/admin/bookings/AdminBookingsClient.tsx`: filter chips use `rounded-full`
  - `app/admin/contracts/page.tsx` + `app/admin/invoices/page.tsx`: count badge `· {n}` next to heading
  - `components/admin/InvoiceRow.tsx`: accepts `className` prop; rows alternate `bg-white`/`bg-muted/40` with `hover:bg-accent/5`
  - `app/admin/customers/page.tsx`: avatar initial circle (`w-8 h-8 bg-accent/10`); `hover:bg-accent/5`; name links to detail
  - `app/admin/customers/[id]/page.tsx`: larger avatar (`w-16 h-16`); total paid in `text-accent`
  - `app/admin/agenda/page.tsx`: booking chips `rounded-md font-medium`; today column header `bg-accent/10 font-semibold`; slot labels right-aligned

## Superpowers file conventions
- Specs: `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
- Plans: `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`
- Cross-session state: `docs/superpowers/NEXT-SESSION.md` (check this at session start)

## Jest config
Use `setupFilesAfterEnv: ['<rootDir>/jest.setup.ts']` (not `setupFiles`). VRP tests use `/** @jest-environment node */` docblock. Default testEnvironment is `jsdom`.

## Misc
- **Design tokens — never hardcode hex.** Use `bg-accent`/`text-accent` for `#0369A1`, `bg-primary`/`text-primary` for `#0F172A`, `bg-muted` for section backgrounds, `border-border` for borders, `text-muted-foreground` for secondary text.
- **Icons — Lucide only.** Never use emoji as icons. Import from `lucide-react`.
- Run `export CLAUDE_CODE_MAX_OUTPUT_TOKENS=64000` before writing large implementation plan files.
- The service role client (`lib/supabase/admin.ts`) bypasses RLS — only use server-side.
- Cron endpoints are secured with a `CRON_SECRET` header check.
- shadcn/ui v4 uses `@base-ui` (NOT `@radix-ui`). `onValueChange` is `(value: string | null, event: Event) => void` — always use `?? ''` when assigning to string state.
- shadcn/ui v4 `SelectValue` does NOT auto-resolve selected item label — always provide explicit children text inside `<SelectValue>`.
- shadcn/ui v4 `DialogTrigger` renders its own `<button>` element — NEVER nest a `<Button>` component inside it (nested `<button>` causes hydration errors). Instead apply button styles directly to `<DialogTrigger>` using `buttonVariants`: `<DialogTrigger className={cn(buttonVariants(), 'extra-classes')}>Label</DialogTrigger>`.
- `useSearchParams` requires a `<Suspense>` boundary in Next.js 15+.
- Both `lib/supabase/client.ts` and `lib/supabase/server.ts` export `createClient`. Import as `@/lib/supabase/server` (server) or `@/lib/supabase/client` (browser).
- `BookingsMap` and `RouteMap` use `next/dynamic` with `ssr: false` (Google Maps requires browser).
- `SlotCalendar` fetches `/api/availability?month=YYYY-MM` on mount and on month navigation. The response `byDate` is keyed by date string.
- `UnitLocationPicker` fetches `ac_unit_locations` directly from Supabase browser client on mount. Renders N `<Select>` dropdowns driven by `numUnits` prop; `value: string[]` has one entry per unit (or `OTHERS_VALUE = '__other__'`); `otherTexts: string[]` holds free-text for units that chose "Others". Same room can be selected for multiple units. In `BookingWizard.handleSubmit`, `__other__` entries are filtered out of `unit_location_ids` before sending to API; custom texts go in `unit_location_others`.
- `StepScheduleLocation` loads the Google Places library via `useJsApiLoader` with `libraries: ['places']` — define the array outside the component to keep a stable reference.
- `lib/booking/slots.ts` contains pure functions for slot availability logic and contract tier pricing — import these in tests and server routes, not inline logic.
- `service_types.description` is `NOT NULL DEFAULT ''` — never send `null`; send empty string instead.
- **Turbopack + Windows:** Dynamic `[param]` route segments are not compiled at `npm run dev` startup. Touch the route file (add/remove a blank line) to force HMR. Affected routes: `api/bookings/[id]`, `admin/contracts/[id]`, `api/contracts/[id]/link-booking`, `api/invoices/[id]/pay`.
- **Custom combobox pattern:** Use `onMouseDown` + `e.preventDefault()` on dropdown items (not `onClick`) to prevent blur firing before selection.
- **Draggable resize:** `isDragging` is a `useRef<boolean>`, not state — avoids re-renders; document-level listeners in a single `useEffect`.
- **Current status:** Bug fixes applied (2026-05-21). Frontend upgrade complete. All Phase 2 subsystems + post-release fixes + full visual refresh applied. All migrations 001–029 applied. Supabase Storage bucket `documents` (private) created. `@react-pdf/renderer`, `qrcode.react`, `qrcode` installed. Dev environment on VPS at `/root/project/hydrowash` with `.env.local` present.
- **DB connection (VPS):** `postgresql://postgres@db.qasbovdxswjrtxouxejh.supabase.co:5432/postgres` — password in `.env.local` comments or ask owner.
