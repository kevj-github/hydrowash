# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is
A Next.js 16 web app for online booking at a Singapore aircon servicing company. Customers book online; the owner manages jobs via an admin dashboard with geographic clustering and route optimisation. Includes 1-year maintenance contracts, quarterly service reminders, and manual invoice tracking.

## Commands

```bash
npm run dev        # Start dev server (localhost:3000)
npm run build      # Production build
npm run lint       # ESLint
npx jest           # Run all Jest tests
npx jest vrp       # Run VRP test file
# Migrations: create supabase/migrations/0NN_name.sql → apply via Supabase dashboard SQL editor
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
SUPABASE_AUTH_HOOK_SECRET  # Bearer token for Supabase auth hook; must match the value set in Supabase Dashboard → Authentication → Hooks → Send Email (HTTP Bearer Token field); required in both .env.local and Vercel
```

## Two user roles
- `customer` — register, submit bookings, view own booking history and contracts/invoices
- `admin` — manage bookings, approve/reject, run route optimiser, manage contracts and invoices, manage settings

Roles are stored in `profiles.role` and enforced via Supabase RLS on every table.

## Three booking categories
- `MAINTENANCE` — cleaning, chemical wash; admin views on map, approves each card individually (same as Fault/Installation)
- `FAULT_REPAIR` — inspection visit first; admin approves individually by urgency
- `INSTALLATION` — new AC unit; admin reviews specs and approves

