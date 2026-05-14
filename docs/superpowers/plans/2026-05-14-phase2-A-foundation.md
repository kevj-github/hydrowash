# Phase 2-A: Foundation — Slot Model + Booking Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the date-range booking model with a single-date + fixed-slot model end-to-end. Customers see a month-grid calendar and pick one of 5 time slots; admins see single-date bookings. AC unit locations become an admin-managed list used as a multi-select per booking.

**Architecture:** New Supabase migrations wipe & replace `bookings` columns; four new tables (`ac_unit_locations`, `booking_unit_locations`, `ac_unit_types`, `ac_brands`); a new `GET /api/availability` endpoint; a rewritten booking wizard (3 steps: Service → Schedule+Location → Review); updated admin booking views; admin CRUD for room labels, unit types, and brands. All pure functions (slot validation, availability check) get Jest unit tests.

**Amendment (2026-05-14):** Added `ac_unit_types` (Wall Mounted, Ducted Unit, Cassette Unit) and `ac_brands` (Mitsubishi, Daikin, Panasonic, Toshiba, Samsung, Midea) — admin-CRUD lists used by the invoice finalization form in Subsystem E. Tables seeded here; admin CRUD sections added to settings page.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase Postgres + RLS, Google Maps JS API (Places Autocomplete, Geocoding), Tailwind CSS, shadcn/ui, Lucide React.

---

## Slot enum (canonical — used in every task below)

```
S10_12  →  10:00–12:00
S13_15  →  13:00–15:00
S15_17  →  15:00–17:00
S17_19  →  17:00–19:00
S19_21  →  19:00–21:00
```

Display labels (used in UI):
```typescript
export const SLOT_LABELS: Record<string, string> = {
  S10_12: '10:00 – 12:00',
  S13_15: '13:00 – 15:00',
  S15_17: '15:00 – 17:00',
  S17_19: '17:00 – 19:00',
  S19_21: '19:00 – 21:00',
}
export const SLOT_KEYS = Object.keys(SLOT_LABELS) as TimeSlot[]
```

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install all Phase 2 dependencies at once**

Run:
```
npm i @react-pdf/renderer paynowqr qrcode
npm i -D @types/qrcode
```

Expected output: packages added to `node_modules` with no peer-dep errors.

- [ ] **Step 2: Verify TypeScript can see qrcode types**

Create a temporary file `lib/paynow/.gitkeep` (just to create the directory):
```
mkdir -p lib/paynow
```
Then run:
```
npm run build 2>&1 | head -20
```
Expected: no `Cannot find module 'qrcode'` errors (build will fail on other missing things later — that's fine).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install Phase 2 dependencies (@react-pdf/renderer, paynowqr, qrcode)"
```

---

## Task 2: Schema — wipe data + migrations

**Files:**
- Create: `supabase/migrations/010_phase2_slot_model.sql`
- Create: `supabase/migrations/011_phase2_ac_locations.sql`
- Create: `supabase/migrations/012_phase2_app_settings.sql`
- Create: `supabase/migrations/013_phase2_blocked_slots.sql`
- Create: `supabase/migrations/016_phase2_rls.sql`

> **Before running migrations:** Execute the following one-time wipe in Supabase SQL editor (NOT in a migration file — run manually once):
> ```sql
> -- WIPE: run once in Supabase SQL editor before applying Phase 2 migrations
> TRUNCATE TABLE bookings, contracts, contract_service_dates, invoices CASCADE;
> ```

- [ ] **Step 1: Create `010_phase2_slot_model.sql`**

```sql
-- 010_phase2_slot_model.sql
-- Replaces date-range booking model with single-date + fixed-slot

-- Remove old date-range and slot columns
ALTER TABLE bookings
  DROP COLUMN IF EXISTS earliest_date,
  DROP COLUMN IF EXISTS latest_date,
  DROP COLUMN IF EXISTS preferred_slot,
  DROP COLUMN IF EXISTS room_type;

-- Add new slot columns
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booking_date date,
  ADD COLUMN IF NOT EXISTS time_slot text
    CHECK (time_slot IN ('S10_12','S13_15','S15_17','S17_19','S19_21'));

-- Enforce NOT NULL after wipe
ALTER TABLE bookings ALTER COLUMN booking_date SET NOT NULL;
ALTER TABLE bookings ALTER COLUMN time_slot SET NOT NULL;

-- Partial unique index: one booking per slot among PENDING + APPROVED only
-- (COMPLETED/REJECTED free up the slot for re-booking)
CREATE UNIQUE INDEX IF NOT EXISTS bookings_date_slot_unique
  ON bookings (booking_date, time_slot)
  WHERE status IN ('PENDING', 'APPROVED');
```

- [ ] **Step 2: Create `011_phase2_ac_locations.sql`**

```sql
-- 011_phase2_ac_locations.sql
-- AC unit location list (admin-managed) + per-booking locations

CREATE TABLE IF NOT EXISTS ac_unit_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking_unit_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES ac_unit_locations(id) ON DELETE RESTRICT,
  UNIQUE (booking_id, location_id)
);

-- Seed default room labels
INSERT INTO ac_unit_locations (label, display_order) VALUES
  ('Master Bedroom', 1),
  ('Room 1', 2),
  ('Room 2', 3),
  ('Room 3', 4),
  ('Living Room', 5),
  ('Kitchen', 6),
  ('Study Room', 7)
