# Next Session — Resume Here

## Status
Phase 2 Subsystems H and A complete (2026-05-14). **All migrations through 016 applied to Supabase. Production data wiped (clean slate).**

## Completed (full history)
- **Phase 1** — booking portal, admin dashboard, VRP optimizer, email templates, API routes, cron job
- **Phase 1 Bug-fix batch** — 11 issues fixed (2026-05-07)
- **Phase 1 QA session** — 6 code bugs fixed + 2 RLS migrations (2026-05-08)
- **Phase 1B** — contracts, invoices, dashboard widgets, customer view, daily cron (2026-05-08)
- **Phase 1C** — route optimiser redesign + technician/cars removal (2026-05-08)
- **Phase 1D** — admin bookings UX improvements + contract enhancements (2026-05-08)
- **Phase 1E** — full UI modernization across all pages (2026-05-08)
- **Phase 1F** — search, filters, and bidirectional map sync (2026-05-08)
- **Phase 2 Subsystem H** — landing page copy refresh: "Hydrowash home aircon solution" tagline, stat strip, updated steps (2026-05-14)
- **Phase 2 Subsystem A** — slot model + booking calendar + AC catalog + availability API (2026-05-14)

## Phase 2 Subsystem A — what changed (2026-05-14)

### Booking model
- Replaced date-range (`earliest_date`/`latest_date`/`preferred_slot`) with single `booking_date date` + `time_slot text` (5-slot enum: `S10_12`, `S13_15`, `S15_17`, `S17_19`, `S19_21`).
- `room_type` removed from bookings entirely.
- Partial unique index `(booking_date, time_slot) WHERE status IN ('PENDING','APPROVED')` enforces 1 booking per slot.
- `SLOT_LABELS` and `SLOT_KEYS` exported from `lib/types.ts` — use everywhere, never hardcode slot strings.

### New tables (all applied to Supabase)
- `ac_unit_locations` — 7 room label seeds; admin-CRUD
- `booking_unit_locations` — join table for booking ↔ room locations
- `ac_unit_types` — 3 seeds: Wall Mounted, Ducted Unit, Cassette Unit
- `ac_brands` — 6 seeds: Mitsubishi, Daikin, Panasonic, Toshiba, Samsung, Midea
- `blocked_slots` — admin-blocked full days (slot IS NULL) or individual slots

### New columns on existing tables
- `bookings.booking_date date NOT NULL`, `bookings.time_slot text NOT NULL`
- `app_settings.paynow_mobile text`
- `app_settings.contract_pricing_tiers jsonb` (seeded with placeholder tiers)

### New / updated source files
- `lib/types.ts` — `TimeSlot`, `SLOT_LABELS`, `SLOT_KEYS`, `AcUnitLocation`, `AcUnitType`, `AcBrand`, `BlockedSlot`, `ContractPricingTier` added; `Booking` updated; `RouteStop.timeSlot` (was `preferredSlot`)
- `lib/booking/slots.ts` — pure functions: `isDayFullyBlocked`, `isSlotBlocked`, `getSlotsForDate`, `resolveContractTierPrice`
- `lib/vrp/optimizer.ts` — `VRPJob.timeSlot` (was `preferredSlot`); `DAY_START=10*60`; `SLOT_WINDOWS` + `SLOT_ORDER` keyed by `TimeSlot`
- `components/booking/BookingWizard.tsx` — 3-step wizard (Service → Schedule & Location → Review); new `BookingData` shape
- `components/booking/StepScheduleLocation.tsx` — NEW: SlotCalendar + Home/My Location/Other address presets
- `components/booking/SlotCalendar.tsx` — NEW: month grid calendar with slot pills
- `components/booking/UnitLocationPicker.tsx` — NEW: chip multi-select for room locations
- `components/booking/StepServiceDetails.tsx` — removed `room_type`; added `UnitLocationPicker` for MAINTENANCE
- `components/booking/StepReview.tsx` — shows `booking_date` + `time_slot`; removed old date range fields
- `components/booking/StepDateTime.tsx` — DELETED (replaced by StepScheduleLocation)
- `components/booking/StepAddress.tsx` — DELETED (merged into StepScheduleLocation)
- `components/admin/MaintenanceMapTab.tsx` — DELETED (was dead code)
- `components/admin/BookingCard.tsx` — shows `booking_date + SLOT_LABELS[time_slot]`
- `components/admin/BookingsMap.tsx` — InfoWindow shows `booking_date + time_slot`
- `app/admin/bookings/AdminBookingsClient.tsx` — removed date-range conflict logic; maintenance cards show slot
- `app/account/bookings/page.tsx` — shows `Date: booking_date · slot label`
- `app/admin/schedule/[date]/page.tsx` — queries `booking_date` (was `confirmed_date`)
- `app/admin/schedule/[date]/SchedulePageClient.tsx` — `SLOT_COLOR` uses new TimeSlot keys; `stop.timeSlot`
- `app/api/bookings/route.ts` — accepts `booking_date`, `time_slot`, `unit_location_ids[]`; validates slot not blocked/taken
- `app/api/bookings/bulk-approve/route.ts` — no date-range validation; all PENDING in list are approved
- `app/api/optimize/route.ts` — maps `time_slot` → `timeSlot` on VRPJob
- `app/api/availability/route.ts` — NEW: GET `?month=YYYY-MM` → booked + blocked slots per date
- `app/api/geocode/reverse/route.ts` — NEW: POST `{lat,lng}` → `{address, postalCode}`
- `app/api/admin/ac-catalog/route.ts` — NEW: GET/POST/PATCH `?kind=unit_types|brands`
- `lib/email/templates/BookingReceived.tsx` — shows `booking_date · SLOT_LABELS[time_slot]`