All categories use the **multi-date slot model**: customers choose up to 3 preferred dates in total, each with a time slot (`preferred_date_slots jsonb`) — `MAX_DATES` and `MAX_TOTAL_SLOTS` in `SlotCalendar.tsx` are both 3, enforced client-side and re-validated server-side in `POST /api/bookings`. For backward compatibility, `booking_date` + `preferred_slots` + `time_slot` are still written from the first preference entry. Admin resolves conflicts and assigns a `confirmed_date` + `confirmed_slot` on approval. Uniqueness is enforced only on confirmed APPROVED bookings `(confirmed_date, confirmed_slot)`.

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
  (public)/PublicHeader.tsx    # Client: scroll-aware navbar; logged-in non-admin customers see My Bookings + Contracts & Invoices + Settings; uses bg-primary consistently (no hardcoded hex)
  (public)/MobileNav.tsx       # Client: hamburger menu; same links as PublicHeader for mobile (including Settings for non-admin)
  (public)/page.tsx            # Landing page — "Hydrowash home aircon solution" hero, stat strip, ServiceCard grid, Why Choose Us, How It Works timeline, CTA (testimonials/reviews section removed)
  (public)/book/page.tsx       # 3-step booking wizard (uses public layout + navbar)
  auth/login/page.tsx
  auth/register/page.tsx
  auth/callback/route.ts       # Supabase auth callback; ?next= param validated (relative paths only)
  auth/reset-password/page.tsx # Client: verifies recovery OTP via token_hash, calls updateUser({password}), redirects to login
  api/auth/signout/route.ts    # GET: server-side signOut() + redirect to /
  account/layout.tsx           # Customer auth guard + nav (also has Contracts & Invoices link)
  account/bookings/page.tsx    # Customer booking history
  account/contracts/page.tsx   # Server wrapper: fetches contracts + invoices, delegates to AccountContractsClient
  account/AccountContractsClient.tsx  # Client: contract status filter + invoice status/date-range filters; "Request Contract" dialog includes Home/My Location/Other address picker + unit/floor + building name (same as booking wizard)
  account/settings/page.tsx    # Customer account settings
  account/AccountSettingsClient.tsx  # Client: edit name, phone, address + unit_floor + building_name (appear after address confirmed)
  admin/layout.tsx             # Admin auth guard + nav
  admin/page.tsx               # Overview dashboard (stats + Phase 1B widgets)
  admin/bookings/page.tsx      # 4-tab: Maintenance (map) / Fault / Installation / All
  admin/bookings/AdminBookingsClient.tsx  # Client: draggable resizer, per-tab filters, bidirectional map↔card sync, InfoWindow popup, All-tab customer search; multi-select + bulk/single hard-delete (Checkbox + ConfirmDeleteModal → POST /api/bookings/bulk-delete)
  admin/contracts/page.tsx     # Contracts list + create; client-side filters: name/phone search, start/expiry/next-service-due date ranges, status; multi-select + bulk/single hard-delete → POST /api/contracts/bulk-delete
  admin/contracts/[id]/page.tsx   # Contract detail: service schedule + invoices; "Delete Contract" button always hard-deletes (DELETE /api/contracts/[id])
  admin/invoices/page.tsx      # Invoices list + create; client-side filters: name/phone search, created/paid date ranges, status; Create dialog uses searchable customer combobox; multi-select + bulk/single hard-delete (desktop table + MobileInvoiceCard) → POST /api/invoices/bulk-delete
  admin/schedule/[date]/page.tsx  # Route optimiser — date picker, job selection, map
  admin/customers/page.tsx     # Server Component: fetches customers + booking counts + paid invoice totals + active contract ids, delegates to AdminCustomersClient
  admin/customers/AdminCustomersClient.tsx  # Client: search-filtered list, multi-select + bulk/single hard-delete with dependent-row-count warning → POST /api/customers/bulk-delete
  admin/customers/[id]/page.tsx  # Customer detail: profile card + bookings + contracts + invoices + total paid
  admin/agenda/page.tsx        # Week-grid view (?week=YYYY-MM-DD): 5 slot rows × 7 day cols; APPROVED/all toggle + week nav
  admin/settings/page.tsx      # Service types + depot settings + company info fields
  api/bookings/route.ts        # POST: create booking (validates slot not blocked/taken, inserts booking + booking_unit_locations)
  api/bookings/[id]/route.ts   # PATCH: approve / reject / cancel (admin-only, APPROVED-only, no cutoff — distinct from the customer self-cancel route)
  api/bookings/last/route.ts   # GET: customer's own most recent booking + unit_location_ids, same shape as GET /api/bookings/[id]; powers BookingWizard's always-on autofill
  api/bookings/[id]/reschedule/route.ts  # PATCH: customer reschedule (24h SGT cutoff); resets confirmed_date/slot; emails admin
  api/bookings/[id]/cancel/route.ts      # PATCH: customer cancel (24h cutoff); sets CANCELLED + cancelled_at/by/reason; emails admin
  api/bookings/[id]/complete/route.ts    # POST: upserts job_completions; marks APPROVED → COMPLETED unless save_only:true (step 2 preview); work_order_no auto-assigned by DB trigger
  api/bookings/[id]/work-order-pdf/route.ts  # GET: admin generates Work Order PDF on-the-fly
  api/bookings/[id]/send-work-order/route.ts # POST: admin sends Work Order PDF + PayNow QR to customer; creates UNPAID invoice
  api/bookings/bulk-approve/route.ts  # POST: bulk approve PENDING maintenance bookings with a confirmed_date
  api/bookings/bulk-delete/route.ts   # POST: { ids: string[] } → hard-deletes bookings, logs admin_audit_log, returns { succeeded, failed }
  api/availability/route.ts    # GET ?month=YYYY-MM → { byDate: { [date]: { booked: TimeSlot[], blockedSlots: (TimeSlot|null)[] } } }
  api/admin/ac-catalog/route.ts   # GET/POST/PATCH ?kind=unit_types|brands — admin CRUD for ac_unit_types and ac_brands
  api/contracts/route.ts       # POST: create contract + auto-generate service dates; GET: list
  api/contracts/request/route.ts  # POST: customer self-signup (status=PENDING_REVIEW, no price; sends confirmation email)
  api/contracts/[id]/route.ts  # PATCH: edit; DELETE: always hard-deletes (no more cancel-first step), logs admin_audit_log
  api/contracts/bulk-delete/route.ts  # POST: { ids: string[] } → hard-deletes contracts, logs admin_audit_log, returns { succeeded, failed }
  api/contracts/[id]/set-price/route.ts  # PATCH: set price → AWAITING_PAYMENT + immediately generates PDF, uploads to Storage, emails customer (returns { contract, emailSent: boolean })
  api/contracts/[id]/send-contract-pdf/route.ts  # POST: generate contract PDF + PayNow QR; upload to storage; email to customer
  api/contracts/[id]/pdf/route.ts        # GET: admin preview — returns contract PDF blob on-the-fly
  api/contracts/[id]/mark-paid/route.ts  # PATCH: AWAITING_PAYMENT → ACTIVE + generate service dates + send activation email
  api/contracts/[id]/activate/route.ts  # PATCH: admin activates PENDING_REVIEW → ACTIVE + generates service dates + emails customer (admin-created contracts)
  api/contracts/[id]/link-booking/route.ts  # PATCH: link booking to service date
  api/invoices/route.ts        # POST: create invoice; GET: list with filters
  api/invoices/[id]/pay/route.ts  # PATCH: mark invoice paid
  api/invoices/bulk-delete/route.ts   # POST: { ids: string[] } → hard-deletes invoices, logs admin_audit_log, returns { succeeded, failed }
  api/customers/bulk-delete/route.ts  # POST: { ids: string[] } → hard-deletes customer profiles (cascades bookings/contracts/invoices), logs admin_audit_log, returns { succeeded, failed }
  api/profile/route.ts         # PATCH: customer updates own profile (name, phone, address, address_lat/lng, postal_code, unit_floor, building_name)
  api/admin/service-types/route.ts  # POST admin: create a service type (name, category, description)
  api/admin/settings/route.ts  # PATCH admin: update app_settings (depot location, company info, paynow_mobile)
  api/availability/block/route.ts  # POST admin: replace all blocked_slots for a date — { date, blockEntireDay, slots: TimeSlot[], reason? }
  api/invoices/[id]/remind/route.ts  # POST admin: send an ad-hoc PaymentReminder email (+ PayNow QR) for one UNPAID invoice; powers RemindButton
  api/geocode/route.ts         # POST: geocode address → lat/lng
  api/geocode/reverse/route.ts # POST: { lat, lng } → { address, postalCode } (reverse geocode via Google)
  api/optimize/route.ts        # POST: run single-route VRP for selected booking IDs
  api/availability/suggest/route.ts  # GET ?from=YYYY-MM-DD&slot=S10_12&days=14 → top 5 (date,slot) suggestions
  api/cron/reminders/route.ts  # GET: day-before reminder cron (uses booking_date, not confirmed_date)
  api/cron/contracts/route.ts  # GET: quarterly service due emails (day 1 = reminder_sent, day 15 = second_reminder_sent) + contract expiry emails (uses expiry_reminder_sent); covered by app/api/cron/contracts/__tests__/route.test.ts
  api/admin/service-dates/[id]/remind/route.ts  # POST admin: ad-hoc quarterly-reminder send for one contract_service_dates row (same email as the cron); does not touch reminder_sent/second_reminder_sent — independent of cron tracking
  api/admin/customers/[id]/remind/route.ts      # POST admin: generic "just checking in" reminder email (BasicReminder template), no quarterly-maintenance framing
  api/auth/send-email/route.ts # POST: Supabase auth hook — handles signup/email_change (→ EmailConfirmation.tsx) and recovery (→ PasswordReset.tsx) via Resend; verifies Authorization: Bearer token against SUPABASE_AUTH_HOOK_SECRET

