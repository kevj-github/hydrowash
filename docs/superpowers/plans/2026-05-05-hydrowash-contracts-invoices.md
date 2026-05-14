# HydroWash — Contract Management & Invoice Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 1-year maintenance contracts, 3-monthly service reminders, and manual invoice tracking on top of the Phase 1 booking system.

**Architecture:** New tables (contracts, contract_service_dates, invoices) with RLS policies following Phase 1 patterns. Admin creates contracts and invoices manually; a daily cron flips reminder flags; dashboard widgets surface due services and expiring contracts.

**Tech Stack:** Next.js 15, TypeScript, Supabase (Postgres + RLS), Tailwind CSS + shadcn/ui, Vercel cron

**Prerequisite:** Phase 1 must be deployed (`docs/superpowers/plans/2026-05-04-hydrowash-booking-system.md` complete).

---

## File Map

```
app/
  admin/contracts/page.tsx                    # List + create contracts
  admin/contracts/[id]/page.tsx               # Detail, service schedule, link booking
  admin/invoices/page.tsx                     # List + create + mark paid
  account/contracts/page.tsx                  # Customer view of own contracts + invoices
  api/contracts/route.ts                      # POST: create contract + auto-generate dates
  api/contracts/[id]/link-booking/route.ts    # PATCH: link a booking to a service date
  api/invoices/route.ts                       # POST: create invoice
  api/invoices/[id]/pay/route.ts              # PATCH: mark invoice paid

  api/cron/contracts/route.ts                 # GET: daily reminder_sent flip + expiry data

components/
  admin/ContractCard.tsx
  admin/ServiceDateRow.tsx
  admin/InvoiceRow.tsx

lib/
  types.ts                                    # ADD Contract, ContractServiceDate, Invoice

supabase/
  migrations/003_contracts.sql               # New migration
```

**Modify:**
- `app/admin/page.tsx` — add two new dashboard widgets
- `vercel.json` — add /api/cron/contracts cron entry

---

## Task 1: Database Schema

**Files:**
- Create: `supabase/migrations/003_contracts.sql`

- [ ] **Step 1.1: Write `supabase/migrations/003_contracts.sql`**

```sql
-- ============================================================
-- Migration 003: Contracts, service dates, invoices
-- ============================================================

-- contracts table
create table contracts (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid not null references profiles(id) on delete cascade,
  num_units int not null,
  price_sgd numeric(10,2) not null,
  start_date date not null,
  end_date date not null,  -- always start_date + 1 year, computed on insert
  service_interval_months int not null default 3,
  notes text,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'EXPIRED', 'CANCELLED')),
  created_at timestamptz default now()
);

-- contract_service_dates table
-- auto-generated (4 rows) when a contract is created
create table contract_service_dates (
  id uuid default gen_random_uuid() primary key,
  contract_id uuid not null references contracts(id) on delete cascade,
  due_date date not null,
  reminder_sent boolean not null default false,
  booking_id uuid references bookings(id) on delete set null
);

-- invoices table
create table invoices (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid not null references profiles(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  contract_id uuid references contracts(id) on delete set null,
  amount_sgd numeric(10,2) not null,
  description text not null,
  status text not null default 'UNPAID'
    check (status in ('UNPAID', 'PAID')),
  payment_method text
    check (payment_method in ('Cash', 'PayNow', 'Bank Transfer', 'Other')),
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- RLS: enable row-level security
-- ============================================================

alter table contracts enable row level security;
alter table contract_service_dates enable row level security;
alter table invoices enable row level security;

-- contracts: admin full access; customer reads own
create policy "contracts_admin" on contracts
  for all
  using (get_my_role() = 'admin');

create policy "contracts_customer_read" on contracts
  for select
  using (customer_id = auth.uid());

-- contract_service_dates: admin full; customer reads their contract's dates
create policy "csd_admin" on contract_service_dates
  for all
  using (get_my_role() = 'admin');

create policy "csd_customer_read" on contract_service_dates
  for select
  using (
    contract_id in (
      select id from contracts where customer_id = auth.uid()
    )
  );

-- invoices: admin full; customer reads own
create policy "invoices_admin" on invoices
  for all
  using (get_my_role() = 'admin');

create policy "invoices_customer_read" on invoices
  for select
  using (customer_id = auth.uid());

-- ============================================================
-- Indexes for common query patterns
-- ============================================================

create index contracts_customer_id_idx on contracts(customer_id);
create index contracts_status_idx on contracts(status);
create index contracts_end_date_idx on contracts(end_date);
create index contract_service_dates_contract_id_idx on contract_service_dates(contract_id);
create index contract_service_dates_due_date_idx on contract_service_dates(due_date);
create index invoices_customer_id_idx on invoices(customer_id);
create index invoices_status_idx on invoices(status);
```

Apply via Supabase CLI:

```bash
npx supabase db push
```

Or paste the SQL directly into the Supabase SQL editor in your project dashboard.

- [ ] **Step 1.2: Commit**

```bash
git add supabase/migrations/003_contracts.sql
git commit -m "feat: add contracts, contract_service_dates, and invoices schema (migration 003)"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 2.1: Add Contract, ContractServiceDate, Invoice types to `lib/types.ts`**

Open `lib/types.ts` and append the following after the existing type definitions:

```typescript
// ============================================================
// Phase 1B — Contracts & Invoices
// ============================================================

export type ContractStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED'

export interface Contract {
  id: string
  customer_id: string
  num_units: number
  price_sgd: number
  start_date: string          // ISO date string "YYYY-MM-DD"
  end_date: string            // ISO date string "YYYY-MM-DD" — always start_date + 1 year
  service_interval_months: number
  notes: string | null
  status: ContractStatus
  created_at: string
}

