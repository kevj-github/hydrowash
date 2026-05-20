# Subsystem M — Contract PDF + Payment (includes N: Month-Only Tracking)

> Execute with `superpowers:subagent-driven-development` or `superpowers:executing-plans`.

**Goal:** 
- (N) Switch contract service dates from exact dates to month+year tracking project-wide
- (M) Generate a branded contract PDF; admin previews before confirming; email sends PDF + PayNow QR

**Conventions:** See `CLAUDE.md`. Existing set-price + mark-paid routes exist at `app/api/contracts/[id]/set-price/` and `app/api/contracts/[id]/mark-paid/`. These will be modified, not replaced.

---

## File Map

**New:**
- `supabase/migrations/024_month_only_service_dates.sql`
- `supabase/migrations/025_app_settings_company.sql`
- `lib/pdf/ContractPdfTemplate.tsx`
- `lib/pdf/generate.ts`
- `app/api/contracts/[id]/pdf/route.ts`

**Modified:**
- `lib/contracts/service-dates.ts`
- `app/api/contracts/[id]/set-price/route.ts`
- `app/api/contracts/[id]/mark-paid/route.ts`
- `app/api/cron/contracts/route.ts`
- `app/admin/contracts/[id]/page.tsx`
- `app/admin/contracts/page.tsx`
- `app/account/contracts/page.tsx`
- `lib/email/templates/ContractPricingEmail.tsx`
- `lib/email/send.ts`
- `app/admin/settings/page.tsx`

---

## WORKSTREAM N — Month-Only Tracking

### Task N1 — Migration: due_month column

**File:** `supabase/migrations/024_month_only_service_dates.sql`

```sql
-- Add due_month (format: 'YYYY-MM') alongside due_date for display purposes.
-- due_date stays for cron queries; due_month drives display and reminder logic.
ALTER TABLE contract_service_dates
  ADD COLUMN IF NOT EXISTS due_month text; -- e.g. '2026-07'

-- Backfill from existing due_date (first of month)
UPDATE contract_service_dates
  SET due_month = to_char(due_date, 'YYYY-MM')
  WHERE due_month IS NULL;

ALTER TABLE contract_service_dates
  ALTER COLUMN due_month SET NOT NULL;

-- Add second_reminder_sent for 15th-of-month reminder
ALTER TABLE contract_service_dates
  ADD COLUMN IF NOT EXISTS second_reminder_sent boolean NOT NULL DEFAULT false;

-- App settings: add company info columns
-- (done in 025_app_settings_company.sql)
```

Apply in Supabase SQL editor.

### Task N2 — Update service-dates.ts

**File:** `lib/contracts/service-dates.ts`

Update `generateServiceDates` to also populate `due_month`:

```ts
export function generateServiceDates(contractId: string, startDate: string) {
  return [1, 2, 3, 4].map((n) => {
    const d = new Date(`${startDate}T00:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() + 3 * n)
    const due_date = d.toISOString().split('T')[0]
    const due_month = due_date.slice(0, 7) // 'YYYY-MM'
    return { contract_id: contractId, due_date, due_month, reminder_sent: false, second_reminder_sent: false, booking_id: null }
  })
}

// Helper for display
export function formatDueMonth(due_month: string): string {
  const [year, month] = due_month.split('-')
  return new Date(Number(year), Number(month) - 1).toLocaleString('en-SG', { month: 'short', year: 'numeric' })
  // e.g. 'Jul 2026'
}
```

### Task N3 — Update cron contract reminders

**File:** `app/api/cron/contracts/route.ts`

Current logic sends quarterly-due reminder based on `due_date` offset. Change to:

```ts
// Get today in SGT
const todaySGT = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
const todayMonth = todaySGT.slice(0, 7) // 'YYYY-MM'
const todayDay = parseInt(todaySGT.slice(8, 10))

// FIRST reminder: 1st of the due month AND reminder_sent = false
if (todayDay === 1) {
  // fetch contract_service_dates where due_month = todayMonth AND reminder_sent = false AND booking_id IS NULL
  // for each: send "Your service is due this month" email, mark reminder_sent = true
}