components/
  ui/section.tsx               # <Section> full-width wrapper + <SectionInner> max-w-6xl centered
  ui/section-heading.tsx       # <SectionHeading label title subtitle align light> — shared section titles
  ui/service-card.tsx          # <ServiceCard icon title description> — Lucide icon card with hover
  ui/step-item.tsx             # <StepItem number label description done> — numbered step circle
  ui/checkbox.tsx               # <Checkbox checked onCheckedChange aria-label> — shadcn/ui v4 primitive; used throughout admin for multi-select rows/cards
  ui/address-autocomplete.tsx  # Google Places autocomplete input + reverse-geocode resolution → { address, postal_code, lat, lng }; used by StepScheduleLocation, register, account settings, admin contracts, account contracts
  booking/BookingWizard.tsx    # 3-step wizard: Service → Schedule & Location → Review
  booking/StepServiceDetails.tsx  # Step 0: service type, category fields, UnitLocationPicker for MAINTENANCE
  booking/StepScheduleLocation.tsx  # Step 1: SlotCalendar (date+slot) + address presets (Home/My Location/Other) + Places autocomplete; accepts `contractAddress` prop — when set, hides presets and shows locked address (auto-geocoded on mount)
  booking/StepReview.tsx       # Step 2: summary of all booking data before submit
  booking/SlotCalendar.tsx     # Month-grid calendar; up to 3 dates, 3 slots total (MAX_DATES = MAX_TOTAL_SLOTS = 3); SGT-aware past-slot blocking; optional allowedMonth prop restricts selectable dates to one YYYY-MM (contract-linked bookings)
  booking/UnitLocationPicker.tsx  # N per-unit <Select> dropdowns (one per unit), driven by numUnits prop; reads ac_unit_locations from Supabase browser client
  contracts/ContractUnitDetailsPicker.tsx  # Shared per-unit location/type(with illustration tiles)/brand(optional) picker — used by admin contract dialog, customer request dialog, and (readOnly) the booking wizard + admin contract detail page
  ui/AcUnitTypeIllustration.tsx  # Small inline-SVG glyphs for Wall Mounted / Ducted / Cassette unit types (Lucide AirVent fallback for unrecognized labels); no photo assets used
  admin/BookingCard.tsx        # Status badge, preferred_slots chips, confirmed_date + confirmed_slot picker; highlighted prop for map-pin selection; onCardClick prop for card→map sync; JobCompletionDialog replaces "Mark Complete"; required `selected`/`onToggleSelect`/`onDeleteClick` props drive the checkbox + trash icon
  admin/BookingsMap.tsx        # Google Map markers; InfoWindow popup on pin click (customer name, service, address, status, dates); next/dynamic ssr:false
  admin/AdminBottomNav.tsx     # Mobile bottom nav bar for admin (5 primary tabs + More sheet with Agenda/Availability/Settings); Schedule removed from More sheet; shown on <md
  admin/AdminNav.tsx           # Desktop sidebar nav for admin — same routes as AdminBottomNav
  admin/RemindButton.tsx       # Generic "Remind" button (idle/sending/sent/error states) posting to a given url; used for invoice payment reminders and customer check-in reminders
  admin/AdminAgendaClient.tsx  # Client: mobile day-list view (selectedDay state) + desktop week-grid for agenda page; clicking a job chip opens AgendaJobPopup instead of navigating away
  admin/AgendaJobPopup.tsx     # Job detail popup opened from the Agenda grid — status/service/date-slot/address/units/notes, plus (APPROVED only) embedded JobCompletionDialog + a Cancel flow (PATCH /api/bookings/[id] action:'cancel')
  admin/ContractCard.tsx       # Contract list card with status/due/expiry badges; shows address if present; required `selected`/`onToggleSelect`/`onDeleteClick` props drive the checkbox + trash icon
  admin/ServiceDateRow.tsx     # One quarterly service visit row; displays formatDueMonth(due_month)
  admin/InvoiceRow.tsx         # One invoice row with mark-paid dialog; shows "Contract linked" sub-text when contract_id is set; `selected`/`onToggleSelect`/`onDeleteClick` are optional — omitting them (as the contract detail page's invoices sub-table does) hides the checkbox column and delete button
  admin/ConfirmDeleteModal.tsx # Generic delete-confirm dialog: props { open, onOpenChange, title, items: {id,label}[], warning?, onConfirm: () => Promise<void> } — lists items to delete, shows optional warning line, used by all four admin delete flows (bookings/contracts/invoices/customers)
  admin/RouteMap.tsx           # Google Map with numbered pins + polyline (next/dynamic, ssr:false)
  admin/JobCompletionDialog.tsx  # 3-step dialog: Step 1 (attended_by, AC details, checklist); Step 2 (pricing + additional charges); Step 3 (preview PDF + confirm & send)
  account/RescheduleDialog.tsx   # Customer reschedule dialog wrapping SlotCalendar; uses buttonVariants() on DialogTrigger
  account/CancelDialog.tsx       # Customer cancel confirm dialog with optional reason textarea
  ui/CustomerBottomNav.tsx     # Mobile bottom nav bar for customers (Home, Book Now, Bookings, Account); shown on <md

