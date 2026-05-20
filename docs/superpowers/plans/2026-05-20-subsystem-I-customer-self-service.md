# Subsystem I — Customer Self-Service

> Execute with `superpowers:subagent-driven-development` or `superpowers:executing-plans`.

**Goal:** Customers can reschedule, cancel, and repeat-book their own bookings without admin help.

**Rules:**
- Reschedule/cancel only when cutoff ≥24h before effective date (SGT): `confirmed_date` if APPROVED, else earliest date in `preferred_date_slots[0].date`
- Rescheduling an APPROVED booking resets it to PENDING (clears `confirmed_date` + `confirmed_slot`)
- Cancel is soft (row kept, status = CANCELLED)
- Repeat booking: opens wizard with service/units/location/address prefilled; customer picks new dates/slots

**Conventions:** See `CLAUDE.md` for supabase client usage, slot types, shadcn/ui v4 patterns, SGT handling.

---

## File Map

**New:**
- `supabase/migrations/023_booking_cancellation.sql`
- `app/api/bookings/[id]/reschedule/route.ts`
- `app/api/bookings/[id]/cancel/route.ts`
- `components/account/RescheduleDialog.tsx`
- `components/account/CancelDialog.tsx`
- `lib/email/templates/BookingRescheduled.tsx`
- `lib/email/templates/BookingCancelled.tsx`

**Modified:**
- `lib/types.ts`
- `lib/email/send.ts`
- `app/account/bookings/page.tsx`
- `components/booking/BookingWizard.tsx`

---

## Task 1 — DB Migration

**File:** `supabase/migrations/023_booking_cancellation.sql`

```sql
ALTER TABLE bookings
  DROP CONSTRAINT bookings_status_check,
  ADD CONSTRAINT bookings_status_check
    CHECK (status IN ('PENDING','APPROVED','REJECTED','COMPLETED','CANCELLED'));

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS cancelled_reason text;
```

Apply via Supabase SQL editor. Verify: `\d bookings` shows new columns.

---

## Task 2 — Types

**File:** `lib/types.ts`

```ts
// Change:
export type BookingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
// To:
export type BookingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED'
```

---

## Task 3 — Reschedule API

**File:** `app/api/bookings/[id]/reschedule/route.ts`

```ts
export async function PATCH(req, { params }) {
  // 1. Auth: require customer role (profile.role === 'customer')
  // 2. Fetch booking where id = params.id AND customer_id = user.id
  //    → 404 if not found (guards against cross-user access)
  // 3. Check status IN ('PENDING','APPROVED') → 409 otherwise
  // 4. Compute effective date:
  //    - APPROVED: booking.confirmed_date
  //    - PENDING: preferred_date_slots[0]?.date ?? booking.booking_date
  // 5. Check cutoff: effectiveDate > now+24h (SGT = UTC+8) → 403 if too late
  // 6. Parse body: { preferred_date_slots: PreferredDateSlot[] } (1–3 entries, each with 1–3 slots)
  //    Derive: booking_date = preferred_date_slots[0].date
  //            time_slot = preferred_date_slots[0].slots[0]
  //            preferred_slots = preferred_date_slots[0].slots
  // 7. Update booking:
  //    status='PENDING', confirmed_date=null, confirmed_slot=null,
  //    booking_date, time_slot, preferred_slots, preferred_date_slots
  // 8. Send admin reschedule email (sendBookingRescheduled)
  // 9. Return { booking }
}
```

---

## Task 4 — Cancel API

**File:** `app/api/bookings/[id]/cancel/route.ts`

```ts
export async function PATCH(req, { params }) {
  // 1. Auth: require customer role
  // 2. Fetch booking where id = params.id AND customer_id = user.id → 404 if not found
  // 3. Check status IN ('PENDING','APPROVED') → 409 otherwise
  // 4. Cutoff check (same as reschedule) → 403 if too late
  // 5. Parse body: { reason?: string }
  // 6. Update: status='CANCELLED', cancelled_at=now(), cancelled_by=user.id, cancelled_reason=reason
  // 7. Send admin cancel email (sendBookingCancelled)
  // 8. Return { booking }
}
```

---