ON CONFLICT (label) DO NOTHING;
```

- [ ] **Step 3: Create `012_phase2_app_settings.sql`**

```sql
-- 012_phase2_app_settings.sql
-- New columns on the singleton app_settings row

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS paynow_mobile text,
  ADD COLUMN IF NOT EXISTS contract_pricing_tiers jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Seed placeholder tiers (admin updates via settings UI)
-- Format: [{min_units, max_units (null = unlimited), price_sgd}]
UPDATE app_settings SET contract_pricing_tiers = '[
  {"min_units": 1, "max_units": 2, "price_sgd": 400},
  {"min_units": 3, "max_units": 4, "price_sgd": 600},
  {"min_units": 5, "max_units": 5, "price_sgd": 800},
  {"min_units": 6, "max_units": null, "price_sgd": 150}
]'::jsonb
WHERE id = 1;
```

- [ ] **Step 4: Create `013_phase2_blocked_slots.sql`**

```sql
-- 013_phase2_blocked_slots.sql
-- Admin can block full days or individual time slots

CREATE TABLE IF NOT EXISTS blocked_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocked_date date NOT NULL,
  slot text CHECK (slot IN ('S10_12','S13_15','S15_17','S17_19','S19_21')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocked_date, slot)  -- slot IS NULL = full-day block (unique per date)
);

-- Partial unique index for full-day blocks (NULL != NULL in standard SQL, need explicit)
CREATE UNIQUE INDEX IF NOT EXISTS blocked_slots_full_day
  ON blocked_slots (blocked_date)
  WHERE slot IS NULL;
```

- [ ] **Step 5: Create `016_phase2_rls.sql`**

```sql
-- 016_phase2_rls.sql
-- RLS for all Phase 2 new tables

-- ac_unit_locations: everyone can read, only admin can write
ALTER TABLE ac_unit_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ac_locations_read_all" ON ac_unit_locations
  FOR SELECT USING (true);
CREATE POLICY "ac_locations_admin_write" ON ac_unit_locations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- booking_unit_locations: customer sees own, admin sees all
ALTER TABLE booking_unit_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "booking_locations_customer" ON booking_unit_locations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM bookings WHERE id = booking_id AND customer_id = auth.uid())
  );
CREATE POLICY "booking_locations_admin" ON booking_unit_locations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "booking_locations_insert_own" ON booking_unit_locations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM bookings WHERE id = booking_id AND customer_id = auth.uid())
  );

-- blocked_slots: everyone reads (needed by availability API), only admin writes
ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocked_slots_read_all" ON blocked_slots
  FOR SELECT USING (true);
CREATE POLICY "blocked_slots_admin_write" ON blocked_slots
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

- [ ] **Step 6: Apply migrations to Supabase**

In Supabase SQL editor, run each migration file in order (010 → 011 → 012 → 013 → 016). Verify in Table Editor:
- `bookings` has `booking_date` and `time_slot` columns; `earliest_date`, `latest_date`, `preferred_slot`, `room_type` are gone.
- `ac_unit_locations` exists with 7 seed rows.
- `booking_unit_locations` exists (empty).
- `blocked_slots` exists (empty).
- `app_settings` row has `contract_pricing_tiers` JSONB set.

- [ ] **Step 7: Commit migrations**

```bash
git add supabase/migrations/
git commit -m "feat: Phase 2-A migrations — slot model, AC locations, blocked slots"
```

---

## Task 3: TypeScript types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add new types to `lib/types.ts`**

Open `lib/types.ts` and append:

```typescript
// ── Phase 2 types ────────────────────────────────────────────────────

export type TimeSlot = 'S10_12' | 'S13_15' | 'S15_17' | 'S17_19' | 'S19_21'

export const SLOT_LABELS: Record<TimeSlot, string> = {
  S10_12: '10:00 – 12:00',
  S13_15: '13:00 – 15:00',
  S15_17: '15:00 – 17:00',
  S17_19: '17:00 – 19:00',
  S19_21: '19:00 – 21:00',
}

export const SLOT_KEYS = Object.keys(SLOT_LABELS) as TimeSlot[]

export interface AcUnitLocation {
  id: string
  label: string
  display_order: number
  is_active: boolean
}

export interface BlockedSlot {
  id: string
  blocked_date: string      // ISO date YYYY-MM-DD
  slot: TimeSlot | null     // null = full-day block
  reason: string | null
}

export interface ContractPricingTier {
  min_units: number
  max_units: number | null  // null = unlimited
  price_sgd: number
}
```

- [ ] **Step 2: Confirm no TS errors**

```
npm run build 2>&1 | grep "lib/types"
```
Expected: no errors on this file.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: Phase 2-A — add slot, location, and blocked-slot TypeScript types"
```

---

## Task 4: Unit tests for slot validation logic

**Files:**
- Create: `lib/booking/__tests__/slots.test.ts`
- Create: `lib/booking/slots.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/booking/__tests__/slots.test.ts`:

```typescript
/** @jest-environment node */
import {
  isSlotBlocked,
  isDayFullyBlocked,
  getSlotsForDate,
  resolveContractTierPrice,
} from '../slots'
import type { BlockedSlot, ContractPricingTier, TimeSlot } from '@/lib/types'