// SECOND reminder: 15th of the due month AND second_reminder_sent = false AND booking_id IS NULL
if (todayDay === 15) {
  // fetch contract_service_dates where due_month = todayMonth AND second_reminder_sent = false AND booking_id IS NULL
  // for each: send "Reminder: service not yet booked" email, mark second_reminder_sent = true
}
```

Keep existing contract expiry email logic unchanged.

### Task N4 — Display updates (month-only everywhere)

Replace all instances of formatting `due_date` with `formatDueMonth(due_month)` in:
- `admin/contracts/[id]/page.tsx` — ServiceDateRow component / service schedule table
- `account/contracts/page.tsx` — next service due display  
- `admin/contracts/page.tsx` — next-service-due filter (change from date range to month picker or keep date range but query against `due_date`)
- `components/admin/ServiceDateRow.tsx` — show "Jul 2026" not "2026-07-01"

### Task N5 — Overdue indicator in admin contracts list

**File:** `app/admin/contracts/page.tsx`

For each contract, compute whether any `contract_service_dates` row has `due_month < currentMonth AND booking_id IS NULL`. If so:
- Sort these contracts to the top of the list
- Show a red "Overdue" badge next to the contract (using `bg-destructive` token)

Server-side: when fetching contracts, also fetch their service_dates. Compute overdue flag. Pass as `isOverdue: boolean` to each contract card.

---

## WORKSTREAM M — Contract PDF

### Task M1 — App settings company info migration

**File:** `supabase/migrations/025_app_settings_company.sql`

```sql
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS company_address text NOT NULL DEFAULT '404B Fernvale Lane, S792404',
  ADD COLUMN IF NOT EXISTS company_phone text NOT NULL DEFAULT '(+65) 8811 1105',
  ADD COLUMN IF NOT EXISTS company_email text NOT NULL DEFAULT 'hydrowash20@gmail.com',
  ADD COLUMN IF NOT EXISTS company_instagram text NOT NULL DEFAULT '@Hydrowash.sg',
  ADD COLUMN IF NOT EXISTS authorised_officer_name text NOT NULL DEFAULT 'Gilbert Chen';
```

Apply in Supabase SQL editor.

### Task M2 — Admin settings UI update

**File:** `app/admin/settings/page.tsx`

Add a "Company Info" section with editable fields for all 5 new `app_settings` columns. Follow the existing settings form pattern (fetch singleton row, PATCH on save).

### Task M3 — Install React-PDF

```bash
npm install @react-pdf/renderer
```

### Task M4 — Contract PDF template

**File:** `lib/pdf/ContractPdfTemplate.tsx`

React-PDF document matching the sample contract PDF structure:
- Logo area: `HydroWash Aircon Service` text in navy (`#0F172A`) + accent (`#0369A1`) — styled text wordmark (no image file needed)
- Company address block (top right)
- Customer info block: Name, Contact No, Address
- Subject line: "Re: Annual Hydrowash Air Conditioning Cleaning Contract"
- Intro paragraph (static text from sample)
- Pricing table: Services Per Year | Units (Indoor) | Total Amount (SGD) | Schedule
  - Schedule column lists 4 month strings (e.g. "Jul 2026 / Oct 2026 / Jan 2027 / Apr 2027")
- Static scope-of-work boilerplate (copy from sample PDF verbatim, split into 2-column bullet layout)
- Exclusions section (static)
- Payment terms (static)
- Contact info from `app_settings`
- Date + signature block (customer line blank; officer = `authorised_officer_name`)

Props interface:
```ts
interface ContractPdfProps {
  customerName: string
  contactNo: string
  address: string
  numUnits: number
  unitType: string          // e.g. "Wall Mounted Unit"
  totalAmountSgd: number
  serviceDueMonths: string[] // ['Jul 2026', 'Oct 2026', 'Jan 2027', 'Apr 2027']
  issuedDate: string         // formatted e.g. "20/05/2026"
  company: {
    address: string; phone: string; email: string; instagram: string; officerName: string
  }
}
```

### Task M5 — PDF generate helper

**File:** `lib/pdf/generate.ts`

