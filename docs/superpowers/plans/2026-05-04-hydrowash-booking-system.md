# HydroWash Booking & Admin System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js 15 web app that replaces WhatsApp-based booking with an online booking system, admin dashboard, route optimiser, and read-only technician job view.

**Architecture:** Single Next.js 15 App Router codebase serving three portals (customer, admin, technician) via role-based routing. Supabase handles Postgres + Auth. A server-side nearest-neighbour VRP runs against Google Maps Distance Matrix to auto-schedule daily routes.

**Tech Stack:** Next.js 15, TypeScript, Supabase (Postgres + Auth), Google Maps Platform, Resend + React Email, Tailwind CSS, shadcn/ui, Vercel

---

## File Map

```
app/
  (public)/layout.tsx          # Public shell (navbar, no auth)
  (public)/page.tsx            # Landing page
  (public)/services/page.tsx   # Service type listing
  auth/login/page.tsx
  auth/register/page.tsx
  auth/callback/route.ts       # Supabase auth callback
  book/page.tsx                # 3-step booking wizard (client component)
  account/layout.tsx           # Customer auth guard
  account/bookings/page.tsx    # Customer booking history
  admin/layout.tsx             # Admin auth guard
  admin/page.tsx               # Overview dashboard
  admin/bookings/page.tsx      # Approve / reject bookings
  admin/schedule/[date]/page.tsx  # Daily planner + optimiser
  admin/settings/page.tsx      # Service types, cars, technicians, depot
  technician/layout.tsx        # Technician auth guard
  technician/jobs/page.tsx     # Read-only job list
  api/bookings/route.ts        # POST: create booking
  api/bookings/[id]/route.ts   # PATCH: approve / reject / complete
  api/bookings/bulk-approve/route.ts   # POST bulk approve maintenance bookings
  api/geocode/route.ts         # POST: geocode address → lat/lng
  api/optimize/route.ts        # POST: run VRP, return schedule
  api/schedule/route.ts        # POST: confirm schedule → write DB + send emails
  api/cron/reminders/route.ts  # GET: day-before reminder cron

components/
  booking/BookingWizard.tsx
  booking/StepServiceDetails.tsx
  booking/StepDateTime.tsx
  booking/StepAddress.tsx
  booking/StepReview.tsx
  admin/BookingCard.tsx
  admin/MaintenanceMapTab.tsx
  admin/ScheduleCarColumn.tsx
  admin/JobCard.tsx
  technician/TechJobCard.tsx

lib/
  supabase/client.ts           # Browser Supabase client
  supabase/server.ts           # Server Supabase client
  supabase/admin.ts            # service role client (bypasses RLS)
  vrp/optimizer.ts             # Pure VRP function
  vrp/__tests__/optimizer.test.ts
  maps/geocode.ts              # geocoding wrapper (separate from distance-matrix)
  maps/distance-matrix.ts      # Google Maps Distance Matrix wrapper
  email/resend.ts              # Send functions
  email/templates/BookingReceived.tsx
  email/templates/BookingApproved.tsx
  email/templates/BookingRejected.tsx
  email/templates/ScheduleConfirmed.tsx
  email/templates/DayBeforeReminder.tsx
  types.ts                     # Shared TypeScript types

middleware.ts                  # Auth routing
supabase/migrations/001_schema.sql
supabase/migrations/002_rls.sql
jest.config.ts
jest.setup.ts
vercel.json                    # Cron config
.env.local
```

---

## Task 1: Project Bootstrap

**Files:**
- Create: `package.json` (via CLI), `jest.config.ts`, `jest.setup.ts`, `.env.local`

- [ ] **Scaffold Next.js project**

```bash
npx create-next-app@latest . \
  --typescript --tailwind --eslint \
  --app --src-dir=false --import-alias="@/*"
```

- [ ] **Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr \
  resend @react-email/components react-email \
  @react-google-maps/api \
  @dnd-kit/core @dnd-kit/sortable
npm install --save-dev jest jest-environment-jsdom \
  @testing-library/react @testing-library/jest-dom @types/jest
```

- [ ] **Install shadcn/ui**

```bash
npx shadcn@latest init
# When prompted: Default style, Slate colour, yes to CSS variables
npx shadcn@latest add button input label card badge select calendar textarea toast
```

- [ ] **Write `jest.config.ts`**

```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
}

export default createJestConfig(config)
```

- [ ] **Write `jest.setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Write `.env.local`**

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key   # browser - Maps JS API
GOOGLE_MAPS_API_KEY=your_google_maps_key               # server - geocoding + distance matrix
RESEND_API_KEY=your_resend_key
CRON_SECRET=your_cron_secret
```

> Get Supabase credentials from: Project Settings → API in your Supabase dashboard.
> Enable Google Maps APIs: Geocoding API + Distance Matrix API + Maps JavaScript API in Google Cloud Console.
> Get Resend key from: resend.com → API Keys.

- [ ] **Verify dev server starts**

```bash
npm run dev
```
Expected: `http://localhost:3000` loads the default Next.js page.

- [ ] **Commit**

```bash
git init && git add -A
git commit -m "chore: scaffold Next.js project with dependencies"
```

---

## Task 2: Database Schema

**Files:**
- Create: `supabase/migrations/001_schema.sql`
- Create: `supabase/migrations/002_rls.sql`

- [ ] **Write `supabase/migrations/001_schema.sql`**

```sql
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  phone text not null,
  role text not null check (role in ('customer', 'admin', 'technician')),
  service_car_id uuid,
  created_at timestamptz default now()
);

create table service_types (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  category text not null check (category in ('MAINTENANCE','FAULT_REPAIR','INSTALLATION')),
  description text not null default '',
  duration_minutes int,
  price_sgd numeric(10,2),
  active boolean not null default true,
  created_at timestamptz default now()
);

create table service_cars (
  id uuid default gen_random_uuid() primary key,
  label text not null,
  active boolean not null default true,
  created_at timestamptz default now()
);

alter table profiles
  add constraint profiles_service_car_id_fkey
  foreign key (service_car_id) references service_cars(id);

create table bookings (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid not null references profiles(id),
  category text not null check (category in ('MAINTENANCE','FAULT_REPAIR','INSTALLATION')),
  service_type_id uuid not null references service_types(id),
  address text not null,
  postal_code text not null,
  lat double precision not null,
  lng double precision not null,
  earliest_date date,
  latest_date date,
  preferred_slot text check (preferred_slot in ('MORNING','AFTERNOON','EVENING')),
  num_units int,
  fault_description text,
  urgency text check (urgency in ('HIGH','MEDIUM','LOW')),
  ac_brand text,
  ac_model text,
  room_type text,
  notes text,
  status text not null default 'PENDING'
    check (status in ('PENDING','APPROVED','REJECTED','COMPLETED')),
  confirmed_date date,
  rejection_reason text,
  created_at timestamptz default now()
);

create table daily_car_availability (
  service_car_id uuid not null references service_cars(id),
  date date not null,
  is_available boolean not null default true,
  primary key (service_car_id, date)
);

create table scheduled_jobs (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid not null references bookings(id),
  service_car_id uuid not null references service_cars(id),
  scheduled_date date not null,
  scheduled_start_time time not null,
  sequence_order int not null,
  optimized_at timestamptz not null default now()
);

create table app_settings (
  id int primary key default 1 check (id = 1),
  depot_address text not null default '',
  depot_lat double precision not null default 0,
  depot_lng double precision not null default 0,
  company_name text not null default 'HydroWash',
  contact_email text not null default ''
);

insert into app_settings (id) values (1);

insert into service_types (name, category, description, active) values
  ('AC Not Cooling', 'FAULT_REPAIR', 'Air conditioner not cooling adequately', true),
  ('Water Leaking', 'FAULT_REPAIR', 'Water dripping or leaking from unit', true),
  ('Unusual Noise', 'FAULT_REPAIR', 'Loud or unusual noise from unit', true),
  ('Not Turning On', 'FAULT_REPAIR', 'Unit does not power on', true),
  ('Other Fault', 'FAULT_REPAIR', 'Other fault — please describe', true);
```

- [ ] **Write `supabase/migrations/002_rls.sql`**

```sql
alter table profiles enable row level security;
alter table service_types enable row level security;
alter table service_cars enable row level security;
alter table bookings enable row level security;
alter table daily_car_availability enable row level security;
alter table scheduled_jobs enable row level security;
alter table app_settings enable row level security;

create or replace function get_my_role()
returns text language sql security definer stable as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function get_my_car_id()
returns uuid language sql security definer stable as $$
  select service_car_id from profiles where id = auth.uid()
$$;

-- profiles
create policy "profiles_select" on profiles for select
  using (id = auth.uid() or get_my_role() = 'admin');
create policy "profiles_insert" on profiles for insert
  with check (id = auth.uid());
create policy "profiles_update" on profiles for update
  using (id = auth.uid() or get_my_role() = 'admin');

-- service_types: public read of active; admin writes
create policy "service_types_read" on service_types for select
  using (active = true or get_my_role() = 'admin');
create policy "service_types_admin_write" on service_types for all
  using (get_my_role() = 'admin');

-- service_cars: admin + technician read; admin writes
create policy "service_cars_read" on service_cars for select
  using (get_my_role() in ('admin','technician'));
create policy "service_cars_admin_write" on service_cars for all
  using (get_my_role() = 'admin');

-- bookings: customer sees own; admin sees all
create policy "bookings_customer_read" on bookings for select
  using (customer_id = auth.uid() or get_my_role() = 'admin');
create policy "bookings_customer_insert" on bookings for insert
  with check (customer_id = auth.uid() and get_my_role() = 'customer');
create policy "bookings_admin_update" on bookings for update
  using (get_my_role() = 'admin');

-- daily_car_availability: admin full; technician read
create policy "dca_admin" on daily_car_availability for all
  using (get_my_role() = 'admin');
create policy "dca_tech_read" on daily_car_availability for select
  using (get_my_role() = 'technician');

-- scheduled_jobs: admin full; technician reads own car
create policy "sj_admin" on scheduled_jobs for all
  using (get_my_role() = 'admin');
create policy "sj_tech_read" on scheduled_jobs for select
  using (
    get_my_role() = 'technician'
    and service_car_id = get_my_car_id()
    and scheduled_date = current_date
  );

-- app_settings: anyone reads; admin updates
create policy "settings_read" on app_settings for select using (true);
create policy "settings_admin_write" on app_settings for update
  using (get_my_role() = 'admin');
```

- [ ] **Apply migrations in Supabase dashboard**

Open your Supabase project → SQL Editor → paste and run `001_schema.sql`, then `002_rls.sql`.

Expected: No errors. Tables visible in Table Editor.

- [ ] **Seed one admin user**

In Supabase SQL Editor:
```sql
-- After creating a user via Supabase Auth UI (Authentication → Users → Add user),
-- replace the UUID below with that user's id
insert into profiles (id, name, phone, role)
values ('REPLACE-WITH-ADMIN-UUID', 'Owner Name', '91234567', 'admin');
```

- [ ] **Commit**

```bash
git add supabase/
git commit -m "feat: database schema and RLS policies"
```

---

## Task 3: Types + Supabase Clients

**Files:**
- Create: `lib/types.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts`

- [ ] **Write `lib/types.ts`**