// Contract with customer profile joined (used in admin list view)
export interface ContractWithCustomer extends Contract {
  customer: {
    id: string
    name: string
    phone: string
  }
}

// Contract with service dates and customer (used in detail view)
export interface ContractWithDetails extends ContractWithCustomer {
  contract_service_dates: ContractServiceDate[]
  invoices: Invoice[]
}

export interface ContractServiceDate {
  id: string
  contract_id: string
  due_date: string            // ISO date string "YYYY-MM-DD"
  reminder_sent: boolean
  booking_id: string | null
}

// ContractServiceDate with booking info joined (used in detail view)
export interface ContractServiceDateWithBooking extends ContractServiceDate {
  booking: {
    id: string
    status: string
    confirmed_date: string | null
    address: string
  } | null
}

export type InvoiceStatus = 'UNPAID' | 'PAID'

export type PaymentMethod = 'Cash' | 'PayNow' | 'Bank Transfer' | 'Other'

export interface Invoice {
  id: string
  customer_id: string
  booking_id: string | null
  contract_id: string | null
  amount_sgd: number
  description: string
  status: InvoiceStatus
  payment_method: PaymentMethod | null
  paid_at: string | null
  created_at: string
}

// Invoice with customer profile joined (used in admin list view)
export interface InvoiceWithCustomer extends Invoice {
  customer: {
    id: string
    name: string
    phone: string
  }
}

// ---- Payloads for API routes ----

export interface CreateContractPayload {
  customer_id: string
  num_units: number
  price_sgd: number
  start_date: string          // "YYYY-MM-DD"
  notes?: string
}

export interface LinkBookingPayload {
  service_date_id: string
  booking_id: string
}

export interface CreateInvoicePayload {
  customer_id: string
  booking_id?: string
  contract_id?: string
  amount_sgd: number
  description: string
}

export interface MarkInvoicePaidPayload {
  payment_method: PaymentMethod
}
```

- [ ] **Step 2.2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add Contract, ContractServiceDate, and Invoice TypeScript types"
```

---

## Task 3: Admin Contracts List + Create

**Files:**
- Create: `app/api/contracts/route.ts`
- Create: `app/admin/contracts/page.tsx`
- Create: `components/admin/ContractCard.tsx`

- [ ] **Step 3.1: Create `app/api/contracts/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { CreateContractPayload } from '@/lib/types'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()

  // Auth check — admin only
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body: CreateContractPayload = await req.json()
  const { customer_id, num_units, price_sgd, start_date, notes } = body

  if (!customer_id || !num_units || !price_sgd || !start_date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Compute end_date = start_date + 1 year
  const startDateObj = new Date(start_date)
  const endDateObj = new Date(startDateObj)
  endDateObj.setFullYear(endDateObj.getFullYear() + 1)
  const end_date = endDateObj.toISOString().split('T')[0]

  // Insert contract
  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .insert({
      customer_id,
      num_units,
      price_sgd,
      start_date,
      end_date,
      notes: notes ?? null,
      status: 'ACTIVE',
    })
    .select()
    .single()

  if (contractError || !contract) {
    return NextResponse.json({ error: contractError?.message ?? 'Insert failed' }, { status: 500 })
  }

  // Auto-generate 4 contract_service_dates: start_date + (3*n) months, n=1..4
  const serviceDates = [1, 2, 3, 4].map((n) => {
    const d = new Date(startDateObj)
    d.setMonth(d.getMonth() + 3 * n)
    return {
      contract_id: contract.id,
      due_date: d.toISOString().split('T')[0],
      reminder_sent: false,
      booking_id: null,
    }
  })

  const { error: datesError } = await supabase
    .from('contract_service_dates')
    .insert(serviceDates)

  if (datesError) {
    // Roll back the contract if dates insertion fails
    await supabase.from('contracts').delete().eq('id', contract.id)
    return NextResponse.json({ error: datesError.message }, { status: 500 })
  }

  return NextResponse.json({ contract }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  let query = supabase
    .from('contracts')
    .select(`
      *,
      customer:profiles!contracts_customer_id_fkey (
        id, name, phone
      ),
      contract_service_dates (
        id, due_date, reminder_sent, booking_id
      )
    `)
    .order('created_at', { ascending: false })

  if (status && ['ACTIVE', 'EXPIRED', 'CANCELLED'].includes(status)) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ contracts: data })
}
```

- [ ] **Step 3.2: Create `components/admin/ContractCard.tsx`**