describe('isSlotBlocked', () => {
  const blocks: BlockedSlot[] = [
    { id: '1', blocked_date: '2026-08-15', slot: null, reason: null },   // full-day
    { id: '2', blocked_date: '2026-08-20', slot: 'S19_21', reason: null }, // slot-only
  ]

  it('returns true for a full-day blocked date', () => {
    expect(isSlotBlocked('2026-08-15', 'S10_12', blocks)).toBe(true)
    expect(isSlotBlocked('2026-08-15', 'S19_21', blocks)).toBe(true)
  })

  it('returns true for a specifically blocked slot', () => {
    expect(isSlotBlocked('2026-08-20', 'S19_21', blocks)).toBe(true)
  })

  it('returns false for unblocked slot on a partially blocked day', () => {
    expect(isSlotBlocked('2026-08-20', 'S10_12', blocks)).toBe(false)
  })

  it('returns false for an unblocked date entirely', () => {
    expect(isSlotBlocked('2026-09-01', 'S10_12', blocks)).toBe(false)
  })
})

describe('isDayFullyBlocked', () => {
  const blocks: BlockedSlot[] = [
    { id: '1', blocked_date: '2026-08-15', slot: null, reason: null },
    { id: '2', blocked_date: '2026-08-20', slot: 'S19_21', reason: null },
  ]

  it('returns true for full-day block', () => {
    expect(isDayFullyBlocked('2026-08-15', blocks)).toBe(true)
  })

  it('returns false for partial block', () => {
    expect(isDayFullyBlocked('2026-08-20', blocks)).toBe(false)
  })

  it('returns false for unblocked date', () => {
    expect(isDayFullyBlocked('2026-09-01', blocks)).toBe(false)
  })
})

describe('getSlotsForDate', () => {
  const blocks: BlockedSlot[] = [
    { id: '2', blocked_date: '2026-08-20', slot: 'S19_21', reason: null },
  ]
  const bookedSlots: TimeSlot[] = ['S10_12']

  it('returns all slots minus blocked and booked', () => {
    const result = getSlotsForDate('2026-08-20', blocks, bookedSlots)
    expect(result).toEqual([
      { slot: 'S10_12', available: false },
      { slot: 'S13_15', available: true },
      { slot: 'S15_17', available: true },
      { slot: 'S17_19', available: true },
      { slot: 'S19_21', available: false },
    ])
  })

  it('returns all unavailable for fully blocked day', () => {
    const fullBlock: BlockedSlot[] = [
      { id: '1', blocked_date: '2026-08-15', slot: null, reason: null },
    ]
    const result = getSlotsForDate('2026-08-15', fullBlock, [])
    expect(result.every(s => !s.available)).toBe(true)
  })
})