lib/
  supabase/client.ts           # Browser Supabase client — exports createClient()
  supabase/server.ts           # Server Supabase client — exports async createClient()
  supabase/admin.ts            # Service role client — exports createAdminClient(); used for auth.admin.getUserById()
  admin/audit-log.ts           # logAdminDelete(supabaseAdmin, adminId, entityType, rows) — inserts one admin_audit_log row per delete (bulk or single) with entity_type, entity_ids[], and a { id, label }[] summary
  booking/slots.ts             # Pure functions: isDayFullyBlocked, isSlotBlocked, getSlotsForDate, resolveContractTierPrice
  utils/paynow.ts              # buildPayNowPayload() + crc16ccitt() — EMVCo SGQR format for Singapore PayNow
  utils/pdf-filename.ts        # Builds slugified PDF filenames (e.g. contract/work-order downloads) from customer name + date
  hooks/useMapsLoaded.ts       # Readiness hook for the Google Maps JS API under loading=async — waits on importLibrary(), not just namespace presence; requirePlaces gate for Places-only consumers
  testing/supabase-route-mock.ts  # Test-only helpers mocking the session-scoped (lib/supabase/server.ts) and service-role (lib/supabase/admin.ts) Supabase client shapes used by admin API routes
  (no tests for booking/slots.ts — the pure slot/pricing helpers are untested)
  vrp/optimizer.ts             # Single-route nearest-neighbour VRP; uses timeSlot (not preferredSlot); DAY_START=10*60; SLOT_WINDOWS keyed by TimeSlot
  vrp/__tests__/optimizer.test.ts
  maps/geocode.ts              # Google Geocoding API wrapper (forward geocode)
  maps/distance-matrix.ts      # Google Distance Matrix API wrapper
  email/send.ts                # Send functions via Resend (includes sendBookingRescheduled, sendBookingCancelled, sendContractPricing, sendWorkOrderReport)
  email/templates/             # React Email templates: BookingReceived, BookingApproved, BookingRejected, BookingRescheduled, BookingCancelled, DayBeforeReminder, ScheduleConfirmed, ContractRequestReceived, ContractPricingEmail, ContractActivated, ContractExpiring, ContractServiceDue, WorkOrderEmail, PaymentReceived, PaymentReminder, BasicReminder, EmailConfirmation, PasswordReset
  pdf/ContractPdfTemplate.tsx  # React-PDF single-page contract document (navy/blue brand, tight spacing); props: customerName, contactNo, address, numUnits, totalAmountSgd, serviceDueMonths[], company{}
  pdf/WorkOrderTemplate.tsx    # React-PDF single-page work order/invoice report — bordered table sections, no signature/confirm block; props: WorkOrderProps (customer, AC details, checklist as Done/Not done labels, job desc/rendered/remarks, charges, invoiceStatus/paymentMethod/paidAt sourced live from the invoices table — never hardcoded)
  pdf/generate.ts              # generateContractPdf(props) + generateWorkOrderPdf(props) → Promise<Buffer>
  contracts/service-dates.ts   # generateServiceDates() returns due_month (YYYY-MM) + second_reminder_sent; formatDueMonth(due_month) → display string
  contracts/units.ts           # Pure helpers for ContractUnitDetail[]: normalizeUnitDetails, isUnitDetailsComplete, summarizeUnitTypes, contractUnitSummary (legacy-string fallback), toAcUnitDetails; + async sanitizeUnitDetails(supabase, raw, numUnits) — server-side re-resolves ids against catalogs before insert/update
  jobs/descriptions.ts         # buildJobDescription() / buildJobRendered() — pure text builders used to pre-fill JobCompletionDialog from booking/contract unit data; still fully editable by admin
  types.ts                     # Shared TypeScript types — TimeSlot, PreferredDateSlot, SLOT_LABELS, SLOT_KEYS, AcUnitLocation, AcUnitType, AcBrand, BlockedSlot, ContractPricingTier, RouteStop, BookingWithRelations, AppSettings, AcUnitDetail, ChecklistItem, AdditionalCharge, JobCompletion, ContractUnitDetail, StaffMember

