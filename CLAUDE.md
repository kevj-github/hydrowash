# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is
A Next.js 15 web app for online booking at a Singapore aircon servicing company. Customers book online; the owner manages jobs via an admin dashboard with geographic clustering and route optimisation. Includes 1-year maintenance contracts, quarterly service reminders, and manual invoice tracking.

## Commands

```bash
npm run dev        # Start dev server (localhost:3000)
npm run build      # Production build
npm run lint       # ESLint
npm test           # Run all Jest tests
npx jest vrp       # Run VRP test file
```

## Tech stack
- **Framework:** Next.js 15 App Router, TypeScript
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
- `MAINTENANCE` — cleaning, chemical wash; admin clusters geographically on a map and bulk-approves
- `FAULT_REPAIR` — inspection visit first; admin approves individually by urgency
- `INSTALLATION` — new AC unit; admin reviews specs and approves

All categories use the **slot model**: customer picks a single `booking_date` (date) and one of 5 fixed `time_slot` values. One booking per slot (enforced by partial unique index). Admin assigns a `confirmed_date` on approval.

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
  admin/settings/page.tsx      # Service types + depot settings
  api/bookings/route.ts        # POST: create booking (validates slot not blocked/taken, inserts booking + booking_unit_locations)
  api/bookings/[id]/route.ts   # PATCH: approve / reject / complete
  api/bookings/bulk-approve/route.ts  # POST: bulk approve PENDING maintenance bookings with a confirmed_date
  api/availability/route.ts    # GET ?month=YYYY-MM → { byDate: { [date]: { booked: TimeSlot[], blockedSlots: (TimeSlot|null)[] } } }
  api/admin/ac-catalog/route.ts   # GET/POST/PATCH ?kind=unit_types|brands — admin CRUD for ac_unit_types and ac_brands
  api/contracts/route.ts       # POST: create contract + auto-generate service dates; GET: list
  api/contracts/[id]/link-booking/route.ts  # PATCH: link booking to service date
  api/invoices/route.ts        # POST: create invoice; GET: list with filters
  api/invoices/[id]/pay/route.ts  # PATCH: mark invoice paid
  api/geocode/route.ts         # POST: geocode address → lat/lng
  api/geocode/reverse/route.ts # POST: { lat, lng } → { address, postalCode } (reverse geocode via Google)
  api/optimize/route.ts        # POST: run single-route VRP for selected booking IDs
  api/cron/reminders/route.ts  # GET: day-before reminder cron
  api/cron/contracts/route.ts  # GET: flip reminder_sent flags; surface expiring contracts

components/
  ui/section.tsx               # <Section> full-width wrapper + <SectionInner> max-w-6xl centered
  ui/section-heading.tsx       # <SectionHeading label title subtitle align light> — shared section titles
  ui/service-card.tsx          # <ServiceCard icon title description> — Lucide icon card with hover
  ui/step-item.tsx             # <StepItem number label description done> — numbered step circle
  booking/BookingWizard.tsx    # 3-step wizard: Service → Schedule & Location → Review
  booking/StepServiceDetails.tsx  # Step 0: service type, category fields, UnitLocationPicker for MAINTENANCE
  booking/StepScheduleLocation.tsx  # Step 1: SlotCalendar (date+slot) + address presets (Home/My Location/Other) + Places autocomplete
  booking/StepReview.tsx       # Step 2: summary of all booking data before submit
  booking/SlotCalendar.tsx     # Month-grid calendar fetching /api/availability; slot pills per day
  booking/UnitLocationPicker.tsx  # Chip multi-select reading ac_unit_locations from Supabase browser client
  admin/BookingCard.tsx        # Status badge, confirmed date, highlighted prop for map-pin selection, onCardClick prop for card→map sync
  admin/BookingsMap.tsx        # Google Map markers; InfoWindow popup on pin click (customer name, service, address, status, dates); next/dynamic ssr:false
  admin/ContractCard.tsx       # Contract list card with status/due/expiry badges; shows address if present
  admin/ServiceDateRow.tsx     # One quarterly service visit row (table)
  admin/InvoiceRow.tsx         # One invoice row with mark-paid dialog
  admin/RouteMap.tsx           # Google Map with numbered pins + polyline (next/dynamic, ssr:false)