## Next to implement — Subsystem B (profile address at registration)
Roadmap: `C:\Users\Klot\.claude\plans\1-confirmation-suggestion-on-binary-hinton.md`

**Goal:** Capture address at registration, store on `profiles`, expose editable on `/account/settings`, gate booking on presence.

**Scope:**
- Migration: add `address text`, `address_lat float8`, `address_lng float8`, `postal_code text` to `profiles`
- `app/auth/register/page.tsx`: add Google Places Autocomplete address field
- New `app/account/settings/page.tsx`: edit profile (name, phone, address)
- `middleware.ts`: redirect customers with null address hitting `/book` to `/account/settings?reason=address`
- `StepScheduleLocation` "Home" preset reads from `profile.address` — currently hidden because `profileAddress` prop is always null; wire it up once profiles have address

## After Subsystem B — Subsystem C (admin date/slot blocking UI)
- `/admin/availability` page with month-grid calendar
- Modal per day: toggles for 5 slots + "Block entire day" + multi-day range mode
- `POST /api/availability/block`, `DELETE /api/availability/block`
- "Availability" link in `app/admin/layout.tsx`
- Customer calendar already respects blocks (SlotCalendar reads `/api/availability`)

## ⚠ Pending manual steps
None. All migrations applied. Production data wiped.

**Owner still needs to supply:**
- PayNow mobile number → update `app_settings.paynow_mobile` in Supabase
- Confirm placeholder contract pricing tiers (currently: 1–2=$400, 3–4=$600, 5=$800, 6+=$150/unit)
- Confirm initial AC unit location labels (currently seeded: Master Bedroom, Room 1–3, Living Room, Kitchen, Study Room)

## Key gotchas (accumulated)

### Phase 2 / slot model
- `SLOT_LABELS` and `SLOT_KEYS` are in `lib/types.ts` — always import, never hardcode slot keys or labels
- `SlotCalendar` needs the `libraries: ['places']` array defined **outside** the component — same stable-ref rule as `StepAddress` had
- `UnitLocationPicker` fetches directly from Supabase browser client; RLS `SELECT USING (true)` allows all authenticated users to read `ac_unit_locations`
- `/api/availability` is unauthenticated (reads from server Supabase client) — fine, slot availability is public info
- Slot uniqueness: the partial index allows REJECTED/COMPLETED bookings on the same (date, slot) — only PENDING + APPROVED count
- `app_settings.contract_pricing_tiers` format: `[{min_units, max_units: number|null, price_sgd}]` — `max_units: null` means per-unit rate (`price_sgd × unitCount`). Use `resolveContractTierPrice` from `lib/booking/slots.ts`

### General (carried forward)
- **Never hardcode hex colors** — tokens only
- **Icons — `lucide-react` only**
- shadcn v4 `onValueChange` → `(value: string | null, event: Event) => void` — use `?? ''`
- shadcn v4 `SelectValue` does NOT auto-resolve label — provide children explicitly
- shadcn v4 `DialogTrigger` does NOT accept `asChild`
- `useSearchParams` requires `<Suspense>` in Next.js 15+
- Jest: `setupFilesAfterEnv`; VRP tests need `/** @jest-environment node */`
- `service_type_id` is NOT NULL — fault repair types are rows in `service_types`
- `service_types.description` is `NOT NULL DEFAULT ''` — send `''` not `null`
- Both supabase client files export `createClient`
- Turbopack + Windows: touch dynamic route files after `npm run dev` to force HMR
- Custom combobox: `onMouseDown` + `e.preventDefault()` on dropdown items
- `isDragging` in admin sidebar is a `useRef<boolean>` — not state
- Admin contracts/invoices: always fetch all, filter client-side — do NOT add `?status=` param back
- `AccountContractsClient` at `app/account/AccountContractsClient.tsx` — server page is just a data fetcher