describe('resolveContractTierPrice', () => {
  const tiers: ContractPricingTier[] = [
    { min_units: 1, max_units: 2, price_sgd: 400 },
    { min_units: 3, max_units: 4, price_sgd: 600 },
    { min_units: 5, max_units: 5, price_sgd: 800 },
    { min_units: 6, max_units: null, price_sgd: 150 },
  ]

  it('resolves flat-rate tiers correctly', () => {
    expect(resolveContractTierPrice(1, tiers)).toBe(400)
    expect(resolveContractTierPrice(2, tiers)).toBe(400)
    expect(resolveContractTierPrice(3, tiers)).toBe(600)
    expect(resolveContractTierPrice(5, tiers)).toBe(800)
  })

  it('resolves per-unit open-ended tier (6+ = 150/unit)', () => {
    expect(resolveContractTierPrice(6, tiers)).toBe(900)  // 6 × 150
    expect(resolveContractTierPrice(10, tiers)).toBe(1500) // 10 × 150
  })

  it('returns null when no tier matches', () => {
    expect(resolveContractTierPrice(0, tiers)).toBeNull()
    expect(resolveContractTierPrice(1, [])).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```
npx jest slots --no-coverage
```
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/booking/slots.ts`**

Create `lib/booking/slots.ts`:

```typescript
import type { BlockedSlot, ContractPricingTier, TimeSlot } from '@/lib/types'
import { SLOT_KEYS } from '@/lib/types'

export function isDayFullyBlocked(date: string, blocks: BlockedSlot[]): boolean {
  return blocks.some(b => b.blocked_date === date && b.slot === null)
}

export function isSlotBlocked(date: string, slot: TimeSlot, blocks: BlockedSlot[]): boolean {
  if (isDayFullyBlocked(date, blocks)) return true
  return blocks.some(b => b.blocked_date === date && b.slot === slot)
}

export function getSlotsForDate(
  date: string,
  blocks: BlockedSlot[],
  bookedSlots: TimeSlot[],
): { slot: TimeSlot; available: boolean }[] {
  return SLOT_KEYS.map(slot => ({
    slot,
    available: !isSlotBlocked(date, slot, blocks) && !bookedSlots.includes(slot),
  }))
}

export function resolveContractTierPrice(
  unitCount: number,
  tiers: ContractPricingTier[],
): number | null {
  if (unitCount <= 0 || tiers.length === 0) return null
  const tier = tiers.find(t => unitCount >= t.min_units && (t.max_units === null || unitCount <= t.max_units))
  if (!tier) return null
  // Open-ended tier (max_units null) = per-unit rate
  return tier.max_units === null ? tier.price_sgd * unitCount : tier.price_sgd
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```
npx jest slots --no-coverage
```
Expected: PASS (4 describe blocks, all green).

- [ ] **Step 5: Commit**

```bash
git add lib/booking/slots.ts lib/booking/__tests__/slots.test.ts
git commit -m "feat: Phase 2-A — slot validation and tier pricing pure functions with tests"
```

---

## Task 5: Availability API

**Files:**
- Create: `app/api/availability/route.ts`
- Create: `app/api/geocode/reverse/route.ts`

- [ ] **Step 1: Create `app/api/availability/route.ts`**

```typescript
// app/api/availability/route.ts
// GET /api/availability?month=YYYY-MM
// Returns booked slots and blocked slots for the given month.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TimeSlot } from '@/lib/types'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') // YYYY-MM
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 })
  }

  const supabase = await createClient()
  const startDate = `${month}-01`
  const [year, mon] = month.split('-').map(Number)
  const nextMonth = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`

  const [{ data: bookings }, { data: blocks }] = await Promise.all([
    supabase
      .from('bookings')
      .select('booking_date, time_slot')
      .gte('booking_date', startDate)
      .lt('booking_date', nextMonth)
      .in('status', ['PENDING', 'APPROVED']),
    supabase
      .from('blocked_slots')
      .select('blocked_date, slot')
      .gte('blocked_date', startDate)
      .lt('blocked_date', nextMonth),
  ])

  // Shape: { [date: string]: { booked: TimeSlot[], blockedSlots: (TimeSlot|null)[] } }
  const byDate: Record<string, { booked: TimeSlot[]; blockedSlots: (TimeSlot | null)[] }> = {}

  for (const b of bookings ?? []) {
    if (!byDate[b.booking_date]) byDate[b.booking_date] = { booked: [], blockedSlots: [] }
    byDate[b.booking_date].booked.push(b.time_slot as TimeSlot)
  }

  for (const bl of blocks ?? []) {
    if (!byDate[bl.blocked_date]) byDate[bl.blocked_date] = { booked: [], blockedSlots: [] }
    byDate[bl.blocked_date].blockedSlots.push(bl.slot as TimeSlot | null)
  }

  return NextResponse.json({ month, byDate })
}
```

- [ ] **Step 2: Create `app/api/geocode/reverse/route.ts`**

```typescript
// app/api/geocode/reverse/route.ts
// POST { lat, lng } → { address, postalCode }

import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { lat, lng } = await req.json()
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&region=sg`
  const res = await fetch(url)
  const data = await res.json()

  if (data.status !== 'OK' || !data.results?.length) {
    return NextResponse.json({ error: 'Could not reverse geocode location' }, { status: 422 })
  }

  const result = data.results[0]
  const address = result.formatted_address as string
  const postalComp = result.address_components?.find((c: { types: string[] }) =>
    c.types.includes('postal_code'),
  )
  const postalCode = postalComp?.long_name ?? ''

  return NextResponse.json({ address, postalCode })
}
```

- [ ] **Step 3: Smoke-test availability API**

Start the dev server (`npm run dev`), then visit:
```
http://localhost:3000/api/availability?month=2026-08
```
Expected: JSON `{ month: "2026-08", byDate: {} }` (empty since no bookings yet).

- [ ] **Step 4: Commit**

```bash
git add app/api/availability/route.ts app/api/geocode/reverse/route.ts
git commit -m "feat: Phase 2-A — availability and reverse-geocode API routes"
```

---

## Task 6: Update POST /api/bookings

**Files:**
- Modify: `app/api/bookings/route.ts`

The booking API must now accept `booking_date`, `time_slot`, and `unit_location_ids[]` instead of `earliest_date`/`latest_date`/`preferred_slot`/`room_type`. It must:
1. Validate slot not blocked (check `blocked_slots`).
2. Validate slot not already taken by a PENDING/APPROVED booking (the partial unique index will also enforce this at DB level, but return a 409 early).
3. Insert into `bookings`.
4. Insert rows into `booking_unit_locations`.

- [ ] **Step 1: Replace `app/api/bookings/route.ts` POST handler**

```typescript
// app/api/bookings/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { geocodeAddress } from '@/lib/maps/geocode'
import { isSlotBlocked } from '@/lib/booking/slots'
import type { BlockedSlot, TimeSlot } from '@/lib/types'

const VALID_SLOTS: TimeSlot[] = ['S10_12', 'S13_15', 'S15_17', 'S17_19', 'S19_21']

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const {
    service_type_id,
    booking_date,
    time_slot,
    unit_location_ids = [],
    address,
    postal_code = '',
    lat,
    lng,
    num_units,
    fault_description,
    urgency,
    ac_brand,
    ac_model,
    notes,
    media_urls = [],
  } = body

  // Basic validation
  if (!service_type_id || !booking_date || !VALID_SLOTS.includes(time_slot)) {
    return NextResponse.json(
      { error: 'service_type_id, booking_date, and a valid time_slot are required' },
      { status: 400 },
    )
  }
  if (!address) return NextResponse.json({ error: 'address is required' }, { status: 400 })

  // Resolve lat/lng if missing
  let resolvedLat = lat
  let resolvedLng = lng
  if (!resolvedLat || !resolvedLng) {
    const geo = await geocodeAddress(address)
    if (!geo) return NextResponse.json({ error: 'Could not geocode address' }, { status: 422 })
    resolvedLat = geo.lat
    resolvedLng = geo.lng
  }

  // Check blocked_slots
  const { data: rawBlocks } = await supabase
    .from('blocked_slots')
    .select('id, blocked_date, slot, reason')
    .eq('blocked_date', booking_date)
  const blocks = (rawBlocks ?? []) as BlockedSlot[]
  if (isSlotBlocked(booking_date, time_slot as TimeSlot, blocks)) {
    return NextResponse.json({ error: 'This slot is not available' }, { status: 409 })
  }

  // Check existing PENDING/APPROVED booking on same slot
  const { data: existing } = await supabase
    .from('bookings')
    .select('id')
    .eq('booking_date', booking_date)
    .eq('time_slot', time_slot)
    .in('status', ['PENDING', 'APPROVED'])
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'This slot is already booked' }, { status: 409 })
  }

  // Fetch service_type for category
  const { data: serviceType } = await supabase
    .from('service_types')
    .select('category')
    .eq('id', service_type_id)
    .single()
  if (!serviceType) return NextResponse.json({ error: 'Invalid service type' }, { status: 400 })

  // Insert booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      customer_id: user.id,
      category: serviceType.category,
      service_type_id,
      booking_date,
      time_slot,
      address,
      postal_code,
      lat: resolvedLat,
      lng: resolvedLng,
      num_units: num_units ?? null,
      fault_description: fault_description ?? null,
      urgency: urgency ?? null,
      ac_brand: ac_brand ?? null,
      ac_model: ac_model ?? null,
      notes: notes ?? null,
      media_urls,
      status: 'PENDING',
    })
    .select('id')
    .single()

  if (bookingError) {
    // Unique constraint on (booking_date, time_slot) for PENDING/APPROVED caught at DB level
    if (bookingError.code === '23505') {
      return NextResponse.json({ error: 'This slot is already booked' }, { status: 409 })
    }
    console.error('Booking insert error:', bookingError)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }

  // Insert unit locations
  if (unit_location_ids.length > 0) {
    const locationRows = unit_location_ids.map((location_id: string) => ({
      booking_id: booking.id,
      location_id,
    }))
    const { error: locError } = await supabase.from('booking_unit_locations').insert(locationRows)
    if (locError) {
      console.error('Location insert error:', locError)
      // Don't fail the booking; log and continue
    }
  }

  return NextResponse.json({ id: booking.id }, { status: 201 })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/bookings/route.ts
git commit -m "feat: Phase 2-A — rewrite booking API for slot model + unit locations"
```

---

## Task 7: New booking wizard components

### 7a: SlotCalendar component

**Files:**
- Create: `components/booking/SlotCalendar.tsx`

- [ ] **Step 1: Create `components/booking/SlotCalendar.tsx`**

```typescript
'use client'
// SlotCalendar: month-grid calendar; fetches availability; shows slot pills on date selection.
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SLOT_LABELS, SLOT_KEYS, type TimeSlot } from '@/lib/types'
import { getSlotsForDate } from '@/lib/booking/slots'
import type { BlockedSlot } from '@/lib/types'

interface AvailabilityData {
  booked: TimeSlot[]
  blockedSlots: (TimeSlot | null)[]
}

interface Props {
  selectedDate: string | null
  selectedSlot: TimeSlot | null
  onSelect: (date: string, slot: TimeSlot) => void
}

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay() // 0=Sun
}

export default function SlotCalendar({ selectedDate, selectedSlot, onSelect }: Props) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1)
  const [availability, setAvailability] = useState<Record<string, AvailabilityData>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const month = `${viewYear}-${String(viewMonth).padStart(2, '0')}`
    setLoading(true)
    fetch(`/api/availability?month=${month}`)
      .then(r => r.json())
      .then(d => setAvailability(d.byDate ?? {}))
      .finally(() => setLoading(false))
  }, [viewYear, viewMonth])

  function prevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1) }
    else setViewMonth(m => m + 1)
  }

  const totalDays = daysInMonth(viewYear, viewMonth)
  const startDay = firstDayOfMonth(viewYear, viewMonth)
  const todayStr = isoDate(today.getFullYear(), today.getMonth() + 1, today.getDate())
  const monthStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}`

  const monthLabel = new Date(viewYear, viewMonth - 1, 1).toLocaleString('en-SG', {
    month: 'long', year: 'numeric',
  })

  // Slot pills for selected date
  const selData = selectedDate ? availability[selectedDate] : null
  const blocks: BlockedSlot[] = selData
    ? selData.blockedSlots.map((slot, i) => ({ id: String(i), blocked_date: selectedDate!, slot, reason: null }))
    : []
  const slotStatus = selectedDate
    ? getSlotsForDate(selectedDate, blocks, selData?.booked ?? [])
    : []

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="font-semibold text-primary">{monthLabel}</span>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 text-xs font-medium text-muted-foreground text-center">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d}>{d}</div>)}
      </div>

      {/* Day cells */}
      <div className={`grid grid-cols-7 gap-1 ${loading ? 'opacity-50' : ''}`}>
        {Array.from({ length: startDay }).map((_, i) => <div key={`empty-${i}`} />)}
        {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => {
          const dateStr = isoDate(viewYear, viewMonth, day)
          const isPast = dateStr < todayStr
          const data = availability[dateStr]
          // Fully blocked: has a null-slot entry
          const isFullBlocked = data?.blockedSlots?.includes(null)
          const isSelected = selectedDate === dateStr
          const allBooked = !isFullBlocked && data
            ? SLOT_KEYS.every(s => data.booked.includes(s) || data.blockedSlots.includes(s))
            : false
          const unavailable = isPast || isFullBlocked || allBooked

          return (
            <button
              key={dateStr}
              disabled={unavailable}
              onClick={() => { if (!unavailable && !isSelected) onSelect(dateStr, null as any) }}
              className={[
                'aspect-square rounded-lg text-sm font-medium transition-all',
                isSelected ? 'bg-accent text-white' : '',
                !isSelected && !unavailable ? 'hover:bg-muted text-primary' : '',
                unavailable ? 'text-muted-foreground/40 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {day}
            </button>
          )
        })}
      </div>

      {/* Slot pills */}
      {selectedDate && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Select a time slot for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'short' })}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {slotStatus.map(({ slot, available }) => (
              <button
                key={slot}
                disabled={!available}
                onClick={() => available && onSelect(selectedDate, slot)}
                className={[
                  'py-2.5 px-3 rounded-xl border text-sm font-medium transition-all',
                  selectedSlot === slot
                    ? 'bg-accent text-white border-accent'
                    : available
                      ? 'border-border hover:border-accent hover:text-accent cursor-pointer'
                      : 'border-border text-muted-foreground/40 bg-muted/50 cursor-not-allowed',
                ].join(' ')}
              >
                {SLOT_LABELS[slot]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/booking/SlotCalendar.tsx
git commit -m "feat: Phase 2-A — SlotCalendar month-grid with availability and slot pills"
```

### 7b: UnitLocationPicker component

**Files:**
- Create: `components/booking/UnitLocationPicker.tsx`

- [ ] **Step 3: Create `components/booking/UnitLocationPicker.tsx`**

```typescript
'use client'
import type { AcUnitLocation } from '@/lib/types'

interface Props {
  locations: AcUnitLocation[]
  selected: string[]
  onChange: (ids: string[]) => void
}

export default function UnitLocationPicker({ locations, selected, onChange }: Props) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  return (
    <div className="flex flex-wrap gap-2">
      {locations.filter(l => l.is_active).map(loc => {
        const isSelected = selected.includes(loc.id)
        return (
          <button
            key={loc.id}
            type="button"
            onClick={() => toggle(loc.id)}
            className={[
              'px-3 py-1.5 rounded-full border text-sm font-medium transition-all',
              isSelected
                ? 'bg-accent text-white border-accent'
                : 'border-border text-primary hover:border-accent hover:text-accent',
            ].join(' ')}
          >
            {loc.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/booking/UnitLocationPicker.tsx
git commit -m "feat: Phase 2-A — UnitLocationPicker chip multi-select"
```

### 7c: StepScheduleLocation (replaces StepDateTime + StepAddress)

**Files:**
- Create: `components/booking/StepScheduleLocation.tsx`
- Delete: `components/booking/StepDateTime.tsx`
- Delete: `components/booking/StepAddress.tsx`

- [ ] **Step 5: Create `components/booking/StepScheduleLocation.tsx`**

```typescript
'use client'
// Unified Schedule + Location step. Replaces StepDateTime and StepAddress.
import { useState, useRef, useEffect } from 'react'
import { MapPin, Home, Locate } from 'lucide-react'
import SlotCalendar from './SlotCalendar'
import type { TimeSlot } from '@/lib/types'

interface LocationData {
  address: string
  postalCode: string
  lat: number | null
  lng: number | null
  unitFloor: string
  notes: string
}

interface Props {
  bookingDate: string | null
  timeSlot: TimeSlot | null
  locationData: LocationData
  profileAddress: string | null   // from user profile (Home preset)
  onScheduleChange: (date: string, slot: TimeSlot) => void
  onLocationChange: (loc: LocationData) => void
}

type Preset = 'home' | 'geolocate' | 'map'

declare global {
  interface Window { google: typeof google; initAutocomplete?: () => void }
}

export default function StepScheduleLocation({
  bookingDate,
  timeSlot,
  locationData,
  profileAddress,
  onScheduleChange,
  onLocationChange,
}: Props) {
  const [preset, setPreset] = useState<Preset | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const autocompleteRef = useRef<HTMLInputElement>(null)
  const autocompleteInstanceRef = useRef<google.maps.places.Autocomplete | null>(null)

  useEffect(() => {
    if (preset !== 'map') return
    if (!window.google?.maps?.places) return
    const ac = new window.google.maps.places.Autocomplete(autocompleteRef.current!, {
      componentRestrictions: { country: 'sg' },
      fields: ['formatted_address', 'geometry', 'address_components'],
    })
    autocompleteInstanceRef.current = ac
    ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      if (!place?.geometry?.location) return
      const postalComp = place.address_components?.find(c => c.types.includes('postal_code'))
      onLocationChange({
        ...locationData,
        address: place.formatted_address ?? '',
        postalCode: postalComp?.long_name ?? '',
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      })
    })
    return () => google.maps.event.clearInstanceListeners(ac)
  }, [preset])

  function applyHomePreset() {
    if (!profileAddress) return
    setPreset('home')
    onLocationChange({
      ...locationData,
      address: profileAddress,
      postalCode: '',
      lat: null,
      lng: null,
    })
  }

  async function applyGeolocatePreset() {
    setGeoLoading(true)
    setPreset('geolocate')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        const res = await fetch('/api/geocode/reverse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng }),
        })
        const data = await res.json()
        onLocationChange({ ...locationData, address: data.address ?? '', postalCode: data.postalCode ?? '', lat, lng })
        setGeoLoading(false)
      },
      () => { setGeoLoading(false); setPreset('map') },
    )
  }

  return (
    <div className="space-y-8">
      {/* Schedule */}
      <div>
        <h3 className="font-semibold text-primary mb-4">Select date &amp; time</h3>
        <SlotCalendar
          selectedDate={bookingDate}
          selectedSlot={timeSlot}
          onSelect={(date, slot) => { if (slot) onScheduleChange(date, slot) }}
        />
      </div>

      {/* Location */}
      <div>
        <h3 className="font-semibold text-primary mb-3">Service location</h3>

        {/* Preset chips */}
        <div className="flex gap-2 flex-wrap mb-4">
          <button
            type="button"
            onClick={applyHomePreset}
            disabled={!profileAddress}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${preset === 'home' ? 'bg-accent text-white border-accent' : 'border-border hover:border-accent hover:text-accent'} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <Home size={14} /> Home
          </button>
          <button
            type="button"
            onClick={applyGeolocatePreset}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${preset === 'geolocate' ? 'bg-accent text-white border-accent' : 'border-border hover:border-accent hover:text-accent'}`}
          >
            <Locate size={14} /> {geoLoading ? 'Locating…' : 'My location'}
          </button>
          <button
            type="button"
            onClick={() => { setPreset('map'); onLocationChange({ ...locationData, address: '', postalCode: '', lat: null, lng: null }) }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${preset === 'map' ? 'bg-accent text-white border-accent' : 'border-border hover:border-accent hover:text-accent'}`}
          >
            <MapPin size={14} /> Other address
          </button>
        </div>

        {/* Address display / input */}
        {(preset === 'home' || preset === 'geolocate') && locationData.address && (
          <p className="text-sm text-primary bg-muted rounded-xl px-4 py-3 mb-3">{locationData.address}</p>
        )}
        {preset === 'map' && (
          <input
            ref={autocompleteRef}
            type="text"
            placeholder="Start typing your address…"
            className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent mb-3"
            defaultValue={locationData.address}
          />
        )}

        {/* Unit/Floor and notes always shown once preset selected */}
        {preset && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Unit / Floor (e.g. #05-12)"
              value={locationData.unitFloor}
              onChange={e => onLocationChange({ ...locationData, unitFloor: e.target.value })}
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <input
              type="text"
              placeholder="Access notes (gate code, intercom…)"
              value={locationData.notes}
              onChange={e => onLocationChange({ ...locationData, notes: e.target.value })}
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Delete the old step files**

```bash
git rm components/booking/StepDateTime.tsx components/booking/StepAddress.tsx
```

- [ ] **Step 7: Commit**

```bash
git add components/booking/StepScheduleLocation.tsx
git commit -m "feat: Phase 2-A — unified StepScheduleLocation replaces StepDateTime + StepAddress"
```

---

## Task 8: Rewrite BookingWizard

**Files:**
- Modify: `components/booking/BookingWizard.tsx`
- Modify: `components/booking/StepServiceDetails.tsx`
- Modify: `components/booking/StepReview.tsx`
- Modify: `app/(public)/book/page.tsx`

- [ ] **Step 1: Update `BookingWizard.tsx` state and steps**

The wizard collapses from 4 to 3 steps: `0=Service | 1=Schedule+Location | 2=Review`.

Key state changes:
- Remove `earliestDate`, `latestDate`, `preferredSlot`, `roomType`.
- Add `bookingDate: string | null`, `timeSlot: TimeSlot | null`.
- Add `unitLocationIds: string[]`.
- Add `locationData: { address, postalCode, lat, lng, unitFloor, notes }`.

Step 1 completion guard: `bookingDate && timeSlot && locationData.address`.

When submitting, POST body becomes:
```typescript
{
  service_type_id: data.serviceTypeId,
  booking_date: data.bookingDate,
  time_slot: data.timeSlot,
  unit_location_ids: data.unitLocationIds,
  address: [data.locationData.address, data.locationData.unitFloor].filter(Boolean).join(', '),
  postal_code: data.locationData.postalCode,
  lat: data.locationData.lat,
  lng: data.locationData.lng,
  num_units: data.numUnits,
  fault_description: data.faultDescription,
  urgency: data.urgency,
  notes: data.locationData.notes,
  media_urls: data.mediaUrls,
}
```

Pass `profileAddress` (from `app/(public)/book/page.tsx`) into `StepScheduleLocation`.

The step labels array becomes:
```typescript
const STEPS = ['Service details', 'Schedule & location', 'Review']
```

- [ ] **Step 2: Update `app/(public)/book/page.tsx` to fetch `ac_unit_locations` and profile address**

```typescript
// Near top of the file, fetch both service types and locations:
const [{ data: serviceTypes }, { data: acLocations }, { data: profile }] = await Promise.all([
  supabase.from('service_types').select('*').eq('is_active', true).order('category'),
  supabase.from('ac_unit_locations').select('*').eq('is_active', true).order('display_order'),
  user ? supabase.from('profiles').select('address').eq('id', user.id).single() : Promise.resolve({ data: null }),
])
```

Pass `acLocations` and `profileAddress={profile?.address ?? null}` to `<BookingWizard>`.

- [ ] **Step 3: Update `StepServiceDetails.tsx` to add unit location multi-select**

Import `UnitLocationPicker` and `AcUnitLocation`. Add a `locations: AcUnitLocation[]` prop and `selectedLocationIds` / `onLocationChange` props. Render `<UnitLocationPicker>` below the service-type picker with a label "Which AC units need servicing?".

- [ ] **Step 4: Update `StepReview.tsx` to show slot and locations**

Replace date-range display with:
```tsx
<div>
  <span className="font-medium">Date:</span>{' '}
  {new Date(data.bookingDate + 'T00:00:00').toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
</div>
<div>
  <span className="font-medium">Time:</span> {SLOT_LABELS[data.timeSlot]}
</div>
```

- [ ] **Step 5: Smoke-test the wizard end-to-end**

Start `npm run dev`. Log in as a customer and complete a booking:
1. Pick a service.
2. Select unit locations (chip chips appear, toggling works).
3. Click a date on the calendar → slot pills appear → pick a slot.
4. Fill address.
5. Review page shows all values.
6. Submit → network tab shows `POST /api/bookings` returning `{ id: "..." }`.
7. In Supabase Table Editor: `bookings` row has `booking_date`, `time_slot`, no `earliest_date`. `booking_unit_locations` has the selected locations.

- [ ] **Step 6: Commit**

```bash
git add components/booking/BookingWizard.tsx components/booking/StepServiceDetails.tsx components/booking/StepReview.tsx app/(public)/book/page.tsx
git commit -m "feat: Phase 2-A — 3-step booking wizard with slot calendar + unit location picker"
```

---

## Task 9: Update admin booking views

**Files:**
- Modify: `components/admin/BookingCard.tsx`
- Modify: `app/admin/bookings/AdminBookingsClient.tsx`

- [ ] **Step 1: Update `BookingCard.tsx` to show date + slot**

Replace the `Window: {earliest_date} – {latest_date}` display with:
```tsx
import { SLOT_LABELS } from '@/lib/types'
// ...
<div className="text-sm text-muted-foreground">
  {booking.booking_date
    ? new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—'}
  {booking.time_slot ? ` · ${SLOT_LABELS[booking.time_slot as keyof typeof SLOT_LABELS]}` : ''}
</div>
```

Remove the date-range approve dialog's `min`/`max` constraint. The admin still confirms a `confirmed_date` — but since the booking already has `booking_date`, the approve dialog can pre-fill it:
```tsx
const [confirmedDate, setConfirmedDate] = useState(booking.booking_date ?? '')
```
Remove the `earliest_date`/`latest_date` validation check from the approve handler (it no longer exists).

- [ ] **Step 2: Update `AdminBookingsClient.tsx`**

Remove all references to `earliest_date`, `latest_date`, `preferred_slot`, and the bulk-approve date-range constraint check. Update TypeScript types in the component to remove those fields.

For the Maintenance tab bulk-approve: since each booking now has a `booking_date`, selecting a "confirmed date" is still useful (admin may schedule a group on the same day). The bulk-approve modal can suggest the most common `booking_date` among selected bookings, but doesn't validate against a range.

- [ ] **Step 3: Verify admin bookings page loads without TS errors**

```
npm run build 2>&1 | grep -i "admin/bookings"
```
Expected: no errors on that path.

- [ ] **Step 4: Commit**

```bash
git add components/admin/BookingCard.tsx app/admin/bookings/AdminBookingsClient.tsx
git commit -m "feat: Phase 2-A — admin booking views updated for slot model"
```

---

## Task 10: AC unit locations CRUD in admin settings

**Files:**
- Create: `app/api/admin/ac-locations/route.ts`
- Modify: `app/admin/settings/page.tsx`

- [ ] **Step 1: Create `app/api/admin/ac-locations/route.ts`**

```typescript
// app/api/admin/ac-locations/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin' ? user : null
}

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase.from('ac_unit_locations').select('*').order('display_order')
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { label, display_order } = await req.json()
  if (!label?.trim()) return NextResponse.json({ error: 'label required' }, { status: 400 })
  const { data, error } = await supabase
    .from('ac_unit_locations')
    .insert({ label: label.trim(), display_order: display_order ?? 99 })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id, label, display_order, is_active } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase
    .from('ac_unit_locations')
    .update({ label, display_order, is_active })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Add "Room Labels" section to `app/admin/settings/page.tsx`**

Add a new client-side collapsible card in the settings page titled "AC Unit Locations (Room Labels)". Fetches `GET /api/admin/ac-locations`, renders a list with label + active toggle + delete (set `is_active=false`). Add-new form with a text input + "Add" button that calls `POST`.

Match the existing settings-page card style (keep visual consistency with the existing "Service Types" section).

- [ ] **Step 3: Smoke-test CRUD in browser**

Visit `/admin/settings` → Room Labels section:
- See 7 seeded labels.
- Add "Dining Room" → appears in list.
- Toggle off "Kitchen" → it becomes greyed out.
- Open the booking wizard as a customer → "Kitchen" no longer appears in the UnitLocationPicker.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/ac-locations/route.ts app/admin/settings/page.tsx
git commit -m "feat: Phase 2-A — AC unit locations CRUD in admin settings"
```

---

## Task 11: Lint + build + tests

- [ ] **Step 1: Run Jest**

```
npm test
```
Expected: All tests pass including existing VRP tests + new slot/tier tests.

- [ ] **Step 2: Run lint**

```
npm run lint
```
Expected: No new errors.

- [ ] **Step 3: Run build**

```
npm run build
```
Expected: Clean build with no type errors.

- [ ] **Step 4: Final commit if any lint auto-fixes applied**

```bash
git add -A
git commit -m "chore: Phase 2-A lint and build fixes" --allow-empty
```

---

## Verification

| Check | Expected |
|-------|----------|
| Migrations applied | `bookings` has `booking_date` + `time_slot`, old columns gone |
| `ac_unit_locations` seeded | 7 rows visible in Supabase Studio |
| `npm test` | All green including new slot/tier tests |
| Customer wizard | 3 steps; calendar shows month grid; slot pills appear on date click |
| Double-book same slot | 409 response on second booking |
| Admin BookingCard | Shows date + slot label, no date-range fields |
| Admin settings | Room Labels CRUD works; inactive labels hide from wizard |
| `npm run build` | Clean |

---

## Turbopack note (Windows)

After creating any new `[param]` route files (e.g. `app/api/admin/ac-locations/route.ts`), if the route returns HTML 404 in the dev server, touch the file (add + remove a blank line) to force HMR compilation.