lib/
  supabase/client.ts           # Browser Supabase client — exports createClient()
  supabase/server.ts           # Server Supabase client — exports async createClient()
  supabase/admin.ts            # Service role client — used for auth.admin.getUserById()
  booking/slots.ts             # Pure functions: isDayFullyBlocked, isSlotBlocked, getSlotsForDate, resolveContractTierPrice
  booking/__tests__/slots.test.ts
  vrp/optimizer.ts             # Single-route nearest-neighbour VRP; uses timeSlot (not preferredSlot); DAY_START=10*60; SLOT_WINDOWS keyed by TimeSlot
  vrp/__tests__/optimizer.test.ts
  maps/geocode.ts              # Google Geocoding API wrapper (forward geocode)
  maps/distance-matrix.ts      # Google Distance Matrix API wrapper
  email/send.ts                # Send functions via Resend
  email/templates/             # React Email templates
  types.ts                     # Shared TypeScript types — TimeSlot, SLOT_LABELS, SLOT_KEYS, AcUnitLocation, AcUnitType, AcBrand, BlockedSlot, ContractPricingTier, RouteStop, BookingWithRelations, AppSettings

middleware.ts                  # Auth routing (role-based redirects — admin and customer only)
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
jest.config.ts
jest.setup.ts
vercel.json                    # Cron config (reminders daily + contracts daily)
```

## Data model (key tables)

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users`; holds `name`, `phone`, `role` |
| `service_types` | Admin-configured list of services; `category` enum drives booking form options |
| `bookings` | Core table — `booking_date date NOT NULL`, `time_slot text NOT NULL` (slot enum); partial unique index on `(booking_date, time_slot) WHERE status IN ('PENDING','APPROVED')` |
| `app_settings` | Singleton — depot location, company info, `paynow_mobile`, `contract_pricing_tiers jsonb` |
| `contracts` | 1-year maintenance contracts; `status` = ACTIVE/EXPIRED/CANCELLED; optional `address` text column |
| `contract_service_dates` | 4 auto-generated quarterly visit dates per contract; `booking_id` links to the booking when scheduled |
| `invoices` | Manual invoices; optionally linked to a booking and/or contract |
| `ac_unit_locations` | Admin-managed room labels (Master Bedroom, Room 1–3, Living Room, Kitchen, Study Room) |
| `booking_unit_locations` | Join table: which room locations are included in a booking |
| `ac_unit_types` | Admin-managed unit types for invoice finalization (Wall Mounted, Ducted Unit, Cassette Unit) |
| `ac_brands` | Admin-managed AC brands for invoice finalization (Mitsubishi, Daikin, Panasonic, Toshiba, Samsung, Midea) |
| `blocked_slots` | Admin-blocked full days (slot IS NULL) or individual slots; enforced at booking creation |

- `service_type_id` is NOT NULL on all bookings — fault repair types (e.g. "AC Not Cooling") are also rows in `service_types`
- Booking statuses: `PENDING | APPROVED | REJECTED | COMPLETED`
- Contract statuses: `ACTIVE | EXPIRED | CANCELLED`
- Invoice statuses: `UNPAID | PAID`
- `contract_pricing_tiers` format: `[{min_units, max_units: number|null, price_sgd}]` — `max_units: null` = per-unit rate

## Key flows