middleware.ts                  # Auth routing (role-based redirects — admin and customer only) ⚠ Next.js 16 deprecated this filename in favour of proxy.ts — still works but will need renaming
supabase/migrations/           # Migrations 001–042 all applied; see individual SQL files for schema history (035 adds admin_audit_log table + cascades bookings.customer_id delete; 037 signup address metadata; 038 contracts.unit_details; 039 staff_members table; 040 region-coded customer numbering; 041 pins resolve_customer_region() search_path per Supabase linter; 042 adds bookings.unit_floor/building_name/access_notes)
jest.config.ts
jest.setup.ts
vercel.json                    # Cron config (reminders daily + contracts daily)
```

## Data model (key tables)

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users`; holds `name`, `phone`, `role` |
| `service_types` | Admin-configured list of services; `category` enum drives booking form options |
| `bookings` | Core table — `booking_date date NOT NULL`, `time_slot text NOT NULL` (first preferred slot, backward compat), `preferred_slots text[] NOT NULL DEFAULT '{}'` (up to 3 choices), `preferred_date_slots jsonb` (up to 3 date+slot entries), `confirmed_slot text`; `unit_location_others text[]` (free-text labels for units that chose "Others"); `contract_id uuid` (optional link to customer's contract); `unit_floor text`, `building_name text`, `access_notes text` (migration 042 — kept as their own columns, not just folded into the composed address string, so "book again" prefill can recall them); unique index on `(confirmed_date, confirmed_slot) WHERE status = 'APPROVED'` |
| `app_settings` | Singleton — depot location, company info, `paynow_mobile`, `contract_pricing_tiers jsonb` |
| `contracts` | 1-year maintenance contracts; `status` = PENDING_REVIEW/AWAITING_PAYMENT/ACTIVE/EXPIRED/CANCELLED; optional `address` text column; `unit_details jsonb` (`ContractUnitDetail[]`, default `'[]'`) — per-unit location/type/brand with denormalized label snapshots; CHECK enforces length is 0 or exactly `num_units` |
| `contract_service_dates` | 4 auto-generated quarterly visit dates per contract; `due_month text` (YYYY-MM, month-only); `second_reminder_sent bool`; `booking_id` links to the booking when scheduled |
| `invoices` | Manual invoices; optionally linked to a booking and/or contract |
| `ac_unit_locations` | Admin-managed room labels (Master Bedroom, Room 1–3, Living Room, Kitchen, Study Room) |
| `booking_unit_locations` | Join table: which room locations are included in a booking |
| `ac_unit_types` | Admin-managed unit types for invoice finalization (Wall Mounted, Ducted Unit, Cassette Unit) |
| `ac_brands` | Admin-managed AC brands for invoice finalization (Mitsubishi, Daikin, Panasonic, Toshiba, Samsung, Midea) |
| `staff_members` | Admin-managed "attended by" options for job completion (`label`, `is_default`, `is_active`); admin-only RLS (unlike the public-readable `ac_*` catalogs) since `app_settings` is world-readable and this couldn't live there; partial unique index enforces at most one `is_default = true` row |
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
- **Step 1 (Schedule & Location):** A short explanation of how scheduling works (max 3 dates/slots total, admin confirms one) is shown above the calendar. `SlotCalendar` — month grid fetching `/api/availability`; select up to 3 dates, up to 3 slots total (SGT-aware — past slots on today greyed/disabled). Address presets: Home (profile address — if available), My Location (geolocation → `/api/geocode/reverse`), Other (Google Places Autocomplete). After location confirmed, unit/floor + building + access notes fields appear.
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
- "Mark Paid" records `payment_method` + stamps `paid_at`, then emails the customer (`sendPaymentReceived`) with the amount, payment method, date, invoice description, and (when the invoice is linked to a booking) the service name + date — failure to send doesn't fail the request
- List filters (client-side): name/phone search; created/paid date ranges; status pills

**Customer contracts & invoices (`/account/contracts`):**
- Server component fetches; delegates to `AccountContractsClient` for filters
- Contract status pills include Awaiting Payment; invoice status pills + date-range filter

**Customer booking self-service (`/account/bookings`):**
- `canModify()` helper: PENDING/APPROVED only, and effective date > 24h away in SGT
- `RescheduleDialog`: opens SlotCalendar in a Dialog; PATCH `/api/bookings/[id]/reschedule`; resets confirmed_date/slot; emails admin
- `CancelDialog`: confirm + optional reason textarea; PATCH `/api/bookings/[id]/cancel`; sets CANCELLED status; emails admin
- **Booking memory:** `BookingWizard` always prefills from the customer's most recent booking on mount (`GET /api/bookings/last`) — service type, category, num_units, unit locations (+ others free text), address/postal/lat/lng/unit_floor/building_name, ac_brand/ac_model. `preferred_date_slots` is always cleared (schedule is chosen fresh) and `contract_id` is never carried over (a past contract-linked booking's *details* prefill, but the new booking is not auto-linked — the customer must re-select the contract explicitly). The `?repeat=[id]` URL param (no longer exposed in the UI) still overrides this with a specific past booking via `GET /api/bookings/[id]` instead of `/last`.
- **Contract-linked date restriction:** when a booking is linked to a contract with `unit_details` recorded, `StepServiceDetails` computes the contract's earliest unlinked `contract_service_dates.due_month` and passes it down as `contract_next_due_month` — `SlotCalendar` then only allows dates inside that month (banner explains why). If that due month has already passed (compared to the current month), no restriction is applied and any future date is selectable, per the "overdue visit" case.