```typescript
export type UserRole = 'customer' | 'admin' | 'technician'
export type BookingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
export type BookingCategory = 'MAINTENANCE' | 'FAULT_REPAIR' | 'INSTALLATION'
export type TimeSlot = 'MORNING' | 'AFTERNOON' | 'EVENING'
export type Urgency = 'HIGH' | 'MEDIUM' | 'LOW'

export interface Profile {
  id: string
  name: string
  phone: string
  role: UserRole
  service_car_id: string | null
  created_at: string
}

export interface ServiceType {
  id: string
  name: string
  category: BookingCategory
  description: string
  duration_minutes: number | null
  price_sgd: number | null
  active: boolean
  created_at: string
}

export interface ServiceCar {
  id: string
  label: string
  active: boolean
  created_at: string
}

export interface Booking {
  id: string
  customer_id: string
  category: BookingCategory
  service_type_id: string
  address: string
  postal_code: string
  lat: number
  lng: number
  earliest_date: string | null
  latest_date: string | null
  preferred_slot: TimeSlot | null
  num_units: number | null
  fault_description: string | null
  urgency: Urgency | null
  ac_brand: string | null
  ac_model: string | null
  room_type: string | null
  notes: string | null
  status: BookingStatus
  confirmed_date: string | null
  rejection_reason: string | null
  created_at: string
}

export interface BookingWithRelations extends Booking {
  customer: Pick<Profile, 'name' | 'phone'>
  service_type: Pick<ServiceType, 'name' | 'duration_minutes' | 'price_sgd'>
}

export interface ScheduledJob {
  id: string
  booking_id: string
  service_car_id: string
  scheduled_date: string
  scheduled_start_time: string
  sequence_order: number
  optimized_at: string
}

export interface ScheduledJobWithRelations extends ScheduledJob {
  booking: BookingWithRelations
  service_car: Pick<ServiceCar, 'label'>
}

export interface AppSettings {
  depot_address: string
  depot_lat: number
  depot_lng: number
  company_name: string
  contact_email: string
}
```

- [ ] **Write `lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

- [ ] **Write `lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Write `lib/supabase/admin.ts`** (service role — bypasses RLS, server-side only)

```typescript
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
```

- [ ] **Commit**

```bash
git add lib/
git commit -m "feat: shared types and Supabase clients (including admin service role client)"
```

---

## Task 4: Auth Middleware + Login / Register

**Files:**
- Create: `middleware.ts`, `app/auth/callback/route.ts`, `app/auth/login/page.tsx`, `app/auth/register/page.tsx`

- [ ] **Write `middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  const requireRole = async (role: string) => {
    if (!user) return NextResponse.redirect(new URL('/auth/login', request.url))
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== role) return NextResponse.redirect(new URL('/', request.url))
    return null
  }

  if (pathname.startsWith('/admin')) {
    const redirect = await requireRole('admin')
    if (redirect) return redirect
  }
  if (pathname.startsWith('/technician')) {
    const redirect = await requireRole('technician')
    if (redirect) return redirect
  }
  if (pathname.startsWith('/account') || pathname.startsWith('/book')) {
    if (!user) {
      return NextResponse.redirect(
        new URL(`/auth/login?redirect=${encodeURIComponent(pathname)}`, request.url)
      )
    }
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/technician/:path*', '/account/:path*', '/book'],
}
```

- [ ] **Write `app/auth/callback/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
```

- [ ] **Write `app/auth/login/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    const redirect = searchParams.get('redirect') ?? '/'
    router.push(redirect)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email}
                onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password}
                onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              No account?{' '}
              <Link href="/auth/register" className="underline">Register</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Write `app/auth/register/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (signUpError || !data.user) {
      setError(signUpError?.message ?? 'Sign up failed')
      setLoading(false)
      return
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      name: form.name,
      phone: form.phone,
      role: 'customer',
    })

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    router.push('/account/bookings')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Create Account</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {(['name','phone','email','password'] as const).map(field => (
              <div key={field} className="space-y-1">
                <Label htmlFor={field} className="capitalize">{field}</Label>
                <Input id={field}
                  type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                  value={form[field]} onChange={set(field)} required />
              </div>
            ))}
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account…' : 'Create Account'}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Already have an account?{' '}
              <Link href="/auth/login" className="underline">Sign in</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Verify auth flow manually**

```bash
npm run dev
```
1. Go to `http://localhost:3000/auth/register` → create a test customer account
2. Go to `http://localhost:3000/auth/login` → sign in
3. Go to `http://localhost:3000/book` → should load (not redirect)
4. Sign out, go to `/admin` → should redirect to `/auth/login`

- [ ] **Commit**

```bash
git add middleware.ts app/auth/
git commit -m "feat: auth middleware, login and register pages"
```

---

## Task 5: VRP Optimiser (TDD)

**Files:**
- Create: `lib/vrp/optimizer.ts`, `lib/vrp/__tests__/optimizer.test.ts`

- [ ] **Write failing tests first — `lib/vrp/__tests__/optimizer.test.ts`**

```typescript
import { optimizeRoutes } from '../optimizer'
import type { VRPJob, VRPCar } from '../optimizer'

const oneCar: VRPCar[] = [{ carId: 'car-1' }]
const twoCars: VRPCar[] = [{ carId: 'car-1' }, { carId: 'car-2' }]

// travelMinutes[i][j]: depot=0, job locations=1..n
const matrix2x2 = [
  [0, 10, 20],
  [10, 0, 15],
  [20, 15, 0],
]

describe('optimizeRoutes', () => {
  it('returns empty array when no jobs', () => {
    expect(optimizeRoutes([], oneCar, [[0]])).toHaveLength(0)
  })

  it('assigns a single job to the first car', () => {
    const jobs: VRPJob[] = [
      { bookingId: 'b1', locationIndex: 1, durationMinutes: 60, preferredSlot: 'MORNING' },
    ]
    const result = optimizeRoutes(jobs, oneCar, [[0, 10], [10, 0]])
    expect(result).toHaveLength(1)
    expect(result[0].carId).toBe('car-1')
    expect(result[0].bookingId).toBe('b1')
    expect(result[0].sequenceOrder).toBe(1)
  })

  it('calculates start time as day-start + travel from depot', () => {
    const jobs: VRPJob[] = [
      { bookingId: 'b1', locationIndex: 1, durationMinutes: 60, preferredSlot: 'MORNING' },
    ]
    const result = optimizeRoutes(jobs, oneCar, [[0, 30], [30, 0]])
    // 8:00am (480 min) + 30 min travel = 08:30
    expect(result[0].scheduledStartTime).toBe('08:30')
  })

  it('distributes two jobs across two cars', () => {
    const jobs: VRPJob[] = [
      { bookingId: 'b1', locationIndex: 1, durationMinutes: 60, preferredSlot: 'MORNING' },
      { bookingId: 'b2', locationIndex: 2, durationMinutes: 60, preferredSlot: 'MORNING' },
    ]
    const result = optimizeRoutes(jobs, twoCars, matrix2x2)
    expect(result).toHaveLength(2)
    const usedCars = new Set(result.map(r => r.carId))
    expect(usedCars.size).toBe(2)
  })

  it('sequences jobs within one car by nearest neighbour', () => {
    // job1 is 5 min from depot, job2 is 30 min from depot
    // nearest-neighbour should pick job1 first
    const jobs: VRPJob[] = [
      { bookingId: 'b1', locationIndex: 1, durationMinutes: 30, preferredSlot: 'MORNING' },
      { bookingId: 'b2', locationIndex: 2, durationMinutes: 30, preferredSlot: 'MORNING' },
    ]
    const matrix = [
      [0, 5, 30],
      [5, 0, 10],
      [30, 10, 0],
    ]
    const result = optimizeRoutes(jobs, oneCar, matrix)
    expect(result[0].bookingId).toBe('b1')
    expect(result[1].bookingId).toBe('b2')
    expect(result[0].sequenceOrder).toBe(1)
    expect(result[1].sequenceOrder).toBe(2)
  })

  it('second job start time accounts for first job duration + travel', () => {
    const jobs: VRPJob[] = [
      { bookingId: 'b1', locationIndex: 1, durationMinutes: 60, preferredSlot: 'MORNING' },
      { bookingId: 'b2', locationIndex: 2, durationMinutes: 30, preferredSlot: 'MORNING' },
    ]
    // depot→job1: 10 min, job1→job2: 15 min
    const matrix = [[0, 10, 99], [10, 0, 15], [99, 15, 0]]
    const result = optimizeRoutes(jobs, oneCar, matrix)
    // job1 starts at 08:10 (8:00 + 10), ends 09:10
    // job2 starts at 09:25 (09:10 + 15 travel)
    expect(result[1].scheduledStartTime).toBe('09:25')
  })
})
```

- [ ] **Run tests — confirm all fail**

```bash
npx jest lib/vrp --no-coverage
```
Expected: `Cannot find module '../optimizer'`

- [ ] **Write `lib/vrp/optimizer.ts`**

```typescript
export interface VRPJob {
  bookingId: string
  locationIndex: number  // 0 = depot, 1..n = job locations
  durationMinutes: number
  preferredSlot: 'MORNING' | 'AFTERNOON' | 'EVENING'
}

export interface VRPCar {
  carId: string
}

export interface OptimizedJob {
  bookingId: string
  carId: string
  sequenceOrder: number
  scheduledStartTime: string  // "HH:mm"
}

const DAY_START_MINUTES = 8 * 60  // 08:00

function toTimeStr(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0')
  const m = (totalMinutes % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

export function optimizeRoutes(
  jobs: VRPJob[],
  cars: VRPCar[],
  travelMinutes: number[][],
): OptimizedJob[] {
  if (jobs.length === 0) return []

  const carTime = cars.map(() => DAY_START_MINUTES)
  const carLocation = cars.map(() => 0)
  const carJobs: OptimizedJob[][] = cars.map(() => [])
  const remaining = [...jobs]

  while (remaining.length > 0) {
    // Assign next job to the car that will be free soonest
    const carIdx = carTime.indexOf(Math.min(...carTime))

    // Find nearest unassigned job from this car's current location
    let bestIdx = 0
    let bestTravel = travelMinutes[carLocation[carIdx]][remaining[0].locationIndex]

    for (let j = 1; j < remaining.length; j++) {
      const travel = travelMinutes[carLocation[carIdx]][remaining[j].locationIndex]
      if (travel < bestTravel) {
        bestTravel = travel
        bestIdx = j
      }
    }

    const [job] = remaining.splice(bestIdx, 1)
    const startTime = carTime[carIdx] + bestTravel

    carJobs[carIdx].push({
      bookingId: job.bookingId,
      carId: cars[carIdx].carId,
      sequenceOrder: carJobs[carIdx].length + 1,
      scheduledStartTime: toTimeStr(startTime),
    })

    carTime[carIdx] = startTime + job.durationMinutes
    carLocation[carIdx] = job.locationIndex
  }

  return carJobs.flat()
}
```

- [ ] **Run tests — confirm all pass**

```bash
npx jest lib/vrp --no-coverage
```
Expected: `5 passed, 5 total`

- [ ] **Commit**

```bash
git add lib/vrp/
git commit -m "feat: VRP nearest-neighbour route optimiser with tests"
```

---

## Task 6: Google Maps + Geocode API Route

**Files:**
- Create: `lib/maps/distance-matrix.ts`, `app/api/geocode/route.ts`