```typescript
'use client'

import { ContractWithCustomer, ContractServiceDate } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import Link from 'next/link'

interface Props {
  contract: ContractWithCustomer & { contract_service_dates: ContractServiceDate[] }
}

function getNextServiceDue(dates: ContractServiceDate[]): string | null {
  const today = new Date().toISOString().split('T')[0]
  const upcoming = dates
    .filter((d) => d.due_date >= today && !d.booking_id)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
  return upcoming[0]?.due_date ?? null
}

function isServiceDueThisMonth(dates: ContractServiceDate[]): boolean {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = `${year}-${month}`
  return dates.some((d) => d.due_date.startsWith(prefix) && !d.booking_id && !d.reminder_sent)
}

function isExpiringSoon(endDate: string): boolean {
  const end = new Date(endDate)
  const in30 = new Date()
  in30.setDate(in30.getDate() + 30)
  return end <= in30
}

export default function ContractCard({ contract }: Props) {
  const nextDue = getNextServiceDue(contract.contract_service_dates)
  const dueBadge = isServiceDueThisMonth(contract.contract_service_dates)
  const expiringSoon = contract.status === 'ACTIVE' && isExpiringSoon(contract.end_date)

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    EXPIRED: 'bg-gray-100 text-gray-600',
    CANCELLED: 'bg-red-100 text-red-700',
  }

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-[#0F172A]">{contract.customer.name}</p>
            <p className="text-sm text-gray-500">{contract.customer.phone}</p>
          </div>
          <div className="flex flex-wrap gap-1 justify-end">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[contract.status]}`}>
              {contract.status}
            </span>
            {dueBadge && (
              <Badge className="bg-amber-100 text-amber-800 text-xs">Service Due</Badge>
            )}
            {expiringSoon && (
              <Badge className="bg-red-100 text-red-700 text-xs">Expiring Soon</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-1 text-sm text-gray-700">
        <p>{contract.num_units} unit{contract.num_units !== 1 ? 's' : ''} · S${contract.price_sgd.toFixed(2)}/yr</p>
        <p>
          {contract.start_date} → {contract.end_date}
        </p>
        {nextDue && (
          <p className="text-amber-700 font-medium">Next service due: {nextDue}</p>
        )}
        {contract.notes && (
          <p className="text-gray-500 italic">{contract.notes}</p>
        )}
        <div className="pt-2">
          <Link href={`/admin/contracts/${contract.id}`}>
            <Button size="sm" variant="outline">View Details</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3.3: Create `app/admin/contracts/page.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import ContractCard from '@/components/admin/ContractCard'
import { ContractWithCustomer, ContractServiceDate, CreateContractPayload } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type ContractRow = ContractWithCustomer & { contract_service_dates: ContractServiceDate[] }

export default function AdminContractsPage() {
  const supabase = createBrowserClient()
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Customers list for the "select customer" dropdown
  const [customers, setCustomers] = useState<{ id: string; name: string; phone: string }[]>([])

  // Form state
  const [form, setForm] = useState<{
    customer_id: string
    num_units: string
    price_sgd: string
    start_date: string
    notes: string
  }>({
    customer_id: '',
    num_units: '',
    price_sgd: '',
    start_date: '',
    notes: '',
  })

  async function fetchContracts() {
    setLoading(true)
    const params = statusFilter !== 'ALL' ? `?status=${statusFilter}` : ''
    const res = await fetch(`/api/contracts${params}`)
    const json = await res.json()
    setContracts(json.contracts ?? [])
    setLoading(false)
  }

  async function fetchCustomers() {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, phone')
      .eq('role', 'customer')
      .order('name')
    setCustomers(data ?? [])
  }

  useEffect(() => {
    fetchContracts()
  }, [statusFilter])

  useEffect(() => {
    fetchCustomers()
  }, [])

  // Compute end_date preview
  const endDatePreview = form.start_date
    ? (() => {
        const d = new Date(form.start_date)
        d.setFullYear(d.getFullYear() + 1)
        return d.toISOString().split('T')[0]
      })()
    : '—'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const payload: CreateContractPayload = {
      customer_id: form.customer_id,
      num_units: parseInt(form.num_units),
      price_sgd: parseFloat(form.price_sgd),
      start_date: form.start_date,
      notes: form.notes || undefined,
    }

    const res = await fetch('/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSubmitting(false)

    if (res.ok) {
      setDialogOpen(false)
      setForm({ customer_id: '', num_units: '', price_sgd: '', start_date: '', notes: '' })
      fetchContracts()
    } else {
      const err = await res.json()
      alert(`Error: ${err.error}`)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Contracts
        </h1>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0369A1] text-white hover:bg-[#0284C7]">
              + New Contract
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Contract</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Customer</Label>
                <Select
                  value={form.customer_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, customer_id: v }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer…" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.phone})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Number of Units</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.num_units}
                    onChange={(e) => setForm((f) => ({ ...f, num_units: e.target.value }))}
                    required
                    placeholder="e.g. 4"
                  />
                </div>
                <div>
                  <Label>Price (SGD)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.price_sgd}
                    onChange={(e) => setForm((f) => ({ ...f, price_sgd: e.target.value }))}
                    required
                    placeholder="e.g. 480.00"
                  />
                </div>
              </div>

              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  required
                />
                {form.start_date && (
                  <p className="text-xs text-gray-500 mt-1">End date: {endDatePreview}</p>
                )}
              </div>

              <div>
                <Label>Notes (optional)</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Includes chemical wash in June"
                  rows={2}
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#0369A1] text-white hover:bg-[#0284C7]"
              >
                {submitting ? 'Saving…' : 'Create Contract'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status filter */}
      <div className="flex gap-2">
        {['ALL', 'ACTIVE', 'EXPIRED', 'CANCELLED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
              statusFilter === s
                ? 'bg-[#0369A1] text-white border-[#0369A1]'
                : 'bg-white text-gray-600 border-gray-300 hover:border-[#0369A1]'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : contracts.length === 0 ? (
        <p className="text-gray-500">No contracts found.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {contracts.map((c) => (
            <ContractCard key={c.id} contract={c} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3.4: Commit**

```bash
git add app/api/contracts/route.ts components/admin/ContractCard.tsx app/admin/contracts/page.tsx
git commit -m "feat: admin contracts list and create — API route + ContractCard component + page"
```

---

## Task 4: Admin Contract Detail + Link Booking

**Files:**
- Create: `app/api/contracts/[id]/link-booking/route.ts`
- Create: `components/admin/ServiceDateRow.tsx`
- Create: `app/admin/contracts/[id]/page.tsx`

- [ ] **Step 4.1: Create `app/api/contracts/[id]/link-booking/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerClient()
  const { id: contractId } = await params

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { service_date_id, booking_id }: { service_date_id: string; booking_id: string } =
    await req.json()

  if (!service_date_id || !booking_id) {
    return NextResponse.json({ error: 'Missing service_date_id or booking_id' }, { status: 400 })
  }

  // Verify the service date belongs to this contract
  const { data: dateRow } = await supabase
    .from('contract_service_dates')
    .select('id, contract_id')
    .eq('id', service_date_id)
    .eq('contract_id', contractId)
    .single()

  if (!dateRow) {
    return NextResponse.json({ error: 'Service date not found for this contract' }, { status: 404 })
  }

  const { error } = await supabase
    .from('contract_service_dates')
    .update({ booking_id })
    .eq('id', service_date_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4.2: Create `components/admin/ServiceDateRow.tsx`**

```typescript
'use client'

import { ContractServiceDateWithBooking } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Props {
  index: number
  serviceDate: ContractServiceDateWithBooking
  contractId: string
  availableBookings: { id: string; label: string }[]
  onLink: (serviceDateId: string, bookingId: string) => Promise<void>
}

export default function ServiceDateRow({
  index,
  serviceDate,
  availableBookings,
  onLink,
}: Props) {
  const today = new Date().toISOString().split('T')[0]
  const isPast = serviceDate.due_date < today

  async function handleLink() {
    const bookingId = prompt(
      'Enter booking ID to link (or pick from the list):\n' +
        availableBookings.map((b) => `${b.label}: ${b.id}`).join('\n')
    )
    if (bookingId) {
      await onLink(serviceDate.id, bookingId.trim())
    }
  }

  return (
    <tr className="border-b border-gray-100 text-sm">
      <td className="py-2 px-3 text-gray-500">Visit {index + 1}</td>
      <td className="py-2 px-3 font-medium">{serviceDate.due_date}</td>
      <td className="py-2 px-3">
        {serviceDate.booking ? (
          <span className="text-green-700">Linked: {serviceDate.booking.id.slice(0, 8)}…</span>
        ) : (
          <span className={isPast ? 'text-red-600' : 'text-gray-400'}>
            {isPast ? 'Overdue — no booking' : 'Not yet booked'}
          </span>
        )}
      </td>
      <td className="py-2 px-3">
        {serviceDate.booking ? (
          <Badge className="bg-green-100 text-green-800">{serviceDate.booking.status}</Badge>
        ) : (
          <Badge className="bg-gray-100 text-gray-500">—</Badge>
        )}
      </td>
      <td className="py-2 px-3">
        {serviceDate.reminder_sent ? (
          <Badge className="bg-blue-100 text-blue-700">Reminder shown</Badge>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="py-2 px-3">
        {!serviceDate.booking_id && (
          <Button size="sm" variant="outline" onClick={handleLink}>
            Link Booking
          </Button>
        )}
      </td>
    </tr>
  )
}
```

- [ ] **Step 4.3: Create `app/admin/contracts/[id]/page.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import ServiceDateRow from '@/components/admin/ServiceDateRow'
import InvoiceRow from '@/components/admin/InvoiceRow'
import {
  ContractWithDetails,
  ContractServiceDateWithBooking,
  InvoiceWithCustomer,
} from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createBrowserClient()

  const [contract, setContract] = useState<ContractWithDetails | null>(null)
  const [serviceDates, setServiceDates] = useState<ContractServiceDateWithBooking[]>([])
  const [invoices, setInvoices] = useState<InvoiceWithCustomer[]>([])
  const [availableBookings, setAvailableBookings] = useState<
    { id: string; label: string }[]
  >([])
  const [loading, setLoading] = useState(true)

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
    }

    // Fetch APPROVED bookings for the same customer to enable linking
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

  useEffect(() => {
    fetchData()
  }, [id])

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

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>
  if (!contract) return <div className="p-8 text-red-600">Contract not found.</div>

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    EXPIRED: 'bg-gray-100 text-gray-600',
    CANCELLED: 'bg-red-100 text-red-700',
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/admin/contracts">
          <Button variant="ghost" size="sm">&larr; Back</Button>
        </Link>
        <h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Contract — {contract.customer.name}
        </h1>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[contract.status]}`}>
          {contract.status}
        </span>
      </div>

      {/* Contract Terms */}
      <section className="bg-white border rounded-xl p-5 space-y-2 text-sm">
        <h2 className="font-semibold text-[#0F172A] mb-3">Contract Terms</h2>
        <div className="grid grid-cols-2 gap-y-1 gap-x-4">
          <span className="text-gray-500">Customer</span>
          <span>{contract.customer.name} · {contract.customer.phone}</span>
          <span className="text-gray-500">Units</span>
          <span>{contract.num_units}</span>
          <span className="text-gray-500">Price</span>
          <span>S${contract.price_sgd.toFixed(2)} / year</span>
          <span className="text-gray-500">Period</span>
          <span>{contract.start_date} → {contract.end_date}</span>
          <span className="text-gray-500">Service interval</span>
          <span>Every {contract.service_interval_months} months</span>
          {contract.notes && (
            <>
              <span className="text-gray-500">Notes</span>
              <span>{contract.notes}</span>
            </>
          )}
        </div>
      </section>

      {/* Service Schedule */}
      <section className="bg-white border rounded-xl p-5">
        <h2 className="font-semibold text-[#0F172A] mb-3">Service Schedule</h2>
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

      {/* Invoices */}
      <section className="bg-white border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-[#0F172A]">Invoices</h2>
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

- [ ] **Step 4.4: Commit**

```bash
git add app/api/contracts/[id]/link-booking/route.ts components/admin/ServiceDateRow.tsx app/admin/contracts/[id]/page.tsx
git commit -m "feat: admin contract detail page with service schedule and link-booking API"
```

---

## Task 5: Admin Invoices List + Create + Mark Paid

**Files:**
- Create: `app/api/invoices/route.ts`
- Create: `app/api/invoices/[id]/pay/route.ts`
- Create: `components/admin/InvoiceRow.tsx`
- Create: `app/admin/invoices/page.tsx`

- [ ] **Step 5.1: Create `app/api/invoices/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { CreateInvoicePayload } from '@/lib/types'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body: CreateInvoicePayload = await req.json()
  const { customer_id, booking_id, contract_id, amount_sgd, description } = body

  if (!customer_id || !amount_sgd || !description) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      customer_id,
      booking_id: booking_id ?? null,
      contract_id: contract_id ?? null,
      amount_sgd,
      description,
      status: 'UNPAID',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ invoice }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const customerId = searchParams.get('customer_id')
  const contractId = searchParams.get('contract_id')

  let query = supabase
    .from('invoices')
    .select(`
      *,
      customer:profiles!invoices_customer_id_fkey (id, name, phone)
    `)
    .order('created_at', { ascending: false })

  if (status && ['UNPAID', 'PAID'].includes(status)) {
    query = query.eq('status', status)
  }
  if (customerId) {
    query = query.eq('customer_id', customerId)
  }
  if (contractId) {
    query = query.eq('contract_id', contractId)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ invoices: data })
}
```

- [ ] **Step 5.2: Create `app/api/invoices/[id]/pay/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { MarkInvoicePaidPayload } from '@/lib/types'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerClient()
  const { id } = await params

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { payment_method }: MarkInvoicePaidPayload = await req.json()

  const validMethods = ['Cash', 'PayNow', 'Bank Transfer', 'Other']
  if (!payment_method || !validMethods.includes(payment_method)) {
    return NextResponse.json({ error: 'Invalid payment_method' }, { status: 400 })
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .update({
      status: 'PAID',
      payment_method,
      paid_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ invoice })
}
```

- [ ] **Step 5.3: Create `components/admin/InvoiceRow.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { InvoiceWithCustomer, PaymentMethod } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Props {
  invoice: InvoiceWithCustomer
  onPaid: () => void
  showCustomer?: boolean
}

const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'PayNow', 'Bank Transfer', 'Other']

export default function InvoiceRow({ invoice, onPaid, showCustomer = false }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash')
  const [submitting, setSubmitting] = useState(false)

  async function handleMarkPaid() {
    setSubmitting(true)
    const res = await fetch(`/api/invoices/${invoice.id}/pay`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_method: paymentMethod }),
    })
    setSubmitting(false)
    if (res.ok) {
      setDialogOpen(false)
      onPaid()
    } else {
      const err = await res.json()
      alert(`Error: ${err.error}`)
    }
  }

  return (
    <tr className="border-b border-gray-100 text-sm hover:bg-gray-50">
      {showCustomer && (
        <td className="py-2 px-3 font-medium">{invoice.customer?.name ?? '—'}</td>
      )}
      <td className="py-2 px-3 max-w-xs truncate">{invoice.description}</td>
      <td className="py-2 px-3 font-medium">S${Number(invoice.amount_sgd).toFixed(2)}</td>
      <td className="py-2 px-3">
        {invoice.status === 'PAID' ? (
          <Badge className="bg-green-100 text-green-800">Paid</Badge>
        ) : (
          <Badge className="bg-amber-100 text-amber-800">Unpaid</Badge>
        )}
      </td>
      <td className="py-2 px-3 text-gray-500">
        {invoice.created_at.split('T')[0]}
      </td>
      <td className="py-2 px-3 text-gray-500">
        {invoice.paid_at ? invoice.paid_at.split('T')[0] : '—'}
      </td>
      <td className="py-2 px-3">
        {invoice.status === 'UNPAID' && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50">
                Mark Paid
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Mark Invoice as Paid</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  {invoice.description} — S${Number(invoice.amount_sgd).toFixed(2)}
                </p>
                <div>
                  <label className="text-sm font-medium">Payment Method</label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleMarkPaid}
                  disabled={submitting}
                  className="w-full bg-green-600 text-white hover:bg-green-700"
                >
                  {submitting ? 'Saving…' : 'Confirm Payment'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        {invoice.status === 'PAID' && (
          <span className="text-xs text-gray-400">{invoice.payment_method}</span>
        )}
      </td>
    </tr>
  )
}
```

- [ ] **Step 5.4: Create `app/admin/invoices/page.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import InvoiceRow from '@/components/admin/InvoiceRow'
import { InvoiceWithCustomer, CreateInvoicePayload } from '@/lib/types'
import { Button } from '@/components/ui/button'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function AdminInvoicesPage() {
  const supabase = createBrowserClient()
  const searchParams = useSearchParams()
  const preselectedContractId = searchParams.get('contract_id') ?? ''

  const [invoices, setInvoices] = useState<InvoiceWithCustomer[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [customers, setCustomers] = useState<{ id: string; name: string; phone: string }[]>([])
  const [contracts, setContracts] = useState<{ id: string; label: string }[]>([])
  const [bookings, setBookings] = useState<{ id: string; label: string }[]>([])

  const [form, setForm] = useState<{
    customer_id: string
    booking_id: string
    contract_id: string
    amount_sgd: string
    description: string
  }>({
    customer_id: '',
    booking_id: '',
    contract_id: preselectedContractId,
    amount_sgd: '',
    description: '',
  })

  async function fetchInvoices() {
    setLoading(true)
    const params = statusFilter !== 'ALL' ? `?status=${statusFilter}` : ''
    const res = await fetch(`/api/invoices${params}`)
    const json = await res.json()
    setInvoices(json.invoices ?? [])
    setLoading(false)
  }

  async function fetchLookupData() {
    const [{ data: custs }, { data: conts }, { data: bkgs }] = await Promise.all([
      supabase.from('profiles').select('id, name, phone').eq('role', 'customer').order('name'),
      supabase
        .from('contracts')
        .select('id, customer_id, start_date, end_date')
        .eq('status', 'ACTIVE')
        .order('start_date', { ascending: false }),
      supabase
        .from('bookings')
        .select('id, address, confirmed_date, status')
        .in('status', ['APPROVED', 'COMPLETED'])
        .order('confirmed_date', { ascending: false })
        .limit(100),
    ])
    setCustomers(custs ?? [])
    setContracts(
      (conts ?? []).map((c) => ({
        id: c.id,
        label: `${c.start_date} → ${c.end_date} (${c.customer_id.slice(0, 6)}…)`,
      }))
    )
    setBookings(
      (bkgs ?? []).map((b) => ({
        id: b.id,
        label: `${b.confirmed_date ?? 'TBD'} — ${b.address}`,
      }))
    )
  }

  useEffect(() => {
    fetchInvoices()
  }, [statusFilter])

  useEffect(() => {
    fetchLookupData()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const payload: CreateInvoicePayload = {
      customer_id: form.customer_id,
      booking_id: form.booking_id || undefined,
      contract_id: form.contract_id || undefined,
      amount_sgd: parseFloat(form.amount_sgd),
      description: form.description,
    }

    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSubmitting(false)

    if (res.ok) {
      setDialogOpen(false)
      setForm({ customer_id: '', booking_id: '', contract_id: '', amount_sgd: '', description: '' })
      fetchInvoices()
    } else {
      const err = await res.json()
      alert(`Error: ${err.error}`)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Invoices
        </h1>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0369A1] text-white hover:bg-[#0284C7]">
              + New Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Invoice</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Customer</Label>
                <Select
                  value={form.customer_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, customer_id: v }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer…" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.phone})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Link to Contract (optional)</Label>
                <Select
                  value={form.contract_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, contract_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {contracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Link to Booking (optional)</Label>
                <Select
                  value={form.booking_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, booking_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {bookings.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Amount (SGD)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.amount_sgd}
                  onChange={(e) => setForm((f) => ({ ...f, amount_sgd: e.target.value }))}
                  required
                  placeholder="e.g. 120.00"
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  required
                  placeholder="e.g. General Cleaning × 3 units"
                  rows={2}
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#0369A1] text-white hover:bg-[#0284C7]"
              >
                {submitting ? 'Saving…' : 'Create Invoice'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['ALL', 'UNPAID', 'PAID'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
              statusFilter === s
                ? 'bg-[#0369A1] text-white border-[#0369A1]'
                : 'bg-white text-gray-600 border-gray-300 hover:border-[#0369A1]'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : invoices.length === 0 ? (
        <p className="text-gray-500">No invoices found.</p>
      ) : (
        <div className="bg-white border rounded-xl overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-gray-200">
              <tr className="text-xs text-gray-400">
                <th className="py-2 px-3">Customer</th>
                <th className="py-2 px-3">Description</th>
                <th className="py-2 px-3">Amount</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Created</th>
                <th className="py-2 px-3">Paid</th>
                <th className="py-2 px-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <InvoiceRow
                  key={inv.id}
                  invoice={inv}
                  onPaid={fetchInvoices}
                  showCustomer
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5.5: Commit**

```bash
git add app/api/invoices/route.ts app/api/invoices/[id]/pay/route.ts components/admin/InvoiceRow.tsx app/admin/invoices/page.tsx
git commit -m "feat: admin invoices list, create, and mark-paid — API routes + InvoiceRow component + page"
```

---

## Task 6: Admin Dashboard Widgets

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] **Step 6.1: Add two new widget sections to `app/admin/page.tsx`**

Open `app/admin/page.tsx`. Add the following server-side data fetches for the two new widgets, then render them. Paste the additions below into the appropriate positions in the file.

The two new widgets query:
1. **Service Due This Month** — `contract_service_dates` where `due_date` is in the current month, `booking_id` is null, joined with the contract's customer name.
2. **Contracts Expiring Soon** — `contracts` where `status = 'ACTIVE'` and `end_date <= today + 30 days`.

Add these imports at the top of `app/admin/page.tsx` (if not already present):

```typescript
import { createServerClient } from '@/lib/supabase/server'
```

Add these data fetches inside the page's async function body (after the existing supabase client initialisation):

```typescript
// --- Phase 1B dashboard widget data ---

const today = new Date()
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  .toISOString().split('T')[0]
const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  .toISOString().split('T')[0]
const in30Days = new Date(today)
in30Days.setDate(in30Days.getDate() + 30)
const in30DaysStr = in30Days.toISOString().split('T')[0]
const todayStr = today.toISOString().split('T')[0]

const [{ data: serviceDueRows }, { data: expiringContracts }] = await Promise.all([
  supabase
    .from('contract_service_dates')
    .select(`
      id,
      due_date,
      contract:contracts!contract_service_dates_contract_id_fkey (
        id,
        num_units,
        customer:profiles!contracts_customer_id_fkey (
          id, name, phone
        )
      )
    `)
    .gte('due_date', firstOfMonth)
    .lte('due_date', lastOfMonth)
    .is('booking_id', null)
    .order('due_date'),
  supabase
    .from('contracts')
    .select(`
      id,
      end_date,
      num_units,
      customer:profiles!contracts_customer_id_fkey (
        id, name, phone
      )
    `)
    .eq('status', 'ACTIVE')
    .lte('end_date', in30DaysStr)
    .gte('end_date', todayStr)
    .order('end_date'),
])
```

Add the following JSX widgets to the page's return block, after the existing pending bookings summary widget:

```tsx
{/* Service Due This Month */}
{(serviceDueRows?.length ?? 0) > 0 && (
  <section className="bg-amber-50 border border-amber-200 rounded-xl p-5">
    <h2 className="font-semibold text-amber-900 mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
      Service Due This Month ({serviceDueRows!.length})
    </h2>
    <ul className="space-y-2">
      {serviceDueRows!.map((row: any) => (
        <li key={row.id} className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-800">
            {row.contract?.customer?.name ?? '—'}
          </span>
          <span className="text-gray-500">{row.due_date}</span>
          <span className="text-gray-400 text-xs">{row.contract?.num_units} unit(s)</span>
        </li>
      ))}
    </ul>
  </section>
)}

{/* Contracts Expiring Soon */}
{(expiringContracts?.length ?? 0) > 0 && (
  <section className="bg-red-50 border border-red-200 rounded-xl p-5">
    <h2 className="font-semibold text-red-900 mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
      Contracts Expiring Soon ({expiringContracts!.length})
    </h2>
    <ul className="space-y-2">
      {expiringContracts!.map((c: any) => (
        <li key={c.id} className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-800">
            {c.customer?.name ?? '—'}
          </span>
          <span className="text-red-700 font-medium">Expires {c.end_date}</span>
          <span className="text-gray-400 text-xs">{c.num_units} unit(s)</span>
        </li>
      ))}
    </ul>
  </section>
)}
```

- [ ] **Step 6.2: Add navigation links for Contracts and Invoices to admin sidebar/nav**

In `app/admin/layout.tsx`, add links to `/admin/contracts` and `/admin/invoices` in the navigation list alongside the existing admin nav items:

```tsx
<Link href="/admin/contracts" className="...">Contracts</Link>
<Link href="/admin/invoices" className="...">Invoices</Link>
```

(Use the same className pattern already used for existing admin nav links in that file.)

- [ ] **Step 6.3: Commit**

```bash
git add app/admin/page.tsx app/admin/layout.tsx
git commit -m "feat: add Service Due This Month and Contracts Expiring Soon widgets to admin dashboard"
```

---

## Task 7: Customer Contracts View

**Files:**
- Create: `app/account/contracts/page.tsx`

- [ ] **Step 7.1: Create `app/account/contracts/page.tsx`**

```typescript
import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'

export default async function AccountContractsPage() {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Fetch customer's contracts with service dates
  const { data: contracts } = await supabase
    .from('contracts')
    .select(`
      id,
      num_units,
      price_sgd,
      start_date,
      end_date,
      service_interval_months,
      notes,
      status,
      contract_service_dates (
        id,
        due_date,
        reminder_sent,
        booking_id
      )
    `)
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch customer's invoices
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, amount_sgd, description, status, payment_method, paid_at, created_at')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">
      <h1
        className="text-2xl font-bold text-[#0F172A]"
        style={{ fontFamily: 'Poppins, sans-serif' }}
      >
        My Contracts
      </h1>

      {/* Contracts */}
      {!contracts || contracts.length === 0 ? (
        <p className="text-gray-500">You have no maintenance contracts yet.</p>
      ) : (
        <div className="space-y-6">
          {contracts.map((contract) => {
            const statusColors: Record<string, string> = {
              ACTIVE: 'bg-green-100 text-green-800',
              EXPIRED: 'bg-gray-100 text-gray-600',
              CANCELLED: 'bg-red-100 text-red-700',
            }
            const sortedDates = [...(contract.contract_service_dates ?? [])].sort(
              (a, b) => a.due_date.localeCompare(b.due_date)
            )

            return (
              <div key={contract.id} className="bg-white border rounded-xl p-5 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-[#0F172A]">
                      {contract.num_units} unit{contract.num_units !== 1 ? 's' : ''} — S${Number(contract.price_sgd).toFixed(2)}/yr
                    </p>
                    <p className="text-sm text-gray-500">
                      {contract.start_date} → {contract.end_date}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[contract.status]}`}
                  >
                    {contract.status}
                  </span>
                </div>

                {contract.notes && (
                  <p className="text-sm text-gray-500 italic">{contract.notes}</p>
                )}

                {/* Service Schedule */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Service Schedule</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 border-b border-gray-100">
                        <th className="py-1 text-left">Visit</th>
                        <th className="py-1 text-left">Due Date</th>
                        <th className="py-1 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedDates.map((sd, i) => {
                        const isPast = sd.due_date < today
                        const isCompleted = !!sd.booking_id
                        return (
                          <tr key={sd.id} className="border-b border-gray-50">
                            <td className="py-1.5 text-gray-500">Visit {i + 1}</td>
                            <td className="py-1.5">{sd.due_date}</td>
                            <td className="py-1.5">
                              {isCompleted ? (
                                <Badge className="bg-green-100 text-green-800 text-xs">Booked</Badge>
                              ) : isPast ? (
                                <Badge className="bg-red-100 text-red-700 text-xs">Overdue</Badge>
                              ) : (
                                <Badge className="bg-gray-100 text-gray-500 text-xs">Upcoming</Badge>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Invoices */}
      <div>
        <h2
          className="text-xl font-bold text-[#0F172A] mb-4"
          style={{ fontFamily: 'Poppins, sans-serif' }}
        >
          My Invoices
        </h2>

        {!invoices || invoices.length === 0 ? (
          <p className="text-gray-500">No invoices on record.</p>
        ) : (
          <div className="bg-white border rounded-xl overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-gray-200">
                <tr className="text-xs text-gray-400">
                  <th className="py-2 px-3">Description</th>
                  <th className="py-2 px-3">Amount</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 px-3 max-w-xs truncate">{inv.description}</td>
                    <td className="py-2 px-3 font-medium">S${Number(inv.amount_sgd).toFixed(2)}</td>
                    <td className="py-2 px-3">
                      {inv.status === 'PAID' ? (
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          Paid {inv.payment_method ? `(${inv.payment_method})` : ''}
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 text-xs">Unpaid</Badge>
                      )}
                    </td>
                    <td className="py-2 px-3 text-gray-500">
                      {inv.created_at.split('T')[0]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 7.2: Add Contracts link to customer account nav**

In `app/account/layout.tsx`, add a link to `/account/contracts` alongside the existing `/account/bookings` link:

```tsx
<Link href="/account/contracts" className="...">Contracts & Invoices</Link>
```

(Use the same className pattern as the existing bookings link.)

- [ ] **Step 7.3: Commit**

```bash
git add app/account/contracts/page.tsx app/account/layout.tsx
git commit -m "feat: customer contracts and invoices view at /account/contracts"
```

---

## Task 8: Cron Job + vercel.json Update

**Files:**
- Create: `app/api/cron/contracts/route.ts`
- Modify: `vercel.json`

- [ ] **Step 8.1: Create `app/api/cron/contracts/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use service role client to bypass RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString().split('T')[0]
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString().split('T')[0]

  // -------------------------------------------------------
  // Check 1: Flip reminder_sent for service dates due this month
  // that have no booking and haven't been flagged yet
  // -------------------------------------------------------
  const { data: dueDates, error: fetchError } = await supabase
    .from('contract_service_dates')
    .select('id')
    .gte('due_date', firstOfMonth)
    .lte('due_date', lastOfMonth)
    .is('booking_id', null)
    .eq('reminder_sent', false)

  if (fetchError) {
    console.error('[cron/contracts] fetch error:', fetchError.message)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  let remindersFlipped = 0

  if (dueDates && dueDates.length > 0) {
    const ids = dueDates.map((d) => d.id)
    const { error: updateError } = await supabase
      .from('contract_service_dates')
      .update({ reminder_sent: true })
      .in('id', ids)

    if (updateError) {
      console.error('[cron/contracts] update error:', updateError.message)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    remindersFlipped = ids.length
  }

  // -------------------------------------------------------
  // Check 2: Surface contracts expiring within 30 days
  // (data is read live by dashboard widget — this check
  //  just logs the count for observability; no state change)
  // -------------------------------------------------------
  const in30Days = new Date(today)
  in30Days.setDate(in30Days.getDate() + 30)
  const in30DaysStr = in30Days.toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]

  const { data: expiring, error: expiryError } = await supabase
    .from('contracts')
    .select('id, end_date, customer_id')
    .eq('status', 'ACTIVE')
    .lte('end_date', in30DaysStr)
    .gte('end_date', todayStr)

  if (expiryError) {
    console.error('[cron/contracts] expiry query error:', expiryError.message)
    // Non-fatal — return partial success
  }

  const expiringCount = expiring?.length ?? 0

  console.log(
    `[cron/contracts] done — reminders flipped: ${remindersFlipped}, expiring contracts: ${expiringCount}`
  )

  return NextResponse.json({
    ok: true,
    reminders_flipped: remindersFlipped,
    expiring_contracts: expiringCount,
    run_at: new Date().toISOString(),
  })
}
```

- [ ] **Step 8.2: Update `vercel.json` to add /api/cron/contracts**

Open `vercel.json`. Add the new cron entry to the existing `crons` array. The resulting file should look like:

```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/contracts",
      "schedule": "0 0 * * *"
    }
  ]
}
```

Both crons run at midnight UTC (= 08:00 SGT) daily.

- [ ] **Step 8.3: Verify cron endpoint manually**

```bash
curl -X GET http://localhost:3000/api/cron/contracts \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected response:
```json
{
  "ok": true,
  "reminders_flipped": 0,
  "expiring_contracts": 0,
  "run_at": "2026-05-07T..."
}
```

- [ ] **Step 8.4: Commit**

```bash
git add app/api/cron/contracts/route.ts vercel.json
git commit -m "feat: daily contracts cron — flip reminder_sent flags and surface expiry data; add to vercel.json"
```

---

## Verification Checklist

After all 8 tasks are complete, run through these checks manually or with automated tests:

- [ ] Admin creates a contract for a customer → 4 `contract_service_dates` rows appear in DB with correct due dates (start + 3, 6, 9, 12 months)
- [ ] Admin contracts list shows "Service Due" badge when a service date falls in current month and `reminder_sent = false`
- [ ] Admin contracts list shows "Expiring Soon" badge when `end_date ≤ 30 days`
- [ ] Admin contract detail page shows all 4 service dates and allows linking a booking via "Link Booking"
- [ ] Admin creates an invoice (unlinked, booking-linked, and contract-linked) → all save with `status = UNPAID`
- [ ] Admin marks invoice paid → `paid_at` is recorded, `payment_method` is set, status flips to `PAID`
- [ ] Admin overview page shows both new widgets when data warrants them (widgets are hidden when count is 0)
- [ ] Customer logs in → `/account/contracts` shows their contract(s) with service schedule and invoice history
- [ ] Customer cannot create or modify contracts/invoices (RLS blocks: 403 on direct API calls)
- [ ] Cron endpoint `GET /api/cron/contracts` returns 401 without correct `CRON_SECRET`
- [ ] Cron endpoint flips `reminder_sent` from `false` to `true` for service dates due this month with no booking
- [ ] Re-running cron does not double-flip (already-true rows are excluded by `.eq('reminder_sent', false)`)