## Task 5 — Email Templates

**File:** `lib/email/templates/BookingRescheduled.tsx`

Plain React Email component. Props: `customerName`, `bookingId`, `serviceType`, `newDates: string[]` (formatted date strings).
Body: "Customer {name} has rescheduled booking #{id} ({service}) to {dates}."

**File:** `lib/email/templates/BookingCancelled.tsx`

Props: `customerName`, `bookingId`, `serviceType`, `reason?: string`.
Body: "Customer {name} has cancelled booking #{id} ({service}). Reason: {reason ?? 'None provided'}."

Follow same pattern as `BookingReceived.tsx`.

---

## Task 6 — Email Send Functions

**File:** `lib/email/send.ts` — add two functions:

```ts
export async function sendBookingRescheduled(
  data: { customerName: string; bookingId: string; serviceType: string; newDates: string[] },
  adminEmail: string
)

export async function sendBookingCancelled(
  data: { customerName: string; bookingId: string; serviceType: string; reason?: string },
  adminEmail: string
)
```

Get admin email from `app_settings` or hardcode `process.env.ADMIN_EMAIL` if settings don't store it yet. Follow existing `send*` function patterns.

---

## Task 7 — RescheduleDialog Component

**File:** `components/account/RescheduleDialog.tsx`

- `DialogTrigger` pattern from CLAUDE.md (no nested `<Button>`, use `buttonVariants`)
- Wraps `SlotCalendar` in multi-date mode (already supports up to 3 preferred_date_slots)
- On confirm: PATCH `/api/bookings/{id}/reschedule` with selected `preferred_date_slots`
- Show loading state; on success close dialog + refresh booking list
- Props: `bookingId: string`, `onSuccess: () => void`

---

## Task 8 — CancelDialog Component

**File:** `components/account/CancelDialog.tsx`

- Confirm dialog with optional `<Textarea>` for reason
- On confirm: PATCH `/api/bookings/{id}/cancel`
- Props: `bookingId: string`, `onSuccess: () => void`

---

## Task 9 — Account Bookings Page

**File:** `app/account/bookings/page.tsx`

For each booking card, add conditionally rendered buttons:

```ts
const canModify = (b: Booking) => {
  if (!['PENDING', 'APPROVED'].includes(b.status)) return false
  const effectiveDate = b.confirmed_date ?? b.preferred_date_slots?.[0]?.date ?? b.booking_date
  const cutoff = new Date(effectiveDate + 'T00:00:00+08:00')
  cutoff.setTime(cutoff.getTime() - 24 * 60 * 60 * 1000)
  return new Date() < cutoff
}
```

- Show `<RescheduleDialog>` and `<CancelDialog>` when `canModify(booking)` is true
- Show **"Book Again"** button always (links to `/book?repeat=${booking.id}`)
- Hide reschedule/cancel for CANCELLED, COMPLETED, REJECTED bookings

---

## Task 10 — BookingWizard Repeat Prefill

**File:** `components/booking/BookingWizard.tsx`

```ts
// On mount, if searchParams.get('repeat') is set:
const repeatId = searchParams.get('repeat')
if (repeatId) {
  // Fetch /api/bookings/{repeatId} (add a GET handler to /api/bookings/[id]/route.ts if not present)
  // Prefill: serviceTypeId, category, numUnits, unitLocationIds, address, accessNotes, buildingName, unitFloor
  // Do NOT prefill dates/slots (Step 1 always requires fresh selection)
}
```

If `GET /api/bookings/[id]` doesn't exist yet, add it: fetch booking where `id = params.id AND customer_id = user.id`, return it. Check this first before adding.

---

## Acceptance Checks

- [ ] Customer reschedules PENDING booking → status PENDING, new dates saved, admin emailed
- [ ] Customer reschedules APPROVED booking → status PENDING, confirmed_date/slot cleared
- [ ] Customer cancels → status CANCELLED, cancelled_at/by set
- [ ] Request <24h before booking → 403
- [ ] Request on another user's booking → 404
- [ ] "Book Again" on COMPLETED booking → wizard opens with Step 0 prefilled, Step 1 clear
- [ ] CANCELLED bookings show in history but no modify buttons