- [ ] **Write `lib/maps/distance-matrix.ts`**

```typescript
export interface LatLng { lat: number; lng: number }

export async function getDistanceMatrix(locations: LatLng[]): Promise<number[][]> {
  const coords = locations.map(l => `${l.lat},${l.lng}`)
  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
  url.searchParams.set('origins', coords.join('|'))
  url.searchParams.set('destinations', coords.join('|'))
  url.searchParams.set('mode', 'driving')
  url.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY!)

  const res = await fetch(url.toString(), { next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`Distance Matrix HTTP ${res.status}`)

  const data = await res.json()
  if (data.status !== 'OK') throw new Error(`Distance Matrix: ${data.status}`)

  return (data.rows as any[]).map((row: any) =>
    row.elements.map((el: any) =>
      el.status === 'OK' ? Math.ceil(el.duration.value / 60) : 60
    )
  )
}

export async function geocodeAddress(address: string): Promise<LatLng> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('address', `${address}, Singapore`)
  url.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY!)

  const res = await fetch(url.toString(), { next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`Geocode HTTP ${res.status}`)

  const data = await res.json()
  if (data.status !== 'OK' || !data.results[0])
    throw new Error(`Geocode failed: ${data.status}`)

  const { lat, lng } = data.results[0].geometry.location
  return { lat, lng }
}
```

- [ ] **Write `app/api/geocode/route.ts`**

```typescript
import { geocodeAddress } from '@/lib/maps/distance-matrix'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { address } = await request.json()
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 })

  try {
    const coords = await geocodeAddress(address)
    return NextResponse.json(coords)
  } catch (err) {
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 502 })
  }
}
```

- [ ] **Verify geocode endpoint manually**

With dev server running:
```bash
curl -X POST http://localhost:3000/api/geocode \
  -H "Content-Type: application/json" \
  -d '{"address":"313 Orchard Road, Singapore 238895"}'
```
Expected: `{"lat":1.3009...,"lng":103.8383...}`

- [ ] **Commit**

```bash
git add lib/maps/ app/api/geocode/
git commit -m "feat: Google Maps geocode and distance matrix wrappers"
```

---

## Task 7: Email Templates + Send Functions

**Files:**
- Create: `lib/email/resend.ts`, `lib/email/templates/BookingReceived.tsx`, `BookingApproved.tsx`, `BookingRejected.tsx`, `ScheduleConfirmed.tsx`, `DayBeforeReminder.tsx`

- [ ] **Write `lib/email/templates/BookingReceived.tsx`**

```tsx
import { Html, Body, Heading, Text, Section } from '@react-email/components'

interface Props {
  customerName: string
  serviceName: string
  dateRange: string
  companyName: string
}

export default function BookingReceived({ customerName, serviceName, dateRange, companyName }: Props) {
  return (
    <Html>
      <Body style={{ fontFamily: 'sans-serif', padding: '24px' }}>
        <Heading>Booking Request Received</Heading>
        <Text>Hi {customerName},</Text>
        <Text>
          We've received your booking request for <strong>{serviceName}</strong>. Your requested date range is{' '}
          <strong>{dateRange}</strong>. We'll confirm your appointment date and time soon.
        </Text>
        <Text>— {companyName}</Text>
      </Body>
    </Html>
  )
}
```

- [ ] **Write `lib/email/templates/BookingApproved.tsx`**

```tsx
import { Html, Body, Heading, Text } from '@react-email/components'

interface Props {
  customerName: string
  serviceName: string
  confirmedDate: string
  companyName: string
}

export default function BookingApproved({ customerName, serviceName, confirmedDate, companyName }: Props) {
  return (
    <Html>
      <Body style={{ fontFamily: 'sans-serif', padding: '24px' }}>
        <Heading>Booking Approved</Heading>
        <Text>Hi {customerName},</Text>
        <Text>
          Your <strong>{serviceName}</strong> booking has been confirmed for <strong>{confirmedDate}</strong>.
          We'll send your exact appointment time once we plan the day's schedule.
        </Text>
        <Text>— {companyName}</Text>
      </Body>
    </Html>
  )
}
```

- [ ] **Write `lib/email/templates/BookingRejected.tsx`**

```tsx
import { Html, Body, Heading, Text } from '@react-email/components'

interface Props {
  customerName: string
  preferredDate: string
  reason: string
  companyName: string
}

export default function BookingRejected({ customerName, preferredDate, reason, companyName }: Props) {
  return (
    <Html>
      <Body style={{ fontFamily: 'sans-serif', padding: '24px' }}>
        <Heading>Booking Update</Heading>
        <Text>Hi {customerName},</Text>
        <Text>
          Unfortunately we're unable to accommodate your request for <strong>{preferredDate}</strong>.
        </Text>
        <Text><strong>Reason:</strong> {reason}</Text>
        <Text>Please visit our website to submit a new booking. — {companyName}</Text>
      </Body>
    </Html>
  )
}
```

- [ ] **Write `lib/email/templates/ScheduleConfirmed.tsx`**

```tsx
import { Html, Body, Heading, Text } from '@react-email/components'

interface Props {
  customerName: string
  serviceName: string
  scheduledDate: string
  scheduledTime: string
  address: string
  companyName: string
}

export default function ScheduleConfirmed({
  customerName, serviceName, scheduledDate, scheduledTime, address, companyName,
}: Props) {
  return (
    <Html>
      <Body style={{ fontFamily: 'sans-serif', padding: '24px' }}>
        <Heading>Appointment Confirmed</Heading>
        <Text>Hi {customerName},</Text>
        <Text>
          Your <strong>{serviceName}</strong> appointment is confirmed:
        </Text>
        <Text>📅 Date: <strong>{scheduledDate}</strong></Text>
        <Text>🕐 Time: <strong>{scheduledTime}</strong></Text>
        <Text>📍 Address: {address}</Text>
        <Text>— {companyName}</Text>
      </Body>
    </Html>
  )
}
```

- [ ] **Write `lib/email/templates/DayBeforeReminder.tsx`**

```tsx
import { Html, Body, Heading, Text } from '@react-email/components'

interface Props {
  customerName: string
  serviceName: string
  scheduledTime: string
  address: string
  companyName: string
}

export default function DayBeforeReminder({ customerName, serviceName, scheduledTime, address, companyName }: Props) {
  return (
    <Html>
      <Body style={{ fontFamily: 'sans-serif', padding: '24px' }}>
        <Heading>Reminder: Aircon Service Tomorrow</Heading>
        <Text>Hi {customerName},</Text>
        <Text>
          Just a reminder — your <strong>{serviceName}</strong> is scheduled for tomorrow at{' '}
          <strong>{scheduledTime}</strong> at {address}.
        </Text>
        <Text>— {companyName}</Text>
      </Body>
    </Html>
  )
}
```

- [ ] **Write `lib/email/resend.ts`**

```typescript
import { Resend } from 'resend'
import { render } from '@react-email/components'
import BookingReceived from './templates/BookingReceived'
import BookingApproved from './templates/BookingApproved'
import BookingRejected from './templates/BookingRejected'
import ScheduleConfirmed from './templates/ScheduleConfirmed'
import DayBeforeReminder from './templates/DayBeforeReminder'

const resend = new Resend(process.env.RESEND_API_KEY)

async function send(to: string, subject: string, html: string) {
  await resend.emails.send({ from: 'noreply@kogil-aircon.com', to, subject, html })
}

export async function sendBookingReceived(to: string, props: {
  customerName: string; serviceName: string; dateRange: string; companyName: string
}) {
  const html = await render(BookingReceived(props))
  await send(to, 'Booking Request Received — HydroWash', html)
}

export async function sendBookingApproved(to: string, props: {
  customerName: string; serviceName: string; confirmedDate: string; companyName: string
}) {
  const html = await render(BookingApproved(props))
  await send(to, 'Your Booking is Approved — HydroWash', html)
}

export async function sendBookingRejected(to: string, props: {
  customerName: string; preferredDate: string; reason: string; companyName: string
}) {
  const html = await render(BookingRejected(props))
  await send(to, 'Booking Update — HydroWash', html)
}

export async function sendScheduleConfirmed(to: string, props: {
  customerName: string; serviceName: string; scheduledDate: string;
  scheduledTime: string; address: string; companyName: string
}) {
  const html = await render(ScheduleConfirmed(props))
  await send(to, 'Appointment Confirmed — HydroWash', html)
}

export async function sendDayBeforeReminder(to: string, props: {
  customerName: string; serviceName: string; scheduledTime: string;
  address: string; companyName: string
}) {
  const html = await render(DayBeforeReminder(props))
  await send(to, 'Reminder: Aircon Service Tomorrow — HydroWash', html)
}
```

> Replace `noreply@kogil-aircon.com` with a verified sender domain in your Resend account.

- [ ] **Commit**

```bash
git add lib/email/
git commit -m "feat: email templates and Resend send functions"
```

---

## Task 8: Booking API Routes

**Files:**
- Create: `app/api/bookings/route.ts`, `app/api/bookings/[id]/route.ts`

- [ ] **Write `app/api/bookings/route.ts`** (customer creates booking)

```typescript
import { createClient } from '@/lib/supabase/server'
import { geocodeAddress } from '@/lib/maps/distance-matrix'
import { sendBookingReceived } from '@/lib/email/resend'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    category, service_type_id,
    earliest_date, latest_date, preferred_slot,
    num_units, fault_description, urgency,
    ac_brand, ac_model, room_type,
    address, postal_code, notes,
  } = body

  let lat: number, lng: number
  try {
    const coords = await geocodeAddress(`${address} ${postal_code}`)
    lat = coords.lat
    lng = coords.lng
  } catch {
    return NextResponse.json({ error: 'Could not geocode address' }, { status: 422 })
  }

  const { data: booking, error } = await supabase.from('bookings').insert({
    customer_id: user.id,
    category,
    service_type_id,
    earliest_date: earliest_date ?? null,
    latest_date: latest_date ?? null,
    preferred_slot: preferred_slot ?? null,
    num_units: num_units ?? null,
    fault_description: fault_description ?? null,
    urgency: urgency ?? null,
    ac_brand: ac_brand ?? null,
    ac_model: ac_model ?? null,
    room_type: room_type ?? null,
    address,
    postal_code,
    lat,
    lng,
    notes: notes ?? null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
  const { data: serviceType } = await supabase.from('service_types').select('name').eq('id', service_type_id).single()
  const { data: settings } = await supabase.from('app_settings').select('company_name').eq('id', 1).single()

  if (profile && serviceType && settings) {
    await sendBookingReceived(user.email!, {
      customerName: profile.name,
      serviceName: serviceType.name,
      dateRange: earliest_date && latest_date ? `${earliest_date} – ${latest_date}` : 'To be confirmed',
      companyName: settings.company_name,
    }).catch(console.error)
  }

  return NextResponse.json(booking, { status: 201 })
}
```

- [ ] **Write `app/api/bookings/[id]/route.ts`** (admin approve/reject/complete)