**Booking wizard (`/book`) — 3 steps:**
- **Step 0 (Service):** Service type selector (grouped by category). MAINTENANCE shows num_units + UnitLocationPicker (room chips from `ac_unit_locations`). FAULT_REPAIR shows fault description + urgency. INSTALLATION shows AC brand/model + num_units.
- **Step 1 (Schedule & Location):** `SlotCalendar` — month grid fetching `/api/availability`; days with full blocks are greyed out; available days show 5 slot pills per day (booked/blocked pills disabled). Address presets: Home (profile address — if available), My Location (geolocation → `/api/geocode/reverse`), Other (Google Places Autocomplete). After slot confirmed, unit/floor + building + access notes fields appear.
- **Step 2 (Review):** Summary. Submit POSTs to `/api/bookings` with `{ booking_date, time_slot, unit_location_ids[], address, ... }`. 409 = slot taken.

**Admin booking management (`/admin/bookings`) — 4 tabs:**
- **Maintenance tab (default):** Google Map with pins for pending bookings; admin visually groups clusters, selects bookings by clicking pins, picks a `confirmed_date` for the group; bulk-approves via `/api/bookings/bulk-approve`. No date-range conflict logic (single-date model).
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
- Detail page: service schedule; admin links bookings to service dates

**Invoice management (`/admin/invoices`):**
- Admin creates invoices manually; links to contract/booking optionally
- "Mark Paid" records `payment_method` + stamps `paid_at`
- List filters (client-side): name/phone search; created/paid date ranges; status pills

**Customer contracts & invoices (`/account/contracts`):**
- Server component fetches; delegates to `AccountContractsClient` for filters
- Contract status pills; invoice status pills + date-range filter

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
  - Roadmap: `C:\Users\Klot\.claude\plans\1-confirmation-suggestion-on-binary-hinton.md`
  - Sub-plan: `docs/superpowers/plans/2026-05-14-phase2-A-foundation.md`
- **Phase 2 — Subsystem B** — profile address at registration — next to implement
- **Phase 2 — Subsystem C** — admin date/slot blocking UI — next after B
- **Phase 2 — Subsystems D–G** — contracts self-signup, invoices, reminders, alternative dates — planned

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
- shadcn/ui v4 `DialogTrigger` does NOT accept `asChild` — wrap the button directly inside `<DialogTrigger>`.
- `useSearchParams` requires a `<Suspense>` boundary in Next.js 15+.
- Both `lib/supabase/client.ts` and `lib/supabase/server.ts` export `createClient`. Import as `@/lib/supabase/server` (server) or `@/lib/supabase/client` (browser).
- `BookingsMap` and `RouteMap` use `next/dynamic` with `ssr: false` (Google Maps requires browser).
- `SlotCalendar` fetches `/api/availability?month=YYYY-MM` on mount and on month navigation. The response `byDate` is keyed by date string.
- `UnitLocationPicker` fetches `ac_unit_locations` directly from Supabase browser client on mount.
- `StepScheduleLocation` loads the Google Places library via `useJsApiLoader` with `libraries: ['places']` — define the array outside the component to keep a stable reference.
- `lib/booking/slots.ts` contains pure functions for slot availability logic and contract tier pricing — import these in tests and server routes, not inline logic.
- `service_types.description` is `NOT NULL DEFAULT ''` — never send `null`; send empty string instead.
- **Turbopack + Windows:** Dynamic `[param]` route segments are not compiled at `npm run dev` startup. Touch the route file (add/remove a blank line) to force HMR. Affected routes: `api/bookings/[id]`, `admin/contracts/[id]`, `api/contracts/[id]/link-booking`, `api/invoices/[id]/pay`.
- **Custom combobox pattern:** Use `onMouseDown` + `e.preventDefault()` on dropdown items (not `onClick`) to prevent blur firing before selection.
- **Draggable resize:** `isDragging` is a `useRef<boolean>`, not state — avoids re-renders; document-level listeners in a single `useEffect`.
- **Current status:** Phase 2 Subsystems H and A complete (2026-05-14). All migrations through 016 applied to Supabase. See `docs/superpowers/NEXT-SESSION.md`.