**Admin contract PDF flow:**
- Admin opens contract detail → "Set Price" dialog (single step): fills price + start date + notes → "Set Price & Send to Customer" button calls `PATCH /api/contracts/[id]/set-price` which sets status=AWAITING_PAYMENT AND generates PDF + PayNow QR + emails customer in one request. Returns `{ contract, emailSent: boolean }` — if `emailSent: false`, alert shown and admin can use "Resend Contract Email" from the AWAITING_PAYMENT banner.
- Preview: `GET /api/contracts/[id]/pdf` → PDF blob rendered in new tab
- Resend: `POST /api/contracts/[id]/send-contract-pdf` → regenerates PDF, uploads to Storage, generates PayNow QR, emails customer with PDF attachment (used from AWAITING_PAYMENT banner)
- AWAITING_PAYMENT banner on detail page shows Preview PDF + Resend Contract Email + Mark Paid & Activate buttons

**Admin job completion + work order:**
- `JobCompletionDialog` on `BookingCard`: 3-step — Step 1 (attended_by, job times, AC unit details table with brand/model, checklist items, job description); Step 2 (base price, additional charges, live total); Step 3 (preview PDF + confirm & send)
- Step 3 "Preview" → `GET /api/bookings/[id]/work-order-pdf` → PDF in new tab
- Step 2 "Save & Preview PDF" → `POST /api/bookings/[id]/complete` with `save_only:true` (upserts job_completions, does NOT change booking status — booking stays APPROVED)
- Step 3 "Confirm & Send" → `POST /api/bookings/[id]/complete` (marks APPROVED → COMPLETED) then `POST /api/bookings/[id]/send-work-order` (generates PDF, uploads to Storage, emails customer with PDF + PayNow QR, creates UNPAID invoice with `contract_id` resolved as: `linkedCsd?.contract_id ?? booking.contract_id ?? null` — admin's service-date link takes precedence, customer's contract selection is the authoritative fallback)

**Admin customer 360 (`/admin/customers`):**
- List: search by name/phone; columns: customer_no, name, phone, booking count, total paid (PAID invoices), active contract badge, View link
- Detail `/admin/customers/[id]`: profile card (email from auth, phone, address, member since, total paid), bookings table, contracts list with next due, invoices table

**Admin hard delete (bookings/contracts/invoices/customers):**
- Every admin list page (bookings, contracts, invoices, customers) has row/card checkboxes + a "Select all" toggle + a "Delete N Selected" bulk-action button, plus a per-row/card trash icon for single delete. Both paths open the same `ConfirmDeleteModal`, listing the item(s) to be deleted, and call the same `POST /api/{resource}/bulk-delete` route (`{ ids: string[] }` → `{ succeeded, failed }`) whether one id or many are passed.
- All deletes are **hard deletes** — no soft-delete/cancel step. `DELETE /api/contracts/[id]` (single-contract delete from the contract detail page) was changed to always hard-delete too, instead of cancelling first.
- Every delete (bulk or single, any resource) is recorded via `logAdminDelete()` (`lib/admin/audit-log.ts`) into `admin_audit_log` (migration 035): `admin_id`, `action: 'DELETE'`, `entity_type`, `entity_ids[]`, and a `{ id, label }[]` summary.
- Deleting a customer cascades: migration 035 added `ON DELETE CASCADE` on `bookings.customer_id` (contracts/invoices already cascaded), so `AdminCustomersClient`'s delete modal fetches and shows a dependent-row-count warning (bookings/contracts/invoices) before the admin confirms.
- `app/admin/customers/page.tsx` is a Server Component (fetches customers + booking counts + paid invoice totals + active contract ids) that delegates all interactivity — including selection state and the delete flow — to the client `AdminCustomersClient`, mirroring the existing `admin/bookings/page.tsx` → `AdminBookingsClient` split.
- `InvoiceRow`'s `selected`/`onToggleSelect`/`onDeleteClick` props are optional (default: hidden) because it has a third consumer — the contract detail page's invoices sub-table — that intentionally has no bulk-select UI.

**Admin agenda (`/admin/agenda`):**
- Week-grid: SLOT_KEYS rows × 7 day columns; ?week=YYYY-MM-DD param (defaults to current Monday)
- Each cell shows booking customer name chips; clicking one opens `AgendaJobPopup` in place (no navigation) with full job detail and, for APPROVED bookings, Complete Job + Cancel actions
- APPROVED/all active toggle; prev/next week nav; Today shortcut
- Page query selects `*` (not a narrow field list) plus customer/service_type joins so the popup has everything `JobCompletionDialog` needs without a second fetch

