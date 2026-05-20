# Booking & Contract Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-date booking preferences, full contract admin CRUD, a new AWAITING_PAYMENT payment flow, and a PayNow QR email sent to customers when the admin sets a contract price.

**Architecture:** Two independent workstreams — (A) multi-date booking modifies the SlotCalendar component + BookingWizard state + POST /api/bookings; (B) contract improvements add new API routes under /api/contracts/[id]/, two new email templates, and new action dialogs on the admin contract detail page. A shared helper lib/contracts/service-dates.ts is extracted to avoid duplicating the quarterly-date-generation logic.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (Postgres + RLS), Resend + React Email, Tailwind CSS + shadcn/ui, `qrcode` npm package for server-side QR PNG generation.

---

## File Map

### New files
- `supabase/migrations/021_multi_date_slots.sql` — adds `preferred_date_slots jsonb` to bookings
- `supabase/migrations/022_contract_awaiting_payment.sql` — adds AWAITING_PAYMENT to contracts CHECK constraint
- `lib/contracts/service-dates.ts` — extracted `generateServiceDates(startDate)` helper
- `lib/email/templates/ContractRequestReceived.tsx` — email template
- `lib/email/templates/ContractPricingEmail.tsx` — email template with PayNow QR
- `app/api/contracts/[id]/route.ts` — PATCH (edit) + DELETE
- `app/api/contracts/[id]/set-price/route.ts` — sets price, sends pricing email, → AWAITING_PAYMENT
- `app/api/contracts/[id]/mark-paid/route.ts` — → ACTIVE, generates service dates, sends activation email

### Modified files
- `lib/types.ts` — add `PreferredDateSlot` type, add `'AWAITING_PAYMENT'` to `ContractStatus`
- `lib/email/send.ts` — add `sendContractRequestReceived`, `sendContractPricing`
- `app/api/bookings/route.ts` — accept `preferred_date_slots`, derive compat fields, check blocked per date
- `app/api/contracts/request/route.ts` — send ContractRequestReceived email after insert
- `app/api/contracts/[id]/activate/route.ts` — use extracted `generateServiceDates` helper
- `components/booking/SlotCalendar.tsx` — multi-date selection mode
- `components/booking/BookingWizard.tsx` — state shape: `preferredDateSlots: PreferredDateSlot[]`
- `components/booking/StepScheduleLocation.tsx` — pass `preferredDateSlots` to SlotCalendar
- `components/booking/StepReview.tsx` — render multi-date preferences
- `app/admin/contracts/[id]/page.tsx` — Set Price, Mark Paid, Edit, Delete dialogs
- `app/admin/contracts/page.tsx` — AWAITING_PAYMENT filter pill + badge

---

## WORKSTREAM A — Multi-Date Booking

### Task 1: DB Migration — preferred_date_slots

**Files:**
- Create: `supabase/migrations/021_multi_date_slots.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/021_multi_date_slots.sql
-- Adds preferred_date_slots JSONB to bookings.
-- Structure: [{"date": "YYYY-MM-DD", "slots": ["S10_12", ...]}, ...]
-- booking_date + preferred_slots + time_slot remain for backward compat.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS preferred_date_slots jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill existing rows from current booking_date + preferred_slots
UPDATE bookings
SET preferred_date_slots = jsonb_build_array(
  jsonb_build_object('date', booking_date::text, 'slots', preferred_slots)
)
WHERE preferred_date_slots = '[]'::jsonb;
```

- [ ] **Step 2: Apply the migration**

Run in Supabase SQL editor (or via CLI):
```bash
# Option A — Supabase CLI (if configured)
supabase db push

# Option B — paste the SQL directly into Supabase dashboard → SQL Editor
```

Expected: no error; `preferred_date_slots` column appears in `bookings` table.

- [ ] **Step 3: Verify in Supabase SQL Editor**

```sql
SELECT id, booking_date, preferred_slots, preferred_date_slots
FROM bookings LIMIT 5;
```

Expected: `preferred_date_slots` contains `[{"date": "...", "slots": [...]}]` for each row.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/021_multi_date_slots.sql
git commit -m "feat: add preferred_date_slots jsonb column to bookings"
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add PreferredDateSlot type and update Booking**

In `lib/types.ts`, add after the `TimeSlot` type definition (around line 4):

```typescript
export interface PreferredDateSlot {
  date: string      // YYYY-MM-DD
  slots: TimeSlot[] // 1–3 slots for this date
}
```

Then in the `Booking` interface (around line 52), add after `preferred_slots`:

```typescript
  preferred_date_slots: PreferredDateSlot[]  // multi-date preferences
```

And update `ContractStatus` (line 101):

```typescript
export type ContractStatus = 'PENDING_REVIEW' | 'AWAITING_PAYMENT' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /root/project/hydrowash && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing errors unrelated to these changes).

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add PreferredDateSlot type, AWAITING_PAYMENT contract status"
```

---

### Task 3: SlotCalendar — Multi-Date Mode

**Files:**
- Modify: `components/booking/SlotCalendar.tsx`

The current component manages a single `pickedDate` + `pickedSlots`. Replace with `selectedEntries: PreferredDateSlot[]` and an `activeDate` cursor pointing to which date the slot pills apply to.

- [ ] **Step 1: Rewrite SlotCalendar**

Replace the entire contents of `components/booking/SlotCalendar.tsx` with:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { SLOT_LABELS, SLOT_KEYS } from '@/lib/types'
import type { TimeSlot, PreferredDateSlot } from '@/lib/types'

const SGT_OFFSET_MS = 8 * 60 * 60 * 1000
const MAX_SLOTS_PER_DATE = 3
const MAX_DATES = 5

const SLOT_START_HOUR: Record<TimeSlot, number> = {
  S10_12: 10,
  S13_15: 13,
  S15_17: 15,
  S17_19: 17,
  S19_21: 19,
}

function getSGTDateStr(): string {
  return new Date(Date.now() + SGT_OFFSET_MS).toISOString().slice(0, 10)
}

function getSGTHour(): number {
  return new Date(Date.now() + SGT_OFFSET_MS).getUTCHours()
}

interface DayAvail {
  booked: TimeSlot[]
  blockedSlots: (TimeSlot | null)[]
}

interface Props {
  value: PreferredDateSlot[]
  onChange: (entries: PreferredDateSlot[]) => void
}

function toYearMonth(d: Date): string {
  return d.toISOString().slice(0, 7)
}