```ts
import { renderToBuffer } from '@react-pdf/renderer'

export async function generateContractPdf(props: ContractPdfProps): Promise<Buffer> {
  return renderToBuffer(<ContractPdfTemplate {...props} />)
}
```

### Task M6 — Contract PDF preview endpoint

**File:** `app/api/contracts/[id]/pdf/route.ts`

```ts
// GET /api/contracts/[id]/pdf?type=contract
// Admin only. Generates PDF on the fly (no storage). Returns as application/pdf blob.
export async function GET(req, { params }) {
  // 1. Admin auth check
  // 2. Fetch contract + customer profile + app_settings
  // 3. Build ContractPdfProps from data
  // 4. const buf = await generateContractPdf(props)
  // 5. Return new Response(buf, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="contract.pdf"' } })
}
```

### Task M7 — Modify set-price route (two-step: save then send separately)

**File:** `app/api/contracts/[id]/set-price/route.ts`

Current behaviour: saves price + status AWAITING_PAYMENT + sends email.

Split into:
- `PATCH` (existing): saves `price_sgd`, `start_date`, `end_date`, `notes`; sets status to `AWAITING_PAYMENT`; **does NOT send email** (email fires from send-pdf step).
- Remove email sending code from this route.

Add new route:

**File:** `app/api/contracts/[id]/send-contract-pdf/route.ts`

```ts
// POST — admin calls this after previewing PDF to confirm + send
// 1. Admin auth check
// 2. Fetch contract (must be AWAITING_PAYMENT) + customer + app_settings
// 3. Generate PDF buffer via generateContractPdf(props)
// 4. Upload PDF to Supabase Storage bucket 'documents' at path `contracts/{id}/contract.pdf`
//    Use service role client for storage upload
// 5. Generate PayNow QR (existing buildPayNowPayload + QRCode.toDataURL pattern from set-price)
// 6. Send email via sendContractPricing with PDF buffer attached + QR in body
// 7. Return { ok: true, pdfUrl }
```

Create Supabase Storage bucket `documents` (public: false) via dashboard or migration if not exists.

### Task M8 — Update ContractPricingEmail template

**File:** `lib/email/templates/ContractPricingEmail.tsx`

Add PDF attachment support. The PDF buffer is passed via Resend's `attachments` field in `sendContractPricing`:

```ts
// In lib/email/send.ts → sendContractPricing:
await resend.emails.send({
  ...
  attachments: pdfBuffer ? [{ filename: 'contract.pdf', content: pdfBuffer }] : [],
})
```

Update `sendContractPricing` signature to accept optional `pdfBuffer?: Buffer`.

### Task M9 — Admin contract detail UI — two-step Set Price flow

**File:** `app/admin/contracts/[id]/page.tsx`

Replace the current "Set Price" button/dialog flow with a two-step dialog:

**Step 1 — Set Price form:**
- Inputs: price_sgd, start_date, notes
- "Preview Contract PDF" button → calls PATCH set-price (saves price, status → AWAITING_PAYMENT) then opens PDF in new tab via `GET /api/contracts/{id}/pdf`

**Step 2 — Confirm & Send:**
- Shown after preview. "Confirm & Send to Customer" button → POST `/api/contracts/{id}/send-contract-pdf`
- On success: show toast, refresh contract status

Note: If admin has already set price (status = AWAITING_PAYMENT), show "Preview PDF" + "Send to Customer" buttons directly (skipping Step 1).

---

## Acceptance Checks

- [ ] `generateServiceDates` returns `due_month` field on all rows
- [ ] Service schedule displays "Jul 2026" not "2026-07-01" across admin + customer pages
- [ ] Cron fires first reminder on 1st of month, second on 15th, skips if booking_id set
- [ ] Overdue contracts (due_month passed, no booking_id) appear at top of admin list with red badge
- [ ] GET `/api/contracts/{id}/pdf` returns PDF blob (admin only)
- [ ] Admin sets price → previews PDF → confirms → customer receives email with PDF + PayNow QR attached
- [ ] PDF matches sample template structure (logo, customer block, pricing table, scope-of-work, signature)
- [ ] Company info editable in `/admin/settings`