**Admin cancel of an approved booking:** distinct from the customer self-cancel route (`/api/bookings/[id]/cancel`, which has a 24h cutoff). `PATCH /api/bookings/[id]` with `action:'cancel'` is admin-only, only valid from APPROVED, no cutoff — available from `BookingCard.tsx` (bookings list, all tabs) and `AgendaJobPopup.tsx`. Frees any linked `contract_service_dates` slot and emails the customer (reuses `sendBookingRejected`'s copy/template with the cancel reason substituted for `rejection_reason`).

## Design system
Brand rules: `design-system/hydrowash/MASTER.md`. No per-page override docs exist yet — apply the master rules everywhere.

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

## Feature completeness
Admin hard delete (bulk/single delete + audit log across bookings, contracts, invoices, customers) shipped 2026-09-09. Since then: payment reminder emails (`PaymentReminder` template + `RemindButton` + `POST /api/invoices/[id]/remind`), and booking `unit_floor`/`building_name`/`access_notes` as their own columns (migration 042) so "book again" prefill can recall them. This section is a rough waypoint, not a live log — see `git log` for the authoritative change history.

## Jest config
Use `setupFilesAfterEnv: ['<rootDir>/jest.setup.ts']` (not `setupFiles`). VRP tests use `/** @jest-environment node */` docblock. Default testEnvironment is `jsdom`.

## Misc
- **Design tokens — never hardcode hex.** Use `bg-accent`/`text-accent` for `#0369A1`, `bg-primary`/`text-primary` for `#0F172A`, `bg-muted` for section backgrounds, `border-border` for borders, `text-muted-foreground` for secondary text.
- **Icons — Lucide only.** Never use emoji as icons. Import from `lucide-react`.
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
- **JobCompletionDialog AC details table:** Brand, Model (unit type), and Location now use `<select>` dropdowns sourced from `ac_brands`, `ac_unit_types`, `ac_unit_locations`. Each has an "Others" option that reveals a free-text input inline. Sentinel value `'__other__'` in select; if stored value is not in known options list it auto-shows the text input (handles legacy data).
- **Job completion back button:** Step 3 of `JobCompletionDialog` now has "← Back to Pricing" button. `complete` route accepts `save_only: true` (saves job_completions without status change — used by step 2 preview) and accepts COMPLETED bookings (re-upserts job_completions without re-transitioning status/work_order_no); only APPROVED → COMPLETED transition happens when "Confirm & Send" is clicked in step 3.
- **Auth hook deployment note:** `SUPABASE_AUTH_HOOK_SECRET` must be added to Vercel env vars (not just `.env.local`) for the hook to work in production. Hook URL in Supabase dashboard must point to the Vercel production domain (`https://www.hydrowash.services/api/auth/send-email`), not localhost. **Vercel proxy quirk:** Vercel's proxy strips the `Authorization` header Supabase sends (replacing it with its own internal JWT). The route verifies using the `webhook-id` / `webhook-timestamp` / `webhook-signature` Svix / Standard Webhooks HMAC headers instead. The secret is exposed in the Supabase dashboard as `v1,whsec_<base64>` — store that full string as `SUPABASE_AUTH_HOOK_SECRET`. The route strips `v1,whsec_` and base64-decodes to get the signing key: `HMAC-SHA256(key, "{webhook-id}.{webhook-timestamp}.{body}")` → base64, compared (timingSafeEqual) against the `v1,<base64>` value in `webhook-signature`.
- **Multi-domain setup (prod + pre-prod):** Production is `www.hydrowash.services`; pre-prod is `hydrowash-ten.vercel.app`. Both share the same Supabase project. Supabase config: Site URL = `https://www.hydrowash.services`; Redirect URLs includes both `https://www.hydrowash.services/**` and `https://hydrowash-ten.vercel.app/**`. Auth hook URL stays at production (`https://www.hydrowash.services/api/auth/send-email`). `app/api/auth/send-email/route.ts` uses `redirect_to` origin (not `site_url`) to build `confirmUrl` — so confirmation links point back to whichever domain the user signed up from.
- **Landing page images:** All photos use `images.unsplash.com` (in `next.config.ts` `remotePatterns`). Verified IDs: hero/auth=`3iLFQj2bXq0` (person with AC remote), maintenance=`kpZiPQqZSpc` (filter cleaning), fault=`vG7-nbVmTM0` (diagnostic specialist), install=`HsNtqUNWOqk` (technician on unit), why-us=`iS5GDeLDk0E` (rooftop team), cta=`pbfibyECpy8` (woman relaxing at home).
- **Profile address fields:** `profiles` now has `unit_floor text` and `building_name text` (migration 030). These are collected in Account Settings (appear after address confirmed), Register page, and the contract request dialog. The booking wizard Home preset pre-fills `unit_floor` + `building_name` from the profile. All three forms compose the full address as `"unit_floor, building_name, street_address"` before saving/submitting.
- **SlotCalendar max-slots gate:** Adding a new date is blocked once `totalSlots >= MAX_TOTAL_SLOTS` (3) — not just when `value.length >= MAX_DATES` (5). Both conditions now disable calendar day cells. Warning message updated accordingly.
- **Select component:** `SelectTrigger` is `w-full` (was `w-fit`); `SelectPopup` uses `min-w-(--anchor-width)` so dropdown options are never clipped.
- **Contract-linked booking address:** `BookingData` has `contract_address?: string`. When a contract is selected in `StepServiceDetails`, `contract_address` is set alongside `contract_id`. `StepScheduleLocation` accepts `contractAddress?: string` prop — when provided, address picker is hidden and replaced with a locked display; a `useEffect` geocodes the contract address via `POST /api/geocode` on mount (sets lat/lng). `canNext` at step 1 allows proceeding when `contract_address` is set even if geocoding fails.
- **Admin invoices mobile:** `MobileInvoiceCard` component (file-local, not exported) in `app/admin/invoices/page.tsx` handles mark-paid dialog state per card. Shows: customer, status badge, description, "Contract linked" chip when `contract_id` set, amount + created date, paid date + payment method, View PDF button (when `booking_id` set), Mark Paid button (when UNPAID).
- **Password reset callback:** `app/auth/callback/route.ts` redirects to `/auth/reset-password` when `type === 'recovery'` (after `verifyOtp`). The page uses `supabase.auth.updateUser({ password })` client-side.
- **Open redirect protection:** `?redirect=` in `app/auth/login/page.tsx` and `?next=` in `app/auth/callback/route.ts` both validate the value starts with `/` and not `//` before following. Values that fail validation fall through to the default (`/`).
- **Email subjects:** `lib/email/send.ts` has a `fmtDate` helper (`"5 Jun 2026"` format, UTC) used in all booking and contract email subjects. Subjects include service type name + date to prevent Gmail threading. Work order emails use service type name + date + amount (no work order number).
- **Post-login redirect — use `window.location.href`, not `router.push`:** After `supabase.auth.signInWithPassword`, `@supabase/ssr`'s `createBrowserClient` writes the session cookie asynchronously via `onAuthStateChange`. Calling `router.push` immediately races ahead before the cookie is committed, so the middleware's `supabase.auth.getUser()` sees no session and bounces the user back to login. Always use `window.location.href = path` for a hard redirect after any Supabase sign-in/sign-up.
- **Security headers:** `next.config.ts` exports a `headers()` function adding `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy: same-origin`, and a scoped `Permissions-Policy` to all routes. Do not remove these.
- **Footer contrast:** Footer uses `text-slate-300` (not `text-slate-400`/`text-slate-500`/`text-slate-600`) for all text on the `bg-primary` dark navy background to meet WCAG AA contrast requirements.
- **Customer numbering:** `profiles.customer_no` is now region-coded, not a flat sequence. `resolve_customer_region(postal_code)` (SQL) / `regionForPostalCode()` (`lib/customers/regions.ts`, keep in sync) maps the postal code's 2-digit sector to one of Singapore's 5 URA planning regions via the standard 28 postal districts (best-effort — a couple of districts straddle two regions). Bands: Central 1000s, East 2000s, North 3000s, North-East 4000s, West 5000s, Unclassified 9000s (no/unmapped postal code). Assigned atomically per-region via `customer_no_counters`, only for `role='customer'`, only when `customer_no IS NULL` — admin edits are never overwritten. Existing customers keep their pre-migration flat numbers (no retroactive renumbering — those numbers may already be on sent invoices). Admin edits it via `CustomerNoEditor` (list row + customer detail page) → `PATCH /api/admin/customers/[id]/customer-no`, which does a preventive conflict check (returns the conflicting customer without writing) before a second `confirm:true` call commits; a partial unique index on `customer_no` is the backstop against races.
- **Last updated:** 2026-09-18. All migrations 001–042 applied (037 signup address metadata fix, 038 `contracts.unit_details` per-unit AC details, 039 `staff_members` admin-managed "attended by" options with a single default enforced by a partial unique index, 040 region-coded customer numbering, 041 pins `resolve_customer_region()` search_path per Supabase linter, 042 adds `bookings.unit_floor`/`building_name`/`access_notes`) (032 installation service, 033/034 security hardening rounds 2 + function grants/search_path, 035 admin hard delete: `admin_audit_log` table + `bookings.customer_id` cascade delete, 036 fixes contract/invoice hard-delete: `trg_enforce_customer_booking_update` now also exempts `auth.role() = 'service_role'`, not just an admin session — it was blocking the `ON DELETE SET NULL` cascade from `bookings.contract_id`/`invoices.contract_id` whenever a contract with a linked booking was deleted). Security: RLS role-escalation + booking self-approval (031), open-redirect on auth params, user-enumeration via check-email endpoint — all fixed. Supabase Storage bucket `documents` (private) created. Packages: `@react-pdf/renderer`, `qrcode.react`, `qrcode` (no `svix` — not used here, despite being a `package.json` dependency). Dev environment on VPS at `/root/project/hydrowash` with `.env.local` present. Repo docs cleaned up 2026-09-18: AI planning notes and static preview mockups removed from the tree; security/UX audit records moved to `docs/archive/`; see `README.md` for external-facing setup docs.
