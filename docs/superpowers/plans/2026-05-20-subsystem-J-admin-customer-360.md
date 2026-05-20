# Subsystem J — Admin Customer 360 + Agenda Week-Grid

> Execute with `superpowers:subagent-driven-development` or `superpowers:executing-plans`.

**Goal:** Admin can view a single customer's full history in one place, and see all bookings in a week-grid agenda view by slot.

**Conventions:** See `CLAUDE.md`. No new DB tables. All pages use server Supabase client (auth guard from `admin/layout.tsx`).

---

## File Map

**New:**
- `app/admin/customers/page.tsx`
- `app/admin/customers/[id]/page.tsx`
- `app/admin/agenda/page.tsx`

**Modified:**
- `app/admin/layout.tsx` — add "Customers" + "Agenda" nav links

---

## Task 1 — Admin Nav

**File:** `app/admin/layout.tsx`

Add two nav links after "Bookings":
- `Customers` → `/admin/customers`
- `Agenda` → `/admin/agenda`

Follow the existing nav link pattern in this file.

---

## Task 2 — Customers List Page

**File:** `app/admin/customers/page.tsx`

Server component. Accepts `?q=` search param (name/phone/email).

```ts
// Query: profiles WHERE role = 'customer'
// If q: filter by name ILIKE '%q%' OR phone ILIKE '%q%' OR email (from auth.users via service role)
// Also fetch customer_no from profiles
// Order by name ASC

// For each customer, show:
// - customer_no, name, phone
// - Total bookings count (subquery or join)
// - Total invoices spend (sum of invoices.amount_sgd where status='PAID')
// - Active contract badge (if any ACTIVE contract)
// - Link to /admin/customers/[id]
```

UI: search input at top (form GET action), table/card list below. Search uses standard HTML form (no client JS needed — server component pattern).

---

## Task 3 — Customer Detail Page

**File:** `app/admin/customers/[id]/page.tsx`

Server component. Fetches in parallel:

```ts
const [profile, bookings, contracts, invoices] = await Promise.all([
  supabase.from('profiles').select('*').eq('id', id).single(),
  supabase.from('bookings').select('*, service_types(name,category)').eq('customer_id', id).order('created_at', { ascending: false }),
  supabase.from('contracts').select('*, contract_service_dates(*)').eq('customer_id', id).order('created_at', { ascending: false }),
  supabase.from('invoices').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
])
```

Also fetch customer's auth email via `createAdminClient().auth.admin.getUserById(id)`.

**Layout (4 sections):**

**Profile card** — name, customer_no, phone, email, address, created_at. "Edit" button (optional for v1 — can be deferred).

**Bookings table** — date, service type, status badge, confirmed slot, address. Status filter tabs (All / Active / Past). Clicking a booking row navigates to admin bookings page filtered to that booking (or shows an inline expandable row).

**Contracts table** — start/end date, num_units, price_sgd, status badge. Each row links to `/admin/contracts/{id}`.

**Invoices table** — work_order_no, date, amount, status badge. Total paid shown at bottom.

**Total spend summary** — `sum of invoices.amount_sgd where status = 'PAID'` displayed prominently at top of page.

---

## Task 4 — Agenda Week-Grid Page

**File:** `app/admin/agenda/page.tsx`

Accepts `?week=YYYY-MM-DD` (Monday of the week, defaults to current week's Monday).

**Data fetch:**
```ts
// Compute weekStart (Monday) and weekEnd (Sunday) from ?week param
// Fetch APPROVED bookings where confirmed_date BETWEEN weekStart AND weekEnd
// Group by { confirmed_date, confirmed_slot }
```

**Grid layout:**
- 7 columns = Mon–Sun (show date label + "Today" highlight)
- 5 rows = time slots (S10_12 through S19_21) using SLOT_LABELS
- Each cell: count of bookings in that slot. Click → expandable or modal showing booking cards for that slot

**Navigation:** Prev week / Next week buttons (form GET with updated `?week=`).

**Toggle:** "APPROVED only" vs "All active" (include PENDING). Implemented as a query param `?status=approved|all`.

**Empty state:** "No bookings this week" if grid is all empty.

---

## Acceptance Checks

- [ ] `/admin/customers` lists all customers, search by name/phone works
- [ ] `/admin/customers/{id}` shows profile + all 3 history sections in parallel
- [ ] Total spend calculated correctly (PAID invoices only)
- [ ] `/admin/agenda` shows current week by default; week navigation works
- [ ] Slot grid cells show correct booking counts for APPROVED bookings
- [ ] Clicking a cell shows bookings in that slot
- [ ] Admin nav shows "Customers" and "Agenda" links
