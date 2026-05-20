# Subsystem K — Completion → Work Order Report → Send

> Execute with `superpowers:subagent-driven-development` or `superpowers:executing-plans`.

**Goal:** When admin marks a booking COMPLETED, a multi-step wizard collects job details (AC brand/model per unit, checklist, attended_by, additional charges). Admin previews a Work Order Report PDF then confirms — PDF + PayNow QR emailed to customer; invoice created as UNPAID.

**Conventions:** See `CLAUDE.md`. React-PDF is installed in Subsystem M. Supabase Storage bucket `documents` created in Subsystem M. Run Subsystem M first.

---

## File Map

**New:**
- `supabase/migrations/026_completion_invoice.sql`
- `lib/pdf/WorkOrderTemplate.tsx`
- `app/api/bookings/[id]/complete/route.ts` *(replaces the existing complete action in `[id]/route.ts`)*
- `app/api/bookings/[id]/work-order-pdf/route.ts`
- `app/api/bookings/[id]/send-work-order/route.ts`
- `components/admin/JobCompletionDialog.tsx`
- `lib/email/templates/WorkOrderEmail.tsx`

**Modified:**
- `lib/types.ts`
- `lib/email/send.ts`
- `supabase/migrations/027_service_type_price.sql`
- `app/admin/bookings/AdminBookingsClient.tsx` *(replace "Mark Complete" button)*
- `components/admin/BookingCard.tsx`

---

## Task 1 — DB Migrations

### 026_completion_invoice.sql

```sql
-- Customer number on profiles (auto-increment from 1)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS customer_no bigserial;
CREATE SEQUENCE IF NOT EXISTS customer_no_seq START 1;
-- Note: bigserial handles its own sequence; existing rows get NULL. Backfill if needed:
-- UPDATE profiles SET customer_no = nextval('profiles_customer_no_seq') WHERE customer_no IS NULL;

-- Work order number on bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS work_order_no bigserial,
  ADD COLUMN IF NOT EXISTS attended_by text;

-- Job completions table
CREATE TABLE IF NOT EXISTS job_completions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  completed_by uuid REFERENCES auth.users(id),
  completed_at timestamptz NOT NULL DEFAULT now(),
  attended_by text,
  time_arrived text,      -- e.g. '14:00'
  time_completed text,    -- e.g. '16:00'
  ac_details jsonb NOT NULL DEFAULT '[]', -- [{no, brand, model, serial_no, location}]
  checklist jsonb NOT NULL DEFAULT '[]',  -- [{item, checked, note}]
  job_description text,
  job_rendered text,
  remarks text,
  additional_charges jsonb NOT NULL DEFAULT '[]', -- [{description, amount_sgd}]
  base_price_sgd numeric,
  total_sgd numeric,
  signature_url text,
  pdf_url text,
  UNIQUE(booking_id)
);

ALTER TABLE job_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jc_admin" ON job_completions FOR ALL USING (get_my_role() = 'admin');
CREATE POLICY "jc_customer_read" ON job_completions FOR SELECT
  USING (booking_id IN (SELECT id FROM bookings WHERE customer_id = auth.uid()));
```

### 027_service_type_price.sql

```sql
ALTER TABLE service_types
  ADD COLUMN IF NOT EXISTS default_price_sgd numeric;
```

Apply both in Supabase SQL editor in order.

---

## Task 2 — Types

**File:** `lib/types.ts` — add:

```ts
export interface AcUnitDetail {
  no: number
  brand: string
  model: string
  serial_no: string
  location: string  // room name
}

export interface ChecklistItem {
  item: string
  checked: boolean
  note?: string
}

export interface AdditionalCharge {
  description: string
  amount_sgd: number
}

export interface JobCompletion {
  id: string
  booking_id: string
  attended_by: string
  time_arrived: string
  time_completed: string
  ac_details: AcUnitDetail[]
  checklist: ChecklistItem[]
  job_description: string
  job_rendered: string
  remarks: string
  additional_charges: AdditionalCharge[]
  base_price_sgd: number
  total_sgd: number
  pdf_url?: string
}
```