```typescript
import { createClient } from '@/lib/supabase/server'
import { sendBookingApproved, sendBookingRejected } from '@/lib/email/resend'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { action, rejection_reason } = body as {
    action: 'approve' | 'reject' | 'complete'
    rejection_reason?: string
  }

  const statusMap = { approve: 'APPROVED', reject: 'REJECTED', complete: 'COMPLETED' } as const
  const newStatus = statusMap[action]

  const updatePayload: Record<string, string> = { status: newStatus }
  if (action === 'approve') {
    const { confirmed_date } = body as { confirmed_date: string }
    updatePayload.confirmed_date = confirmed_date
  }
  if (action === 'reject' && rejection_reason) updatePayload.rejection_reason = rejection_reason

  const { data: booking, error } = await supabase
    .from('bookings').update(updatePayload).eq('id', id)
    .select(`*, customer:profiles(name), service_type:service_types(name)`).single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: settings } = await supabase.from('app_settings').select('company_name').eq('id', 1).single()
  const companyName = settings?.company_name ?? 'HydroWash'
  const customerEmail = booking.customer_id // we need email from auth

  // Fetch customer email from auth (requires service role)
  const { createClient: createServiceClient } = await import('@supabase/supabase-js')
  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: { user: customerUser } } = await adminClient.auth.admin.getUserById(booking.customer_id)

  if (customerUser?.email && booking.customer && booking.service_type) {
    if (action === 'approve') {
      await sendBookingApproved(customerUser.email, {
        customerName: (booking.customer as any).name,
        serviceName: (booking.service_type as any).name,
        confirmedDate: booking.confirmed_date ?? '',
        companyName,
      }).catch(console.error)
    } else if (action === 'reject') {
      await sendBookingRejected(customerUser.email, {
        customerName: (booking.customer as any).name,
        confirmedDate: '',
        companyName,
        reason: rejection_reason ?? 'No reason provided',
      }).catch(console.error)
    }
  }

  return NextResponse.json(booking)
}
```

- [ ] **Write `app/api/bookings/bulk-approve/route.ts`** (bulk approve maintenance bookings)

```typescript
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBookingApproved } from '@/lib/email/resend'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { bookingIds, confirmedDate } = await request.json() as {
    bookingIds: string[]
    confirmedDate: string
  }

  // Fetch the selected bookings to validate date ranges
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, customer_id, earliest_date, latest_date, service_type_id')
    .in('id', bookingIds)
    .eq('status', 'PENDING')

  if (!bookings?.length) return NextResponse.json({ error: 'No bookings found' }, { status: 404 })

  const compatible = bookings.filter(b =>
    (!b.earliest_date || b.earliest_date <= confirmedDate) &&
    (!b.latest_date || b.latest_date >= confirmedDate)
  )
  const excluded = bookings.filter(b => !compatible.find(c => c.id === b.id))

  if (compatible.length === 0) {
    return NextResponse.json({
      approved: [], excluded: bookings.map(b => b.id), excludedCount: bookings.length,
      message: 'No bookings fit the chosen date.',
    })
  }

  // Approve compatible bookings
  await supabase.from('bookings')
    .update({ status: 'APPROVED', confirmed_date: confirmedDate })
    .in('id', compatible.map(b => b.id))

  // Send approval emails
  const adminClient = createAdminClient()
  const { data: settings } = await supabase.from('app_settings').select('company_name').eq('id', 1).single()
  const companyName = settings?.company_name ?? 'HydroWash'

  for (const booking of compatible) {
    const { data: { user: customerUser } } = await adminClient.auth.admin.getUserById(booking.customer_id)
    const { data: customerProfile } = await supabase.from('profiles').select('name').eq('id', booking.customer_id).single()
    const { data: serviceType } = await supabase.from('service_types').select('name').eq('id', booking.service_type_id).single()
    if (customerUser?.email && customerProfile && serviceType) {
      await sendBookingApproved(customerUser.email, {
        customerName: customerProfile.name,
        serviceName: serviceType.name,
        confirmedDate,
        companyName,
      }).catch(console.error)
    }
  }

  return NextResponse.json({
    approved: compatible.map(b => b.id),
    excluded: excluded.map(b => b.id),
    excludedCount: excluded.length,
  })
}
```

- [ ] **Commit**

```bash
git add app/api/bookings/
git commit -m "feat: booking creation and admin approve/reject/bulk-approve API routes"
```

---

## Task 9: Optimize + Schedule Confirm API Routes

**Files:**
- Create: `app/api/optimize/route.ts`, `app/api/schedule/route.ts`

- [ ] **Write `app/api/optimize/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { getDistanceMatrix } from '@/lib/maps/distance-matrix'
import { optimizeRoutes } from '@/lib/vrp/optimizer'
import type { VRPJob, VRPCar } from '@/lib/vrp/optimizer'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date } = await request.json()
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  // Fetch depot
  const { data: settings } = await supabase.from('app_settings').select('*').eq('id', 1).single()
  if (!settings) return NextResponse.json({ error: 'App settings not configured' }, { status: 500 })

  // Fetch available cars for date
  const { data: cars } = await supabase.from('service_cars')
    .select('id, label').eq('active', true)
  const { data: unavailable } = await supabase.from('daily_car_availability')
    .select('service_car_id').eq('date', date).eq('is_available', false)

  const unavailableIds = new Set((unavailable ?? []).map((r: any) => r.service_car_id))
  const availableCars = (cars ?? []).filter((c: any) => !unavailableIds.has(c.id))

  if (availableCars.length === 0)
    return NextResponse.json({ error: 'No available cars for this date' }, { status: 422 })

  // Fetch approved bookings for date
  const { data: bookings } = await supabase.from('bookings')
    .select('id, lat, lng, num_units, preferred_slot, service_type:service_types(duration_minutes)')
    .eq('confirmed_date', date).eq('status', 'APPROVED')

  if (!bookings?.length)
    return NextResponse.json({ error: 'No approved bookings for this date' }, { status: 422 })

  // Build locations: [depot, ...job locations]
  const locations = [
    { lat: settings.depot_lat, lng: settings.depot_lng },
    ...bookings.map((b: any) => ({ lat: b.lat, lng: b.lng })),
  ]

  const travelMatrix = await getDistanceMatrix(locations)

  const vrpJobs: VRPJob[] = bookings.map((b: any, i: number) => ({
    bookingId: b.id,
    locationIndex: i + 1,
    durationMinutes: ((b.service_type as any).duration_minutes ?? 60) * (b.num_units ?? 1),
    preferredSlot: b.preferred_slot,
  }))

  const vrpCars: VRPCar[] = availableCars.map((c: any) => ({ carId: c.id }))
  const result = optimizeRoutes(vrpJobs, vrpCars, travelMatrix)

  return NextResponse.json({ optimizedJobs: result, totalTravelMatrix: travelMatrix })
}
```

- [ ] **Write `app/api/schedule/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { sendScheduleConfirmed } from '@/lib/email/resend'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { date, jobs } = await request.json()
  // jobs: Array<{ bookingId, carId, sequenceOrder, scheduledStartTime }>

  // Delete any existing scheduled_jobs for this date first
  await supabase.from('scheduled_jobs').delete().eq('scheduled_date', date)

  // Insert new schedule
  const { error } = await supabase.from('scheduled_jobs').insert(
    jobs.map((j: any) => ({
      booking_id: j.bookingId,
      service_car_id: j.carId,
      scheduled_date: date,
      scheduled_start_time: j.scheduledStartTime,
      sequence_order: j.sequenceOrder,
    }))
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update booking statuses to keep them APPROVED (already is, nothing to change)
  // Send confirmation emails to all customers
  const adminSupa = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: settings } = await supabase.from('app_settings').select('*').eq('id', 1).single()
  const companyName = settings?.company_name ?? 'HydroWash'

  for (const job of jobs) {
    const { data: booking } = await supabase.from('bookings')
      .select('*, customer:profiles(name), service_type:service_types(name)')
      .eq('id', job.bookingId).single()

    if (!booking) continue
    const { data: { user: customerUser } } = await adminSupa.auth.admin.getUserById(booking.customer_id)
    if (!customerUser?.email) continue

    await sendScheduleConfirmed(customerUser.email, {
      customerName: (booking.customer as any).name,
      serviceName: (booking.service_type as any).name,
      scheduledDate: date,
      scheduledTime: job.scheduledStartTime,
      address: booking.address,
      companyName,
    }).catch(console.error)
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Commit**

```bash
git add app/api/optimize/ app/api/schedule/
git commit -m "feat: VRP optimize and schedule confirm API routes"
```

---

## Task 10: Services Page + Booking Wizard

**Files:**
- Create: `app/(public)/services/page.tsx`
- Create: `app/book/page.tsx`
- Create: `components/booking/BookingWizard.tsx`
- Create: `components/booking/StepServiceDetails.tsx`
- Create: `components/booking/StepDateTime.tsx`
- Create: `components/booking/StepAddress.tsx`
- Create: `components/booking/StepReview.tsx`

- [ ] **Step 10.1: Write `app/(public)/services/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

const CATEGORY_LABELS: Record<string, string> = {
  MAINTENANCE: 'Maintenance',
  FAULT_REPAIR: 'Fault Repair',
  INSTALLATION: 'Installation',
}