export function SlotCalendar({ value, onChange }: Props) {
  const todaySGT = getSGTDateStr()
  const [month, setMonth] = useState(() => toYearMonth(new Date()))
  const [availability, setAvailability] = useState<Record<string, DayAvail>>({})
  const [loading, setLoading] = useState(false)
  // activeDate is the date whose slot pills are shown
  const [activeDate, setActiveDate] = useState<string | null>(
    value.length > 0 ? value[value.length - 1].date : null
  )

  useEffect(() => {
    setLoading(true)
    fetch(`/api/availability?month=${month}`)
      .then(r => r.json())
      .then(d => setAvailability(d.byDate ?? {}))
      .finally(() => setLoading(false))
  }, [month])

  const [year, mon] = month.split('-').map(Number)
  const firstDay = new Date(year, mon - 1, 1)
  const daysInMonth = new Date(year, mon, 0).getDate()
  const startDow = firstDay.getDay()

  function isDayFullyBlocked(date: string): boolean {
    return availability[date]?.blockedSlots.includes(null) ?? false
  }

  function getSlotState(date: string, slot: TimeSlot): 'available' | 'booked' | 'blocked' | 'past' {
    if (date === todaySGT && getSGTHour() >= SLOT_START_HOUR[slot]) return 'past'
    const avail = availability[date]
    if (!avail) return 'available'
    if (avail.blockedSlots.includes(null) || avail.blockedSlots.includes(slot)) return 'blocked'
    if (avail.booked.includes(slot)) return 'booked'
    return 'available'
  }

  function handleDateClick(date: string) {
    const exists = value.find(e => e.date === date)
    if (exists) {
      // Already selected — make it active for slot editing
      setActiveDate(date)
    } else if (value.length < MAX_DATES) {
      // Add new entry with no slots yet
      const next = [...value, { date, slots: [] }]
      onChange(next)
      setActiveDate(date)
    }
  }

  function removeDate(date: string) {
    const next = value.filter(e => e.date !== date)
    onChange(next)
    if (activeDate === date) {
      setActiveDate(next.length > 0 ? next[next.length - 1].date : null)
    }
  }

  function toggleSlot(slot: TimeSlot) {
    if (!activeDate) return
    const next = value.map(e => {
      if (e.date !== activeDate) return e
      const hasSlot = e.slots.includes(slot)
      if (hasSlot) {
        return { ...e, slots: e.slots.filter(s => s !== slot) }
      } else if (e.slots.length < MAX_SLOTS_PER_DATE) {
        return { ...e, slots: [...e.slots, slot] }
      }
      return e
    })
    onChange(next)
  }

  const days: Array<{ date: string; inMonth: boolean }> = []
  for (let i = 0; i < startDow; i++) days.push({ date: '', inMonth: false })
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ date, inMonth: true })
  }

  const monthName = firstDay.toLocaleString('en-SG', { month: 'long', year: 'numeric' })

  function prevMonth() {
    const d = new Date(year, mon - 2, 1)
    setMonth(toYearMonth(d))
  }
  function nextMonth() {
    const d = new Date(year, mon, 1)
    setMonth(toYearMonth(d))
  }

  const activeDateEntry = activeDate ? value.find(e => e.date === activeDate) : null
  const activeSlots = activeDateEntry?.slots ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-muted text-primary">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-primary">{monthName}</span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-muted text-primary">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {value.length >= MAX_DATES && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Maximum {MAX_DATES} date preferences reached.
        </p>
      )}

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-xs font-medium text-muted-foreground py-1">{d}</div>
        ))}
        {days.map((d, i) => {
          if (!d.inMonth) return <div key={i} />
          const isPast = d.date < todaySGT
          const fullyBlocked = isDayFullyBlocked(d.date)
          const isSelected = value.some(e => e.date === d.date)
          const isActive = d.date === activeDate
          const atMax = value.length >= MAX_DATES && !isSelected
          const disabled = isPast || fullyBlocked || atMax
          return (
            <button
              key={d.date}
              disabled={disabled}
              onClick={() => handleDateClick(d.date)}
              className={`
                rounded-lg text-xs py-1.5 font-medium transition-colors
                ${disabled ? 'text-muted-foreground opacity-40 cursor-not-allowed' : ''}
                ${isActive && !disabled ? 'bg-accent text-white ring-2 ring-accent ring-offset-1' : ''}
                ${isSelected && !isActive && !disabled ? 'bg-accent/20 text-accent border border-accent/40' : ''}
                ${!isSelected && !disabled ? 'hover:bg-muted text-primary' : ''}
              `}
            >
              {d.date.slice(8)}
            </button>
          )
        })}
      </div>

      {/* Selected date chips */}
      {value.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-primary">Your preferred dates ({value.length}/{MAX_DATES}):</p>
          {value.map(entry => (
            <div
              key={entry.date}
              onClick={() => setActiveDate(entry.date)}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 cursor-pointer transition-colors text-xs
                ${activeDate === entry.date ? 'border-accent bg-accent/5' : 'border-border hover:bg-muted/40'}`}
            >
              <div>
                <span className="font-medium text-primary">
                  {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-SG', {
                    weekday: 'short', day: 'numeric', month: 'short',
                  })}
                </span>
                {entry.slots.length > 0 && (
                  <span className="ml-2 text-muted-foreground">
                    {entry.slots.map(s => SLOT_LABELS[s]).join(', ')}
                  </span>
                )}
                {entry.slots.length === 0 && (
                  <span className="ml-2 text-amber-600">No slots selected yet</span>
                )}
              </div>
              <button
                onClick={e => { e.stopPropagation(); removeDate(entry.date) }}
                className="ml-2 text-muted-foreground hover:text-red-500"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Slot pills for active date */}
      {activeDate && activeDate >= todaySGT && !isDayFullyBlocked(activeDate) && (
        <div className="border-t border-border pt-4 space-y-2">
          <p className="text-xs font-medium text-primary">
            {new Date(activeDate + 'T00:00:00').toLocaleDateString('en-SG', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            Select up to {MAX_SLOTS_PER_DATE} slots ({activeSlots.length}/{MAX_SLOTS_PER_DATE} selected)
          </p>
          {SLOT_KEYS.map(slot => {
            const state = getSlotState(activeDate, slot)
            const isActive = activeSlots.includes(slot)
            const isDisabled = state !== 'available' || (!isActive && activeSlots.length >= MAX_SLOTS_PER_DATE)
            return (
              <button
                key={slot}
                disabled={isDisabled}
                onClick={() => toggleSlot(slot)}
                className={`
                  w-full text-xs px-3 py-2 rounded-lg border font-medium transition-colors text-left
                  ${isActive ? 'bg-accent text-white border-accent' : ''}
                  ${state === 'available' && !isActive && activeSlots.length < MAX_SLOTS_PER_DATE
                    ? 'border-border text-primary hover:bg-muted/60' : ''}
                  ${isDisabled && !isActive ? 'bg-slate-50 text-muted-foreground border-border cursor-not-allowed opacity-60' : ''}
                `}
              >
                {SLOT_LABELS[slot]}
                {state === 'booked' && <span className="ml-2 text-[10px]">Taken</span>}
                {state === 'blocked' && <span className="ml-2 text-[10px]">Unavailable</span>}
                {state === 'past' && <span className="ml-2 text-[10px]">Passed</span>}
                {state === 'available' && !isActive && activeSlots.length >= MAX_SLOTS_PER_DATE && (
                  <span className="ml-2 text-[10px] text-muted-foreground">(max reached)</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {loading && (
        <p className="text-xs text-muted-foreground text-center">Loading availability…</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /root/project/hydrowash && npx tsc --noEmit 2>&1 | grep SlotCalendar
```

Expected: errors related to callers (not yet updated) — fine for now; no internal errors inside SlotCalendar itself.

- [ ] **Step 3: Commit**

```bash
git add components/booking/SlotCalendar.tsx
git commit -m "feat: SlotCalendar supports multi-date selection (up to 5 dates, 3 slots each)"
```

---

### Task 4: BookingWizard + StepScheduleLocation — State Shape Change

**Files:**
- Modify: `components/booking/BookingWizard.tsx`
- Modify: `components/booking/StepScheduleLocation.tsx`

- [ ] **Step 1: Update BookingWizard.tsx**

Change `BookingData` type — replace `booking_date: string` and `preferred_slots: TimeSlot[]` with `preferred_date_slots: PreferredDateSlot[]`. Update `initial`, `canNext()`, `handleSubmit()`, and the step-1 render.

In `components/booking/BookingWizard.tsx`:

1. Add import:
```typescript
import type { ServiceType, TimeSlot, PreferredDateSlot } from '@/lib/types'
```
(replace the existing `ServiceType, TimeSlot` import)

2. Replace the `BookingData` type:
```typescript
type BookingData = {
  service_type_id: string
  category: string
  preferred_date_slots: PreferredDateSlot[]
  unit_location_ids: string[]
  address: string
  postal_code: string
  lat: number | null
  lng: number | null
  unit_floor?: string
  building_name?: string
  access_notes?: string
  num_units?: number
  fault_description?: string
  urgency?: string
  ac_brand?: string
  ac_model?: string
  notes?: string
  media_urls?: string[]
}
```

3. Replace `initial`:
```typescript
const initial: BookingData = {
  service_type_id: '',
  category: '',
  preferred_date_slots: [],
  unit_location_ids: [],
  address: '',
  postal_code: '',
  lat: null,
  lng: null,
  media_urls: [],
}
```

4. Replace the step-1 guard in `canNext()`:
```typescript
if (step === 1) {
  const hasValidEntry = data.preferred_date_slots.some(e => e.slots.length > 0)
  return hasValidEntry && !!data.address && data.lat !== null
}
```

5. Replace `handleSubmit` body — derive compat fields before sending:
```typescript
async function handleSubmit() {
  setSubmitting(true)
  setError('')
  try {
    const addressParts = [data.unit_floor, data.building_name, data.address].filter(Boolean)
    const fullAddress = addressParts.join(', ')
    const combinedNotes = [data.access_notes, data.notes].filter(Boolean).join(' | ')

    // Derive backward-compat fields from first preference entry
    const firstEntry = data.preferred_date_slots[0]
    const booking_date = firstEntry?.date ?? ''
    const preferred_slots = firstEntry?.slots ?? []
    const time_slot = preferred_slots[0] ?? ''

    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        address: fullAddress || data.address,
        notes: combinedNotes || undefined,
        booking_date,
        preferred_slots,
        time_slot,
        preferred_date_slots: data.preferred_date_slots,
      }),
    })

    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? 'Submission failed. Please try again.')
      return
    }
    router.push('/account/bookings?success=1')
  } catch {
    setError('Network error. Please try again.')
  } finally {
    setSubmitting(false)
  }
}
```

6. Remove the now-unused `SLOT_LABELS` import from the top.

- [ ] **Step 2: Update StepScheduleLocation.tsx**

Replace `StepData` interface to use `preferred_date_slots`:

```typescript
interface StepData {
  preferred_date_slots: PreferredDateSlot[]
  address: string
  postal_code: string
  lat: number | null
  lng: number | null
  unit_floor?: string
  building_name?: string
  access_notes?: string
}
```

Update the import to include `PreferredDateSlot`:
```typescript
import type { TimeSlot, PreferredDateSlot } from '@/lib/types'
```

Replace the `<SlotCalendar>` usage and the confirmation text below it:

```tsx
{/* Slot calendar */}
<div>
  <p className="text-sm font-medium text-primary mb-3">
    Pick your preferred dates &amp; time slots <span className="text-red-500">*</span>
  </p>
  <SlotCalendar
    value={data.preferred_date_slots ?? []}
    onChange={(entries) => onChange({ preferred_date_slots: entries })}
  />
  {data.preferred_date_slots?.some(e => e.slots.length > 0) && (
    <p className="text-xs text-green-700 mt-2">
      ✓ {data.preferred_date_slots.filter(e => e.slots.length > 0).length} date preference{data.preferred_date_slots.filter(e => e.slots.length > 0).length !== 1 ? 's' : ''} selected
    </p>
  )}
</div>
```

Remove the `SLOT_LABELS` import from StepScheduleLocation since it's no longer used there.

- [ ] **Step 3: Verify TypeScript**

```bash
cd /root/project/hydrowash && npx tsc --noEmit 2>&1 | grep -E "StepSchedule|BookingWizard"
```

Expected: errors only in StepReview (not updated yet) and the API route (not updated yet).

- [ ] **Step 4: Commit**

```bash
git add components/booking/BookingWizard.tsx components/booking/StepScheduleLocation.tsx
git commit -m "feat: booking wizard uses multi-date slot preferences"
```

---

### Task 5: StepReview — Render Multi-Date Preferences

**Files:**
- Modify: `components/booking/StepReview.tsx`

- [ ] **Step 1: Update BookingData type in StepReview and render multi-date**

Replace the `BookingData` interface at the top:
```typescript
import { SLOT_LABELS } from '@/lib/types'
import type { ServiceType, PreferredDateSlot } from '@/lib/types'

interface BookingData {
  service_type_id: string
  category: string
  preferred_date_slots: PreferredDateSlot[]
  address: string
  postal_code: string
  unit_floor?: string
  building_name?: string
  access_notes?: string
  num_units?: number
  unit_location_ids?: string[]
  fault_description?: string
  urgency?: string
  ac_brand?: string
  ac_model?: string
  notes?: string
  media_urls?: string[]
}
```

Replace the Schedule section in the JSX:
```tsx
<div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
  <h3 className="font-heading font-semibold text-sm text-primary mb-3">Schedule</h3>
  {(data.preferred_date_slots ?? []).length === 0 && (
    <p className="text-sm text-slate-400">No dates selected.</p>
  )}
  {(data.preferred_date_slots ?? []).map((entry, i) => (
    <div key={entry.date} className="flex justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">
        {i === 0 ? 'First preference' : `Preference ${i + 1}`}
      </span>
      <span className="text-sm font-medium text-slate-800 text-right">
        {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-SG', {
          day: 'numeric', month: 'short', year: 'numeric',
        })}
        {entry.slots.length > 0 && (
          <> · {entry.slots.map(s => SLOT_LABELS[s]).join(', ')}</>
        )}
      </span>
    </div>
  ))}
</div>
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /root/project/hydrowash && npx tsc --noEmit 2>&1 | grep StepReview
```

Expected: no errors from StepReview.

- [ ] **Step 3: Commit**

```bash
git add components/booking/StepReview.tsx
git commit -m "feat: review step shows multi-date preferences"
```

---

### Task 6: Update POST /api/bookings

**Files:**
- Modify: `app/api/bookings/route.ts`

- [ ] **Step 1: Update POST handler to accept preferred_date_slots**

Replace the `POST` function in `app/api/bookings/route.ts`:

```typescript
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  const { preferred_date_slots, unit_location_ids } = body as {
    preferred_date_slots?: { date: string; slots: string[] }[]
    unit_location_ids?: string[]
    [key: string]: unknown
  }

  const validSlots = ['S10_12', 'S13_15', 'S15_17', 'S17_19', 'S19_21']

  // Validate preferred_date_slots (new multi-date path)
  if (!preferred_date_slots?.length) {
    return NextResponse.json({ error: 'At least one date preference is required' }, { status: 400 })
  }
  if (preferred_date_slots.length > 5) {
    return NextResponse.json({ error: 'Maximum 5 date preferences allowed' }, { status: 400 })
  }

  // Validate and sanitise each entry
  const sanitisedEntries = preferred_date_slots
    .filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.date))
    .map(e => ({
      date: e.date,
      slots: (e.slots ?? []).filter(s => validSlots.includes(s)).slice(0, 3),
    }))
    .filter(e => e.slots.length > 0)

  if (!sanitisedEntries.length) {
    return NextResponse.json({ error: 'At least one date with valid time slots required' }, { status: 400 })
  }

  // Check for full-day blocks on every requested date
  for (const entry of sanitisedEntries) {
    const { data: blocked } = await supabase
      .from('blocked_slots')
      .select('id')
      .eq('blocked_date', entry.date)
      .is('slot', null)
      .maybeSingle()

    if (blocked) {
      return NextResponse.json(
        { error: `${entry.date} is not available for booking` },
        { status: 409 }
      )
    }
  }

  // Derive backward-compat fields from first entry
  const booking_date = sanitisedEntries[0].date
  const slots = sanitisedEntries[0].slots
  const time_slot = slots[0]

  // Use lat/lng from Places API if provided; fall back to geocoding
  let lat: number = body.lat as number
  let lng: number = body.lng as number
  if (!lat || !lng) {
    const geo = await geocodeAddress(`${body.address}, ${body.postal_code}, Singapore`)
    if (!geo) return NextResponse.json({ error: 'Could not geocode address' }, { status: 422 })
    lat = geo.lat
    lng = geo.lng
  }

  const { data: booking, error } = await supabase
    .from('bookings')
    .insert({
      customer_id: user.id,
      category: body.category,
      service_type_id: body.service_type_id,
      address: body.address,
      postal_code: body.postal_code ?? '',
      lat,
      lng,
      booking_date,
      time_slot,
      preferred_slots: slots,
      preferred_date_slots: sanitisedEntries,
      num_units: body.num_units ?? null,
      fault_description: body.fault_description ?? null,
      urgency: body.urgency ?? null,
      ac_brand: body.ac_brand ?? null,
      ac_model: body.ac_model ?? null,
      notes: body.notes ?? null,
      media_urls: body.media_urls ?? [],
    })
    .select('*, customer:profiles(name,phone), service_type:service_types(name,duration_minutes,price_sgd)')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Insert unit location join rows if provided
  if (unit_location_ids?.length && booking?.id) {
    await supabase.from('booking_unit_locations').insert(
      unit_location_ids.map((loc_id: string) => ({
        booking_id: booking.id,
        unit_location_id: loc_id,
      }))
    )
  }

  await sendBookingReceived(booking, user.email!).catch(err =>
    console.error(`[bookings POST] Failed to send confirmation email to ${user.email}:`, err)
  )

  return NextResponse.json(booking, { status: 201 })
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /root/project/hydrowash && npx tsc --noEmit 2>&1 | grep "api/bookings/route"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/bookings/route.ts
git commit -m "feat: bookings API accepts multi-date slot preferences"
```

---

### Task 7: Smoke Test Multi-Date Booking

- [ ] **Step 1: Start dev server**

```bash
cd /root/project/hydrowash && npm run dev
```

- [ ] **Step 2: Manual test**

1. Navigate to `http://localhost:3000/book`
2. Complete Step 0 (pick a service)
3. On Step 1 (Schedule & Location): click one date, select a slot; click a second date, select a different slot
4. Verify both date entries appear in the chip list below the calendar
5. On Step 2 (Review): verify both date preferences shown as "First preference" and "Preference 2"
6. Submit — verify no error, redirect to `/account/bookings?success=1`
7. In Supabase, query: `SELECT preferred_date_slots FROM bookings ORDER BY created_at DESC LIMIT 1;`
   Expected: `[{"date":"...","slots":["..."]},{"date":"...","slots":["..."]}]`

- [ ] **Step 3: Run existing tests**

```bash
cd /root/project/hydrowash && npm test
```

Expected: all tests pass (VRP and slots tests are not affected by this change).

---

## WORKSTREAM B — Contract Improvements

### Task 8: DB Migration — AWAITING_PAYMENT Status

**Files:**
- Create: `supabase/migrations/022_contract_awaiting_payment.sql`

- [ ] **Step 1: Create migration**

```sql
-- supabase/migrations/022_contract_awaiting_payment.sql
-- Adds AWAITING_PAYMENT to the contracts status check constraint.
-- Status flow: PENDING_REVIEW → AWAITING_PAYMENT → ACTIVE → EXPIRED / CANCELLED

ALTER TABLE contracts
  DROP CONSTRAINT IF EXISTS contracts_status_check,
  ADD CONSTRAINT contracts_status_check
    CHECK (status IN ('PENDING_REVIEW', 'AWAITING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELLED'));
```

- [ ] **Step 2: Apply the migration**

Run in Supabase SQL editor or via CLI (same as Task 1).

- [ ] **Step 3: Verify**

```sql
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'contracts_status_check';
```

Expected: check clause includes `AWAITING_PAYMENT`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/022_contract_awaiting_payment.sql
git commit -m "feat: add AWAITING_PAYMENT to contracts status constraint"
```

---

### Task 9: Extract generateServiceDates Helper

**Files:**
- Create: `lib/contracts/service-dates.ts`
- Modify: `app/api/contracts/[id]/activate/route.ts`

- [ ] **Step 1: Create the helper**

```typescript
// lib/contracts/service-dates.ts
// Generates 4 quarterly service date records for a contract.

export function generateServiceDates(
  contractId: string,
  startDate: string
): { contract_id: string; due_date: string; reminder_sent: boolean; booking_id: null }[] {
  return [1, 2, 3, 4].map((n) => {
    const d = new Date(`${startDate}T00:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() + 3 * n)
    return {
      contract_id: contractId,
      due_date: d.toISOString().split('T')[0],
      reminder_sent: false,
      booking_id: null,
    }
  })
}
```

- [ ] **Step 2: Update activate/route.ts to use the helper**

In `app/api/contracts/[id]/activate/route.ts`, replace the inline service-date generation with:

```typescript
import { generateServiceDates } from '@/lib/contracts/service-dates'

// ... (replace the hardcoded [1,2,3,4].map(...) block with):
const serviceDates = generateServiceDates(id, start_date)
await supabase.from('contract_service_dates').insert(serviceDates)
```

Remove the old inline block that was:
```typescript
const serviceDates = [1, 2, 3, 4].map((n) => {
  const d = new Date(`${start_date}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + 3 * n)
  return { contract_id: id, due_date: d.toISOString().split('T')[0], reminder_sent: false, booking_id: null }
})
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /root/project/hydrowash && npx tsc --noEmit 2>&1 | grep "service-dates\|activate"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/contracts/service-dates.ts app/api/contracts/[id]/activate/route.ts
git commit -m "refactor: extract generateServiceDates helper"
```

---

### Task 10: Install qrcode Package

- [ ] **Step 1: Install**

```bash
cd /root/project/hydrowash && npm install qrcode && npm install --save-dev @types/qrcode
```

- [ ] **Step 2: Verify import works**

```bash
node -e "const QRCode = require('qrcode'); console.log(typeof QRCode.toDataURL)"
```

Expected: `function`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install qrcode package for server-side QR PNG generation"
```

---

### Task 11: ContractRequestReceived Email Template

**Files:**
- Create: `lib/email/templates/ContractRequestReceived.tsx`
- Modify: `lib/email/send.ts`

- [ ] **Step 1: Create the template**

```tsx
// lib/email/templates/ContractRequestReceived.tsx
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'

interface Props {
  customerName: string
  numUnits: number
  preferredMonth: string  // e.g. "June 2026"
  address?: string
}

export function ContractRequestReceived({ customerName, numUnits, preferredMonth, address }: Props) {
  return (
    <Html>
      <Head />
      <Preview>We received your maintenance contract request — HydroWash</Preview>
      <Body style={{ fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <Container style={{ maxWidth: 480, margin: '40px auto', background: '#fff', padding: 32, borderRadius: 8 }}>
          <Heading style={{ color: '#0f172a' }}>Contract Request Received</Heading>
          <Text>Hi {customerName},</Text>
          <Text>
            We've received your request for a 1-year maintenance contract for{' '}
            <strong>{numUnits} unit{numUnits !== 1 ? 's' : ''}</strong>
            {address ? ` at ${address}` : ''}.
          </Text>
          <Text>
            Preferred start: <strong>{preferredMonth}</strong>
          </Text>
          <Text>
            Our team will review your request and send you the pricing shortly. Once you confirm
            payment, your contract will be activated and your service schedule will be generated.
          </Text>
          <Text>
            If you have any questions, feel free to reply to this email.
          </Text>
          <Text style={{ color: '#64748b', fontSize: 12 }}>HydroWash · Singapore</Text>
        </Container>
      </Body>
    </Html>
  )
}
```

- [ ] **Step 2: Add sendContractRequestReceived to lib/email/send.ts**

At the end of `lib/email/send.ts`, add:

```typescript
export async function sendContractRequestReceived(
  data: {
    customerName: string
    numUnits: number
    preferredMonth: string
    address?: string
  },
  email: string
) {
  const { ContractRequestReceived } = await import('./templates/ContractRequestReceived')
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Contract request received — HydroWash',
    react: ContractRequestReceived(data),
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/email/templates/ContractRequestReceived.tsx lib/email/send.ts
git commit -m "feat: add ContractRequestReceived email template"
```

---

### Task 12: Update POST /api/contracts/request to Send Email

**Files:**
- Modify: `app/api/contracts/request/route.ts`

- [ ] **Step 1: Add email sending after contract insert**

At the top of the file, add the import:
```typescript
import { sendContractRequestReceived } from '@/lib/email/send'
```

After `return NextResponse.json({ contract_id: contract.id }, { status: 201 })` is currently, but BEFORE that return, add:

```typescript
// Send confirmation email to customer
try {
  const { data: customerProfile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single()

  const preferredMonthLabel = new Date(`${preferred_month}-01T00:00:00Z`)
    .toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })

  await sendContractRequestReceived(
    {
      customerName: customerProfile?.name ?? 'Customer',
      numUnits: num_units,
      preferredMonth: preferredMonthLabel,
      address: address || undefined,
    },
    user.email!
  )
} catch {
  // Email failure does not fail the request
}

return NextResponse.json({ contract_id: contract.id }, { status: 201 })
```

- [ ] **Step 2: Commit**

```bash
git add app/api/contracts/request/route.ts
git commit -m "feat: send ContractRequestReceived email on customer contract request"
```

---

### Task 13: ContractPricingEmail Template with PayNow QR

**Files:**
- Create: `lib/email/templates/ContractPricingEmail.tsx`
- Modify: `lib/email/send.ts`

- [ ] **Step 1: Create the template**

```tsx
// lib/email/templates/ContractPricingEmail.tsx
import { Body, Container, Head, Heading, Html, Img, Preview, Text } from '@react-email/components'

interface Props {
  customerName: string
  numUnits: number
  priceSgd: number
  startDate: string
  endDate: string
  address?: string
  paynowQrDataUrl: string   // base64 data URL from QRCode.toDataURL()
  paynowMobile: string      // e.g. +6591234567
  referenceId: string       // e.g. CONTRACT-abc12345
}

export function ContractPricingEmail({
  customerName,
  numUnits,
  priceSgd,
  startDate,
  endDate,
  address,
  paynowQrDataUrl,
  paynowMobile,
  referenceId,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your HydroWash contract pricing — S${priceSgd.toFixed(2)}/year</Preview>
      <Body style={{ fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <Container style={{ maxWidth: 480, margin: '40px auto', background: '#fff', padding: 32, borderRadius: 8 }}>
          <Heading style={{ color: '#0f172a' }}>Contract Pricing Ready</Heading>
          <Text>Hi {customerName},</Text>
          <Text>
            Your annual maintenance contract for{' '}
            <strong>{numUnits} unit{numUnits !== 1 ? 's' : ''}</strong>
            {address ? ` at ${address}` : ''} has been reviewed.
          </Text>

          <Container style={{ background: '#f1f5f9', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
            <Text style={{ margin: 0, fontWeight: 'bold', fontSize: 20, color: '#0369a1' }}>
              S${priceSgd.toFixed(2)} / year
            </Text>
            <Text style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
              Contract period: {startDate} → {endDate}
            </Text>
          </Container>

          <Text style={{ fontWeight: 'bold' }}>Pay via PayNow</Text>
          <Text>
            Scan the QR code below with your banking app, or send{' '}
            <strong>S${priceSgd.toFixed(2)}</strong> to{' '}
            <strong>{paynowMobile}</strong> with reference <strong>{referenceId}</strong>.
          </Text>

          <Img
            src={paynowQrDataUrl}
            alt="PayNow QR Code"
            width={200}
            height={200}
            style={{ display: 'block', margin: '16px auto' }}
          />

          <Text style={{ fontSize: 12, color: '#64748b', textAlign: 'center' as const }}>
            Reference: {referenceId}
          </Text>

          <Text>
            Once we confirm your payment, your contract will be activated and your quarterly
            service schedule will be generated. You will receive a confirmation email.
          </Text>

          <Text style={{ color: '#64748b', fontSize: 12 }}>HydroWash · Singapore</Text>
        </Container>
      </Body>
    </Html>
  )
}
```

- [ ] **Step 2: Add sendContractPricing to lib/email/send.ts**

At the end of `lib/email/send.ts`, add:

```typescript
export async function sendContractPricing(
  data: {
    customerName: string
    numUnits: number
    priceSgd: number
    startDate: string
    endDate: string
    address?: string
    paynowQrDataUrl: string
    paynowMobile: string
    referenceId: string
  },
  email: string
) {
  const { ContractPricingEmail } = await import('./templates/ContractPricingEmail')
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your HydroWash contract pricing — S$${data.priceSgd.toFixed(2)}/year`,
    react: ContractPricingEmail(data),
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/email/templates/ContractPricingEmail.tsx lib/email/send.ts
git commit -m "feat: add ContractPricingEmail template with PayNow QR"
```

---

### Task 14: New API — PATCH /api/contracts/[id]/set-price

**Files:**
- Create: `app/api/contracts/[id]/set-price/route.ts`

This endpoint:
1. Validates admin auth
2. Validates contract is PENDING_REVIEW
3. Accepts `{ price_sgd, start_date, notes? }`
4. Fetches `paynow_mobile` from app_settings
5. Generates PayNow QR as base64 PNG
6. Updates contract → AWAITING_PAYMENT
7. Sends ContractPricingEmail to customer

- [ ] **Step 1: Create the route**

```typescript
// app/api/contracts/[id]/set-price/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendContractPricing } from '@/lib/email/send'
import { buildPayNowPayload } from '@/lib/utils/paynow'
import QRCode from 'qrcode'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { price_sgd, start_date, notes } = body

  if (!price_sgd || !start_date) {
    return NextResponse.json({ error: 'price_sgd and start_date are required' }, { status: 400 })
  }

  const priceNum = parseFloat(price_sgd)
  if (isNaN(priceNum) || priceNum <= 0) {
    return NextResponse.json({ error: 'price_sgd must be a positive number' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })

  if (existing.status !== 'PENDING_REVIEW') {
    return NextResponse.json({ error: 'Contract must be in PENDING_REVIEW status' }, { status: 409 })
  }

  // Compute end date (1 year from start)
  const endDateObj = new Date(`${start_date}T00:00:00Z`)
  endDateObj.setUTCFullYear(endDateObj.getUTCFullYear() + 1)
  const end_date = endDateObj.toISOString().split('T')[0]

  const { data: contract, error: updateError } = await supabase
    .from('contracts')
    .update({
      status: 'AWAITING_PAYMENT',
      price_sgd: priceNum,
      start_date,
      end_date,
      notes: notes ?? existing.notes,
    })
    .eq('id', id)
    .select()
    .single()

  if (updateError || !contract) {
    return NextResponse.json({ error: updateError?.message ?? 'Update failed' }, { status: 500 })
  }

  // Send pricing email with PayNow QR
  try {
    const { data: settings } = await supabase
      .from('app_settings')
      .select('paynow_mobile')
      .single()

    const adminSupabase = createAdminClient()
    const { data: { user: customerUser } } = await adminSupabase.auth.admin.getUserById(contract.customer_id)

    const { data: customerProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', contract.customer_id)
      .single()

    if (customerUser?.email && settings?.paynow_mobile) {
      const referenceId = `CONTRACT-${id.slice(0, 8).toUpperCase()}`
      const payload = buildPayNowPayload(settings.paynow_mobile, priceNum, referenceId)
      const qrDataUrl = await QRCode.toDataURL(payload, { width: 300, margin: 2 })

      await sendContractPricing(
        {
          customerName: customerProfile?.name ?? 'Customer',
          numUnits: contract.num_units,
          priceSgd: priceNum,
          startDate: start_date,
          endDate: end_date,
          address: contract.address ?? undefined,
          paynowQrDataUrl: qrDataUrl,
          paynowMobile: settings.paynow_mobile,
          referenceId,
        },
        customerUser.email
      )
    }
  } catch (err) {
    console.error('[set-price] Email send failed:', err)
    // Email failure does not fail the price-set action
  }

  return NextResponse.json({ contract })
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /root/project/hydrowash && npx tsc --noEmit 2>&1 | grep "set-price"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/contracts/[id]/set-price/route.ts
git commit -m "feat: PATCH /api/contracts/[id]/set-price — sets price, sends PayNow QR email"
```

---

### Task 15: New API — PATCH /api/contracts/[id]/mark-paid

**Files:**
- Create: `app/api/contracts/[id]/mark-paid/route.ts`

This endpoint:
1. Validates admin auth
2. Validates contract is AWAITING_PAYMENT
3. Updates contract → ACTIVE
4. Inserts 4 quarterly service dates using the helper
5. Sends ContractActivated email to customer

- [ ] **Step 1: Create the route**

```typescript
// app/api/contracts/[id]/mark-paid/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendContractActivated } from '@/lib/email/send'
import { generateServiceDates } from '@/lib/contracts/service-dates'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: existing } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })

  if (existing.status !== 'AWAITING_PAYMENT') {
    return NextResponse.json({ error: 'Contract must be in AWAITING_PAYMENT status' }, { status: 409 })
  }

  const { data: contract, error: updateError } = await supabase
    .from('contracts')
    .update({ status: 'ACTIVE' })
    .eq('id', id)
    .select()
    .single()

  if (updateError || !contract) {
    return NextResponse.json({ error: updateError?.message ?? 'Update failed' }, { status: 500 })
  }

  // Generate 4 quarterly service dates
  const serviceDates = generateServiceDates(id, existing.start_date)
  await supabase.from('contract_service_dates').insert(serviceDates)

  // Send activation email
  try {
    const adminSupabase = createAdminClient()
    const { data: { user: customerUser } } = await adminSupabase.auth.admin.getUserById(contract.customer_id)

    if (customerUser?.email) {
      const { data: customerProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', contract.customer_id)
        .single()

      await sendContractActivated(
        {
          customerName: customerProfile?.name ?? 'Customer',
          numUnits: contract.num_units,
          priceSgd: parseFloat(contract.price_sgd),
          startDate: existing.start_date,
          firstServiceDate: serviceDates[0].due_date,
        },
        customerUser.email
      )
    }
  } catch {
    // Email failure does not fail activation
  }

  return NextResponse.json({ contract })
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /root/project/hydrowash && npx tsc --noEmit 2>&1 | grep "mark-paid"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/contracts/[id]/mark-paid/route.ts
git commit -m "feat: PATCH /api/contracts/[id]/mark-paid — activates contract, generates service dates"
```

---

### Task 16: New API — PATCH + DELETE /api/contracts/[id]

**Files:**
- Create: `app/api/contracts/[id]/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/contracts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  // Only allow updating these fields; status changes go through dedicated endpoints
  const allowed = ['price_sgd', 'notes', 'address', 'start_date', 'end_date'] as const
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body && body[key] !== undefined) {
      updates[key] = key === 'price_sgd' ? parseFloat(body[key]) : body[key]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
  }

  const { data: contract, error } = await supabase
    .from('contracts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error || !contract) {
    return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ contract })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: existing } = await supabase
    .from('contracts')
    .select('status')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })

  if (existing.status === 'CANCELLED') {
    // Hard delete — contract_service_dates cascade via FK
    const { error } = await supabase.from('contracts').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ deleted: true })
  }

  // Soft delete → CANCELLED
  const { error } = await supabase
    .from('contracts')
    .update({ status: 'CANCELLED' })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cancelled: true })
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /root/project/hydrowash && npx tsc --noEmit 2>&1 | grep "contracts/\[id\]/route"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/contracts/[id]/route.ts
git commit -m "feat: PATCH + DELETE /api/contracts/[id] for contract editing and deletion"
```

---

### Task 17: Admin Contract Detail Page — New Action Dialogs

**Files:**
- Modify: `app/admin/contracts/[id]/page.tsx`

This is the largest UI change. The current page has two action states (PENDING_REVIEW → Activate/Reject). We need four:
1. **Set Price** (PENDING_REVIEW) — dialog with price + start_date + notes → POST to `/set-price`
2. **Mark Paid** (AWAITING_PAYMENT) — confirmation → POST to `/mark-paid`
3. **Edit** (any non-CANCELLED state) — dialog with all editable fields → PATCH to `/api/contracts/[id]`
4. **Delete/Deactivate** — confirmation dialog → DELETE to `/api/contracts/[id]`

- [ ] **Step 1: Replace the entire file**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ServiceDateRow from '@/components/admin/ServiceDateRow'
import InvoiceRow from '@/components/admin/InvoiceRow'
import {
  ContractWithDetails,
  ContractServiceDateWithBooking,
  InvoiceWithCustomer,
} from '@/lib/types'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import Link from 'next/link'

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [contract, setContract] = useState<ContractWithDetails | null>(null)
  const [serviceDates, setServiceDates] = useState<ContractServiceDateWithBooking[]>([])
  const [invoices, setInvoices] = useState<InvoiceWithCustomer[]>([])
  const [availableBookings, setAvailableBookings] = useState<{ id: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)

  // Set Price dialog (PENDING_REVIEW)
  const [setPriceOpen, setSetPriceOpen] = useState(false)
  const [settingPrice, setSettingPrice] = useState(false)
  const [setPriceForm, setSetPriceForm] = useState({ price_sgd: '', start_date: '', notes: '' })

  // Mark Paid confirmation (AWAITING_PAYMENT)
  const [markingPaid, setMarkingPaid] = useState(false)

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    price_sgd: '',
    notes: '',
    address: '',
    start_date: '',
    end_date: '',
  })

  // Delete/Deactivate
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function fetchData() {
    setLoading(true)
    const { data: contractData } = await supabase
      .from('contracts')
      .select(`
        *,
        customer:profiles!contracts_customer_id_fkey (id, name, phone),
        contract_service_dates (
          id, contract_id, due_date, reminder_sent, booking_id,
          booking:bookings!contract_service_dates_booking_id_fkey (
            id, status, confirmed_date, address
          )
        ),
        invoices (
          id, customer_id, booking_id, contract_id, amount_sgd,
          description, status, payment_method, paid_at, created_at
        )
      `)
      .eq('id', id)
      .single()

    if (contractData) {
      setContract(contractData as ContractWithDetails)
      setServiceDates(
        (contractData.contract_service_dates ?? []).sort(
          (a: ContractServiceDateWithBooking, b: ContractServiceDateWithBooking) =>
            a.due_date.localeCompare(b.due_date)
        )
      )
      setInvoices(contractData.invoices ?? [])
      setSetPriceForm(f => ({
        ...f,
        start_date: f.start_date || contractData.start_date,
        notes: f.notes || contractData.notes || '',
      }))
      setEditForm({
        price_sgd: contractData.price_sgd != null ? String(contractData.price_sgd) : '',
        notes: contractData.notes || '',
        address: contractData.address || '',
        start_date: contractData.start_date,
        end_date: contractData.end_date,
      })
    }

    if (contractData?.customer_id) {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, address, confirmed_date, status')
        .eq('customer_id', contractData.customer_id)
        .in('status', ['APPROVED', 'COMPLETED'])
        .order('confirmed_date', { ascending: false })

      setAvailableBookings(
        (bookings ?? []).map((b) => ({
          id: b.id,
          label: `${b.confirmed_date ?? 'TBD'} — ${b.address}`,
        }))
      )
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  async function handleLinkBooking(serviceDateId: string, bookingId: string) {
    const res = await fetch(`/api/contracts/${id}/link-booking`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_date_id: serviceDateId, booking_id: bookingId }),
    })
    if (res.ok) {
      fetchData()
    } else {
      const err = await res.json()
      alert(`Error: ${err.error}`)
    }
  }

  async function handleSetPrice(e: React.FormEvent) {
    e.preventDefault()
    setSettingPrice(true)
    const res = await fetch(`/api/contracts/${id}/set-price`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(setPriceForm),
    })
    setSettingPrice(false)
    if (res.ok) {
      setSetPriceOpen(false)
      fetchData()
    } else {
      const err = await res.json()
      alert(`Error: ${err.error}`)
    }
  }

  async function handleMarkPaid() {
    if (!confirm('Mark this contract as paid and activate it? This will generate the service schedule and notify the customer.')) return
    setMarkingPaid(true)
    const res = await fetch(`/api/contracts/${id}/mark-paid`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    setMarkingPaid(false)
    if (res.ok) {
      fetchData()
    } else {
      const err = await res.json()
      alert(`Error: ${err.error}`)
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setEditing(true)
    const body: Record<string, string | number> = {}
    if (editForm.price_sgd) body.price_sgd = parseFloat(editForm.price_sgd)
    if (editForm.notes !== undefined) body.notes = editForm.notes
    if (editForm.address !== undefined) body.address = editForm.address
    if (editForm.start_date) body.start_date = editForm.start_date
    if (editForm.end_date) body.end_date = editForm.end_date

    const res = await fetch(`/api/contracts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setEditing(false)
    if (res.ok) {
      setEditOpen(false)
      fetchData()
    } else {
      const err = await res.json()
      alert(`Error: ${err.error}`)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/contracts/${id}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteOpen(false)
    if (res.ok) {
      const body = await res.json()
      if (body.deleted) {
        router.push('/admin/contracts')
      } else {
        fetchData() // soft-deleted → refresh
      }
    } else {
      const err = await res.json()
      alert(`Error: ${err.error}`)
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>
  if (!contract) return <div className="p-8 text-red-600">Contract not found.</div>

  const statusColors: Record<string, string> = {
    PENDING_REVIEW: 'bg-amber-100 text-amber-800',
    AWAITING_PAYMENT: 'bg-orange-100 text-orange-800',
    ACTIVE: 'bg-green-100 text-green-800',
    EXPIRED: 'bg-gray-100 text-gray-600',
    CANCELLED: 'bg-red-100 text-red-700',
  }

  const statusLabels: Record<string, string> = {
    PENDING_REVIEW: 'Pending Review',
    AWAITING_PAYMENT: 'Awaiting Payment',
    ACTIVE: 'Active',
    EXPIRED: 'Expired',
    CANCELLED: 'Cancelled',
  }

  const isPending = contract.status === 'PENDING_REVIEW'
  const isAwaitingPayment = contract.status === 'AWAITING_PAYMENT'
  const isEditable = contract.status !== 'CANCELLED'

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/contracts">
          <Button variant="ghost" size="sm">&larr; Back</Button>
        </Link>
        <h1 className="font-heading text-2xl font-bold text-primary">
          Contract — {contract.customer.name}
        </h1>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[contract.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {statusLabels[contract.status] ?? contract.status}
        </span>
      </div>

      {/* PENDING_REVIEW CTA — Set Price */}
      {isPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-amber-800">Customer-requested contract</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Review the details and set a price. An email with PayNow QR will be sent to the customer.
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={setPriceOpen} onOpenChange={setSetPriceOpen}>
              <DialogTrigger className={cn(buttonVariants(), 'bg-green-600 text-white hover:bg-green-700')}>
                Set Price &amp; Send Email
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Set Contract Price</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSetPrice} className="space-y-4 pt-2">
                  <div>
                    <Label>Price (SGD / year)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={setPriceForm.price_sgd}
                      onChange={e => setSetPriceForm(f => ({ ...f, price_sgd: e.target.value }))}
                      required
                      placeholder="e.g. 480.00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Confirmed start date</Label>
                    <Input
                      type="date"
                      value={setPriceForm.start_date}
                      onChange={e => setSetPriceForm(f => ({ ...f, start_date: e.target.value }))}
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Notes for customer (optional)</Label>
                    <Textarea
                      value={setPriceForm.notes}
                      onChange={e => setSetPriceForm(f => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={settingPrice}
                    className="w-full bg-green-600 text-white hover:bg-green-700"
                  >
                    {settingPrice ? 'Sending…' : 'Set Price & Send PayNow Email'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => { setDeleteOpen(true) }}
            >
              Reject
            </Button>
          </div>
        </div>
      )}

      {/* AWAITING_PAYMENT CTA — Mark Paid */}
      {isAwaitingPayment && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-orange-800">Awaiting payment</p>
            <p className="text-sm text-orange-700 mt-0.5">
              PayNow QR email has been sent. Mark as paid once you confirm the transfer.
            </p>
          </div>
          <Button
            onClick={handleMarkPaid}
            disabled={markingPaid}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            {markingPaid ? 'Activating…' : 'Mark Paid & Activate'}
          </Button>
        </div>
      )}

      {/* Action buttons (always visible when editable) */}
      {isEditable && (
        <div className="flex gap-2 flex-wrap">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger className={cn(buttonVariants({ variant: 'outline' }), 'text-primary')}>
              Edit Contract
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Contract</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleEdit} className="space-y-4 pt-2">
                <div>
                  <Label>Price (SGD / year)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={editForm.price_sgd}
                    onChange={e => setEditForm(f => ({ ...f, price_sgd: e.target.value }))}
                    placeholder="e.g. 480.00"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Address</Label>
                  <Input
                    value={editForm.address}
                    onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="Service address (optional)"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    value={editForm.start_date}
                    onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>End date</Label>
                  <Input
                    type="date"
                    value={editForm.end_date}
                    onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={editForm.notes}
                    onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    className="mt-1"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={editing}
                  className="w-full bg-accent text-white hover:bg-accent/90"
                >
                  {editing ? 'Saving…' : 'Save Changes'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger className={cn(buttonVariants({ variant: 'outline' }), 'border-red-300 text-red-600 hover:bg-red-50')}>
              {contract.status === 'CANCELLED' ? 'Delete' : 'Deactivate'}
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>
                  {contract.status === 'CANCELLED' ? 'Delete Contract?' : 'Deactivate Contract?'}
                </DialogTitle>
              </DialogHeader>
              <div className="pt-2 space-y-4">
                <p className="text-sm text-gray-600">
                  {contract.status === 'CANCELLED'
                    ? 'This will permanently delete the contract and all associated service dates.'
                    : 'This will cancel the contract. The customer will no longer have an active maintenance plan.'}
                </p>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                  <Button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-red-600 text-white hover:bg-red-700"
                  >
                    {deleting ? 'Processing…' : contract.status === 'CANCELLED' ? 'Delete' : 'Deactivate'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Contract Terms */}
      <section className="bg-white border rounded-xl p-5 space-y-2 text-sm">
        <h2 className="font-semibold text-primary mb-3">Contract Terms</h2>
        <div className="grid grid-cols-2 gap-y-1 gap-x-4">
          <span className="text-gray-500">Customer</span>
          <span>{contract.customer.name} · {contract.customer.phone}</span>
          <span className="text-gray-500">Units</span>
          <span>{contract.num_units}</span>
          <span className="text-gray-500">Price</span>
          <span>{contract.price_sgd != null ? `S$${Number(contract.price_sgd).toFixed(2)} / year` : 'TBD'}</span>
          <span className="text-gray-500">Period</span>
          <span>{contract.start_date} → {contract.end_date}</span>
          <span className="text-gray-500">Service interval</span>
          <span>Every {contract.service_interval_months} months</span>
          {contract.address && (
            <>
              <span className="text-gray-500">Address</span>
              <span>{contract.address}</span>
            </>
          )}
          {contract.notes && (
            <>
              <span className="text-gray-500">Notes</span>
              <span>{contract.notes}</span>
            </>
          )}
        </div>
      </section>

      {serviceDates.length > 0 && (
        <section className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold text-primary mb-3">Service Schedule</h2>
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-200">
                <th className="py-1 px-3">Visit</th>
                <th className="py-1 px-3">Due Date</th>
                <th className="py-1 px-3">Booking</th>
                <th className="py-1 px-3">Status</th>
                <th className="py-1 px-3">Reminder</th>
                <th className="py-1 px-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {serviceDates.map((sd, i) => (
                <ServiceDateRow
                  key={sd.id}
                  index={i}
                  serviceDate={sd}
                  contractId={id}
                  availableBookings={availableBookings}
                  onLink={handleLinkBooking}
                />
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="bg-white border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-primary">Invoices</h2>
          <Link href={`/admin/invoices?contract_id=${id}`}>
            <Button size="sm" variant="outline">+ New Invoice</Button>
          </Link>
        </div>
        {invoices.length === 0 ? (
          <p className="text-sm text-gray-400">No invoices yet.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-200">
                <th className="py-1 px-3">Description</th>
                <th className="py-1 px-3">Amount</th>
                <th className="py-1 px-3">Status</th>
                <th className="py-1 px-3">Paid</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <InvoiceRow
                  key={inv.id}
                  invoice={inv as InvoiceWithCustomer}
                  onPaid={() => fetchData()}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /root/project/hydrowash && npx tsc --noEmit 2>&1 | grep "contracts/\[id\]/page"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/contracts/[id]/page.tsx
git commit -m "feat: admin contract detail — Set Price, Mark Paid, Edit, Delete/Deactivate actions"
```

---

### Task 18: Admin Contracts List — AWAITING_PAYMENT Badge + Filter

**Files:**
- Modify: `app/admin/contracts/page.tsx`
- Modify: `components/admin/ContractCard.tsx`

- [ ] **Step 1: Update ContractCard.tsx status maps**

In `components/admin/ContractCard.tsx`, the `statusColors` and `statusLabels` objects are defined around line 42. Add `AWAITING_PAYMENT` entries:

```typescript
// Replace the statusColors and statusLabels objects (around line 42–54):
const statusColors: Record<string, string> = {
  PENDING_REVIEW: 'bg-amber-100 text-amber-800',
  AWAITING_PAYMENT: 'bg-orange-100 text-orange-800',
  ACTIVE: 'bg-green-100 text-green-800',
  EXPIRED: 'bg-muted text-muted-foreground',
  CANCELLED: 'bg-red-100 text-red-700',
}

const statusLabels: Record<string, string> = {
  PENDING_REVIEW: 'Pending Review',
  AWAITING_PAYMENT: 'Awaiting Payment',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
}
```

Also update the `isPending` line (line 40) to show the banner for both pending states:
```typescript
const isPending = contract.status === 'PENDING_REVIEW' || contract.status === 'AWAITING_PAYMENT'
```

- [ ] **Step 2: Add AWAITING_PAYMENT to the sort priority in page.tsx**

In `app/admin/contracts/page.tsx`, in the `filteredContracts` sort (around line 140–144), update the sort so AWAITING_PAYMENT also floats to the top:

```typescript
.sort((a, b) => {
  const priority = (s: string) =>
    s === 'PENDING_REVIEW' ? 0 : s === 'AWAITING_PAYMENT' ? 1 : 2
  return priority(a.status) - priority(b.status)
})
```

- [ ] **Step 3: Add AWAITING_PAYMENT to the status filter pills in page.tsx**

In `app/admin/contracts/page.tsx`, find the status filter pills. The component renders pills based on a hard-coded list. Add AWAITING_PAYMENT. The filter section renders something like a list of status buttons; find it and add the new status. For example:

```tsx
{(['ALL', 'PENDING_REVIEW', 'AWAITING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELLED'] as const).map(s => {
  const labels: Record<string, string> = {
    ALL: 'All',
    PENDING_REVIEW: 'Pending Review',
    AWAITING_PAYMENT: 'Awaiting Payment',
    ACTIVE: 'Active',
    EXPIRED: 'Expired',
    CANCELLED: 'Cancelled',
  }
  return (
    <button
      key={s}
      onClick={() => setStatusFilter(s)}
      className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
        statusFilter === s
          ? 'bg-accent text-white border-accent'
          : 'border-border text-primary hover:bg-muted/60'
      }`}
    >
      {labels[s]}
    </button>
  )
})}
```

(Adapt the className to match the existing pattern in the file.)

- [ ] **Step 4: Commit**

```bash
git add app/admin/contracts/page.tsx components/admin/ContractCard.tsx
git commit -m "feat: admin contracts list shows AWAITING_PAYMENT filter and badge"
```

---

### Task 19: Final Integration Test

- [ ] **Step 1: Start dev server**

```bash
cd /root/project/hydrowash && npm run dev
```

- [ ] **Step 2: Test contract payment flow**

1. Log in as a customer account
2. Navigate to account → Contracts & Invoices → "Request a Contract"
3. Submit contract request
4. Check that a "contract request received" email was sent (Resend dashboard or logs)
5. Log in as admin → Contracts → find the PENDING_REVIEW contract
6. Open detail page → click "Set Price & Send Email"
7. Enter price, start date → submit
8. Verify contract moves to AWAITING_PAYMENT
9. Verify customer receives pricing email with PayNow QR (check Resend logs)
10. Click "Mark Paid & Activate" → verify contract moves to ACTIVE
11. Verify 4 service dates appear in the Service Schedule section
12. Verify customer receives activation email

- [ ] **Step 3: Test contract edit**

1. Open any ACTIVE contract → click "Edit Contract"
2. Change price, notes, address → save
3. Verify changes reflected on page

- [ ] **Step 4: Test contract delete/deactivate**

1. Open a PENDING_REVIEW contract → click "Deactivate" → confirm
2. Verify contract moves to CANCELLED
3. Open that CANCELLED contract → click "Delete" → confirm
4. Verify redirect to /admin/contracts list and contract is gone

- [ ] **Step 5: Run tests**

```bash
cd /root/project/hydrowash && npm test
```

Expected: all tests pass.

- [ ] **Step 6: Build check**

```bash
cd /root/project/hydrowash && npm run build 2>&1 | tail -20
```

Expected: build completes successfully.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: booking + contract improvements — multi-date slots, contract CRUD, PayNow payment flow"
```

---

## Notes for Implementer

1. **`qrcode` package is server-side only** — do not import it in any `'use client'` component. It's only used in `/api/contracts/[id]/set-price/route.ts`.

2. **`paynow_mobile` may be null** in app_settings if the admin hasn't configured it. The set-price endpoint gracefully skips QR generation in that case (logs a warning). Encourage the admin to set it in `/admin/settings`.

3. **The existing `/api/contracts/[id]/activate` endpoint** still works and is left in place. It does PENDING_REVIEW → ACTIVE in one step (for admin-created contracts that don't go through the customer self-request flow). This is intentional — the new flow only applies to customer self-requests.

4. **Supabase Turbopack note** (from CLAUDE.md): The dynamic `[id]` routes may not compile at dev startup. If you get 404s in dev, touch the route file to force HMR: `touch app/api/contracts/[id]/route.ts`.

5. **shadcn/ui v4 rule**: Never nest `<Button>` inside `<DialogTrigger>`. Use `<DialogTrigger className={cn(buttonVariants(...), 'extra-classes')}>Label</DialogTrigger>` as shown in this plan.