---

## Task 3 — Work Order PDF Template

**File:** `lib/pdf/WorkOrderTemplate.tsx`

React-PDF document matching the sample "Work Order Report" PDF:

```
Header: [HydroWash wordmark logo left] [company address center] [Work Order Report title + Work Order No right]
Customer block (table):
  Customer: {name}            | Date: {date}
  Customer No: {customer_no}  | Type of service: {serviceType}  
  Tel No: {phone}             | No of Service: {visitNo}/{totalVisits} (if contract) or "AdHoc"
  Address: {address}

AC System Details table:
  No | Brand | Model | Serial No | Location
  (one row per unit in ac_details)

Two-column section:
  Left: Checklist (item + √ or -)
  Right: Job Description (text) | Job Rendered (text) | Remarks (text)

Attended by: {attended_by}

Bottom row:
  [Sub Total: ${total_sgd}]  [Customer satisfaction confirmation block]
  [Time Arrived: {time_arrived}]  [Payment Types: PayNow]
  [Time Completed: {time_completed}]  [Sign: ___ / Name / Date]
```

Props:
```ts
interface WorkOrderProps {
  workOrderNo: number
  customerName: string
  customerNo: number
  contactNo: string
  address: string
  date: string               // '20/01/2026'
  serviceType: string        // 'AdHoc' | 'Annual Contract'
  visitNo?: number           // 3
  totalVisits?: number       // 4
  acDetails: AcUnitDetail[]
  checklist: ChecklistItem[]
  jobDescription: string
  jobRendered: string
  remarks: string
  attendedBy: string
  timeArrived: string
  timeCompleted: string
  additionalCharges: AdditionalCharge[]
  basePriceSgd: number
  totalSgd: number
  company: { address: string; phone: string; email: string }
}
```

Add `generateWorkOrderPdf(props: WorkOrderProps): Promise<Buffer>` to `lib/pdf/generate.ts`.

---

## Task 4 — Default Checklist

The checklist items from the sample PDF (used as default for MAINTENANCE bookings):

```ts
// lib/pdf/generate.ts or lib/booking/checklist.ts
export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { item: 'Air Filter Cleaned', checked: false },
  { item: 'Coils Cleaned', checked: false },
  { item: 'Fan Cleaned', checked: false },
  { item: 'Area Cleaned', checked: false },
  { item: 'Drip Tray Cleaned', checked: false },
  { item: 'Drainage Pipe Cleaned', checked: false },
  { item: 'Body Checked', checked: false },
  { item: 'Screws Checked', checked: false },
]
```

FAULT_REPAIR and INSTALLATION get a shorter default (just Body Checked + Screws Checked). Admin can edit in the dialog.

---

## Task 5 — Complete API Route

**File:** `app/api/bookings/[id]/complete/route.ts`

```ts
// POST — saves job_completion row; does NOT send email yet (preview step comes first)
// Body: JobCompletion fields (ac_details, checklist, attended_by, times, charges, base_price_sgd, etc.)
// 1. Admin auth
// 2. Fetch booking → must be APPROVED
// 3. Compute total_sgd = base_price_sgd + sum(additional_charges[].amount_sgd)
// 4. Upsert job_completions (booking_id = params.id)
// 5. Update bookings: status='COMPLETED', attended_by, work_order_no (already assigned by bigserial)
// 6. Return { jobCompletion }
```

Remove the existing `action === 'complete'` branch from `app/api/bookings/[id]/route.ts` PATCH handler and redirect to this new route.

---

## Task 6 — Work Order PDF Preview Endpoint

**File:** `app/api/bookings/[id]/work-order-pdf/route.ts`

```ts
// GET — generates PDF on the fly, returns as blob (no storage)
// Admin only
// 1. Fetch booking + job_completions + customer profile + app_settings
// 2. Determine serviceType ('AdHoc' | 'Annual Contract') + visitNo/totalVisits from contract_service_dates if linked
// 3. Build WorkOrderProps
// 4. const buf = await generateWorkOrderPdf(props)
// 5. Return Response(buf, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="work-order.pdf"' })
```