export default async function ServicesPage() {
  const supabase = await createClient()
  const { data: services } = await supabase
    .from('service_types').select('*').eq('active', true).order('category').order('name')

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">Our Services</h1>
      <p className="text-muted-foreground mb-8">Professional aircon servicing across Singapore</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {(services ?? []).map((s: any) => (
          <Card key={s.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-base">{s.name}</CardTitle>
                <Badge variant="outline">{CATEGORY_LABELS[s.category]}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">{s.description}</p>
              {s.duration_minutes && <p>⏱ ~{s.duration_minutes} min per unit</p>}
              {s.price_sgd && <p className="font-semibold">From ${s.price_sgd.toFixed(2)} / unit</p>}
              <Button asChild className="w-full">
                <Link href="/book">Book Now</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 10.2: Write `app/book/page.tsx`** — category picker + 4-step wizard

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { BookingCategory, ServiceType, TimeSlot, Urgency } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

// ── Draft state ──────────────────────────────────────────────────────────────
interface Draft {
  category: BookingCategory | null
  service_type_id: string
  // date range
  earliest_date: string
  latest_date: string
  preferred_slot: TimeSlot | ''
  // MAINTENANCE + INSTALLATION
  num_units: number
  // FAULT_REPAIR
  fault_description: string
  urgency: Urgency | ''
  // INSTALLATION
  ac_brand: string
  ac_model: string
  room_type: string
  // address
  address: string
  postal_code: string
  lat: number | null
  lng: number | null
  notes: string
}

const INITIAL: Draft = {
  category: null, service_type_id: '',
  earliest_date: '', latest_date: '', preferred_slot: '',
  num_units: 1,
  fault_description: '', urgency: '',
  ac_brand: '', ac_model: '', room_type: '',
  address: '', postal_code: '', lat: null, lng: null,
  notes: '',
}

const SLOTS: { value: TimeSlot; label: string }[] = [
  { value: 'MORNING', label: 'Morning (8am – 12pm)' },
  { value: 'AFTERNOON', label: 'Afternoon (12pm – 5pm)' },
  { value: 'EVENING', label: 'Evening (5pm – 9pm)' },
]

const URGENCY_OPTIONS: { value: Urgency; label: string }[] = [
  { value: 'HIGH', label: 'High — not working at all / serious issue' },
  { value: 'MEDIUM', label: 'Medium — working but with problems' },
  { value: 'LOW', label: 'Low — minor issue, not urgent' },
]

const ROOM_TYPES = ['Bedroom', 'Living Room', 'Office', 'Kitchen', 'Other']

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BookPage() {
  const router = useRouter()
  const supabase = createClient()
  const [draft, setDraft] = useState<Draft>(INITIAL)
  const [step, setStep] = useState(0)   // 0 = category picker, 1-4 = wizard steps
  const [services, setServices] = useState<ServiceType[]>([])
  const [verifying, setVerifying] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function update(updates: Partial<Draft>) {
    setDraft(prev => ({ ...prev, ...updates }))
  }

  useEffect(() => {
    if (!draft.category) return
    supabase.from('service_types').select('*').eq('active', true).eq('category', draft.category)
      .then(({ data }) => setServices((data as ServiceType[]) ?? []))
  }, [draft.category])

  // ── Step validation ──────────────────────────────────────────────────────────
  function canAdvance(): boolean {
    if (step === 0) return !!draft.category
    if (step === 1) {
      if (!draft.service_type_id) return false
      if (draft.category === 'FAULT_REPAIR') return !!draft.fault_description && !!draft.urgency
      if (draft.category === 'INSTALLATION') return draft.num_units >= 1
      return draft.num_units >= 1  // MAINTENANCE
    }
    if (step === 2) return !!draft.earliest_date && !!draft.latest_date && !!draft.preferred_slot
    if (step === 3) return !!draft.address && !!draft.postal_code && draft.lat !== null
    return true
  }

  // ── Geocode ──────────────────────────────────────────────────────────────────
  async function verifyAddress() {
    setVerifying(true)
    setError('')
    const res = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: `${draft.address} ${draft.postal_code}` }),
    })
    if (!res.ok) { setError('Could not verify address.'); setVerifying(false); return }
    const { lat, lng } = await res.json()
    update({ lat, lng })
    setVerifying(false)
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: draft.category,
        service_type_id: draft.service_type_id,
        earliest_date: draft.earliest_date,
        latest_date: draft.latest_date,
        preferred_slot: draft.preferred_slot || null,
        num_units: draft.category !== 'FAULT_REPAIR' ? draft.num_units : null,
        fault_description: draft.category === 'FAULT_REPAIR' ? draft.fault_description : null,
        urgency: draft.category === 'FAULT_REPAIR' ? draft.urgency : null,
        ac_brand: draft.category === 'INSTALLATION' ? (draft.ac_brand || null) : null,
        ac_model: draft.category === 'INSTALLATION' ? (draft.ac_model || null) : null,
        room_type: draft.category === 'INSTALLATION' ? (draft.room_type || null) : null,
        address: draft.address,
        postal_code: draft.postal_code,
        notes: draft.notes || null,
      }),
    })
    if (!res.ok) {
      const { error: msg } = await res.json()
      setError(msg ?? 'Booking failed')
      setSubmitting(false)
      return
    }
    router.push('/account/bookings?success=1')
  }

  // ── Step labels ───────────────────────────────────────────────────────────────
  const stepLabels =
    draft.category === 'FAULT_REPAIR'
      ? ['Category', 'Fault Details', 'Availability', 'Address', 'Review']
      : draft.category === 'INSTALLATION'
      ? ['Category', 'Unit Details', 'Date Range', 'Address', 'Review']
      : ['Category', 'Service Details', 'Date Range', 'Address', 'Review']

  const today = new Date().toISOString().split('T')[0]

  return (
    <main className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Book a Service</h1>

      {/* Progress bar */}
      <div className="flex gap-1 mb-6">
        {stepLabels.map((label, i) => (
          <div key={i} className="flex-1 text-center text-xs">
            <div className={`h-1 rounded mb-1 ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
            <span className={i === step ? 'text-primary font-medium' : 'text-muted-foreground'}>{label}</span>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">

          {/* Step 0: Category selection */}
          {step === 0 && (
            <div className="space-y-3">
              <Label>What do you need?</Label>
              {([
                { value: 'MAINTENANCE', label: 'Maintenance', desc: 'General cleaning, chemical wash, servicing' },
                { value: 'FAULT_REPAIR', label: 'Fault Repair', desc: 'AC not cooling, leaking, noisy, or won\'t turn on' },
                { value: 'INSTALLATION', label: 'Installation', desc: 'Install a new aircon unit' },
              ] as const).map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => update({ category: opt.value, service_type_id: '' })}
                  className={`w-full text-left border rounded-lg p-4 transition-colors
                    ${draft.category === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-sm text-muted-foreground">{opt.desc}</p>
                </button>
              ))}
            </div>
          )}

          {/* Step 1: Service / fault / unit details */}
          {step === 1 && draft.category === 'MAINTENANCE' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Service Type</Label>
                <select className="w-full border rounded px-3 py-2 bg-background"
                  value={draft.service_type_id}
                  onChange={e => update({ service_type_id: e.target.value })}>
                  <option value="">Select service…</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name}{s.price_sgd ? ` — $${s.price_sgd}/unit` : ''}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Number of Units</Label>
                <Input type="number" min={1} max={20} value={draft.num_units}
                  onChange={e => update({ num_units: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="space-y-1">
                <Label>Notes (optional)</Label>
                <Textarea placeholder="e.g. No lift access" value={draft.notes}
                  onChange={e => update({ notes: e.target.value })} />
              </div>
            </div>
          )}

          {step === 1 && draft.category === 'FAULT_REPAIR' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Fault Type</Label>
                <select className="w-full border rounded px-3 py-2 bg-background"
                  value={draft.service_type_id}
                  onChange={e => update({ service_type_id: e.target.value })}>
                  <option value="">Select fault…</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Urgency</Label>
                {URGENCY_OPTIONS.map(opt => (
                  <label key={opt.value}
                    className={`flex items-center gap-3 border rounded p-3 cursor-pointer
                      ${draft.urgency === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>
                    <input type="radio" name="urgency" value={opt.value}
                      checked={draft.urgency === opt.value}
                      onChange={() => update({ urgency: opt.value })} />
                    {opt.label}
                  </label>
                ))}
              </div>
              <div className="space-y-1">
                <Label>Describe the problem</Label>
                <Textarea placeholder="e.g. AC runs but room stays warm, started 3 days ago"
                  value={draft.fault_description}
                  onChange={e => update({ fault_description: e.target.value })} />
              </div>
            </div>
          )}

          {step === 1 && draft.category === 'INSTALLATION' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Number of Units to Install</Label>
                <Input type="number" min={1} max={10} value={draft.num_units}
                  onChange={e => update({ num_units: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="space-y-1">
                <Label>AC Brand (optional)</Label>
                <Input placeholder="e.g. Daikin, Mitsubishi, Panasonic" value={draft.ac_brand}
                  onChange={e => update({ ac_brand: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>AC Model (optional)</Label>
                <Input placeholder="e.g. FTKM35VVMM" value={draft.ac_model}
                  onChange={e => update({ ac_model: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Room Type</Label>
                <select className="w-full border rounded px-3 py-2 bg-background"
                  value={draft.room_type}
                  onChange={e => update({ room_type: e.target.value })}>
                  <option value="">Select room…</option>
                  {ROOM_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Notes (optional)</Label>
                <Textarea placeholder="e.g. Wall type, needs condenser on roof" value={draft.notes}
                  onChange={e => update({ notes: e.target.value })} />
              </div>
              {/* service_type_id hidden — pick first INSTALLATION type */}
              {services.length > 0 && !draft.service_type_id && update({ service_type_id: services[0].id })}
            </div>
          )}

          {/* Step 2: Date range */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Earliest Acceptable Date</Label>
                <input type="date" className="w-full border rounded px-3 py-2 bg-background"
                  min={today} value={draft.earliest_date}
                  onChange={e => update({ earliest_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Latest Acceptable Date</Label>
                <input type="date" className="w-full border rounded px-3 py-2 bg-background"
                  min={draft.earliest_date || today} value={draft.latest_date}
                  onChange={e => update({ latest_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Preferred Time Slot</Label>
                {SLOTS.map(slot => (
                  <label key={slot.value}
                    className={`flex items-center gap-3 border rounded p-3 cursor-pointer
                      ${draft.preferred_slot === slot.value ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>
                    <input type="radio" name="slot" value={slot.value}
                      checked={draft.preferred_slot === slot.value}
                      onChange={() => update({ preferred_slot: slot.value })} />
                    {slot.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Address */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Street Address</Label>
                <Input placeholder="e.g. 123 Tampines Ave 4 #05-12"
                  value={draft.address}
                  onChange={e => update({ address: e.target.value, lat: null, lng: null })} />
              </div>
              <div className="space-y-1">
                <Label>Postal Code</Label>
                <Input placeholder="e.g. 528523" maxLength={6}
                  value={draft.postal_code}
                  onChange={e => update({ postal_code: e.target.value, lat: null, lng: null })} />
              </div>
              <Button type="button" variant="outline" onClick={verifyAddress}
                disabled={!draft.address || !draft.postal_code || verifying}>
                {verifying ? 'Verifying…' : 'Verify Address'}
              </Button>
              {draft.lat && draft.lng && (
                <p className="text-sm text-green-600">✓ Address verified</p>
              )}
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-2 text-sm">
              <h3 className="font-semibold text-base">Review your booking</h3>
              <Row label="Category" value={draft.category ?? ''} />
              <Row label="Service" value={services.find(s => s.id === draft.service_type_id)?.name ?? '—'} />
              {draft.category !== 'FAULT_REPAIR' && <Row label="Units" value={`${draft.num_units}`} />}
              {draft.category === 'FAULT_REPAIR' && <>
                <Row label="Urgency" value={draft.urgency ?? ''} />
                <Row label="Problem" value={draft.fault_description} />
              </>}
              {draft.category === 'INSTALLATION' && <>
                {draft.ac_brand && <Row label="Brand" value={draft.ac_brand} />}
                {draft.room_type && <Row label="Room" value={draft.room_type} />}
              </>}
              <Row label="Earliest date" value={draft.earliest_date} />
              <Row label="Latest date" value={draft.latest_date} />
              <Row label="Preferred slot" value={draft.preferred_slot ?? ''} />
              <Row label="Address" value={`${draft.address}, S${draft.postal_code}`} />
              {draft.notes && <Row label="Notes" value={draft.notes} />}
              <p className="text-xs text-muted-foreground pt-2">
                We'll confirm your appointment date and time by email.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Navigation */}
          <div className="flex gap-2 pt-2">
            {step > 0 && <Button variant="outline" onClick={() => setStep(s => s - 1)}>Back</Button>}
            {step < 4 ? (
              <Button className="flex-1" disabled={!canAdvance()} onClick={() => setStep(s => s + 1)}>
                Next
              </Button>
            ) : (
              <Button className="flex-1" disabled={submitting} onClick={handleSubmit}>
                {submitting ? 'Submitting…' : 'Confirm Booking'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-36 shrink-0">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
```

> Note: `components/booking/StepServiceDetails.tsx`, `StepDateTime.tsx`, `StepAddress.tsx`, and `StepReview.tsx` are no longer needed as separate files — the new `app/book/page.tsx` implements all steps inline to support the 3-category flow with branching logic.

- [ ] **Write `app/account/bookings/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { BookingWithRelations } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { redirect } from 'next/navigation'

const STATUS_COLOURS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  REJECTED: 'bg-red-100 text-red-800',
  COMPLETED: 'bg-green-100 text-green-800',
}

export default async function MyBookingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, service_type:service_types(name, duration_minutes, price_sgd)')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })

  const { data: scheduledJobs } = await supabase
    .from('scheduled_jobs')
    .select('booking_id, scheduled_start_time, scheduled_date')
    .in('booking_id', (bookings ?? []).map((b: any) => b.id))

  const jobsByBooking = Object.fromEntries(
    (scheduledJobs ?? []).map((j: any) => [j.booking_id, j])
  )

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">My Bookings</h1>
      {!bookings?.length && (
        <p className="text-muted-foreground">No bookings yet.</p>
      )}
      <div className="space-y-4">
        {(bookings ?? []).map((b: any) => {
          const job = jobsByBooking[b.id]
          return (
            <Card key={b.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">{b.service_type.name}</CardTitle>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOURS[b.status]}`}>
                    {b.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p>📅 Available: {b.earliest_date} – {b.latest_date}</p>
                {b.confirmed_date && <p>✅ Confirmed: {b.confirmed_date}</p>}
                {job && <p>🕐 Scheduled: {job.scheduled_date} at {job.scheduled_start_time.slice(0, 5)}</p>}
                <p>📍 {b.address}, S{b.postal_code}</p>
                {b.num_units && <p>🔧 {b.num_units} unit{b.num_units > 1 ? 's' : ''}</p>}
                {b.rejection_reason && (
                  <p className="text-red-600">Reason: {b.rejection_reason}</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </main>
  )
}
```

- [ ] **Test booking flow end-to-end**

```bash
npm run dev
```
1. Go to `/services` → click "Book Now" on a service
2. Complete all 4 steps (verify address in step 3)
3. Submit → should redirect to `/account/bookings?success=1`
4. Check Supabase Table Editor → booking row visible with status `PENDING`
5. Check that confirmation email arrived in inbox

- [ ] **Commit**

```bash
git add app/ components/booking/
git commit -m "feat: booking wizard with 3 category flows (maintenance, fault repair, installation)"
```

---

## Task 11: Admin Pages

**Files:**
- Create: `app/admin/layout.tsx`, `app/admin/page.tsx`, `app/admin/bookings/page.tsx`, `components/admin/BookingCard.tsx`

- [ ] **Write `app/admin/layout.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  return (
    <div className="min-h-screen flex">
      <aside className="w-52 bg-muted border-r p-4 space-y-2 shrink-0">
        <p className="font-bold text-sm mb-4">HydroWash Admin</p>
        {[
          { href: '/admin', label: 'Overview' },
          { href: '/admin/bookings', label: 'Bookings' },
          { href: '/admin/schedule/' + new Date().toISOString().split('T')[0], label: 'Today\'s Schedule' },
          { href: '/admin/settings', label: 'Settings' },
        ].map(({ href, label }) => (
          <Link key={href} href={href}
            className="block text-sm px-3 py-2 rounded hover:bg-background transition-colors">
            {label}
          </Link>
        ))}
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  )
}
```

- [ ] **Write `app/admin/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default async function AdminOverviewPage() {
  const supabase = await createClient()
  const { count: pending } = await supabase
    .from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'PENDING')
  const today = new Date().toISOString().split('T')[0]
  const { count: todayJobs } = await supabase
    .from('scheduled_jobs').select('*', { count: 'exact', head: true }).eq('scheduled_date', today)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/bookings">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader><CardTitle className="text-base">Pending Bookings</CardTitle></CardHeader>
            <CardContent><p className="text-4xl font-bold">{pending ?? 0}</p></CardContent>
          </Card>
        </Link>
        <Link href={`/admin/schedule/${today}`}>
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader><CardTitle className="text-base">Today's Scheduled Jobs</CardTitle></CardHeader>
            <CardContent><p className="text-4xl font-bold">{todayJobs ?? 0}</p></CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Write `app/admin/bookings/page.tsx`** — 4-tab booking management

> Also run: `npx shadcn@latest add tabs` before implementing this page.

```tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { BookingWithRelations } from '@/lib/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import MaintenanceMapTab from '@/components/admin/MaintenanceMapTab'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const URGENCY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 }

export default function AdminBookingsPage() {
  const supabase = createClient()
  const [bookings, setBookings] = useState<BookingWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase
      .from('bookings')
      .select('*, customer:profiles(name,phone), service_type:service_types(name,duration_minutes,price_sgd)')
      .order('created_at', { ascending: false })
    setBookings((data as BookingWithRelations[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const pending = (cat: string) =>
    bookings.filter(b => b.category === cat && b.status === 'PENDING')

  const faultPending = bookings
    .filter(b => b.category === 'FAULT_REPAIR' && b.status === 'PENDING')
    .sort((a, b) => (URGENCY_ORDER[a.urgency ?? 'LOW'] ?? 2) - (URGENCY_ORDER[b.urgency ?? 'LOW'] ?? 2))

  async function approveOne(id: string, confirmedDate: string) {
    await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', confirmed_date: confirmedDate }),
    })
    load()
  }

  async function rejectOne(id: string, reason: string) {
    await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', rejection_reason: reason }),
    })
    load()
  }

  async function markComplete(id: string) {
    await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete' }),
    })
    load()
  }

  if (loading) return <p className="p-6">Loading…</p>

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">Booking Management</h1>
      <Tabs defaultValue="maintenance">
        <TabsList className="mb-4">
          <TabsTrigger value="maintenance">Maintenance ({pending('MAINTENANCE').length})</TabsTrigger>
          <TabsTrigger value="fault">Fault Repair ({faultPending.length})</TabsTrigger>
          <TabsTrigger value="installation">Installation ({pending('INSTALLATION').length})</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        {/* Maintenance tab — Google Map with geographic clustering + bulk approve */}
        <TabsContent value="maintenance">
          <MaintenanceMapTab
            bookings={pending('MAINTENANCE')}
            onApproved={load}
          />
        </TabsContent>

        {/* Fault Repair tab — sorted by urgency, approve individually */}
        <TabsContent value="fault">
          <div className="space-y-3">
            {faultPending.length === 0 && <p className="text-muted-foreground">No pending fault repairs.</p>}
            {faultPending.map(b => (
              <FaultCard key={b.id} booking={b} onApprove={approveOne} onReject={rejectOne} />
            ))}
          </div>
        </TabsContent>

        {/* Installation tab — approve individually */}
        <TabsContent value="installation">
          <div className="space-y-3">
            {pending('INSTALLATION').length === 0 && <p className="text-muted-foreground">No pending installations.</p>}
            {pending('INSTALLATION').map(b => (
              <InstallationCard key={b.id} booking={b} onApprove={approveOne} onReject={rejectOne} />
            ))}
          </div>
        </TabsContent>

        {/* All tab — full list with status filter, mark complete */}
        <TabsContent value="all">
          <div className="space-y-2">
            {bookings.map(b => (
              <div key={b.id} className="flex items-center gap-3 border rounded p-3 text-sm">
                <div className="flex-1">
                  <p className="font-medium">{b.service_type.name}</p>
                  <p className="text-muted-foreground">{(b.customer as any).name} · {b.address}</p>
                  {b.confirmed_date && <p>Confirmed: {b.confirmed_date}</p>}
                </div>
                <Badge>{b.status}</Badge>
                {b.status === 'APPROVED' && (
                  <Button size="sm" variant="outline" onClick={() => markComplete(b.id)}>
                    Mark Complete
                  </Button>
                )}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </main>
  )
}

// ── Fault card ──────────────────────────────────────────────────────────────
function FaultCard({ booking, onApprove, onReject }: {
  booking: BookingWithRelations
  onApprove: (id: string, date: string) => void
  onReject: (id: string, reason: string) => void
}) {
  const [confirmedDate, setConfirmedDate] = useState('')
  const today = new Date().toISOString().split('T')[0]
  const URGENCY_COLOURS: Record<string, string> = { HIGH: 'bg-red-100 text-red-800', MEDIUM: 'bg-yellow-100 text-yellow-800', LOW: 'bg-green-100 text-green-800' }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-base">{booking.service_type.name}</CardTitle>
          {booking.urgency && (
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${URGENCY_COLOURS[booking.urgency]}`}>
              {booking.urgency}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        <p>{booking.fault_description}</p>
        <p className="text-muted-foreground">📞 {(booking.customer as any).phone}</p>
        <p>Available: {booking.earliest_date} – {booking.latest_date}</p>
        <div className="flex gap-2 items-center pt-1">
          <input type="date" className="border rounded px-2 py-1 text-xs"
            min={booking.earliest_date ?? today} max={booking.latest_date ?? undefined}
            value={confirmedDate} onChange={e => setConfirmedDate(e.target.value)} />
          <Button size="sm" disabled={!confirmedDate}
            onClick={() => onApprove(booking.id, confirmedDate)}>Approve</Button>
          <Button size="sm" variant="destructive"
            onClick={() => onReject(booking.id, 'Unable to accommodate')}>Reject</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Installation card ───────────────────────────────────────────────────────
function InstallationCard({ booking, onApprove, onReject }: {
  booking: BookingWithRelations
  onApprove: (id: string, date: string) => void
  onReject: (id: string, reason: string) => void
}) {
  const [confirmedDate, setConfirmedDate] = useState('')
  const today = new Date().toISOString().split('T')[0]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{(booking.customer as any).name}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-1">
        <p>{booking.num_units} unit{(booking.num_units ?? 0) > 1 ? 's' : ''}{booking.ac_brand ? ` · ${booking.ac_brand}` : ''}{booking.ac_model ? ` ${booking.ac_model}` : ''}</p>
        {booking.room_type && <p>Room: {booking.room_type}</p>}
        <p>Available: {booking.earliest_date} – {booking.latest_date}</p>
        <div className="flex gap-2 items-center pt-1">
          <input type="date" className="border rounded px-2 py-1 text-xs"
            min={booking.earliest_date ?? today} max={booking.latest_date ?? undefined}
            value={confirmedDate} onChange={e => setConfirmedDate(e.target.value)} />
          <Button size="sm" disabled={!confirmedDate}
            onClick={() => onApprove(booking.id, confirmedDate)}>Approve</Button>
          <Button size="sm" variant="destructive"
            onClick={() => onReject(booking.id, 'Unable to accommodate')}>Reject</Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Write `components/admin/MaintenanceMapTab.tsx`** — Google Maps clustering + bulk approve

```tsx
'use client'
import { useState } from 'react'
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api'
import type { BookingWithRelations } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface Props {
  bookings: BookingWithRelations[]
  onApproved: () => void
}

export default function MaintenanceMapTab({ bookings, onApproved }: Props) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  })

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmedDate, setConfirmedDate] = useState('')
  const [result, setResult] = useState<{ approvedCount: number; excludedCount: number } | null>(null)
  const [loading, setLoading] = useState(false)

  function toggleMarker(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setResult(null)
  }

  async function bulkApprove() {
    if (!confirmedDate || selectedIds.size === 0) return
    setLoading(true)
    const res = await fetch('/api/bookings/bulk-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingIds: Array.from(selectedIds), confirmedDate }),
    })
    const data = await res.json()
    setResult({ approvedCount: data.approved.length, excludedCount: data.excludedCount })
    setSelectedIds(new Set())
    setLoading(false)
    onApproved()
  }

  const center = bookings.length
    ? { lat: bookings[0].lat, lng: bookings[0].lng }
    : { lat: 1.3521, lng: 103.8198 }  // Singapore default

  const today = new Date().toISOString().split('T')[0]

  if (bookings.length === 0) return <p className="text-muted-foreground">No pending maintenance bookings.</p>

  return (
    <div className="space-y-4">
      {/* Map */}
      {isLoaded ? (
        <GoogleMap mapContainerStyle={{ height: '400px', width: '100%', borderRadius: '8px' }}
          center={center} zoom={12}>
          {bookings.map(b => (
            <Marker key={b.id}
              position={{ lat: b.lat, lng: b.lng }}
              onClick={() => toggleMarker(b.id)}
              icon={{
                url: selectedIds.has(b.id)
                  ? 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                  : 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
              }}
            />
          ))}
        </GoogleMap>
      ) : (
        <div className="h-96 bg-muted rounded-lg flex items-center justify-center">
          <p className="text-muted-foreground">Loading map…</p>
        </div>
      )}

      {/* Bulk approve controls */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <p className="text-sm">
            <strong>{selectedIds.size}</strong> booking{selectedIds.size !== 1 ? 's' : ''} selected
            {selectedIds.size === 0 && ' — click map pins to select'}
          </p>
          <div className="flex gap-3 items-center flex-wrap">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Confirmed Date</label>
              <input type="date" className="border rounded px-2 py-1 text-sm"
                min={today} value={confirmedDate}
                onChange={e => { setConfirmedDate(e.target.value); setResult(null) }} />
            </div>
            <Button disabled={selectedIds.size === 0 || !confirmedDate || loading}
              onClick={bulkApprove}>
              {loading ? 'Approving…' : `Approve ${selectedIds.size} Selected`}
            </Button>
            {selectedIds.size > 0 && (
              <Button variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear selection</Button>
            )}
          </div>
          {result && (
            <div className="text-sm space-y-1">
              <p className="text-green-600">✓ {result.approvedCount} booking{result.approvedCount !== 1 ? 's' : ''} approved for {confirmedDate}</p>
              {result.excludedCount > 0 && (
                <p className="text-amber-600">⚠ {result.excludedCount} booking{result.excludedCount !== 1 ? 's' : ''} excluded — date outside their requested range</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Booking list for reference */}
      <div className="text-sm space-y-2">
        {bookings.map(b => (
          <div key={b.id}
            className={`flex items-center gap-3 border rounded p-2 cursor-pointer transition-colors
              ${selectedIds.has(b.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
            onClick={() => toggleMarker(b.id)}>
            <div className="flex-1">
              <p className="font-medium">{(b.customer as any).name} · {b.num_units} unit{(b.num_units ?? 0) > 1 ? 's' : ''}</p>
              <p className="text-muted-foreground">{b.address} · {b.earliest_date} – {b.latest_date}</p>
            </div>
            {selectedIds.has(b.id) && <span className="text-primary text-xs font-medium">Selected</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Test admin bookings**

```bash
npm run dev
```
1. Log in as admin → go to `/admin/bookings`
2. Maintenance tab: click map pins to select a cluster, pick a confirmed date, click Approve → customer gets email; bookings outside the date range are excluded with a warning
3. Fault Repair tab: approve/reject individual bookings sorted by urgency
4. Installation tab: approve/reject with confirmed date picker

- [ ] **Commit**

```bash
git add app/admin/ components/admin/
git commit -m "feat: admin booking management with 4-tab interface and maintenance map clustering"
```

---

## Task 12: Admin Schedule + Route Optimiser Page

**Files:**
- Create: `app/admin/schedule/[date]/page.tsx`, `components/admin/ScheduleCarColumn.tsx`, `components/admin/JobCard.tsx`

- [ ] **Write `components/admin/JobCard.tsx`**

```tsx
interface OptimizedJobDisplay {
  bookingId: string
  carId: string
  sequenceOrder: number
  scheduledStartTime: string
  address: string
  serviceName: string
  durationMinutes: number
  customerName: string
  notes: string | null
}

interface Props {
  job: OptimizedJobDisplay
}

export default function JobCard({ job }: Props) {
  return (
    <div className="border rounded p-3 text-sm bg-background space-y-1">
      <div className="flex justify-between items-center">
        <span className="font-semibold">{job.scheduledStartTime}</span>
        <span className="text-xs text-muted-foreground">~{job.durationMinutes} min</span>
      </div>
      <p className="font-medium">{job.serviceName}</p>
      <p className="text-muted-foreground">{job.address}</p>
      <p className="text-xs">👤 {job.customerName}</p>
      {job.notes && <p className="text-xs text-muted-foreground italic">{job.notes}</p>}
    </div>
  )
}
```

- [ ] **Write `components/admin/ScheduleCarColumn.tsx`**

```tsx
import JobCard from './JobCard'
import type { OptimizedJobDisplay } from '@/app/admin/schedule/[date]/page'

interface Props {
  carLabel: string
  jobs: OptimizedJobDisplay[]
}

export default function ScheduleCarColumn({ carLabel, jobs }: Props) {
  return (
    <div className="border rounded-lg p-4 min-w-[240px] flex-1">
      <h3 className="font-semibold mb-3">{carLabel}</h3>
      {jobs.length === 0
        ? <p className="text-sm text-muted-foreground">No jobs assigned</p>
        : <div className="space-y-2">{jobs.map(j => <JobCard key={j.bookingId} job={j} />)}</div>
      }
    </div>
  )
}
```

- [ ] **Write `app/admin/schedule/[date]/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ServiceCar } from '@/lib/types'
import ScheduleCarColumn from '@/components/admin/ScheduleCarColumn'
import { Button } from '@/components/ui/button'

export interface OptimizedJobDisplay {
  bookingId: string
  carId: string
  sequenceOrder: number
  scheduledStartTime: string
  address: string
  serviceName: string
  durationMinutes: number
  customerName: string
  notes: string | null
}

export default function SchedulePage() {
  const { date } = useParams<{ date: string }>()
  const supabase = createClient()

  const [cars, setCars] = useState<ServiceCar[]>([])
  const [availability, setAvailability] = useState<Record<string, boolean>>({})
  const [jobs, setJobs] = useState<OptimizedJobDisplay[]>([])
  const [optimizing, setOptimizing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [optimized, setOptimized] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: carsData } = await supabase
        .from('service_cars').select('*').eq('active', true)
      setCars((carsData ?? []) as ServiceCar[])

      const { data: avail } = await supabase
        .from('daily_car_availability').select('*').eq('date', date)
      const map: Record<string, boolean> = {}
      ;(avail ?? []).forEach((a: any) => { map[a.service_car_id] = a.is_available })
      setAvailability(map)

      // Load existing confirmed schedule if any
      const { data: existing } = await supabase
        .from('scheduled_jobs')
        .select('*, booking:bookings(address, notes, num_units, customer:profiles(name), service_type:service_types(name, duration_minutes))')
        .eq('scheduled_date', date)
        .order('sequence_order')

      if (existing?.length) {
        const mapped = existing.map((j: any) => ({
          bookingId: j.booking_id,
          carId: j.service_car_id,
          sequenceOrder: j.sequence_order,
          scheduledStartTime: j.scheduled_start_time.slice(0, 5),
          address: j.booking.address,
          serviceName: j.booking.service_type.name,
          durationMinutes: j.booking.service_type.duration_minutes * j.booking.num_units,
          customerName: j.booking.customer.name,
          notes: j.booking.notes,
        }))
        setJobs(mapped)
        setOptimized(true)
      }
    }
    load()
  }, [date])

  async function toggleCarAvailability(carId: string) {
    const current = availability[carId] !== false
    const newVal = !current
    await supabase.from('daily_car_availability').upsert({
      service_car_id: carId,
      date,
      is_available: newVal,
    })
    setAvailability(prev => ({ ...prev, [carId]: newVal }))
  }

  async function optimize() {
    setOptimizing(true)
    setError('')
    const res = await fetch('/api/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    })
    if (!res.ok) {
      const { error: msg } = await res.json()
      setError(msg ?? 'Optimization failed')
      setOptimizing(false)
      return
    }
    const { optimizedJobs } = await res.json()

    // Enrich with display data
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, address, notes, num_units, customer:profiles(name), service_type:service_types(name, duration_minutes)')
      .in('id', optimizedJobs.map((j: any) => j.bookingId))

    const bookingMap = Object.fromEntries((bookings ?? []).map((b: any) => [b.id, b]))

    const enriched: OptimizedJobDisplay[] = optimizedJobs.map((j: any) => {
      const b = bookingMap[j.bookingId]
      return {
        bookingId: j.bookingId,
        carId: j.carId,
        sequenceOrder: j.sequenceOrder,
        scheduledStartTime: j.scheduledStartTime,
        address: b?.address ?? '',
        serviceName: b?.service_type?.name ?? '',
        durationMinutes: (b?.service_type?.duration_minutes ?? 0) * (b?.num_units ?? 1),
        customerName: b?.customer?.name ?? '',
        notes: b?.notes ?? null,
      }
    })

    setJobs(enriched)
    setOptimized(true)
    setOptimizing(false)
  }

  async function confirmSchedule() {
    setConfirming(true)
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        jobs: jobs.map(j => ({
          bookingId: j.bookingId,
          carId: j.carId,
          sequenceOrder: j.sequenceOrder,
          scheduledStartTime: j.scheduledStartTime,
        })),
      }),
    })
    setConfirming(false)
    if (!res.ok) setError('Failed to confirm schedule')
  }

  const jobsByCar = cars.reduce((acc, car) => {
    acc[car.id] = jobs.filter(j => j.carId === car.id)
    return acc
  }, {} as Record<string, OptimizedJobDisplay[]>)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Schedule for {date}</h1>

      {/* Car availability toggles */}
      <div className="flex gap-3 flex-wrap mb-6">
        {cars.map(car => {
          const avail = availability[car.id] !== false
          return (
            <button key={car.id}
              onClick={() => toggleCarAvailability(car.id)}
              className={`text-sm px-3 py-1.5 rounded border transition-colors
                ${avail ? 'bg-green-50 border-green-400 text-green-700' : 'bg-red-50 border-red-300 text-red-600'}`}>
              {car.label} {avail ? '✅' : '❌'}
            </button>
          )
        })}
      </div>

      <div className="flex gap-3 mb-6">
        <Button onClick={optimize} disabled={optimizing}>
          {optimizing ? 'Optimizing…' : '🗺 Auto-Optimize Routes'}
        </Button>
        {optimized && (
          <Button variant="outline" onClick={confirmSchedule} disabled={confirming}>
            {confirming ? 'Confirming…' : '✅ Confirm Schedule & Notify Customers'}
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {optimized && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {cars.filter(c => availability[c.id] !== false).map(car => (
            <ScheduleCarColumn key={car.id} carLabel={car.label} jobs={jobsByCar[car.id] ?? []} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Test the schedule page end-to-end**

```bash
npm run dev
```
1. Go to `/admin/schedule/2026-05-10` (or any date with approved bookings)
2. Toggle car availability
3. Click "Auto-Optimize Routes" → job cards appear per car with times
4. Click "Confirm Schedule" → customers receive appointment confirmation emails
5. Log in as technician → check `/technician/jobs` (built in next task)

- [ ] **Commit**

```bash
git add app/admin/schedule/ components/admin/
git commit -m "feat: admin daily schedule page with route optimiser"
```

---

## Task 13: Admin Settings Page

**Files:**
- Create: `app/admin/settings/page.tsx`

- [ ] **Write `app/admin/settings/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AppSettings, ServiceCar, ServiceType } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SettingsPage() {
  const supabase = createClient()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [cars, setCars] = useState<ServiceCar[]>([])
  const [services, setServices] = useState<ServiceType[]>([])
  const [newCarLabel, setNewCarLabel] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('app_settings').select('*').eq('id', 1).single()
      .then(({ data }) => setSettings(data as AppSettings))
    supabase.from('service_cars').select('*').order('label')
      .then(({ data }) => setCars(data as ServiceCar[] ?? []))
    supabase.from('service_types').select('*').order('name')
      .then(({ data }) => setServices(data as ServiceType[] ?? []))
  }, [])

  async function saveSettings() {
    if (!settings) return
    setSaving(true)
    // Geocode depot address
    const res = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: settings.depot_address }),
    })
    if (res.ok) {
      const { lat, lng } = await res.json()
      await supabase.from('app_settings').update({
        ...settings, depot_lat: lat, depot_lng: lng,
      }).eq('id', 1)
    } else {
      await supabase.from('app_settings').update(settings).eq('id', 1)
    }
    setSaving(false)
  }

  async function addCar() {
    if (!newCarLabel.trim()) return
    const { data } = await supabase.from('service_cars')
      .insert({ label: newCarLabel.trim() }).select().single()
    if (data) setCars(prev => [...prev, data as ServiceCar])
    setNewCarLabel('')
  }

  async function toggleCarActive(id: string, current: boolean) {
    await supabase.from('service_cars').update({ active: !current }).eq('id', id)
    setCars(prev => prev.map(c => c.id === id ? { ...c, active: !current } : c))
  }

  if (!settings) return <p>Loading…</p>

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader><CardTitle>Company & Depot</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(['company_name', 'contact_email', 'depot_address'] as const).map(field => (
            <div key={field} className="space-y-1">
              <Label className="capitalize">{field.replace(/_/g, ' ')}</Label>
              <Input value={(settings as any)[field]}
                onChange={e => setSettings(prev => ({ ...prev!, [field]: e.target.value }))} />
            </div>
          ))}
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Service Cars</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {cars.map(car => (
            <div key={car.id} className="flex items-center justify-between">
              <span className="text-sm">{car.label}</span>
              <button onClick={() => toggleCarActive(car.id, car.active)}
                className={`text-xs px-2 py-1 rounded ${car.active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                {car.active ? 'Active' : 'Inactive'}
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input placeholder="New car label (e.g. Car B)" value={newCarLabel}
              onChange={e => setNewCarLabel(e.target.value)} />
            <Button variant="outline" onClick={addCar}>Add</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add app/admin/settings/
git commit -m "feat: admin settings page"
```

---

## Task 14: Technician Job View

**Files:**
- Create: `app/technician/layout.tsx`, `app/technician/jobs/page.tsx`, `components/technician/TechJobCard.tsx`

- [ ] **Write `app/technician/layout.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function TechnicianLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'technician') redirect('/')
  return <div className="max-w-2xl mx-auto p-4">{children}</div>
}
```

- [ ] **Write `components/technician/TechJobCard.tsx`**

```tsx
interface Props {
  sequenceOrder: number
  scheduledStartTime: string
  serviceName: string
  durationMinutes: number
  address: string
  postalCode: string
  customerName: string
  customerPhone: string
  numUnits: number
  notes: string | null
}

export default function TechJobCard(props: Props) {
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-lg font-bold">
          #{props.sequenceOrder} · {props.scheduledStartTime.slice(0, 5)}
        </span>
        <span className="text-sm text-muted-foreground">~{props.durationMinutes} min</span>
      </div>
      <p className="font-semibold">{props.serviceName}</p>
      <p className="text-sm">📍 {props.address}, S{props.postalCode}</p>
      <p className="text-sm">👤 {props.customerName} · 📞 {props.customerPhone}</p>
      <p className="text-sm">🔧 {props.numUnits} unit{props.numUnits > 1 ? 's' : ''}</p>
      {props.notes && (
        <p className="text-sm bg-muted rounded p-2">📝 {props.notes}</p>
      )}
    </div>
  )
}
```

- [ ] **Write `app/technician/jobs/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import TechJobCard from '@/components/technician/TechJobCard'
import { redirect } from 'next/navigation'

export default async function TechnicianJobsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('name, service_car_id').eq('id', user.id).single()
  if (!profile?.service_car_id) {
    return <p className="text-muted-foreground p-4">You haven't been assigned to a car yet. Ask the admin.</p>
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: jobs } = await supabase
    .from('scheduled_jobs')
    .select(`
      sequence_order, scheduled_start_time, scheduled_date,
      booking:bookings(
        address, postal_code, num_units, notes,
        customer:profiles(name, phone),
        service_type:service_types(name, duration_minutes)
      )
    `)
    .eq('service_car_id', profile.service_car_id)
    .gte('scheduled_date', today)
    .order('scheduled_date')
    .order('sequence_order')

  const byDate = ((jobs ?? []) as any[]).reduce((acc: Record<string, any[]>, j) => {
    const d = j.scheduled_date
    if (!acc[d]) acc[d] = []
    acc[d].push(j)
    return acc
  }, {})

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">My Jobs — {profile.name}</h1>
      {!Object.keys(byDate).length && (
        <p className="text-muted-foreground">No scheduled jobs yet.</p>
      )}
      {Object.entries(byDate).map(([date, dateJobs]) => (
        <div key={date} className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{date}</h2>
          <div className="space-y-3">
            {dateJobs.map((j: any) => (
              <TechJobCard
                key={j.sequence_order + j.scheduled_date}
                sequenceOrder={j.sequence_order}
                scheduledStartTime={j.scheduled_start_time}
                serviceName={j.booking.service_type.name}
                durationMinutes={j.booking.service_type.duration_minutes * j.booking.num_units}
                address={j.booking.address}
                postalCode={j.booking.postal_code}
                customerName={j.booking.customer.name}
                customerPhone={j.booking.customer.phone}
                numUnits={j.booking.num_units}
                notes={j.booking.notes}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Create technician user for testing**

In Supabase dashboard → Authentication → Add User (email + password). Then in SQL Editor:
```sql
-- Get the new user's UUID from Authentication tab
insert into profiles (id, name, phone, role, service_car_id)
values (
  'TECHNICIAN-UUID-HERE',
  'Technician Name',
  '91234567',
  'technician',
  (select id from service_cars limit 1)
);
```

- [ ] **Verify technician view**

```bash
npm run dev
```
1. Log in as technician → should auto-redirect to `/technician/jobs`
2. Confirm jobs appear after admin confirms a schedule
3. Confirm no approve/reject buttons appear anywhere

- [ ] **Commit**

```bash
git add app/technician/ components/technician/
git commit -m "feat: technician read-only job view"
```

---

## Task 15: Day-Before Reminder Cron

**Files:**
- Create: `app/api/cron/reminders/route.ts`, `vercel.json`

- [ ] **Write `app/api/cron/reminders/route.ts`**

```typescript
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendDayBeforeReminder } from '@/lib/email/resend'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Verify this is called by Vercel Cron (not public)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const { data: jobs } = await supabase
    .from('scheduled_jobs')
    .select(`
      scheduled_start_time,
      booking:bookings(
        address, customer_id,
        customer:profiles(name),
        service_type:service_types(name)
      )
    `)
    .eq('scheduled_date', tomorrowStr)

  const { data: settings } = await supabase
    .from('app_settings').select('company_name').eq('id', 1).single()

  let sent = 0
  for (const job of (jobs ?? []) as any[]) {
    const { data: { user } } = await supabase.auth.admin.getUserById(job.booking.customer_id)
    if (!user?.email) continue
    await sendDayBeforeReminder(user.email, {
      customerName: job.booking.customer.name,
      serviceName: job.booking.service_type.name,
      scheduledTime: job.scheduled_start_time.slice(0, 5),
      address: job.booking.address,
      companyName: settings?.company_name ?? 'HydroWash',
    }).catch(console.error)
    sent++
  }

  return NextResponse.json({ ok: true, sent })
}
```

- [ ] **Write `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 20 * * *"
    }
  ]
}
```

> This runs at 8pm SGT (UTC+8 = 12:00 UTC) every day, sending reminders for the next day's appointments.

- [ ] **Add `CRON_SECRET` to `.env.local`**

```bash
CRON_SECRET=some-long-random-secret-string
```

Add the same value to Vercel project environment variables.

- [ ] **Commit**

```bash
git add app/api/cron/ vercel.json
git commit -m "feat: day-before reminder cron job"
```

---

## Task 16: Deploy to Vercel

- [ ] **Push to GitHub**

```bash
git remote add origin https://github.com/YOUR_USERNAME/hydrowash.git
git push -u origin main
```

- [ ] **Import project in Vercel**

Go to vercel.com → Add New Project → Import from GitHub → select the repo.

- [ ] **Set environment variables in Vercel**

In Vercel project settings → Environment Variables, add all vars from `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_MAPS_API_KEY`
- `RESEND_API_KEY`
- `CRON_SECRET`

- [ ] **Configure Supabase Auth redirect URL**

In Supabase → Authentication → URL Configuration:
- Site URL: `https://your-vercel-app.vercel.app`
- Redirect URLs: `https://your-vercel-app.vercel.app/auth/callback`

- [ ] **Deploy and run verification checklist**

```
1. Register customer → submit booking → PENDING appears in Supabase
2. Admin approves → customer gets email
3. Admin opens /admin/schedule/[date] → auto-optimize → confirm
4. Customer gets confirmed time email
5. Technician logs in → sees job list
6. Admin marks complete → status updates
```

- [ ] **Commit**

```bash
git add vercel.json
git commit -m "chore: production deployment configuration"
```

---

## Self-Review

### Spec Coverage Check

| Spec requirement | Task |
|---|---|
| Customer registration + login | Task 4 |
| 3-step booking wizard with geocoding | Task 10 |
| Guest-free (account required) | Task 4 + middleware |
| Admin approve/reject with email | Task 8 + 11 |
| Auto-suggest optimised schedule | Task 5 + 9 + 12 |
| Service car assignment | Task 9 (VRP) |
| Service car availability per day | Task 12 |
| Technician read-only view | Task 14 |
| Email at every status change | Task 7 + 8 + 9 |
| Day-before reminder | Task 15 |
| Fixed depot starting point | Task 9 (VRP inputs) |
| Three roles + RLS | Task 2 + 3 + 4 |
| Admin settings (types, cars, depot) | Task 13 |

### Type Consistency

- `VRPJob`, `VRPCar`, `OptimizedJob` defined in `lib/vrp/optimizer.ts` and imported in `app/api/optimize/route.ts` ✓
- `OptimizedJobDisplay` defined and exported from `app/admin/schedule/[date]/page.tsx` and imported in `ScheduleCarColumn.tsx` ✓
- All Supabase query shapes match column names in `001_schema.sql` ✓