---

## Task 7 — Send Work Order Endpoint

**File:** `app/api/bookings/[id]/send-work-order/route.ts`

```ts
// POST — generates PDF, stores to Storage, sends email, creates invoice row
// Admin only. Booking must be COMPLETED and job_completions row must exist.
// 1. Generate PDF buffer via generateWorkOrderPdf(props)
// 2. Upload to Storage: documents/work-orders/{booking_id}/work-order.pdf
// 3. Update job_completions: pdf_url = storage URL
// 4. Generate PayNow QR for total_sgd amount, reference = work_order_no
// 5. Send email via sendWorkOrderReport (customer email, PDF attached, QR in body)
// 6. Create invoices row:
//    { customer_id, booking_id, amount_sgd: total_sgd, status: 'UNPAID',
//      description: `Work Order #${work_order_no}` }
// 7. Return { ok: true }
```

---

## Task 8 — Email Template + Send Function

**File:** `lib/email/templates/WorkOrderEmail.tsx`

Subject: `Your Hydrowash Work Order #${workOrderNo} — Payment Due`

Body:
- Thank you message
- Summary: service type, date, address, total amount
- PayNow QR image (inline base64)
- PayNow reference number
- PDF attached (via Resend attachments)
- Contact info

**File:** `lib/email/send.ts` — add:

```ts
export async function sendWorkOrderReport(
  data: { customerName: string; workOrderNo: number; date: string; totalSgd: number; paynowQrDataUrl: string; paynowMobile: string; referenceId: string },
  customerEmail: string,
  pdfBuffer: Buffer
)
```

---

## Task 9 — JobCompletionDialog Component

**File:** `components/admin/JobCompletionDialog.tsx`

Multi-step dialog (shadcn Dialog):

**Step 1 — Job Details:**
- Attended by (text input)
- Time Arrived / Time Completed (time inputs)
- AC System Details: table with N rows (one per booking's num_units)
  - Each row: Brand (dropdown from ac_brands), Model (text), Serial No (text), Location (prefilled from booking_unit_locations)
- Checklist: toggleable checkboxes (DEFAULT_CHECKLIST prefilled by category)
- Job Description (textarea)
- Job Rendered (textarea)
- Remarks (textarea)

**Step 2 — Pricing:**
- Base price (pre-filled from service_types.default_price_sgd if set, else blank)
- Additional charges: list with "Add charge" button → {description, amount_sgd} rows
- Total = base + sum(charges) shown live

**Step 3 — Preview:**
- "Preview Work Order PDF" button → opens `GET /api/bookings/{id}/work-order-pdf` in new tab
- "Confirm & Send to Customer" button → POST `/api/bookings/{id}/send-work-order`
- On success: close dialog, toast "Work order sent", refresh booking list

Props: `bookingId`, `booking` (for prefills), `onSuccess: () => void`

---

## Task 10 — Wire into Admin UI

**File:** `components/admin/BookingCard.tsx`

- Replace "Mark Complete" button with "Complete Job" button that opens `<JobCompletionDialog>`
- Only show for APPROVED bookings

**File:** `app/admin/bookings/AdminBookingsClient.tsx`

- Import and pass `JobCompletionDialog` through to `BookingCard`

---

## Acceptance Checks

- [ ] Admin opens completion dialog on APPROVED booking → Step 1 shows correct number of AC rows
- [ ] All 3 steps navigate correctly; data persists between steps
- [ ] POST complete → job_completions row created, booking status = COMPLETED
- [ ] GET work-order-pdf → returns valid PDF matching Work Order Report sample layout
- [ ] PDF includes: customer info, work order no, AC details table, checklist, totals
- [ ] POST send-work-order → customer receives email with PDF attached + PayNow QR
- [ ] Invoice row created in UNPAID status
- [ ] Customer No and Work Order No are sequential integers starting from 1
